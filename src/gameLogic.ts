import {
  GRID_SIZE, GRID_COLS, LEVELS, BOSS_BOMBS, SYMBOLS, SYMBOL_MAP,
  ALL_CONSUMABLES, ALL_RELICS, STARTING_CASH, STARTING_LIVES, MAX_LIVES,
  STREAK_PER_TILE, STREAK_BELL_BONUS, MAX_CONSUMABLE_SLOTS, MAX_RELIC_SLOTS,
  PLACEABLE_CONSUMABLES, EVENT_CARDS,
} from './constants';
import type {
  GameState, Tile, SymbolId, RelicId, EventCardId,
  ShopConsumableItem, ShopRelicItem, RoundSummaryData,
} from './types';
import { mulberry32, weightedChoice, rngShuffle, newSeed } from './rng';

// ─── RNG helpers ──────────────────────────────────────────────────────────────

function makeRng(state: GameState) {
  // Derive a per-action RNG by using seed + gridKey as offset
  return mulberry32(state.seed + state.gridKey * 1000 + state.round * 100);
}

// ─── Grid generation ──────────────────────────────────────────────────────────

function getSymbolWeights(eventCard: EventCardId | null): Array<{ id: SymbolId; weight: number }> {
  return SYMBOLS.map(s => {
    let w = s.weight;
    if (eventCard === 'cherry_season' && s.id === 'cherry')  w *= 2;
    if (eventCard === 'banana_bonanza' && s.id === 'banana') w *= 2;
    if (eventCard === 'star_shower' && s.id === 'star')      w *= 2;
    if (eventCard === 'bell_ringer' && s.id === 'bell')      w *= 1.5; // more bells
    if (eventCard === 'coin_rush' && s.id === 'coin')        w *= 3;
    return { id: s.id, weight: w };
  });
}

export function generateGrid(state: GameState): Tile[] {
  const rng = makeRng(state);
  const round = state.round;
  const cfg = LEVELS[round - 1];
  const isBoss = cfg.isBoss;
  const activeEvent = state.activeEventCard;

  // Extra bombs from Danger Pay event
  const extraBombs = activeEvent === 'danger_pay' ? 2 : 0;
  const totalBombs = Math.min(cfg.bombs + extraBombs, GRID_SIZE - 1);

  // Initialize blank tiles
  const tiles: Tile[] = Array.from({ length: GRID_SIZE }, (_, i) => ({
    id: i,
    isBomb: false,
    symbol: null,
    state: 'hidden' as const,
    isDefused: false,
    placedConsumable: null,
  }));

  // ── Bomb placement ──────────────────────────────────────────────────────────

  let bombIndices: number[];

  if (isBoss && BOSS_BOMBS[round]) {
    bombIndices = BOSS_BOMBS[round].slice(0, totalBombs);
  } else {
    // Safe Zone event: one quadrant guaranteed bomb-free
    let blockedIndices: number[] = [];
    if (activeEvent === 'safe_zone') {
      const quadrant = Math.floor(rng() * 4);
      const quadrantTiles: Record<number, number[]> = {
        0: [0,1,5,6],    // top-left 2×2
        1: [3,4,8,9],    // top-right 2×2
        2: [15,16,20,21],// bottom-left 2×2
        3: [18,19,23,24],// bottom-right 2×2
      };
      blockedIndices = quadrantTiles[quadrant] ?? [];
      // Store which quadrant is safe (we don't expose this to player via UI, just block bombs)
    }

    // Cartographer relic: one corner is forced safe
    let safeCorner = -1;
    if (state.relics.includes('cartographer')) {
      const corners = [0, 4, 20, 24].filter(c => !blockedIndices.includes(c));
      safeCorner = corners[Math.floor(rng() * corners.length)];
    }

    const eligible = Array.from({ length: GRID_SIZE }, (_, i) => i)
      .filter(i => i !== safeCorner && !blockedIndices.includes(i));
    const shuffled = rngShuffle(rng, eligible);
    bombIndices = shuffled.slice(0, totalBombs);
  }

  for (const idx of bombIndices) {
    tiles[idx].isBomb = true;
  }

  // ── Symbol assignment for safe tiles ───────────────────────────────────────

  const weights = getSymbolWeights(activeEvent);
  for (const tile of tiles) {
    if (!tile.isBomb) {
      tile.symbol = weightedChoice(rng, weights);
    }
  }

  // ── Pre-round tool reveals ─────────────────────────────────────────────────

  // Cartographer: hint a safe corner
  if (state.relics.includes('cartographer') && !isBoss) {
    const corners = [0, 4, 20, 24];
    const safeCorners = corners.filter(i => !tiles[i].isBomb);
    if (safeCorners.length > 0) {
      const pick = safeCorners[Math.floor(rng() * safeCorners.length)];
      tiles[pick].state = 'hinted';
    }
  }

  // Scatter Reveal consumable: hint 3 random safe tiles
  if (state.consumables.includes('scatter_reveal')) {
    const hidden = tiles.filter(t => !t.isBomb && t.state === 'hidden');
    const picks = rngShuffle(rng, hidden).slice(0, 3);
    picks.forEach(t => { tiles[t.id].state = 'hinted'; });
  }

  // Lucky Scout event card: hint 2 random safe tiles
  if (activeEvent === 'lucky_scout') {
    const hidden = tiles.filter(t => !t.isBomb && t.state === 'hidden');
    const picks = rngShuffle(rng, hidden).slice(0, 2);
    picks.forEach(t => { tiles[t.id].state = 'hinted'; });
  }

  return tiles;
}

// ─── Streak meter ─────────────────────────────────────────────────────────────

function calcStreakGain(
  symbol: SymbolId,
  activeEvent: EventCardId | null,
): number {
  let gain = STREAK_PER_TILE;
  if (symbol === 'bell') {
    gain += STREAK_BELL_BONUS;
    if (activeEvent === 'bell_ringer') gain += STREAK_BELL_BONUS; // 2× faster
  }
  return gain;
}

// ─── Cashout calculation ──────────────────────────────────────────────────────

export function calcCashout(state: GameState): {
  cashoutMult: number;
  payout: number;
  netGain: number;
  starBonus: number;
  cherryCombo: boolean;
  bananaBonus: number;
  totalPayout: number;
} {
  const cfg = LEVELS[state.round - 1];
  const targetScore = Math.round(cfg.target * (state.activeEventCard === 'high_roller' ? 1.5 : 1));

  // Base multiplier
  let cashoutMult = Math.max(2.0, (state.score / targetScore) * 2.0);

  // Event card modifiers
  if (state.activeEventCard === 'greed_mode')  cashoutMult *= 1.5;
  if (state.activeEventCard === 'high_roller') cashoutMult *= 2.5; // override to 2.5 floor
  if (state.activeEventCard === 'danger_pay')  cashoutMult *= 1.3;

  const payout = Math.floor(state.bet * cashoutMult);

  // Star bonus ($1 per star, $2 with Star Shower event)
  const perStar = state.activeEventCard === 'star_shower' ? 2 : 1;
  const starBonus = state.starsThisRound * perStar;

  // Cherry combo: 3+ cherries in same row or column = +50% to payout
  const cherryCombo = hasCherryCombo(state.grid, state.cherriesRevealed);

  // Banana adjacency bonus
  const bananaMult = state.relics.includes('banana_republic') ? 2.5 : 1.5;
  const bananaBonus = calcBananaBonus(state.grid, state.bananasRevealed, bananaMult);

  // Relics
  let relicBonus = 0;
  if (state.relics.includes('greed_chip')) relicBonus += 2;
  if (state.relics.includes('double_down')) {
    const safeTiles = state.grid.filter(t => !t.isBomb).length;
    if (state.tilesCleared >= Math.floor(safeTiles * 0.8)) relicBonus += payout;
  }

  // Overage bonus: +$0.50 per 10% above target
  const overPct = Math.max(0, (state.score - targetScore) / targetScore);
  const overageBonus = Math.floor(overPct * 10) * 0.5;

  const totalPayout = payout
    + starBonus
    + (cherryCombo ? Math.floor(payout * 0.5) : 0)
    + bananaBonus
    + relicBonus
    + state.luckyCharmBonus
    + overageBonus;

  return {
    cashoutMult: parseFloat(cashoutMult.toFixed(2)),
    payout,
    netGain: Math.floor(totalPayout) - state.bet,
    starBonus,
    cherryCombo,
    bananaBonus,
    totalPayout: Math.floor(totalPayout),
  };
}

function hasCherryCombo(_grid: Tile[], cherryIndices: number[]): boolean {
  const cherrySet = new Set(cherryIndices);
  // Check rows
  for (let r = 0; r < 5; r++) {
    let count = 0;
    for (let c = 0; c < 5; c++) {
      if (cherrySet.has(r * 5 + c)) { count++; if (count >= 3) return true; }
      else count = 0;
    }
  }
  // Check columns
  for (let c = 0; c < 5; c++) {
    let count = 0;
    for (let r = 0; r < 5; r++) {
      if (cherrySet.has(r * 5 + c)) { count++; if (count >= 3) return true; }
      else count = 0;
    }
  }
  return false;
}

function calcBananaBonus(_grid: Tile[], bananaIndices: number[], multFactor: number): number {
  const bananaSet = new Set(bananaIndices);
  let bonus = 0;
  const neighbors = (idx: number) => {
    const r = Math.floor(idx / 5), c = idx % 5;
    return [
      r > 0 ? idx - 5 : -1,
      r < 4 ? idx + 5 : -1,
      c > 0 ? idx - 1 : -1,
      c < 4 ? idx + 1 : -1,
    ].filter(n => n >= 0);
  };
  for (const idx of bananaIndices) {
    const adjBananas = neighbors(idx).filter(n => bananaSet.has(n)).length;
    if (adjBananas > 0) {
      const base = SYMBOL_MAP.banana.basePoints;
      bonus += Math.round(base * (multFactor - 1) * adjBananas);
    }
  }
  return bonus;
}

// ─── Gem earning ──────────────────────────────────────────────────────────────

function calcGemsForTile(
  symbol: SymbolId,
  relics: RelicId[],
  activeEvent: EventCardId | null
): number {
  let gems = 1; // base: 1 gem per tile
  if (symbol === 'coin') {
    gems += 1; // coin: +1 extra
    if (activeEvent === 'coin_rush') gems += 1;  // coin rush: +1 more
    if (relics.includes('gem_cutter')) gems += 2; // gem cutter: total +3 from coin
  }
  if (symbol === 'star' && relics.includes('star_collector')) gems += 2;
  return gems;
}

// ─── Magnet: find nearest safe hidden tile ────────────────────────────────────

function magnetReveal(state: GameState, lastIdx: number): number | null {
  const candidates = state.grid
    .filter(t => !t.isBomb && (t.state === 'hidden' || t.state === 'hinted'))
    .map(t => ({
      id: t.id,
      dist: Math.abs(Math.floor(t.id / 5) - Math.floor(lastIdx / 5))
            + Math.abs((t.id % 5) - (lastIdx % 5)),
    }))
    .sort((a, b) => a.dist - b.dist);
  return candidates[0]?.id ?? null;
}

// ─── Tile click handler ───────────────────────────────────────────────────────

export function handleTileClick(state: GameState, tileIndex: number): GameState {
  const tile = state.grid[tileIndex];
  if (tile.state === 'revealed' || tile.state === 'defused') return state;
  if (state.phase !== 'playing') return state;

  // Scanner placement mode
  if (state.pendingScannerAxis !== null) {
    return applyScanner(state, tileIndex);
  }

  const newGrid = state.grid.map(t => ({ ...t }));

  // ── Bomb click ────────────────────────────────────────────────────────────

  if (tile.isBomb) {
    // Defuser check
    if (tile.isDefused || tile.placedConsumable === 'defuser') {
      newGrid[tileIndex].state = 'defused';
      newGrid[tileIndex].isDefused = true;
      return { ...state, grid: newGrid };
    }

    // Dead Man's Hand: 40% of score as cash
    let bonusCash = 0;
    if (state.relics.includes('dead_mans_hand') && state.score > 0) {
      bonusCash = Math.floor(state.score * 0.4);
    }

    // Safety Net relic (one per run)
    const safetyNetActive = state.relics.includes('safety_net') && !state.safetyNetUsed;
    // Steady Hands event card (one per round)
    const steadyHandsActive = state.activeEventCard === 'steady_hands' && !state.steadyHandsUsed;

    const lifeProtected = safetyNetActive || steadyHandsActive;
    const newLives = lifeProtected ? state.lives : state.lives - 1;
    newGrid[tileIndex].state = 'revealed';

    const newCash = state.cash + bonusCash;

    // Build round summary for bomb hit
    const summary: RoundSummaryData = {
      won: false,
      round: state.round,
      isBoss: state.isBossRound,
      score: state.score,
      bet: state.bet,
      payout: 0,
      netGain: -state.bet,
      cashoutMult: 0,
      gemsEarned: state.gemsThisRound,
      tilesCleared: state.tilesCleared,
      totalSafeTiles: state.grid.filter(t => !t.isBomb).length,
      multiplierReached: state.bestMultiplier,
      starBonus: 0,
      cherryCombo: false,
      bananaBonus: 0,
      luckyCharmBonus: 0,
    };

    if (newLives <= 0) {
      return {
        ...state,
        grid: newGrid,
        lives: 0,
        cash: newCash,
        totalCashEarned: state.totalCashEarned + bonusCash,
        phase: 'gameover',
        runTokens: calcRunTokens(state.roundsCleared, state.bossRoundsCleared),
        roundSummary: summary,
        safetyNetUsed: safetyNetActive ? true : state.safetyNetUsed,
        steadyHandsUsed: steadyHandsActive ? true : state.steadyHandsUsed,
      };
    }

    // Lives remain — go to round summary (bust)
    return {
      ...state,
      grid: newGrid,
      lives: newLives,
      cash: newCash,
      totalCashEarned: state.totalCashEarned + bonusCash,
      streakMeter: 0,
      phase: 'round_summary',
      roundSummary: summary,
      safetyNetUsed: safetyNetActive ? true : state.safetyNetUsed,
      steadyHandsUsed: steadyHandsActive ? true : state.steadyHandsUsed,
    };
  }

  // ── Safe tile click ───────────────────────────────────────────────────────

  const symbol = tile.symbol!;
  const cfg = LEVELS[state.round - 1];

  // Multiplier
  const safeTilesLeft = state.grid.filter(t => !t.isBomb && (t.state === 'hidden' || t.state === 'hinted')).length;
  let multGain = (0.1 * cfg.bombs) / 5;
  if (state.relics.includes('adrenaline_core') && safeTilesLeft < 8) multGain *= 1.25;
  const newMultiplier = parseFloat((state.multiplier + multGain).toFixed(2));
  const newBestMult = Math.max(state.bestMultiplier, newMultiplier);

  // Points — streak guaranteed tile gives 3×
  const symDef = SYMBOL_MAP[symbol];
  let points = Math.round(symDef.basePoints * state.multiplier);
  if (state.streakGuaranteed) points *= 3;
  let lensCount = state.multiplierLensCount;
  if (tile.placedConsumable === 'multiplier_lens') lensCount = 4; // activate
  else if (lensCount > 0) { points *= 2; lensCount--; }

  // Lucky Charm placed on this tile
  let newCharmBonus = state.luckyCharmBonus;
  if (tile.placedConsumable === 'lucky_charm') newCharmBonus += 3;

  const newScore = state.score + points;

  // Gems
  const gemsGained = calcGemsForTile(symbol, state.relics, state.activeEventCard);
  const newGems = state.gems + gemsGained;
  const newGemsThisRound = state.gemsThisRound + gemsGained;

  // Stars tracking
  const newStars = symbol === 'star' ? state.starsThisRound + 1 : state.starsThisRound;
  const newCherries = symbol === 'cherry' ? [...state.cherriesRevealed, tileIndex] : state.cherriesRevealed;
  const newBananas = symbol === 'banana' ? [...state.bananasRevealed, tileIndex] : state.bananasRevealed;
  const newCoins = symbol === 'coin' ? state.coinsThisRound + 1 : state.coinsThisRound;

  // Streak meter
  let newMeter = state.streakMeter + calcStreakGain(symbol, state.activeEventCard);
  let newGuaranteed = state.streakGuaranteed;
  let newBellsStreak = state.bellsThisStreak + (symbol === 'bell' ? 1 : 0);

  // Bell Choir relic: every 3 bells → instant fill
  if (state.relics.includes('bell_choir') && symbol === 'bell' && newBellsStreak % 3 === 0) {
    newMeter = 100;
  }

  if (newMeter >= 100) {
    newMeter = state.streakGuaranteed ? 0 : 99; // cap until used
    if (state.streakGuaranteed) {
      // Was guaranteed, just used it — reset
      newMeter = 0;
      newGuaranteed = false;
    } else {
      newGuaranteed = true;
      newMeter = 100;
    }
  }

  // After using guaranteed tile, reset meter
  if (state.streakGuaranteed) {
    newMeter = 0;
    newGuaranteed = false;
  }

  newGrid[tileIndex].state = 'revealed';

  const newTilesCleared = state.tilesCleared + 1;

  // Chain Reaction relic: every 5 clears → +0.5 multiplier
  let newConsecutive = state.consecutiveClears + 1;
  let chainBonus = 0;
  if (state.relics.includes('chain_reaction') && newConsecutive % 5 === 0) {
    chainBonus = 0.5;
  }

  // Magnet consumable: every 5 clears → auto-reveal nearest safe
  let newClearsMagnet = state.clearsSinceMagnet + 1;
  let magnetTarget: number | null = null;
  if (state.consumables.includes('magnet') && newClearsMagnet >= 5) {
    newClearsMagnet = 0;
    magnetTarget = magnetReveal({ ...state, grid: newGrid }, tileIndex);
    if (magnetTarget !== null) newGrid[magnetTarget].state = 'hinted';
  }

  const targetScore = Math.round(
    cfg.target * (state.activeEventCard === 'high_roller' ? 1.5 : 1)
  );
  const canCashout = newScore >= targetScore;

  const newState: GameState = {
    ...state,
    grid: newGrid,
    score: newScore,
    multiplier: parseFloat((newMultiplier + chainBonus).toFixed(2)),
    bestMultiplier: newBestMult,
    canCashout,
    starsThisRound: newStars,
    cherriesRevealed: newCherries,
    bananasRevealed: newBananas,
    coinsThisRound: newCoins,
    gemsThisRound: newGemsThisRound,
    gems: newGems,
    streakMeter: Math.min(newMeter, 100),
    streakGuaranteed: newGuaranteed,
    bellsThisStreak: newBellsStreak,
    consecutiveClears: newConsecutive,
    clearsSinceMagnet: newClearsMagnet,
    tilesCleared: newTilesCleared,
    totalTilesCleared: state.totalTilesCleared + 1,
    multiplierLensCount: lensCount,
    luckyCharmBonus: newCharmBonus,
  };

  return newState;
}

// ─── Scanner ──────────────────────────────────────────────────────────────────

function applyScanner(state: GameState, tileIndex: number): GameState {
  const axis = state.pendingScannerAxis!;
  const row = Math.floor(tileIndex / GRID_COLS);
  const col = tileIndex % GRID_COLS;

  const newGrid = state.grid.map((t, i) => {
    const tRow = Math.floor(i / GRID_COLS), tCol = i % GRID_COLS;
    const match = axis === 'row' ? tRow === row : tCol === col;
    if (!match || t.state === 'revealed' || t.state === 'defused') return t;
    if (t.isBomb) return { ...t, state: 'revealed' as const };
    return { ...t, state: 'hinted' as const };
  });

  return {
    ...state,
    grid: newGrid,
    pendingScannerAxis: null,
    consumables: removeOne(state.consumables, 'scanner'),
  };
}

// ─── Cashout handler ──────────────────────────────────────────────────────────

export function handleCashout(state: GameState): GameState {
  const { totalPayout, cashoutMult, starBonus, cherryCombo, bananaBonus } = calcCashout(state);
  const newCash = state.cash + totalPayout;
  const newTotalEarned = state.totalCashEarned + totalPayout;

  const cfg = LEVELS[state.round - 1];
  const totalSafe = state.grid.filter(t => !t.isBomb).length;

  // Gem bonuses for good clears
  let bonusGems = 0;
  if (state.tilesCleared >= Math.floor(totalSafe * 0.7)) bonusGems += 3;
  if (state.tilesCleared >= totalSafe) bonusGems += 5;
  const finalGems = state.gems + bonusGems;
  const finalGemsThisRound = state.gemsThisRound + bonusGems;

  // Streak meter: Lucky Streak relic resets to 50%, otherwise 0
  const newMeter = state.relics.includes('lucky_streak') ? 50 : 0;

  const summary: RoundSummaryData = {
    won: true,
    round: state.round,
    isBoss: state.isBossRound,
    score: state.score,
    bet: state.bet,
    payout: totalPayout,
    netGain: totalPayout - state.bet,
    cashoutMult,
    gemsEarned: finalGemsThisRound,
    tilesCleared: state.tilesCleared,
    totalSafeTiles: totalSafe,
    multiplierReached: state.bestMultiplier,
    starBonus,
    cherryCombo,
    bananaBonus,
    luckyCharmBonus: state.luckyCharmBonus,
  };

  const newRoundsCleared = state.roundsCleared + 1;
  const newBossCleared = cfg.isBoss ? state.bossRoundsCleared + 1 : state.bossRoundsCleared;

  // Check for win
  if (state.round >= 6) {
    return {
      ...state,
      cash: newCash,
      gems: finalGems,
      totalCashEarned: newTotalEarned,
      streakMeter: 0,
      roundsCleared: newRoundsCleared,
      bossRoundsCleared: newBossCleared,
      phase: 'win',
      roundSummary: summary,
      runTokens: calcRunTokens(newRoundsCleared, newBossCleared),
    };
  }

  // Boss round → show boss reward before shop
  const nextPhase = cfg.isBoss ? 'boss_reward' : 'round_summary';
  const bossRewardOptions = cfg.isBoss ? pickBossRelics(state.relics) : [];

  return {
    ...state,
    cash: newCash,
    gems: finalGems,
    totalCashEarned: newTotalEarned,
    streakMeter: newMeter,
    roundsCleared: newRoundsCleared,
    bossRoundsCleared: newBossCleared,
    phase: nextPhase,
    roundSummary: summary,
    bossRewardOptions,
    runTokens: calcRunTokens(newRoundsCleared, newBossCleared),
  };
}

function pickBossRelics(ownedRelics: RelicId[]): RelicId[] {
  const pool = ALL_RELICS.filter(r => !ownedRelics.includes(r.id)).map(r => r.id);
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3);
}

// ─── Shop generation ──────────────────────────────────────────────────────────

export function generateShop(state: GameState): { consumables: ShopConsumableItem[]; relics: ShopRelicItem[] } {
  const rng = mulberry32(state.seed + state.round * 777);
  const shuffledCons = rngShuffle(rng, [...ALL_CONSUMABLES]).slice(0, MAX_CONSUMABLE_SLOTS);
  const shuffledRels = rngShuffle(rng, ALL_RELICS.map(r => ({
    ...r,
    owned: state.relics.includes(r.id),
    sold: false,
  }))).filter(r => !r.owned).slice(0, MAX_RELIC_SLOTS);

  return {
    consumables: shuffledCons.map(c => ({ ...c, sold: false })),
    relics: shuffledRels,
  };
}

export function rerollConsumableShop(state: GameState): ShopConsumableItem[] {
  const rng = mulberry32(state.seed + state.round * 777 + 999);
  return rngShuffle(rng, [...ALL_CONSUMABLES]).slice(0, MAX_CONSUMABLE_SLOTS).map(c => ({ ...c, sold: false }));
}

export function rerollRelicShop(state: GameState): ShopRelicItem[] {
  const rng = mulberry32(state.seed + state.round * 777 + 1999);
  return rngShuffle(rng, ALL_RELICS.map(r => ({
    ...r,
    owned: state.relics.includes(r.id),
    sold: false,
  }))).filter(r => !r.owned).slice(0, MAX_RELIC_SLOTS);
}

// ─── Round start ──────────────────────────────────────────────────────────────

export function startRound(state: GameState): GameState {
  const cfg = LEVELS[state.round - 1];
  const activeEvent = state.activeEventCard;

  // Hot Streak event: meter starts at 50%
  const initialMeter = activeEvent === 'hot_streak' ? 50 : 0;

  // Determine which consumables need placement (defuser, lens, lucky_charm)
  const queue = state.consumables.filter(c => PLACEABLE_CONSUMABLES.includes(c));

  const nextPhase = queue.length > 0 ? 'consumable_placement' : 'playing';
  const grid = generateGrid({
    ...state,
    phase: nextPhase,
    streakMeter: initialMeter,
    streakGuaranteed: false,
    bellsThisStreak: 0,
    consecutiveClears: 0,
    clearsSinceMagnet: 0,
    tilesCleared: 0,
    multiplierLensCount: 0,
    starsThisRound: 0,
    cherriesRevealed: [],
    bananasRevealed: [],
    coinsThisRound: 0,
    gemsThisRound: 0,
    luckyCharmBonus: 0,
    steadyHandsUsed: false,
    canCashout: false,
    score: 0,
    multiplier: 1.0,
    bestMultiplier: 0,
    isBossRound: cfg.isBoss,
  });

  // Remove scatter_reveal from consumables (it's applied in generateGrid)
  const remainingConsumables = state.consumables.filter(c => c !== 'scatter_reveal');

  return {
    ...state,
    phase: nextPhase,
    score: 0,
    multiplier: 1.0,
    bestMultiplier: 0,
    streakMeter: initialMeter,
    streakGuaranteed: false,
    bellsThisStreak: 0,
    consecutiveClears: 0,
    clearsSinceMagnet: 0,
    canCashout: false,
    multiplierLensCount: 0,
    starsThisRound: 0,
    cherriesRevealed: [],
    bananasRevealed: [],
    coinsThisRound: 0,
    gemsThisRound: 0,
    luckyCharmBonus: 0,
    tilesCleared: 0,
    steadyHandsUsed: false,
    grid,
    gridKey: state.gridKey + 1,
    isBossRound: cfg.isBoss,
    placementQueue: queue,
    placingIndex: queue.length > 0 ? 0 : -1,
    pendingScannerAxis: null,
    roundSummary: null,
    consumables: remainingConsumables,
  };
}

// ─── Initial state ────────────────────────────────────────────────────────────

export function createInitialState(): GameState {
  return {
    phase: 'start',
    seed: newSeed(),
    cash: STARTING_CASH,
    gems: 0,
    lives: STARTING_LIVES,
    maxLives: MAX_LIVES,
    relics: [],
    consumables: [],
    round: 1,
    roundsCleared: 0,
    bossRoundsCleared: 0,
    totalTilesCleared: 0,
    bestMultiplier: 0,
    totalCashEarned: 0,
    runTokens: 0,
    safetyNetUsed: false,
    bet: 20,
    score: 0,
    multiplier: 1.0,
    streakMeter: 0,
    streakGuaranteed: false,
    bellsThisStreak: 0,
    consecutiveClears: 0,
    clearsSinceMagnet: 0,
    canCashout: false,
    multiplierLensCount: 0,
    starsThisRound: 0,
    cherriesRevealed: [],
    bananasRevealed: [],
    coinsThisRound: 0,
    gemsThisRound: 0,
    luckyCharmBonus: 0,
    tilesCleared: 0,
    steadyHandsUsed: false,
    eventCardOptions: [],
    activeEventCard: null,
    lastEventCard: null,
    grid: [],
    gridKey: 0,
    isBossRound: false,
    placementQueue: [],
    placingIndex: -1,
    pendingScannerAxis: null,
    shopConsumables: [],
    shopRelics: [],
    shopRerollUsed: false,
    relicRerollUsed: false,
    bossRewardOptions: [],
    roundSummary: null,
  };
}

// ─── Event card draw ──────────────────────────────────────────────────────────

export function drawEventCards(state: GameState): EventCardId[] {
  const pool = EVENT_CARDS.map(c => c.id).filter(id => id !== state.lastEventCard);
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3);
}

// ─── Run token calculation ────────────────────────────────────────────────────

export function calcRunTokens(roundsCleared: number, bossRoundsCleared: number): number {
  return roundsCleared * 5 + bossRoundsCleared * 15;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

export function removeOne<T>(arr: T[], val: T): T[] {
  const i = arr.indexOf(val);
  return i === -1 ? arr : [...arr.slice(0, i), ...arr.slice(i + 1)];
}
