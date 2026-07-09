# Explodds — Backlog / Future Ideas

Not part of the current single-player prototype. Notes for when this moves
toward a live, hosted build.

## Leaderboard (post-launch)

- Global high-score leaderboard once the game is hosted live.
- Players submit a name + score (likely `cycles_survived` and/or `total_earned`
  at run end) at GAME_OVER.
- Needs a backend: auth (maybe Google sign-in) to prevent spoofed submissions,
  a scores table, anti-cheat consideration (the whole sim currently runs
  client-side with a visible seed — a submitted score needs some server-side
  validation or at least seed/replay logging to be trustworthy).
- Not started. Revisit once the game has a real deployment target.

## Design notes (Balatro / CloverPit research, 2026-07)

Quick research pass done at the user's request while designing the combo-crafting
relics (Synergist/Sixth Sense/Chain Reaction). Findings and how they map to Explodds:

- **Balatro's core insight**: multiplicative stacking beats additive stacking —
  two +30 Mult jokers give +60, but a +30 Mult joker paired with an ×2 Mult joker
  gives 120+, and three ×Mult jokers chain into millions. Explodds already follows
  this for symbol boosts (`BOOST_PAYOUT_MULT`/`BOOST_FREQUENCY_MULT` stack
  multiplicatively, not additively) — good, keep new build-around effects
  multiplicative rather than flat where possible.
- **Balatro's feedback design**: each Joker visually pulses in sequence when a hand
  scores, showing its individual contribution — this teaches synergies without
  tooltips. Explodds' `ComboOverlay` already stacks toasts per combo; a future
  polish pass could animate a running-total tick-up per combo rather than one
  lump sum, closer to Balatro's per-contribution feedback. Not built — low
  priority, cosmetic only.
- **CloverPit's core loop** (escalating debt "Deadlines", clover tickets buying
  150+ "lucky charms" that reroll/boost/chain) is structurally very close to
  Explodds' existing deadline+ticket+relic loop — validates the overall shape of
  the game rather than suggesting a pivot. Its scale (150 charms) suggests our
  current 25 relics + 8 consumables + growing pack system has a lot of room to
  keep expanding over time without running out of design space.
- **Chain Reaction relic** (2+ combos in one attempt → ×1.5 cashout) was added
  directly off this research — rewards deliberately building a multi-combo board
  read in one attempt, mirroring the "synergy click moment" both games lean on.
