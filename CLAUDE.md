# Explodds — AI Developer Guide

Complete reference for continuing development. Read this before touching any code.

---

## What This Game Is

**Explodds: Mine the Odds** is a debt-deadline roguelite built on a 5×5 Minesweeper grid.
Think CloverPit (endless pressure loop) with Balatro-style relics/consumables.

The player survives **endless cycles**. Each cycle has a **DEADLINE** (cash amount).
They get **3 ATTEMPTS** per cycle. Each attempt = one board. After 3 attempts, deadline is checked.
Miss the deadline → **GAME OVER**. Beat it → shop, then next cycle with a bigger deadline.

This is NOT a 6-round game with a win condition. It is endless until the player fails.

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
src/
├── types.ts          — All TypeScript interfaces (GameState, Tile, etc.)
├── constants.ts      — Symbols, relics, consumables, event cards, formulas
├── gameLogic.ts      — All pure game functions (no React)
├── rng.ts            — Seeded RNG utilities
├── App.tsx           — useReducer + layout + LeftPanel component
├── index.css         — CSS variables, animations
└── components/
    ├── Grid.tsx           — 5×5 tile grid + bust flash + ⓘ overlay
    ├── HUD.tsx            — Right panel: cycle, deadline, attempts dots, mult, relics
    ├── Shop.tsx           — Bottom-sheet overlay (consumables + relics tabs)
    ├── EventCards.tsx     — Compact top banner (EventBanner component)
    ├── ComboOverlay.tsx   — Animated combo notifications above grid
    ├── ConsumablePlacement.tsx — Pre-attempt tile placement overlay
    ├── GameOver.tsx       — Full-screen overlay (not navigation)
    └── StartScreen.tsx    — Landing screen
```

---

## State Shape (GameState — src/types.ts)

```typescript
phase: 'START' | 'EVENT_CARD' | 'BET' | 'PLACEMENT' | 'CLEARING' | 'BUST_FLASH' | 'SHOP' | 'GAME_OVER'

// Economy
wallet: number        // player's cash (starts $150)
tickets: number       // second currency for relics (starts 0)

// Cycle
cycle_number: number  // starts 1, never resets
deadline: number      // cash owed at end of this cycle
deposited: number     // paid toward deadline so far this cycle
attempts_remaining: number  // 3 per cycle, counts down
bomb_suit_used: boolean     // Bomb Suit relic — resets each cycle

// Attempt
current_bet: number         // set by slider, deducted at PLACE BET
attempt_earnings: number    // accumulated this attempt (not in wallet yet)
multiplier: number          // grows per symbol tile cleared
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

// Event / relics
active_event: EventCardId | null
event_card_options: EventCardId[]  // 3 options shown in banner
relics: RelicId[]
consumables_owned: ConsumableId[]
consumables_placed: { tile_index, type }[]  // set during PLACEMENT phase
placement_queue / placing_index            // drives ConsumablePlacement
pending_scanner_axis: 'row' | 'col' | null

// Shop (populated when phase → SHOP)
shop_consumables / shop_relics
shop_consumables_rerolled / shop_relics_rerolled  // 2🎫 per reroll, once each

// Run stats
cycles_survived / total_earned / highest_multiplier / best_streak / seed
```

---

## Phase Flow

```
START → [click NEW RUN]

START_GAME → EVENT_CARD
  (3 cards shown, 8s auto-select)

SELECT_EVENT_CARD → BET
  (bet slider, PLACE BET button)

PLACE_BET:
  wallet -= bet  (immediately)
  generate board
  if placeable consumables (defuser/lucky_tile): → PLACEMENT
  else: → CLEARING

CLEARING (tiles clickable):
  - Symbol hit → earn cash, check combos
  - Empty hit  → streak = 0, no cash
  - Bomb hit   → phase = BUST_FLASH
                  attempts_remaining--
                  attempt_earnings = 0
  - CASHOUT    → wallet += earnings, deposited += earnings
                  attempts_remaining--
                  if attempts > 0: → BET
                  if attempts = 0: endCycleCheck()

BUST_FLASH (1.2s, auto-transition):
  if attempts > 0: → BET
  if attempts = 0: endCycleCheck()

endCycleCheck():
  if wallet >= deadline:
    wallet -= deadline
    interest bonus if leftover > 30% of deadline
    → SHOP
  else:
    → GAME_OVER

SHOP → [START CYCLE N+1] → EVENT_CARD
```

---

## Core Formulas

```typescript
// Deadlines
cycle 1–5: [100, 180, 290, 430, 600]
cycle 6+:  Math.round(prev * 1.35 / 10) * 10

// Base bombs per cycle
cycles 1-2: 3 | 3-4: 5 | 5-6: 7 | 7+: 9

// Dynamic bomb count (from bet)
bombs = base + floor((bet / wallet) × 5), capped at base + 5, max 24
+3 extra if Danger Pay event active

// Tile cash
baseCash = 3 + (bet / 20)
cash = baseCash × symbolModifier × multiplier
   [× 1.4 if Danger Pay]
   [× 1.5 for star if Star Shower]

// Symbol modifiers
diamond 1.0 | cherry 0.8 | banana 1.2 | star 1.5 | bell 0.9 | coin 2.0

// Multiplier growth per symbol tile
gain = 0.08 + (bombs × 0.01)
gain ×= 1.2 if Adrenaline Core relic

// Streak milestones
streak 5:  +0.2 mult (or +$8 if Hot Hands relic)
streak 10: +0.5 mult
streak 15: +$5 flat

// Cashout tickets
+2 always, +3 bonus if earnings > bet × 1.5

// Cashout modifiers
+30% if Greed Mode event
+$3 if Greed Chip relic

// Interest bonus (shown in shop)
if (leftover_after_deadline > deadline × 0.3):
  bonus = floor(leftover × 0.15)
```

---

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
| Coin Jackpot | 2+ coins | +4🎫 | Coin Tycoon → +8🎫, Coin Rush event → +6 |

Banana Split retroactive: tracked via `banana_tile_earnings[]`.
When triggered: `attempt_earnings += sum(banana_tile_earnings) × (mult - 1)`.

---

## Board Generation (generateBoard)

```
RNG seed: state.seed + cycle_number × 1000 + attempt_key × 100

1. Count empties:
   base = round(non-bomb × 0.45)
   if safe_zone event: -4
   if safe_digger relic: -3
   if empty_eraser consumable: -2
   if lucky_board event AND first attempt: 0 (no empties)

2. Build type array: [bomb×n, symbol×m, empty×k]
3. Shuffle, assign to tiles
4. Assign symbols via weightedChoice (weights affected by event card)
5. Lucky Charm relic: force one coin tile
6. Scatter Reveal consumable: hint 3 safe tiles (state = 'hinted')
```

---

## Relics (all 12 — src/constants.ts ALL_RELICS)

| ID | Effect | Cost |
|----|--------|------|
| greed_chip | +$3 flat per cashout | 8🎫 |
| adrenaline_core | Mult grows ×1.2 faster | 10🎫 |
| cherry_picker | Cherry Rush → $20 | 10🎫 |
| banana_baron | Banana Split → ×3 | 12🎫 |
| star_magnet | Star Power → $28 | 8🎫 |
| bell_captain | Bell Storm → streak 20 | 10🎫 |
| diamond_dealer | Diamond Run → +25% | 12🎫 |
| coin_tycoon | Coin Jackpot → +8🎫 | 8🎫 |
| safe_digger | 3 fewer empties/board | 8🎫 |
| bomb_suit | First bust/cycle: bet refunded | 15🎫 |
| hot_hands | Streak 5 bonus: +$8 (not +0.2 mult) | 10🎫 |
| lucky_charm | 1 guaranteed coin tile/board | 12🎫 |

Max 6 relics active. Relic reroll costs 2🎫.

---

## Consumables (src/constants.ts ALL_CONSUMABLES)

| ID | Price | When applied | Effect |
|----|-------|-------------|--------|
| scatter_reveal | $15 | Board generation | Hint 3 safe tiles |
| scanner | $20 | CLEARING (button) | Reveal row or col |
| defuser | $25 | PLACEMENT phase | Bomb on tile → becomes empty |
| tile_magnet | $18 | CLEARING (passive) | Auto-hint nearest safe every 5 clears |
| lucky_tile | $12 | PLACEMENT phase | +$5 when placed tile cleared |
| empty_eraser | $10 | Board generation | -2 empty tiles |

scatter_reveal and empty_eraser are auto-consumed at board generation (removed from inventory).
defuser and lucky_tile trigger PLACEMENT phase before board is clickable.
scanner: button in left panel → pick row/col → click tile.

---

## Event Cards (10 pool, 3 shown per cycle)

| ID | Effect |
|----|--------|
| hot_streak | Each attempt starts with streak = 5 |
| cherry_season | Cherry weight ×2 |
| banana_bonanza | Banana weight ×2 |
| star_shower | Star modifier ×1.5 (1.5 → 2.25) |
| coin_rush | Coin weight ×2; Coin Jackpot → +6🎫 |
| safe_zone | -4 empty tiles |
| danger_pay | +3 bombs; tile value ×1.4 |
| bell_ringer | Bell Storm threshold: 4 → 3 bells |
| lucky_board | First attempt this cycle: no empty tiles |
| greed_mode | Cashout ×1.3; min bet $25 |

---

## UI Layout

```
┌─────────────────────────────────────────────────────┐
│ EXPLODDS                          💵 $XXX   🎫 XX   │
├──────────────┬──────────────────────┬────────────────┤
│ LEFT (w-48)  │   CENTER (flex-1)    │ RIGHT (w-48)   │
│              │                      │                │
│ BET AMOUNT   │ [EventBanner]        │ CYCLE X        │
│ $XX          │   (phase=EVENT_CARD) │ DEADLINE $XXX  │
│ [slider]     │                      │ DEPOSITED $XXX │
│              │ [ComboOverlay]       │ OWED $XXX      │
│ 💣 Bombs: X  │  (absolute, z-10)    │ ──────────     │
│ 💵/tile: $X  │                      │ MULT ×X.X      │
│              │  5×5 Grid            │ 🔥 STREAK X    │
│ [PLACE BET]  │  + bust flash        │ ──────────     │
│              │  overlay             │ ATTEMPTS       │
│  ── or ──    │                      │ ● ● ○  (2/3)   │
│              │ 💣 X · X safe · X   │ ──────────     │
│ [CASHOUT]    │  empty    [ⓘ]        │ RELICS         │
│ +$XX.XX      │                      │ [emoji icons]  │
└──────────────┴──────────────────────┴────────────────┘

Overlays (absolute, z-20+):
  PLACEMENT  — black/80 backdrop + ConsumablePlacement card
  SHOP       — bottom-sheet, slides up from bottom
  GAME_OVER  — full overlay, black/88 backdrop
```

---

## Key Reducer Actions (App.tsx)

| Action | When | Effect |
|--------|------|--------|
| START_GAME | Start screen click | createInitialState + draw event cards → EVENT_CARD |
| SELECT_EVENT_CARD | Banner click | active_event set → BET |
| AUTO_SELECT_EVENT | 8s timeout | random pick from options → BET |
| SET_BET | Slider move | clamp to [minBet, wallet], snap to $5 |
| PLACE_BET | Button click | wallet -= bet, generate board → PLACEMENT or CLEARING |
| PLACE_CONSUMABLE | Tile click in PLACEMENT | assign consumable to tile |
| SKIP_PLACEMENT | Button | skip remaining placements → CLEARING |
| TILE_CLICK | Grid click | handleTileClick (symbol/empty/bomb logic) |
| ACTIVATE_SCANNER | Button | set pending_scanner_axis |
| CASHOUT | Button | handleCashout → BET or endCycleCheck |
| BUST_FLASH_END | 1.2s useEffect | → BET or endCycleCheck |
| CLEAR_COMBO_DISPLAY | 2.5s useEffect | clear active_combo_display |
| BUY_CONSUMABLE | Shop | wallet -= price, add to owned |
| BUY_RELIC | Shop | tickets -= cost, add to relics |
| REROLL_CONSUMABLES | Shop | tickets -= 2, new consumable list |
| REROLL_RELICS | Shop | tickets -= 2, new relic list |
| NEXT_CYCLE | Shop button | startNextCycle → EVENT_CARD |
| RESTART | Game over | createInitialState → START |

---

## Common Pitfalls

- **Bet deducted at PLACE BET**, not at cashout/bust. Bust = bet is already gone.
- `attempt_earnings` is NOT in wallet until CASHOUT. Don't add it to wallet display.
- `deposited` resets to 0 each cycle (reset in `startNextCycle`).
- `bomb_suit_used` resets each cycle. `safetyNetUsed` was removed (old system).
- Empty tiles break streak and give no cash — they're not bombs, just dead tiles.
- Combo checks run after every symbol tile. They must check already-revealed tiles in `board`, not just the current tile.
- Banana Split retroactive: uses `banana_tile_earnings[]` (list of cash each banana earned). On trigger: add `sum × (mult - 1)`.
- Scanner removes itself from `consumables_owned` via `removeOne()` after use.
- `scatter_reveal` and `empty_eraser` are consumed at board gen (removed in `handlePlaceBet`).
- Lucky Board: only applies to first attempt per cycle. `lucky_board_used` tracks this.

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
3. Hook effect into `generateBoard`, `handleTileClick`, or `handleCashout`

**New combo:**
1. Add check in `handleTileClick` after the symbol tile block
2. Add to `combos_triggered` array (string key) to prevent re-triggering
3. Push to `active_combo_display` for overlay
4. Update ⓘ info overlay in `Grid.tsx` `ComboInfoOverlay`

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

Key animation classes: `tile-entrance`, `tile-reveal`, `icon-pop`, `combo-pop`, `bust-flash`, `cashout-active`, `streak-full`.
