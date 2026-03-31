import { GRID_SIZE, GRID_COLS, LEVELS, BASE_TILE_POINTS, ALL_SHOP_ITEMS, STARTING_LIVES } from './constants';
import type { GameState, Tile, RelicId, ConsumableId, ShopItem } from './types';

// ─── Grid Generation ──────────────────────────────────────────────────────────

export function generateGrid(
  bombCount: number,
  relics: RelicId[],
  consumables: ConsumableId[],
  excludedIndices: number[] = []  // these indices keep their current state (e.g. a revealed bomb)
): Tile[] {
  const tiles: Tile[] = Array.from({ length: GRID_SIZE }, (_, i) => ({
    id: i,
    isBomb: false,
    state: 'hidden' as const,
    isSafeRevealed: false,
    isDefused: false,
  }));

  // Cartographer: one corner tile forced safe
  const cartographerActive = relics.includes('cartographer');
  const corners = [0, 4, 20, 24].filter(c => !excludedIndices.includes(c));
  const cartographerCorner = cartographerActive && corners.length > 0
    ? corners[Math.floor(Math.random() * corners.length)]
    : -1;

  // Place bombs (skip excluded + cartographer corner)
  const bombableIndices = tiles
    .map((_, i) => i)
    .filter(i => i !== cartographerCorner && !excludedIndices.includes(i));
  const shuffled = bombableIndices.sort(() => Math.random() - 0.5);
  for (let i = 0; i < Math.min(bombCount, shuffled.length); i++) {
    tiles[shuffled[i]].isBomb = true;
  }

  // Cartographer: hint the safe corner (clickable for points)
  if (cartographerCorner >= 0) {
    tiles[cartographerCorner].state = 'hinted';
  }

  // Scatter Reveal: hint 3 random safe tiles (clickable for points)
  if (consumables.includes('scatter_reveal')) {
    const safeTiles = tiles.filter(t => !t.isBomb && t.state === 'hidden' && !excludedIndices.includes(t.id));
    const pick = safeTiles.sort(() => Math.random() - 0.5).slice(0, 3);
    pick.forEach(t => { tiles[t.id].state = 'hinted'; });
  }

  return tiles;
}

// ─── Multiplier Calculation ────────────────────────────────────────────────────

export function calcMultiplierGain(
  bombCount: number,
  safeTilesLeft: number,
  relics: RelicId[]
): number {
  const bombBonus = bombCount * 0.01;
  let gain = 0.1 + bombBonus;
  if (relics.includes('adrenaline_core') && safeTilesLeft < 10) gain *= 1.25;
  return parseFloat(gain.toFixed(3));
}

// ─── Cashout Calculation ──────────────────────────────────────────────────────

export function calcCashout(
  score: number,
  targetScore: number,
  basePayout: number,
  relics: RelicId[],
  tilesCleared: number,
  totalSafeTiles: number
): number {
  const overage = Math.max(0, score - targetScore);
  const overPercent = targetScore > 0 ? overage / targetScore : 0;
  const bonus = Math.floor(overPercent * 10);

  let payout = basePayout + bonus;
  if (relics.includes('greed_chip')) payout += 2;
  if (relics.includes('double_down') && tilesCleared / totalSafeTiles >= 0.8) payout *= 2;

  return payout;
}

// ─── Shop Generation ──────────────────────────────────────────────────────────

export function generateShopItems(ownedRelics: RelicId[]): ShopItem[] {
  const pool = ALL_SHOP_ITEMS.filter(
    item => !(item.type === 'relic' && ownedRelics.includes(item.id as RelicId))
  );
  return pool.sort(() => Math.random() - 0.5).slice(0, 4);
}

// ─── Initial State ────────────────────────────────────────────────────────────

export function createInitialState(): GameState {
  return {
    phase: 'start',
    level: 1,
    money: 0,
    lives: STARTING_LIVES,
    score: 0,
    multiplier: 1.0,
    grid: [],
    gridKey: 0,
    relics: [],
    consumables: [],
    shopItems: [],
    canCashout: false,
    safetyNetUsed: false,
    multiplierLensCount: 0,
    totalMoneyEarned: 0,
    bombHitThisRound: false,
    pendingConsumable: null,
    defusedTiles: [],
    scannerAxis: null,
  };
}

// ─── Start Level ──────────────────────────────────────────────────────────────

export function startLevel(state: GameState): GameState {
  const levelConfig = LEVELS[state.level - 1];
  const grid = generateGrid(levelConfig.bombs, state.relics, state.consumables);

  return {
    ...state,
    phase: 'playing',
    score: 0,
    multiplier: 1.0,
    grid,
    gridKey: state.gridKey + 1,
    canCashout: false,
    bombHitThisRound: false,
    pendingConsumable: null,
    defusedTiles: [],
    scannerAxis: null,
    consumables: state.consumables.filter(c => c !== 'scatter_reveal'),
  };
}

// ─── Tile Click Handler ───────────────────────────────────────────────────────

export function handleTileClick(state: GameState, tileIndex: number): GameState {
  const tile = state.grid[tileIndex];
  // 'revealed' and 'defused' can't be clicked; 'hinted' and 'hidden' can
  if (tile.state === 'revealed' || tile.state === 'defused') return state;
  if (state.phase !== 'playing') return state;

  // ── Consumable placement ──────────────────────────────────────────────────

  if (state.pendingConsumable === 'defuser') {
    const newGrid = [...state.grid];
    newGrid[tileIndex] = { ...tile, isDefused: true };
    return {
      ...state,
      grid: newGrid,
      pendingConsumable: null,
      defusedTiles: [...state.defusedTiles, tileIndex],
      consumables: state.consumables.filter(c => c !== 'defuser'),
    };
  }

  if (state.pendingConsumable === 'scanner') {
    const row = Math.floor(tileIndex / GRID_COLS);
    const col = tileIndex % GRID_COLS;
    const axis = state.scannerAxis ?? 'row';
    const newGrid = state.grid.map((t, i) => {
      const tRow = Math.floor(i / GRID_COLS);
      const tCol = i % GRID_COLS;
      const match = axis === 'row' ? tRow === row : tCol === col;
      if (!match) return t;
      if (t.state !== 'hidden' && t.state !== 'hinted') return t;
      // Bombs → revealed (info, unclickable). Safe → hinted (still clickable for points)
      if (t.isBomb) return { ...t, state: 'revealed' as const, isSafeRevealed: true };
      return { ...t, state: 'hinted' as const };
    });
    return {
      ...state,
      grid: newGrid,
      pendingConsumable: null,
      scannerAxis: null,
      consumables: state.consumables.filter(c => c !== 'scanner'),
    };
  }

  // ── Bomb click ────────────────────────────────────────────────────────────

  const newGrid = [...state.grid];

  if (tile.isBomb) {
    // Defuser check
    if (tile.isDefused || state.defusedTiles.includes(tileIndex)) {
      newGrid[tileIndex] = { ...tile, state: 'defused' };
      return { ...state, grid: newGrid };
    }

    // Dead Man's Hand: 40% of score before dying
    let bonusMoney = 0;
    if (state.relics.includes('dead_mans_hand') && state.score > 0) {
      bonusMoney = Math.floor(state.score * 0.4);
    }

    // Safety Net: first bomb doesn't cost a life
    const safetyNetActive = state.relics.includes('safety_net') && !state.safetyNetUsed;
    const newLives = safetyNetActive ? state.lives : state.lives - 1;
    const newMoney = state.money + bonusMoney;
    const newTotalEarned = state.totalMoneyEarned + bonusMoney;

    // Game over
    if (newLives <= 0) {
      newGrid[tileIndex] = { ...tile, state: 'revealed' };
      return {
        ...state,
        grid: newGrid,
        lives: 0,
        money: newMoney,
        totalMoneyEarned: newTotalEarned,
        phase: 'gameover',
        bombHitThisRound: true,
        safetyNetUsed: safetyNetActive ? true : state.safetyNetUsed,
      };
    }

    // Level reset: hit bomb stays visible, rest reshuffles with one fewer bomb
    const levelConfig = LEVELS[state.level - 1];
    const nextGrid = generateGrid(
      levelConfig.bombs - 1,  // one bomb is the revealed one
      state.relics,
      state.consumables,
      [tileIndex]             // exclude hit tile from new bomb placement
    );
    // Keep the hit bomb revealed so player can see where it is
    nextGrid[tileIndex] = { id: tileIndex, isBomb: true, state: 'revealed', isSafeRevealed: false, isDefused: false };

    return {
      ...state,
      grid: nextGrid,
      gridKey: state.gridKey + 1,
      lives: newLives,
      money: newMoney,
      totalMoneyEarned: newTotalEarned,
      score: 0,
      multiplier: 1.0,
      canCashout: false,
      bombHitThisRound: true,
      safetyNetUsed: safetyNetActive ? true : state.safetyNetUsed,
      multiplierLensCount: 0,
      pendingConsumable: null,
      defusedTiles: [],
    };
  }

  // ── Safe tile (hidden or hinted) ──────────────────────────────────────────

  const levelConfig = LEVELS[state.level - 1];
  // Count remaining safe tiles (hidden + hinted are both uncollected)
  const safeTilesLeft = state.grid.filter(t => !t.isBomb && (t.state === 'hidden' || t.state === 'hinted')).length;
  const multiplierGain = calcMultiplierGain(levelConfig.bombs, safeTilesLeft, state.relics);
  const newMultiplier = parseFloat((state.multiplier + multiplierGain).toFixed(3));

  let points = Math.round(BASE_TILE_POINTS * state.multiplier);
  let newLensCount = state.multiplierLensCount;
  if (newLensCount > 0) {
    points *= 2;
    newLensCount--;
  }

  const newScore = state.score + points;
  // Mark as fully revealed (clear hinted status so it counts toward cleared tiles)
  newGrid[tileIndex] = { ...tile, state: 'revealed', isSafeRevealed: false };

  const canCashout = newScore >= levelConfig.target;

  return {
    ...state,
    grid: newGrid,
    score: newScore,
    multiplier: newMultiplier,
    canCashout,
    multiplierLensCount: newLensCount,
  };
}

// ─── Cashout ──────────────────────────────────────────────────────────────────

export function handleCashout(state: GameState): GameState {
  const levelConfig = LEVELS[state.level - 1];
  const totalSafeTiles = GRID_SIZE - levelConfig.bombs;
  const tilesCleared = state.grid.filter(t => !t.isBomb && t.state === 'revealed' && !t.isSafeRevealed).length;

  const payout = calcCashout(
    state.score,
    levelConfig.target,
    levelConfig.payout,
    state.relics,
    tilesCleared,
    totalSafeTiles
  );

  const newMoney = state.money + payout;
  const newTotalEarned = state.totalMoneyEarned + payout;
  const lensCount = state.consumables.includes('multiplier_lens') ? 5 : state.multiplierLensCount;

  if (state.level >= 6) {
    return { ...state, money: newMoney, totalMoneyEarned: newTotalEarned, phase: 'gameover' };
  }

  const shopItems = generateShopItems(state.relics);
  return {
    ...state,
    money: newMoney,
    totalMoneyEarned: newTotalEarned,
    phase: 'shop',
    level: state.level + 1,
    shopItems,
    multiplierLensCount: lensCount,
    consumables: state.consumables.filter(c => c !== 'multiplier_lens'),
  };
}

// ─── Buy Item ─────────────────────────────────────────────────────────────────

export function handleBuyItem(state: GameState, itemId: string): GameState {
  const item = state.shopItems.find(i => i.id === itemId);
  if (!item || state.money < item.price) return state;

  const newMoney = state.money - item.price;

  if (item.type === 'relic') {
    return {
      ...state,
      money: newMoney,
      relics: [...state.relics, item.id as RelicId],
      shopItems: state.shopItems.filter(i => i.id !== itemId),
    };
  }

  return {
    ...state,
    money: newMoney,
    consumables: [...state.consumables, item.id as ConsumableId],
    shopItems: state.shopItems.filter(i => i.id !== itemId),
  };
}
