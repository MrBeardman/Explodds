export type TileState = 'hidden' | 'revealed' | 'defused';

export interface Tile {
  id: number;
  isBomb: boolean;
  state: TileState;
  isSafeRevealed: boolean; // revealed by Scanner/ScatterReveal (no points)
  isDefused: boolean;       // Defuser placed here
}

export type RelicId =
  | 'greed_chip'
  | 'adrenaline_core'
  | 'safety_net'
  | 'double_down'
  | 'dead_mans_hand'
  | 'cartographer';

export type ConsumableId =
  | 'scatter_reveal'
  | 'scanner'
  | 'defuser'
  | 'multiplier_lens';

export type ItemId = RelicId | ConsumableId;

export interface ShopItem {
  id: ItemId;
  name: string;
  price: number;
  description: string;
  type: 'relic' | 'consumable';
}

export type GamePhase = 'playing' | 'shop' | 'gameover' | 'start';

export interface GameState {
  phase: GamePhase;
  level: number;
  money: number;
  lives: number;
  score: number;
  multiplier: number;
  grid: Tile[];
  relics: RelicId[];
  consumables: ConsumableId[];
  shopItems: ShopItem[];
  canCashout: boolean;
  safetyNetUsed: boolean;
  multiplierLensCount: number; // tiles remaining with 2x points
  totalMoneyEarned: number;
  bombHitThisRound: boolean; // for dead man's hand tracking
  pendingConsumable: ConsumableId | null; // consumable being placed
  defusedTiles: number[]; // tile indices with defuser placed
  scannerAxis: 'row' | 'col' | null;
}
