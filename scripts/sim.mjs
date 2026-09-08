// Explodds balance simulator — `npm run sim`
//
// Monte-Carlo harness for tuning the economy. Mirrors the formulas in
// src/constants.ts and src/gameLogic.ts — KEEP THE PARAMS BLOCK IN SYNC when
// you change tile cash, bombs, empties, or deadlines.
//
// Ignores relics, consumables, events and combos (small positive corrections),
// so treat results as a slightly pessimistic baseline. Its "skill" knob is a
// flat risk discount and cannot model real deduction — for anything about the
// skill layer use `npm run bots` (scripts/playtest-bots.mjs), which plays the
// actual reducer code. This file is kept as a quick formula cross-check.

// ─── Params (mirror src/constants.ts) ─────────────────────────────────────────

const PARAMS = {
  startingWallet: 150,
  minBetBase: 10,
  minBetPerCycle: 2,             // MIN_BET_PER_CYCLE — min bet rises each cycle
  betStep: 5,
  fixedDeadlines: [60, 90, 120, 160, 200],
  deadlineGrowth: 1.25,          // cycle 6+ multiplier
  deadlineWalletChase: 0.55,     // DEADLINE_WALLET_CHASE — next deadline ≥ this × wallet
  emptyFrac: 0.25,               // share of non-bomb tiles that are empty
  tileBase: bet => 0.29 * Math.pow(bet, 0.9),          // TILE_CASH_BET_COEF × bet^TILE_CASH_BET_EXP
  boardCols: c => (c >= 10 ? 7 : c >= 6 ? 6 : 5),    // BOARD_GROWTH — the sim still plays 25 tiles; density is what matters
  baseBombs: c => (c <= 5 ? [3, 3, 4, 5, 6][c - 1] : Math.round(25 * Math.min(0.22 + (c - 6) * 0.02, 0.34))), // BOMB_DENSITY_* scaled to the sim's 25-tile board
  bombRatioSlope: 6,             // BOMB_RATIO_SLOPE — +1 bomb per 1/6 of wallet bet
  bombRatioCap: 5,               // BOMB_RATIO_CAP
  multGain: bombs => 0.04 + bombs * 0.005,             // MULT_GAIN_BASE + MULT_GAIN_PER_BOMB × bombs
  streak5Mult: 0.15, streak10Mult: 0.35, streak15Cash: 5,
  avgSymbolMod: 1.043,           // weighted mean of symbol modifiers (5 symbols: diamond/cherry/banana/star/bell)
  baseInterestRate: 0.12,        // BASE_INTEREST_RATE — per cashout, on the deposited pool
  inflatorInterestMult: 2,       // INFLATOR_INTEREST_MULT
  stakeReturned: true,           // cashout returns the bet on top of winnings; bust loses it
};

function calcMinBet(cycle) {
  return PARAMS.minBetBase + cycle * PARAMS.minBetPerCycle;
}

// Player models to sweep.
//   skill:   0 = random clicking, 0.35 = uses adjacency numbers decently
//            (that fraction of clicks lands on a known-safe tile)
//   betFrac: bet as a fraction of wallet (0 = always min bet)
//   alpha:   push-your-luck greed; keep clicking while
//            P(bomb)*earnings < alpha * expected tile value
const SKILLS = [0, 0.35, 0.6];
const BET_FRACS = [0, 0.25, 0.4];
const ALPHA = 1.2;
const RUNS = 3000;

// ─── Formulas ─────────────────────────────────────────────────────────────────

function calcDeadline(cycle) {
  const f = PARAMS.fixedDeadlines;
  if (cycle <= f.length) return f[cycle - 1];
  let d = f[f.length - 1];
  for (let i = f.length; i < cycle; i++) d = Math.round((d * PARAMS.deadlineGrowth) / 10) * 10;
  return d;
}

function calcBombs(bet, wallet, cycle) {
  const base = PARAMS.baseBombs(cycle);
  return Math.min(base + Math.floor((bet / Math.max(wallet, 1)) * PARAMS.bombRatioSlope), base + PARAMS.bombRatioCap, 18);
}

// 5 symbols only (coin was removed) — keep in sync with SYMBOLS in constants.ts
const SYMBOL_MODS = [[1.0, 20], [0.8, 20], [1.2, 18], [1.5, 12], [0.9, 18]];
function drawMod(rng) {
  let r = rng() * 100;
  for (const [m, w] of SYMBOL_MODS) { if (r < w) return m; r -= w; }
  return 1;
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Boss cycles (every 3rd) — rough approximations of the real rules ─────────
// monoculturist/blackout ≈ skill hit; saboteur ≈ +bombs; taxman ≈ income cut;
// glutton ≈ +empties; short_fuse ≈ 2 attempts; warden ≈ forced bet; inflator ≈ deadline+25%.

const BOSS_POOL = ['monoculturist', 'saboteur', 'blackout', 'taxman', 'glutton', 'short_fuse', 'warden', 'inflator'];
function bossForCycle(seedRng, cycle) {
  if (cycle % 3 !== 0) return null;
  return BOSS_POOL[Math.floor(seedRng() * BOSS_POOL.length)];
}

// ─── One attempt ──────────────────────────────────────────────────────────────

// Returns { earn, busted } — busted attempts return earn=0 but the caller still
// needs to know it was a bust (vs. a legitimate $0 cashout) to skip interest.
function playAttempt(bet, wallet, cycle, rng, { skill, alpha, boss }) {
  let bombs = calcBombs(bet, wallet, cycle);
  if (boss === 'saboteur') bombs += 2; // approximation of mid-attempt armed bombs
  if (boss === 'blackout' || boss === 'monoculturist') skill *= 0.4;
  let hidden = 25, nBomb = bombs;
  let nEmpty = Math.round((25 - bombs) * PARAMS.emptyFrac);
  if (boss === 'glutton') nEmpty += 4;
  let nSym = 25 - bombs - nEmpty;
  let mult = 1, streak = 0, earnings = 0;
  let s5 = false, s10 = false, s15 = false;
  const gain = PARAMS.multGain(bombs);

  while (hidden > nBomb) {
    const pBomb = (nBomb / hidden) * (1 - skill); // skill = adjacency deduction
    const pSym = nSym / (nSym + nEmpty);
    const expTile = pSym * PARAMS.tileBase(bet) * PARAMS.avgSymbolMod * mult;
    const atRisk = earnings + (PARAMS.stakeReturned ? bet : 0);
    if (earnings > 0 && pBomb * atRisk >= alpha * expTile) break;

    if (rng() < pBomb) return { earn: 0, busted: true };
    // safe click: symbol or empty proportionally
    if (rng() < pSym) {
      nSym--; hidden--;
      earnings += PARAMS.tileBase(bet) * drawMod(rng) * mult;
      mult += gain; streak++;
      if (streak >= 5 && !s5) { mult += PARAMS.streak5Mult; s5 = true; }
      if (streak >= 10 && !s10) { mult += PARAMS.streak10Mult; s10 = true; }
      if (streak >= 15 && !s15) { earnings += PARAMS.streak15Cash; s15 = true; }
    } else {
      nEmpty--; hidden--; // empties no longer break the streak (guesses do — not modelled here)
    }
    // approximate: the player's dodged bombs stay on the board
  }
  if (boss === 'taxman') earnings *= 0.75;
  return { earn: earnings, busted: false };
}

// ─── One run ──────────────────────────────────────────────────────────────────

// Deposit policy is itself a strategic choice — depositing early banks interest
// on the rest of the cycle's cashouts, but locks cash away that could otherwise
// grow the bankroll (or cushion a bad run) via more play. Model both extremes:
//   'early' — deposit any wallet cash not needed for the next bet, ASAP
//   'defer' — never deposit mid-cycle; let the final auto-sweep pay it at the end
// A rational player picks whichever wins; playRun sweeps both and returns the best.
function playRunWithDepositPolicy(profile, depositMode, rng, maxCycles = 60) {
  let wallet = PARAMS.startingWallet;
  for (let cycle = 1; cycle <= maxCycles; cycle++) {
    const boss = bossForCycle(rng, cycle);
    // The house notices: deadline never sits below a share of the wallet
    let deadline = Math.max(calcDeadline(cycle), Math.round((wallet * PARAMS.deadlineWalletChase) / 10) * 10);
    if (boss === 'inflator') deadline = Math.round((deadline * 1.25) / 10) * 10;
    const attempts = boss === 'short_fuse' ? 2 : 3;
    const minBet = calcMinBet(cycle);
    const interestRate = PARAMS.baseInterestRate * (boss === 'inflator' ? PARAMS.inflatorInterestMult : 1);
    let deposited = 0;

    for (let a = 0; a < attempts; a++) {
      if (wallet < minBet) break;
      let bet = boss === 'warden'
        ? Math.max(minBet, Math.round((wallet * 0.25) / PARAMS.betStep) * PARAMS.betStep)
        : Math.max(minBet, Math.round((wallet * profile.betFrac) / PARAMS.betStep) * PARAMS.betStep);
      if (bet > wallet) bet = Math.floor(wallet / PARAMS.betStep) * PARAMS.betStep;
      if (bet < minBet) break;

      if (depositMode === 'early') {
        const gapBefore = Math.max(0, deadline - deposited);
        const depositNow = Math.min(Math.max(0, wallet - bet), gapBefore);
        wallet -= depositNow; deposited += depositNow;
        if (deposited >= deadline) break; // deadline met early — cycle ends, attempts unused
      }

      const pre = wallet;
      wallet -= bet;
      const { earn, busted } = playAttempt(bet, pre, cycle, rng, { ...profile, boss });
      if (!busted) {
        // stake comes back on cashout; interest only on a successful cashout
        wallet += (PARAMS.stakeReturned ? bet : 0) + earn + deposited * interestRate;
      }
    }

    // Final sweep: bank whatever's left toward the deadline before judging the cycle
    const sweep = Math.min(wallet, Math.max(0, deadline - deposited));
    wallet -= sweep; deposited += sweep;

    if (deposited < deadline) return cycle - 1;
  }
  return maxCycles;
}

function playRun(profile, rng, maxCycles = 60) {
  // Same seed stream for both policies so this is an apples-to-apples comparison
  const early = playRunWithDepositPolicy(profile, 'early', mulberry32(rng() * 2 ** 31), maxCycles);
  const defer = playRunWithDepositPolicy(profile, 'defer', mulberry32(rng() * 2 ** 31), maxCycles);
  return Math.max(early, defer);
}

// ─── Report ───────────────────────────────────────────────────────────────────

console.log('Deadlines:', Array.from({ length: 10 }, (_, i) => `c${i + 1}=$${calcDeadline(i + 1)}`).join(' '));

console.log('\n— Per-attempt EV, cycle 1, wallet $150 —');
for (const skill of SKILLS) {
  let line = `skill=${skill}: `;
  for (const bet of [10, 40, 75]) {
    let sum = 0, busts = 0;
    const N = 20000;
    for (let i = 0; i < N; i++) {
      const { earn, busted } = playAttempt(bet, 150, 1, mulberry32(i * 104729 + bet), { skill, alpha: ALPHA });
      sum += earn; if (busted) busts++;
    }
    line += ` bet=$${bet}: EV=$${(sum / N).toFixed(1)} net=${(sum / N - bet).toFixed(1)} bust=${(busts / N * 100).toFixed(0)}% |`;
  }
  console.log(line);
}

console.log('\n— Cycles survived (median / p90 / best of ' + RUNS + ' runs) —');
for (const skill of SKILLS) {
  for (const betFrac of BET_FRACS) {
    const res = [];
    for (let i = 0; i < RUNS; i++) res.push(playRun({ skill, betFrac, alpha: ALPHA }, mulberry32(i * 7919 + skill * 1000 + betFrac * 100)));
    res.sort((a, b) => a - b);
    const med = res[Math.floor(RUNS / 2)], p90 = res[Math.floor(RUNS * 0.9)], best = res[RUNS - 1];
    console.log(`skill=${String(skill).padEnd(4)} betFrac=${String(betFrac).padEnd(4)} → median=${med} p90=${p90} best=${best}`);
  }
}
