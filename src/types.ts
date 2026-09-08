// ─── Tile ─────────────────────────────────────────────────────────────────────

export type SymbolId = 'diamond' | 'cherry' | 'banana' | 'star' | 'bell';
export type TileType = 'symbol' | 'empty' | 'bomb';
export type TileState = 'hidden' | 'hinted' | 'flagged' | 'revealed' | 'bomb_hit' | 'empty_revealed';

export interface Tile {
  index: number;
  state: TileState;
  type: TileType;
  symbol: SymbolId | null;
  consumable: ConsumableId | null;
  combo_highlight: boolean;
  proven: boolean;                // clicked while provably safe — deduction feedback
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
  | 'safe_digger'
  | 'bomb_suit'
  | 'hot_hands'
  | 'lucky_charm'
  | 'ticket_printer'
  | 'haggler'
  | 'surveyor'
  | 'head_start'
  | 'compound_chip'
  | 'momentum_core'
  | 'insurance_policy'
  | 'high_roller'
  | 'bombproof_boots'
  | 'synergist'
  | 'ledger'
  | 'logician'
  | 'gut_feeling'
  | 'echo'
  | 'second_sight'
  | 'cartographer'
  | 'double_down'
  | 'loaded_dice'
  | 'vault'
  | 'chain_reaction'
  | 'specialist';

export type Rarity = 'common' | 'rare' | 'legendary';

export type ConsumableId =
  | 'scatter_reveal'
  | 'scanner'
  | 'defuser'
  | 'tile_magnet'
  | 'lucky_tile'
  | 'empty_eraser'
  | 'bomb_detector'
  | 'insurance_ticket'
  | 'probe'
  | 'mult_vial';

export type BossId =
  | 'monoculturist'
  | 'saboteur'
  | 'blackout'
  | 'taxman'
  | 'glutton'
  | 'short_fuse'
  | 'warden'
  | 'inflator'
  | 'blightbringer'
  | 'liar'
  | 'mirror'
  | 'curfew'
  | 'mason';

export type EventCardId =
  | 'hot_streak'
  | 'cherry_season'
  | 'banana_bonanza'
  | 'star_shower'
  | 'safe_zone'
  | 'danger_pay'
  | 'bell_ringer'
  | 'lucky_board'
  | 'greed_mode';

// ─── Meta-progression (persists across runs — see src/meta.ts) ───────────────

export type SkillId = 'cascade' | 'bomb_flag';

// ─── Symbol boosts (packs) ────────────────────────────────────────────────────

export type BoostAxis = 'frequency' | 'payout';

export interface SymbolBoost {
  symbol: SymbolId;
  axis: BoostAxis;
}

// ─── Game phases ──────────────────────────────────────────────────────────────

export type GamePhase =
  | 'START'
  | 'EVENT_CARD'
  | 'BOSS_INTRO'
  | 'BET'
  | 'PLACEMENT'
  | 'CLEARING'
  | 'BUST_FLASH'
  | 'RESULTS'
  | 'SHOP'
  | 'GAME_OVER';

// ─── Run feats (for cross-run unlocks) ────────────────────────────────────────

export interface RunStats {
  perfect_clear_best_cycle: number; // highest cycle a Perfect Clear happened on (0 = never)
  best_flawless_proven: number;     // most proven clicks in a zero-guess attempt
  bosses_beaten: number;
}

// ─── Cashout results breakdown ────────────────────────────────────────────────
//
// Built by handleCashout, shown by the RESULTS phase overlay before the
// (already-computed) phase transition in `pending_next_phase` is applied.

export interface ResultLine {
  label: string;
  amount: number;
}

export interface ResultsBreakdown {
  cashLines: ResultLine[];
  ticketLines: ResultLine[];
  cashTotal: number;
  ticketTotal: number;
  walletBefore: number;
  walletAfter: number;
  ticketsBefore: number;
  ticketsAfter: number;
}

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
  rarity: Rarity;
  sold: boolean;
  owned: boolean;
}

export type ShopPackKind = 'frequency' | 'payout' | 'themed';

// One unified pack slot — kind is rolled randomly per slot per shop visit.
// 'frequency'/'payout' slots reveal 3 (or 5, if `huge`) distinct-symbol
// candidates to pick one from; 'themed' slots skip the reveal entirely and
// grant BOTH a frequency and a payout stack on the fixed `symbol` at once.
export interface ShopPackSlot {
  kind: ShopPackKind;
  symbol: SymbolId | null; // only set when kind === 'themed'
  huge: boolean;           // frequency/payout only: 5 reveal choices instead of 3
  price: number;
  sold: boolean;
}

export interface ShopRelicCaseItem {
  price: number;
  sold: boolean;
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
  carry_multiplier: number;      // Momentum Core: mult carried from previous attempt this cycle
  clicks_this_attempt: number;   // Bombproof Boots: first-click detection
  streak: number;
  streak_5_given: boolean;
  streak_10_given: boolean;
  streak_15_given: boolean;
  banana_tile_earnings: number[]; // for Banana Split retroactive ×2
  tiles_cleared: number;
  magnet_clears: number;          // clears since last tile_magnet trigger
  player_flags: number[];         // Bomb Sense skill: tile indices guessed as bombs this attempt
  flag_mode: boolean;             // toggled via FLAG button — next tile click flags instead of reveals
  deduction_streak: number;       // consecutive PROVEN-safe clicks this attempt (a guess resets it)
  proven_clicks: number;          // proven-safe clicks this attempt (Flawless ticket bonus)
  guess_clicks: number;           // unproven clicks this attempt
  gut_feeling_used: boolean;      // Gut Feeling relic: first guess each attempt is bomb-proof, once
  last_attempt_busted: boolean;   // Echo relic: the previous attempt ended on a bomb
  pending_probe: boolean;         // Probe consumable armed — next tile click tests instead of reveals

  // Board
  board: Tile[];
  board_cols: number;             // 5 → 6 → 7 as cycles advance (calcBoardCols); board.length === cols²
  bombs_this_attempt: number;
  lucky_board_used: boolean;      // Lucky Board event: first attempt no empties

  // Combos
  combos_triggered: string[];
  active_combo_display: ComboDisplay[];
  combo_id_counter: number;

  // Modifiers. active_events is the DERIVED union of traits + cycle_events —
  // every gameplay check reads it; only selectEventCard/startNextCycle write it.
  active_events: EventCardId[];
  traits: EventCardId[];          // permanent for the run (a card picked twice), max MAX_TRAITS
  cycle_events: EventCardId[];    // this cycle's pick(s) only
  event_history: EventCardId[];   // picked once so far — picking again promotes to a trait
  active_boss: BossId | null;    // set on boss cycles (every 3rd)
  event_card_options: EventCardId[];
  relics: RelicId[];
  consumables_owned: ConsumableId[];
  consumables_placed: { tile_index: number; type: ConsumableId }[];
  placement_queue: ConsumableId[];
  placing_index: number;
  pending_scanner_axis: 'row' | 'col' | null;
  boosts: SymbolBoost[];         // permanent symbol boosts from packs
  max_relic_slots: number;       // base MAX_ACTIVE_RELICS + Relic Case purchases
  skills: Record<SkillId, number>; // snapshot of meta-progression skill levels, taken at run start
  unlocked_relics: RelicId[];      // snapshot of cross-run unlocks (meta.ts) — gates the shop pool
  is_daily: boolean;               // seeded daily run (same seed for everyone today)
  run_stats: RunStats;             // feats tracked for unlocks (meta.ts UNLOCKABLES)

  // Shop
  interest_earned_this_cycle: number; // accumulated interest ticks (for shop display)
  packs_opened: number;               // drives pack price scaling (shared by themed packs)
  relic_cases_bought: number;         // drives Relic Case price scaling
  pending_pack_choices: SymbolBoost[] | null;
  pending_pack_picks_remaining: number; // huge packs: 2 picks before the reveal clears; normal: 1
  shop_consumables: ShopConsumableItem[];
  shop_relics: ShopRelicItem[];
  shop_packs: ShopPackSlot[];          // 3 slots per shop visit, kind rolled per slot
  shop_relic_case: ShopRelicCaseItem | null;   // null once max bonus slots reached
  shop_consumables_rerolled: boolean;
  shop_relics_rerolled: boolean;
  shop_packs_rerolled: boolean;

  // Results overlay (shown after every cashout, before advancing)
  pending_results: ResultsBreakdown | null;
  pending_next_phase: GamePhase | null;

  // Run stats
  cycles_survived: number;
  total_earned: number;
  highest_multiplier: number;
  best_streak: number;
  seed: number;

  // Debug/testing overrides — never touched by normal play
  debug_bomb_override: number | null; // forces bombs_this_attempt on the next board dealt
}
