# Explodds v2.0 — Update Map

## What's Changing vs Staying

### KEEP
- 5×5 grid structure, tile states (hidden/hinted/revealed/defused)
- Tile entrance + reveal animations (CSS)
- Bomb/diamond sprite assets
- Vite + React + TypeScript + Tailwind stack

### FULL REWRITE
- types.ts — new symbols, currency, phases, event cards
- constants.ts — new levels, items, event cards data
- gameLogic.ts — symbol system, economy, streak meter, boss rounds
- App.tsx — full 10-phase state machine
- All components — new casino theme + new mechanics

### NEW FILES
- src/rng.ts
- src/components/EventCards.tsx
- src/components/BetPhase.tsx
- src/components/ConsumablePlacement.tsx
- src/components/RoundSummary.tsx
- src/components/BossReward.tsx
- src/components/WinScreen.tsx

---

## Stage Plan

### STAGE 1 — Foundation (types + constants + rng)
**Files:** rng.ts, types.ts, constants.ts
**Deliverable:** All TypeScript types compile, all game data defined
- Seeded RNG (mulberry32)
- SymbolId, EventCardId, CharmId, RelicId (×12), ConsumableId (×8)
- GamePhase (10 states)
- Full GameState shape
- LEVELS with isBoss flags
- BOSS_BOMBS fixed layouts (rounds 3 & 6)
- All EVENT_CARDS data
- All RELICS data
- All CONSUMABLES data

### STAGE 2 — Game Logic (gameLogic.ts)
**Files:** gameLogic.ts
**Deliverable:** All mechanics implemented, reducible to tests
- generateGrid: symbol assignment, weighted random, event card modifiers
- Streak meter: per-tile increment, bell bonus, guarantee trigger
- handleTileClick: safe tiles (points + gems), bombs, defuser, magnet trigger
- calcCashout: bet-based formula, star/cherry/banana bonuses
- handleCashout: transition to round_summary
- Event card application: all 12 cards
- All relic passive effects
- generateShopItems (consumables + relics)

### STAGE 3 — App State Machine (App.tsx)
**Files:** App.tsx
**Deliverable:** All 10 phases transition correctly
Phases (in order):
  start → event_card → bet → consumable_placement → playing
  → round_summary → shop → [boss_reward] → event_card | gameover | win

Actions: START_RUN, SELECT_EVENT_CARD, SET_BET, START_ROUND,
  PLACE_CONSUMABLE, TILE_CLICK, USE_SCANNER, CASHOUT,
  GO_TO_SHOP, BUY_CONSUMABLE, BUY_RELIC, REROLL_SHOP,
  REROLL_RELICS, NEXT_ROUND, PICK_BOSS_RELIC, RESTART

### STAGE 4 — Visual Theme (index.css + index.html)
**Files:** index.html, src/index.css
**Deliverable:** Dark casino aesthetic
- Google Fonts: Bebas Neue (headers), JetBrains Mono (numbers)
- Background: deep navy #080b10 + subtle felt texture
- Accent: neon gold #c8a84b, green #2ea84a, red #dc2626
- Tile cards: dark with gold border on hover
- Glow effects for streak/cashout/boss

### STAGE 5 — Components
**5a:** StartScreen (NEW — casino vibe, start button)
**5b:** EventCards (NEW — 3 cards, pick 1)
**5c:** BetPhase (NEW — slider, min/max, estimated payout)
**5d:** ConsumablePlacement (NEW — pre-round tile assignment)
**5e:** Grid (REWRITE — symbols, 6 symbols, streak glow, boss styling)
**5f:** HUD (REWRITE — top bar, multiplier, streak meter, bottom bet/cashout)
**5g:** RoundSummary (NEW — score, payout, gems, symbol bonuses)
**5h:** Shop (REWRITE — two tabs: consumables/$cash, relics/gems)
**5i:** BossReward (NEW — pick 1 of 3 free relics)
**5j:** GameOver + WinScreen (REWRITE — run tokens, stats)

---

## Key Mechanic Details

### Economy
- Cash ($): betting, shop consumables. Hitting $0 = run over.
- Gems (💎): earned only from clearing tiles. Shop relics.
- Bet → payout = bet × max(2.0, score/target × 2.0)
- Bonus: +$0.50 per 10% over target, +$1 per star, star_shower = +$2

### Symbols (weighted random on grid gen)
| Symbol | Emoji | Pts | Weight | Special |
|--------|-------|-----|--------|---------|
| Diamond | 💎 | 100 | 20% | standard |
| Cherry | 🍒 | 80 | 20% | 3-in-a-row = +50% payout bonus |
| Banana | 🍌 | 120 | 18% | adjacent cluster × 1.5 pts each |
| Star | ⭐ | 150 | 12% | +$1 flat to cashout |
| Bell | 🔔 | 90 | 18% | streak meter fills 1.5× faster |
| Coin | 🪙 | 200 | 8% | +1 gem on reveal |

### Streak Meter
- +10 per tile cleared (bell: +15)
- At 100%: next click is guaranteed safe + 3× points
- Resets to 0 on cashout or bomb hit
- Lucky Streak relic: resets to 50% on cashout

### Boss Rounds (3 & 6)
Round 3 fixed bombs (8): diamond pattern indices [2,6,8,10,14,16,18,22]
Round 6 fixed bombs (16): border indices [0,1,2,3,4,5,9,10,14,15,19,20,21,22,23,24]
After winning boss round → pick 1 of 3 free relics

### Event Cards (pick 1 of 3 before each round)
All 12 implemented. Effects apply for that round only.

---

## Implementation Notes
- No prop drilling: all game state via useReducer + context
- Seeded RNG (mulberry32) stored in state for reproducible runs
- Mobile-first grid: works at 375px
- Sound: TODO (not in this update)
- Charm meta-progression: TODO (not in this update)
