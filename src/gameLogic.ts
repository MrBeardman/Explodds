import {
  SYMBOLS, ALL_CONSUMABLES, ALL_RELICS,
  STARTING_WALLET, MAX_SHOP_ITEMS, PLACEABLE_CONSUMABLES, EVENT_CARDS,
  BOSSES, BOSS_REWARD_TICKETS, calcDeadline, calcBombs, calcTileBaseCash,
  MIN_BET_BASE, MIN_BET_PER_CYCLE, GREED_MODE_MIN_BET,
  BASE_INTEREST_RATE, COMPOUND_CHIP_BONUS_RATE, INFLATOR_INTEREST_MULT,
  TICKETS_COMPLETE_ATTEMPT, TICKETS_SUCCESSFUL_CASHOUT, TICKETS_PROFITABLE, TICKETS_PAY_IN_FULL,
  BOMB_FLAG_BONUS,
  PACK_BASE_PRICE, PACK_PRICE_STEP, BOOST_FREQUENCY_MULT, BOOST_PAYOUT_MULT,
  THEMED_PACK_PRICE_MULT, PACK_SLOT_COUNT, PACK_KIND_WEIGHTS, PACK_CHOICE_COUNT,
  HUGE_PACK_CHOICE_COUNT, HUGE_PACK_CHANCE, HUGE_PACK_PRICE_MULT,
  PACK_PICK_COUNT, HUGE_PACK_PICK_COUNT,
  RELIC_CASE_BASE_PRICE, RELIC_CASE_PRICE_STEP, MAX_BONUS_RELIC_SLOTS,
  MAX_ACTIVE_RELICS, BET_STEP, CASCADE_LEVEL1_CAP, calcBoardCols,
  DEADLINE_WALLET_CHASE, COLLATERAL_DEPOSIT_FRAC, COLLATERAL_BOMB_RELIEF,
  PROFITABLE_EARNINGS_RATIO, TICKETS_FLAWLESS, FLAWLESS_MIN_PROVEN,
  DEDUCTION_MULT_GAIN, LOGICIAN_MULT_GAIN, ECHO_REVEALED_EMPTIES, CURFEW_CLICKS,
  MULT_GAIN_BASE, MULT_GAIN_PER_BOMB, STREAK_5_MULT, STREAK_10_MULT, STREAK_15_CASH,
  MAX_TRAITS, LOCKED_RELIC_IDS, STAKE_RETURN_CLEAR_FRAC, shopPriceScale, flatCashScale, attemptsForCycle,
  INSIGHT_SLOTS_BY_LEVEL,
} from './constants';
import { analyzeBoard, neighbors8, trueNumber, boardCols } from './deduction';
import type {
  GameState, Tile, TileType, TileState, SymbolId,
  EventCardId, BossId, ComboDisplay, BoostAxis, SymbolBoost,
  ShopConsumableItem, ShopRelicItem, ShopPackSlot, ShopRelicCaseItem,
  ResultLine, ResultsBreakdown,
} from './types';
import { mulberry32, weightedChoice, rngShuffle, newSeed } from './rng';
import { loadMeta, dailySeed } from './meta';

// ─── Bosses (every 3rd cycle) ─────────────────────────────────────────────────

export function isBossCycle(cycle: number): boolean {
  return cycle > 0 && cycle % 3 === 0;
}

// Deterministic per run: shuffled boss pool, indexed by boss ordinal (repeats
// after the pool is exhausted). Derivable anywhere — used for shop previews.
export function getBossForCycle(seed: number, cycle: number): BossId | null {
  if (!isBossCycle(cycle)) return null;
  const ordinal = cycle / 3;
  const pool = rngShuffle(mulberry32(seed + 555), BOSSES.map(b => b.id));
  return pool[(ordinal - 1) % pool.length];
}

// ─── Symbol weight table (event card + boss + boost modifiers) ────────────────

export function getSymbolWeights(state: GameState): Array<{ id: SymbolId; weight: number }> {
  // Monoculturist boss: only 2 symbol types spawn this cycle (seeded pair)
  if (state.active_boss === 'monoculturist') {
    const pair = rngShuffle(mulberry32(state.seed + state.cycle_number * 77), SYMBOLS.map(s => s.id)).slice(0, 2);
    return SYMBOLS.map(s => ({ id: s.id, weight: pair.includes(s.id) ? s.weight : 0 }));
  }

  // Blightbringer boss: nerfs one random symbol to 30% weight this cycle (seeded)
  let nerfed: SymbolId | null = null;
  if (state.active_boss === 'blightbringer') {
    nerfed = rngShuffle(mulberry32(state.seed + state.cycle_number * 91), SYMBOLS.map(s => s.id))[0];
  }

  return SYMBOLS.map(s => {
    let w = s.weight;
    if (state.active_events.includes('cherry_season')  && s.id === 'cherry')  w *= 2;
    if (state.active_events.includes('banana_bonanza') && s.id === 'banana')  w *= 2;
    if (state.active_events.includes('star_shower')    && s.id === 'star')    w *= 2;
    if (nerfed === s.id) w *= 0.3;
    const freqStacks = state.boosts.filter(b => b.symbol === s.id && b.axis === 'frequency').length;
    if (freqStacks > 0) w *= Math.pow(BOOST_FREQUENCY_MULT, freqStacks);
    return { id: s.id, weight: w };
  });
}

// ─── Board generation ─────────────────────────────────────────────────────────

export function generateBoard(state: GameState): Tile[] {
  // Derive a deterministic-ish seed per attempt
  const attemptKey = (3 - state.attempts_remaining) + 1;
  const rng = mulberry32(state.seed + state.cycle_number * 1000 + attemptKey * 100);

  const cols = state.board_cols;
  const size = cols * cols;
  const bombCount = Math.min(state.bombs_this_attempt, size - 2);
  const remaining = size - bombCount;

  // Compute empty count
  let emptyCount: number;
  const isLuckyBoard = state.active_events.includes('lucky_board') && !state.lucky_board_used;
  if (isLuckyBoard) {
    emptyCount = 0;
  } else {
    let base = Math.round(remaining * 0.25);
    if (state.active_boss === 'glutton')                    base += 4;
    if (state.active_events.includes('safe_zone'))          base = Math.max(0, base - 4);
    if (state.relics.includes('safe_digger'))          base = Math.max(0, base - 3);
    if (state.consumables_owned.includes('empty_eraser')) base = Math.max(0, base - 2);
    emptyCount = Math.min(base, remaining - 1); // always leave at least 1 symbol
  }
  const symbolCount = remaining - emptyCount;

  // Build & shuffle tile type assignments
  const types: TileType[] = [
    ...Array(bombCount).fill('bomb'),
    ...Array(symbolCount).fill('symbol'),
    ...Array(emptyCount).fill('empty'),
  ] as TileType[];
  const shuffled = rngShuffle(rng, Array.from({ length: size }, (_, i) => i));

  const tiles: Tile[] = Array.from({ length: size }, (_, i) => ({
    index: i,
    state: 'hidden' as TileState,
    type: 'empty' as TileType,
    symbol: null,
    consumable: null,
    combo_highlight: false,
    proven: false,
  }));

  // Assign types: shuffled[i] gets types[i]
  for (let i = 0; i < size; i++) {
    tiles[shuffled[i]].type = types[i];
  }

  // The Mason boss: bombs are laid in touching pairs — re-place them so every
  // bomb has an orthogonal bomb neighbour where possible (same count).
  if (state.active_boss === 'mason') {
    for (const t of tiles) if (t.type === 'bomb') t.type = 'symbol';
    let placed = 0;
    const order = rngShuffle(rng, tiles.map(t => t.index));
    for (const idx of order) {
      if (placed >= bombCount) break;
      if (tiles[idx].type === 'bomb') continue;
      const mates = neighbors8(idx, cols).filter(j =>
        (Math.floor(j / cols) === Math.floor(idx / cols) || j % cols === idx % cols) && tiles[j].type !== 'bomb',
      );
      if (placed + 1 < bombCount && mates.length > 0) {
        const mate = mates[Math.floor(rng() * mates.length)];
        tiles[idx].type = 'bomb'; tiles[mate].type = 'bomb'; placed += 2;
      } else {
        tiles[idx].type = 'bomb'; placed += 1;
      }
    }
    // Non-bomb tiles keep their symbol/empty split: re-deal types to the rest
    const rest = tiles.filter(t => t.type !== 'bomb');
    const restTypes = rngShuffle(rng, [...Array(Math.min(symbolCount, rest.length)).fill('symbol'), ...Array(Math.max(0, rest.length - symbolCount)).fill('empty')] as TileType[]);
    rest.forEach((t, i) => { t.type = restTypes[i]; });
  }

  // Assign symbols to symbol tiles
  const weights = getSymbolWeights(state);
  for (const tile of tiles) {
    if (tile.type === 'symbol') {
      tile.symbol = weightedChoice(rng, weights);
    }
  }

  // Lucky Charm relic: guarantee one diamond tile (replace a non-bomb non-diamond tile)
  if (state.relics.includes('lucky_charm')) {
    const candidates = tiles.filter(t => t.type !== 'bomb' && t.symbol !== 'diamond');
    if (candidates.length > 0) {
      const pick = candidates[Math.floor(rng() * candidates.length)];
      pick.type = 'symbol';
      pick.symbol = 'diamond';
    }
  }

  // Scatter Reveal: hint 3 safe (non-bomb) tiles
  if (state.consumables_owned.includes('scatter_reveal')) {
    const safeTiles = tiles.filter(t => t.type !== 'bomb');
    const picks = rngShuffle(rng, safeTiles).slice(0, 3);
    picks.forEach(t => { tiles[t.index].state = 'hinted'; });
  }

  // Surveyor relic: one empty tile starts fully revealed (free adjacency info)
  if (state.relics.includes('surveyor')) {
    const empties = tiles.filter(t => t.type === 'empty' && t.state === 'hidden');
    if (empties.length > 0) {
      const pick = empties[Math.floor(rng() * empties.length)];
      tiles[pick.index].state = 'empty_revealed';
    }
  }

  // Echo relic: after a bust, the next board starts with a couple of numbers
  // already on it — a deduction foothold instead of a cold restart.
  // Cartographer (legendary unlock): every board does. (A bomb-free 3×3 opening
  // was tried for it and made the perfect-deducer bot immortal.)
  if (state.relics.includes('cartographer') || (state.relics.includes('echo') && state.last_attempt_busted)) {
    const empties = tiles.filter(t => t.type === 'empty' && t.state === 'hidden');
    rngShuffle(rng, empties).slice(0, ECHO_REVEALED_EMPTIES).forEach(t => { tiles[t.index].state = 'empty_revealed'; });
  }

  // Bomb Detector consumable: flag 2 bombs with ⚠
  if (state.consumables_owned.includes('bomb_detector')) {
    const bombs = tiles.filter(t => t.type === 'bomb' && t.state === 'hidden');
    rngShuffle(rng, bombs).slice(0, 2).forEach(t => { tiles[t.index].state = 'flagged'; });
  }

  return tiles;
}

// ─── Adjacency (minesweeper numbers on empty tiles) ──────────────────────────

export function adjacentBombCount(board: Tile[], index: number): number {
  let n = 0;
  for (const j of neighbors8(index, boardCols(board))) if (board[j].type === 'bomb') n++;
  return n;
}

// ─── Min bet / bet-phase guard ────────────────────────────────────────────────

export function getMinBet(state: GameState): number {
  const base = MIN_BET_BASE + state.cycle_number * MIN_BET_PER_CYCLE;
  const min = state.active_events.includes('greed_mode') ? Math.max(base, GREED_MODE_MIN_BET) : base;
  // Below the table minimum you can still go all-in with what's left — a
  // player with $10 and a $12 minimum was stuck on PLACE BET with no legal move.
  return state.wallet > 0 && state.wallet < min ? state.wallet : min;
}

// ─── Bet options ──────────────────────────────────────────────────────────────
//
// The bet is a risk dial: bombs step up in bands of the wallet (calcBombs), so
// any bet inside a band carries the same risk as the band's top. Instead of a
// slider, offer exactly one bet per bomb count — the LARGEST bet that still
// deals that many bombs — plus all-in. (Playtest: "no sense betting $12–$35
// when $40 has the same 4 bombs".)
export interface BetOption { bet: number; bombs: number; allIn: boolean }
export function betOptions(state: GameState): BetOption[] {
  const minBet = getMinBet(state);
  const wallet = state.wallet;
  if (wallet <= 0) return [];
  const locked = getLockedBet(state);
  if (locked !== null) return [{ bet: locked, bombs: effectiveBombs(state, locked, wallet), allIn: locked >= wallet }];
  const bestPerBombs = new Map<number, number>();
  const step = wallet < minBet ? wallet : BET_STEP;
  for (let bet = Math.ceil(minBet / step) * step; bet <= wallet; bet += step) {
    const b = effectiveBombs(state, bet, wallet);
    if ((bestPerBombs.get(b) ?? -1) < bet) bestPerBombs.set(b, bet);
  }
  // all-in is always an option, even when it isn't a multiple of the step
  const allInBombs = effectiveBombs(state, wallet, wallet);
  if ((bestPerBombs.get(allInBombs) ?? -1) < wallet) bestPerBombs.set(allInBombs, wallet);
  return [...bestPerBombs.entries()]
    .map(([bombs, bet]) => ({ bet, bombs, allIn: bet >= wallet }))
    .sort((a, b) => a.bet - b.bet);
}

// Snap any requested bet onto the nearest option (used by SET_BET)
export function snapBet(state: GameState, requested: number): number {
  const opts = betOptions(state);
  if (opts.length === 0) return getMinBet(state);
  let best = opts[0];
  for (const o of opts) if (Math.abs(o.bet - requested) < Math.abs(best.bet - requested)) best = o;
  return best.bet;
}

// Keeps current_bet affordable whenever wallet shrinks outside of SET_BET (e.g.
// a deposit). Without this, a bet set before depositing can silently exceed the
// new wallet — handlePlaceBet then no-ops (newWallet < 0), which looks to the
// player like "PLACE BET is enabled but does nothing".
export function clampBetToWallet(bet: number, wallet: number, minBet: number): number {
  const capped = Math.min(bet, wallet);
  const flooredToStep = Math.floor(capped / BET_STEP) * BET_STEP;
  return Math.min(wallet, Math.max(minBet, flooredToStep));
}

// The only true dead-end is an empty wallet with the deadline still unmet —
// nothing left to bet OR deposit. A wallet below min-bet is still legal: the
// player can deposit whatever's left toward the deadline instead of betting.
export function toBetPhase(state: GameState): GameState {
  if (state.wallet <= 0 && state.deposited < state.deadline) return resolveCycleFailure(state);
  const next: GameState = { ...state, phase: 'BET' };
  // Keep the selected bet on a legal option for the new wallet
  return { ...next, current_bet: snapBet(next, next.current_bet) };
}

// ─── Combo helpers ────────────────────────────────────────────────────────────

function hasCherryRowCol(cherryIndices: number[], cols: number): boolean {
  const s = new Set(cherryIndices);
  for (let r = 0; r < cols; r++) {
    let n = 0;
    for (let c = 0; c < cols; c++) {
      n = s.has(r * cols + c) ? n + 1 : 0;
      if (n >= 3) return true;
    }
  }
  for (let c = 0; c < cols; c++) {
    let n = 0;
    for (let r = 0; r < cols; r++) {
      n = s.has(r * cols + c) ? n + 1 : 0;
      if (n >= 3) return true;
    }
  }
  return false;
}

function hasAdjacentBananas(bananaIndices: number[], cols: number): boolean {
  const s = new Set(bananaIndices);
  for (const idx of bananaIndices) {
    const c = idx % cols;
    if (c < cols - 1 && s.has(idx + 1)) return true;
    if (idx + cols < cols * cols && s.has(idx + cols)) return true;
  }
  return false;
}

// ─── Magnet: nearest safe hidden tile ────────────────────────────────────────

function magnetReveal(board: Tile[], lastIdx: number): number | null {
  const cols = boardCols(board);
  const candidates = board
    .filter(t => t.type !== 'bomb' && (t.state === 'hidden' || t.state === 'hinted'))
    .map(t => ({
      id: t.index,
      dist: Math.abs(Math.floor(t.index / cols) - Math.floor(lastIdx / cols))
          + Math.abs((t.index % cols) - (lastIdx % cols)),
    }))
    .sort((a, b) => a.dist - b.dist);
  return candidates[0]?.id ?? null;
}

// ─── Perfect clear bonus ──────────────────────────────────────────────────────
//
// Reward for revealing every non-bomb tile on a board before cashing out —
// tracked as a one-shot per attempt via combos_triggered, same mechanism as
// the symbol combos below.

const PERFECT_CLEAR_BONUS_PCT = 0.3; // +30% of attempt_earnings so far

function isBoardFullyCleared(board: Tile[]): boolean {
  return board.every(t => t.type === 'bomb' || t.state === 'revealed' || t.state === 'empty_revealed');
}

// ─── Flood-fill cascade (classic minesweeper "0-tile" reveal) ────────────────
//
// Clicking an empty tile with 0 adjacent bombs auto-reveals every connected
// safe tile — real deduction reward instead of clicking one tile at a time.
// Expansion only continues through further 0-adjacency empty tiles; anything
// else (a numbered empty, a symbol tile) gets revealed but doesn't propagate
// further, exactly like real minesweeper. Returns the full set of tile
// indices to reveal, including the origin.
//
// Gated behind the Cascade Sense meta-skill (see src/meta.ts): `maxTiles` caps
// how many tiles a single chain can reveal — level 1 passes CASCADE_LEVEL1_CAP,
// level 2 passes Infinity (today's unlimited behavior). Level 0 never calls
// this at all (handleTileClick reveals just the origin tile instead).

function floodFillReveal(state: GameState, board: Tile[], origin: number, maxTiles: number = Infinity): number[] {
  const visited = new Set<number>([origin]);
  const queue = [origin];
  const revealed: number[] = [];

  while (queue.length > 0 && revealed.length < maxTiles) {
    const idx = queue.shift()!;
    revealed.push(idx);
    const t = board[idx];

    // A shown 0 (over the number-neighborhood in force) expands
    if (t.type === 'empty' && trueNumber(state, board, idx) === 0) {
      for (const nIdx of neighbors8(idx, boardCols(board))) {
        const nt = board[nIdx];
        if (visited.has(nIdx) || nt.type === 'bomb') continue;
        if (nt.state === 'revealed' || nt.state === 'empty_revealed') continue;
        visited.add(nIdx);
        queue.push(nIdx);
      }
    }
  }

  return revealed;
}

// ─── Shared per-symbol-tile reveal step ──────────────────────────────────────
//
// Extracted so a flood-fill cascade can reveal several symbol tiles in one
// click and apply the exact same cash/mult/streak logic to each, in order,
// as if they'd been clicked one at a time.

interface RevealAccum {
  earnings: number;
  mult: number;
  streak: number;
  s5: boolean;
  s10: boolean;
  s15: boolean;
  tilesCleared: number;
  magnetClears: number;
  bombsThisAttempt: number;
  bananaEarnings: number[];
  numbered: number[];   // symbol tiles granted a bomb-count readout (Insight allowance)
}

function applySymbolTileReveal(state: GameState, board: Tile[], tileIndex: number, acc: RevealAccum): RevealAccum {
  const tile = board[tileIndex];
  const symbol = tile.symbol!;
  board[tileIndex].state = 'revealed';

  // Insight: the first N symbol reveals each attempt get their bomb count shown
  const insightSlots = INSIGHT_SLOTS_BY_LEVEL[Math.min(state.skills.insight ?? 0, INSIGHT_SLOTS_BY_LEVEL.length - 1)];
  const numbered = acc.numbered.length < insightSlots ? [...acc.numbered, tileIndex] : acc.numbered;

  const baseCash = calcTileBaseCash(state.current_bet, state.board_cols * state.board_cols);
  const symbolMod = getSymbolMod(symbol, state);
  let cash = baseCash * symbolMod * acc.mult;
  if (state.active_events.includes('danger_pay')) cash *= 1.4;
  if (state.relics.includes('loaded_dice')) cash *= 1.25;
  const flat = flatCashScale(state.current_bet);
  const luckyBonus = tile.consumable === 'lucky_tile' ? 5 * flat : 0;
  cash = parseFloat(cash.toFixed(2));

  const bananaEarnings = symbol === 'banana' ? [...acc.bananaEarnings, cash] : acc.bananaEarnings;

  const baseGain = MULT_GAIN_BASE + acc.bombsThisAttempt * MULT_GAIN_PER_BOMB;
  const multGain = state.relics.includes('adrenaline_core') ? baseGain * 1.2 : baseGain;
  let mult = parseFloat((acc.mult + multGain).toFixed(3));

  const streak = acc.streak + 1;
  let s5 = acc.s5, s10 = acc.s10, s15 = acc.s15;
  let streakBonus = 0;

  if (streak >= 5 && !s5) {
    if (state.relics.includes('hot_hands')) streakBonus += 8 * flat;
    else mult = parseFloat((mult + STREAK_5_MULT).toFixed(3));
    s5 = true;
  }
  if (streak >= 10 && !s10) {
    mult = parseFloat((mult + STREAK_10_MULT).toFixed(3));
    s10 = true;
  }
  if (streak >= 15 && !s15) {
    streakBonus += STREAK_15_CASH * flat;
    s15 = true;
  }

  const tilesCleared = acc.tilesCleared + 1;

  let magnetClears = acc.magnetClears + 1;
  if (state.consumables_owned.includes('tile_magnet') && magnetClears >= 5) {
    magnetClears = 0;
    const target = magnetReveal(board, tileIndex);
    if (target !== null) board[target].state = 'hinted';
  }

  let bombsThisAttempt = acc.bombsThisAttempt;
  if (state.active_boss === 'saboteur' && tilesCleared % 4 === 0) {
    const sabRng = mulberry32(state.seed + state.cycle_number * 31 + tilesCleared * 7);
    const candidates = board.filter(t => t.type !== 'bomb' && (t.state === 'hidden' || t.state === 'hinted'));
    if (candidates.length > 0) {
      const pick = candidates[Math.floor(sabRng() * candidates.length)];
      board[pick.index].type = 'bomb';
      board[pick.index].symbol = null;
      board[pick.index].state = 'hidden'; // hints are wiped — it's a bomb now
      bombsThisAttempt += 1;
    }
  }

  return {
    earnings: parseFloat((acc.earnings + cash + luckyBonus + streakBonus).toFixed(2)),
    mult,
    streak,
    s5, s10, s15,
    tilesCleared,
    magnetClears,
    bombsThisAttempt,
    bananaEarnings,
    numbered,
  };
}

// ─── Shared combo resolution ──────────────────────────────────────────────────
//
// Runs once per click (even if a flood-fill cascade revealed several symbol
// tiles) — combo checks scan the WHOLE board's revealed tiles, so checking
// once after all of this click's reveals is both correct and sufficient.

function resolveCombosAndFinalize(state: GameState, board: Tile[], acc: RevealAccum, ticketsIn: number): Partial<GameState> {
  let newEarnings = acc.earnings;
  const newTickets = ticketsIn;
  let newMult = acc.mult;
  let s5 = acc.s5, s10 = acc.s10, s15 = acc.s15;

  const triggered = [...state.combos_triggered];
  const display: ComboDisplay[] = [...state.active_combo_display];
  const flat = flatCashScale(state.current_bet);
  let comboId = state.combo_id_counter;
  let bellStormStreak: number | null = null;

  const synergistBoosts: SymbolBoost[] = [];
  const hasSynergist = state.relics.includes('synergist');

  // Cherry Rush
  if (!triggered.includes('cherry_rush')) {
    const cherryIdxs = board.filter(t => t.state === 'revealed' && t.symbol === 'cherry').map(t => t.index);
    if (hasCherryRowCol(cherryIdxs, boardCols(board))) {
      const reward = (state.relics.includes('cherry_picker') ? 20 : 12) * flat;
      newEarnings += reward;
      triggered.push('cherry_rush');
      display.push({ text: '🍒 CHERRY RUSH!', amount: `+$${reward}`, color: '#ff6b6b', id: comboId++ });
      if (hasSynergist) synergistBoosts.push({ symbol: 'cherry', axis: 'payout' });
    }
  }

  // Banana Split
  if (!triggered.includes('banana_split')) {
    const bananaIdxs = board.filter(t => t.state === 'revealed' && t.symbol === 'banana').map(t => t.index);
    if (hasAdjacentBananas(bananaIdxs, boardCols(board))) {
      const mult = state.relics.includes('banana_baron') ? 3 : 2;
      const bonusAmt = acc.bananaEarnings.reduce((s, e) => s + e * (mult - 1), 0);
      newEarnings += parseFloat(bonusAmt.toFixed(2));
      triggered.push('banana_split');
      display.push({ text: '🍌 BANANA SPLIT!', amount: `×${mult}`, color: '#ffd93d', id: comboId++ });
      for (const bi of bananaIdxs) board[bi].combo_highlight = true;
      if (hasSynergist) synergistBoosts.push({ symbol: 'banana', axis: 'payout' });
    }
  }

  // Star Power
  if (!triggered.includes('star_power')) {
    const starCount = board.filter(t => t.state === 'revealed' && t.symbol === 'star').length;
    if (starCount >= 3) {
      const reward = (state.relics.includes('star_magnet') ? 28 : 18) * flat;
      newEarnings += reward;
      triggered.push('star_power');
      display.push({ text: '⭐ STAR POWER!', amount: `+$${reward}`, color: '#ffe66d', id: comboId++ });
      if (hasSynergist) synergistBoosts.push({ symbol: 'star', axis: 'payout' });
    }
  }

  // Bell Storm
  if (!triggered.includes('bell_storm')) {
    const bellCount = board.filter(t => t.state === 'revealed' && t.symbol === 'bell').length;
    const threshold = state.active_events.includes('bell_ringer') ? 3 : 4;
    if (bellCount >= threshold) {
      const stormStreak = state.relics.includes('bell_captain') ? 20 : 10;
      bellStormStreak = stormStreak;
      triggered.push('bell_storm');
      display.push({ text: '🔔 BELL STORM!', amount: `STREAK ×${stormStreak}`, color: '#60a5fa', id: comboId++ });
      if (hasSynergist) synergistBoosts.push({ symbol: 'bell', axis: 'payout' });
    }
  }

  // Diamond Run
  if (!triggered.includes('diamond_run')) {
    const diaCount = board.filter(t => t.state === 'revealed' && t.symbol === 'diamond').length;
    if (diaCount >= 4) {
      const pct = state.relics.includes('diamond_dealer') ? 0.25 : 0.15;
      const bonus = parseFloat((newEarnings * pct).toFixed(2));
      newEarnings += bonus;
      triggered.push('diamond_run');
      display.push({ text: '💎 DIAMOND RUN!', amount: `+${Math.round(pct * 100)}%`, color: '#22d3ee', id: comboId++ });
      if (hasSynergist) synergistBoosts.push({ symbol: 'diamond', axis: 'payout' });
    }
  }

  // Perfect Clear — every non-bomb tile on the board revealed
  let runStats = state.run_stats;
  if (!triggered.includes('perfect_clear') && isBoardFullyCleared(board)) {
    const bonus = parseFloat((newEarnings * PERFECT_CLEAR_BONUS_PCT).toFixed(2));
    newEarnings += bonus;
    triggered.push('perfect_clear');
    runStats = { ...runStats, perfect_clear_best_cycle: Math.max(runStats.perfect_clear_best_cycle, state.cycle_number) };
    display.push({ text: '🏆 PERFECT CLEAR!', amount: `+${Math.round(PERFECT_CLEAR_BONUS_PCT * 100)}%`, color: '#4ade80', id: comboId++ });
  }

  // Bell Storm jumps the streak — grant the crossed milestones immediately and
  // mark them given, so the next click doesn't pay them out a second time.
  if (bellStormStreak !== null) {
    if (bellStormStreak >= 5 && !s5) {
      if (state.relics.includes('hot_hands')) newEarnings += 8 * flat;
      else newMult = parseFloat((newMult + STREAK_5_MULT).toFixed(3));
      s5 = true;
    }
    if (bellStormStreak >= 10 && !s10) {
      newMult = parseFloat((newMult + STREAK_10_MULT).toFixed(3));
      s10 = true;
    }
    if (bellStormStreak >= 15 && !s15) {
      newEarnings += STREAK_15_CASH * flat;
      s15 = true;
    }
  }

  const finalStreak = bellStormStreak !== null ? bellStormStreak : acc.streak;
  const newHighMult = Math.max(state.highest_multiplier, newMult);
  const newBestStreak = Math.max(state.best_streak, finalStreak);

  return {
    board,
    bombs_this_attempt: acc.bombsThisAttempt,
    attempt_earnings: parseFloat(newEarnings.toFixed(2)),
    multiplier: newMult,
    streak: finalStreak,
    streak_5_given: s5,
    streak_10_given: s10,
    streak_15_given: s15,
    banana_tile_earnings: acc.bananaEarnings,
    numbered_symbols: acc.numbered,
    tiles_cleared: acc.tilesCleared,
    magnet_clears: acc.magnetClears,
    tickets: newTickets,
    combos_triggered: triggered,
    active_combo_display: display,
    combo_id_counter: comboId,
    highest_multiplier: newHighMult,
    best_streak: newBestStreak,
    boosts: synergistBoosts.length > 0 ? [...state.boosts, ...synergistBoosts] : state.boosts,
    run_stats: runStats,
  };
}

// ─── Bomb relocation (openings, Bombproof Boots, Gut Feeling) ────────────────
//
// Swaps any bomb inside `protect` with a random still-hidden safe tile outside
// it, so the protected tiles are safe WITHOUT changing the bomb count — the
// 💣 counter and every number stay honest. Falls back to plain conversion
// (bomb → empty, count −1) only if no swap target exists.

function relocateBombs(state: GameState, board: Tile[], protect: number[]): number {
  const attemptKey = (3 - state.attempts_remaining) + 1;
  const rng = mulberry32(state.seed + state.cycle_number * 1000 + attemptKey * 100 + 7 + protect[0]);
  const protectSet = new Set(protect);
  let removed = 0;
  for (const idx of protect) {
    if (board[idx].type !== 'bomb') continue;
    const candidates = board.filter(t =>
      !protectSet.has(t.index) && t.type !== 'bomb' && t.state === 'hidden' && t.consumable === null,
    );
    if (candidates.length === 0) {
      board[idx].type = 'empty';
      board[idx].symbol = null;
      removed++;
      continue;
    }
    const target = candidates[Math.floor(rng() * candidates.length)];
    const { type, symbol } = board[target.index];
    board[target.index].type = 'bomb';
    board[target.index].symbol = null;
    board[idx].type = type;
    board[idx].symbol = symbol;
  }
  return removed;
}

// Which tiles the opening click guarantees bomb-free, by Cascade Sense level:
// 0 → just the clicked tile; 1 and 2 → a plus (clicked + 4 orthogonal
// neighbours). Deliberately NOT a full 3×3: on a 5×5 that's 36% of the board
// handed over for free, and the bot playtest showed a perfect deducer then
// proves nearly everything regardless of bomb count — the skill layer needs
// tiles that must be reasoned for. Level 2 instead removes the cascade cap.
export function openingTiles(index: number, cascadeLevel: number, cols: number): number[] {
  if (cascadeLevel <= 0) return [index];
  const row = Math.floor(index / cols), col = index % cols;
  return [index, ...neighbors8(index, cols).filter(j => Math.floor(j / cols) === row || j % cols === col)];
}

// ─── Probe consumable ─────────────────────────────────────────────────────────

function applyProbe(state: GameState, tileIndex: number): GameState {
  const tile = state.board[tileIndex];
  if (!tile || (tile.state !== 'hidden' && tile.state !== 'hinted' && tile.state !== 'flagged')) return state;
  const newBoard = state.board.map(t => t.index === tileIndex
    ? { ...t, state: (t.type === 'bomb' ? 'flagged' : 'hinted') as TileState }
    : t);
  return {
    ...state,
    board: newBoard,
    pending_probe: false,
    consumables_owned: removeOne(state.consumables_owned, 'probe'),
  };
}

// ─── Tile click handler ───────────────────────────────────────────────────────
//
// Every deliberate click is tagged PROVEN (the visible numbers made this tile
// certainly safe — see src/deduction.ts) or a GUESS. Proven clicks build the
// deduction streak and add to the multiplier; a guess resets both streaks.
// The opening click (and Bombproof Boots' second) is "free": neither.

export function handleTileClick(state: GameState, tileIndex: number): GameState {
  if (state.phase !== 'CLEARING') return state;

  // Bomb Sense flag mode — clicking a tile marks/unmarks a guess instead of revealing it
  if (state.flag_mode) return toggleFlag(state, tileIndex);

  const clicked = state.board[tileIndex];
  if (!clicked || clicked.state === 'revealed' || clicked.state === 'bomb_hit' || clicked.state === 'empty_revealed') return state;

  if (state.pending_scanner_axis !== null) return applyScanner(state, tileIndex);
  if (state.pending_probe) return applyProbe(state, tileIndex);

  const newBoard = state.board.map(t => ({ ...t }));
  let bombsThisAttempt = state.bombs_this_attempt;

  // ── Opening ───────────────────────────────────────────────────────────────
  // The first click of every attempt can never be a bomb (Bombproof Boots: the
  // first two). Cascade Sense widens the opening: level 1 clears the whole 3×3
  // around the first click so it always shows a 0 (eight provable tiles);
  // level 2 also auto-opens the region from there.
  const guaranteedSafeClicks = state.relics.includes('bombproof_boots') ? 2 : 1;
  const isOpening = state.clicks_this_attempt === 0;
  const free = state.clicks_this_attempt < guaranteedSafeClicks;
  if (free) {
    const protect = isOpening ? openingTiles(tileIndex, state.skills.cascade, boardCols(newBoard)) : [tileIndex];
    bombsThisAttempt -= relocateBombs(state, newBoard, protect);
  }

  // ── Proven vs. guess ──────────────────────────────────────────────────────
  let proven = false;
  const gutUsed = state.gut_feeling_used;
  if (!free) {
    proven = analyzeBoard(state, state.board).safe.has(tileIndex);
    // Gut Feeling relic: once per cycle, a guess that would bust is spared —
    // the bomb is marked ⚠ and the attempt ends as a cashout for HALF the
    // winnings (stake kept, remaining clicks forfeited). Deliberately NOT a free
    // relocation: that made every cycle's first guess risk-free and the bot
    // playtest showed the relic alone carrying runs past 25 cycles.
    if (!proven && newBoard[tileIndex].type === 'bomb' && state.relics.includes('gut_feeling') && !gutUsed) {
      newBoard[tileIndex].state = 'flagged';
      const halved = parseFloat((state.attempt_earnings * 0.5).toFixed(2));
      return handleCashout({ ...state, board: newBoard, attempt_earnings: halved, gut_feeling_used: true, guess_clicks: state.guess_clicks + 1, deduction_streak: 0 });
    }
  }
  const guess = !free && !proven;
  const tile = newBoard[tileIndex];

  // ── Bomb ──────────────────────────────────────────────────────────────────

  if (tile.type === 'bomb') {
    // Defuser: neutralise bomb
    if (tile.consumable === 'defuser') {
      newBoard[tileIndex].state = 'empty_revealed';
      newBoard[tileIndex].type = 'empty';
      return {
        ...state,
        board: newBoard,
        bombs_this_attempt: bombsThisAttempt - 1,
        clicks_this_attempt: state.clicks_this_attempt + 1,
        guess_clicks: state.guess_clicks + (guess ? 1 : 0),
        deduction_streak: guess ? 0 : state.deduction_streak,
        gut_feeling_used: gutUsed,
      };
    }

    // Bust refunds — best single protection applies:
    // Bomb Suit (free, once per cycle) > Insurance Ticket (consumed, full bet) > Insurance Policy (30%)
    let newWallet = state.wallet;
    let newBombSuitUsed = state.bomb_suit_used;
    let newConsumables = removeOne(state.consumables_owned, 'tile_magnet');
    if (state.relics.includes('bomb_suit') && !state.bomb_suit_used) {
      newWallet += state.current_bet;
      newBombSuitUsed = true;
    } else if (newConsumables.includes('insurance_ticket')) {
      newWallet += state.current_bet;
      newConsumables = removeOne(newConsumables, 'insurance_ticket');
    } else if (state.relics.includes('insurance_policy')) {
      newWallet = parseFloat((newWallet + state.current_bet * 0.3).toFixed(2));
    }

    // Momentum Core: carry 50% of mult progress into the next attempt this cycle
    const carry = state.relics.includes('momentum_core')
      ? parseFloat((1 + (state.multiplier - 1) * 0.5).toFixed(3))
      : 1.0;

    newBoard[tileIndex].state = 'bomb_hit';
    const newAttempts = state.attempts_remaining - 1;

    // Bomb Sense: correctly-flagged bombs pay out even on a bust — the skill
    // rewards the deduction itself, not just surviving the attempt.
    const flagResult = calcFlagBonus(state);
    newWallet = parseFloat((newWallet + flagResult.bonus).toFixed(2));

    // Vault relic: deposited cash still earns half its interest on a bust
    if (state.relics.includes('vault')) {
      newWallet = parseFloat((newWallet + state.deposited * interestRate(state) * 0.5).toFixed(2));
    }

    return {
      ...state,
      board: newBoard,
      bombs_this_attempt: bombsThisAttempt,
      phase: 'BUST_FLASH',
      wallet: newWallet,
      tickets: state.tickets + TICKETS_COMPLETE_ATTEMPT,
      attempts_remaining: newAttempts,
      bomb_suit_used: newBombSuitUsed,
      consumables_owned: newConsumables,
      carry_multiplier: carry,
      attempt_earnings: 0,
      multiplier: 1.0,
      streak: 0,
      streak_5_given: false,
      streak_10_given: false,
      streak_15_given: false,
      banana_tile_earnings: [],
      tiles_cleared: 0,
      magnet_clears: 0,
      combos_triggered: [],
      active_combo_display: [],
      player_flags: [],
      flag_mode: false,
      deduction_streak: 0,
      last_reveal_index: -1,
    numbered_symbols: [],
      proven_clicks: 0,
      guess_clicks: 0,
      last_attempt_busted: true,
      pending_probe: false,
    };
  }

  // ── Safe tile ─────────────────────────────────────────────────────────────
  // A 0-adjacency empty tile cascades open every connected safe tile (classic
  // minesweeper flood fill, capped at level 1, unlimited at level 2 of Cascade
  // Sense, none at level 0). The whole cascade is one atomic player action.

  let revealSet: number[];
  if (tile.type === 'empty') {
    const level = state.skills.cascade;
    revealSet = level === 0
      ? [tileIndex]
      : floodFillReveal(state, newBoard, tileIndex, level === 1 ? CASCADE_LEVEL1_CAP : Infinity);
  } else {
    revealSet = [tileIndex];
  }

  const symbolIdxs: number[] = [];
  for (const idx of revealSet) {
    if (newBoard[idx].type === 'empty') newBoard[idx].state = 'empty_revealed';
    else if (newBoard[idx].type === 'symbol') symbolIdxs.push(idx);
  }

  // Streak: a GUESS resets the symbol streak (and its milestone flags). An
  // empty tile no longer does — the tiles carrying the numbers are the
  // information layer, not a punishment.
  let acc: RevealAccum = {
    earnings: state.attempt_earnings,
    mult: state.multiplier,
    streak: guess ? 0 : state.streak,
    s5: guess ? false : state.streak_5_given,
    s10: guess ? false : state.streak_10_given,
    s15: guess ? false : state.streak_15_given,
    tilesCleared: state.tiles_cleared,
    magnetClears: state.magnet_clears,
    bombsThisAttempt,
    bananaEarnings: state.banana_tile_earnings,
    numbered: state.numbered_symbols,
  };

  // Proven click: the deduction gain lands on the multiplier first, so this
  // click's own tiles already pay at the higher rate.
  if (proven) {
    const gain = state.relics.includes('logician') ? LOGICIAN_MULT_GAIN : DEDUCTION_MULT_GAIN;
    acc = { ...acc, mult: parseFloat((acc.mult + gain).toFixed(3)) };
  }

  for (const idx of symbolIdxs) {
    // Saboteur can arm a bomb on a tile still queued in this cascade — never pay it out
    if (newBoard[idx].type !== 'symbol' || newBoard[idx].symbol === null) continue;
    acc = applySymbolTileReveal(state, newBoard, idx, acc);
  }
  if (proven) newBoard[tileIndex].proven = true;

  const finalized = resolveCombosAndFinalize(state, newBoard, acc, state.tickets);

  const next: GameState = {
    ...state,
    ...finalized,
    clicks_this_attempt: state.clicks_this_attempt + 1,
    last_reveal_index: tileIndex,
    deduction_streak: proven ? state.deduction_streak + 1 : (free ? state.deduction_streak : 0),
    proven_clicks: state.proven_clicks + (proven ? 1 : 0),
    guess_clicks: state.guess_clicks + (guess ? 1 : 0),
    gut_feeling_used: gutUsed,
  } as GameState;

  // Curfew boss: the attempt ends on its own after N reveals
  if (state.active_boss === 'curfew' && next.clicks_this_attempt >= CURFEW_CLICKS && next.phase === 'CLEARING') {
    return handleCashout(next);
  }

  return next;
}

export function getSymbolMod(symbol: SymbolId, state: GameState): number {
  const mods: Record<SymbolId, number> = {
    diamond: 1.0,
    cherry: 0.8,
    banana: 1.2,
    star: state.active_events.includes('star_shower') ? 1.5 * 1.5 : 1.5,
    bell: 0.9,
  };
  let mod = mods[symbol];
  const payoutStacks = state.boosts.filter(b => b.symbol === symbol && b.axis === 'payout').length;
  if (payoutStacks > 0) mod *= Math.pow(BOOST_PAYOUT_MULT, payoutStacks);
  return mod;
}

// ─── Live paytable ────────────────────────────────────────────────────────────
//
// General odds/payout — relative weight share among symbol tiles and cash value
// at the current bet/mult. NOT counted from this specific board's remaining
// tiles (that read as noisy/board-specific); this is the same statistical view
// whether you're still betting or mid-attempt. Each row also carries the
// unmodified "base" value so the UI can flag when an event/boss/boost is
// actually changing a symbol's numbers.

export interface SymbolOddsRow {
  id: SymbolId;
  pct: number;
  payout: number;
  basePct: number;
  basePayout: number;
  weight: number;
  baseWeight: number;
  oddsModified: boolean;
  payoutModified: boolean;
}

export function getSymbolOdds(state: GameState): SymbolOddsRow[] {
  const bet = state.current_bet;
  // Deliberately NOT state.multiplier — this is an "upgrade level" readout
  // (what a boost/relic/event is doing to a symbol's base payout), not a
  // live mid-attempt earnings estimate. Using the current mult would make
  // every row visibly climb as the player clears tiles, which reads as the
  // paytable itself being unstable rather than showing permanent build state.
  const mult = 1.0;

  const weights = getSymbolWeights(state);
  const totalW = weights.reduce((sum, w) => sum + w.weight, 0);
  const baseTotalW = SYMBOLS.reduce((sum, s) => sum + s.weight, 0);

  return SYMBOLS.map(s => {
    const w = weights.find(x => x.id === s.id)?.weight ?? 0;
    const pct = totalW > 0 ? w / totalW : 0;
    const basePct = baseTotalW > 0 ? s.weight / baseTotalW : 0;

    const payout = calcTileBaseCash(bet, state.board_cols * state.board_cols) * getSymbolMod(s.id, state) * mult;
    const basePayout = calcTileBaseCash(bet, state.board_cols * state.board_cols) * s.modifier * mult;

    return {
      id: s.id,
      pct,
      payout,
      basePct,
      basePayout,
      weight: w,
      baseWeight: s.weight,
      // Flag only symbols DIRECTLY modified (own weight/modifier changed) — a
      // boosted symbol's bigger share shrinks everyone else's normalized pct
      // too, but that indirect shift isn't "a modifier altering this symbol".
      oddsModified: Math.abs(w - s.weight) > 0.001,
      payoutModified: Math.abs(payout - basePayout) > 0.005,
    };
  }).sort((a, b) => b.payout - a.payout);
}

// ─── Bomb Sense (flag-a-suspected-bomb meta-skill) ────────────────────────────

// How many tiles the player can flag this attempt — the skill level (0-5)
// capped by however many bombs are actually on the current board, since
// flagging more than that can ever exist would be meaningless.
export function maxPlayerFlags(state: GameState): number {
  return Math.min(state.skills.bomb_flag ?? 0, state.bombs_this_attempt);
}

// Toggles a flag on a still-hidden tile (does not reveal it). Unflagging is
// always allowed; flagging a new tile is blocked once maxPlayerFlags is hit.
export function toggleFlag(state: GameState, tileIndex: number): GameState {
  const tile = state.board[tileIndex];
  if (!tile || tile.state === 'revealed' || tile.state === 'bomb_hit' || tile.state === 'empty_revealed') return state;

  if (state.player_flags.includes(tileIndex)) {
    return { ...state, player_flags: state.player_flags.filter(i => i !== tileIndex) };
  }
  if (state.player_flags.length >= maxPlayerFlags(state)) return state;
  return { ...state, player_flags: [...state.player_flags, tileIndex] };
}

// Correct flags (tile actually a bomb) pay a flat bonus, checked when the
// attempt ends — cashout AND bust, since the skill rewards the deduction
// itself rather than just surviving.
export function calcFlagBonus(state: GameState): { correct: number; bonus: number } {
  const correct = state.player_flags.filter(i => state.board[i]?.type === 'bomb').length;
  return { correct, bonus: parseFloat((correct * BOMB_FLAG_BONUS * flatCashScale(state.current_bet)).toFixed(2)) };
}

// ─── Scanner ──────────────────────────────────────────────────────────────────

function applyScanner(state: GameState, tileIndex: number): GameState {
  const axis = state.pending_scanner_axis!;
  const cols = boardCols(state.board);
  const row = Math.floor(tileIndex / cols);
  const col = tileIndex % cols;

  const newBoard = state.board.map((t) => {
    const tRow = Math.floor(t.index / cols);
    const tCol = t.index % cols;
    const match = axis === 'row' ? tRow === row : tCol === col;
    if (!match || t.state === 'revealed' || t.state === 'bomb_hit' || t.state === 'empty_revealed') return t;
    if (t.type === 'bomb') return { ...t, state: 'revealed' as TileState };
    if (t.type === 'empty') return { ...t, state: 'empty_revealed' as TileState };
    return { ...t, state: 'hinted' as TileState };
  });

  return {
    ...state,
    board: newBoard,
    pending_scanner_axis: null,
    consumables_owned: removeOne(state.consumables_owned, 'scanner'),
  };
}

// ─── Deposit / interest ───────────────────────────────────────────────────────

// Interest is earned on the DEPOSITED pool (money already committed toward the
// deadline), paid out on every successful cashout — never on a bust. Depositing
// early means more of these ticks over the rest of the cycle's attempts.
export function interestRate(state: GameState): number {
  let rate = BASE_INTEREST_RATE;
  if (state.relics.includes('compound_chip')) rate += COMPOUND_CHIP_BONUS_RATE;
  if (state.active_boss === 'inflator') rate *= INFLATOR_INTEREST_MULT;
  return rate;
}

// Move cash from wallet into the deposited pool (toward the deadline). Only
// legal between attempts. Deposited cash can never be bet again, but it earns
// interest on every future cashout this cycle. Covering the deadline does NOT
// end the cycle any more — the remaining attempts stay playable (and keep
// paying interest on the full deposit); the player ends it with FINISH_CYCLE
// or it ends when attempts run out. (It used to end at once, which forced
// "deposit just under the deadline" click-dancing to keep playing.)
export function handleDeposit(state: GameState, amount: number): GameState {
  if (state.phase !== 'BET') return state;
  const cap = Math.max(0, state.deadline - state.deposited);
  const amt = Math.min(Math.max(0, amount), state.wallet, cap);
  if (amt <= 0) return state;

  const wallet = parseFloat((state.wallet - amt).toFixed(2));
  const deposited = parseFloat((state.deposited + amt).toFixed(2));
  const next: GameState = { ...state, wallet, deposited };
  next.current_bet = snapBet(next, next.current_bet);

  if (wallet <= 0 && deposited < state.deadline) return resolveCycleFailure(next);
  return next;
}

// Deadline covered → the player chooses to move on (forfeiting any attempts left)
export function finishCycle(state: GameState): GameState {
  if (state.phase !== 'BET' || state.deposited < state.deadline) return state;
  return resolveCycleSuccess(state);
}

export function isDeadlineCovered(state: GameState): boolean {
  return state.deposited >= state.deadline;
}

// ─── Stake return ─────────────────────────────────────────────────────────────
//
// The stake comes back pro rata to how much of the board's safe tiles you
// revealed, reaching 100% at STAKE_RETURN_CLEAR_FRAC. Shown live on the CASHOUT
// button so the trade-off is always visible.
export function stakeReturnInfo(state: GameState): { fraction: number; revealed: number; required: number } {
  const safeTotal = state.board.filter(t => t.type !== 'bomb').length;
  const revealed = state.board.filter(t => t.state === 'revealed' || t.state === 'empty_revealed').length;
  const required = Math.max(1, Math.ceil(safeTotal * STAKE_RETURN_CLEAR_FRAC));
  return { fraction: Math.min(1, revealed / required), revealed, required };
}

// ─── Cashout ──────────────────────────────────────────────────────────────────

export function handleCashout(state: GameState): GameState {
  let earnings = state.attempt_earnings;

  // Greed Mode: +30% on cashout
  if (state.active_events.includes('greed_mode')) {
    earnings = parseFloat((earnings * 1.3).toFixed(2));
  }

  // Taxman boss: 25% tax on every cashout (interest below is untaxed)
  if (state.active_boss === 'taxman') {
    earnings = parseFloat((earnings * 0.75).toFixed(2));
  }

  // Chain Reaction relic: 2+ distinct combos this attempt → ×1.5 on cashout
  if (state.relics.includes('chain_reaction') && state.combos_triggered.length >= 2) {
    earnings = parseFloat((earnings * 1.5).toFixed(2));
  }

  // Double Down relic: a bet of at least half the pre-bet wallet pays ×1.3
  if (state.relics.includes('double_down') && state.current_bet >= (state.wallet + state.current_bet) * 0.5) {
    earnings = parseFloat((earnings * 1.3).toFixed(2));
  }

  // Greed Chip relic: +$3 flat
  if (state.relics.includes('greed_chip')) earnings += 3 * flatCashScale(state.current_bet);

  // The stake comes back on every cashout — only a bust loses it. "Round
  // winnings" is the fully-modified total (all cashout modifiers already
  // folded in above) rather than itemizing each one separately.
  const stakeInfo = stakeReturnInfo(state);
  const stake = parseFloat((state.current_bet * stakeInfo.fraction).toFixed(2));
  const cashLines: ResultLine[] = [
    { label: stakeInfo.fraction >= 1 ? 'Stake returned' : `Stake returned (${Math.round(stakeInfo.fraction * 100)}% — early cashout)`, amount: stake },
    { label: 'Round winnings', amount: parseFloat(earnings.toFixed(2)) },
  ];

  // Interest tick on the already-deposited pool
  const interestEarned = parseFloat((state.deposited * interestRate(state)).toFixed(2));
  if (interestEarned > 0) cashLines.push({ label: 'Interest', amount: interestEarned });

  // Bomb Sense: correctly-flagged bombs pay a flat bonus each
  const flagResult = calcFlagBonus(state);
  if (flagResult.correct > 0) {
    cashLines.push({ label: `🚩 Bomb flags (${flagResult.correct} correct)`, amount: flagResult.bonus });
  }

  const newWallet = parseFloat((state.wallet + stake + earnings + interestEarned + flagResult.bonus).toFixed(2));
  const newTotalEarned = parseFloat((state.total_earned + earnings + interestEarned + flagResult.bonus).toFixed(2));
  const newInterestEarned = parseFloat((state.interest_earned_this_cycle + interestEarned).toFixed(2));

  // Ticket awards: complete + successful cashout + profitable clear + relic bonus
  const ticketLines: ResultLine[] = [
    { label: 'Attempt complete', amount: TICKETS_COMPLETE_ATTEMPT },
    { label: 'Successful cashout', amount: TICKETS_SUCCESSFUL_CASHOUT },
  ];
  if (earnings >= state.current_bet * PROFITABLE_EARNINGS_RATIO) ticketLines.push({ label: 'Profitable clear', amount: TICKETS_PROFITABLE });
  let runStats = state.run_stats;
  if (state.guess_clicks === 0 && state.proven_clicks >= FLAWLESS_MIN_PROVEN) {
    ticketLines.push({ label: `🧠 Flawless (${state.proven_clicks} proven, 0 guesses)`, amount: TICKETS_FLAWLESS });
    runStats = { ...runStats, best_flawless_proven: Math.max(runStats.best_flawless_proven, state.proven_clicks) };
  }
  if (state.relics.includes('ticket_printer')) ticketLines.push({ label: 'Ticket Printer', amount: 2 });
  const ticketBonus = ticketLines.reduce((s, l) => s + l.amount, 0);
  const newTickets = state.tickets + ticketBonus;

  // Momentum Core: carry 50% of mult progress into the next attempt this cycle
  const carry = state.relics.includes('momentum_core')
    ? parseFloat((1 + (state.multiplier - 1) * 0.5).toFixed(3))
    : 1.0;

  const newAttempts = state.attempts_remaining - 1;

  const baseState: Partial<GameState> = {
    wallet: newWallet,
    tickets: newTickets,
    run_stats: runStats,
    total_earned: newTotalEarned,
    interest_earned_this_cycle: newInterestEarned,
    attempts_remaining: newAttempts,
    consumables_owned: removeOne(state.consumables_owned, 'tile_magnet'),
    carry_multiplier: carry,
    attempt_earnings: 0,
    multiplier: 1.0,
    streak: 0,
    streak_5_given: false,
    streak_10_given: false,
    streak_15_given: false,
    banana_tile_earnings: [],
    tiles_cleared: 0,
    magnet_clears: 0,
    combos_triggered: [],
    active_combo_display: [],
    player_flags: [],
    flag_mode: false,
    deduction_streak: 0,
    last_reveal_index: -1,
    numbered_symbols: [],
    proven_clicks: 0,
    guess_clicks: 0,
    last_attempt_busted: false,
    pending_probe: false,
    consumables_placed: [],
    pending_scanner_axis: null,
    // board is deliberately KEPT — the RESULTS phase shows it fully revealed;
    // dismissResults clears it
  };

  const next = { ...state, ...baseState } as GameState;
  const resolved = newAttempts > 0 ? toBetPhase(next) : settleFinalAttempt(next);

  // If the cycle just completed inside settleFinalAttempt, itemize the extra
  // ticket awards it grants (known constants — resolveCycleSuccess is the only
  // thing between `next` and `resolved` that can still touch tickets here).
  if (resolved.phase === 'SHOP') {
    ticketLines.push({ label: 'Deadline paid in full', amount: TICKETS_PAY_IN_FULL });
    if (state.active_boss !== null) ticketLines.push({ label: 'Boss defeated', amount: BOSS_REWARD_TICKETS });
  }

  // If settleFinalAttempt auto-swept leftover wallet into the deadline, show it
  // — otherwise the wallet number visibly lands lower than what was just counted up.
  if (newAttempts === 0) {
    const swept = parseFloat((next.wallet - resolved.wallet).toFixed(2));
    if (swept > 0.001) cashLines.push({ label: 'Swept to deadline', amount: -swept });
  }

  const pending_results: ResultsBreakdown = {
    cashLines,
    ticketLines,
    cashTotal: parseFloat(cashLines.reduce((s, l) => s + l.amount, 0).toFixed(2)),
    ticketTotal: ticketLines.reduce((s, l) => s + l.amount, 0),
    walletBefore: state.wallet,
    walletAfter: resolved.wallet,
    ticketsBefore: state.tickets,
    ticketsAfter: resolved.tickets,
  };

  return { ...resolved, phase: 'RESULTS', pending_results, pending_next_phase: resolved.phase };
}

// Applies the phase transition that handleCashout already computed and deferred.
export function dismissResults(state: GameState): GameState {
  if (state.phase !== 'RESULTS' || state.pending_next_phase === null) return state;
  // A cashout-based game over keeps the board so GameOver can show the final reveal
  const board = state.pending_next_phase === 'GAME_OVER' ? state.board : [];
  return { ...state, phase: state.pending_next_phase, board, pending_results: null, pending_next_phase: null };
}

// ─── Cycle resolution ─────────────────────────────────────────────────────────

// Called whenever attempts_remaining has just hit 0 (cashout or bust). Auto-sweeps
// any remaining wallet cash toward the deadline first — a player who simply
// forgot to deposit on the last attempt isn't punished for it — then resolves.
export function settleFinalAttempt(state: GameState): GameState {
  const cap = Math.max(0, state.deadline - state.deposited);
  const sweep = Math.min(state.wallet, cap);
  const wallet = parseFloat((state.wallet - sweep).toFixed(2));
  const deposited = parseFloat((state.deposited + sweep).toFixed(2));
  const next = { ...state, wallet, deposited };
  return deposited >= state.deadline ? resolveCycleSuccess(next) : resolveCycleFailure(next);
}

export function resolveCycleSuccess(state: GameState): GameState {
  const bossTickets = state.active_boss !== null ? BOSS_REWARD_TICKETS : 0;
  const shop = generateShop(state);

  return {
    ...state,
    tickets: state.tickets + TICKETS_PAY_IN_FULL + bossTickets,
    phase: 'SHOP',
    cycles_survived: state.cycles_survived + 1,
    run_stats: state.active_boss !== null ? { ...state.run_stats, bosses_beaten: state.run_stats.bosses_beaten + 1 } : state.run_stats,
    shop_consumables: shop.consumables,
    shop_relics: shop.relics,
    shop_packs: generatePackSlots(state),
    shop_relic_case: generateRelicCaseSlot(state),
    shop_consumables_rerolled: false,
    shop_relics_rerolled: false,
    shop_packs_rerolled: false,
  };
}

export function resolveCycleFailure(state: GameState): GameState {
  return { ...state, phase: 'GAME_OVER' };
}

// ─── Start attempt (from BET phase → generate board) ─────────────────────────

// Bombs for a given bet including relic effects — used by gameplay AND the bet-slider preview
export function effectiveBombs(state: GameState, bet: number, wallet: number): number {
  let bombs = calcBombs(bet, wallet, state.cycle_number);
  if (state.active_events.includes('danger_pay')) bombs = Math.min(bombs + 3, 24);
  if (state.relics.includes('loaded_dice')) bombs += 1;
  // High Roller relic: big bets get 2 fewer bombs
  if (state.relics.includes('high_roller') && bet >= wallet * 0.5) {
    bombs = Math.max(1, bombs - 2);
  }
  // Collateral: half the deadline already deposited → the house relaxes a little
  if (state.deposited >= state.deadline * COLLATERAL_DEPOSIT_FRAC) {
    bombs = Math.max(1, bombs - COLLATERAL_BOMB_RELIEF);
  }
  return bombs;
}

// Cash prices scale with the deadline (shopPriceScale); Haggler relic: consumables cost 30% less
export function getConsumablePrice(state: GameState, basePrice: number): number {
  const scaled = basePrice * shopPriceScale(state.deadline);
  return Math.round(state.relics.includes('haggler') ? scaled * 0.7 : scaled);
}

// Warden boss: bet is locked to 25% of wallet (respecting min bet / bet step)
export function getLockedBet(state: GameState): number | null {
  if (state.active_boss !== 'warden') return null;
  const target = Math.round((state.wallet * 0.25) / 5) * 5;
  return Math.max(getMinBet(state), Math.min(target, state.wallet));
}

export function handlePlaceBet(state: GameState): GameState {
  const bet = getLockedBet(state) ?? state.current_bet;
  const newWallet = parseFloat((state.wallet - bet).toFixed(2));

  if (newWallet < 0) return state; // can't afford this bet — ignore the click

  const totalBombs = state.debug_bomb_override !== null
    ? Math.min(24, Math.max(0, state.debug_bomb_override))
    : effectiveBombs(state, bet, state.wallet);

  // Hot Streak: start with streak 5
  const initialStreak = state.active_events.includes('hot_streak') ? 5 : 0;
  const initialS5 = state.active_events.includes('hot_streak');

  // Starting multiplier: Head Start relic base, + Momentum Core carry, + Mult Vial
  let startMult = state.relics.includes('head_start') ? 1.3 : 1.0;
  startMult += state.carry_multiplier - 1;
  if (state.consumables_owned.includes('mult_vial')) startMult += 0.5;
  startMult = parseFloat(startMult.toFixed(3));

  const nextState: GameState = {
    ...state,
    wallet: newWallet,
    current_bet: bet,
    bombs_this_attempt: totalBombs,
    attempt_earnings: 0,
    multiplier: startMult,
    carry_multiplier: 1.0,
    clicks_this_attempt: 0,
    streak: initialStreak,
    streak_5_given: initialS5,
    streak_10_given: false,
    streak_15_given: false,
    banana_tile_earnings: [],
    tiles_cleared: 0,
    magnet_clears: 0,
    combos_triggered: [],
    active_combo_display: [],
    player_flags: [],
    flag_mode: false,
    deduction_streak: 0,
    last_reveal_index: -1,
    numbered_symbols: [],
    proven_clicks: 0,
    guess_clicks: 0,
    pending_probe: false,
    consumables_placed: [],
    pending_scanner_axis: null,
    lucky_board_used: state.active_events.includes('lucky_board') ? true : state.lucky_board_used,
  };

  const board = generateBoard(nextState);

  // Remove auto-used consumables (one copy each — duplicates keep for later boards)
  let newConsumables = removeOne(state.consumables_owned, 'scatter_reveal');
  newConsumables = removeOne(newConsumables, 'empty_eraser');
  newConsumables = removeOne(newConsumables, 'bomb_detector');
  newConsumables = removeOne(newConsumables, 'mult_vial');

  // Placement queue for defuser + lucky_tile
  const queue = newConsumables.filter(c => PLACEABLE_CONSUMABLES.includes(c));
  const nextPhase = queue.length > 0 ? 'PLACEMENT' : 'CLEARING';

  return {
    ...nextState,
    board,
    phase: nextPhase,
    consumables_owned: newConsumables,
    placement_queue: queue,
    placing_index: queue.length > 0 ? 0 : -1,
  };
}

// ─── Bust flash end ───────────────────────────────────────────────────────────

export function handleBustFlashEnd(state: GameState): GameState {
  if (state.attempts_remaining > 0) {
    return toBetPhase({ ...state, board: [] });
  }
  return settleFinalAttempt(state);
}

// ─── Shop generation ──────────────────────────────────────────────────────────

export function generateShop(state: GameState): {
  consumables: ShopConsumableItem[];
  relics: ShopRelicItem[];
} {
  const rng = mulberry32(state.seed + state.cycle_number * 777);
  const shuffledCons = rngShuffle(rng, [...ALL_CONSUMABLES]).slice(0, MAX_SHOP_ITEMS);
  const shuffledRels = rngShuffle(
    rng,
    relicPool(state).map(r => ({
      ...r,
      owned: state.relics.includes(r.id),
      sold: false,
    }))
  )
    .filter(r => !r.owned)
    .slice(0, MAX_SHOP_ITEMS);

  return {
    consumables: shuffledCons.map(c => ({ ...c, sold: false })),
    relics: shuffledRels,
  };
}

export function rerollConsumables(state: GameState): ShopConsumableItem[] {
  const rng = mulberry32(state.seed + state.cycle_number * 777 + 999);
  return rngShuffle(rng, [...ALL_CONSUMABLES]).slice(0, MAX_SHOP_ITEMS).map(c => ({ ...c, sold: false }));
}

// Locked relics (LOCKED_RELIC_IDS) only enter the pool once unlocked across runs
function relicPool(state: GameState): ShopRelicItem[] {
  return ALL_RELICS.filter(r => !LOCKED_RELIC_IDS.includes(r.id) || state.unlocked_relics.includes(r.id));
}

export function rerollRelics(state: GameState): ShopRelicItem[] {
  const rng = mulberry32(state.seed + state.cycle_number * 777 + 1999);
  return rngShuffle(
    rng,
    relicPool(state).map(r => ({ ...r, owned: state.relics.includes(r.id), sold: false }))
  )
    .filter(r => !r.owned)
    .slice(0, MAX_SHOP_ITEMS);
}

// ─── Next cycle ───────────────────────────────────────────────────────────────

export function startNextCycle(state: GameState): GameState {
  const nextCycle = state.cycle_number + 1;
  const boss = getBossForCycle(state.seed, nextCycle);

  // The house notices: the deadline never sits below a fixed share of the
  // bankroll you leave the shop with (backstop against runaway compounding).
  let nextDeadline = Math.max(calcDeadline(nextCycle), Math.round((state.wallet * DEADLINE_WALLET_CHASE) / 10) * 10);
  // Inflator boss: deadline +25%
  if (boss === 'inflator') nextDeadline = Math.round((nextDeadline * 1.25) / 10) * 10;

  const eventOptions = boss === null ? drawEventCards(state, nextCycle) : [];

  return {
    ...state,
    // Boss cycles skip the event pick — the boss rule IS the modifier
    phase: boss !== null ? 'BOSS_INTRO' : 'EVENT_CARD',
    cycle_number: nextCycle,
    board_cols: calcBoardCols(nextCycle),
    deadline: nextDeadline,
    deposited: 0,
    interest_earned_this_cycle: 0,
    attempts_remaining: attemptsForCycle(nextCycle, boss),
    bomb_suit_used: false,
    lucky_board_used: false,
    // Cycle-scoped picks expire; permanent traits carry on
    cycle_events: [],
    active_events: [...state.traits],
    active_boss: boss,
    event_card_options: eventOptions,
    pending_pack_choices: null,
    pending_pack_picks_remaining: 0,
    current_bet: 10,
    attempt_earnings: 0,
    multiplier: 1.0,
    carry_multiplier: 1.0,
    clicks_this_attempt: 0,
    streak: 0,
    streak_5_given: false,
    streak_10_given: false,
    streak_15_given: false,
    banana_tile_earnings: [],
    tiles_cleared: 0,
    magnet_clears: 0,
    board: [],
    bombs_this_attempt: 0,
    combos_triggered: [],
    active_combo_display: [],
    player_flags: [],
    flag_mode: false,
    deduction_streak: 0,
    last_reveal_index: -1,
    numbered_symbols: [],
    proven_clicks: 0,
    guess_clicks: 0,
    gut_feeling_used: false,
    pending_probe: false,
    consumables_placed: [],
    placement_queue: [],
    placing_index: -1,
    pending_scanner_axis: null,
  };
}

// ─── Event card draw ──────────────────────────────────────────────────────────

// Excludes modifiers the run has already picked up (they stack permanently, so
// re-offering them would be a wasted pick) — falls back to the full pool once
// the player has collected them all.
export function drawEventCards(state: GameState, forCycle?: number): EventCardId[] {
  const rng = mulberry32(state.seed + (forCycle ?? state.cycle_number) * 333);
  const available = EVENT_CARDS.map(c => c.id).filter(id => !state.traits.includes(id));
  const pool = available.length >= 3 ? available : EVENT_CARDS.map(c => c.id);
  return rngShuffle(rng, pool).slice(0, 3) as EventCardId[];
}

// A picked card lasts this cycle. Picking a card for the SECOND time in a run
// promotes it to a permanent trait (up to MAX_TRAITS). active_events is always
// the union of traits + this cycle's pick — every gameplay check reads that.
export function selectEventCard(state: GameState, id: EventCardId): GameState {
  const pickedBefore = state.event_history.includes(id);
  let traits = state.traits;
  let history = state.event_history;
  if (pickedBefore && !traits.includes(id) && traits.length < MAX_TRAITS) {
    traits = [...traits, id];
    history = history.filter(h => h !== id);
  } else if (!pickedBefore && !traits.includes(id)) {
    history = [...history, id];
  }
  const cycle_events = traits.includes(id) ? [] : [id];
  const active_events = Array.from(new Set([...traits, ...cycle_events]));
  return toBetPhase({ ...state, traits, event_history: history, cycle_events, active_events, event_card_options: [] });
}

// ─── Initial state ────────────────────────────────────────────────────────────

export function createInitialState(opts: { daily?: boolean; seed?: number } = {}): GameState {
  const meta = loadMeta();
  return {
    phase: 'START',
    wallet: STARTING_WALLET,
    tickets: 0,
    cycle_number: 1,
    deadline: calcDeadline(1),
    deposited: 0,
    attempts_remaining: 3,
    bomb_suit_used: false,
    current_bet: 10,
    attempt_earnings: 0,
    multiplier: 1.0,
    carry_multiplier: 1.0,
    clicks_this_attempt: 0,
    streak: 0,
    streak_5_given: false,
    streak_10_given: false,
    streak_15_given: false,
    banana_tile_earnings: [],
    tiles_cleared: 0,
    magnet_clears: 0,
    board: [],
    board_cols: calcBoardCols(1),
    bombs_this_attempt: 0,
    lucky_board_used: false,
    combos_triggered: [],
    active_combo_display: [],
    player_flags: [],
    flag_mode: false,
    deduction_streak: 0,
    last_reveal_index: -1,
    numbered_symbols: [],
    proven_clicks: 0,
    guess_clicks: 0,
    gut_feeling_used: false,
    last_attempt_busted: false,
    pending_probe: false,
    combo_id_counter: 1,
    active_events: [],
    traits: [],
    cycle_events: [],
    event_history: [],
    active_boss: null,
    event_card_options: [],
    relics: [],
    consumables_owned: [],
    consumables_placed: [],
    placement_queue: [],
    placing_index: -1,
    pending_scanner_axis: null,
    boosts: [],
    max_relic_slots: MAX_ACTIVE_RELICS,
    skills: meta.skills,
    unlocked_relics: [...meta.unlocks],
    is_daily: !!opts.daily,
    run_stats: { perfect_clear_best_cycle: 0, best_flawless_proven: 0, bosses_beaten: 0 },
    interest_earned_this_cycle: 0,
    packs_opened: 0,
    relic_cases_bought: 0,
    pending_pack_choices: null,
    pending_pack_picks_remaining: 0,
    shop_consumables: [],
    shop_relics: [],
    shop_packs: [],
    shop_relic_case: null,
    shop_consumables_rerolled: false,
    shop_relics_rerolled: false,
    shop_packs_rerolled: false,
    pending_results: null,
    pending_next_phase: null,
    debug_bomb_override: null,
    cycles_survived: 0,
    total_earned: 0,
    highest_multiplier: 1.0,
    best_streak: 0,
    seed: opts.seed ?? (opts.daily ? dailySeed() : newSeed()),
  };
}

// ─── Packs & symbol boosts ─────────────────────────────────────────────────────
//
// 3 fixed shop slots per visit (same pattern as consumables/relics — buying a
// slot marks it sold, getting more requires a reroll). Each slot's kind is
// rolled independently: frequency, payout, or (rarer) themed. Axis slots also
// roll a "huge" variant with 5 reveal choices instead of 3.

export function getPackPrice(state: GameState): number {
  return Math.round((PACK_BASE_PRICE + state.packs_opened * PACK_PRICE_STEP) * shopPriceScale(state.deadline));
}

function weightedPick<T>(rng: () => number, options: { value: T; weight: number }[]): T {
  const total = options.reduce((sum, o) => sum + o.weight, 0);
  let r = rng() * total;
  for (const o of options) {
    r -= o.weight;
    if (r <= 0) return o.value;
  }
  return options[options.length - 1].value;
}

// Specialist relic: the symbol with the most combined boost stacks (both
// axes) so far — null on a fresh run with no boosts yet. Used to bias BOTH
// themed-pack symbol rolls and generatePackChoices toward reinforcing an
// existing lean, instead of the default anti-snowball spread.
function getLeaderSymbol(state: GameState): SymbolId | null {
  let leader: SymbolId | null = null;
  let max = 0;
  for (const s of SYMBOLS) {
    const stacks = state.boosts.filter(b => b.symbol === s.id).length;
    if (stacks > max) { max = stacks; leader = s.id; }
  }
  return leader;
}

function rollPackSlot(state: GameState, rng: () => number): ShopPackSlot {
  const kind = weightedPick(rng, PACK_KIND_WEIGHTS.map(k => ({ value: k.kind, weight: k.weight })));
  const basePrice = getPackPrice(state);

  if (kind === 'themed') {
    const leader = state.relics.includes('specialist') ? getLeaderSymbol(state) : null;
    const symbol = weightedPick(rng, SYMBOLS.map(s => ({ value: s.id, weight: leader === s.id ? 5 : 1 })));
    return { kind, symbol, huge: false, price: Math.round(basePrice * THEMED_PACK_PRICE_MULT), sold: false };
  }

  const huge = rng() < HUGE_PACK_CHANCE;
  const price = Math.round(basePrice * (huge ? HUGE_PACK_PRICE_MULT : 1));
  return { kind, symbol: null, huge, price, sold: false };
}

export function generatePackSlots(state: GameState): ShopPackSlot[] {
  const rng = mulberry32(state.seed + state.cycle_number * 4013 + state.packs_opened * 97);
  return Array.from({ length: PACK_SLOT_COUNT }, () => rollPackSlot(state, rng));
}

export function rerollPacks(state: GameState): ShopPackSlot[] {
  // Same price curve as a fresh shop (packs_opened only rises on an actual
  // buy) — a reroll just gives new picks, it doesn't discount or inflate.
  const rng = mulberry32(state.seed + state.cycle_number * 4013 + state.packs_opened * 97 + 7919);
  return Array.from({ length: PACK_SLOT_COUNT }, () => rollPackSlot(state, rng));
}

// `count` distinct symbols for the given axis — weighted away from symbols
// already heavily stacked on that axis, so a run naturally spreads across
// several symbols rather than snowballing into one. Specialist relic inverts
// this for the single leading symbol, favoring it instead — lets a player
// commit hard to one build once they've started leaning that way.
export function generatePackChoices(state: GameState, axis: BoostAxis, count: number = PACK_CHOICE_COUNT): SymbolBoost[] {
  const rng = mulberry32(state.seed + state.cycle_number * 4013 + state.packs_opened * 97 + (axis === 'frequency' ? 31 : 53));
  const leader = state.relics.includes('specialist') ? getLeaderSymbol(state) : null;
  const pool: { boost: SymbolBoost; weight: number }[] = SYMBOLS.map(s => {
    const stacks = state.boosts.filter(b => b.symbol === s.id && b.axis === axis).length;
    const weight = leader === s.id ? 4 : 1 / (1 + stacks);
    return { boost: { symbol: s.id, axis }, weight };
  });

  const picks: SymbolBoost[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const total = pool.reduce((sum, c) => sum + c.weight, 0);
    let r = rng() * total;
    let idx = 0;
    for (; idx < pool.length - 1; idx++) {
      r -= pool[idx].weight;
      if (r <= 0) break;
    }
    picks.push(pool[idx].boost);
    pool.splice(idx, 1);
  }
  return picks;
}

export function buyPack(state: GameState, index: number): GameState {
  const slot = state.shop_packs[index];
  if (!slot || slot.sold || state.wallet < slot.price || state.pending_pack_choices !== null) return state;

  const withCount = { ...state, packs_opened: state.packs_opened + 1 };
  const markSold = (s: GameState): GameState => ({
    ...s,
    wallet: parseFloat((state.wallet - slot.price).toFixed(2)),
    shop_packs: state.shop_packs.map((p, i) => i === index ? { ...p, sold: true } : p),
  });

  if (slot.kind === 'themed') {
    return markSold({
      ...withCount,
      boosts: [...state.boosts, { symbol: slot.symbol!, axis: 'frequency' }, { symbol: slot.symbol!, axis: 'payout' }],
    });
  }

  const choices = generatePackChoices(withCount, slot.kind, slot.huge ? HUGE_PACK_CHOICE_COUNT : PACK_CHOICE_COUNT);
  return markSold({
    ...withCount,
    pending_pack_choices: choices,
    pending_pack_picks_remaining: slot.huge ? HUGE_PACK_PICK_COUNT : PACK_PICK_COUNT,
  });
}

// Huge packs let the player pick 2 of the 5 revealed choices instead of just
// 1 — removes the picked boost from the reveal and keeps it open until
// pending_pack_picks_remaining hits 0 (or the reveal runs out of choices).
export function pickPackBoost(state: GameState, boost: SymbolBoost): GameState {
  if (!state.pending_pack_choices) return state;
  const picked = state.pending_pack_choices.find(b => b.symbol === boost.symbol && b.axis === boost.axis);
  if (!picked) return state;

  const remaining = state.pending_pack_choices.filter(b => b !== picked);
  const picksLeft = state.pending_pack_picks_remaining - 1;
  const done = picksLeft <= 0 || remaining.length === 0;

  return {
    ...state,
    boosts: [...state.boosts, picked],
    pending_pack_choices: done ? null : remaining,
    pending_pack_picks_remaining: done ? 0 : picksLeft,
  };
}

// Declines the rest of an open pack reveal — the pack is already paid for
// (buyPack already deducted cash/marked the slot sold), so skipping just
// forfeits any remaining boost pick(s) rather than forcing one.
export function skipPackBoost(state: GameState): GameState {
  if (!state.pending_pack_choices) return state;
  return {
    ...state,
    pending_pack_choices: null,
    pending_pack_picks_remaining: 0,
  };
}

// ─── Relic Case ──────────────────────────────────────────────────────────────────
//
// One-shot ticket purchase that permanently raises the relic shelf cap by 1,
// up to MAX_BONUS_RELIC_SLOTS past the base MAX_ACTIVE_RELICS. Not a relic
// itself — it's consumed on purchase rather than occupying a shelf slot.

export function getRelicCasePrice(state: GameState): number {
  return RELIC_CASE_BASE_PRICE + state.relic_cases_bought * RELIC_CASE_PRICE_STEP;
}

export function generateRelicCaseSlot(state: GameState): ShopRelicCaseItem | null {
  if (state.max_relic_slots >= MAX_ACTIVE_RELICS + MAX_BONUS_RELIC_SLOTS) return null;
  return { price: getRelicCasePrice(state), sold: false };
}

export function buyRelicCase(state: GameState): GameState {
  const slot = state.shop_relic_case;
  if (!slot || slot.sold || state.tickets < slot.price) return state;

  return {
    ...state,
    tickets: state.tickets - slot.price,
    max_relic_slots: state.max_relic_slots + 1,
    relic_cases_bought: state.relic_cases_bought + 1,
    shop_relic_case: { ...slot, sold: true },
  };
}

// ─── Utility ──────────────────────────────────────────────────────────────────

export function removeOne<T>(arr: T[], val: T): T[] {
  const i = arr.indexOf(val);
  return i === -1 ? arr : [...arr.slice(0, i), ...arr.slice(i + 1)];
}
