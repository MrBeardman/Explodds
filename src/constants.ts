import type { ShopItem } from './types';

export interface LevelConfig {
  level: number;
  target: number;
  bombs: number;
  payout: number;
}

export const LEVELS: LevelConfig[] = [
  { level: 1, target: 1000,  bombs: 3,  payout: 3  },
  { level: 2, target: 2500,  bombs: 5,  payout: 5  },
  { level: 3, target: 5000,  bombs: 8,  payout: 8  },
  { level: 4, target: 10000, bombs: 11, payout: 12 },
  { level: 5, target: 20000, bombs: 14, payout: 18 },
  { level: 6, target: 50000, bombs: 18, payout: 30 },
];

export const GRID_SIZE = 25; // 5x5
export const GRID_COLS = 5;
export const STARTING_LIVES = 3;
export const BASE_TILE_POINTS = 100;

export const ALL_SHOP_ITEMS: ShopItem[] = [
  // Relics
  {
    id: 'greed_chip',
    name: 'Greed Chip',
    price: 8,
    description: '+$2 flat on every cashout',
    type: 'relic',
  },
  {
    id: 'adrenaline_core',
    name: 'Adrenaline Core',
    price: 10,
    description: 'Multiplier grows 25% faster when under 10 safe tiles left',
    type: 'relic',
  },
  {
    id: 'safety_net',
    name: 'Safety Net',
    price: 12,
    description: 'First bomb each run doesn\'t cost a life',
    type: 'relic',
  },
  {
    id: 'double_down',
    name: 'Double Down',
    price: 15,
    description: 'Clear 80%+ of board = double payout',
    type: 'relic',
  },
  {
    id: 'dead_mans_hand',
    name: "Dead Man's Hand",
    price: 10,
    description: 'Hitting a bomb pays 40% of current score before dying',
    type: 'relic',
  },
  {
    id: 'cartographer',
    name: 'Cartographer',
    price: 8,
    description: 'One corner tile always revealed as safe at level start',
    type: 'relic',
  },
  // Consumables
  {
    id: 'scatter_reveal',
    name: 'Scatter Reveal',
    price: 3,
    description: 'Reveals 3 random safe tiles before you start',
    type: 'consumable',
  },
  {
    id: 'scanner',
    name: 'Scanner',
    price: 4,
    description: 'Reveals entire row or column (safe or bomb)',
    type: 'consumable',
  },
  {
    id: 'defuser',
    name: 'Defuser',
    price: 6,
    description: 'Place on any tile — if it\'s a bomb, it won\'t kill you once',
    type: 'consumable',
  },
  {
    id: 'multiplier_lens',
    name: 'Multiplier Lens',
    price: 5,
    description: 'Next 5 tiles cleared give 2× points',
    type: 'consumable',
  },
];
