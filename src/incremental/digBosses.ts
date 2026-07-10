import type { DigBossId } from './types';
import { isDigCheckpointLevel } from './constants';
import { mulberry32, rngShuffle } from '../rng';

// Checkpoint-level twists (every 3rd level) — mirrors Standard mode's BOSSES/
// getBossForCycle pattern exactly (seeded shuffle of the pool, indexed by
// ordinal, repeats after all bosses cycled). Each boss is a single-rule
// modifier applied only for that one checkpoint level, same simplicity as
// Standard's bosses.
export interface DigBossDef {
  id: DigBossId;
  name: string;
  emoji: string;
  description: string;
}

export const DIG_BOSSES: DigBossDef[] = [
  { id: 'cave_in', name: 'Cave-In', emoji: '⛰️', description: 'Bomb density is much higher this level.' },
  { id: 'fog', name: 'Fog', emoji: '🌫️', description: 'Empty tiles show no adjacency numbers this level.' },
  { id: 'iron_will', name: 'Iron Will', emoji: '🪨', description: 'Every click costs 2 charges this level.' },
  { id: 'golden_layer', name: 'Golden Layer', emoji: '✨', description: 'Ore odds are much richer this level — no extra danger.' },
];

export const DIG_BOSS_MAP: Record<DigBossId, DigBossDef> = Object.fromEntries(
  DIG_BOSSES.map(b => [b.id, b])
) as Record<DigBossId, DigBossDef>;

export function getDigBossForCheckpoint(seed: number, level: number): DigBossId | null {
  if (!isDigCheckpointLevel(level)) return null;
  const ordinal = level / 3;
  const pool = rngShuffle(mulberry32(seed + 555), DIG_BOSSES.map(b => b.id));
  return pool[(ordinal - 1) % pool.length];
}
