import type { OreTierId } from './types';

// ─── Board escalation ──────────────────────────────────────────────────────────
//
// Tuned using scripts/dig-sim.mjs (`npm run dig-sim`). The sim revealed the real
// bottleneck isn't charge count — it's that requiring a 100% non-bomb clear is a
// compounding-risk gauntlet across ~20+ sequential clicks, where charges past the
// bare minimum needed don't move the needle at all (flat clear-rate past ~25
// charges in the sim). Two changes address this together:
//   1. DIG_CLEAR_BUFFER — a level counts as cleared once only a small number of
//      hidden non-bomb tiles remain, not literally every single one. This
//      specifically cuts the worst "last tile is a near-coinflip" endgame risk.
//   2. Lower bomb density (was 0.12 base/0.008 step/0.22 max) — a real, if modest,
//      safety-margin increase.
//
// IMPORTANT LIMITATION: the sim's "skill" parameter is a flat, uniform risk
// discount — it cannot model genuine deduction (a real player reading adjacency
// numbers, or owning Danger Sense, can PROVE specific tiles are 100% safe, not
// just "somewhat less risky"). The sim's clear-rate numbers are therefore a
// pessimistic lower bound, not a literal prediction — treat them as a tuning
// *direction*, not a target to hit exactly. Final numbers should still get a
// real human playtest pass, per the original balance flag.

export const DIG_BASE_DIM = 5;
export const DIG_MAX_DIM = 9;

// Board grows by +2/dimension exactly at each checkpoint (level 3, 6, 9, …),
// capped at DIG_MAX_DIM — literalizes "every 3rd level is bigger."
export function calcDigBoardDim(level: number): number {
  return Math.min(DIG_MAX_DIM, DIG_BASE_DIM + 2 * Math.floor(level / 3));
}

// Reserved checkpoint hook — now hooked up to actual boss twists (see digBosses.ts).
export function isDigCheckpointLevel(level: number): boolean {
  return level > 0 && level % 3 === 0;
}

export const DIG_BOMB_DENSITY_BASE = 0.08;  // was 0.12 — safer start, see note above
export const DIG_BOMB_DENSITY_STEP = 0.006; // was 0.008 — gentler ramp
export const DIG_BOMB_DENSITY_MAX = 0.20;   // was 0.22

export function calcDigBombDensity(level: number): number {
  return Math.min(DIG_BOMB_DENSITY_MAX, DIG_BOMB_DENSITY_BASE + (level - 1) * DIG_BOMB_DENSITY_STEP);
}

export const DIG_EMPTY_FRACTION = 0.30;

// A level is cleared once at most this many hidden non-bomb tiles remain —
// forgives the last few highest-risk clicks rather than demanding a literal
// 100% clear. isDigLevelClearable() in digLogic.ts is the buffer-aware check;
// isDigBoardFullyCleared() (strict, zero hidden non-bomb tiles) still exists
// for a possible future "Perfect Clear"-style bonus.
export const DIG_CLEAR_BUFFER = 2;

// ─── Cash value ────────────────────────────────────────────────────────────────

// Plain Dirt's base value is deliberately low unskilled — the Dirt Value node
// (3 levels, digMeta.ts) raises it back up to what it used to always be ($4).
export const DIG_CASH_BASE = 1;
export const DIG_DIRT_VALUE_BY_LEVEL = [2, 3, 4]; // index = dirt_value_1 level - 1
export const DIG_CASH_PER_LEVEL = 1.2;

export function calcDigCashBase(level: number, dirtValueLevel: number): number {
  const base = dirtValueLevel > 0
    ? DIG_DIRT_VALUE_BY_LEVEL[Math.min(dirtValueLevel, DIG_DIRT_VALUE_BY_LEVEL.length) - 1]
    : DIG_CASH_BASE;
  return base + (level - 1) * DIG_CASH_PER_LEVEL;
}

// Ore ladder — dirt/copper are v1's originals; silver/gold/platinum/diamond are
// the expansion from the user's future-ideas notes (see CLAUDE.md). Each tier's
// *availability* is gated by the matching Vein upgrade node (see digMeta.ts) —
// the tier existing in this table doesn't mean it can roll; generateDigBoard
// only offers a tier once its Vein node is owned.
export const ORE_TIERS: { id: OreTierId; name: string; mult: number }[] = [
  { id: 'dirt', name: 'Dirt', mult: 1.0 },
  { id: 'copper', name: 'Copper Ore', mult: 2.0 },
  { id: 'silver', name: 'Silver Ore', mult: 4.0 },
  { id: 'gold', name: 'Gold Ore', mult: 8.0 },
  { id: 'platinum', name: 'Platinum Ore', mult: 16.0 },
  { id: 'diamond', name: 'Diamond', mult: 32.0 },
];

// Copper has no baseline chance anymore — like every other tier, it's a 0%
// candidate until copper_vein_1 is owned (see generateDigBoard). Once owned,
// its roll chance is DIG_BASE_COPPER_CHANCE + the current level's bonus below
// — Copper Vein is a 2-level node, level 2 just spawns it more often, index =
// copper_vein_1 level - 1.
export const DIG_BASE_COPPER_CHANCE = 0.15;
export const DIG_COPPER_VEIN_BONUS_BY_LEVEL = [0.25, 0.40];
export const DIG_HIGHER_VEIN_BONUS = 0.10;   // each further vein node (Silver/Gold/Platinum/Diamond) adds this to ITS tier's roll chance

// ─── Charges ─────────────────────────────────────────────────────────────────

export const DIG_BASE_CHARGES = 5;      // was 20 — a fresh run is now a tiny, deliberately tight teaser

// Pickaxe (root node) is now a 3-level ladder rather than a single flat add —
// each level's TOTAL charge count (not a delta), index = pickaxe_1 level - 1.
export const DIG_PICKAXE_CHARGES_BY_LEVEL = [7, 12, 15];
export const DIG_PICKAXE_2_CHARGES = 8;  // Pickaxe II child node — flat add on top of the ladder's max

// ─── Nugget Luck ───────────────────────────────────────────────────────────────

export const DIG_NUGGET_CHANCE = 0.15; // Nugget Luck node: this fraction of dirt-tile digs pay out double

// ─── Scanner ───────────────────────────────────────────────────────────────────
//
// Two branches per the user's spec ("one skills up probability, the other how
// many bombs show up") — v1 nodes are single-tier, so the root node (Scanner
// Probability) doubles as "unlock + set its chance," and its child (Scanner
// Range) is the count branch. A future pass could split the root into its own
// probability ladder once there's a reason to (see CLAUDE.md future notes).

export const DIG_SCANNER_BASE_CHANCE = 0.12; // Scanner Probability: per empty-tile dig, chance to reveal a nearby bomb
export const DIG_SCANNER_BASE_COUNT = 1;     // how many bombs get revealed when the scanner triggers
export const DIG_SCANNER_COUNT_BONUS = 1;    // Scanner Range node adds this to the count

// ─── Durability / Strength / Bulk Click ────────────────────────────────────────
//
// Design decision (the user flagged this as needing a playtest to resolve an
// ambiguity — "does bulk click divide strength across tiles, or does each tile
// independently need to meet its own toughness?"): implemented as the SECOND,
// simpler model — each tile in a click's pattern is damaged by your FULL current
// strength independently (not divided/shared), and each independently needs its
// own cumulative damage to reach its own toughness before it's mined. This was
// chosen because it's simpler to reason about, cheaper to implement correctly,
// and doesn't require inventing a strength-splitting formula with no clear
// "correct" answer — but it's an explicit choice, not a proven-right one; revisit
// after real playtesting if the splash mechanic feels too strong/weak.
//
// Baseline was flipped this pass: EVERY tile (plain Dirt included) now needs
// DIG_BASE_TOUGHNESS hits by default — "the dirt requires 2 digs" per the
// user's request. Durability's job changed to match: instead of making ore
// tougher (redundant now that the baseline already is tough), it eases plain
// Dirt back down to 1 hit specifically, while actual ore tiers stay at the
// tough baseline regardless of Durability (ore is just naturally harder than
// dirt). Strength (a click deals 2 damage) still one-shots anything at the
// tough baseline, Durability or not.
// Durability is a 2-level node: level 1 eases plain Dirt down to 1 hit, level
// 2 extends that same relief to Copper ore too (higher tiers stay tough
// regardless — ore keeps getting naturally harder further up the ladder).
export const DIG_BASE_TOUGHNESS = 2;             // default hits needed to mine ANY tile, dirt or ore
export const DIG_DURABILITY_DIRT_TOUGHNESS = 1;  // Durability node: eased tiles drop to this many hits
export const DIG_DURABILITY_COPPER_LEVEL = 2;    // durability_1 level at which Copper also gets eased
export const DIG_BASE_STRENGTH = 1;              // damage dealt per click
export const DIG_STRENGTH_BONUS = 1;             // Strength node adds this (so a click deals 2 damage, one-shotting DIG_BASE_TOUGHNESS tiles again)
