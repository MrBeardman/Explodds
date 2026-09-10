# Standard mode — loop review & rework (2026-09)

Bot playtest of the Standard-mode loop, the findings that came out of it, and
the rework that followed. Numbers come from `npm run bots`
(`scripts/playtest-bots.mjs`), which drives the real reducer code — the older
`npm run sim` mirrors formulas by hand and is only a rough cross-check.

## Findings on the pre-rework build

| Player (min bet, old rules) | Median cycles | Bust / attempt | Provable clicks |
|---|---|---|---|
| Random clicker | 2 | 44% | 0% |
| Deduction solver | 4 | 52% | 8–40% |
| Solver + Sixth Sense (numbers on every tile) | 10 | 34% | ~80% |
| Solver + Sixth Sense, betting 30% of wallet | **25** (immortal) | 19% | ~72% |

1. **Skill was starved of information.** Numbers appeared only on empty tiles
   (25% of safe tiles), which also reset the streak and paid nothing — the
   information layer was the punished tile. Half of all attempts never showed a
   single number.
2. **The economy compounded without bound** once a player could clear boards:
   tile cash ∝ bet, bet ∝ wallet, a cleared board paid 12–35× the bet, so a
   skilled player's wallet went ×7 per attempt and deadlines (+30%/cycle) were
   irrelevant by cycle 2. The game was only "balanced" because deduction was
   starved.
3. **Bomb count was the only difficulty axis** and it killed deduction past ~8
   bombs on a 5×5; late game degenerated into "free first click, cash out".
4. **Depositing early was strictly dominated** (7% interest never beats
   positive-EV betting) and **Cascade Sense had no measurable effect**.
5. **Bugs:** Saboteur + cascade paid an armed bomb as a null symbol → NaN wallet;
   `sim.mjs` still drew the removed coin symbol.

## What changed

### Skill layer (`src/deduction.ts` is the single source of truth)
- **Every revealed safe tile shows its adjacent bomb count.** Sixth Sense is gone.
- **Guaranteed opening.** The first click can never be a bomb (bombs are
  *relocated* by swapping with a hidden safe tile, so the 💣 counter stays
  honest). Cascade Sense now widens the opening: level 1–2 make the plus shape
  (clicked tile + 4 side neighbours) bomb-free; level 2 also removes the cascade
  cap. A full 3×3 opening was tried and rejected — on a 5×5 it hands over 36%
  of the board and a perfect deducer then proves everything at any bomb count.
- **Proven vs. guess.** Each deliberate click is tagged by `analyzeBoard`
  (constraint propagation over exactly what the player can see, incl. the 💣
  counter, ⚠ marks, hints and Ledger totals). Proven clicks build a
  **deduction streak** and add `DEDUCTION_MULT_GAIN` to the multiplier; a guess
  resets both the deduction streak and the symbol streak. Empty tiles no longer
  reset anything. An attempt with ≥4 proven clicks and 0 guesses pays a
  **Flawless** ticket bonus. Proven tiles get a green edge; the HUD shows the
  streak and proven/guess counts.
- **Cashout needs one deliberate reveal** after the free opening (no more
  "free click, cash out" loop).

### Economy
- **Stake returned on cashout.** Bet is a stake: cashout returns stake +
  winnings, a bust loses the stake. Results list "Stake returned" explicitly.
- **Sub-linear tile cash:** `0.22 × bet^0.9` (no flat part). Multiplier growth
  flattened (`0.04 + 0.005 × bombs` per tile, streak milestones +0.15 / +0.35)
  so a well-played board returns ~2–3× the stake instead of 12–35×.
- **Bet is a risk dial:** +1 bomb per ~17% of wallet bet, up to +5. Base bombs
  3/4/5/6/7 for cycles 1–5, then +1 every 2 cycles, capped at 9.
- **Deadline chases the bankroll:** next deadline = max(curve, 50% of wallet).
  Curve lowered to 60/90/120/160/200 then ×1.22.
- **Deposit is a real decision:** interest 12% (+5% Compound Chip) and
  **Collateral** — with ≥50% of the deadline deposited, every attempt that cycle
  deals one fewer bomb. In the bot test, banking half the deadline up front now
  beats deferring (11 vs 8 median cycles for the 30% bettor).

### Content
- Relics: **Ledger** (row bomb totals on the board edge), **Logician**
  (+0.08 mult per proven click), **Gut Feeling** (once per cycle a guess that
  would bust is spared), **Echo** (after a bust the next board starts with 2
  numbers revealed).
- Consumable: **Probe** (test one hidden tile: ⚠ if bomb, safe hint if not).
- Bosses: **The Liar** (one number per board is off by one), **The Mirror**
  (numbers count diagonals only), **The Curfew** (attempts end after 10
  reveals). **Blackout** now only hides numbers on symbol tiles (i.e. the
  pre-rework information level) instead of deleting the skill layer.

## Post-rework bot numbers (300 runs each, Cascade Sense 1)

See `npm run bots` for the live table. At the time of writing (median / p90):
random clicker 2 / 3; imperfect solver (follows proofs 75% of the time) 3 / 4;
perfect solver at min bet 6 / 8; perfect solver betting 30% 6 / 9, and 9 / 16
when banking collateral early; + Ledger 9 / 17; + Gut Feeling + Echo 12 / 22.
Nobody is immortal: the best single runs across all profiles top out in the
30s and are bounded by the deadline chase. Bomb-count sweep (perfect solver,
plus opening, bet $16): bust 15–33% and 92–70% provable clicks across 4–8
bombs — the intended skill regime.

## Second pass (same session)

- **Board growth** is the second difficulty axis: 5×5 for cycles 1–5, 6×6 for
  6–9, 7×7 from 10 (`BOARD_GROWTH`). Bombs follow a density curve on the
  growing board (0.22 at cycle 6, +0.02/cycle, cap 0.34) instead of a flat cap.
  Every index/row/col conversion now goes through `boardCols(board)`.
  **The Mason** boss lays bombs in touching pairs (bomb-pattern axis).
- **Event cards** are cycle-scoped; picking the same card twice makes it a
  permanent trait (max 3). `active_events` is the derived union.
- **Archetype relics**: Second Sight, Cartographer (Deduction); Double Down,
  Loaded Dice (Gambler); Vault (Banker). Gut Feeling now ends the attempt as a
  forced cashout instead of relocating the bomb (it was carrying runs alone).
- **Unlocks**: Double Down, Second Sight, Vault and Cartographer start locked
  and are unlocked by feats (`UNLOCKABLES` in meta.ts), announced on Game Over
  and listed on the Start Screen. **Daily run**: same seed for everyone per
  UTC day, best-of-day kept in meta.

Bot numbers after this pass (median / p90, `npm run bots`): random 2 / 2; noisy
solver 3 / 4; perfect solver min bet 7 / 10; 30% bets 6 / 14; collateral play
14 / 22; + Ledger 13 / 24; + Cartographer 14 / 28; + Gut Feeling 15 / 29.
Gut Feeling is the strongest single relic for a perfect deducer (it turns one
forced guess per cycle into a safe cashout) — it is a 16🎫 legendary for that
reason; a human who guesses more than once per cycle gets far less out of it.

## Third pass — first human playtest (2026-09-10)

Findings: (1) "after some money it's easy to click once or twice and cash
out" — the free opening plus one provable click returned the full stake and
winnings scaled with the bet, a risk-free ~30% wallet gain per attempt;
(2) "11 bombs on a 6×6 is way too much" — the density curve reached 28–34%,
well past expert minesweeper (~21%); (3) "$22 for a pack is nothing when the
deadline is $1,000".

Changes: the full stake only comes back once `STAKE_RETURN_CLEAR_FRAC` (30%)
of the safe tiles are revealed (pro rata before that, shown live on the
CASHOUT button); densities cut to 16–22% with `[4,4,5,5,6]` on the 5×5 cycles
and the bet-ratio cap at +4; shop cash prices scale with the deadline and flat
cash rewards with the bet; tile cash normalised by board area (a full clear
pays the same ~3× multiple on any board); multiplier growth halved (a cycle-1
full clear had paid 7–9× and taken the wallet ×40); 2 attempts per cycle from
cycle 10; collateral needs 75% deposited, interest 8%; Ledger shows one row.

Bot numbers after it (median / p90): random 1 / 2; noisy solver 2 / 3;
perfect solver min bet ~5 / 10; 30% bets ~4–6 / 13; + Ledger ~12 / 24;
+ Gut Feeling + Echo ~5–10 / 14; banking 75% collateral early ~16 / 29 (the
one line a perfect deducer can still ride a long way — a human who can't
clear 88% of boards gets far less from it).

## Still open
- Compass / Assayer-style relics that change the *shape* of numbers (skipped:
  Compass is a sidegrade, Assayer needs a second number on the tile).
- Human playtest pass: the bots are perfect or noisy deducers, not people —
  the noisy-solver numbers (3–4 cycles) are the ones most worth checking by hand.
