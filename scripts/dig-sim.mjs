// Incremental Dig Mode balance simulator — `npm run dig-sim`
//
// Monte-Carlo harness for tuning charges/bomb-density/ore economy. Mirrors the
// formulas in src/incremental/constants.ts — KEEP THIS PARAMS BLOCK IN SYNC
// when those change. Ignores Danger Sense/Nugget/Scanner/Durability upgrades
// (small positive corrections for the player), so treat results as a slightly
// pessimistic baseline, same convention as scripts/sim.mjs.
//
// IMPORTANT LIMITATION (see constants.ts for the full note): the "skill" param
// is a flat, uniform risk discount — it cannot model genuine deduction (a real
// player reading adjacency numbers, or owning Danger Sense, can PROVE specific
// tiles are 100% safe, not just "somewhat less risky"). Treat these numbers as
// a pessimistic lower bound / tuning direction, not a literal prediction of
// real skilled play.

// ─── Params (mirror src/incremental/constants.ts) ─────────────────────────────

const PARAMS = {
  baseDim: 5,
  maxDim: 9,
  boardDim: level => Math.min(9, 5 + 2 * Math.floor(level / 3)),
  bombDensityBase: 0.08,
  bombDensityStep: 0.006,
  bombDensityMax: 0.20,
  bombDensity: level => Math.min(0.20, 0.08 + (level - 1) * 0.006),
  emptyFrac: 0.30,
  clearBuffer: 2,        // DIG_CLEAR_BUFFER — a level clears once at most this many hidden non-bomb tiles remain
  cashBase: level => 1 + (level - 1) * 1.2, // was 4 — Dirt Value skill (unmodeled, pessimistic baseline) now raises this
  copperChance: 0.15,
  copperMult: 2.0,
  dirtToughness: 2,      // DIG_BASE_TOUGHNESS — a dirt tile now costs 2 charges to fully mine (only the FIRST carries bomb risk — same tile, already known safe)
};

// Charge budgets to sweep — mirrors base(5) + Pickaxe I(+8) + Pickaxe II(+8) stacking.
const CHARGE_BUDGETS = [5, 13, 21, 35, 60, 100];
// skill: chance a click that would've hit a bomb is instead correctly avoided
// via adjacency-number deduction (0 = random clicking, matches Standard's model).
const SKILLS = [0, 0.3, 0.6];
const ALPHA = 1.2; // greed threshold for the EV-optimal stopping policy
const RUNS = 4000;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function levelTileCounts(level) {
  const dim = PARAMS.boardDim(level);
  const total = dim * dim;
  const bombCount = Math.max(2, Math.min(total - 5, Math.round(total * PARAMS.bombDensity(level))));
  const remaining = total - bombCount;
  const emptyCount = Math.round(remaining * PARAMS.emptyFrac);
  const dirtCount = remaining - emptyCount;
  return { dim, total, bombCount, emptyCount, dirtCount };
}

function tileCashValue(level, rng) {
  const base = PARAMS.cashBase(level);
  return rng() < PARAMS.copperChance ? base * PARAMS.copperMult : base;
}

// ─── One run ────────────────────────────────────────────────────────────────
//
// policy: 'greedy'  — always push to fully clear every level, never voluntarily
//                     cash out (upper bound on reachable depth if charges allow)
//         'ev'       — voluntarily cash out once continuing this level has
//                     negative expected value (pBomb * currentLevelCash >=
//                     alpha * expectedTileValue), same greed math as Standard's
//                     per-attempt stopping rule (currentLevelCash is the "at
//                     risk" pool, analogous to attempt_earnings)
//
// A level is considered clearable once at most PARAMS.clearBuffer hidden
// non-bomb tiles remain (mirrors DIG_CLEAR_BUFFER / isDigLevelClearable).
//
// Returns { level, banked, clearedLevels, bustedAt } — bustedAt is null if the
// run ended by cashing out or running out of charges rather than a bomb.
function playRun(chargesMax, skill, policy, rng) {
  let charges = chargesMax;
  let banked = 0;
  let level = 1;
  let clearedLevels = 0;
  let bustedAt = null;

  while (charges > 0) {
    const { total, bombCount, emptyCount, dirtCount } = levelTileCounts(level);
    let hidden = total, nBomb = bombCount, nEmpty = emptyCount, nDirt = dirtCount;
    let currentLevelCash = 0;
    let levelCleared = false;

    while (charges > 0 && hidden > nBomb + PARAMS.clearBuffer) {
      const pBomb = (nBomb / hidden) * (1 - skill);
      const pDirt = nDirt / (nDirt + nEmpty);
      const expTile = pDirt * PARAMS.cashBase(level) * (1 + PARAMS.copperChance * (PARAMS.copperMult - 1));

      if (policy === 'ev' && currentLevelCash > 0 && pBomb * currentLevelCash >= ALPHA * expTile) {
        break; // voluntary cash-out — bank what we have and stop the whole run
      }

      charges--; // first click on a fresh tile — the only one carrying bomb risk
      if (rng() < pBomb) { bustedAt = level; break; }

      hidden--;
      if (rng() < pDirt) {
        nDirt--;
        // Remaining hits to fully mine this dirt tile — same tile, no further
        // bomb risk, just more charges spent (mirrors DIG_BASE_TOUGHNESS).
        charges = Math.max(0, charges - (PARAMS.dirtToughness - 1));
        currentLevelCash += tileCashValue(level, rng);
      } else {
        nEmpty--;
      }
    }

    if (bustedAt !== null) break; // currentLevelCash forfeited, not banked

    if (hidden <= nBomb + PARAMS.clearBuffer) { levelCleared = true; }
    banked += currentLevelCash;

    if (!levelCleared) break; // out of charges or voluntary cash-out mid-level

    clearedLevels++;
    level++;
  }

  return { level, banked, clearedLevels, bustedAt };
}

// ─── Report ───────────────────────────────────────────────────────────────────

console.log('Level tile counts (dim / total / bombs / empty / dirt), buffer=' + PARAMS.clearBuffer + ', dirtToughness=' + PARAMS.dirtToughness + ':');
for (const l of [1, 2, 3, 4, 5, 6, 7, 9, 12]) {
  const { dim, total, bombCount, emptyCount, dirtCount } = levelTileCounts(l);
  const clearableDirt = Math.max(0, dirtCount - PARAMS.clearBuffer);
  const chargesToClear = clearableDirt * PARAMS.dirtToughness + Math.min(emptyCount, Math.max(0, total - bombCount - PARAMS.clearBuffer - clearableDirt));
  console.log(`  level ${String(l).padEnd(2)}: ${dim}x${dim}=${total}  bombs=${bombCount}  empty=${emptyCount}  dirt=${dirtCount}  (needs ~${chargesToClear} charges to clear)`);
}

console.log(`\n— Depth reached & cash banked (median / p90, ${RUNS} runs), policy=greedy —`);
for (const skill of SKILLS) {
  let line = `skill=${String(skill).padEnd(4)}: `;
  for (const budget of CHARGE_BUDGETS) {
    const levels = [], cashes = [], clears1 = [];
    for (let i = 0; i < RUNS; i++) {
      const r = playRun(budget, skill, 'greedy', mulberry32(i * 7919 + budget * 1000 + skill * 100));
      levels.push(r.level); cashes.push(r.banked); clears1.push(r.clearedLevels >= 1 ? 1 : 0);
    }
    levels.sort((a, b) => a - b); cashes.sort((a, b) => a - b);
    const medLvl = levels[Math.floor(RUNS / 2)], p90Lvl = levels[Math.floor(RUNS * 0.9)];
    const medCash = cashes[Math.floor(RUNS / 2)];
    const clear1Rate = (clears1.reduce((a, b) => a + b, 0) / RUNS * 100).toFixed(0);
    line += `chg=${budget}: lvl(med=${medLvl},p90=${p90Lvl}) $${medCash.toFixed(0)} clear1=${clear1Rate}% | `;
  }
  console.log(line);
}

console.log(`\n— Depth reached & cash banked (median / p90, ${RUNS} runs), policy=ev (alpha=${ALPHA}) —`);
for (const skill of SKILLS) {
  let line = `skill=${String(skill).padEnd(4)}: `;
  for (const budget of CHARGE_BUDGETS) {
    const levels = [], cashes = [];
    for (let i = 0; i < RUNS; i++) {
      const r = playRun(budget, skill, 'ev', mulberry32(i * 104729 + budget * 1000 + skill * 100));
      levels.push(r.level); cashes.push(r.banked);
    }
    levels.sort((a, b) => a - b); cashes.sort((a, b) => a - b);
    const medLvl = levels[Math.floor(RUNS / 2)], p90Lvl = levels[Math.floor(RUNS * 0.9)];
    const medCash = cashes[Math.floor(RUNS / 2)];
    line += `chg=${budget}: lvl(med=${medLvl},p90=${p90Lvl}) $${medCash.toFixed(0)} | `;
  }
  console.log(line);
}
