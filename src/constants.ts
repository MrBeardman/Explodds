import type {
  ConsumableId, EventCardId, RelicId,
  ShopConsumableItem, ShopRelicItem, SymbolId,
} from './types';

// ─── Cycle deadlines ──────────────────────────────────────────────────────────

const FIXED_DEADLINES = [100, 180, 290, 430, 600];

export function calcDeadline(cycle: number): number {
  if (cycle <= 5) return FIXED_DEADLINES[cycle - 1];
  let d = 600;
  for (let i = 5; i < cycle; i++) {
    d = Math.round((d * 1.35) / 10) * 10;
  }
  return d;
}

// ─── Base bombs per cycle ─────────────────────────────────────────────────────

export function getBaseBombs(cycle: number): number {
  if (cycle <= 2) return 3;
  if (cycle <= 4) return 5;
  if (cycle <= 6) return 7;
  return 9;
}

// ─── Dynamic bomb count ───────────────────────────────────────────────────────

export function calcBombs(bet: number, wallet: number, cycle: number): number {
  const base = getBaseBombs(cycle);
  const ratio = bet / Math.max(wallet, 1);
  const bonus = Math.floor(ratio * 5);
  return Math.min(base + bonus, base + 5, 24);
}

// ─── Tile cash calculation ────────────────────────────────────────────────────

export function calcTileBaseCash(bet: number): number {
  return 3 + bet / 20;
}

// ─── Symbol definitions ───────────────────────────────────────────────────────

export interface SymbolDef {
  id: SymbolId;
  emoji: string;
  name: string;
  modifier: number;   // cash multiplier for this symbol
  weight: number;
}

export const SYMBOLS: SymbolDef[] = [
  { id: 'diamond', emoji: '💎', name: 'Diamond', modifier: 1.0, weight: 20 },
  { id: 'cherry',  emoji: '🍒', name: 'Cherry',  modifier: 0.8, weight: 20 },
  { id: 'banana',  emoji: '🍌', name: 'Banana',  modifier: 1.2, weight: 18 },
  { id: 'star',    emoji: '⭐', name: 'Star',    modifier: 1.5, weight: 12 },
  { id: 'bell',    emoji: '🔔', name: 'Bell',    modifier: 0.9, weight: 18 },
  { id: 'coin',    emoji: '🪙', name: 'Coin',    modifier: 2.0, weight: 12 },
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
  { id: 'hot_streak',     emoji: '🔥', name: 'Hot Streak',     description: 'Start each attempt with streak at 5' },
  { id: 'cherry_season',  emoji: '🍒', name: 'Cherry Season',  description: 'Cherry weight ×2 this cycle' },
  { id: 'banana_bonanza', emoji: '🍌', name: 'Banana Bonanza', description: 'Banana weight ×2 this cycle' },
  { id: 'star_shower',    emoji: '⭐', name: 'Star Shower',    description: 'Star worth ×1.5 this cycle' },
  { id: 'coin_rush',      emoji: '🪙', name: 'Coin Rush',      description: 'Coin weight ×2, Coin Jackpot gives +6🎫' },
  { id: 'safe_zone',      emoji: '🛡', name: 'Safe Zone',      description: '4 fewer empty tiles this cycle' },
  { id: 'danger_pay',     emoji: '💥', name: 'Danger Pay',     description: '+3 extra bombs per attempt, tile value ×1.4' },
  { id: 'bell_ringer',    emoji: '🔔', name: 'Bell Ringer',    description: 'Bell Storm threshold reduced to 3 bells' },
  { id: 'lucky_board',    emoji: '🍀', name: 'Lucky Board',    description: 'First attempt this cycle: no empty tiles' },
  { id: 'greed_mode',     emoji: '💸', name: 'Greed Mode',     description: 'Cashout earns +30% but bet minimum $25' },
];

export const EVENT_CARD_MAP = Object.fromEntries(
  EVENT_CARDS.map(c => [c.id, c])
) as Record<EventCardId, EventCardDef>;

// ─── Consumables ──────────────────────────────────────────────────────────────

export const ALL_CONSUMABLES: ShopConsumableItem[] = [
  { id: 'scatter_reveal', name: 'Scatter Reveal', price: 15, emoji: '✨', description: 'Reveal 3 safe tiles before attempt', sold: false },
  { id: 'scanner',        name: 'Scanner',        price: 20, emoji: '🔍', description: 'Reveal one full row or column', sold: false },
  { id: 'defuser',        name: 'Defuser',        price: 25, emoji: '🔧', description: 'Placed on tile — bomb becomes empty', sold: false },
  { id: 'tile_magnet',    name: 'Tile Magnet',    price: 18, emoji: '🧲', description: 'Auto-reveals nearest safe tile every 5 clears', sold: false },
  { id: 'lucky_tile',     name: 'Lucky Tile',     price: 12, emoji: '🍀', description: 'Placed tile — if safe, +$5 flat earnings', sold: false },
  { id: 'empty_eraser',   name: 'Empty Eraser',   price: 10, emoji: '🧹', description: 'Removes 2 empty tiles from next board', sold: false },
];

// Consumables that need pre-attempt tile placement
export const PLACEABLE_CONSUMABLES: ConsumableId[] = ['defuser', 'lucky_tile'];

// ─── Relics ───────────────────────────────────────────────────────────────────

export const ALL_RELICS: ShopRelicItem[] = [
  { id: 'greed_chip',     name: 'Greed Chip',      cost: 8,  emoji: '🪙', description: '+$3 flat on every cashout', sold: false, owned: false },
  { id: 'adrenaline_core',name: 'Adrenaline Core', cost: 10, emoji: '⚡', description: 'Multiplier grows 20% faster', sold: false, owned: false },
  { id: 'cherry_picker',  name: 'Cherry Picker',   cost: 10, emoji: '🍒', description: 'Cherry Rush pays $20 (was $12)', sold: false, owned: false },
  { id: 'banana_baron',   name: 'Banana Baron',    cost: 12, emoji: '🍌', description: 'Banana Split gives ×3 (was ×2)', sold: false, owned: false },
  { id: 'star_magnet',    name: 'Star Magnet',     cost: 8,  emoji: '⭐', description: 'Star Power pays $28 (was $18)', sold: false, owned: false },
  { id: 'bell_captain',   name: 'Bell Captain',    cost: 10, emoji: '🔔', description: 'Bell Storm sets streak to 20', sold: false, owned: false },
  { id: 'diamond_dealer', name: 'Diamond Dealer',  cost: 12, emoji: '💎', description: 'Diamond Run gives +25% (was +15%)', sold: false, owned: false },
  { id: 'coin_tycoon',    name: 'Coin Tycoon',     cost: 8,  emoji: '💰', description: 'Coin Jackpot gives +8🎫 (was +4)', sold: false, owned: false },
  { id: 'safe_digger',    name: 'Safe Digger',     cost: 8,  emoji: '⛏', description: '3 fewer empty tiles every board', sold: false, owned: false },
  { id: 'bomb_suit',      name: 'Bomb Suit',       cost: 15, emoji: '🦺', description: 'First bust each cycle: bet refunded', sold: false, owned: false },
  { id: 'hot_hands',      name: 'Hot Hands',       cost: 10, emoji: '🔥', description: 'Streak 5 bonus: +$8 flat (replaces mult bonus)', sold: false, owned: false },
  { id: 'lucky_charm',    name: 'Lucky Charm',     cost: 12, emoji: '🎰', description: 'One guaranteed coin tile per board', sold: false, owned: false },
];

export const RELIC_MAP = Object.fromEntries(
  ALL_RELICS.map(r => [r.id, r])
) as Record<RelicId, ShopRelicItem>;

// ─── Grid constants ───────────────────────────────────────────────────────────

export const GRID_SIZE = 25;
export const GRID_COLS = 5;
export const STARTING_WALLET = 150;
export const MIN_BET = 10;
export const BET_STEP = 5;
export const MAX_ACTIVE_RELICS = 6;
export const MAX_SHOP_ITEMS = 4;
