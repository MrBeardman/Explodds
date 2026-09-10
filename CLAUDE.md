# Explodds — AI Developer Guide

Complete reference for continuing development. Read this before touching any code.

**Two separate games, one app.** `src/App.tsx` is a thin router (`mode: 'select' |
'standard' | 'incremental'`) in front of a `ModeSelect.tsx` chooser. Everything in
this guide up to "Incremental Dig Mode" below describes **Standard mode**
(`src/components/StandardGame.tsx` — the original single-mode `App.tsx`, moved
verbatim). **Incremental Dig Mode** is a fully separate game living under
`src/incremental/` — see its own section near the end of this file. The two modes
share zero state and (deliberately) very little code — `src/rng.ts` is the only
significant shared module.

---

## What This Game Is

**Explodds: Mine the Odds** is a debt-deadline roguelite built on a 5×5 Minesweeper grid.
Think CloverPit (endless pressure loop) with Balatro-style relics/consumables/packs.

The player survives **endless cycles**. Each cycle has a **DEADLINE** (cash amount) that
must be actively **deposited** — cash earned in attempts stays in the wallet until the
player chooses to commit it. They get **3 ATTEMPTS** per cycle (2 under Short Fuse).
Miss the deadline → **GAME OVER**. Meet it (via deposit, any time) → shop, then next
cycle with a bigger deadline.

This is NOT a 6-round game with a win condition. It is endless until the player fails.

**Two separate cash pools:** `wallet` (bettable, can hit $0) and `deposited` (locked
toward the deadline, earns interest, never bettable again). Depositing is the core
new decision this session added — see "Deposit & Interest" below.

**Boss cycles:** every 3rd cycle (3, 6, 9, …) is a boss cycle — no event card pick;
instead a seeded boss rule warps the whole cycle (see Bosses section). The shop
previews the upcoming boss so players can prep. Beating one pays +8🎫.

**Skill layer (see "Deduction Layer" below — read it before touching clicks):** EVERY
revealed safe tile (symbol or empty) shows a minesweeper-style number = count of adjacent
bombs. `src/deduction.ts` is the single source of truth for what number a tile shows and
what the player can PROVE from the visible board; the reducer tags every deliberate click
as **proven** or a **guess**, proven clicks build a deduction streak that feeds the
multiplier, a guess resets both streaks. Empty tiles pay nothing but no longer break the
streak. Clicking a 0-adjacency empty tile **cascades open connected safe tiles**
(`floodFillReveal`) like classic minesweeper — level 0 of the Cascade Sense meta-skill
reveals only the clicked tile, level 1 caps the chain at `CASCADE_LEVEL1_CAP` (6), level 2
is unlimited. The **first click of every attempt is a guaranteed-safe opening**: bombs are
*relocated* (swapped with a hidden safe tile, so the 💣 counter stays honest) out of the
clicked tile (Cascade Sense 0) or the plus shape around it (levels 1–2); Bombproof Boots
extends the single-tile guarantee to click 2. The **paytable**
(top-left) shows GENERAL odds + payout per symbol — weight-share and cash value at the
current bet/mult, the same formula whether you're still betting or mid-attempt. It is
**deliberately NOT counted from this specific board's remaining tiles** (that read as
noisy and board-specific rather than informative). Values that differ from a symbol's
pure base stats (event/boss/pack-boost in effect) render in a distinct color with a
hover tooltip showing the delta — see `getSymbolOdds` in gameLogic.ts.

**Starting-multiplier bonus is currently disabled** (confusing for playtesting). Head
Start and Momentum Core relics and the Mult Vial consumable are removed from the shop
pools — their `RelicId`/`ConsumableId` union entries and gameLogic formulas still exist
(harmless no-ops since they can never be owned), so re-enabling later is just adding
them back to `ALL_RELICS`/`ALL_CONSUMABLES` in constants.ts.

**Modifiers: cycle-scoped picks + a few permanent traits.** An event-card pick lasts
THIS cycle (`cycle_events`). Picking the same card a second time in a run promotes it
to a permanent **trait** (`traits`, max `MAX_TRAITS` = 3); `event_history` remembers
single picks. `active_events` is always the derived union (traits + cycle_events) and
is the only thing gameplay checks read — `selectEventCard`/`startNextCycle` are the
only writers. `drawEventCards` excludes traits from the draw.

**Packs & boosts:** the shop sells cash-funded packs (`📦`) that reveal 3 candidate
permanent symbol boosts (frequency or payout, on a specific symbol) — pick 1, keep it
forever. This is the "build a strategy around one symbol" layer.

**Balance harness:** `npm run bots` (scripts/playtest-bots.mjs) is the real one — it
bundles `src/gameLogic.ts` + `src/deduction.ts` with rolldown into `.playtest/` and plays
whole runs through the actual reducer with a random clicker and a constraint-solving bot
(perfect or noisy deducer, any bet fraction, any relics), reporting cycles survived,
bust rate and the proven/guess split. Modes: `profiles` (default), `bycycle`, `trace
<seed>`, `density <cascadeLevel>`. `npm run sim` (scripts/sim.mjs) is the older
hand-mirrored Monte-Carlo — its "skill" knob is a flat risk discount that cannot model
deduction, so use it only as a formula cross-check; keep its PARAMS block in sync anyway.
Targets (bots, median cycles): random ~2, noisy deducer 3–4, perfect deducer at min bet
~6, perfect deducer betting 30% ~6–9 (more with deduction relics), nobody immortal. Full
findings + rationale: `docs/plans/standard-loop-review.md`.

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | React 19 + Vite 8 |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 + CSS custom properties |
| State | Single `useReducer` in `App.tsx` |
| RNG | Seeded mulberry32 (`src/rng.ts`) |

---

## File Map

```
public/sfx/           — SFX .wav files (placeholders from `npm run sfx`; drop in
                        licensed files with the same names to replace)
scripts/
├── sim.mjs           — Monte-Carlo balance harness (`npm run sim`)
└── gen-sfx.mjs       — Placeholder WAV synthesizer (`npm run sfx`)
src/
├── types.ts          — All TypeScript interfaces (GameState, Tile, SymbolBoost, etc.)
├── constants.ts      — Symbols, relics, consumables, event cards, bosses, packs, formulas
├── gameLogic.ts      — All pure game functions (no React)
├── meta.ts           — Cross-run meta-progression: skill catalog + localStorage persistence
├── rng.ts            — Seeded RNG utilities
├── sound.ts          — File-based SFX manager (mute persisted in localStorage)
├── App.tsx           — useReducer + centered layout + LeftPanel + useSounds hook
├── index.css         — CSS variables, animations, stat cards, rarity colors
└── components/
    ├── Grid.tsx           — 5×5 tile grid + adjacency numbers + bust flash + post-bust reveal + ⓘ overlay
    ├── HUD.tsx            — Right rail: MULT+streak (top), boss rule, attempts, modifier chips
    ├── CycleHeader.tsx    — Slim cycle number + boss countdown, ABOVE the board
    ├── Paytable.tsx       — Left rail top card: GENERAL symbol odds + payout (not board-specific);
    │                        also reused inline inside Shop.tsx behind the 👁 ODDS toggle
    ├── RelicShelf.tsx     — Horizontal relic row under the grid
    ├── Shop.tsx           — Centered modal (odds peek + packs + consumables + relics + next-boss preview)
    ├── DebugPanel.tsx     — Dev-only testing console (🛠 top bar, import.meta.env.DEV gated)
    ├── EventChoice.tsx    — Full-screen untimed modifier pick (normal cycles)
    ├── BossIntro.tsx      — Full-screen boss reveal (boss cycles)
    ├── ComboOverlay.tsx   — Animated combo notifications above grid
    ├── ConsumablePlacement.tsx — Pre-attempt tile placement overlay
    ├── ResultsOverlay.tsx — Full-screen post-cashout breakdown (RESULTS phase)
    ├── GameOver.tsx       — Full-screen overlay (not navigation)
    ├── StartScreen.tsx    — Landing screen (logo.png) + SKILLS button
    └── SkillTree.tsx      — Start-screen overlay for spending prestige on meta-skills
```

---

## State Shape (GameState — src/types.ts)

```typescript
phase: 'START' | 'EVENT_CARD' | 'BOSS_INTRO' | 'BET' | 'PLACEMENT' | 'CLEARING' | 'BUST_FLASH' | 'RESULTS' | 'SHOP' | 'GAME_OVER'

// Economy — two SEPARATE pools, wallet is bettable, deposited is locked toward the deadline
wallet: number        // player's cash (starts $150)
tickets: number       // second currency for relics (starts 0)

// Cycle
cycle_number: number  // starts 1, never resets
deadline: number      // cash that must be DEPOSITED (not just held) to pass this cycle
deposited: number     // committed toward deadline — moved OUT of wallet, resets to 0 each cycle
attempts_remaining: number  // 3 per cycle (2 under Short Fuse boss), counts down
bomb_suit_used: boolean     // Bomb Suit relic — resets each cycle

// Attempt
current_bet: number         // set by slider, deducted at PLACE BET
attempt_earnings: number    // accumulated this attempt (not in wallet yet)
multiplier: number          // grows per symbol tile cleared
carry_multiplier: number    // Momentum Core carry into next attempt (else 1.0)
clicks_this_attempt: number // Bombproof Boots first-click detection
streak: number              // consecutive symbol tiles (empty breaks it)
streak_5_given/10/15        // milestone flags — prevent double-trigger
banana_tile_earnings[]      // for Banana Split retroactive ×2 calculation
tiles_cleared / magnet_clears

// Board
board: Tile[]               // 25 tiles, empty between attempts
bombs_this_attempt: number
lucky_board_used: boolean   // Lucky Board event: first attempt no empties

// Combos
combos_triggered: string[]  // which combos fired this attempt (one-shot each)
active_combo_display: ComboDisplay[]  // for overlay animation
combo_id_counter: number    // unique IDs for React keys

// Modifiers — active_events STACKS PERMANENTLY, never reset mid-run
active_events: EventCardId[]       // every modifier ever picked, still active
active_boss: BossId | null         // set on boss cycles (3, 6, 9, …)
event_card_options: EventCardId[]  // 3 options (empty on boss cycles)
relics: RelicId[]
consumables_owned: ConsumableId[]
consumables_placed: { tile_index, type }[]  // set during PLACEMENT phase
placement_queue / placing_index            // drives ConsumablePlacement
pending_scanner_axis: 'row' | 'col' | null
boosts: SymbolBoost[]       // permanent packs boosts, e.g. { symbol: 'cherry', axis: 'frequency' }
skills: Record<SkillId, number>  // meta-progression snapshot, taken once at createInitialState()

// Shop (populated when phase → SHOP)
interest_earned_this_cycle  // accumulated interest ticks this cycle (shop header display)
packs_opened                // drives pack price scaling (PACK_BASE_PRICE + n × PACK_PRICE_STEP)
pending_pack_choices        // 3 candidate SymbolBoost[] mid-reveal, or null
shop_consumables / shop_relics
shop_consumables_rerolled / shop_relics_rerolled  // 2🎫 per reroll, once each

// Results overlay (populated by handleCashout, consumed by DISMISS_RESULTS)
pending_results: ResultsBreakdown | null  // itemized cash/ticket lines shown by ResultsOverlay
pending_next_phase: GamePhase | null      // the phase transition handleCashout already computed

// Run stats
cycles_survived / total_earned / highest_multiplier / best_streak / seed
```

---

## Phase Flow

```
START → [click NEW RUN]

START_GAME → EVENT_CARD
  (full-screen untimed pick — EventChoice.tsx; no auto-select timer)

Boss cycles (3, 6, 9, …): startNextCycle → BOSS_INTRO instead of EVENT_CARD
  (BossIntro.tsx full-screen reveal; CONFIRM_BOSS → toBetPhase())

SELECT_EVENT_CARD → BET  (via toBetPhase; APPENDS to active_events, never replaces)
  (bet slider, PLACE BET button, deposit quick-buttons — all available here)

DEPOSIT (only legal in BET phase):
  amount clamped to [0, min(wallet, deadline − deposited)]
  wallet -= amount; deposited += amount
  if deposited >= deadline: resolveCycleSuccess() — cycle ends NOW, remaining attempts unused
  else if wallet <= 0: resolveCycleFailure()

PLACE_BET:
  wallet -= bet  (immediately)
  generate board
  if placeable consumables (defuser/lucky_tile): → PLACEMENT
  else: → CLEARING

CLEARING (tiles clickable):
  - Symbol hit → earn cash, check combos
  - Empty hit  → streak = 0, no cash, shows adjacent-bomb count (cascade extent
                  gated by state.skills.cascade — see Meta-Progression section)
  - Bomb hit   → phase = BUST_FLASH, attempts_remaining--, attempt_earnings = 0
                  +1 ticket (complete attempt) — NO interest, NO deposit change
  - CASHOUT    → handleCashout computes wallet += earnings + interest tick (see
                  below), attempts_remaining--, AND the phase it would transition
                  to (toBetPhase() or settleFinalAttempt()) — but instead of
                  applying that phase immediately, it stores it in
                  pending_next_phase and an itemized pending_results, then sets
                  phase = RESULTS. DISMISS_RESULTS (ResultsOverlay's CONTINUE
                  button) is what actually applies pending_next_phase.

BUST_FLASH (~700ms auto flash, then a manual full-board reveal):
  App.tsx runs a 700ms timer (matches the .bust-flash CSS animation) that flips
  local `bustRevealReady` true — Grid then renders every hidden tile's true
  content (revealAll prop) and LeftPanel swaps the CASHOUT button for a
  CONTINUE button. Only clicking CONTINUE dispatches BUST_FLASH_END:
  if attempts > 0: toBetPhase()
  if attempts = 0: settleFinalAttempt()

RESULTS (shown after every cashout, not on bust):
  ResultsOverlay reads state.pending_results (cash/ticket breakdown, before/after
  wallet+ticket totals) — counts the total up, "flies" it into the wallet/ticket
  stat cards (pulse + value swap), lists every line item. CONTINUE dispatches
  DISMISS_RESULTS → dismissResults() applies pending_next_phase (BET, SHOP, or
  GAME_OVER — whatever handleCashout already resolved) and clears both pending_*
  fields.

toBetPhase() — the only true dead end:
  if wallet <= 0 AND deposited < deadline: resolveCycleFailure() (can neither bet nor deposit)
  else: → BET
  (wallet between 0 and min-bet is LEGAL — the player can still deposit what's left)

settleFinalAttempt() — called when attempts_remaining hits 0:
  auto-sweep min(wallet, deadline − deposited) into deposited first (so forgetting to
  deposit on the last attempt doesn't cost you), THEN:
  if deposited >= deadline: resolveCycleSuccess()
  else: resolveCycleFailure()

resolveCycleSuccess(): +5 tickets (pay in full), +8 more if boss cycle, generateShop() → SHOP
resolveCycleFailure(): → GAME_OVER

SHOP → [START CYCLE N+1] → EVENT_CARD (or BOSS_INTRO)
```

---

## Deposit & Interest (the core mechanic this session added)

```typescript
// Interest — paid on CASHOUT ONLY (never on bust), proportional to what's
// already deposited. This is the reward for depositing EARLY in a cycle:
// every subsequent successful cashout that cycle pays another tick.
interestRate(state):
  base = 0.08 (BASE_INTEREST_RATE)
  +0.05 if Compound Chip relic
  ×2 if Inflator boss
  wallet += deposited × interestRate()   // on every non-bust cashout

// Deposit (handleDeposit) — the only way `deposited` changes mid-cycle
amount = clamp(requested, 0, min(wallet, deadline − deposited))
wallet -= amount; deposited += amount
→ resolveCycleSuccess() if deposited now >= deadline (skips remaining attempts!)
→ resolveCycleFailure() if that drained wallet to 0 without meeting the deadline
```

**Why this matters for balance:** depositing early banks interest across the rest of
the cycle's cashouts, but locks cash away from betting and can end the cycle before
all 3 attempts are used (forgoing extra tickets/earnings). Deferring deposits keeps
max betting flexibility but earns zero interest that cycle. Both are valid strategies
— `scripts/sim.mjs` models both and takes whichever wins per run, same as a real player would.

---

## Meta-Progression / Skill Tree (src/meta.ts)

Persists **across runs** in `localStorage` (key `explodds_meta`), completely
independent of `GameState`/seed — a run's `state.skills` is a one-time snapshot
taken in `createInitialState()` via `loadMeta().skills`; gameplay always reads
that snapshot, never `localStorage` directly (same pattern as relics/events
living in run state instead of being re-derived mid-run).

```typescript
// src/meta.ts
interface MetaProgress { prestige_points: number; skills: Record<SkillId, number>; }

SKILLS: SkillDef[]  // catalog — id, name, emoji, levels[] (each with cost to reach it)
loadMeta() / saveMeta(meta)     // localStorage read/write
calcPrestigeEarned(cyclesSurvived) = Math.ceil(cyclesSurvived / 2)
awardPrestige(cyclesSurvived)   // called once per run end, persists the award
upgradeSkill(id)                // spends prestige_points, bumps skills[id], persists
```

**Currency**: prestige points, earned once per run when it ends (Game Over —
`App.tsx` awards it in a `useEffect` keyed on `phase === 'GAME_OVER'`, guarded by
a `useRef` so it can't double-fire). Spent on the **Start Screen** via the
🌳 SKILLS button → `SkillTree.tsx` overlay (reads/writes `meta.ts` directly, no
GameState involvement at all).

**First skill: Cascade Sense** (`SkillId = 'cascade'`, 3 levels) gates how far
the minesweeper flood-fill (`floodFillReveal` in gameLogic.ts) can chain:
- **Level 0 (new-player default)** — `handleTileClick`'s empty-tile branch skips
  `floodFillReveal` entirely and reveals only the clicked tile. No chain at all.
- **Level 1** — `floodFillReveal(board, tileIndex, CASCADE_LEVEL1_CAP)` (cap = 6
  in constants.ts) — chain stops once it's revealed 6 tiles.
- **Level 2 (mastered)** — `floodFillReveal(board, tileIndex)` with no cap
  (`Infinity`), today's original unlimited cascade.

**Cascade Sense also sets the opening** (see `openingTiles` in gameLogic.ts): level 0
protects only the clicked tile; levels 1–2 protect the plus shape (clicked + 4 orthogonal
neighbours). A full 3×3 opening was tried and rejected — on a 5×5 it hands over 36% of
the board and a perfect deducer then proves everything at any bomb count.

**Second skill: Bomb Sense** (`SkillId = 'bomb_flag'`, 5 levels) lets the player
flag suspected bomb tiles during CLEARING for a bonus when the attempt ends:
- **Level 0 (new-player default)** — cannot flag at all (`maxPlayerFlags` returns 0,
  the FLAG BOMB button in the left panel doesn't render).
- **Levels 1-5** — flag up to N tiles per attempt, via `maxPlayerFlags(state) =
  min(state.skills.bomb_flag, state.bombs_this_attempt)` (gameLogic.ts) — the skill
  level is naturally capped by however many bombs actually exist on the current
  board, so a low-bomb early cycle can't be fully flagged even at level 5.
- Toggling **FLAG BOMB** sets `state.flag_mode = true` (mutually exclusive with
  scanner mode — activating either cancels the other); while active, `TILE_CLICK`
  routes to `toggleFlag(state, index)` instead of `handleTileClick`'s normal
  reveal logic, adding/removing that index from `state.player_flags` (does NOT
  touch `Tile.state` — this is a separate array, not the same `'flagged'`
  `TileState` that Bomb Detector uses to mark a *known* bomb still-clickable).
  Toggling off an existing flag is always allowed; adding a new one is blocked once
  `player_flags.length` hits the cap.
- `calcFlagBonus(state)` checks each flagged index against `state.board[i].type
  === 'bomb'` and pays `BOMB_FLAG_BONUS` (constants.ts) per correct guess — called
  from BOTH `handleCashout` (itemized as a cash line, `"🚩 Bomb flags (N correct)"`)
  and `handleTileClick`'s bomb-hit/bust branch (added to wallet silently, same
  as Bomb Suit/Insurance refunds — bust has no itemized breakdown). Wrong flags
  have no penalty. `player_flags`/`flag_mode` reset to `[]`/`false` everywhere an
  attempt ends (handleCashout, the bust branch, handlePlaceBet, startNextCycle).

**Unlocks & daily run (meta.ts too).** `MetaProgress` also holds `unlocks: RelicId[]`
and `daily: DailyRecord | null`. `UNLOCKABLES` lists feats (`check(run_stats +
cycles_survived)`) that permanently add a relic to the shop pool; `GameState.run_stats`
tracks the feats during a run (`perfect_clear_best_cycle` in resolveCombosAndFinalize,
`best_flawless_proven` in handleCashout, `bosses_beaten` in resolveCycleSuccess).
`recordRunEnd(run)` (replaces the old `awardPrestige`) is the single Game-Over writer:
prestige + new unlocks + daily record, called once from StandardGame's GAME_OVER effect,
which keeps the returned `newUnlocks`/`daily` in local state for `GameOver` to announce.
**Daily run**: `createInitialState({ daily: true })` seeds the run with `dailySeed()`
(hash of the UTC date) and sets `is_daily`; the Start Screen's 📅 DAILY RUN button shows
today's best from `dailyRecord()`. The Start Screen also lists every unlockable with its
requirement.

**Adding skill #3+**: append to `SKILLS` in meta.ts (id, name, emoji, per-level
name/description/cost), add the id to the `SkillId` union in types.ts, add it to
`defaultMeta().skills` in meta.ts, then hook `state.skills[id]` into whichever
gameLogic function the skill should affect — same shape as skills #1/#2.

**Debug**: DebugPanel's SKILLS section directly patches `state.skills` for
testing THIS run only — it does not touch `localStorage`/prestige at all. Real
progression only ever happens via the Start Screen's SkillTree.

---

## Core Formulas

```typescript
// Deadlines
cycle 1–5: [60, 90, 120, 160, 200]
cycle 6+:  Math.round(prev * 1.3 / 10) * 10
"The house notices": next deadline = max(curve, round(wallet × DEADLINE_WALLET_CHASE(0.6)))
  — the backstop against runaway compounding; irrelevant for normal bankrolls
Inflator boss: deadline × 1.25 (applied in startNextCycle, after the chase)

// Min bet — RISES EVERY CYCLE, not flat
minBet = MIN_BET_BASE(10) + cycle_number × MIN_BET_PER_CYCLE(2)
Greed Mode event: max(minBet, GREED_MODE_MIN_BET=25)

// Board growth (BOARD_GROWTH / calcBoardCols) — the second difficulty axis
cycles 1-5: 5×5 | 6-9: 6×6 | 10+: 7×7      (state.board_cols; board.length === cols²)
// Attempts per cycle — the third axis (attemptsForCycle): 3, then 2 from
// LATE_GAME_ATTEMPTS_FROM_CYCLE (10); Short Fuse forces 2 any time

// Base bombs per cycle: exact counts on the 5×5 opening cycles, then a DENSITY
// curve on the growing board. Densities sit AT OR BELOW expert minesweeper
// (~21%) — a human playtest found 11 bombs on a 6×6 (30%) unplayable.
cycle 1-5: [4, 4, 5, 5, 6]
cycle 6+:  round(tiles × min(BOMB_DENSITY_BASE(0.16) + (cycle−6) × 0.008, BOMB_DENSITY_MAX(0.22)))

// Dynamic bomb count (from bet) — the bet is a RISK dial, see effectiveBombs()
bombs = base + floor((bet / wallet) × BOMB_RATIO_SLOPE(6)), capped at base + 4,
        hard cap floor(tiles × MAX_BOMB_SHARE(0.30))
+3 extra if Danger Pay event active
+1 if Loaded Dice relic
−2 if High Roller relic and bet ≥ 50% of wallet
−1 Collateral: if deposited ≥ 75% of the deadline (COLLATERAL_DEPOSIT_FRAC)

// Tile cash — SUB-LINEAR in the bet (the old linear 3 + 0.4×bet let a cleared
// board pay 12–35× the bet and any skilled run compounded without bound)
baseCash = TILE_CASH_BET_COEF(0.17) × bet ^ TILE_CASH_BET_EXP(0.9) × (25 / tiles)
   — normalised by board AREA so a full clear pays the same multiple on 7×7 as on 5×5
cash = baseCash × symbolModifier × multiplier
   [× 1.4 if Danger Pay]  [× 1.25 if Loaded Dice]
   [× 1.5 for star if Star Shower]
// The STAKE IS RETURNED on cashout (wallet += stake × fraction + winnings); a bust
// loses it. stakeReturnInfo(): fraction = min(1, revealedSafe / ceil(safeTiles ×
// STAKE_RETURN_CLEAR_FRAC(0.3))) — the full stake needs a real attempt; an early
// cashout returns it pro rata (this killed the "opening + one proven click, cash
// out, snowball" line a human playtester found). A full 5×5 clear ≈ 3× the stake.

// Flat cash rewards scale with the bet: flatCashScale(bet) = max(1, bet / MIN_BET_BASE)
// multiplies Cherry Rush/Star Power rewards, Hot Hands, streak-15 cash, Lucky Tile,
// Greed Chip and the Bomb Sense flag bonus. Shop CASH prices scale with the
// deadline: shopPriceScale(deadline) = max(1, deadline / calcDeadline(1)) multiplies
// consumable prices (getConsumablePrice) and pack prices (getPackPrice). Ticket
// prices don't scale (tickets are earned at flat rates).

// Symbol modifiers (getSymbolMod — takes full state, not just event/relic flags)
// 5 symbols only — coin was removed (too many symbols for a 5×5 grid; see
// Common Pitfalls). Lucky Charm relic repointed from "guaranteed coin tile"
// to "guaranteed diamond tile" as part of the same change.
diamond 1.0 | cherry 0.8 | banana 1.2 | star 1.5 | bell 0.9
× BOOST_PAYOUT_MULT (1.25) per matching payout boost stack, multiplicatively

// Symbol weights (getSymbolWeights — drives board generation AND the paytable)
base weight × 2 if matching event card (cherry_season/banana_bonanza/star_shower)
× 0.3 if Blightbringer boss picks this symbol; monoculturist zeroes all but 2 symbols
× BOOST_FREQUENCY_MULT (1.5) per matching frequency boost stack, multiplicatively

// Starting multiplier per attempt (handlePlaceBet)
start = 1.0 (1.3 with Head Start) + (carry_multiplier − 1) + 0.5 if Mult Vial
carry_multiplier = 1 + (prev mult − 1) × 0.5 with Momentum Core (cashout AND bust), else 1.0

// Multiplier growth per symbol tile (deliberately shallow — value lives in base cash;
// at 0.04/0.005 a cycle-1 full clear paid 7–9× the stake and the wallet went ×40)
gain = MULT_GAIN_BASE(0.02) + bombs × MULT_GAIN_PER_BOMB(0.003)
gain ×= 1.2 if Adrenaline Core relic
+DEDUCTION_MULT_GAIN (0.03) per PROVEN click (LOGICIAN_MULT_GAIN 0.06 with Logician)

// Streak milestones (streak = consecutive symbol tiles; empties PAUSE it, a GUESS resets it)
streak 5:  +0.10 mult (or +$8 × flatCashScale if Hot Hands relic)
streak 10: +0.20 mult
streak 15: +$5 × flatCashScale

// Cashout tickets (ALL additive)
+1 complete attempt (cashout OR bust — awarded on bust directly in handleTileClick)
+2 successful cashout specifically (not on bust)
+3 profitable clear (winnings ≥ bet × PROFITABLE_EARNINGS_RATIO(1.0) — stake comes back on top)
+2 Flawless: guess_clicks === 0 && proven_clicks ≥ FLAWLESS_MIN_PROVEN(4)
+2 if Ticket Printer relic
+5 pay deadline in full (resolveCycleSuccess)
+8 beating a boss cycle (resolveCycleSuccess, on top of the +5)

// Cashout modifiers (order: greed_mode ×1.3 → taxman ×0.75 → chain_reaction ×1.5 → greed_chip +$3 → interest tick)
+30% if Greed Mode event
−25% if Taxman boss (interest tick below is untaxed)
×1.5 if Chain Reaction relic and 2+ combos triggered this attempt
+$3 if Greed Chip relic

// Bust refunds (best single protection applies, in this order)
Bomb Suit (full bet, once/cycle) > Insurance Ticket (full bet, consumed) > Insurance Policy (30%)

// Opening (baseline rule, not paywalled) — see relocateBombs()/openingTiles()
Click 1 of every attempt can never be a bomb: bombs under the protected tiles are
SWAPPED with random hidden safe tiles (count unchanged). Cascade Sense 0 protects the
clicked tile, levels 1–2 the plus shape around it. Bombproof Boots extends the
single-tile guarantee to click 2. Gut Feeling relic: once per CYCLE, a guess that
would bust is spared the same way. Cashout needs clicks_this_attempt ≥ 2 (reducer
guard) so "free click, cash out" isn't a loop.

// Bomb Sense flag bonus (Bomb Sense meta-skill, calcFlagBonus)
+BOMB_FLAG_BONUS ($8) per correctly-flagged bomb, paid on BOTH cashout
(itemized cash line) AND bust (added to wallet silently, no penalty for wrong flags)
```

---

## Deduction Layer (src/deduction.ts)

Pure functions, no React, shared by the Grid (rendering) and the reducer (tagging):

```typescript
numberNeighbors(state, i)         // 8-neighbourhood, or diagonals only under Mirror
displayedNumber(state, board, i)  // number the tile SHOWS, or null: revealed safe tiles only,
                                  // symbol tiles go dark under Blackout, Liar tile is off by one
rowColTotals(board)               // Ledger relic (only ledgerRow(state, board) — the last
                                  // revealed-in row — is shown/used; cols computed, not shown)
analyzeBoard(state, board)        // { safe, bombs, hasInfo } — constraint propagation to a
                                  // fixpoint over: every shown number, hinted (safe) and
                                  // ⚠/scanner-revealed (bomb) tiles, the 💣 counter as a
                                  // global constraint, Ledger row totals; plus the subset rule
isProvablySafe(state, board, i)
```

In `handleTileClick`, every click after the free opening is `proven =
analyzeBoard(state, state.board).safe.has(i)` (computed on the board the player SAW,
before any relocation). State: `deduction_streak` (proven in a row; guess → 0),
`proven_clicks`/`guess_clicks` (per attempt, for the Flawless ticket bonus), and
`Tile.proven` (green edge on the tile). A guess also resets the symbol streak; an empty
tile no longer resets anything. Never call the game "proven" using information the
player couldn't see — that's why Grid reads `displayedNumber`, not `adjacentBombCount`
(which is the honest count, still used by the flood fill and the debug ghost view).

Bot harness: `scripts/playtest-bots.mjs` uses the same `analyzeBoard` from the bundle, so
its proven/guess split is exactly the game's.

## Combo System

Each fires **once per attempt**, checked after every symbol tile click.
State tracks `combos_triggered: string[]`.

| Combo | Trigger | Reward | Relic upgrade |
|-------|---------|--------|---------------|
| Cherry Rush | 3+ cherries, same row OR col | +$12 | Cherry Picker → $20 |
| Banana Split | 2 adjacent bananas | ×2 each (retroactive) | Banana Baron → ×3 |
| Star Power | 3+ stars | +$18 | Star Magnet → $28 |
| Bell Storm | 4+ bells | streak = 10 | Bell Captain → streak = 20 |
| Diamond Run | 4+ diamonds | +15% of attempt_earnings | Diamond Dealer → +25% |
| Perfect Clear | every non-bomb tile on the board revealed | +30% of attempt_earnings so far | — (no relic upgrade yet) |

Banana Split retroactive: tracked via `banana_tile_earnings[]`.
When triggered: `attempt_earnings += sum(banana_tile_earnings) × (mult - 1)`.

Perfect Clear is checked via `isBoardFullyCleared(board)` (gameLogic.ts) —
`board.every(t => t.type === 'bomb' || t.state === 'revealed' || t.state === 'empty_revealed')`
— on BOTH the symbol-tile and empty-tile branches of `handleTileClick` (an
empty tile can just as easily be the one that completes the board). One-shot
per attempt via `combos_triggered`, same mechanism as the other combos.

Synergist relic hooks every combo block above (see Relics) to push a payout
`SymbolBoost` for that combo's symbol into `state.boosts` — it does NOT hook
Perfect Clear (that one isn't tied to a single symbol).

`ComboInfoOverlay` (Grid.tsx, opened via the ⓘ button) represents each combo's
trigger condition graphically via `MiniPattern` — small mini-tile strips of
that combo's emoji, not text. Tight/touching tiles (`touching: true`) mean
"must land in a line/adjacent" (Cherry Rush, Banana Split); spaced tiles
(`touching: false`) mean "just need this many anywhere on the board" (Star
Power, Bell Storm, Diamond Run, Coin Jackpot, Perfect Clear).

---

## Board Generation (generateBoard)

```
RNG seed: state.seed + cycle_number × 1000 + attempt_key × 100

1. Count empties:
   base = round(non-bomb × 0.25)
   if Glutton boss: +4
   if safe_zone event: -4
   if safe_digger relic: -3
   if empty_eraser consumable: -2
   if lucky_board event AND first attempt: 0 (no empties)

2. Build type array: [bomb×n, symbol×m, empty×k]
3. Shuffle, assign to tiles
4. Assign symbols via weightedChoice (getSymbolWeights — event/boss/boost modified)
5. Lucky Charm relic: force one coin tile
6. Scatter Reveal consumable: hint 3 safe tiles (state = 'hinted')
7. Surveyor relic: one random empty starts fully 'empty_revealed'
8. Bomb Detector consumable: 2 random bombs → state = 'flagged' (⚠, still clickable)
```

---

## Relics (22 currently sold, 24 defined — src/constants.ts ALL_RELICS)

Rarity: common (gray) / rare (blue) / legendary (gold) — shown as border colors.
Head Start and Momentum Core are temporarily pulled from `ALL_RELICS` (starting-mult
bonus disabled for playtesting) — listed below for reference but not in the shop pool.

| ID | Effect | Cost | Rarity |
|----|--------|------|--------|
| greed_chip | +$3 flat per cashout | 8🎫 | common |
| adrenaline_core | Mult grows ×1.2 faster | 10🎫 | rare |
| cherry_picker | Cherry Rush → $20 | 10🎫 | common |
| banana_baron | Banana Split → ×3 | 12🎫 | rare |
| star_magnet | Star Power → $28 | 8🎫 | common |
| bell_captain | Bell Storm → streak 20 | 10🎫 | rare |
| diamond_dealer | Diamond Run → +25% | 12🎫 | rare |
| safe_digger | 3 fewer empties/board | 8🎫 | common |
| bomb_suit | First bust/cycle: bet refunded | 15🎫 | rare |
| hot_hands | Streak 5 bonus: +$8 (not +0.2 mult) | 10🎫 | common |
| lucky_charm | 1 guaranteed diamond tile/board | 12🎫 | rare |
| ticket_printer | +2 extra 🎫 per cashout | 8🎫 | common |
| haggler | Consumables −30% (getConsumablePrice) | 8🎫 | common |
| surveyor | 1 empty starts revealed per board | 8🎫 | common |
| head_start *(not sold)* | Attempts start at ×1.3 mult | 10🎫 | common |
| compound_chip | +3% interest rate on deposited cash | 12🎫 | rare |
| momentum_core *(not sold)* | Keep 50% mult progress between attempts | 14🎫 | rare |
| insurance_policy | Busts refund 30% of bet | 12🎫 | rare |
| high_roller | Bets ≥ 50% wallet: −2 bombs | 12🎫 | rare |
| bombproof_boots | Extends the baseline safe-click guarantee to clicks 1 AND 2 | 20🎫 | legendary |
| synergist | Every combo permanently boosts that symbol's payout ×1.25 (stacks) | 16🎫 | legendary |
| chain_reaction | 2+ combos in one attempt: cashout earns ×1.5 | 14🎫 | rare |
| specialist | Packs favor your most-boosted symbol instead of avoiding it | 12🎫 | rare |
| ledger | The row you LAST revealed in shows its bomb total at the board's right edge (`ledgerRow`, reads `last_reveal_index`) | 14🎫 | rare |
| logician | Proven clicks give +0.06 mult instead of +0.03 | 12🎫 | rare |
| gut_feeling | Once per cycle, a guess that would bust ends the attempt as a cashout for HALF the winnings (stake kept) | 16🎫 | legendary |
| echo | After a bust, the next board starts with 2 empties already revealed | 10🎫 | common |
| second_sight *(unlock)* | Hinted (known-safe) tiles show their number before being revealed (`displayedNumber`) | 12🎫 | rare |
| cartographer *(unlock)* | Every board starts with 2 empties already revealed (Echo, always on) | 18🎫 | legendary |
| double_down *(unlock)* | Bets ≥ half the pre-bet wallet pay ×1.3 winnings (handleCashout) | 12🎫 | rare |
| loaded_dice | +1 bomb every board, every tile pays ×1.25 | 8🎫 | common |
| vault *(unlock)* | Deposited cash earns half its interest even on a bust | 12🎫 | rare |

**Archetype spines** (each has 4+ relics, so a run can lean into one): *Deduction* —
ledger, logician, echo, second_sight, cartographer, surveyor, bombproof_boots;
*Gambler* — high_roller, double_down, loaded_dice, bomb_suit, insurance_policy,
adrenaline_core; *Combo* — cherry_picker … diamond_dealer, synergist, chain_reaction,
lucky_charm; *Banker* — compound_chip, vault, greed_chip, ticket_printer, haggler.

**Locked relics** (`LOCKED_RELIC_IDS` in constants.ts) only enter the shop pool once
unlocked across runs — `relicPool(state)` filters by `state.unlocked_relics`, a snapshot
of `meta.unlocks` taken at `createInitialState()`. See "Unlocks & daily run" below.

`sixth_sense` was retired — numbers on every revealed tile is now the baseline rule
(it was a 6× run-length multiplier as a single relic). Ledger is deliberately
rows-only: rows+columns made most boards fully determined in the bot test. Gut Feeling
ends the attempt as a forced cashout (half winnings) rather than relocating the bomb — a
free relocation once per cycle let the perfect-deducer bot run 25+ cycles on that relic
alone. Ledger shows ONE row (the last revealed-in row): every row at once made low-density
boards fully determined. Cartographer's original "bomb-free 3×3 opening" made the bot
immortal in 80% of runs — it's now Echo-always-on.

Max 6 relics active by default (`state.max_relic_slots`, starts at `MAX_ACTIVE_RELICS`)
— buyable up the Relic Case shop item, see below. Relic reroll costs 2🎫.

**Combo-crafting trio** (added for build-around-combos strategies): `synergist` hooks
every combo-trigger block in `handleTileClick` (cherry_rush→cherry, banana_split→banana,
star_power→star, bell_storm→bell, diamond_run→diamond, coin_jackpot→coin), pushing a
payout `SymbolBoost` for that symbol straight into `state.boosts` — same stacking
mechanism as pack-bought boosts, just earned through play instead of bought. `sixth_sense` was retired
in the deduction rework (numbers on every revealed tile are now the baseline — see the
Deduction Layer section). `chain_reaction`
is a flat multiplicative reward in `handleCashout`, checked via
`state.combos_triggered.length >= 2` — inspired by Balatro/CloverPit's "synergy stacking"
design (see Design Notes in ROADMAP.md).

---

## Bosses (every 3rd cycle — src/constants.ts BOSSES, 9 total)

Selection: `getBossForCycle(seed, cycle)` — seeded shuffle of the pool, indexed by
boss ordinal, repeats after all 9. `state.active_boss` set in `startNextCycle`.
Boss cycles have NO event card. Beating one: +8🎫 (BOSS_REWARD_TICKETS).

| ID | Rule | Hook |
|----|------|------|
| monoculturist | Only 2 symbol types spawn (seeded pair) | getSymbolWeights |
| saboteur | Every 4th symbol cleared arms a new bomb | handleTileClick |
| blackout | Empty tiles show no adjacency numbers | Grid.tsx render |
| taxman | 25% tax on every cashout | handleCashout |
| glutton | +4 empty tiles per board | generateBoard |
| short_fuse | Only 2 attempts this cycle | startNextCycle |
| warden | Bet locked to 25% of wallet (getLockedBet) | reducer + LeftPanel |
| inflator | Deadline +25%, interest rate ×2 if beaten | startNextCycle + interestRate |
| blightbringer | One random symbol nerfed to 30% weight | getSymbolWeights |
| liar | One tile per attempt (seeded) shows its count ±1 — a "proven" click that trusts it can bust | deduction.ts `liarTile`/`displayedNumber` |
| mirror | Numbers count diagonal neighbours only | deduction.ts `numberNeighbors` |
| curfew | Attempt auto-cashes out after `CURFEW_CLICKS` (10) reveals | handleTileClick |
| mason | Bombs are laid in touching (orthogonal) pairs — re-placed after the shuffle, same count | generateBoard |

Blackout now hides numbers on SYMBOL tiles only (empties keep theirs) — i.e. it puts the
player back at the pre-rework information level instead of deleting the skill layer.

---

## Packs & Symbol Boosts (src/constants.ts, gameLogic.ts)

Permanent, stacking, symbol-targeted build layer — bought with **cash** (not tickets),
separate from relics. Two axes (`frequency`: weight ×1.5/stack, `payout`: modifier
×1.25/stack, both multiplicative per stack) plus a rarer "themed" kind that bundles both.

**3 unified shop slots, not an infinite-buy button.** Each shop visit offers exactly
`PACK_SLOT_COUNT (3)` slots (`state.shop_packs: ShopPackSlot[]`, same sold/reroll
pattern as consumables/relics) — each slot's `kind` is rolled independently via
`PACK_KIND_WEIGHTS` (40% frequency / 40% payout / 20% themed). `frequency`/`payout`
slots also roll a `huge` variant (`HUGE_PACK_CHANCE` 20%): 5 reveal choices instead
of 3 (`HUGE_PACK_CHOICE_COUNT`), priced ×`HUGE_PACK_PRICE_MULT` (1.8). Buying a slot
marks it `sold`; getting more requires a reroll (2🎫, `REROLL_PACKS`, regenerates all 3).

```
getPackPrice(state)                       = PACK_BASE_PRICE(18) + packs_opened × PACK_PRICE_STEP(4)
generatePackSlots(state)                  = PACK_SLOT_COUNT(3) ShopPackSlot, each independently
                                             rolled kind + (axis-only) huge chance
generatePackChoices(state, axis, count=3) = `count` DISTINCT-symbol candidates of the given
                                             axis, weighted AWAY from already-stacked symbols
                                             (or toward the Specialist leader — see below)
buyPack(state, index)                     → themed: grants BOTH stacks on the slot's fixed
                                             symbol directly (no reveal); frequency/payout:
                                             sets pending_pack_choices (3 or 5, per `huge`) and
                                             pending_pack_picks_remaining (1 normal, 2 huge)
pickPackBoost(state, boost)               → append to boosts[], remove that choice from
                                             pending_pack_choices, decrement picks_remaining;
                                             only clears to null once picks_remaining hits 0
rerollPacks(state)                        → fresh 3 slots at the current price (doesn't discount)
```

Huge packs let the player pick **2** of the 5 revealed choices, not just 1 — the
reveal stays open (with the already-picked choice removed) until
`pending_pack_picks_remaining` reaches 0. Normal (non-huge) packs still pick 1 of 3.

Handled entirely inside `Shop.tsx` as local reveal state (`pending_pack_choices` set
→ render a reveal instead of the normal shop sections) — **no new GamePhase**.
`NEXT_CYCLE` is disabled while a pack choice is pending (forces a pick before leaving).
`BUY_PACK` now takes a slot `index`, not an `axis` — kinds can repeat across the 3
slots (e.g. two `payout` slots in one visit), so axis alone no longer uniquely IDs a slot.

**Tooltip/label wording**: always show an explicit multiplier (`×1.5`, `×1.25`) or a
before→after pair, never a bare `+50%` — on a stat that's ALREADY a percentage (odds),
"+50%" reads as "+50 percentage points" to most players, which is wildly different
from the actual multiplicative change. See `Paytable.tsx`'s tooltip construction.

**Boss synergy:** Blightbringer nerfs a symbol regardless of investment — a build
leaning hard into one symbol is genuinely at risk from it (Balatro-style "your build
has a weakness" tension).

**Themed packs** — one of the 3 pack slots, fixed to a random symbol
(`PACK_THEMES` in constants.ts: Rich=diamond, Sweet=cherry, Ripe=banana,
Bright=star, Chime=bell — 5 themes, one per symbol, since coin was removed).
Unlike frequency/payout slots, there's **no reveal step**
— buying grants BOTH a frequency AND a payout stack on the fixed symbol immediately,
priced at `getPackPrice(state) × THEMED_PACK_PRICE_MULT (2.2)` since it bundles 2
guaranteed stacks instead of a gamble. Shares the `packs_opened` price-scaling counter
with the axis packs. It's a random roll among the 3 slots each visit (not a dedicated
section) — reroll the whole shop if you want a different symbol's theme.

**Specialist relic** biases pack generation the opposite way from the default:
`getLeaderSymbol(state)` finds the symbol with the most combined boost stacks (both
axes); with Specialist owned, `generatePackChoices` and the themed-pack symbol roll
both weight that leader symbol way up instead of anti-weighting it down, letting a
player double down on one symbol instead of naturally spreading across several.

---

## Relic Slots (src/gameLogic.ts, constants.ts)

`state.max_relic_slots` (starts at `MAX_ACTIVE_RELICS = 6`) replaces the constant
everywhere the relic-shelf cap is checked (`BUY_RELIC` reducer case, `Shop.tsx`
`relicsFull`, `RelicShelf.tsx` slot count) — **don't reintroduce a hardcoded
`MAX_ACTIVE_RELICS` check**, always read `state.max_relic_slots`.

**Relic Case** is a one-shot ticket purchase (`state.shop_relic_case: ShopRelicCaseItem
| null`), NOT a relic itself — it's consumed on purchase (`buyRelicCase`) rather than
occupying a shelf slot, and permanently raises `max_relic_slots` by 1. Price scales
with `state.relic_cases_bought` (`RELIC_CASE_BASE_PRICE(16) + bought × RELIC_CASE_PRICE_STEP(6)`),
capped at `MAX_ACTIVE_RELICS + MAX_BONUS_RELIC_SLOTS` (9 total) — past that,
`generateRelicCaseSlot` returns `null` and the shop section doesn't render. No reroll
(nothing to reroll into — it's a single fixed item).

---

## Consumables (8 currently sold — src/constants.ts ALL_CONSUMABLES)

Mult Vial is temporarily pulled from the pool (starting-mult bonus disabled).

| ID | Price | When applied | Effect |
|----|-------|-------------|--------|
| scatter_reveal | $15 | Board generation | Hint 3 safe tiles |
| scanner | $20 | CLEARING (button) | Reveal row or col |
| defuser | $25 | PLACEMENT phase | Bomb on tile → becomes empty |
| tile_magnet | $18 | CLEARING (passive) | Auto-hint nearest safe every 5 clears; consumed at attempt end |
| lucky_tile | $12 | PLACEMENT phase | +$5 when placed tile cleared |
| empty_eraser | $10 | Board generation | -2 empty tiles |
| bomb_detector | $22 | Board generation | Marks 2 bombs 'flagged' (⚠, still clickable) |
| insurance_ticket | $15 | On bust (passive) | Refunds the bet, consumed |
| probe | $16 | CLEARING (button, like scanner) | Test one hidden tile: ⚠ (`flagged`) if bomb, `hinted` if safe; consumed |
| mult_vial *(not sold)* | $20 | Board generation | Next attempt starts +0.5 mult |

scatter_reveal, empty_eraser, bomb_detector and mult_vial are auto-consumed at board
generation (one copy each, removed in handlePlaceBet). insurance_ticket is consumed
by the next bust. defuser and lucky_tile trigger PLACEMENT phase before board is
clickable. scanner: button in left panel → pick row/col → click tile.
Haggler relic discounts all shop consumable prices 30% (getConsumablePrice).

Distinct from **packs**: consumables are single-use/per-board and bought repeatedly;
packs are permanent, one boost kept forever, price scales with how many you've bought.

---

## Event Cards (10 pool, 3 shown per cycle — STACK PERMANENTLY)

Unlike relics/consumables, event-card picks are never lost or replaced — every pick
across the whole run stays in `active_events` forever. `drawEventCards` excludes
already-active modifiers from the draw pool (falls back to the full pool once
they're all collected), so a run naturally diversifies instead of re-offering owned ones.

| ID | Effect |
|----|--------|
| hot_streak | Each attempt starts with streak = 5 |
| cherry_season | Cherry weight ×2 |
| banana_bonanza | Banana weight ×2 |
| star_shower | Star modifier ×1.5 (1.5 → 2.25) |
| safe_zone | -4 empty tiles |
| danger_pay | +3 bombs; tile value ×1.4 |
| bell_ringer | Bell Storm threshold: 4 → 3 bells |
| lucky_board | First attempt this cycle: no empty tiles |
| greed_mode | Cashout ×1.3; min bet floors at $25 |

---

## UI Layout

```
Top bar (full width): EXPLODDS · [🛠 debug (DEV only)] [🔊 mute] [END GAME]
  (END GAME hidden during START/GAME_OVER; two-click confirm — first click arms
  it for 4s, showing CONFIRM END?, second click dispatches END_GAME)

Centered table (max-w-5xl, vertically centered, floating casino-panel cards):
┌────────────────┐  ┌────────────────────┐  ┌──────────────────┐
│ Paytable (top) │  │ [CycleHeader]      │  │ RIGHT w-64 (HUD) │
│ live odds+$    │  │ cycle + BOSS IN n  │  │ MULT + streak    │
├────────────────┤  ├────────────────────┤  │  (topmost card)  │
│ 💵 wallet      │  │  [ComboOverlay]    │  │ [boss rule card] │
│ 🎫 tickets     │  │  5×5 Grid          │  │ attempts 💣💣💣  │
│ 💳 deadline    │  │  (max-w-[30rem])   │  │ modifier chips   │
│  + progress    │  │  + bust flash      │  │ (active_events)  │
│  + interest %  │  │  💣 X · safe · [ⓘ]│  │                  │
│  + DEPOSIT     │  │                    │  │                  │
│   $ preset btns│  │  [RelicShelf]      │  │                  │
│  + CONFIRM btn │  │  (under grid,      │  │                  │
│ bet card       │  │   full width)      │  │                  │
│ PLACE BET/     │  │                    │  │                  │
│  CASHOUT       │  │                    │  │                  │
│ FLAG BOMB/     │  │                    │  │                  │
│  scanner/items │  │                    │  │                  │
└────────────────┘  └────────────────────┘  └──────────────────┘

Deposit is pick-then-confirm: three $ preset buttons (25%/50%/max of what's
depositable, no slider) only set a local `depositAmount` (LeftPanel state), a
separate CONFIRM DEPOSIT button actually dispatches DEPOSIT. The current
effective interestRate(state) is shown right below the deposited/deadline row
whenever the deadline isn't fully covered yet.

Overlays (absolute, .overlay-in fade):
  EVENT_CARD — EventChoice full-screen untimed 3-card pick (z-30)
  BOSS_INTRO — BossIntro full-screen red reveal + FACE THE BOSS (z-30)
  PLACEMENT  — black/80 backdrop + ConsumablePlacement card (z-20)
  RESULTS    — ResultsOverlay full-screen (z-30): wallet/ticket stat cards (top,
               start at before-values) → center "TOTAL WON" count-up → itemized
               cash/ticket line list → CONTINUE (dispatches DISMISS_RESULTS).
               Winnings "fly" (.fly-to-card CSS animation) into the stat cards,
               which pulse (.stat-card-pulse) and swap to their after-values.
  SHOP       — centered modal (max-w-2xl): 👁 ODDS toggle (inline Paytable reuse,
               for checking odds/payouts before buying packs) → consumables (3)
               → packs (3 unified slots) → relics (3, Relic Case appended in the
               same section, not its own row) → next-boss preview footer.
               Pack-opening reveal replaces the packs section in-place while
               pending_pack_choices is set (z-30)
  GAME_OVER  — full overlay, black/88 backdrop (z-40). If the run ended on a
               bust (state.board still populated — a cashout-based failure
               already cleared it), shows a small non-interactive FinalBoard
               reveal of every tile's true content, classic-minesweeper-loss
               style, above the run stats. Also shows prestige earned this run
               (calcPrestigeEarned, display-only — the actual award already
               happened in App.tsx's useEffect)
  SkillTree  — Start-screen-only overlay (z-30), toggled by local App.tsx state
               (not a GamePhase — reads/writes src/meta.ts directly)
  DebugPanel — right-side drawer, z-50, DEV builds only (import.meta.env.DEV)
```

Post-bust reveal (inside the Grid, not a separate overlay component): once
`bustRevealReady` flips true (~700ms into BUST_FLASH), `Grid`'s `revealAll` prop
makes every still-hidden tile render its true content at reduced opacity (same
visual language as `GameOver`'s `FinalBoard`), and `LeftPanel` swaps its
CASHOUT button for a CONTINUE button that dispatches `BUST_FLASH_END`.

---

## Key Reducer Actions (App.tsx)

| Action | When | Effect |
|--------|------|--------|
| START_GAME | Start screen click (`daily?: boolean`) | createInitialState({ daily }) + draw event cards → EVENT_CARD |
| SELECT_EVENT_CARD | EventChoice card click | `selectEventCard` — this cycle's pick; a second pick of the same card becomes a permanent trait → toBetPhase |
| CONFIRM_BOSS | BossIntro button | BOSS_INTRO → toBetPhase |
| SET_BET | Slider move | clamp to [minBet, wallet], snap to $5; ignored under Warden |
| PLACE_BET | Button click | wallet -= bet, generate board → PLACEMENT or CLEARING |
| DEPOSIT | CONFIRM DEPOSIT button (BET phase) | handleDeposit — may end the cycle immediately |
| PLACE_CONSUMABLE | Tile click in PLACEMENT | assign consumable to tile |
| SKIP_PLACEMENT | Button | skip remaining placements → CLEARING |
| TILE_CLICK | Grid click | handleTileClick — routes to toggleFlag if flag_mode, applyProbe if pending_probe, applyScanner if scanner armed, else opening/proven-tagging → symbol/empty/bomb logic |
| ACTIVATE_SCANNER | Button | set pending_scanner_axis, clears flag_mode/pending_probe |
| ACTIVATE_PROBE / CANCEL_PROBE | PROBE button | arm/disarm the Probe consumable (next tile click tests instead of reveals) |
| TOGGLE_FLAG_MODE | FLAG BOMB button | flips flag_mode (Bomb Sense skill), clears pending_scanner_axis; no-op if maxPlayerFlags is 0 |
| CASHOUT | Button | no-op unless clicks_this_attempt ≥ 2; handleCashout → wallet += stake + winnings, phase RESULTS; computed toBetPhase/settleFinalAttempt result stashed in pending_next_phase |
| DISMISS_RESULTS | ResultsOverlay CONTINUE | dismissResults — applies pending_next_phase, clears pending_results |
| BUST_FLASH_END | CONTINUE button (after ~700ms reveal) | → toBetPhase or settleFinalAttempt |
| CLEAR_COMBO_DISPLAY | 2.5s useEffect | clear active_combo_display |
| BUY_CONSUMABLE | Shop | wallet -= price (Haggler discount), add to owned |
| BUY_RELIC | Shop | tickets -= cost, add to relics |
| BUY_PACK | Shop | buyPack(state, index) — index into shop_packs (3 slots, kinds can repeat); themed grants both stacks directly, axis sets pending_pack_choices |
| PICK_PACK_BOOST | Shop reveal card click | pickPackBoost — appends to boosts[] |
| SKIP_PACK_BOOST | Shop reveal SKIP button | skipPackBoost — clears pending_pack_choices/picks_remaining, grants nothing (pack was already paid for) |
| BUY_RELIC_CASE | Shop | buyRelicCase — tickets -= price, max_relic_slots += 1 |
| REROLL_CONSUMABLES | Shop | tickets -= 2, new consumable list |
| REROLL_RELICS | Shop | tickets -= 2, new relic list |
| REROLL_PACKS | Shop | tickets -= 2, new shop_packs (3 fresh slots, kinds re-rolled) |
| NEXT_CYCLE | Shop button | startNextCycle → EVENT_CARD or BOSS_INTRO (no-op while a pack pick is pending) |
| END_GAME | Top bar END GAME button (two-click confirm) | resolveCycleFailure → GAME_OVER; no-op if phase is already START/GAME_OVER |
| RESTART | Game over | createInitialState → START |
| DEBUG_PATCH | DebugPanel (DEV only) | `{ ...state, ...patch }` — direct state override for testing |

---

## Common Pitfalls

- **Numbers are read through `displayedNumber`, not `adjacentBombCount`.** The Grid and
  `analyzeBoard` must agree on what the player sees (Blackout/Mirror/Liar all live in
  deduction.ts). `adjacentBombCount`/`trueNumber` are the honest counts for mechanics.
- **`proven` is computed on `state.board` (pre-click), never on the relocated board** —
  the opening/Gut Feeling relocation happens after the player committed.
- **Bombs are relocated, never deleted**, by `relocateBombs` (swap with a hidden safe
  tile). It only decrements `bombs_this_attempt` in the no-candidate fallback. Don't
  reintroduce the old "convert to empty" guarantee — it silently lowered the bomb count.
- **The Saboteur + cascade NaN bug**: the cascade loop must skip tiles whose type is no
  longer `'symbol'` (Saboteur arms bombs mid-cascade) — `applySymbolTileReveal` assumes
  `tile.symbol` is set.
- **Cascade Sense level 1 vs 2 differ only in the empty-cascade cap** — the opening
  (plus shape) is identical. Level 0 = single-tile opening, no cascade.
- **A guess resets the symbol streak; an empty does not.** Milestone flags reset with it.
- **Never hardcode 5 for the grid.** Board size is `state.board_cols` (5/6/7) and every
  index↔row/col conversion goes through `boardCols(board)` (deduction.ts) or the
  `cols` argument — `GRID_COLS`/`GRID_SIZE` are only the cycle-1 defaults. Grid.tsx,
  GameOver's FinalBoard and ConsumablePlacement all derive their column count from the
  board. The DebugPanel's "Cycle #" setter patches `board_cols` alongside `cycle_number`.
- **`active_events` is derived.** Never push to it directly outside `selectEventCard` /
  `startNextCycle` (the DebugPanel's MODIFIERS toggles are the one debug-only exception).
- **Tile cash is sub-linear, area-normalised, and the stake comes back pro rata.**
  Anything that reasons about "earnings vs bet" (profitable-clear tickets, bot cashout
  rules, UI copy) must treat the bet as returned money, not spent money — and must go
  through `stakeReturnInfo` for how much of it. `total_earned` counts winnings only.
  Any NEW flat cash reward must multiply by `flatCashScale(bet)` and any new cash-priced
  shop item by `shopPriceScale(deadline)`, or it becomes irrelevant by cycle 5.
- **Balance history of the human playtest (2026-09-10)**: "click once or twice and cash
  out, snowball", "11 bombs on 6×6 is too much", "$22 packs against a $1,000 deadline".
  Fixes: stake-return threshold, density cut to ≤22%, price/flat-reward scaling, tile
  cash normalised by board area, multiplier growth halved, 2 attempts from cycle 10,
  collateral at 75%. Bot targets after it: random ~1–2, noisy deducer 2–3, perfect
  deducer 5 (min bet) / 4–6 (30% bets), relic builds ~10–15, nobody immortal.

- **`state.player_flags` (Bomb Sense guesses) is a completely separate concept from
  `Tile.state === 'flagged'`** (Bomb Detector consumable's "this hidden tile IS a
  known bomb, still clickable" marker). Don't conflate them — a player-flagged tile
  can be in ANY pre-reveal `TileState` (hidden/hinted/flagged), `player_flags` just
  tracks indices in a GameState array, never touching `Tile.state` itself.
- **Deposit is pick-then-confirm**, not one-click. `LeftPanel` holds `depositAmount`
  as local component state (three $ quick-set buttons, no slider — only adjust it),
  and a separate CONFIRM DEPOSIT button dispatches the actual `DEPOSIT` action.
  Resets to `depositCap` via a `useEffect` keyed on `depositCap` changing (new
  attempt/cycle).
- **The 100% ("max") deposit preset must use `depositCap` unrounded, never
  `Math.round(depositCap / 5) * 5`.** The 25%/50% presets round to the nearest $5
  for nicer numbers, but rounding the max preset the same way can zero it out
  when `depositCap` is small (e.g. `$1` wallet → rounds to `$0`) — since betting
  is also blocked below `minBet`, that silently soft-locks BET phase with no
  legal action available at all, even though wallet > 0 (not a real game-over
  per the rule below). The max preset is the escape hatch and must always equal
  the true `depositCap`.
- **`getSymbolOdds`'s payout column is deliberately pinned to `mult = 1.0`**, not
  `state.multiplier`. It's an "upgrade level" readout (what a boost/relic/event
  is doing to a symbol's base value) — if it used the live attempt multiplier,
  every row would visibly climb as the player clears tiles, reading as paytable
  instability instead of permanent build state. Don't reintroduce `state.multiplier`
  there; `pct` (odds) is unaffected since weights don't depend on mult anyway.
- **Two classes sharing the `animation` CSS property on one element will "unmask"
  each other.** `.tile-entrance` (plays once at deal-time) stayed on every tile
  permanently; `.tile-reveal` (`!important`) is added only during a click's 520ms
  animation window. While both are present, `tile-reveal` wins the cascade — but
  when React removes the `tile-reveal` class afterward, the browser treats
  `tile-entrance`'s now-unmasked `animation` declaration as freshly applied and
  **restarts it from scratch**, producing a second, unwanted pop-in right after the
  real reveal. This is the actual root cause of the "reveal → disappear → bop
  again" bug (confirmed by testing: disabling `.tile-entrance`'s animation fixes
  it) — `.tile-entrance` is now `animation: none`. Also removed `icon-pop`'s 100ms
  delay (a separate, smaller desync) while investigating. **Lesson**: never let two
  classes on the same element both set `animation` unless you want the
  cascade-losing one to replay when the winning one's class is removed.
- **Bet deducted at PLACE BET**, not at cashout/bust. Bust = bet is already gone.
- `attempt_earnings` is NOT in wallet until CASHOUT. Don't add it to wallet display.
- **`wallet` and `deposited` are separate pools.** Deposited money can never be bet
  again. The deadline check is `deposited >= deadline`, NOT `wallet >= deadline` —
  that changed this session. Don't reintroduce the old wallet-based check.
- `deposited` resets to 0 each cycle (reset in `startNextCycle`). `active_events`
  does NOT reset — it's permanent for the whole run. Don't confuse the two.
- **Any wallet-shrinking action must re-clamp `current_bet`, not just SET_BET.**
  `handleDeposit` used to leave `current_bet` untouched — if you set a big bet, then
  deposited enough to shrink wallet below it, `current_bet` stayed stale and
  `handlePlaceBet` silently no-op'd (`newWallet < 0 → return state`), which looked
  to the player like "PLACE BET is enabled but does nothing" despite having enough
  money. Fixed via `clampBetToWallet()`, called at the end of `handleDeposit`. If you
  add another action that can reduce `wallet` outside of betting/SET_BET, clamp
  `current_bet` there too.
- Interest fires **only on a successful cashout**, never on bust, proportional to
  whatever's already in `deposited` at that moment (not this attempt's earnings).
- `bomb_suit_used` resets each cycle. `safetyNetUsed` was removed (old system).
- Empty tiles break streak and give no cash — but they show the adjacent-bomb count
  (see `adjacentBombCount` in gameLogic.ts; rendered in Grid.tsx `TileContent`).
- **The only real dead end is `wallet <= 0 && deposited < deadline`** (`toBetPhase`).
  A wallet below min-bet but above $0 is legal — the player can still deposit it.
  Don't reintroduce a min-bet-based game over check.
- `settleFinalAttempt` auto-sweeps leftover wallet into deposited when attempts hit
  0, before judging success/failure — don't skip this or players get punished for
  simply not clicking deposit on their last attempt.
- Combo checks run after every symbol tile. They must check already-revealed tiles in `board`, not just the current tile.
- Banana Split retroactive: uses `banana_tile_earnings[]` (list of cash each banana earned). On trigger: add `sum × (mult - 1)`.
- Bell Storm grants the crossed streak milestones (5/10/15) **immediately** and sets
  their given-flags — the next click must not pay them again.
- Scanner removes itself from `consumables_owned` via `removeOne()` after use.
- `scatter_reveal`, `empty_eraser`, `bomb_detector`, `mult_vial` are consumed at board gen
  (`removeOne` in `handlePlaceBet` — one copy each, duplicates survive). `tile_magnet` is
  consumed at attempt end (cashout or bust). `insurance_ticket` is consumed on the next bust.
- Lucky Board: only applies to first attempt per cycle. `lucky_board_used` tracks this.
- **Boss cycles have no event card** — `event_card_options` is empty. `active_boss`
  is only set/cleared in `startNextCycle`.
- Saboteur converts a hidden tile to a bomb mid-attempt — already-shown adjacency
  numbers update live (they're computed from `board` at render). Intended.
- The bet under Warden is enforced in `handlePlaceBet` via `getLockedBet` — the
  reducer's SET_BET also ignores input, but never trust `current_bet` alone.
- `getSymbolWeights`/`getSymbolMod` now take the full `state` (not individual flags)
  since they need active_events, active_boss, AND boosts. Both are exported and
  reused by `getSymbolOdds` (the paytable) — keep them pure and side-effect-free.
- Packs have their own local UI state (`pending_pack_choices`) but it lives in
  global GameState, not component state — so it survives re-renders and the reveal
  can't be dismissed without picking. `NEXT_CYCLE` must stay disabled while it's set.
- Sounds are played by the `useSounds` hook in App.tsx, which diffs consecutive
  states — the reducer must stay pure. New audible moments need a diff rule there.
- When tuning any economy formula, mirror the change in `scripts/sim.mjs` PARAMS and run `npm run sim`.
- **Adjacency numbers only appear on tiles actually revealed this attempt** (`revealed`
  symbol tiles and `empty_revealed` empties, via `displayedNumber`) — that is NOT the same
  thing as the DebugPanel's "REVEAL BOARD" ghost overlay, which peeks every hidden tile's
  true content (and honest count) without touching game state. A ghost-revealed
  still-hidden tile showing a number in the overlay but not in play is correct, not a bug.
- `MAX_SHOP_ITEMS` is now **3** (was 5) — governs both `shop_consumables` and
  `shop_relics` pool sizes. Packs use their own `PACK_SLOT_COUNT` (3), not this
  constant.
- Perfect Clear must be checked on BOTH the symbol-tile and empty-tile branches
  of `handleTileClick` — the tile that completes the board isn't always a symbol.
- **Flood fill only expands through further 0-adjacency EMPTY tiles** (`floodFillReveal`).
  A symbol tile or a numbered (>0 adjacency) empty tile caught in the cascade gets
  revealed (and, if it's a symbol, paid out via `applySymbolTileReveal`) but does NOT
  itself propagate the cascade further — same rule real minesweeper uses. Combo checks
  and Perfect Clear run ONCE per click via `resolveCombosAndFinalize`, after every tile
  in the cascade has been revealed, not per-tile — they scan the whole board's revealed
  state so checking once is both correct and sufficient.
- **Flood fill is gated behind the Cascade Sense meta-skill** (`state.skills.cascade` —
  see Meta-Progression section). `handleTileClick`'s empty-tile branch checks the level
  BEFORE calling `floodFillReveal` — level 0 bypasses it completely (`revealSet =
  [tileIndex]`), level 1 passes `CASCADE_LEVEL1_CAP` as `floodFillReveal`'s new
  `maxTiles` param, level 2 passes `Infinity`. If you add gameplay that reveals tiles
  outside `handleTileClick` (a new consumable, say), decide deliberately whether it
  should also respect the cascade skill or bypass it — don't assume unlimited cascade
  is still the default, that only holds at skill level 2.
- The streak resets exactly once for an empty-tile click (cascading or not), even if
  the flood fill also reveals several symbol tiles — the whole cascade is one atomic
  player action. Don't reset it again per intermediate empty tile within a single cascade.
- There are only **5 symbols** now (diamond/cherry/banana/star/bell) — coin was
  removed for being one too many for a 5×5 grid. This also retired Coin Jackpot combo,
  the coin_tycoon and golden_goose relics, and the coin_rush event card entirely (no
  clean repoint existed for any of them). Lucky Charm was repointed from "guaranteed
  coin tile" to "guaranteed diamond tile" instead of being retired, since its effect
  (force one tile of a specific symbol) still made sense pointed at a different symbol.
  If you ever reintroduce a 6th symbol, mirror the change in `scripts/sim.mjs`'s
  `avgSymbolMod` (weighted mean of symbol modifiers) or the sim's EV numbers will be wrong.
- **Smoke-test bundles must be rebundled from source before every verification run** —
  this session briefly had `smoke.mjs`/`smoke2.mjs`/`smoke3.mjs` pointed at stale,
  never-rebuilt esbuild bundles (`gl.mjs`/`gl2.mjs`/`gl3.mjs`) from early in the session,
  while `smoke4.mjs`/`smoke5.mjs` correctly used a shared `gameLogic.bundle.mjs` that
  WAS kept in sync. The stale suites kept reporting "0 failed" against code that no
  longer existed (e.g. a whole "Coin Jackpot" test still passing after the combo was
  deleted) — a false-negative that would have gone unnoticed without manually
  double-checking *what* each suite actually imports. All smoke suites now import the
  same `gameLogic.bundle.mjs`; regenerate that one file with esbuild before trusting
  any suite's results, and if you add a new suite, point it at the same bundle rather
  than creating another one to keep in sync.
- **`handleCashout` no longer transitions phase directly** — it computes the same
  `toBetPhase`/`settleFinalAttempt` result it always did (so wallet, tickets, shop
  generation on cycle-complete, etc. are all already resolved), but returns with
  `phase: 'RESULTS'` and stashes the real target phase in `pending_next_phase`. Only
  `dismissResults` (via `DISMISS_RESULTS`) actually applies it. If you add a new
  cashout-adjacent effect, compute it into `resolved` before the `RESULTS` override —
  don't special-case around the deferred phase.
- **Meta-progression (`src/meta.ts`) is a separate persistence layer from GameState.**
  `state.skills` is a read-once snapshot taken at `createInitialState()` — mutating
  `state.skills` mid-run (e.g. via `DEBUG_PATCH`) is a this-run-only override and does
  NOT write back to `localStorage`. The only writers of `localStorage` are
  `awardPrestige` (Game Over) and `upgradeSkill` (SkillTree). Don't call `loadMeta()`
  again mid-run expecting fresh data — always read `state.skills`.
- **`awardPrestige` must fire exactly once per run.** App.tsx guards it with a
  `useRef` (`prestigeAwarded`) reset whenever `phase !== 'GAME_OVER'` — without the
  guard, React re-running the effect (e.g. Strict Mode, or any other state change
  while still in GAME_OVER) would double-award prestige points.

---

## Sound

`src/sound.ts` loads `public/sfx/<name>.wav` lazily and clones nodes so rapid
repeats overlap. Names: reveal, symbol, empty, bomb, cashout, combo, milestone,
buy, boss, click, gameover. `symbol` is pitch-shifted with streak via playbackRate.
Mute persists in localStorage (`explodds_muted`), toggle in the top bar.
`npm run sfx` regenerates the synthesized placeholders — replacing a file in
public/sfx/ with a licensed one of the same name needs no code change.

---

## Debug Console (src/components/DebugPanel.tsx)

Dev-only testing tool — 🛠 button in the top bar, gated behind `import.meta.env.DEV`
(never renders in a production build). Opens a right-side drawer with direct state
pokes, all routed through a single generic reducer case:

```typescript
{ type: 'DEBUG_PATCH'; patch: Partial<GameState> }  →  { ...state, ...action.patch }
```

Sections: economy (wallet/tickets), cycle (number/deadline/deposited), attempt
(mult/streak/attempts left), board (bomb count override for the **next** board dealt
— `state.debug_bomb_override`, consumed in `handlePlaceBet` — plus a reveal-board
ghost view), boss (force `active_boss` to any of the 9), modifiers (toggle any
`active_events` entry), relics (toggle ownership of any of the 22), consumables
(stack any of the 9), symbol boosts (add a frequency/payout stack per symbol).

**Reveal-board ghost view** (`debugReveal` state in `StandardGame.tsx`, passed to `Grid` →
`GridTile` → `DebugGhost`) is purely visual — a faint dashed overlay showing each
hidden tile's true bomb/symbol, `pointer-events: none` so clicks pass through to the
real button underneath. It never touches `Tile.state`, so it can't desync from real
gameplay.

**`debug_bomb_override`** also feeds the LeftPanel's pre-bet bomb preview (so the
displayed number matches what will actually be dealt) — remember to check both call
sites (`handlePlaceBet` and the preview calc in `StandardGame.tsx`) if you add more
overrides that should be previewed before betting.

**No debug console exists for Incremental Dig Mode yet** — if one is added later, follow
the same `DEBUG_PATCH`-style generic-override pattern rather than inventing a new one.

---

## Incremental Dig Mode ("The Dig" — src/incremental/)

A second, structurally different game reached from `ModeSelect.tsx`. No betting, no
deadline economy, no symbols — a growing grid of **bomb / empty / dirt** tiles where
dirt is worth real cash ($) the instant it's dug. Fully separate file tree; **never
add code here to `src/types.ts`, `constants.ts`, `gameLogic.ts`, `meta.ts`, or
`SkillTree.tsx`** — those are Standard-mode-only and the separation is deliberate
("two games in one," not one unified state machine).

```
src/incremental/
├── types.ts             — DigTile, DigTileType/State, DigPhase, DigEndReason,
│                          DigBossId, DigUpgradeId, OreTierId, DigGameState
├── constants.ts          — board/bomb/cash escalation formulas, ORE_TIERS ladder,
│                          checkpoint hook, charges/durability/scanner/nugget tunables
├── digLogic.ts           — all pure functions (board gen, tile click, run lifecycle)
├── digBosses.ts          — DIG_BOSSES catalog + getDigBossForCheckpoint (seeded, mirrors
│                          Standard's getBossForCycle pattern exactly)
├── digMeta.ts            — persistent upgrade tree (localStorage key 'explodds_dig_meta',
│                          separate from Standard's 'explodds_meta') + debug-only helpers
├── IncrementalGame.tsx   — owns its own useReducer + useDigSounds — the "second App.tsx"
└── components/
    ├── DigHomeScreen.tsx     — mirrors StartScreen.tsx
    ├── DigUpgradeTree.tsx    — minimalist icon-grid tree overlay, genuinely recursive (see below)
    ├── DigGrid.tsx           — dynamic rows×cols, NOT a fork of Grid.tsx
    ├── DigHUD.tsx            — charges bar, banked vs. at-risk $, checkpoint boss card, CASH OUT
    ├── DigRunOverOverlay.tsx — ports ResultsOverlay.tsx's typewriter-reveal pattern
    └── DigDebugPanel.tsx     — dev-only (import.meta.env.DEV), mirrors DebugPanel.tsx's
                               generic-patch pattern but patches BOTH DigGameState (via
                               DEBUG_PATCH) and digMeta.ts (localStorage) since Dig's
                               persistent upgrades live outside GameState
```

**Why `DigGrid.tsx` isn't a fork of `Grid.tsx`**: `Grid.tsx` is tightly coupled to
Standard-only concepts (scanner axis, relic/boss checks, consumable rendering,
hardcoded `grid-cols-5`). `DigGrid.tsx` needs a dynamic `gridTemplateColumns` inline
style instead (Tailwind can't generate arbitrary `grid-cols-N` at runtime), and none
of the Standard-only branches — a new, lighter component was cheaper and safer than
threading `DigTile`/`DigGameState` through the existing one.

**Why `digAdjacentBombCount`/board generation aren't reused from `gameLogic.ts`**:
`adjacentBombCount` and `floodFillReveal` hardcode bounds against the module-level
`GRID_SIZE=25`/`GRID_COLS=5` constants — they are **not** board-size-generic. Since
Dig's board grows (5×5 → 7×7 → 9×9), importing them as-is would silently break the
moment a level grows past 5×5. `digLogic.ts` has its own parameterized twin,
`digAdjacentBombCount(board, index, cols)` (rows derived from `board.length/cols`).
`generateBoard` (Standard) is similarly not reused — saturated with symbol/relic
logic — Dig has its own `generateDigBoard` using the same shuffle/type-array pattern.
`src/rng.ts` (`mulberry32`/`weightedChoice`/`rngShuffle`/`newSeed`) genuinely is
generic and **is** imported as-is. `getDigBossForCheckpoint` in `digBosses.ts` mirrors
`getBossForCycle`'s exact seeded-shuffle-by-ordinal pattern rather than reusing it
(different pool, different id type).

### Risk model: press-your-luck, banked per level, cash out any time

No separate "Ore" points currency — dirt tiles are worth **real $** directly (richer
ore veins are a cash multiplier, see Cash & ore tiers below).

- `currentLevelCash` — at-risk money dug on the level currently in progress.
- `bankedCash` — permanently safe this run (every previously-cleared level, plus any
  voluntary cash-out).
- **Clearing a level** (`isDigLevelClearable` — see Charges section for why this is
  buffer-aware, not a literal 100% clear) auto-banks `currentLevelCash` and advances to
  a harder level, same run, same charge budget. Free — no decision needed.
- **CASH OUT** (`CASH_OUT` action, always available while `phase === 'DIGGING'`, mirrors
  Standard's always-visible CASHOUT button) banks `currentLevelCash` and ends the run
  *safely* — nothing is ever lost by choosing to stop.
- **Hitting a bomb** forfeits `currentLevelCash` **and** this level's mined totals
  (`minedThisLevel`, see below) — the only real loss condition. Nothing from previously
  cleared levels is at risk.
- **Running out of charges** (no bomb involved) auto-banks `currentLevelCash`, same as a
  voluntary cash-out — exhausting your energy isn't a gamble gone wrong, it's just stopping.

This was chosen deliberately over both a Standard-style full press-your-luck model
(risk of losing everything) and a fully risk-free model (money never at risk at all):
buying more charges is never wasted (a cash-out never forfeits anything you already
banked), and bomb-detection upgrades (Danger Sense, Scanner) are the direct, in-tree
answer to "won't more charges just mean more chances to die?"

**`DigEndReason`** (`'bomb' | 'out_of_charges' | 'cashed_out'`) lets `DigRunOverOverlay`
show three distinct end messages even though two of the three bank `currentLevelCash`
the same way (bomb is the one case that does *not*).

### Cash, ore tiers (Dirt → Copper → Silver → Gold → Platinum → Diamond), and the
### `minedBanked`/`minedThisLevel` split

`calcDigCashBase(level, dirtValueLevel)` sets a dirt tile's base value — plain Dirt is
deliberately cheap unskilled (`DIG_CASH_BASE = 1`), with the **Dirt Value** node (3
levels, direct child of Pickaxe) raising it to $2/$3/$4 per `DIG_DIRT_VALUE_BY_LEVEL`
(so a fully-upgraded run pays what Dirt always used to pay, $4, before this was made a
skill). `ORE_TIERS` (`constants.ts`)
is now the full 6-tier ladder from the user's future-ideas notes (×1/×2/×4/×8/×16/×32).
**A tier can only roll on a board once its matching Vein upgrade is owned — no
exceptions, Copper included.** Copper used to have a nonzero base chance even
unskilled (`DIG_BASE_COPPER_CHANCE` applied regardless of ownership) — that exception
was removed per an explicit "the game state must respect the tree" request: a fresh
player with nothing invested sees nothing but plain Dirt, full stop. The chain is
`copper_vein_1` → `silver_vein_1` → `gold_vein_1` → `platinum_vein_1` →
`diamond_vein_1`. `generateDigBoard` rolls rarest-tier-first: each *owned* tier above
Dirt claims a slice of the roll range (`DIG_HIGHER_VEIN_BONUS` per tier, Copper gets
its own `DIG_BASE_COPPER_CHANCE + DIG_COPPER_VEIN_BONUS` once owned), and whatever's
left over is plain Dirt — a deliberately simple additive-slices model rather than a
fully-normalized weighted distribution (see the code comment in `generateDigBoard` if
you add a 7th tier).

**Two separate mined-totals trackers, not one** — this fixed a real bug found during
testing: an earlier version tracked one cumulative `mined` record incremented on every
dig regardless of outcome, so a bomb hit would still show "+$20 Dirt" lines in the
run-over breakdown even though that money was forfeited, not banked (itemized lines
didn't reconcile with the $0.00 total). Fixed by splitting into:
- `minedThisLevel` — this level's dig-so-far, reset to zero and **discarded** on a bomb hit.
- `minedBanked` — permanent composition of `bankedCash`; `minedThisLevel` merges into
  it (`bankCurrentLevel` in `digLogic.ts`) on level-clear, cash-out, or out-of-charges —
  never on a bomb.

`DigRunOverOverlay.tsx` reads only `minedBanked`, so a bomb-ended run correctly shows
$0.00 with **no** itemized lines rather than misleading "+$X" entries for money that
was actually lost. If you add more ore tiers or another cash-earning mechanic, make
sure it flows through `minedThisLevel` → `bankCurrentLevel`, not a raw cumulative total.

**Nugget Luck** (`nugget_luck_1`, child of Copper Vein): each successfully-mined dirt
tile has a `DIG_NUGGET_CHANCE` chance to pay out double — rolled inside `applyDamage`
in `digLogic.ts` using the same deterministic per-click `rng`, not `Math.random()`
(see Durability/Strength/Bulk Click below for why every random roll in a click uses a
seeded rng — the reducer must stay pure).

### Charges: 1 per click (2 under Iron Will), clear-buffer instead of a literal 100% clear

Every reveal action costs exactly 1 charge, **except under the Iron Will boss** (every
click costs 2 — see Bosses below). Since every tile now defaults to `DIG_BASE_TOUGHNESS`
(2) hits (see Durability/Strength/Bulk Click below), a plain dirt tile costs 2 charges
total unless Durability or Strength is owned — charges and toughness are independent
per-click costs, not one combined number. There is still no cascade/flood-fill in this pass;
`digFloodFillReveal` doesn't exist, a future Cascade-Sense-style node would add it.
Empty tiles show their adjacency number by default (`digAdjacentBombCount`, computed
live in `DigGrid.tsx`) — NOT gated behind an upgrade (deliberately, so a fresh run is
immediately playable via deduction) — **except under the Fog boss**, which suppresses
them for that one checkpoint level (`DigGrid`'s `suppressAdjacency` prop).

**`DIG_CLEAR_BUFFER` (constants.ts) — a level clears once at most this many hidden
non-bomb tiles remain, not literally every single one.** This was a real balance
finding from `scripts/dig-sim.mjs`: requiring a strict 100% clear is a compounding-risk
gauntlet across ~20+ sequential clicks where the LAST few clicks (as hidden tiles
shrink toward the bomb count) carry sharply escalating risk — and the sim showed
**raising the charge budget past what's minimally needed does nothing to fix this**
(clear rates were flat from ~25 charges all the way to 100). The buffer forgives the
worst of that endgame risk. `isDigLevelClearable(board, buffer)` is the check actually
used during play; `isDigBoardFullyCleared` (strict, zero hidden non-bomb tiles) still
exists for a possible future "Perfect Clear"-style bonus.

**Known sim limitation, read before trusting its exact numbers**: the sim's "skill"
parameter is a flat, uniform risk discount — it cannot model genuine deduction (a real
player reading adjacency numbers, or owning Danger Sense/Scanner, can PROVE specific
tiles are 100% safe, not just "somewhat less risky"). The sim's clear-rate numbers
(`npm run dig-sim`) are a **pessimistic lower bound**, not a literal prediction — real
skilled play, especially with Danger Sense/Scanner owned, should clear noticeably more
often than the sim reports. Final numbers still want a real human playtest pass.

`chargesMax` is computed in `startDig` (`digLogic.ts`) by re-reading
`loadDigMeta().upgrades` **fresh**, not from `state.skills`. This fixed a second real
bug found during testing: `IncrementalGame`'s `useReducer` only calls
`createInitialDigState()` once, at component mount — if a player buys an upgrade on
the Home screen (`DigUpgradeTree` writes straight to `localStorage`, bypassing the
reducer, same pattern as `SkillTree.tsx`) and then clicks DIG without the component
remounting, `state.skills` would still hold the stale pre-purchase snapshot. Standard
mode never hits this because `START_GAME` calls `createInitialState()` fresh on every
click. **Any function that starts a new Dig run must re-fetch `loadDigMeta().upgrades`
itself** — don't assume `state.skills` is current.

### Checkpoint bosses (every 3rd level — src/incremental/digBosses.ts, 4 total)

Mirrors Standard's boss pattern exactly: `getDigBossForCheckpoint(seed, level)` seeds a
shuffle of `DIG_BOSSES` and indexes by checkpoint ordinal (`level/3`), repeating after
all 4 cycle through — same algorithm as `getBossForCycle`, just a separate pool/id type.
`state.activeBoss` is set in `startDig`/`advanceDigLevel` whenever the new level is a
checkpoint (`isDigCheckpointLevel`), `null` otherwise. Each is a single-rule modifier
for that one level only, same simplicity as Standard's bosses:

| ID | Effect | Hook |
|----|--------|------|
| `cave_in` | Bomb density ×1.6 this level | `generateDigBoard` |
| `fog` | Empty tiles show no adjacency numbers this level | `DigGrid`'s `suppressAdjacency` prop |
| `iron_will` | Every click costs 2 charges instead of 1 this level | `handleDigTileClick`'s `chargeCost` |
| `golden_layer` | Ore-tier roll chances ×2 this level (no extra bomb risk) | `generateDigBoard` |

`DigHUD.tsx` shows a "CHECKPOINT BOSS" card with the boss's name/emoji/description
whenever `state.activeBoss` is set. **No boss-specific twist logic beyond these four
single-rule modifiers exists** — no special mid-level events, no multi-rule bosses.

### Durability / Strength / Bulk Click (multi-hit ore + a click that hits two tiles)

**Naming note**: this section (and the code's constant/function names) still say
"Durability" for the `durability_1` node, matching its **id**. In the tree UI it now
*displays* as **"Pickaxe"** — the root (`pickaxe_1`) took over the "Durability" display
name and the total-charges job instead (see "Meta-progression" below for the full
id-vs-display-name swap and why the ids themselves were left alone). Read "Durability"
below as "the `durability_1` node, shown as Pickaxe in-game."

From the user's future-ideas notes, now implemented — **the baseline was flipped in a
later balance pass**: every tile, plain Dirt included, now needs `DIG_BASE_TOUGHNESS`
(2) hits to mine by default ("the dirt requires 2 digs"). This made Durability's
original job (making ore tougher) redundant, since the baseline is already tough — its
role changed to the opposite: **relief**, not friction.
- **Durability** (`durability_1`, child of the root) — once owned, plain Dirt
  specifically drops back to `DIG_DURABILITY_DIRT_TOUGHNESS` (1) hit; actual ore tiers
  (Copper and above) stay at the tough 2-hit baseline regardless of Durability — ore is
  just naturally harder than dirt, Durability or not. A tile that's taken damage but
  isn't fully mined yet shows `DigTileState = 'cracked'` (still hidden/clickable,
  displays a small "hits remaining" count) — a third pre-reveal state alongside
  `'hidden'`/`'hinted'`.
- **Strength** (`strength_1`, child of Durability) — each click deals
  `DIG_BASE_STRENGTH + DIG_STRENGTH_BONUS` (2 total) damage instead of 1, one-shotting
  any 2-toughness tile (dirt without Durability, or any ore tier) regardless of
  Durability ownership.
- **Bulk Click** (`bulk_click_1`, child of Strength) — **design decision, not a proven
  answer**: the user explicitly flagged an unresolved ambiguity here ("does splash
  strength divide across the tiles hit, or does each tile independently need to meet
  its own toughness?") and asked for it to be resolved via playtest before building.
  Implemented as the simpler of the two models: **each tile hit gets your FULL current
  strength independently** (not divided) — a click also strikes the tile immediately to
  the right (same row only; a deliberately simple, deterministic pattern, not a full
  neighborhood) with the same damage as the primary target, at no extra charge cost.
  Never splashes onto a bomb (skipped entirely if the neighbor is a bomb). **Revisit
  this choice after real playtesting** — it was picked for implementation simplicity,
  not because it's provably the more fun model.

Every random roll inside a single click (Nugget Luck, Scanner proc-and-target-pick) uses
one deterministic `rng = mulberry32(seed + level*100000 + index*977 + chargesRemaining)`
seeded per click — keeps `handleDigTileClick` a pure function (same convention as the
rest of the codebase using `rng.ts` instead of `Math.random()`), and `chargesRemaining`
changing every click means a second hit on the same still-`'cracked'` tile gets a fresh
roll rather than repeating the first hit's outcome.

### Scanner (passive proc, distinct from Standard's Scanner consumable)

`scanner_prob_1` (child of Durability II, `pickaxe_2` — see Topology below): digging an **empty** tile has a
`DIG_SCANNER_BASE_CHANCE` chance to also flag a nearby hidden bomb as `'hinted'` — a
passive proc, not a player-activated targeting tool (Standard's Scanner requires
choosing a row/col). `scanner_count_1` (child) raises how many bombs get flagged when
it triggers (`DIG_SCANNER_BASE_COUNT + DIG_SCANNER_COUNT_BONUS`). The two-branch
"probability vs. count" split the user asked for is approximated by the root node
doubling as "unlock + set the probability" since v1 nodes are single-tier, not a
multi-level ladder — a real separate probability ladder is a future refinement if
ever needed (see CLAUDE.md's Suggested Future Ideas).

### Meta-progression: `digMeta.ts` + `DIG_UPGRADES` — a real, now-15-node branching tree

Unlike `meta.ts`'s `SKILLS` (flat array, independent linear-level skills),
`DIG_UPGRADES` is a genuine tree: `DigUpgradeNode.parentId` — `null` for the root,
a sibling's id for a child — and `purchaseDigUpgrade` checks parent-ownership before
allowing a purchase; `meta.ts`'s `upgradeSkill` doesn't need this since Standard's
skills aren't tree-structured.

**Nodes are now multi-level, mirroring `meta.ts`'s `SkillDef.levels` pattern
exactly**: `DigUpgradeNode.levels: { cost: number }[]` replaces the old flat
`cost: number`, and `meta.upgrades[id]` stores the CURRENT level reached (0 =
not started) rather than a boolean. `purchaseDigUpgrade` always buys "the next
level" (`levels[currentLevel].cost`), capped at `levels.length`. Most nodes
are still effectively single-tier (`levels` of length 1 — a plain on/off
purchase), but **Pickaxe** and **Dirt Value** are 3-level ladders and
**Copper Vein** and **Durability** are 2-level ladders (see Topology below) —
the data model treats every case identically, so adding more levels to any
existing node later needs no structural change, just a longer `levels` array
plus a lookup-by-level in whatever `digLogic.ts` function reads that skill.
Copper Vein's level 2 raises Copper's roll chance further
(`DIG_COPPER_VEIN_BONUS_BY_LEVEL`, constants.ts); Durability's level 2 extends
the same "1 hit instead of 2" relief from plain Dirt to Copper ore too
(`DIG_DURABILITY_COPPER_LEVEL`, digLogic.ts) — both are direct examples of
"a node either gets stronger or appears more often at a higher level," per
the user's framing, and both are natural future starting points for a
level 3 if that's ever wanted.

**Green level-bar segments** (`TreeNode` in `DigUpgradeTree.tsx`): a row of
small segments along the bottom edge of every node's icon box, one per level
— filled green left-to-right as the node is upgraded, dim/empty beyond the
current level. A single-level node just shows one segment (filled once
owned); Pickaxe/Dirt Value show three, filling one at a time per purchase —
a quick "how invested am I in this node" readout without needing hover text.

**Fog-of-war visibility** (replaced the original "show everything, dim the
locked ones" UI): a node is not rendered **at all** — no dimmed preview, no 🔒
badge — until `isDigUpgradeRevealed(node, meta)` (digMeta.ts) says so. `TreeRow`
filters its `nodes` list down to only the ones currently revealed before
rendering (rather than threading a shared `revealed` boolean down through
`TreeBranch`, which couldn't express "this specific sibling has a stricter
requirement than the others" — see the `revealAt: 'maxed'` gate below). A
brand-new player opening Upgrades for the first time sees literally one box
(**Durability**, the root) and nothing else.

**Reveal can require the parent MAXED, not just owned** (`DigUpgradeNode.revealAt:
'maxed'`, digMeta.ts): the default threshold is parent level ≥ 1, but a node can
opt into requiring its parent's level === its parent's `levels.length` instead.
Currently only **Copper Vein** uses this (gated on **Dirt Value** being fully
maxed) — a deliberate pacing choice per an explicit request to force a straight,
focused early path down one branch rather than letting a new player spread one
dollar across three branches at once. `isDigUpgradeRevealed` is the single
source of truth for this check and is shared by both the tree's rendering AND
`purchaseDigUpgrade`'s gate, so a node can never render as buyable when it
isn't (or vice versa).

**Topology** — root **Durability** has 3 direct branches (a redesign from an
earlier 6-direct-branch version, per an explicit request to move Danger
Sense/Scanner deeper and gate Copper Vein behind Dirt Value):
```
Durability (root, id: pickaxe_1, 3 levels: 5 base → 7 → 12 → 15 charges)
├── Dirt Value (3 levels: $1 base → $2 → $3 → $4 plain-dirt cash)
│    └── Copper Vein (2 levels: unlock → spawns more often — UNLOCKS ONLY ONCE DIRT VALUE MAXED) ─┬── Silver Vein → Gold Vein → Platinum Vein → Diamond Vein (ore ladder)
│                                                                                                   └── Nugget Luck (double-payout chance)
├── Pickaxe (id: durability_1, 2 levels: Dirt eased → Copper eased too) → Strength → Bulk Click
└── Durability II (id: pickaxe_2, +8 more charges on top of the root's ladder)
     ├── Danger Sense → Danger Sense II (reveal 1 → 2 bombs/level)
     └── Scanner (probability) → Scanner Range (count)
```
See `docs/plans/dig-upgrade-tree.md` for the full node-by-node catalog (every
id, display name, tooltip string, and cost) kept as a standing reference for
brainstorming further changes — update it alongside `DIG_UPGRADES` if you
reshuffle the tree again.

**The root/child id-vs-name swap**: `pickaxe_1` (root, governs total charges)
now *displays* as "Durability", and `durability_1` (child, governs per-tile
hit count) now *displays* as "Pickaxe" — a deliberate flavor swap ("your
pickaxe has durability/charges; investing in the Pickaxe branch sharpens it
so each swing needs fewer hits") requested explicitly, implemented by
changing only `name`/`emoji` in `DIG_UPGRADES`, never the `id` — the id is
wired directly into `digLogic.ts`/`constants.ts` (`skills.pickaxe_1` still
drives charge count, `skills.durability_1` still drives toughness), so
renaming the id itself would have needed a localStorage migration for
existing players' saved progress for a purely cosmetic change. Don't assume
`name` and `id` agree anywhere in this tree — always check `DIG_UPGRADES` if
unsure which id backs a displayed name. The play screen's **CHARGES** stat
was renamed to **DURABILITY** to match (`DigHUD.tsx`, now shown with a ⛏️
icon instead of ⚡) — the underlying `DigGameState.chargesRemaining`/
`chargesMax` field names were NOT renamed (an internal-only rename would have
touched every call site in `digLogic.ts` for zero player-facing benefit).

**`DigUpgradeTree.tsx` is genuinely recursive**, not a fixed root+children layout —
`TreeBranch` renders a node, then (if it has children **and** the node itself
is owned) a row of recursively-rendered `TreeBranch`es, handling arbitrary
depth/branching correctly (the connecting lines themselves are handled
separately by the SVG overlay, not by anything `TreeBranch` renders inline —
see below). Still icon + name + price only in the visible layout (no inline
description text — the compact icon-grid has no room for it), but every
node's `button` now carries `title={name — description}` as a native hover
tooltip (same convention as Paytable.tsx's odds tooltips and DigHUD.tsx's
boss card) so a player can check what a node actually does before spending —
no lock badge, since a rendered-but-unowned node is by definition already
unlocked (see fog-of-war note above); the remaining visual states are level
(green bars) and `affordable` (dims the price if the player can't afford the
next level yet).

**Connector lines are a measured SVG overlay, not hand-placed CSS borders
(rewrite)**: an earlier version drew every line with absolutely-positioned
divs sized by percentages (`ConnectedRow`'s "half-border-per-child" trick) —
it handled a simple fan-out but two real bugs came from it: siblings with
different rendered heights (e.g. Danger Sense wrapping to two lines while
Scanner stayed on one) threw off the percentage math enough to visibly
misalign, and any layout change from a purchase could leave a line crooked
since the border pieces were positioned independently of where the boxes
actually landed. Replaced with a single `<svg>` layered over the whole tree
(`DigUpgradeTree.tsx`): every node's box gets a ref (`registerNode`, stored in
a `Map<DigUpgradeId, HTMLDivElement>`), a `useLayoutEffect` re-measures every
visible parent→child pair's `getBoundingClientRect()` after every render that
could move something (a purchase, a newly-revealed node, a window resize),
and `ElbowPath` draws a straight axis-aligned connector (out from the parent's
edge-center, one bend at the vertical midpoint, into the child's edge-center)
for each pair. Direction (does the line go down from the parent or up) is
detected per-edge by comparing measured `top` values, not passed in — so it's
correct regardless of which side of the root a branch is on. Because every
sibling's edge shares the same parent anchor point, several edges drawn
together naturally read as one trunk fanning into a T/comb of horizontal
branches — this is what makes the T-junctions above and below the root (and
at any other multi-child node) render as clean 90°-only lines with no
diagonals, for any number of children, at any depth. Measuring real DOM positions
instead of assuming symmetric percentages is also what fixed the "line goes
crooked after a purchase" bug — the SVG is only ever drawn from where things
actually are.

**Fixed-height name labels**: `TreeNode`'s name text has a fixed `minHeight`
(reserves 2 lines) regardless of whether the actual name wraps to one line or
two — this is what keeps siblings like Danger Sense (wraps) and Scanner
(doesn't) with their icon boxes level with each other. Before this, a
'flex-end'-aligned (bottom-aligned) row of "up" branches would push a
two-line node's icon box visibly higher than a one-line sibling's, since
bottom-alignment measures from the bottom of the whole column including the
name text.

**Root-centered "hub" layout**: the root (Durability) sits vertically in the middle
of the screen rather than pinned to the top, per an explicit "start the tree from
the middle" request. Its 3 direct branches are split into two groups
(`DigUpgradeTree.tsx`'s `upIds`) — `pickaxe_2` (Durability II, the shallowest branch:
just Danger Sense/Scanner hanging off it) renders **above** the root; `dirt_value_1`
(Dirt Value → Copper Vein → the ore ladder) and `durability_1` (Pickaxe → Strength →
Bulk Click) render **below**, reading as the two "core progression" paths. Each
group uses the `TreeRow`/`TreeBranch` pair with a `direction: 'up'|'down'` prop that
flips which side of the node its own children row renders on (an "up" branch
renders its children first, growing away from the root; "down" is the ordinary
top-down order) and which edge siblings align to (`flex-end` for "up" so boxes
bottom out toward the root, `flex-start` for "down"). This is a practical
two-direction interpretation, not a true polar/radial layout with arbitrary angles
— simpler to implement robustly with plain flexbox (the SVG overlay handles making
the *lines* look right regardless), and still delivers the "hub in the middle,
branches radiate outward" feel that was asked for. Which branch(es) go up vs. down
is just a visual-balance call (`upIds`) — reshuffle it freely if the tree's shape
changes again (e.g. the Dirt Value branch, now the deepest at 5 generations, may
eventually want to be the one alone above the root instead).

**Full-screen view, not a popup**: `DigUpgradeTree` renders as a genuine sibling
screen, not an overlay/modal — `IncrementalGame.tsx` holds a local `showUpgrades`
boolean and renders either `DigHomeScreen` or `DigUpgradeTree` full-screen while
`phase === 'HOME'`, the same way it already swaps between `DigHomeScreen`/the
DIGGING view/`DigRunOverOverlay`. `DigHomeScreen` never owns any popup state itself
— it just calls `onOpenUpgrades()`.

**The post-run loop goes straight to Upgrades, not back to the home screen**
(per an explicit "smooth loop: play → cash out → skill tree → play again or
back" request): `DigRunOverOverlay`'s button (`onContinue`, labeled "CONTINUE
TO UPGRADES") is wired in `IncrementalGame.tsx` to dispatch `BACK_TO_HOME`
**and** `setShowUpgrades(true)` together, so the very next render shows
`DigUpgradeTree` directly — `DigHomeScreen` is skipped entirely on this path
(it's still the first thing shown when Dig mode is entered fresh from
`ModeSelect`, and still reachable from its own "⛏ UPGRADES" button). Inside
`DigUpgradeTree`, the primary action is a prominent green **"⛏️ DIG AGAIN"**
button (`onPlayAgain`, dispatches `START_DIG` directly — no detour through
the home screen) with a small muted **"BACK"** text button underneath it
(`onClose`, `setShowUpgrades(false)` → falls back to `DigHomeScreen`) as the
secondary way out. `DigHomeScreen`'s own top-right `BackToMenuButton` (exit to
`ModeSelect`) is still one more step past that "BACK" if the player wants to
leave Dig mode entirely — the upgrade screen's "BACK" intentionally stays
scoped to Dig mode's own home, not the whole app, since it's reached from two
different contexts (fresh entry vs. post-run) and only one of them implies
"I might want to leave Dig mode."

### Dev debug panel (`DigDebugPanel.tsx`, `import.meta.env.DEV` gated)

Mirrors `DebugPanel.tsx`'s "🛠 button in top bar → right-side drawer" pattern, but
splits its writes across two different stores since Dig's persistent progression
lives outside `DigGameState`:
- **META section** — patches `digMeta.ts` directly via `debugSetDigMeta` (cash balance).
- **RUN section** — patches the current `DigGameState` via the same generic
  `{ type: 'DEBUG_PATCH'; patch: Partial<DigGameState> }` reducer case Standard uses.
- **BOSS section** — forces `state.activeBoss` for the current level (doesn't retroactively
  regenerate the board — a forced boss's generation-time effects, like Cave-In's bomb
  density, only apply to boards generated *after* the force, i.e. the next level).
- **UPGRADES section** — `debugSetUpgradeOwned(id, owned)` bypasses cost/parent gating
  entirely, writes `digMeta.ts`, **and** live-patches `state.skills` so the effect is
  visible in the current run immediately (still subject to the same "board-generation-time
  effects don't retroactively apply to an already-generated board" caveat as bosses —
  ore tiers, Danger Sense hints, and tile toughness are only rolled once, at
  `generateDigBoard` time, so a mid-level upgrade toggle won't change tiles already on
  the board, only the next level's).

### Board escalation & charges (tuned via `scripts/dig-sim.mjs` — see its limitation note above)

```typescript
calcDigBoardDim(level) = min(9, 5 + 2×floor(level/3))    // 1-2: 5×5 | 3-5: 7×7 | 6-8: 9×9 | 9+: capped
isDigCheckpointLevel(level) = level>0 && level%3===0      // every 3rd level: bigger board (above) + a boss (see Bosses)
calcDigBombDensity(level) = min(0.20, 0.08 + (level-1)×0.006)   // was 0.12 base/0.008 step/0.22 max — lowered, see below
calcDigCashBase(level, dirtValueLevel) = (dirtValueLevel>0 ? DIG_DIRT_VALUE_BY_LEVEL[dirtValueLevel-1] : 1) + (level-1)×1.2
DIG_DIRT_VALUE_BY_LEVEL = [2, 3, 4]  // Dirt Value node's 3 levels — base is $1 unowned
DIG_EMPTY_FRACTION = 0.30
DIG_CLEAR_BUFFER = 2        // see Charges section above
DIG_BASE_CHARGES = 5        // was 20 — dropped hard, see balance history below
DIG_PICKAXE_CHARGES_BY_LEVEL = [7, 12, 15]  // Pickaxe root's 3 levels — TOTAL charges, not deltas
DIG_PICKAXE_2_CHARGES = 8   // Pickaxe II child — flat add on top of the ladder's max
DIG_BASE_TOUGHNESS = 2              // every tile (dirt or ore) needs this many hits by default
DIG_DURABILITY_DIRT_TOUGHNESS = 1   // Durability node: plain Dirt only, drops to this
```

**Balance history**: the original placeholder numbers (charges=15, bomb density
base=0.12) made a level-1 clear essentially unreachable — `dig-sim.mjs` showed the
real bottleneck wasn't charge count at all (clear rates were flat from ~25 charges to
100), it was that a strict 100%-clear compounds bomb-avoidance risk across ~20+
clicks regardless of budget. Fixed with two changes together: `DIG_CLEAR_BUFFER`
(forgives the last couple of highest-risk clicks) and a lower/gentler bomb-density
curve. That tuning pass assumed 1 charge per tile.

**Then the baseline was deliberately dropped much further** — `DIG_BASE_CHARGES`
20→5, and every tile (dirt included) now costs `DIG_BASE_TOUGHNESS` (2) charges to
fully mine instead of 1 (see Durability/Strength/Bulk Click above). Re-running
`dig-sim.mjs` (its `dirtToughness` param mirrors this) shows level-1's true minimum
cost is now ~35 charges to literally clear the level — starkly higher than even the
fully-upgraded Pickaxe I+II budget of 21, so **clearing a level is not a realistic
goal at the start of a run any more; it's a mid/late-run milestone unlocked by
Durability/Strength/Pickaxe investment**. This is an intentional consequence of the
user's explicit ask, not a bug: a 5-charge run still banks some cash (median ~$8 at
skill=0 in the sim) from a handful of dirt digs even without clearing, since
running out of charges auto-banks the same as a voluntary cash-out — the early game
is now a tiny "grind a little, buy an upgrade, try again" loop rather than a
level-clearing loop. **Flag this to the user if the opening runs feel too punishing
once played by hand** — the sim direction is clear but, per its documented
limitation, doesn't model real deduction, and no human playtest pass has happened
against these exact numbers yet.

### Suggested Future Ideas (still open — nothing below is built)

- **Achievements/unlocks conversion for Standard mode** — still explicitly deferred,
  not part of this mode at all.
- **A real probability ladder for Scanner** (currently the root node does double duty
  as "unlock + set probability," with only one further count-boosting child) if a
  future pass wants a true 2-axis multi-tier scanner.
- **Multi-use Bomb Deflector, Steady Hands (first-click safety), richer ore-tier
  boss twists** — none of these from the original brainstorm made it into this pass;
  still fair game for a future tree-expansion session.
- **A cross-mode nod** — unlock a Standard-mode relic/flavor via a Dig milestone or
  vice versa, tying "two games, one universe" together without merging economies.
- **Revisit the Bulk Click model** (full-strength-per-tile vs. divided-strength) after
  real playtesting, per the user's original note — this was implemented as a
  judgment call, not a resolved design.
- **Rock tiles (later levels)** — a tile type that the basic pickaxe cannot dig **at
  all**, not just slowly. Some tiles would carry a "base required strength" threshold
  — below it, clicking does nothing (a hard gate, distinct from toughness/hit-count,
  which the basic pickaxe can always eventually overcome given enough clicks). Needs a
  Strength upgrade specifically built past that threshold before Rock becomes diggable.
- **Closed-off sections (e.g. water)** — a region of the board that's inaccessible
  until the player digs around to find a specific valve/hole tile that releases it,
  at which point that section becomes normally diggable. A real puzzle/gating
  mechanic, not a stat check — would need a new board-region concept (Dig's board is
  currently just a flat tile array with no zone/region data at all).
- **Dynamite charges skill** — a consumable/ability that blasts a whole radius of
  tiles at once instead of one tile per click, with two separate upgradeable axes:
  blast radius (how many tiles) and blast strength (how much damage each one takes).
  Distinct from Bulk Click (which is a fixed same-row splash at full strength, no
  radius/strength split).
- **Custom tile art (dirt / cracked dirt / ore-in-dirt images)** — the player asked
  whether textures can be swapped for uploaded images later. Yes: `DigGrid.tsx`
  currently renders every tile via emoji strings (`ORE_ICONS`/`ORE_COLORS` maps,
  plus the `⛏️`/`⚠️`/`💣` literals in `DigTileContent`) — no image-import scaffolding
  exists yet, but the pattern is already proven in Standard mode
  (`Grid.tsx`: `import bombSrc from '../assets/bomb.png'`, then `<img src={bombSrc}>`
  in place of an emoji). The swap is small and localized: drop image files under
  `src/incremental/assets/` (or reuse `src/assets/`), import them, and replace the
  relevant `<span>{emoji}</span>` in `DigTileContent`/`DigGridTile` with `<img>` tags —
  no changes needed to `DigTile`/`DigGameState` or any logic, since tile visuals are
  purely a render-time concern keyed off `tile.type`/`tile.oreTier`/`tile.state`.

---

## Adding New Content

**New relic:**
1. Add ID to `RelicId` union in `types.ts`
2. Add entry to `ALL_RELICS` in `constants.ts`
3. Hook effect into relevant gameLogic function

**New consumable:**
1. Add ID to `ConsumableId` union in `types.ts`
2. Add entry to `ALL_CONSUMABLES` in `constants.ts`
3. If placeable: add to `PLACEABLE_CONSUMABLES`
4. If auto-applied: handle in `generateBoard` or `handlePlaceBet`
5. If active during clearing: handle in `handleTileClick`

**New event card:**
1. Add ID to `EventCardId` union in `types.ts`
2. Add entry to `EVENT_CARDS` in `constants.ts`
3. Hook effect into `getSymbolWeights`, `generateBoard`, `getSymbolMod`, `handleTileClick`, or `handleCashout` — check via `state.active_events.includes(...)`
4. Remember it stacks permanently — don't design an effect that breaks if picked twice (either make it idempotent, or accept it as a "collect them all" run milestone)

**New boss:**
1. Add ID to `BossId` union in `types.ts`
2. Add entry to `BOSSES` in `constants.ts` — pool size changes automatically flow through `getBossForCycle`
3. Hook effect into the relevant gameLogic function, checking `state.active_boss === '...'`

**New combo:**
1. Add check in `handleTileClick` after the symbol tile block
2. Add to `combos_triggered` array (string key) to prevent re-triggering
3. Push to `active_combo_display` for overlay
4. Update ⓘ info overlay in `Grid.tsx` `ComboInfoOverlay`

**New pack boost axis** (currently only frequency/payout):
1. Add to `BoostAxis` union in `types.ts`
2. Apply the multiplier in `getSymbolWeights` (frequency-like) or `getSymbolMod` (payout-like), or wherever the new axis should hook
3. Add its label to the reveal card in `Shop.tsx`

**New meta-progression skill** (cross-run, spent via prestige points):
1. Add ID to `SkillId` union in `types.ts`
2. Add entry to `SKILLS` in `meta.ts` (name, emoji, per-level name/description/cost)
3. Add the id's default level (usually 0) to `defaultMeta().skills` in `meta.ts`
4. Hook `state.skills[id]` into whichever gameLogic function the skill should
   affect — `state.skills` is already snapshotted into every run via `createInitialState`
5. `SkillTree.tsx` and `DebugPanel.tsx`'s SKILLS section both iterate `SKILLS`
   automatically — no UI changes needed unless the skill needs bespoke display

**New Dig upgrade node** (Incremental mode's separate tree, `src/incremental/digMeta.ts`):
1. Add the id to the `DigUpgradeId` union in `src/incremental/types.ts`
2. Add an entry to `DIG_UPGRADES` in `digMeta.ts` (id, `parentId` — `null` for a new
   root, an existing node's id to branch off it — name, emoji, cost, description).
   `defaultDigMeta()` derives its defaults straight from `DIG_UPGRADES`, so a new id
   is automatically initialized to 0 — no separate default-value step needed.
3. Hook `state.skills[id]` (Dig's `DigGameState.skills`, snapshotted fresh in
   `startDig` — see Incremental Dig Mode section above for why it must be fresh,
   not read from stale reducer state) into whichever `digLogic.ts` function the
   upgrade should affect
4. `DigUpgradeTree.tsx`'s `TreeBranch` is genuinely recursive (renders a node, then
   a row of recursively-rendered children) — no layout changes needed regardless of
   how deep or wide the new node makes the tree, it just needs the right `parentId`
5. `DigDebugPanel.tsx`'s UPGRADES section iterates `DIG_UPGRADES` automatically too —
   no debug-panel changes needed either

---

## CSS Variables

```css
--bg-base, --bg-surface, --bg-raised, --bg-card  /* backgrounds dark→light */
--border, --border-glow
--gold, --gold-bright
--green, --green-bright
--red, --blue
--text-primary, --text-muted, --text-dim
```

Key animation classes: `tile-entrance`, `tile-reveal`, `icon-pop`, `combo-pop`, `bust-flash` (now 0.7s,
was 1.2s), `cashout-active`, `streak-full`, `stat-card-pulse` (ResultsOverlay wallet/ticket card update),
`fly-to-card` (ResultsOverlay winnings flying into the stat cards, `animation-delay` timed to the count-up).
Layout classes: `.stat-card`, `.stat-card-boss`, `.progress-track`/`.progress-fill`,
`.chip`, `.slot`/`.slot-empty`, `.rarity-{common,rare,legendary}`, `.choice-card`, `.card-rise`, `.overlay-in`, `.pip`/`.pip-lit`/`.pip-notch`.
