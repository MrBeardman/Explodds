# Explodds: Mine the Odds

A debt-deadline roguelite built on a 5×5 Minesweeper grid.

Earn cash by clearing tiles. Pay off your cycle deadline. Survive as long as you can.

---

## Running Locally

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build
```

**Stack:** React 19 · Vite 8 · TypeScript · Tailwind CSS v4

---

## How to Play

### The Core Loop

Each **CYCLE** you must earn enough cash to pay a **DEADLINE**.
You get **3 ATTEMPTS** per cycle. An attempt is one 5×5 board.

```
Pick event card → Set bet → Clear tiles → Cash out (or bust)
                                          ↓
                              3rd attempt done → Deadline check
                                          ↓
                              Pay deadline → Shop → Next cycle
                              Can't pay   → GAME OVER
```

### Bets & Earning

- Set your bet before each board (slider, $5 steps)
- **Bet is deducted immediately when you place it** — it's gone whether you bust or cash out
- Tiles earn cash based on their symbol × your current multiplier
- **Cash out anytime** to bank your earnings toward the deadline
- **Bust** = bomb hit, attempt is over, earnings lost, bet already spent

### Tile Types

| Tile | Effect |
|------|--------|
| 💎 Diamond | 1.0× cash modifier |
| 🍒 Cherry | 0.8× cash modifier |
| 🍌 Banana | 1.2× cash modifier |
| ⭐ Star | 1.5× cash modifier |
| 🔔 Bell | 0.9× cash modifier |
| 🪙 Coin | 2.0× cash modifier |
| _(empty)_ | No cash, breaks streak |
| 💣 Bomb | BUST — attempt over |

**Tile cash = (3 + bet/20) × symbol modifier × multiplier**

A $50 bet gives ~$5.50 base per tile. A $150 bet gives ~$10.50 base.

### Multiplier & Streak

- Multiplier starts at ×1.0 each attempt, grows with every symbol tile
- More bombs in the board = faster multiplier growth
- **Streak** = consecutive symbol tiles without hitting empty or busting
- Streak milestones:
  - 🔥 **5 streak** → +0.2 multiplier bonus
  - 🔥 **10 streak** → +0.5 multiplier bonus
  - 🔥 **15 streak** → +$5 flat

### Combos

Combos trigger once per attempt and give bonus rewards:

| Combo | Trigger | Reward |
|-------|---------|--------|
| 🍒 Cherry Rush | 3+ cherries in same row or column | +$12 |
| 🍌 Banana Split | 2 adjacent banana tiles | ×2 retroactive on both bananas |
| ⭐ Star Power | 3+ stars revealed | +$18 |
| 🔔 Bell Storm | 4+ bells revealed | Streak jumps to 10 |
| 💎 Diamond Run | 4+ diamonds revealed | +15% of current earnings |
| 🪙 Coin Jackpot | 2+ coins revealed | +4 🎫 tickets |

Press **ⓘ** on the grid to see live payout table (shows relic upgrades in gold).

### Currencies

**💵 Cash** — used for bets and buying consumables. Lost on bad bets.

**🎫 Tickets** — earned on cashout, never lost on bust. Spent on relics in the shop.
- +2 tickets on every cashout
- +3 bonus tickets if you earned more than 1.5× your bet

### Cashout Button Colors

- **Gray** — nothing earned yet, can't cash out
- **White/Green** — can cash out, won't cover the deadline
- **Gold pulsing** — cashing out now would pay off the deadline!

---

## Deadlines

| Cycle | Deadline |
|-------|----------|
| 1 | $100 |
| 2 | $180 |
| 3 | $290 |
| 4 | $430 |
| 5 | $600 |
| 6+ | ×1.35 each cycle |

**Interest bonus:** If after paying the deadline you have >30% of the deadline left, you earn 15% of that surplus as a bonus.

---

## Shop (after each cycle)

Spend **💵 cash** on consumables. Spend **🎫 tickets** on relics.
Rerolling either tab costs **2 🎫 tickets** (once per tab per shop visit).

### Consumables

| Item | Price | Effect |
|------|-------|--------|
| ✨ Scatter Reveal | $15 | Hint 3 safe tiles before attempt |
| 🔍 Scanner | $20 | Reveal a full row or column |
| 🔧 Defuser | $25 | Place on tile — if bomb, neutralises it |
| 🧲 Tile Magnet | $18 | Auto-hints nearest safe tile every 5 clears |
| 🍀 Lucky Tile | $12 | Place on tile — if safe, +$5 flat |
| 🧹 Empty Eraser | $10 | 2 fewer empty tiles next board |

### Relics (max 6 active)

| Relic | Cost | Effect |
|-------|------|--------|
| 🪙 Greed Chip | 8🎫 | +$3 flat on every cashout |
| ⚡ Adrenaline Core | 10🎫 | Multiplier grows 20% faster |
| 🍒 Cherry Picker | 10🎫 | Cherry Rush → $20 |
| 🍌 Banana Baron | 12🎫 | Banana Split → ×3 |
| ⭐ Star Magnet | 8🎫 | Star Power → $28 |
| 🔔 Bell Captain | 10🎫 | Bell Storm → streak 20 |
| 💎 Diamond Dealer | 12🎫 | Diamond Run → +25% |
| 💰 Coin Tycoon | 8🎫 | Coin Jackpot → +8🎫 |
| ⛏ Safe Digger | 8🎫 | 3 fewer empty tiles every board |
| 🦺 Bomb Suit | 15🎫 | First bust per cycle: bet refunded |
| 🔥 Hot Hands | 10🎫 | Streak 5 bonus: +$8 (instead of +0.2 mult) |
| 🎰 Lucky Charm | 12🎫 | 1 guaranteed coin tile per board |

---

## Event Cards

At the start of each cycle, pick one of 3 modifiers. Auto-selects after 8 seconds.

| Card | Effect |
|------|--------|
| 🔥 Hot Streak | Each attempt starts with streak 5 |
| 🍒 Cherry Season | Cherry weight ×2 |
| 🍌 Banana Bonanza | Banana weight ×2 |
| ⭐ Star Shower | Stars worth ×1.5 |
| 🪙 Coin Rush | Coin weight ×2; Coin Jackpot → +6🎫 |
| 🛡 Safe Zone | 4 fewer empty tiles |
| 💥 Danger Pay | +3 bombs; tile value ×1.4 |
| 🔔 Bell Ringer | Bell Storm needs only 3 bells |
| 🍀 Lucky Board | First attempt: no empty tiles |
| 💸 Greed Mode | Cashout +30%, but min bet $25 |

---

## Developer Notes

See `CLAUDE.md` for the full technical reference (state shape, formulas, pitfalls, how to add new content).
