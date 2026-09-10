import type { RelicId, RunStats, SkillId } from './types';

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
      { level: 0, name: 'Untrained', description: 'Your first click is always safe. Empty tiles reveal one at a time — no chain reaction.', cost: 0 },
      { level: 1, name: 'Attuned',   description: 'Your first click and its four side neighbours are all bomb-free — a plus-shaped foothold to reason from. Empty 0s cascade up to 6 tiles.', cost: 4 },
      { level: 2, name: 'Mastered',  description: 'Same plus-shaped opening, and empty 0s cascade without limit.', cost: 8 },
    ],
  },
  {
    id: 'insight',
    name: 'Insight',
    emoji: '🔢',
    levels: [
      { level: 0, name: 'Untrained', description: 'Empty tiles always show their adjacent-bomb count; only the first 5 symbol tiles you reveal each attempt do.', cost: 0 },
      { level: 1, name: 'Glimpse',   description: 'The first 8 symbol tiles you reveal each attempt show their bomb count.', cost: 4 },
      { level: 2, name: 'Focus',     description: 'The first 12 symbol tiles you reveal each attempt show their bomb count.', cost: 6 },
      { level: 3, name: 'Insight',   description: 'Every revealed tile shows its bomb count.', cost: 10 },
    ],
  },
  {
    id: 'bomb_flag',
    name: 'Bomb Sense',
    emoji: '🚩',
    levels: [
      { level: 0, name: 'Untrained',  description: 'Cannot flag suspected bombs.', cost: 0 },
      { level: 1, name: 'Hunch',      description: 'Flag 1 tile per attempt as a suspected bomb — correct flags pay a bonus when the attempt ends.', cost: 3 },
      { level: 2, name: 'Suspicion',  description: 'Flag up to 2 tiles per attempt.', cost: 4 },
      { level: 3, name: 'Instinct',   description: 'Flag up to 3 tiles per attempt.', cost: 5 },
      { level: 4, name: 'Certainty',  description: 'Flag up to 4 tiles per attempt.', cost: 6 },
      { level: 5, name: 'Bomb Sense', description: 'Flag up to 5 tiles per attempt (capped by how many bombs are actually on the board).', cost: 8 },
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

export interface DailyRecord {
  date: string;        // UTC yyyy-mm-dd
  best_cycles: number;
  runs: number;
}

export interface MetaProgress {
  prestige_points: number;
  skills: Record<SkillId, number>;
  unlocks: RelicId[];          // cross-run relic unlocks (see UNLOCKABLES)
  daily: DailyRecord | null;   // today's daily-run record
}

const STORAGE_KEY = 'explodds_meta';

function defaultMeta(): MetaProgress {
  return { prestige_points: 0, skills: { cascade: 0, bomb_flag: 0, insight: 0 }, unlocks: [], daily: null };
}

// ─── Unlocks ───────────────────────────────────────────────────────────────────
//
// Feats achieved in any run permanently add a relic to the shop pool. Checked
// once per run end (recordRunEnd) against GameState.run_stats.

export interface UnlockDef {
  id: RelicId;
  name: string;
  emoji: string;
  requirement: string;
  check: (stats: RunStats & { cycles_survived: number }) => boolean;
}

export const UNLOCKABLES: UnlockDef[] = [
  { id: 'double_down',  name: 'Double Down',  emoji: '🎲', requirement: 'Survive 5 cycles in one run',                   check: s => s.cycles_survived >= 5 },
  { id: 'second_sight', name: 'Second Sight', emoji: '👁', requirement: 'Beat 2 bosses in one run',                      check: s => s.bosses_beaten >= 2 },
  { id: 'vault',        name: 'Vault',        emoji: '🏦', requirement: 'Finish an attempt Flawless with 8+ proven clicks', check: s => s.best_flawless_proven >= 8 },
  { id: 'cartographer', name: 'Cartographer', emoji: '🗺', requirement: 'Score a Perfect Clear on cycle 3 or later',     check: s => s.perfect_clear_best_cycle >= 3 },
];

export function evaluateUnlocks(stats: RunStats & { cycles_survived: number }, owned: RelicId[]): RelicId[] {
  return UNLOCKABLES.filter(u => !owned.includes(u.id) && u.check(stats)).map(u => u.id);
}

// ─── Daily run ─────────────────────────────────────────────────────────────────

export function todayKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

// Same seed for everyone on the same UTC day — a small FNV-style hash of the date
export function dailySeed(date: Date = new Date()): number {
  const key = todayKey(date);
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) % 2147483647 || 1;
}

export function dailyRecord(meta: MetaProgress = loadMeta()): DailyRecord | null {
  return meta.daily && meta.daily.date === todayKey() ? meta.daily : null;
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
      unlocks: Array.isArray(parsed.unlocks) ? parsed.unlocks : [],
      daily: parsed.daily && typeof parsed.daily.date === 'string' ? parsed.daily : null,
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

// Called once per run, when it ends (Game Over) — persists prestige, any relic
// unlocks the run's feats earned, and the daily record. Returns what was new.
export function recordRunEnd(run: { cycles_survived: number; run_stats: RunStats; is_daily: boolean }): { newUnlocks: RelicId[]; daily: DailyRecord | null } {
  const meta = loadMeta();
  const newUnlocks = evaluateUnlocks({ ...run.run_stats, cycles_survived: run.cycles_survived }, meta.unlocks);
  let daily = meta.daily;
  if (run.is_daily) {
    const today = todayKey();
    const prev = meta.daily && meta.daily.date === today ? meta.daily : { date: today, best_cycles: 0, runs: 0 };
    daily = { date: today, best_cycles: Math.max(prev.best_cycles, run.cycles_survived), runs: prev.runs + 1 };
  }
  const next: MetaProgress = {
    ...meta,
    prestige_points: meta.prestige_points + calcPrestigeEarned(run.cycles_survived),
    unlocks: [...meta.unlocks, ...newUnlocks],
    daily,
  };
  saveMeta(next);
  return { newUnlocks, daily: run.is_daily ? daily : null };
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
    ...meta,
    prestige_points: meta.prestige_points - cost,
    skills: { ...meta.skills, [id]: nextLevel },
  };
  saveMeta(next);
  return next;
}
