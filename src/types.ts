// ─── Tile ─────────────────────────────────────────────────────────────────────

export type SymbolId = 'diamond' | 'cherry' | 'banana' | 'star' | 'bell' | 'coin';
export type TileType = 'symbol' | 'empty' | 'bomb';
export type TileState = 'hidden' | 'hinted' | 'revealed' | 'bomb_hit' | 'empty_revealed';

export interface Tile {
  index: number;
  state: TileState;
  type: TileType;
  symbol: SymbolId | null;
  consumable: ConsumableId | null;
  combo_highlight: boolean;
}

// ─── Items ────────────────────────────────────────────────────────────────────

export type RelicId =
  | 'greed_chip'
  | 'adrenaline_core'
  | 'cherry_picker'
  | 'banana_baron'
  | 'star_magnet'
  | 'bell_captain'
  | 'diamond_dealer'
  | 'coin_tycoon'
  | 'safe_digger'
  | 'bomb_suit'
  | 'hot_hands'
  | 'lucky_charm';

export type ConsumableId =
  | 'scatter_reveal'
  | 'scanner'
  | 'defuser'
  | 'tile_magnet'
  | 'lucky_tile'
  | 'empty_eraser';

export type EventCardId =
  | 'hot_streak'
  | 'cherry_season'
  | 'banana_bonanza'
  | 'star_shower'
  | 'coin_rush'
  | 'safe_zone'
  | 'danger_pay'
  | 'bell_ringer'
  | 'lucky_board'
  | 'greed_mode';

// ─── Game phases ──────────────────────────────────────────────────────────────

export type GamePhase =
  | 'START'
  | 'EVENT_CARD'
  | 'BET'
  | 'PLACEMENT'
  | 'CLEARING'
  | 'BUST_FLASH'
  | 'SHOP'
  | 'GAME_OVER';

// ─── Shop items ───────────────────────────────────────────────────────────────

export interface ShopConsumableItem {
  id: ConsumableId;
  name: string;
  price: number;
  description: string;
  emoji: string;
  sold: boolean;
}

export interface ShopRelicItem {
  id: RelicId;
  name: string;
  cost: number;
  description: string;
  emoji: string;
  sold: boolean;
  owned: boolean;
}

// ─── Combo display notification ───────────────────────────────────────────────

export interface ComboDisplay {
  text: string;
  amount: string;
  color: string;
  id: number;
}

// ─── Full game state ──────────────────────────────────────────────────────────

export interface GameState {
  phase: GamePhase;

  // Economy
  wallet: number;
  tickets: number;

  // Cycle
  cycle_number: number;
  deadline: number;
  deposited: number;
  attempts_remaining: number;
  bomb_suit_used: boolean;       // resets each cycle

  // Current attempt
  current_bet: number;
  attempt_earnings: number;
  multiplier: number;
  streak: number;
  streak_5_given: boolean;
  streak_10_given: boolean;
  streak_15_given: boolean;
  banana_tile_earnings: number[]; // for Banana Split retroactive ×2
  tiles_cleared: number;
  magnet_clears: number;          // clears since last tile_magnet trigger

  // Board
  board: Tile[];
  bombs_this_attempt: number;
  lucky_board_used: boolean;      // Lucky Board event: first attempt no empties

  // Combos
  combos_triggered: string[];
  active_combo_display: ComboDisplay[];
  combo_id_counter: number;

  // Modifiers
  active_event: EventCardId | null;
  event_card_options: EventCardId[];
  relics: RelicId[];
  consumables_owned: ConsumableId[];
  consumables_placed: { tile_index: number; type: ConsumableId }[];
  placement_queue: ConsumableId[];
  placing_index: number;
  pending_scanner_axis: 'row' | 'col' | null;

  // Shop
  shop_consumables: ShopConsumableItem[];
  shop_relics: ShopRelicItem[];
  shop_consumables_rerolled: boolean;
  shop_relics_rerolled: boolean;

  // Run stats
  cycles_survived: number;
  total_earned: number;
  highest_multiplier: number;
  best_streak: number;
  seed: number;
}
