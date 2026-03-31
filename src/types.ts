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
  won: boolean;            // cashed out = true
  round: number;
  isBoss: boolean;
  score: number;           // final attempt score at cashout
  cumulativeScore: number; // total across all attempts this round
  bet: number;
  payout: number;
  cashoutMult: number;
  gemsEarned: number;
  tilesCleared: number;
  totalSafeTiles: number;
  multiplierReached: number;
  starBonus: number;
  cherryCombo: boolean;
  luckyCharmBonus: number;
  attempts: number;        // how many busts before cashing out
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
  seed: number;

  // Run-persistent resources
  cash: number;
  gems: number;
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
  safetyNetUsed: boolean; // Safety Net relic — protects one bust per run

  // Round-level: persists across attempts within a round
  cumulativeRoundScore: number;  // sum of scores from all busted attempts
  roundAttempts: number;         // bust count this round
  bustMessage: string | null;    // shown on bet phase after bust

  // Current attempt
  bet: number;
  score: number;            // score for current attempt only
  multiplier: number;
  streakMeter: number;         // 0–100
  streakGuaranteed: boolean;   // next click is guaranteed safe + 3×
  bellsThisStreak: number;     // for Bell Choir relic
  consecutiveClears: number;   // for Chain Reaction relic + streak display
  clearsSinceMagnet: number;   // for Magnet consumable
  canCashout: boolean;
  multiplierLensCount: number;

  // Attempt symbol tracking
  starsThisAttempt: number;
  cherriesRevealed: number[];  // tile indices (for cherry combo)
  gemsThisRound: number;       // accumulated across all attempts this round
  tilesCleared: number;        // current attempt tiles
  luckyCharmBonus: number;     // flat $ accumulator from Lucky Charm
  steadyHandsUsed: boolean;    // Steady Hands event card (once per round)

  // Event cards
  eventCardOptions: EventCardId[];
  activeEventCard: EventCardId | null;
  lastEventCard: EventCardId | null;

  // Grid
  grid: Tile[];
  gridKey: number;
  isBossRound: boolean;

  // Consumable placement phase
  placementQueue: ConsumableId[];
  placingIndex: number;

  // Scanner
  pendingScannerAxis: 'row' | 'col' | null;

  // Shop
  shopConsumables: ShopConsumableItem[];
  shopRelics: ShopRelicItem[];
  shopRerollUsed: boolean;
  relicRerollUsed: boolean;

  // Boss reward
  bossRewardOptions: RelicId[];

  // Round summary
  roundSummary: RoundSummaryData | null;
}
