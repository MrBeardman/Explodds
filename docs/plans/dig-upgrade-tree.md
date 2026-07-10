# The Dig — Upgrade Tree Catalog

Reference for brainstorming the meta-progression tree (`src/incremental/digMeta.ts`).
This is a snapshot of the current shipped structure, not a spec — reshuffle freely.

## Current topology

```
Durability (root, id: pickaxe_1, ⛏️, 3 levels: 5 → 7 → 12 → 15 total charges)
├── Dirt Value (id: dirt_value_1, 💵, 3 levels: $1 → $2 → $3 → $4 dirt cash)
│    └── Copper Vein (id: copper_vein_1, 🟠, 2 levels — UNLOCKS ONLY ONCE DIRT VALUE IS MAXED)
│         ├── Nugget Luck (id: nugget_luck_1, 🍀, 1 level)
│         └── Silver Vein (⚪) → Gold Vein (🟡) → Platinum Vein (⚙️) → Diamond Vein (💎)
│              (each 1 level, straight chain, each unlocks once the previous is owned)
├── Pickaxe (id: durability_1, ⚒️, 2 levels: Dirt eased to 1 hit → Copper eased too)
│    └── Strength (id: strength_1, 💪, 1 level) → Bulk Click (id: bulk_click_1, 🤜, 1 level)
└── Durability II (id: pickaxe_2, 🔋, 1 level: +8 charges on top of the root ladder)
     ├── Danger Sense (id: bomb_sense_1, 👁️, 1 level) → Danger Sense II (id: bomb_sense_2, 👁️‍🗨️, 1 level)
     └── Scanner (id: scanner_prob_1, 📡, 1 level) → Scanner Range (id: scanner_count_1, 📶, 1 level)
```

Rendered with Durability II above the root and the other two branches below it
(`DigUpgradeTree.tsx`'s `upIds`) — purely a visual balance choice, easy to flip.

## Why the id and the display name don't match for two nodes

`pickaxe_1` (root) and `durability_1` (child) kept their **original ids** from
before a naming swap — a node's id is wired directly into `digLogic.ts`/
`constants.ts` (`skills.pickaxe_1` drives charge count, `skills.durability_1`
drives per-tile hit count), and changing an id would mean writing a
localStorage migration for existing players' saved progress for a purely
cosmetic rename. So only `name`/`emoji`/tree position changed:

| id | reads as (name) | actually governs |
|----|------------------|-------------------|
| `pickaxe_1` | **Durability** (root) | total charges per run |
| `durability_1` | **Pickaxe** (child of root) | hits needed per tile (toughness) |

If you rename anything here going forward, prefer changing `name`/`emoji`
over `id` for exactly this reason.

## Full catalog (id → name → tooltip → cost/levels)

| id | name | emoji | parent | levels (cost each) | tooltip shown to player |
|----|------|-------|--------|---------------------|---------------------------|
| `pickaxe_1` | Durability | ⛏️ | *(root)* | $5 → $10 → $16 | "More charges per run — 3 levels (5 base → 7 → 12 → 15). Charges are how many total digs your pickaxe has left in it this run." |
| `pickaxe_2` | Durability II | 🔋 | Durability | $12 | "+8 more charges per run, on top of Durability's ladder." |
| `dirt_value_1` | Dirt Value | 💵 | Durability | $10 → $18 → $28 | "Raises plain Dirt's base value — 3 levels ($1 base → $2 → $3 → $4)." |
| `durability_1` | Pickaxe | ⚒️ | Durability | $10 → $20 | "A sharper pickaxe: one durability point (charge) now digs Plain Dirt in a single hit instead of two — level 2 extends that same relief to Copper ore too." |
| `copper_vein_1` | Copper Vein | 🟠 | Dirt Value *(needs Dirt Value MAXED)* | $8 → $16 | "Unlocks Copper ore (worth 2x plain dirt) — level 2 makes it spawn more often. No ore of any kind spawns without this. Unlocks once Dirt Value is fully maxed." |
| `nugget_luck_1` | Nugget Luck | 🍀 | Copper Vein | $12 | "Dirt tile digs have a chance to pay out double." |
| `silver_vein_1` | Silver Vein | ⚪ | Copper Vein | $14 | "Unlocks Silver ore (worth 4x plain dirt)." |
| `gold_vein_1` | Gold Vein | 🟡 | Silver Vein | $22 | "Unlocks Gold ore (worth 8x plain dirt)." |
| `platinum_vein_1` | Platinum Vein | ⚙️ | Gold Vein | $32 | "Unlocks Platinum ore (worth 16x plain dirt)." |
| `diamond_vein_1` | Diamond Vein | 💎 | Platinum Vein | $45 | "Unlocks Diamond (worth 32x plain dirt)." |
| `strength_1` | Strength | 💪 | Pickaxe | $16 | "Each click hits twice as hard, one-shotting tougher ore again." |
| `bulk_click_1` | Bulk Click | 🤜 | Strength | $24 | "Also strikes the tile to the right with full strength, same click." |
| `bomb_sense_1` | Danger Sense | 👁️ | Durability II | $8 | "Reveals the location of 1 bomb at the start of every level." |
| `bomb_sense_2` | Danger Sense II | 👁️‍🗨️ | Danger Sense | $14 | "Reveals 2 bombs per level instead of 1." |
| `scanner_prob_1` | Scanner | 📡 | Durability II | $10 | "Digging an empty tile has a chance to reveal a nearby bomb." |
| `scanner_count_1` | Scanner Range | 📶 | Scanner | $16 | "The Scanner reveals more bombs when it triggers." |

## Reveal / purchase gating

Two rules, both enforced by the single `isDigUpgradeRevealed(node, meta)`
helper (digMeta.ts) — shared by the tree's fog-of-war rendering AND the
actual purchase gate, so they can't disagree:

- **Default** — a node reveals/is buyable once its parent has reached level 1
  (owned at all).
- **`revealAt: 'maxed'`** — a node stays hidden until its parent is at its
  *maximum* level. Currently only Copper Vein uses this (gated on Dirt Value).
  It's a deliberate pacing choice: force a straight, focused early path down
  one branch instead of letting players spread one dollar across three
  branches at once. Worth considering for other branch points if playtesting
  shows the tree is too easy to spread thin across.

## Open questions for the next brainstorming pass

- Is "Durability II" pulling its weight as its own node, or should its +8
  charges just become a 4th level on the root ladder instead?
- Danger Sense/Scanner currently both hang off Durability II — is that the
  right home, or would they read better as children of Pickaxe (the
  "digging tool" branch) instead, now that Pickaxe no longer needs to also
  carry Strength/Bulk Click alone?
- Copper Vein and Pickaxe are the only two multi-level (2-level) nodes outside
  the two 3-level ladders (Durability, Dirt Value) — are there other nodes
  worth splitting into levels the same way (e.g. Nugget Luck's chance,
  Strength's damage)?
- Should the `revealAt: 'maxed'` gate be used again further down the ore
  ladder (e.g. Silver Vein maxed before Gold Vein reveals), or was Copper
  Vein a one-off pacing fix for the very start of the tree specifically?
- The Danger Sense/Scanner sub-branches are both 2-node straight chains —
  is there room for a 3rd tier on either, or a node that combines them
  (e.g. "Deep Scan": both effects at once, expensive, near the end of a run)?
- No tree-wide "keystone" legendary-tier node yet (Standard mode has
  Bombproof Boots/Synergist as its top-end relics) — is there room for one
  expensive capstone per branch once a branch is fully maxed?

Tuning numbers (costs, chances, damage values) are unchanged from before this
pass — see `src/incremental/constants.ts` for the actual formulas each node
reads from.
