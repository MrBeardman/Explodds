import type { SkillId } from './types';

// ─── Meta-progression: skill tree ──────────────────────────────────────────────
//
// Persists ACROSS runs (localStorage), independent of GameState/seed. Each run
// snapshots the current skill levels into GameState.skills at createInitialState()
// — gameplay always reads that snapshot, never localStorage directly, same
// pattern as relics/events being read from run state rather than re-derived.
//
// Currency (prestige points) is earned when a run ends, based on how deep it
// got, and spent on the Start Screen between runs. Adding skill #2 later is
// just another entry in SKILLS plus a gameLogic hook reading state.skills[id].

export interface SkillLevelDef {
  level: number;
  name: string;
  description: string;
  cost: number; // prestige points to reach this level from the previous one (0 for level 0)
}

export interface SkillDef {
  id: SkillId;
  name: string;
  emoji: string;
  levels: SkillLevelDef[]; // index === level; index 0 is the base/unupgraded state
}

export const SKILLS: SkillDef[] = [
  {
    id: 'cascade',
    name: 'Cascade Sense',
    emoji: '🌊',
    levels: [
      { level: 0, name: 'Untrained', description: 'Empty tiles reveal one at a time — no chain reaction.', cost: 0 },
      { level: 1, name: 'Attuned',   description: 'A 0-adjacency empty tile cascades open up to 6 connected safe tiles.', cost: 4 },
      { level: 2, name: 'Mastered',  description: 'A 0-adjacency empty tile cascades open every connected safe tile.', cost: 8 },
    ],
  },
];

export const SKILL_MAP: Record<SkillId, SkillDef> = Object.fromEntries(
  SKILLS.map(s => [s.id, s])
) as Record<SkillId, SkillDef>;

export function maxSkillLevel(id: SkillId): number {
  return SKILL_MAP[id].levels.length - 1;
}

// ─── Persistence ────────────────────────────────────────────────────────────────

export interface MetaProgress {
  prestige_points: number;
  skills: Record<SkillId, number>;
}

const STORAGE_KEY = 'explodds_meta';

function defaultMeta(): MetaProgress {
  return { prestige_points: 0, skills: { cascade: 0 } };
}

export function loadMeta(): MetaProgress {
  if (typeof localStorage === 'undefined') return defaultMeta();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultMeta();
    const parsed = JSON.parse(raw);
    return {
      prestige_points: typeof parsed.prestige_points === 'number' ? parsed.prestige_points : 0,
      skills: { ...defaultMeta().skills, ...parsed.skills },
    };
  } catch {
    return defaultMeta();
  }
}

function saveMeta(meta: MetaProgress): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
}

// Prestige earned when a run ends — scales with how deep the run got.
export function calcPrestigeEarned(cyclesSurvived: number): number {
  return Math.ceil(cyclesSurvived / 2);
}

// Called once per run, when it ends (Game Over) — persists the award.
export function awardPrestige(cyclesSurvived: number): MetaProgress {
  const meta = loadMeta();
  const next: MetaProgress = {
    ...meta,
    prestige_points: meta.prestige_points + calcPrestigeEarned(cyclesSurvived),
  };
  saveMeta(next);
  return next;
}

export function upgradeSkill(id: SkillId): MetaProgress {
  const meta = loadMeta();
  const current = meta.skills[id] ?? 0;
  const max = maxSkillLevel(id);
  if (current >= max) return meta;

  const nextLevel = current + 1;
  const cost = SKILL_MAP[id].levels[nextLevel].cost;
  if (meta.prestige_points < cost) return meta;

  const next: MetaProgress = {
    prestige_points: meta.prestige_points - cost,
    skills: { ...meta.skills, [id]: nextLevel },
  };
  saveMeta(next);
  return next;
}
