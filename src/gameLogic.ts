import {
  GRID_SIZE, GRID_COLS, SYMBOLS, ALL_CONSUMABLES, ALL_RELICS,
  STARTING_WALLET, MAX_SHOP_ITEMS, PLACEABLE_CONSUMABLES, EVENT_CARDS,
  calcDeadline, calcBombs, calcTileBaseCash,
} from './constants';
import type {
  GameState, Tile, TileType, TileState, SymbolId,
  EventCardId, ComboDisplay,
  ShopConsumableItem, ShopRelicItem,
} from './types';
import { mulberry32, weightedChoice, rngShuffle, newSeed } from './rng';

// ─── Symbol weight table (event card modifiers) ───────────────────────────────

function getSymbolWeights(
  event: EventCardId | null,
): Array<{ id: SymbolId; weight: number }> {
  return SYMBOLS.map(s => {
    let w = s.weight;
    if (event === 'cherry_season'  && s.id === 'cherry')  w *= 2;
    if (event === 'banana_bonanza' && s.id === 'banana')  w *= 2;
    if (event === 'star_shower'    && s.id === 'star')    w *= 2;
    if (event === 'coin_rush'      && s.id === 'coin')    w *= 2;
    return { id: s.id, weight: w };
  });
}

// ─── Board generation ─────────────────────────────────────────────────────────

export function generateBoard(state: GameState): Tile[] {
  // Derive a deterministic-ish seed per attempt
  const attemptKey = (3 - state.attempts_remaining) + 1;
  const rng = mulberry32(state.seed + state.cycle_number * 1000 + attemptKey * 100);

  const bombCount = state.bombs_this_attempt;
  const remaining = GRID_SIZE - bombCount;

  // Compute empty count
  let emptyCount: number;
  const isLuckyBoard = state.active_event === 'lucky_board' && !state.lucky_board_used;
  if (isLuckyBoard) {
    emptyCount = 0;
  } else {
    let base = Math.round(remaining * 0.45);
    if (state.active_event === 'safe_zone')            base = Math.max(0, base - 4);
    if (state.relics.includes('safe_digger'))          base = Math.max(0, base - 3);
    if (state.consumables_owned.includes('empty_eraser')) base = Math.max(0, base - 2);
    emptyCount = base;
  }
  const symbolCount = remaining - emptyCount;

  // Build & shuffle tile type assignments
  const types: TileType[] = [
    ...Array(bombCount).fill('bomb'),
    ...Array(symbolCount).fill('symbol'),
    ...Array(emptyCount).fill('empty'),
  ] as TileType[];
  const shuffled = rngShuffle(rng, Array.from({ length: GRID_SIZE }, (_, i) => i));

  const tiles: Tile[] = Array.from({ length: GRID_SIZE }, (_, i) => ({
    index: i,
    state: 'hidden' as TileState,
    type: 'empty' as TileType,
    symbol: null,
    consumable: null,
    combo_highlight: false,
  }));

  // Assign types: shuffled[i] gets types[i]
  for (let i = 0; i < GRID_SIZE; i++) {
    tiles[shuffled[i]].type = types[i];
  }

  // Assign symbols to symbol tiles
  const weights = getSymbolWeights(state.active_event);
  for (const tile of tiles) {
    if (tile.type === 'symbol') {
      tile.symbol = weightedChoice(rng, weights);
    }
  }

  // Lucky Charm relic: guarantee one coin tile (replace a non-bomb non-coin tile)
  if (state.relics.includes('lucky_charm')) {
    const candidates = tiles.filter(t => t.type !== 'bomb' && t.symbol !== 'coin');
    if (candidates.length > 0) {
      const pick = candidates[Math.floor(rng() * candidates.length)];
      pick.type = 'symbol';
      pick.symbol = 'coin';
    }
  }

  // Scatter Reveal: hint 3 safe (non-bomb) tiles
  if (state.consumables_owned.includes('scatter_reveal')) {
    const safeTiles = tiles.filter(t => t.type !== 'bomb');
    const picks = rngShuffle(rng, safeTiles).slice(0, 3);
    picks.forEach(t => { tiles[t.index].state = 'hinted'; });
  }

  return tiles;
}

// ─── Combo helpers ────────────────────────────────────────────────────────────

function hasCherryRowCol(cherryIndices: number[]): boolean {
  const s = new Set(cherryIndices);
  for (let r = 0; r < 5; r++) {
    let n = 0;
    for (let c = 0; c < 5; c++) {
      n = s.has(r * 5 + c) ? n + 1 : 0;
      if (n >= 3) return true;
    }
  }
  for (let c = 0; c < 5; c++) {
    let n = 0;
    for (let r = 0; r < 5; r++) {
      n = s.has(r * 5 + c) ? n + 1 : 0;
      if (n >= 3) return true;
    }
  }
  return false;
}

function hasAdjacentBananas(bananaIndices: number[]): boolean {
  const s = new Set(bananaIndices);
  for (const idx of bananaIndices) {
    const c = idx % 5;
    if (c < 4 && s.has(idx + 1)) return true;
    if (idx + 5 < GRID_SIZE && s.has(idx + 5)) return true;
  }
  return false;
}

// ─── Magnet: nearest safe hidden tile ────────────────────────────────────────

function magnetReveal(board: Tile[], lastIdx: number): number | null {
  const candidates = board
    .filter(t => t.type !== 'bomb' && (t.state === 'hidden' || t.state === 'hinted'))
    .map(t => ({
      id: t.index,
      dist: Math.abs(Math.floor(t.index / 5) - Math.floor(lastIdx / 5))
          + Math.abs((t.index % 5) - (lastIdx % 5)),
    }))
    .sort((a, b) => a.dist - b.dist);
  return candidates[0]?.id ?? null;
}

// ─── Tile click handler ───────────────────────────────────────────────────────

export function handleTileClick(state: GameState, tileIndex: number): GameState {
  if (state.phase !== 'CLEARING') return state;

  const tile = state.board[tileIndex];
  if (tile.state === 'revealed' || tile.state === 'bomb_hit' || tile.state === 'empty_revealed') return state;

  // Scanner mode
  if (state.pending_scanner_axis !== null) {
    return applyScanner(state, tileIndex);
  }

  const newBoard = state.board.map(t => ({ ...t }));

  // ── Bomb ──────────────────────────────────────────────────────────────────

  if (tile.type === 'bomb') {
    // Defuser: neutralise bomb
    if (tile.consumable === 'defuser') {
      newBoard[tileIndex].state = 'empty_revealed';
      newBoard[tileIndex].type = 'empty';
      return { ...state, board: newBoard };
    }

    // Bomb Suit relic: first bust refunds bet
    let newWallet = state.wallet;
    if (state.relics.includes('bomb_suit') && !state.bomb_suit_used) {
      newWallet += state.current_bet;
    }

    newBoard[tileIndex].state = 'bomb_hit';
    const newAttempts = state.attempts_remaining - 1;

    return {
      ...state,
      board: newBoard,
      phase: 'BUST_FLASH',
      wallet: newWallet,
      attempts_remaining: newAttempts,
      bomb_suit_used: state.relics.includes('bomb_suit') ? true : state.bomb_suit_used,
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
    };
  }

  // ── Empty tile ────────────────────────────────────────────────────────────

  if (tile.type === 'empty') {
    newBoard[tileIndex].state = 'empty_revealed';
    return {
      ...state,
      board: newBoard,
      streak: 0,
      streak_5_given: false,
      streak_10_given: false,
      streak_15_given: false,
    };
  }

  // ── Symbol tile ───────────────────────────────────────────────────────────

  const symbol = tile.symbol!;
  newBoard[tileIndex].state = 'revealed';

  // Base cash
  const baseCash = calcTileBaseCash(state.current_bet);
  let symbolMod = getSymbolMod(symbol, state.active_event);
  let cash = baseCash * symbolMod * state.multiplier;

  // Danger Pay event: tile value ×1.4
  if (state.active_event === 'danger_pay') cash *= 1.4;

  // Lucky Tile consumable on this specific tile
  let luckyBonus = 0;
  if (tile.consumable === 'lucky_tile') luckyBonus = 5;

  cash = parseFloat(cash.toFixed(2));

  // Banana tracking for Banana Split retroactive calc
  const newBananaEarnings = symbol === 'banana'
    ? [...state.banana_tile_earnings, cash]
    : state.banana_tile_earnings;

  // Multiplier growth
  const baseGain = 0.08 + state.bombs_this_attempt * 0.01;
  const multGain = state.relics.includes('adrenaline_core') ? baseGain * 1.2 : baseGain;
  let newMult = parseFloat((state.multiplier + multGain).toFixed(3));

  // Streak
  let newStreak = state.streak + 1;
  let s5 = state.streak_5_given;
  let s10 = state.streak_10_given;
  let s15 = state.streak_15_given;
  let streakBonus = 0;

  if (newStreak >= 5 && !s5) {
    if (state.relics.includes('hot_hands')) {
      streakBonus += 8;          // Hot Hands: flat cash instead of mult boost
    } else {
      newMult = parseFloat((newMult + 0.2).toFixed(3));
    }
    s5 = true;
  }
  if (newStreak >= 10 && !s10) {
    newMult = parseFloat((newMult + 0.5).toFixed(3));
    s10 = true;
  }
  if (newStreak >= 15 && !s15) {
    streakBonus += 5;
    s15 = true;
  }

  const newTilesCleared = state.tiles_cleared + 1;

  // Tile Magnet: auto-reveal nearest safe every 5 clears
  let newMagnetClears = state.magnet_clears + 1;
  if (state.consumables_owned.includes('tile_magnet') && newMagnetClears >= 5) {
    newMagnetClears = 0;
    const target = magnetReveal(newBoard, tileIndex);
    if (target !== null) newBoard[target].state = 'hinted';
  }

  // Earnings so far (before combo checks)
  let newEarnings = state.attempt_earnings + cash + luckyBonus + streakBonus;
  let newTickets = state.tickets;

  // ── Combo checks ──────────────────────────────────────────────────────────
  const triggered = [...state.combos_triggered];
  const display: ComboDisplay[] = [...state.active_combo_display];
  let comboId = state.combo_id_counter;
  let bellStormStreak: number | null = null;

  // Cherry Rush
  if (!triggered.includes('cherry_rush')) {
    const cherryIdxs = newBoard
      .filter(t => t.state === 'revealed' && t.symbol === 'cherry')
      .map(t => t.index);
    if (hasCherryRowCol(cherryIdxs)) {
      const reward = state.relics.includes('cherry_picker') ? 20 : 12;
      newEarnings += reward;
      triggered.push('cherry_rush');
      display.push({ text: '🍒 CHERRY RUSH!', amount: `+$${reward}`, color: '#ff6b6b', id: comboId++ });
    }
  }

  // Banana Split
  if (!triggered.includes('banana_split')) {
    const bananaIdxs = newBoard
      .filter(t => t.state === 'revealed' && t.symbol === 'banana')
      .map(t => t.index);
    if (hasAdjacentBananas(bananaIdxs)) {
      const mult = state.relics.includes('banana_baron') ? 3 : 2;
      const bonusAmt = newBananaEarnings.reduce((s, e) => s + e * (mult - 1), 0);
      newEarnings += parseFloat(bonusAmt.toFixed(2));
      triggered.push('banana_split');
      display.push({ text: '🍌 BANANA SPLIT!', amount: `×${mult}`, color: '#ffd93d', id: comboId++ });
      // Highlight banana tiles
      for (const bi of bananaIdxs) newBoard[bi].combo_highlight = true;
    }
  }

  // Star Power
  if (!triggered.includes('star_power')) {
    const starCount = newBoard.filter(t => t.state === 'revealed' && t.symbol === 'star').length;
    if (starCount >= 3) {
      const reward = state.relics.includes('star_magnet') ? 28 : 18;
      newEarnings += reward;
      triggered.push('star_power');
      display.push({ text: '⭐ STAR POWER!', amount: `+$${reward}`, color: '#ffe66d', id: comboId++ });
    }
  }

  // Bell Storm
  if (!triggered.includes('bell_storm')) {
    const bellCount = newBoard.filter(t => t.state === 'revealed' && t.symbol === 'bell').length;
    const threshold = state.active_event === 'bell_ringer' ? 3 : 4;
    if (bellCount >= threshold) {
      const stormStreak = state.relics.includes('bell_captain') ? 20 : 10;
      bellStormStreak = stormStreak;
      triggered.push('bell_storm');
      display.push({ text: '🔔 BELL STORM!', amount: `STREAK ×${stormStreak}`, color: '#60a5fa', id: comboId++ });
    }
  }

  // Diamond Run
  if (!triggered.includes('diamond_run')) {
    const diaCount = newBoard.filter(t => t.state === 'revealed' && t.symbol === 'diamond').length;
    if (diaCount >= 4) {
      const pct = state.relics.includes('diamond_dealer') ? 0.25 : 0.15;
      const bonus = parseFloat((newEarnings * pct).toFixed(2));
      newEarnings += bonus;
      triggered.push('diamond_run');
      display.push({ text: '💎 DIAMOND RUN!', amount: `+${Math.round(pct * 100)}%`, color: '#22d3ee', id: comboId++ });
    }
  }

  // Coin Jackpot
  if (!triggered.includes('coin_jackpot')) {
    const coinCount = newBoard.filter(t => t.state === 'revealed' && t.symbol === 'coin').length;
    if (coinCount >= 2) {
      const base = state.relics.includes('coin_tycoon') ? 8 : 4;
      const reward = state.active_event === 'coin_rush' ? 6 : base;
      newTickets += reward;
      triggered.push('coin_jackpot');
      display.push({ text: '🪙 COIN JACKPOT!', amount: `+${reward}🎫`, color: '#f0f0f0', id: comboId++ });
    }
  }

  const finalStreak = bellStormStreak !== null ? bellStormStreak : newStreak;
  const newHighMult = Math.max(state.highest_multiplier, newMult);
  const newBestStreak = Math.max(state.best_streak, finalStreak);

  return {
    ...state,
    board: newBoard,
    attempt_earnings: parseFloat(newEarnings.toFixed(2)),
    multiplier: newMult,
    streak: finalStreak,
    streak_5_given: s5,
    streak_10_given: s10,
    streak_15_given: s15,
    banana_tile_earnings: newBananaEarnings,
    tiles_cleared: newTilesCleared,
    magnet_clears: newMagnetClears,
    tickets: newTickets,
    combos_triggered: triggered,
    active_combo_display: display,
    combo_id_counter: comboId,
    highest_multiplier: newHighMult,
    best_streak: newBestStreak,
  };
}

function getSymbolMod(symbol: SymbolId, event: EventCardId | null): number {
  const mods: Record<SymbolId, number> = {
    diamond: 1.0,
    cherry: 0.8,
    banana: 1.2,
    star: event === 'star_shower' ? 1.5 * 1.5 : 1.5,
    bell: 0.9,
    coin: 2.0,
  };
  return mods[symbol];
}

// ─── Scanner ──────────────────────────────────────────────────────────────────

function applyScanner(state: GameState, tileIndex: number): GameState {
  const axis = state.pending_scanner_axis!;
  const row = Math.floor(tileIndex / GRID_COLS);
  const col = tileIndex % GRID_COLS;

  const newBoard = state.board.map((t) => {
    const tRow = Math.floor(t.index / GRID_COLS);
    const tCol = t.index % GRID_COLS;
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

// ─── Cashout ──────────────────────────────────────────────────────────────────

export function handleCashout(state: GameState): GameState {
  let earnings = state.attempt_earnings;

  // Greed Mode: +30% on cashout
  if (state.active_event === 'greed_mode') {
    earnings = parseFloat((earnings * 1.3).toFixed(2));
  }

  // Greed Chip relic: +$3 flat
  if (state.relics.includes('greed_chip')) earnings += 3;

  const newWallet = parseFloat((state.wallet + earnings).toFixed(2));
  const newDeposited = parseFloat((state.deposited + earnings).toFixed(2));
  const newTotalEarned = parseFloat((state.total_earned + earnings).toFixed(2));

  // Ticket awards
  let ticketBonus = 2; // always +2 on cashout
  if (earnings > state.current_bet * 1.5) ticketBonus += 3; // profitable clear
  const newTickets = state.tickets + ticketBonus;

  const newAttempts = state.attempts_remaining - 1;

  const baseState: Partial<GameState> = {
    wallet: newWallet,
    deposited: newDeposited,
    tickets: newTickets,
    total_earned: newTotalEarned,
    attempts_remaining: newAttempts,
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
    consumables_placed: [],
    pending_scanner_axis: null,
    board: [],
  };

  if (newAttempts > 0) {
    return { ...state, ...baseState, phase: 'BET' };
  } else {
    return endCycleCheck({ ...state, ...baseState } as GameState);
  }
}

// ─── End-of-cycle check ───────────────────────────────────────────────────────

export function endCycleCheck(state: GameState): GameState {
  if (state.wallet >= state.deadline) {
    const afterDeadline = parseFloat((state.wallet - state.deadline).toFixed(2));

    // Interest bonus: leftover > 30% of deadline
    let interestBonus = 0;
    if (afterDeadline > state.deadline * 0.3) {
      interestBonus = Math.floor(afterDeadline * 0.15);
    }

    const shop = generateShop(state);

    return {
      ...state,
      wallet: afterDeadline + interestBonus,
      deposited: 0,
      phase: 'SHOP',
      cycles_survived: state.cycles_survived + 1,
      shop_consumables: shop.consumables,
      shop_relics: shop.relics,
      shop_consumables_rerolled: false,
      shop_relics_rerolled: false,
    };
  }

  return { ...state, phase: 'GAME_OVER' };
}

// ─── Start attempt (from BET phase → generate board) ─────────────────────────

export function handlePlaceBet(state: GameState): GameState {
  const bet = state.current_bet;
  const newWallet = parseFloat((state.wallet - bet).toFixed(2));

  if (newWallet < 0) {
    return { ...state, wallet: 0, phase: 'GAME_OVER' };
  }

  const bombs = calcBombs(bet, state.wallet, state.cycle_number);

  // Hot Streak: start with streak 5
  const initialStreak = state.active_event === 'hot_streak' ? 5 : 0;
  const initialS5 = state.active_event === 'hot_streak';

  // Danger Pay: +3 extra bombs
  const totalBombs = state.active_event === 'danger_pay'
    ? Math.min(bombs + 3, 24)
    : bombs;

  const nextState: GameState = {
    ...state,
    wallet: newWallet,
    bombs_this_attempt: totalBombs,
    attempt_earnings: 0,
    multiplier: 1.0,
    streak: initialStreak,
    streak_5_given: initialS5,
    streak_10_given: false,
    streak_15_given: false,
    banana_tile_earnings: [],
    tiles_cleared: 0,
    magnet_clears: 0,
    combos_triggered: [],
    active_combo_display: [],
    consumables_placed: [],
    pending_scanner_axis: null,
    lucky_board_used: state.active_event === 'lucky_board' ? true : state.lucky_board_used,
  };

  const board = generateBoard(nextState);

  // Remove auto-used consumables
  const newConsumables = state.consumables_owned.filter(
    c => c !== 'scatter_reveal' && c !== 'empty_eraser'
  );

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
    return { ...state, phase: 'BET', board: [] };
  }
  return endCycleCheck(state);
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
    ALL_RELICS.map(r => ({
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

export function rerollRelics(state: GameState): ShopRelicItem[] {
  const rng = mulberry32(state.seed + state.cycle_number * 777 + 1999);
  return rngShuffle(
    rng,
    ALL_RELICS.map(r => ({ ...r, owned: state.relics.includes(r.id), sold: false }))
  )
    .filter(r => !r.owned)
    .slice(0, MAX_SHOP_ITEMS);
}

// ─── Next cycle ───────────────────────────────────────────────────────────────

export function startNextCycle(state: GameState): GameState {
  const nextCycle = state.cycle_number + 1;
  const nextDeadline = calcDeadline(nextCycle);
  const eventOptions = drawEventCards(state, nextCycle);

  return {
    ...state,
    phase: 'EVENT_CARD',
    cycle_number: nextCycle,
    deadline: nextDeadline,
    deposited: 0,
    attempts_remaining: 3,
    bomb_suit_used: false,
    lucky_board_used: false,
    active_event: null,
    event_card_options: eventOptions,
    current_bet: 10,
    attempt_earnings: 0,
    multiplier: 1.0,
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
    consumables_placed: [],
    placement_queue: [],
    placing_index: -1,
    pending_scanner_axis: null,
  };
}

// ─── Event card draw ──────────────────────────────────────────────────────────

export function drawEventCards(state: GameState, forCycle?: number): EventCardId[] {
  const rng = mulberry32(state.seed + (forCycle ?? state.cycle_number) * 333);
  const pool = EVENT_CARDS.map(c => c.id);
  return rngShuffle(rng, pool).slice(0, 3) as EventCardId[];
}

// ─── Initial state ────────────────────────────────────────────────────────────

export function createInitialState(): GameState {
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
    streak: 0,
    streak_5_given: false,
    streak_10_given: false,
    streak_15_given: false,
    banana_tile_earnings: [],
    tiles_cleared: 0,
    magnet_clears: 0,
    board: [],
    bombs_this_attempt: 0,
    lucky_board_used: false,
    combos_triggered: [],
    active_combo_display: [],
    combo_id_counter: 1,
    active_event: null,
    event_card_options: [],
    relics: [],
    consumables_owned: [],
    consumables_placed: [],
    placement_queue: [],
    placing_index: -1,
    pending_scanner_axis: null,
    shop_consumables: [],
    shop_relics: [],
    shop_consumables_rerolled: false,
    shop_relics_rerolled: false,
    cycles_survived: 0,
    total_earned: 0,
    highest_multiplier: 1.0,
    best_streak: 0,
    seed: newSeed(),
  };
}

// ─── Utility ──────────────────────────────────────────────────────────────────

export function removeOne<T>(arr: T[], val: T): T[] {
  const i = arr.indexOf(val);
  return i === -1 ? arr : [...arr.slice(0, i), ...arr.slice(i + 1)];
}
