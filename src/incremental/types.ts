// ─── Incremental Dig Mode — fully separate from src/types.ts (Standard mode) ──

export type DigTileType = 'dirt' | 'empty' | 'bomb';
// 'hinted' = a known-bomb marker (Danger Sense's level-start reveal, or a
// Scanner proc) — still hidden/clickable, just visually flagged. Distinct
// concept from Standard's Tile.state === 'flagged'.
// 'cracked' = a multi-hit ore tile that's taken some damage but isn't fully
// mined yet (Durability node) — still hidden/clickable, shows remaining hits.
export type DigTileState = 'hidden' | 'hinted' | 'cracked' | 'revealed';
export type OreTierId = 'dirt' | 'copper' | 'silver' | 'gold' | 'platinum' | 'diamond';

export interface DigTile {
  index: number;
  type: DigTileType;
  state: DigTileState;
  oreTier: OreTierId | null;   // set only when type === 'dirt'
  cashValue: number | null;    // rolled at generation time, only for dirt tiles
  toughness: number;           // hits required to mine; 1 for bomb/empty, 2 for untrained dirt/ore
  hitsTaken: number;           // cumulative damage this tile has taken so far
}

export type DigPhase = 'HOME' | 'DIGGING' | 'RUN_OVER';
export type DigEndReason = 'bomb' | 'out_of_charges' | 'cashed_out';

// Checkpoint-level twists (every 3rd level) — see src/incremental/digBosses.ts.
export type DigBossId = 'cave_in' | 'fog' | 'iron_will' | 'golden_layer';

// The branching upgrade tree — see src/incremental/digMeta.ts for the catalog
// and the tree topology (parentId chains).
export type DigUpgradeId =
  | 'pickaxe_1' | 'pickaxe_2'
  | 'bomb_sense_1' | 'bomb_sense_2'
  | 'copper_vein_1' | 'silver_vein_1' | 'gold_vein_1' | 'platinum_vein_1' | 'diamond_vein_1'
  | 'nugget_luck_1'
  | 'scanner_prob_1' | 'scanner_count_1'
  | 'durability_1' | 'strength_1' | 'bulk_click_1'
  | 'dirt_value_1';

export interface DigGameState {
  phase: DigPhase;
  level: number;
  boardRows: number;
  boardCols: number;
  board: DigTile[];
  chargesRemaining: number;
  chargesMax: number;
  bankedCash: number;       // permanently safe this run (prior clears + cash-outs)
  currentLevelCash: number; // at-risk — lost on a bomb hit, banked on clear/cashout/out-of-charges
  minedBanked: Record<OreTierId, { count: number; cash: number }>;      // composition of bankedCash — for the run-over breakdown
  minedThisLevel: Record<OreTierId, { count: number; cash: number }>;   // composition of currentLevelCash — merged into minedBanked when banked, discarded on a bomb
  activeBoss: DigBossId | null; // set at checkpoint levels (level % 3 === 0), null otherwise
  endReason: DigEndReason | null;
  levelsClearedThisRun: number;
  seed: number;
  skills: Record<DigUpgradeId, number>; // snapshot of digMeta.upgrades — re-read fresh in startDig, see digLogic.ts
}
