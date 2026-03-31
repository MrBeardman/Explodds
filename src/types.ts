export type TileState = 'hidden' | 'hinted' | 'revealed' | 'defused';
// hinted = revealed by a tool (safe tile, still clickable for points)
// revealed = player-clicked safe tile, or revealed bomb, or defused bomb clicked

export interface Tile {
  id: number;
  isBomb: boolean;
  state: TileState;
  isSafeRevealed: boolean; // true for scanner-revealed bombs (info only, unclickable)
  isDefused: boolean;
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
  gridKey: number; // increments on every grid reset — triggers entrance animation
  relics: RelicId[];
  consumables: ConsumableId[];
  shopItems: ShopItem[];
  canCashout: boolean;
  safetyNetUsed: boolean;
  multiplierLensCount: number;
  totalMoneyEarned: number;
  bombHitThisRound: boolean;
  pendingConsumable: ConsumableId | null;
  defusedTiles: number[];
  scannerAxis: 'row' | 'col' | null;
}
