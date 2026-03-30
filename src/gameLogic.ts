import { GRID_SIZE, GRID_COLS, LEVELS, BASE_TILE_POINTS, ALL_SHOP_ITEMS, STARTING_LIVES } from './constants';
import type { GameState, Tile, RelicId, ConsumableId, ShopItem } from './types';

// ─── Grid Generation ──────────────────────────────────────────────────────────

export function generateGrid(
  bombCount: number,
  relics: RelicId[],
  consumables: ConsumableId[]
): Tile[] {
  const tiles: Tile[] = Array.from({ length: GRID_SIZE }, (_, i) => ({
    id: i,
    isBomb: false,
    state: 'hidden',
    isSafeRevealed: false,
    isDefused: false,
  }));

  // Cartographer: one corner tile forced safe (index 0 = top-left)
  const cartographerActive = relics.includes('cartographer');
  const corners = [0, 4, 20, 24];
  const cartographerCorner = cartographerActive ? corners[Math.floor(Math.random() * corners.length)] : -1;

  // Place bombs
  const bombableIndices = tiles.map((_, i) => i).filter(i => i !== cartographerCorner);
  const shuffled = bombableIndices.sort(() => Math.random() - 0.5);
  for (let i = 0; i < bombCount; i++) {
    tiles[shuffled[i]].isBomb = true;
  }

  // Reveal cartographer corner
  if (cartographerCorner >= 0) {
    tiles[cartographerCorner].state = 'revealed';
    tiles[cartographerCorner].isSafeRevealed = true;
  }

  // Apply Scatter Reveal consumable: reveal 3 random safe hidden tiles
  if (consumables.includes('scatter_reveal')) {
    const safeTiles = tiles.filter(t => !t.isBomb && t.state === 'hidden');
    const pick = safeTiles.sort(() => Math.random() - 0.5).slice(0, 3);
    pick.forEach(t => {
      tiles[t.id].state = 'revealed';
      tiles[t.id].isSafeRevealed = true;
    });
  }

  return tiles;
}

// ─── Multiplier Calculation ────────────────────────────────────────────────────

export function calcMultiplierGain(
  bombCount: number,
  safeTilesLeft: number,
  relics: RelicId[]
): number {
  // Base gain: 0.1 + bonus for more bombs on board
  const bombBonus = bombCount * 0.01;
  let gain = 0.1 + bombBonus;

  // Adrenaline Core: +25% faster when under 10 safe tiles left
  if (relics.includes('adrenaline_core') && safeTilesLeft < 10) {
    gain *= 1.25;
  }

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
  const bonus = Math.floor(overPercent * 10); // $1 per 10% over target

  let payout = basePayout + bonus;

  // Greed Chip: +$2 flat
  if (relics.includes('greed_chip')) payout += 2;

  // Double Down: clear 80%+ = double payout
  if (relics.includes('double_down') && tilesCleared / totalSafeTiles >= 0.8) {
    payout *= 2;
  }

  return payout;
}

// ─── Shop Generation ──────────────────────────────────────────────────────────

export function generateShopItems(ownedRelics: RelicId[]): ShopItem[] {
  // Filter out already owned relics
  const pool = ALL_SHOP_ITEMS.filter(
    item => !(item.type === 'relic' && ownedRelics.includes(item.id as RelicId))
  );
  const shuffled = pool.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 4);
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

  // Apply Multiplier Lens (from previous purchase — count is already set)
  return {
    ...state,
    phase: 'playing',
    score: 0,
    multiplier: 1.0,
    grid,
    canCashout: false,
    bombHitThisRound: false,
    pendingConsumable: null,
    defusedTiles: [],
    scannerAxis: null,
    // consumables are one-use; clear scatter_reveal and multiplier_lens after applying
    consumables: state.consumables.filter(
      c => c !== 'scatter_reveal'
    ),
  };
}

// ─── Tile Click Handler ───────────────────────────────────────────────────────

export function handleTileClick(state: GameState, tileIndex: number): GameState {
  const tile = state.grid[tileIndex];
  if (tile.state === 'revealed' || tile.state === 'defused') return state;
  if (state.phase !== 'playing') return state;

  // Handle pending consumable placement
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
    // Reveal entire row or column of the clicked tile
    const row = Math.floor(tileIndex / GRID_COLS);
    const col = tileIndex % GRID_COLS;
    const axis = state.scannerAxis ?? 'row';
    const newGrid = state.grid.map((t, i) => {
      const tRow = Math.floor(i / GRID_COLS);
      const tCol = i % GRID_COLS;
      const match = axis === 'row' ? tRow === row : tCol === col;
      if (match && t.state === 'hidden') {
        return { ...t, state: 'revealed' as const, isSafeRevealed: true };
      }
      return t;
    });
    return {
      ...state,
      grid: newGrid,
      pendingConsumable: null,
      scannerAxis: null,
      consumables: state.consumables.filter(c => c !== 'scanner'),
    };
  }

  // Normal tile click
  const newGrid = [...state.grid];

  if (tile.isBomb) {
    // Check defuser
    if (tile.isDefused || state.defusedTiles.includes(tileIndex)) {
      newGrid[tileIndex] = { ...tile, state: 'defused' };
      return { ...state, grid: newGrid };
    }

    // Dead Man's Hand: get 40% of score
    let bonusMoney = 0;
    if (state.relics.includes('dead_mans_hand') && state.score > 0) {
      bonusMoney = Math.floor(state.score * 0.4);
    }

    // Safety Net: first bomb doesn't cost a life
    const safetyNetActive = state.relics.includes('safety_net') && !state.safetyNetUsed;
    const newLives = safetyNetActive ? state.lives : state.lives - 1;

    newGrid[tileIndex] = { ...tile, state: 'revealed' };

    const newMoney = state.money + bonusMoney;
    const newTotalEarned = state.totalMoneyEarned + bonusMoney;

    if (newLives <= 0) {
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

    // Reset level (no payout)
    const nextGrid = generateGrid(
      LEVELS[state.level - 1].bombs,
      state.relics,
      state.consumables
    );
    return {
      ...state,
      grid: nextGrid,
      lives: newLives,
      money: newMoney,
      totalMoneyEarned: newTotalEarned,
      score: 0,
      multiplier: 1.0,
      canCashout: false,
      bombHitThisRound: true,
      safetyNetUsed: safetyNetActive ? true : state.safetyNetUsed,
      multiplierLensCount: 0,
    };
  }

  // Safe tile
  const levelConfig = LEVELS[state.level - 1];
  const safeTilesLeft = state.grid.filter(t => !t.isBomb && t.state === 'hidden').length;
  const multiplierGain = calcMultiplierGain(levelConfig.bombs, safeTilesLeft, state.relics);
  const newMultiplier = parseFloat((state.multiplier + multiplierGain).toFixed(3));

  // Points: base * multiplier, double if multiplier lens active
  let points = Math.round(BASE_TILE_POINTS * state.multiplier);
  let newLensCount = state.multiplierLensCount;
  if (newLensCount > 0) {
    points *= 2;
    newLensCount--;
  }

  const newScore = state.score + points;
  newGrid[tileIndex] = { ...tile, state: 'revealed' };

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

  // Multiplier Lens: if purchased in shop, count is set when entering level
  // Apply consumable multiplier_lens effect
  const lensCount = state.consumables.includes('multiplier_lens') ? 5 : state.multiplierLensCount;

  if (state.level >= 6) {
    // Win!
    return {
      ...state,
      money: newMoney,
      totalMoneyEarned: newTotalEarned,
      phase: 'gameover',
    };
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

  // Consumable
  return {
    ...state,
    money: newMoney,
    consumables: [...state.consumables, item.id as ConsumableId],
    shopItems: state.shopItems.filter(i => i.id !== itemId),
  };
}
