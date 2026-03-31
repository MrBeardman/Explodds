// ─── Tile ─────────────────────────────────────────────────────────────────────

export type SymbolId = 'diamond' | 'cherry' | 'banana' | 'star' | 'bell' | 'coin';

export type TileState =
  | 'hidden'    // face down, nothing known
  | 'hinted'    // safe, revealed by a tool — still clickable for points
  | 'revealed'  // player clicked it (or bomb exploded)
  | 'defused';  // bomb tile neutralised by Defuser consumable

export interface Tile {
  id: number;
  isBomb: boolean;
  symbol: SymbolId | null; // null for bombs; pre-assigned at grid generation
  state: TileState;
  isDefused: boolean;
  placedConsumable: ConsumableId | null; // consumable pre-placed in placement phase
}

// ─── Items ────────────────────────────────────────────────────────────────────

export type RelicId =
  | 'greed_chip'
  | 'adrenaline_core'
  | 'safety_net'
  | 'double_down'
  | 'dead_mans_hand'
  | 'cartographer'
  | 'chain_reaction'
  | 'gem_cutter'
  | 'bell_choir'
  | 'star_collector'
  | 'lucky_streak'
  | 'banana_republic';

export type ConsumableId =
  | 'scatter_reveal'
  | 'scanner'
  | 'defuser'
  | 'multiplier_lens'
  | 'lucky_charm'
  | 'magnet'
  | 'extra_life'
  | 'reroll_shop';

export type EventCardId =
  | 'hot_streak'
  | 'danger_pay'
  | 'cherry_season'
  | 'banana_bonanza'
  | 'star_shower'
  | 'bell_ringer'
  | 'safe_zone'
  | 'greed_mode'
  | 'coin_rush'
  | 'steady_hands'
  | 'lucky_scout'
  | 'high_roller';

// ─── Shop items ───────────────────────────────────────────────────────────────

export interface ShopConsumableItem {
  id: ConsumableId;
  name: string;
  price: number; // cash
  description: string;
  emoji: string;
  sold: boolean;
}

export interface ShopRelicItem {
  id: RelicId;
  name: string;
  cost: number; // gems
  description: string;
  emoji: string;
  sold: boolean;
  owned: boolean;
}

// ─── Round summary ────────────────────────────────────────────────────────────

export interface RoundSummaryData {
  won: boolean;        // cashed out = true, bomb hit = false
  round: number;
  isBoss: boolean;
  score: number;
  bet: number;
  payout: number;      // 0 if bomb
  netGain: number;     // payout - bet (negative if bomb)
  cashoutMult: number;
  gemsEarned: number;
  tilesCleared: number;
  totalSafeTiles: number;
  multiplierReached: number;
  starBonus: number;       // flat $ from stars
  cherryCombo: boolean;    // 3+ in a row achieved
  bananaBonus: number;     // extra pts from adjacent bananas
  luckyCharmBonus: number; // flat $ from lucky charms
}

// ─── Game phases ──────────────────────────────────────────────────────────────

export type GamePhase =
  | 'start'
  | 'event_card'
  | 'bet'
  | 'consumable_placement'
  | 'playing'
  | 'round_summary'
  | 'shop'
  | 'boss_reward'
  | 'gameover'
  | 'win';

// ─── Full game state ──────────────────────────────────────────────────────────

export interface GameState {
  // Meta
  phase: GamePhase;
  seed: number; // displayed on end screen so players can share runs

  // Run-persistent resources
  cash: number;
  gems: number;
  lives: number;
  maxLives: number;
  relics: RelicId[];
  consumables: ConsumableId[]; // owned, not yet placed/used

  // Run tracking (for end screen & run tokens)
  round: number;        // 1-6
  roundsCleared: number;
  bossRoundsCleared: number;
  totalTilesCleared: number;
  bestMultiplier: number;
  totalCashEarned: number;
  runTokens: number;

  // Run-scoped flags
  safetyNetUsed: boolean; // Safety Net relic (one per run)

  // Current round
  bet: number;
  score: number;
  multiplier: number;
  streakMeter: number;         // 0–100
  streakGuaranteed: boolean;   // next click is guaranteed safe + 3×
  bellsThisStreak: number;     // for Bell Choir relic (every 3 bells → instant fill)
  consecutiveClears: number;   // for Chain Reaction relic
  clearsSinceMagnet: number;   // for Magnet consumable
  canCashout: boolean;
  multiplierLensCount: number; // tiles remaining with 2× points from Multiplier Lens

  // Round symbol tracking
  starsThisRound: number;
  cherriesRevealed: number[];  // tile indices revealed
  bananasRevealed: number[];
  coinsThisRound: number;
  gemsThisRound: number;
  tilesCleared: number;
  luckyCharmBonus: number;     // flat $ accumulator from Lucky Charm consumable
  steadyHandsUsed: boolean;    // Steady Hands event card (once per round)

  // Event cards
  eventCardOptions: EventCardId[];   // 3 drawn for this round
  activeEventCard: EventCardId | null;
  lastEventCard: EventCardId | null; // prevents immediate repeat

  // Grid
  grid: Tile[];
  gridKey: number;
  isBossRound: boolean;

  // Consumable placement phase
  placementQueue: ConsumableId[];  // consumables awaiting placement
  placingIndex: number;            // index into placementQueue (-1 = done)

  // Scanner (used during playing phase)
  pendingScannerAxis: 'row' | 'col' | null;

  // Shop
  shopConsumables: ShopConsumableItem[];
  shopRelics: ShopRelicItem[];
  shopRerollUsed: boolean;
  relicRerollUsed: boolean;

  // Boss reward (shown after cashing out a boss round)
  bossRewardOptions: RelicId[];

  // Round summary (populated at round end)
  roundSummary: RoundSummaryData | null;
}
