import type { ConsumableId, EventCardId, RelicId, ShopConsumableItem, ShopRelicItem, SymbolId } from './types';

// ─── Levels ───────────────────────────────────────────────────────────────────

export interface LevelConfig {
  round: number;
  target: number;
  bombs: number;
  isBoss: boolean;
  suggestedBet: number;
}

export const LEVELS: LevelConfig[] = [
  { round: 1, target: 1_000,  bombs: 3,  isBoss: false, suggestedBet: 20 },
  { round: 2, target: 2_500,  bombs: 5,  isBoss: false, suggestedBet: 30 },
  { round: 3, target: 5_000,  bombs: 8,  isBoss: true,  suggestedBet: 40 },
  { round: 4, target: 10_000, bombs: 10, isBoss: false, suggestedBet: 50 },
  { round: 5, target: 20_000, bombs: 13, isBoss: false, suggestedBet: 60 },
  { round: 6, target: 40_000, bombs: 16, isBoss: true,  suggestedBet: 80 },
];

// Fixed bomb tile indices for boss rounds (0 = top-left, 24 = bottom-right)
export const BOSS_BOMBS: Record<number, number[]> = {
  // Round 3 — 8 bombs — diamond pattern
  //  . . B . .
  //  . B . B .
  //  B . . . B
  //  . B . B .
  //  . . B . .
  3: [2, 6, 8, 10, 14, 16, 18, 22],

  // Round 6 — 16 bombs — fortress (all border tiles)
  //  B B B B B
  //  B . . . B
  //  B . . . B
  //  B . . . B
  //  B B B B B
  6: [0, 1, 2, 3, 4, 5, 9, 10, 14, 15, 19, 20, 21, 22, 23, 24],
};

// ─── Symbols ──────────────────────────────────────────────────────────────────

export interface SymbolDef {
  id: SymbolId;
  emoji: string;
  name: string;
  basePoints: number;
  weight: number;
}

export const SYMBOLS: SymbolDef[] = [
  { id: 'diamond', emoji: '💎', name: 'Diamond', basePoints: 100, weight: 20 },
  { id: 'cherry',  emoji: '🍒', name: 'Cherry',  basePoints: 80,  weight: 20 },
  { id: 'banana',  emoji: '🍌', name: 'Banana',  basePoints: 120, weight: 18 },
  { id: 'star',    emoji: '⭐', name: 'Star',    basePoints: 150, weight: 12 },
  { id: 'bell',    emoji: '🔔', name: 'Bell',    basePoints: 90,  weight: 18 },
  { id: 'coin',    emoji: '🪙', name: 'Coin',    basePoints: 200, weight: 8  },
];

export const SYMBOL_MAP: Record<SymbolId, SymbolDef> = Object.fromEntries(
  SYMBOLS.map(s => [s.id, s])
) as Record<SymbolId, SymbolDef>;

// ─── Event Cards ──────────────────────────────────────────────────────────────

export interface EventCardDef {
  id: EventCardId;
  name: string;
  emoji: string;
  description: string;
}

export const EVENT_CARDS: EventCardDef[] = [
  { id: 'hot_streak',    emoji: '🔥', name: 'Hot Streak',    description: 'Streak meter starts at 50%' },
  { id: 'danger_pay',    emoji: '💥', name: 'Danger Pay',    description: '+2 extra bombs this round, +30% to all payouts' },
  { id: 'cherry_season', emoji: '🍒', name: 'Cherry Season', description: 'Cherry weight doubled this round' },
  { id: 'banana_bonanza',emoji: '🍌', name: 'Banana Bonanza',description: 'Banana weight doubled this round' },
  { id: 'star_shower',   emoji: '⭐', name: 'Star Shower',   description: 'Star weight doubled, each star worth +$2 this round' },
  { id: 'bell_ringer',   emoji: '🔔', name: 'Bell Ringer',   description: 'Bells fill streak meter 2× faster this round' },
  { id: 'safe_zone',     emoji: '🛡', name: 'Safe Zone',     description: 'One random quadrant is guaranteed bomb-free' },
  { id: 'greed_mode',    emoji: '💸', name: 'Greed Mode',    description: 'Cashout multiplier ×1.5, but bet minimum is $30' },
  { id: 'coin_rush',     emoji: '🪙', name: 'Coin Rush',     description: 'Coin weight tripled, gems from coins +2 this round' },
  { id: 'steady_hands',  emoji: '✋', name: 'Steady Hands',  description: 'First bust this round doesn\'t deduct your bet' },
  { id: 'lucky_scout',   emoji: '🔭', name: 'Lucky Scout',   description: 'Reveals 2 random safe tiles before round starts' },
  { id: 'high_roller',   emoji: '🎲', name: 'High Roller',   description: 'Round target +50%, but cashout multiplier ×2.5 if hit' },
];

export const EVENT_CARD_MAP = Object.fromEntries(
  EVENT_CARDS.map(c => [c.id, c])
) as Record<EventCardId, EventCardDef>;

// ─── Consumables ──────────────────────────────────────────────────────────────

export const ALL_CONSUMABLES: ShopConsumableItem[] = [
  { id: 'scatter_reveal', name: 'Scatter Reveal', price: 15, emoji: '✨', description: 'Reveals 3 random safe tiles at round start', sold: false },
  { id: 'scanner',        name: 'Scanner',        price: 20, emoji: '🔍', description: 'Reveals all tiles in one row or column (safe or bomb)', sold: false },
  { id: 'defuser',        name: 'Defuser',        price: 25, emoji: '🔧', description: 'Place on tile — if bomb, you survive once', sold: false },
  { id: 'multiplier_lens',name: 'Multi Lens',     price: 18, emoji: '🔬', description: 'Place on tile — if safe, next 4 tiles give 2× points', sold: false },
  { id: 'lucky_charm',    name: 'Lucky Charm',    price: 12, emoji: '🍀', description: 'Place on tile — if safe, +$3 flat bonus to cashout', sold: false },
  { id: 'magnet',         name: 'Magnet',         price: 22, emoji: '🧲', description: 'Auto-reveals nearest safe tile after every 5 clears', sold: false },
  { id: 'reroll_shop',    name: 'Reroll Shop',    price: 10, emoji: '🔄', description: 'Refresh consumable shop offerings (once per round)', sold: false },
];

// Consumables that need pre-round tile placement
export const PLACEABLE_CONSUMABLES: ConsumableId[] = ['defuser', 'multiplier_lens', 'lucky_charm'];

// ─── Relics ───────────────────────────────────────────────────────────────────

export const ALL_RELICS: ShopRelicItem[] = [
  { id: 'greed_chip',    name: 'Greed Chip',     cost: 8,  emoji: '🪙', description: '+$2 flat on every cashout', sold: false, owned: false },
  { id: 'adrenaline_core',name:'Adrenaline Core',cost: 10, emoji: '⚡', description: 'Multiplier grows 25% faster when <8 safe tiles remain', sold: false, owned: false },
  { id: 'safety_net',    name: 'Safety Net',      cost: 12, emoji: '🛡', description: 'First bust each run doesn\'t deduct your bet', sold: false, owned: false },
  { id: 'double_down',   name: 'Double Down',     cost: 15, emoji: '🎯', description: 'Clear 80%+ safe tiles = double payout', sold: false, owned: false },
  { id: 'dead_mans_hand',name: "Dead Man's Hand", cost: 10, emoji: '💀', description: 'On bust: gain 40% of your current attempt score as a cash bonus', sold: false, owned: false },
  { id: 'cartographer',  name: 'Cartographer',    cost: 8,  emoji: '🗺', description: 'One corner tile is always safe, revealed at round start', sold: false, owned: false },
  { id: 'chain_reaction',name: 'Chain Reaction',  cost: 12, emoji: '⛓', description: 'Every 5 consecutive clears give +0.5 multiplier bonus', sold: false, owned: false },
  { id: 'gem_cutter',    name: 'Gem Cutter',      cost: 10, emoji: '💎', description: 'Coin tiles give +3 gems instead of +1', sold: false, owned: false },
  { id: 'bell_choir',    name: 'Bell Choir',      cost: 8,  emoji: '🔔', description: 'Every 3 bells revealed = streak meter instantly fills', sold: false, owned: false },
  { id: 'star_collector',name: 'Star Collector',  cost: 12, emoji: '⭐', description: 'Stars also give +2 gems each', sold: false, owned: false },
  { id: 'lucky_streak',  name: 'Lucky Streak',    cost: 15, emoji: '🍀', description: 'Streak meter resets to 50% instead of 0 after cashout', sold: false, owned: false },
  { id: 'banana_republic',name:'Banana Republic', cost: 10, emoji: '🍌', description: 'Banana adjacency multiplier increased from 1.5× to 2.5×', sold: false, owned: false },
];

export const RELIC_MAP = Object.fromEntries(
  ALL_RELICS.map(r => [r.id, r])
) as Record<RelicId, ShopRelicItem>;

// ─── Other constants ──────────────────────────────────────────────────────────

export const GRID_SIZE = 25;
export const GRID_COLS = 5;
export const STARTING_CASH = 150;
export const MIN_BET = 10;
export const BET_STEP = 5;
export const STREAK_PER_TILE = 10;
export const STREAK_BELL_BONUS = 5; // bells give +15 total (10 + 5)
export const MAX_CONSUMABLE_SLOTS = 4; // shown in shop at once
export const MAX_RELIC_SLOTS = 4;      // shown in shop at once
export const MAX_ACTIVE_RELICS = 6;    // player can hold max 6 relics
