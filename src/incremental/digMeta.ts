import type { DigUpgradeId } from './types';

// Mirrors src/meta.ts's shape/pattern (MetaProgress/loadMeta/saveMeta/
// upgradeSkill), but fully separate — a different localStorage key, and a
// genuine branching tree (parentId) rather than a flat list of independent
// skills, per the user's explicit "root unlocks branches" request.

// Each node can have multiple purchasable levels (mirrors meta.ts's
// SkillDef.levels) — meta.upgrades[id] stores the CURRENT level reached (0 =
// not started), and `levels[n].cost` is what it costs to go from level n to
// n+1. Nodes that are just a simple on/off purchase are `levels` of length 1
// — the UI (green level-bar segments) renders identically either way, just
// with 1 segment instead of several.
export interface DigUpgradeLevelDef {
  cost: number;
}

export interface DigUpgradeNode {
  id: DigUpgradeId;
  parentId: DigUpgradeId | null; // null = root
  name: string;
  emoji: string;
  levels: DigUpgradeLevelDef[];
  description: string; // shown as a hover tooltip on the node (see TreeNode's `title`)
  // Default ('owned', i.e. omitted) reveals once the parent has reached level
  // 1. 'maxed' holds it hidden until the parent is fully maxed — used to force
  // a straight, no-spreading-thin early path down one branch before its next
  // tier opens up (currently just Copper Vein, gated on Dirt Value maxed).
  revealAt?: 'maxed';
}

// NOTE on id vs. display name: `pickaxe_1`/`durability_1` are the ORIGINAL
// ids from before a naming swap requested by the user — the id a node was
// created under still maps 1:1 to the exact same effect in digLogic.ts/
// constants.ts (`skills.pickaxe_1` still drives charge count,
// `skills.durability_1` still drives per-tile hit count), so gameLogic and
// existing localStorage saves needed zero changes. Only the user-facing
// `name`/`emoji`/position swapped: the root is now flavored "Durability"
// (how much your pickaxe can take before you must stop — this is the same
// resource shown as CHARGES on the play screen, which now displays as
// "DURABILITY" with a pickaxe icon, see DigHUD.tsx) and its former self is
// now a child node flavored "Pickaxe" (a sharper pickaxe needs fewer hits per
// tile). Don't rename the ids to match — that would require a localStorage
// migration for existing players' saved progress for purely cosmetic gain.
//
// Root ("Durability") has 3 direct branches: Dirt Value (→ Copper Vein once
// maxed → the ore ladder + Nugget Luck), Pickaxe (→ Strength → Bulk Click),
// and Durability II (→ Danger Sense → Danger Sense II, and → Scanner →
// Scanner Range). This is a first-pass proposed ordering for the user to
// playtest and reshuffle — see docs/plans/dig-upgrade-tree.md for the full
// catalog outside the tree structure, for easier brainstorming.
export const DIG_UPGRADES: DigUpgradeNode[] = [
  { id: 'pickaxe_1', parentId: null, name: 'Durability', emoji: '⛏️',
    levels: [{ cost: 5 }, { cost: 10 }, { cost: 16 }],
    description: 'More charges per run — 3 levels (5 base → 7 → 12 → 15). Charges are how many total digs your pickaxe has left in it this run.' },

  { id: 'pickaxe_2', parentId: 'pickaxe_1', name: 'Durability II', emoji: '🔋',
    levels: [{ cost: 12 }],
    description: '+8 more charges per run, on top of Durability\'s ladder.' },

  { id: 'bomb_sense_1', parentId: 'pickaxe_2', name: 'Danger Sense', emoji: '👁️',
    levels: [{ cost: 8 }],
    description: 'Reveals the location of 1 bomb at the start of every level.' },
  { id: 'bomb_sense_2', parentId: 'bomb_sense_1', name: 'Danger Sense II', emoji: '👁️‍🗨️',
    levels: [{ cost: 14 }],
    description: 'Reveals 2 bombs per level instead of 1.' },

  { id: 'scanner_prob_1', parentId: 'pickaxe_2', name: 'Scanner', emoji: '📡',
    levels: [{ cost: 10 }],
    description: 'Digging an empty tile has a chance to reveal a nearby bomb.' },
  { id: 'scanner_count_1', parentId: 'scanner_prob_1', name: 'Scanner Range', emoji: '📶',
    levels: [{ cost: 16 }],
    description: 'The Scanner reveals more bombs when it triggers.' },

  { id: 'dirt_value_1', parentId: 'pickaxe_1', name: 'Dirt Value', emoji: '💵',
    levels: [{ cost: 10 }, { cost: 18 }, { cost: 28 }],
    description: "Raises plain Dirt's base value — 3 levels ($1 base → $2 → $3 → $4)." },

  { id: 'copper_vein_1', parentId: 'dirt_value_1', revealAt: 'maxed', name: 'Copper Vein', emoji: '🟠',
    levels: [{ cost: 8 }, { cost: 16 }],
    description: 'Unlocks Copper ore (worth 2x plain dirt) — level 2 makes it spawn more often. No ore of any kind spawns without this. Unlocks once Dirt Value is fully maxed.' },
  { id: 'silver_vein_1', parentId: 'copper_vein_1', name: 'Silver Vein', emoji: '⚪',
    levels: [{ cost: 14 }],
    description: 'Unlocks Silver ore (worth 4x plain dirt).' },
  { id: 'gold_vein_1', parentId: 'silver_vein_1', name: 'Gold Vein', emoji: '🟡',
    levels: [{ cost: 22 }],
    description: 'Unlocks Gold ore (worth 8x plain dirt).' },
  { id: 'platinum_vein_1', parentId: 'gold_vein_1', name: 'Platinum Vein', emoji: '⚙️',
    levels: [{ cost: 32 }],
    description: 'Unlocks Platinum ore (worth 16x plain dirt).' },
  { id: 'diamond_vein_1', parentId: 'platinum_vein_1', name: 'Diamond Vein', emoji: '💎',
    levels: [{ cost: 45 }],
    description: 'Unlocks Diamond (worth 32x plain dirt).' },
  { id: 'nugget_luck_1', parentId: 'copper_vein_1', name: 'Nugget Luck', emoji: '🍀',
    levels: [{ cost: 12 }],
    description: 'Dirt tile digs have a chance to pay out double.' },

  { id: 'durability_1', parentId: 'pickaxe_1', name: 'Pickaxe', emoji: '⚒️',
    levels: [{ cost: 10 }, { cost: 20 }],
    description: 'A sharper pickaxe: one durability point (charge) now digs Plain Dirt in a single hit instead of two — level 2 extends that same relief to Copper ore too.' },
  { id: 'strength_1', parentId: 'durability_1', name: 'Strength', emoji: '💪',
    levels: [{ cost: 16 }],
    description: 'Each click hits twice as hard, one-shotting tougher ore again.' },
  { id: 'bulk_click_1', parentId: 'strength_1', name: 'Bulk Click', emoji: '🤜',
    levels: [{ cost: 24 }],
    description: 'Also strikes the tile to the right with full strength, same click.' },
];

export const DIG_UPGRADE_MAP: Record<DigUpgradeId, DigUpgradeNode> = Object.fromEntries(
  DIG_UPGRADES.map(u => [u.id, u])
) as Record<DigUpgradeId, DigUpgradeNode>;

export interface DigMetaProgress {
  cash_balance: number;         // spendable currency
  lifetime_cash_earned: number; // stat-only, never decreases
  upgrades: Record<DigUpgradeId, number>; // current level reached, 0..levels.length
}

// Single source of truth for "is this node unlocked yet" — shared by
// DigUpgradeTree.tsx (what to render/fog-of-war) and purchaseDigUpgrade
// (what's actually buyable), so the two can't drift out of sync.
export function isDigUpgradeRevealed(node: DigUpgradeNode, meta: DigMetaProgress): boolean {
  if (node.parentId === null) return true;
  const parentLevel = meta.upgrades[node.parentId] ?? 0;
  const required = node.revealAt === 'maxed' ? DIG_UPGRADE_MAP[node.parentId].levels.length : 1;
  return parentLevel >= required;
}

const DIG_STORAGE_KEY = 'explodds_dig_meta'; // fully separate from Standard's 'explodds_meta'

function defaultDigMeta(): DigMetaProgress {
  const upgrades = Object.fromEntries(DIG_UPGRADES.map(u => [u.id, 0])) as Record<DigUpgradeId, number>;
  return { cash_balance: 0, lifetime_cash_earned: 0, upgrades };
}

export function loadDigMeta(): DigMetaProgress {
  if (typeof localStorage === 'undefined') return defaultDigMeta();
  try {
    const raw = localStorage.getItem(DIG_STORAGE_KEY);
    if (!raw) return defaultDigMeta();
    const parsed = JSON.parse(raw);
    return {
      cash_balance: typeof parsed.cash_balance === 'number' ? parsed.cash_balance : 0,
      lifetime_cash_earned: typeof parsed.lifetime_cash_earned === 'number' ? parsed.lifetime_cash_earned : 0,
      upgrades: { ...defaultDigMeta().upgrades, ...parsed.upgrades },
    };
  } catch {
    return defaultDigMeta();
  }
}

function saveDigMeta(meta: DigMetaProgress): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(DIG_STORAGE_KEY, JSON.stringify(meta));
}

// Called once per run, when it ends (RUN_OVER) — persists the award.
export function awardRunCash(cashEarned: number): DigMetaProgress {
  const meta = loadDigMeta();
  const next: DigMetaProgress = {
    ...meta,
    cash_balance: parseFloat((meta.cash_balance + cashEarned).toFixed(2)),
    lifetime_cash_earned: parseFloat((meta.lifetime_cash_earned + cashEarned).toFixed(2)),
  };
  saveDigMeta(next);
  return next;
}

export function maxDigUpgradeLevel(id: DigUpgradeId): number {
  return DIG_UPGRADE_MAP[id].levels.length;
}

// Buys the NEXT level of a node (current level + 1) — mirrors meta.ts's
// upgradeSkill, but with an added parent-gate since this tree actually
// branches (Standard's flat skill list doesn't need one). Most nodes just
// need their parent owned (level >= 1); a node with `revealAt: 'maxed'`
// (currently only Copper Vein, gated on Dirt Value) needs its parent fully
// maxed instead — see isDigUpgradeRevealed, shared with the tree UI so the
// purchase gate and the fog-of-war reveal can never disagree.
export function purchaseDigUpgrade(id: DigUpgradeId): DigMetaProgress {
  const meta = loadDigMeta();
  const node = DIG_UPGRADE_MAP[id];
  const current = meta.upgrades[id] ?? 0;
  if (current >= node.levels.length) return meta;      // already maxed
  if (!isDigUpgradeRevealed(node, meta)) return meta;   // parent requirement not met
  const cost = node.levels[current].cost;
  if (meta.cash_balance < cost) return meta;

  const next: DigMetaProgress = {
    ...meta,
    cash_balance: parseFloat((meta.cash_balance - cost).toFixed(2)),
    upgrades: { ...meta.upgrades, [id]: current + 1 },
  };
  saveDigMeta(next);
  return next;
}

// ─── Debug-only helpers (DigDebugPanel.tsx, DEV builds only) ──────────────────
// Bypass cost/parent gating entirely — direct pokes for testing, same spirit
// as Standard's DEBUG_PATCH. Never called from real gameplay code.

export function debugSetDigMeta(patch: Partial<DigMetaProgress>): DigMetaProgress {
  const next = { ...loadDigMeta(), ...patch };
  saveDigMeta(next);
  return next;
}

// `owned=true` maxes the node out (all levels); `owned=false` resets it to 0.
// A blunt on/off toggle rather than a per-level setter — good enough for the
// debug panel's quick testing use case.
export function debugSetUpgradeOwned(id: DigUpgradeId, owned: boolean): DigMetaProgress {
  const meta = loadDigMeta();
  const next: DigMetaProgress = { ...meta, upgrades: { ...meta.upgrades, [id]: owned ? DIG_UPGRADE_MAP[id].levels.length : 0 } };
  saveDigMeta(next);
  return next;
}
