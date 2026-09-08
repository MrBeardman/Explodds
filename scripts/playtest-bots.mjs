// Explodds bot playtest — `npm run bots [profiles|bycycle|density]`
//
// Plays Standard mode end-to-end through the REAL reducer logic (src/gameLogic.ts,
// bundled on the fly with rolldown into .playtest/), so every number here is
// what the shipped game actually does — unlike scripts/sim.mjs, which mirrors
// the formulas by hand and can drift.
//
// Two players:
//   random — uniform random hidden tile, cashes out after 4–7 clicks
//   solver — uses src/deduction.ts exactly like the game does: clicks PROVEN
//            tiles first, otherwise the lowest-risk guess, cashes out when the
//            risk to (stake + earnings) outweighs the next tile's expected value.
//            `skill` (0–1) is the chance it actually follows the proof on a
//            given click instead of guessing — 1 = perfect deducer.
//
// Targets (docs/plans/standard-loop-review.md): random ≈ 2 cycles, solver at
// min bet ≈ 5–8, solver betting 30% ≈ 10–15, nobody immortal.

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, '.playtest');
const srcNewer = (bundle) => {
  if (!existsSync(bundle)) return true;
  const b = statSync(bundle).mtimeMs;
  return ['gameLogic.ts', 'deduction.ts', 'constants.ts', 'rng.ts', 'meta.ts', 'types.ts']
    .some(f => statSync(path.join(root, 'src', f)).mtimeMs > b);
};
mkdirSync(outDir, { recursive: true });
if (srcNewer(path.join(outDir, 'gameLogic.js'))) {
  execSync('npx rolldown src/gameLogic.ts src/deduction.ts --dir .playtest --format esm', { cwd: root, stdio: 'pipe' });
}
globalThis.localStorage = { getItem: () => null, setItem() {} };
const GL = await import(pathToFileURL(path.join(outDir, 'gameLogic.js')).href);
const DD = await import(pathToFileURL(path.join(outDir, 'deduction.js')).href);

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Risk estimate for guessing: per-constraint density for constrained tiles,
// leftover global density for the rest (what a human eyeballs).
function guessRisk(state) {
  const b = state.board;
  const d = DD.analyzeBoard(state, b);
  const hidden = b.filter(t => t.state === 'hidden' || t.state === 'hinted' || t.state === 'flagged').map(t => t.index);
  const unknown = hidden.filter(j => !d.safe.has(j) && !d.bombs.has(j));
  const risk = new Map();
  const constrained = new Set();
  for (const t of b) {
    const n = DD.displayedNumber(state, b, t.index);
    if (n === null) continue;
    const nb = DD.numberNeighbors(state, t.index);
    const u = nb.filter(j => unknown.includes(j));
    const known = nb.filter(j => d.bombs.has(j) || b[j].state === 'flagged').length;
    if (!u.length) continue;
    const p = Math.max(0, Math.min(1, (n - known) / u.length));
    for (const j of u) { constrained.add(j); risk.set(j, Math.max(risk.get(j) ?? 0, p)); }
  }
  const bombsLeft = b.filter(t => t.type === 'bomb' && t.state !== 'bomb_hit' && t.state !== 'revealed').length;
  const knownBombs = [...d.bombs].filter(j => hidden.includes(j)).length;
  const expectedConstrained = [...constrained].reduce((s, j) => s + risk.get(j), 0);
  const free = unknown.filter(j => !constrained.has(j));
  const pFree = free.length ? Math.min(1, Math.max(0, bombsLeft - knownBombs - expectedConstrained) / free.length) : 1;
  for (const j of free) risk.set(j, pFree);
  return { d, hidden, unknown, risk };
}

function chooseClick(state, player, rng, { alpha, skill }) {
  const b = state.board;
  const hidden = b.filter(t => t.state === 'hidden' || t.state === 'hinted' || t.state === 'flagged').map(t => t.index);
  if (!hidden.length) return { action: 'cashout' };
  const canCashout = state.clicks_this_attempt >= 2;

  if (state.clicks_this_attempt === 0) {
    // opening: any tile — prefer an interior one so the 3×3 opening is largest
    const interior = hidden.filter(i => i % 5 > 0 && i % 5 < 4 && i > 4 && i < 20);
    const pool = interior.length ? interior : hidden;
    return { action: 'click', idx: pool[Math.floor(rng() * pool.length)], kind: 'free' };
  }
  if (player === 'random') {
    if (canCashout && state.clicks_this_attempt >= 4 + Math.floor(rng() * 4)) return { action: 'cashout' };
    return { action: 'click', idx: hidden[Math.floor(rng() * hidden.length)], kind: 'guess' };
  }

  const { d, unknown, risk } = guessRisk(state);
  const safe = [...d.safe].filter(j => hidden.includes(j));
  if (safe.length && rng() < skill) {
    // most informative proven tile: the one touching the most unknowns
    safe.sort((x, y) => DD.neighbors8(y).filter(j => unknown.includes(j)).length - DD.neighbors8(x).filter(j => unknown.includes(j)).length);
    return { action: 'click', idx: safe[0], kind: 'proven' };
  }
  let best = null, bestP = 2;
  for (const j of unknown) { const p = risk.get(j) ?? 1; if (p < bestP) { bestP = p; best = j; } }
  if (best === null) return canCashout ? { action: 'cashout' } : { action: 'click', idx: hidden[0], kind: 'guess' };
  if (canCashout) {
    const safeTiles = b.filter(t => t.type !== 'bomb' && (t.state === 'hidden' || t.state === 'hinted'));
    const symShare = safeTiles.length ? safeTiles.filter(t => t.type === 'symbol').length / safeTiles.length : 0;
    const expTile = symShare * GL.getSymbolOdds(state).reduce((s, r) => s + r.payout * r.pct / 100, 0) * state.multiplier;
    const atRisk = state.current_bet + state.attempt_earnings;
    if (bestP * atRisk >= alpha * expTile) return { action: 'cashout' };
    if (bestP >= 0.5) return { action: 'cashout' };
  }
  return { action: 'click', idx: best, kind: 'guess', risk: bestP };
}

export function playRun({ player = 'solver', seed = 1, cascade = 1, relics = [], betFrac = 0, alpha = 2.0, skill = 1, depositEarly = false, maxCycles = 40, trace = null } = {}) {
  const rng = mulberry32(seed * 7919 + 13);
  let s = GL.createInitialState();
  s = { ...s, seed, skills: { cascade, bomb_flag: 0 }, relics: [...relics] };
  s = { ...s, phase: 'EVENT_CARD', event_card_options: GL.drawEventCards(s) };
  const st = { clicks: 0, proven: 0, guess: 0, attempts: 0, busts: 0, byCycle: {} };
  const cyc = () => (st.byCycle[s.cycle_number] ??= { attempts: 0, busts: 0, proven: 0, clicks: 0, earn: 0, bet: 0 });
  let guard = 0;
  while (s.phase !== 'GAME_OVER' && guard++ < 200000 && s.cycle_number <= maxCycles) {
    switch (s.phase) {
      case 'EVENT_CARD':
        s = GL.toBetPhase({ ...s, active_events: [...s.active_events, s.event_card_options[0]], event_card_options: [] });
        break;
      case 'BOSS_INTRO': s = GL.toBetPhase(s); break;
      case 'BET': {
        const minBet = GL.getMinBet(s);
        if (depositEarly) {
          // Collateral play: bank half the deadline up front (−1 bomb + interest), keep the bet
          const want = Math.max(0, Math.ceil(s.deadline * 0.5) - s.deposited);
          const plannedBet = Math.max(minBet, Math.round((s.wallet * betFrac) / 5) * 5);
          const dep = Math.min(want, Math.max(0, s.wallet - plannedBet));
          if (dep > 0) { s = GL.handleDeposit(s, dep); if (s.phase !== 'BET') break; }
        }
        let bet = Math.max(minBet, Math.round((s.wallet * betFrac) / 5) * 5);
        bet = GL.clampBetToWallet(bet, s.wallet, minBet);
        if (bet > s.wallet) {
          s = GL.handleDeposit(s, s.wallet);
          if (s.phase === 'BET') s = GL.resolveCycleFailure(s);
          break;
        }
        s = GL.handlePlaceBet({ ...s, current_bet: bet });
        if (s.phase === 'PLACEMENT') s = { ...s, phase: 'CLEARING', placement_queue: [], placing_index: -1 };
        st.attempts++; cyc().attempts++; cyc().bet += bet;
        break;
      }
      case 'CLEARING': {
        const ch = chooseClick(s, player, rng, { alpha, skill });
        if (ch.action === 'cashout') {
          cyc().earn += s.attempt_earnings;
          if (trace) trace.push({ cycle: s.cycle_number, bet: s.current_bet, earn: s.attempt_earnings, tiles: s.tiles_cleared, mult: s.multiplier, proven: s.proven_clicks, guess: s.guess_clicks, walletAfter: s.wallet + s.current_bet + s.attempt_earnings, deadline: s.deadline });
          s = GL.handleCashout(s);
          break;
        }
        if (ch.kind !== 'free') { st.clicks++; cyc().clicks++; if (ch.kind === 'proven') { st.proven++; cyc().proven++; } else st.guess++; }
        s = GL.handleTileClick(s, ch.idx);
        if (s.phase === 'BUST_FLASH') {
          st.busts++; cyc().busts++;
          if (trace) trace.push({ cycle: s.cycle_number, bet: s.current_bet, bust: true, walletAfter: s.wallet, deadline: s.deadline });
        }
        break;
      }
      case 'BUST_FLASH': s = GL.handleBustFlashEnd(s); break;
      case 'RESULTS': s = GL.dismissResults(s); break;
      case 'SHOP': s = GL.startNextCycle({ ...s, pending_pack_choices: null }); break;
      default: throw new Error('unexpected phase ' + s.phase);
    }
    if (!Number.isFinite(s.wallet)) throw new Error(`wallet became ${s.wallet} at cycle ${s.cycle_number} (boss ${s.active_boss})`);
  }
  return { cycles: s.cycles_survived, stats: st, capped: s.cycle_number > maxCycles };
}

const pct = x => (x * 100).toFixed(0) + '%';
function summarize(label, cfg, runs = 300) {
  const cyc = []; let crashed = 0, capped = 0;
  const agg = { clicks: 0, proven: 0, guess: 0, attempts: 0, busts: 0 };
  const byCycle = {};
  for (let i = 0; i < runs; i++) {
    let r;
    try { r = playRun({ ...cfg, seed: 1000 + i }); } catch (e) { crashed++; if (crashed === 1) console.error('  !', e.message); continue; }
    cyc.push(r.cycles); if (r.capped) capped++;
    for (const k of Object.keys(agg)) agg[k] += r.stats[k];
    for (const [c, v] of Object.entries(r.stats.byCycle)) {
      const t = (byCycle[c] ??= { attempts: 0, busts: 0, proven: 0, clicks: 0, earn: 0, bet: 0 });
      for (const k of Object.keys(v)) t[k] += v[k];
    }
  }
  cyc.sort((a, b) => a - b);
  const n = cyc.length;
  const med = cyc[Math.floor(n / 2)], p90 = cyc[Math.floor(n * 0.9)], best = cyc[n - 1];
  console.log(`${label.padEnd(40)} cycles med=${String(med).padStart(2)} p90=${String(p90).padStart(2)} best=${String(best).padStart(2)}${capped ? ` (${capped} hit cap)` : ''}${crashed ? ` [${crashed} CRASHED]` : ''} | bust/attempt=${pct(agg.busts / agg.attempts).padStart(4)} | proven=${pct(agg.proven / Math.max(1, agg.clicks)).padStart(4)} guess=${pct(agg.guess / Math.max(1, agg.clicks)).padStart(4)} | clicks/attempt=${(agg.clicks / agg.attempts).toFixed(1)}`);
  return byCycle;
}

const mode = process.argv[2] ?? 'profiles';
if (mode === 'profiles') {
  console.log('=== Explodds bot playtest — 300 runs per profile, Cascade Sense 1 unless noted ===');
  summarize('random clicker, min bet', { player: 'random' });
  summarize('solver skill 0.5, min bet', { player: 'solver', skill: 0.5 });
  summarize('solver skill 0.75, min bet', { player: 'solver', skill: 0.75 });
  summarize('solver skill 0.75, bet 20%', { player: 'solver', skill: 0.75, betFrac: 0.2 });
  summarize('solver, min bet', { player: 'solver' });
  summarize('solver, cascade 0, min bet', { player: 'solver', cascade: 0 });
  summarize('solver, cascade 2, min bet', { player: 'solver', cascade: 2 });
  summarize('solver, bet 30%', { player: 'solver', betFrac: 0.3 });
  summarize('solver, bet 30%, deposit early', { player: 'solver', betFrac: 0.3, depositEarly: true });
  summarize('solver, bet 50%', { player: 'solver', betFrac: 0.5 });
  summarize('solver + Ledger, bet 30%', { player: 'solver', betFrac: 0.3, relics: ['ledger'] });
  summarize('solver + Logician, bet 30%', { player: 'solver', betFrac: 0.3, relics: ['logician'] });
  summarize('solver + Gut Feeling + Echo, 30%', { player: 'solver', betFrac: 0.3, relics: ['gut_feeling', 'echo'] });
  summarize('solver cautious (alpha 1.0), 30%', { player: 'solver', betFrac: 0.3, alpha: 1.0 });
  summarize('solver greedy (alpha 4.0), 30%', { player: 'solver', betFrac: 0.3, alpha: 4.0 });
} else if (mode === 'bycycle') {
  const bc = summarize('solver, bet 30%', { player: 'solver', betFrac: 0.3 }, 400);
  console.log('cycle | attempts | bust% | proven% | avg bet | avg earn/attempt | earn/bet');
  for (const [c, v] of Object.entries(bc)) {
    console.log(`${c.padStart(5)} | ${String(v.attempts).padStart(8)} | ${pct(v.busts / v.attempts).padStart(5)} | ${pct(v.proven / Math.max(1, v.clicks)).padStart(7)} | ${(v.bet / v.attempts).toFixed(0).padStart(7)} | ${(v.earn / v.attempts).toFixed(1).padStart(16)} | ${(v.earn / Math.max(1, v.bet)).toFixed(2).padStart(8)}`);
  }
} else if (mode === 'trace') {
  const trace = [];
  const r = playRun({ player: 'solver', betFrac: 0.3, seed: Number(process.argv[3] ?? 1001), maxCycles: 15, trace });
  console.log(`survived ${r.cycles} cycles`);
  for (const t of trace) console.log(`c${t.cycle} bet=$${t.bet} ${t.bust ? 'BUST' : `earn=$${t.earn.toFixed(0)} (${t.tiles} tiles, ${t.proven}p/${t.guess}g, mult ${t.mult})`} wallet=$${Math.round(t.walletAfter)} deadline=$${t.deadline}`);
}
if (mode === 'density') {
  const cascade = Number(process.argv[3] ?? 1);
  console.log(`=== Single attempts vs forced bomb count (perfect solver, cycle-3 economy, bet $16, Cascade Sense ${cascade}, 1000 each) ===`);
  console.log('bombs | bust% | proven% | avg clicks | avg safe revealed | avg winnings | winnings/bet');
  for (const bombs of [3, 4, 5, 6, 7, 8, 9, 10, 12]) {
    let busts = 0, proven = 0, guess = 0, clicks = 0, revealed = 0, earn = 0; const A = 1000;
    for (let i = 0; i < A; i++) {
      const rng = mulberry32(i * 31 + bombs);
      let s = GL.createInitialState();
      s = { ...s, seed: 5000 + i, skills: { cascade, bomb_flag: 0 }, cycle_number: 3, deadline: 190, phase: 'BET', current_bet: 16, wallet: 150, debug_bomb_override: bombs };
      s = GL.handlePlaceBet(s);
      for (let g = 0; g < 40; g++) {
        const ch = chooseClick(s, 'solver', rng, { alpha: 1.2, skill: 1 });
        if (ch.action === 'cashout') break;
        if (ch.kind === 'proven') proven++; else if (ch.kind === 'guess') guess++;
        if (ch.kind !== 'free') clicks++;
        s = GL.handleTileClick(s, ch.idx);
        if (s.phase !== 'CLEARING') break;
      }
      if (s.phase === 'BUST_FLASH') busts++;
      revealed += s.board.filter(t => t.state === 'revealed' || t.state === 'empty_revealed').length;
      if (s.phase !== 'BUST_FLASH') earn += s.attempt_earnings;
    }
    console.log(`${String(bombs).padStart(5)} | ${pct(busts / A).padStart(5)} | ${pct(proven / Math.max(1, proven + guess)).padStart(7)} | ${(clicks / A).toFixed(1).padStart(10)} | ${(revealed / A).toFixed(1).padStart(17)} | ${(earn / A).toFixed(1).padStart(12)} | ${(earn / A / 16).toFixed(2).padStart(12)}`);
  }
}
