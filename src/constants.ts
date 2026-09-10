import type {
  BossId, BoostAxis, ConsumableId, EventCardId, RelicId,
  ShopConsumableItem, ShopRelicItem, SymbolId,
} from './types';

// ─── Grid constants ───────────────────────────────────────────────────────────

export const GRID_COLS = 5;                 // the starting board; see BOARD_GROWTH
export const GRID_SIZE = GRID_COLS * GRID_COLS;

// ─── Cycle deadlines ──────────────────────────────────────────────────────────

// Tuned with `npm run bots` (scripts/playtest-bots.mjs) against the stake-back,
// sub-linear economy below — see docs/plans/standard-loop-review.md.
const FIXED_DEADLINES = [60, 90, 120, 160, 200];
export const DEADLINE_GROWTH = 1.3;

// The house notices: next cycle's deadline is never below this fraction of the
// wallet you walk out of the shop with. Backstop against runaway compounding —
// the fixed curve above still sets the floor for normal bankrolls.
export const DEADLINE_WALLET_CHASE = 0.6;

export function calcDeadline(cycle: number): number {
  if (cycle <= 5) return FIXED_DEADLINES[cycle - 1];
  let d = FIXED_DEADLINES[4];
  for (let i = 5; i < cycle; i++) {
    d = Math.round((d * DEADLINE_GROWTH) / 10) * 10;
  }
  return d;
}

// ─── Base bombs per cycle ─────────────────────────────────────────────────────

// Deliberately gentle: on a 5×5 with numbers on every revealed tile, 2–6 bombs
// is the range where deduction still decides most clicks. Past ~8 the board is
// a lottery regardless of skill (bot playtest, docs/plans/standard-loop-review.md),
// so bombs cap at 8 and late-game pressure comes from the economy instead.
// ─── Board growth ─────────────────────────────────────────────────────────────
//
// The second difficulty axis. Instead of piling bombs onto a 5×5 (which turns
// into a lottery past ~8), the board itself grows: 5×5 for cycles 1–5, 6×6 for
// 6–9, 7×7 from cycle 10. Bigger boards have more interior, so the same bomb
// DENSITY is more deducible — the density curve below can therefore keep
// climbing gently instead of capping.
export const BOARD_GROWTH: Array<{ fromCycle: number; cols: number }> = [
  { fromCycle: 1, cols: 5 },
  { fromCycle: 6, cols: 6 },
  { fromCycle: 10, cols: 7 },
];
// Late cycles deal fewer attempts — the third difficulty axis, taken instead of
// piling on bombs: from this cycle on there are 2 attempts per cycle (Short Fuse
// still forces 2 earlier). A perfect deducer otherwise coasts once density caps.
export const LATE_GAME_ATTEMPTS_FROM_CYCLE = 10;
export function attemptsForCycle(cycle: number, boss: BossId | null): number {
  if (boss === 'short_fuse') return 2;
  return cycle >= LATE_GAME_ATTEMPTS_FROM_CYCLE ? 2 : 3;
}

export function calcBoardCols(cycle: number): number {
  let cols = GRID_COLS;
  for (const step of BOARD_GROWTH) if (cycle >= step.fromCycle) cols = step.cols;
  return cols;
}

// Densities sit at or below expert minesweeper (~21%): a human playtest found
// 11 bombs on a 6×6 (30%) unplayable, and the bot sweep agrees that deduction
// collapses past ~25% even with perfect information.
const EARLY_BOMBS = [4, 4, 5, 5, 6];              // exact counts on the 5×5 opening cycles (3 bombs made cycle 1 a free full clear)
export const BOMB_DENSITY_BASE = 0.16;            // cycle 6 density
export const BOMB_DENSITY_PER_CYCLE = 0.008;
export const BOMB_DENSITY_MAX = 0.22;
export const MAX_BOMB_SHARE = 0.30;               // hard cap on bombs / tiles for any board (incl. bet-ratio bombs)
export function getBaseBombs(cycle: number): number {
  if (cycle <= EARLY_BOMBS.length) return EARLY_BOMBS[cycle - 1];
  const tiles = calcBoardCols(cycle) ** 2;
  const density = Math.min(BOMB_DENSITY_BASE + (cycle - 6) * BOMB_DENSITY_PER_CYCLE, BOMB_DENSITY_MAX);
  return Math.round(tiles * density);
}

// ─── Dynamic bomb count ───────────────────────────────────────────────────────

// The bet is a RISK dial: a bigger share of the wallet means a noticeably more
// dangerous board (+1 bomb per ~17% of wallet, up to +4). Combined with the
// sub-linear payout below, betting big is a real decision instead of a
// compounding lever.
export const BOMB_RATIO_SLOPE = 6;
export const BOMB_RATIO_CAP = 4;
export function calcBombs(bet: number, wallet: number, cycle: number): number {
  const base = getBaseBombs(cycle);
  const ratio = bet / Math.max(wallet, 1);
  const bonus = Math.floor(ratio * BOMB_RATIO_SLOPE);
  const hardCap = Math.floor(calcBoardCols(cycle) ** 2 * MAX_BOMB_SHARE);
  return Math.min(base + bonus, base + BOMB_RATIO_CAP, hardCap);
}

// ─── Tile cash calculation ────────────────────────────────────────────────────

// Sub-linear in the bet (exponent 0.9). The old linear formula let a cleared
// board pay 12–35× the bet, which turned any skilled run into unbounded
// compounding; now a well-played board returns roughly 2–3× the stake at low
// bets and less at very large ones, so betting big scales your absolute
// earnings (to chase a deadline) but never your growth RATE. The stake itself
// is returned on cashout (see handleCashout) — these numbers are pure winnings.
export const TILE_CASH_BET_COEF = 0.17;

// ─── Stake return needs a real attempt ────────────────────────────────────────
//
// The full stake only comes back once this share of the board's SAFE tiles has
// been revealed; an earlier cashout returns it pro rata. Without this, a big bet
// plus the free opening and one provable click was a risk-free ~30% wallet gain
// per attempt (human playtest: "click once or twice, cash out, snowball").
export const STAKE_RETURN_CLEAR_FRAC = 0.3;

// ─── Cash prices and flat cash rewards scale with the run ──────────────────────
//
// Consumable/pack prices multiply by (deadline / cycle-1 deadline) so a $22 pack
// isn't pocket change against a $1,000 deadline; flat cash rewards (combo
// bonuses, streak cash, flag bonus, Greed Chip) multiply by (bet / min bet) for
// the same reason.
export function shopPriceScale(deadline: number): number {
  return Math.max(1, deadline / calcDeadline(1));
}
export function flatCashScale(bet: number): number {
  return Math.max(1, bet / MIN_BET_BASE);
}
export const TILE_CASH_BET_EXP = 0.9;
// Normalised by board area: a full clear pays the same multiple of the stake on
// a 7×7 as on a 5×5, so a bigger board means more clicks (and more risk) for the
// same money — the growth axis stays a difficulty axis instead of a payday.
export function calcTileBaseCash(bet: number, tiles: number = GRID_SIZE): number {
  return TILE_CASH_BET_COEF * Math.pow(Math.max(0, bet), TILE_CASH_BET_EXP) * (GRID_SIZE / Math.max(GRID_SIZE, tiles));
}

// ─── Deposit / interest / min-bet scaling ─────────────────────────────────────

export const BASE_INTEREST_RATE = 0.08;       // per successful cashout, on the deposited pool
export const COMPOUND_CHIP_BONUS_RATE = 0.05; // Compound Chip relic adds this
export const INFLATOR_INTEREST_MULT = 2;      // Inflator boss doubles the rate

// Collateral: once at least this share of the deadline is deposited, the house
// relaxes — every attempt that cycle deals one fewer bomb. (Was 50%: banking
// half up front let a perfect deducer coast indefinitely in the bot test.) Gives depositing
// early something betting can't buy (interest alone never beat positive-EV play).
export const COLLATERAL_DEPOSIT_FRAC = 0.75;
export const COLLATERAL_BOMB_RELIEF = 1;

// ─── Event cards: cycle-scoped picks + a few permanent traits ─────────────────
//
// A picked card lasts THIS cycle. Picking the same card a second time in a run
// keeps it for the rest of the run as a trait (up to MAX_TRAITS) — so the pick
// screen stays a live decision instead of converging on "everything" by cycle 10.
export const MAX_TRAITS = 3;

export const MIN_BET_BASE = 10;
export const MIN_BET_PER_CYCLE = 2;           // gentler than the spec's +$5 — tuned via sim
export const GREED_MODE_MIN_BET = 25;

// ─── Ticket economy ────────────────────────────────────────────────────────────

export const TICKETS_COMPLETE_ATTEMPT = 1;    // any cashout or bust
export const TICKETS_SUCCESSFUL_CASHOUT = 2;  // cashed out, didn't bust
export const TICKETS_PROFITABLE = 3;          // winnings ≥ bet (stake comes back on top)
export const PROFITABLE_EARNINGS_RATIO = 1.0;
export const TICKETS_PAY_IN_FULL = 5;         // deadline fully deposited
export const TICKETS_FLAWLESS = 2;            // an attempt with no guesses at all
export const FLAWLESS_MIN_PROVEN = 4;         // …and at least this many proven clicks

// ─── Multiplier growth ─────────────────────────────────────────────────────────
//
// Kept deliberately shallow: most of a tile's value is in the base cash so an
// early click is worth its risk, and a cleared 5×5 lands around 3× the stake
// (the 40% stake-return threshold is roughly break-even). At 0.04/0.005 with a
// 0.29 coefficient a cycle-1 full clear paid 7–9× and the wallet went ×40 in
// one cycle (human playtest: "snowball").
export const MULT_GAIN_BASE = 0.02;           // per symbol tile
export const MULT_GAIN_PER_BOMB = 0.003;      // + this × bombs on the board
export const STREAK_5_MULT = 0.10;
export const STREAK_10_MULT = 0.20;
export const STREAK_15_CASH = 5;

// ─── Deduction layer ───────────────────────────────────────────────────────────

export const DEDUCTION_MULT_GAIN = 0.03;      // mult per PROVEN-safe click (on top of the symbol gain)
export const LOGICIAN_MULT_GAIN = 0.06;       // Logician relic replaces the gain above
export const ECHO_REVEALED_EMPTIES = 2;       // Echo relic: numbers pre-revealed on the board after a bust
export const CURFEW_CLICKS = 10;              // Curfew boss: attempt auto-cashes out after this many reveals

// ─── Bomb Sense skill ──────────────────────────────────────────────────────────

export const BOMB_FLAG_BONUS = 8; // cash per correctly-flagged bomb, paid when the attempt ends (cashout or bust)

// ─── Packs & symbol boosts ─────────────────────────────────────────────────────

export const PACK_BASE_PRICE = 18;
export const PACK_PRICE_STEP = 4;
export const BOOST_FREQUENCY_MULT = 1.5; // weight ×= this, per matching stack
export const BOOST_PAYOUT_MULT = 1.25;   // symbol modifier ×= this, per matching stack

export const PACK_TYPE_INFO: Record<BoostAxis, { name: string; emoji: string; description: string }> = {
  frequency: { name: 'Frequency Pack', emoji: '🎯', description: 'Pick a symbol — appears ×1.5 more often, permanently' },
  payout:    { name: 'Payout Pack',    emoji: '💰', description: 'Pick a symbol — pays ×1.25 more, permanently' },
};

// Themed packs — fixed to one symbol, no reveal step: buying grants BOTH a
// frequency and a payout stack on that symbol immediately. Priced higher than
// a generic pack (bundles 2 stacks + guaranteed targeting). A rarer roll among
// the 3 pack slots each shop visit rather than its own dedicated section.
export const THEMED_PACK_PRICE_MULT = 2.2;
export const PACK_THEMES: Record<SymbolId, { name: string; emoji: string }> = {
  diamond: { name: 'Rich Pack',   emoji: '💍' },
  cherry:  { name: 'Sweet Pack',  emoji: '🍬' },
  banana:  { name: 'Ripe Pack',   emoji: '🐒' },
  star:    { name: 'Bright Pack', emoji: '🌟' },
  bell:    { name: 'Chime Pack',  emoji: '🎐' },
};

// 3 pack slots per shop visit, each independently rolled: 40% frequency /
// 40% payout / 20% themed. Axis (frequency/payout) slots also roll a "huge"
// chance — 5 reveal choices instead of 3, priced up accordingly.
export const PACK_SLOT_COUNT = 3;
export const PACK_KIND_WEIGHTS: { kind: 'frequency' | 'payout' | 'themed'; weight: number }[] = [
  { kind: 'frequency', weight: 2 },
  { kind: 'payout', weight: 2 },
  { kind: 'themed', weight: 1 },
];
export const PACK_CHOICE_COUNT = 3;
export const HUGE_PACK_CHOICE_COUNT = 5;
export const HUGE_PACK_CHANCE = 0.2;
export const HUGE_PACK_PRICE_MULT = 1.8;
export const PACK_PICK_COUNT = 1;      // normal packs: pick 1 of 3
export const HUGE_PACK_PICK_COUNT = 2; // huge packs: pick 2 of 5

// ─── Relic slots ────────────────────────────────────────────────────────────────

export const RELIC_CASE_BASE_PRICE = 16; // tickets
export const RELIC_CASE_PRICE_STEP = 6;
export const MAX_BONUS_RELIC_SLOTS = 3;  // Relic Case can push the cap from 6 to 9

// ─── Symbol definitions ───────────────────────────────────────────────────────

export interface SymbolDef {
  id: SymbolId;
  emoji: string;
  name: string;
  modifier: number;   // cash multiplier for this symbol
  weight: number;
}

export const SYMBOLS: SymbolDef[] = [
  { id: 'diamond', emoji: '💎', name: 'Diamond', modifier: 1.0, weight: 20 },
  { id: 'cherry',  emoji: '🍒', name: 'Cherry',  modifier: 0.8, weight: 20 },
  { id: 'banana',  emoji: '🍌', name: 'Banana',  modifier: 1.2, weight: 18 },
  { id: 'star',    emoji: '⭐', name: 'Star',    modifier: 1.5, weight: 12 },
  { id: 'bell',    emoji: '🔔', name: 'Bell',    modifier: 0.9, weight: 18 },
];

export const SYMBOL_MAP: Record<SymbolId, SymbolDef> = Object.fromEntries(
  SYMBOLS.map(s => [s.id, s])
) as Record<SymbolId, SymbolDef>;

// ─── Event Cards ──────────────────────────────────────────────────────────────

export interface EventCardDef {
  id: EventCardId;
  name: string;
  emoji: string;
  description: string;
}

export const EVENT_CARDS: EventCardDef[] = [
  { id: 'hot_streak',     emoji: '🔥', name: 'Hot Streak',     description: 'Start each attempt with streak at 5' },
  { id: 'cherry_season',  emoji: '🍒', name: 'Cherry Season',  description: 'Cherry weight ×2 this cycle' },
  { id: 'banana_bonanza', emoji: '🍌', name: 'Banana Bonanza', description: 'Banana weight ×2 this cycle' },
  { id: 'star_shower',    emoji: '⭐', name: 'Star Shower',    description: 'Star worth ×1.5 this cycle' },
  { id: 'safe_zone',      emoji: '🛡', name: 'Safe Zone',      description: '4 fewer empty tiles this cycle' },
  { id: 'danger_pay',     emoji: '💥', name: 'Danger Pay',     description: '+3 extra bombs per attempt, tile value ×1.4' },
  { id: 'bell_ringer',    emoji: '🔔', name: 'Bell Ringer',    description: 'Bell Storm threshold reduced to 3 bells' },
  { id: 'lucky_board',    emoji: '🍀', name: 'Lucky Board',    description: 'First attempt this cycle: no empty tiles' },
  { id: 'greed_mode',     emoji: '💸', name: 'Greed Mode',     description: 'Cashout earns +30% but bet minimum $25' },
];

export const EVENT_CARD_MAP = Object.fromEntries(
  EVENT_CARDS.map(c => [c.id, c])
) as Record<EventCardId, EventCardDef>;

// ─── Bosses (every 3rd cycle) ─────────────────────────────────────────────────

export interface BossDef {
  id: BossId;
  name: string;
  emoji: string;
  description: string;
}

export const BOSSES: BossDef[] = [
  { id: 'monoculturist', name: 'The Monoculturist', emoji: '🍒', description: 'Only 2 symbol types spawn this cycle' },
  { id: 'saboteur',      name: 'The Saboteur',      emoji: '🧨', description: 'Every 4th symbol cleared arms a new bomb' },
  { id: 'blackout',      name: 'The Blackout',      emoji: '🌑', description: 'Symbol tiles show no bomb counts — only empties do' },
  { id: 'taxman',        name: 'The Taxman',        emoji: '🧾', description: '25% tax on every cashout' },
  { id: 'glutton',       name: 'The Glutton',       emoji: '🕳', description: '+4 empty tiles on every board' },
  { id: 'short_fuse',    name: 'The Short Fuse',    emoji: '⏱', description: 'Only 2 attempts this cycle' },
  { id: 'warden',        name: 'The Warden',        emoji: '⛓', description: 'Bet locked to 25% of your wallet' },
  { id: 'inflator',      name: 'The Inflator',      emoji: '📈', description: 'Deadline +25% — but double interest if beaten' },
  { id: 'blightbringer', name: 'The Blightbringer', emoji: '🥀', description: 'One random symbol is nerfed to 30% weight' },
  { id: 'liar',          name: 'The Liar',          emoji: '🤥', description: 'One number on every board is off by one' },
  { id: 'mirror',        name: 'The Mirror',        emoji: '🪞', description: 'Numbers count diagonal neighbours only' },
  { id: 'curfew',        name: 'The Curfew',        emoji: '⏰', description: `Attempts end on their own after ${CURFEW_CLICKS} reveals` },
  { id: 'mason',         name: 'The Mason',         emoji: '🧱', description: 'Bombs are laid in touching pairs' },
];

export const BOSS_MAP = Object.fromEntries(
  BOSSES.map(b => [b.id, b])
) as Record<BossId, BossDef>;

export const BOSS_REWARD_TICKETS = 8;

// ─── Consumables ──────────────────────────────────────────────────────────────

export const ALL_CONSUMABLES: ShopConsumableItem[] = [
  { id: 'scatter_reveal',   name: 'Scatter Reveal',   price: 15, emoji: '✨', description: 'Reveal 3 safe tiles before attempt', sold: false },
  { id: 'scanner',          name: 'Scanner',          price: 20, emoji: '🔍', description: 'Reveal one full row or column', sold: false },
  { id: 'defuser',          name: 'Defuser',          price: 25, emoji: '🔧', description: 'Placed on tile — bomb becomes empty', sold: false },
  { id: 'tile_magnet',      name: 'Tile Magnet',      price: 18, emoji: '🧲', description: 'Auto-hints nearest safe tile every 5 clears (one attempt)', sold: false },
  { id: 'lucky_tile',       name: 'Lucky Tile',       price: 12, emoji: '🍀', description: 'Placed tile — if safe, +$5 flat earnings', sold: false },
  { id: 'empty_eraser',     name: 'Empty Eraser',     price: 10, emoji: '🧹', description: 'Removes 2 empty tiles from next board', sold: false },
  { id: 'bomb_detector',    name: 'Bomb Detector',    price: 22, emoji: '📡', description: 'Marks 2 bombs with ⚠ on next board', sold: false },
  { id: 'insurance_ticket', name: 'Insurance Ticket', price: 15, emoji: '🎟', description: 'Next bust: your bet is refunded', sold: false },
  { id: 'probe',            name: 'Probe',            price: 16, emoji: '🧪', description: 'Test one hidden tile mid-attempt — marks it ⚠ if it is a bomb, safe if not', sold: false },
  // mult_vial removed from the pool for now (starting-mult bonus disabled — confusing for playtest).
  // Type stays in ConsumableId; gameLogic's mult_vial branch is simply unreachable while unsold.
];

// Consumables that need pre-attempt tile placement
export const PLACEABLE_CONSUMABLES: ConsumableId[] = ['defuser', 'lucky_tile'];

// ─── Relics ───────────────────────────────────────────────────────────────────

export const ALL_RELICS: ShopRelicItem[] = [
  // Existing 12
  { id: 'greed_chip',      name: 'Greed Chip',       cost: 8,  emoji: '🪙', rarity: 'common',    description: '+$3 flat on every cashout', sold: false, owned: false },
  { id: 'adrenaline_core', name: 'Adrenaline Core',  cost: 10, emoji: '⚡', rarity: 'rare',      description: 'Multiplier grows 20% faster', sold: false, owned: false },
  { id: 'cherry_picker',   name: 'Cherry Picker',    cost: 10, emoji: '🍒', rarity: 'common',    description: 'Cherry Rush pays $20 (was $12)', sold: false, owned: false },
  { id: 'banana_baron',    name: 'Banana Baron',     cost: 12, emoji: '🍌', rarity: 'rare',      description: 'Banana Split gives ×3 (was ×2)', sold: false, owned: false },
  { id: 'star_magnet',     name: 'Star Magnet',      cost: 8,  emoji: '⭐', rarity: 'common',    description: 'Star Power pays $28 (was $18)', sold: false, owned: false },
  { id: 'bell_captain',    name: 'Bell Captain',     cost: 10, emoji: '🔔', rarity: 'rare',      description: 'Bell Storm sets streak to 20', sold: false, owned: false },
  { id: 'diamond_dealer',  name: 'Diamond Dealer',   cost: 12, emoji: '💎', rarity: 'rare',      description: 'Diamond Run gives +25% (was +15%)', sold: false, owned: false },
  { id: 'safe_digger',     name: 'Safe Digger',      cost: 8,  emoji: '⛏', rarity: 'common',    description: '3 fewer empty tiles every board', sold: false, owned: false },
  { id: 'bomb_suit',       name: 'Bomb Suit',        cost: 15, emoji: '🦺', rarity: 'rare',      description: 'First bust each cycle: bet refunded', sold: false, owned: false },
  { id: 'hot_hands',       name: 'Hot Hands',        cost: 10, emoji: '🔥', rarity: 'common',    description: 'Streak 5 bonus: +$8 flat (replaces mult bonus)', sold: false, owned: false },
  { id: 'lucky_charm',     name: 'Lucky Charm',      cost: 12, emoji: '🎰', rarity: 'rare',      description: 'One guaranteed diamond tile per board', sold: false, owned: false },
  // Expansion — economy / board / mult / bets
  { id: 'ticket_printer',  name: 'Ticket Printer',   cost: 8,  emoji: '🖨', rarity: 'common',    description: '+2 extra 🎫 on every cashout', sold: false, owned: false },
  { id: 'haggler',         name: 'Haggler',          cost: 8,  emoji: '🤝', rarity: 'common',    description: 'Consumables cost 30% less', sold: false, owned: false },
  { id: 'surveyor',        name: 'Surveyor',         cost: 8,  emoji: '🗺', rarity: 'common',    description: '1 empty tile starts revealed each board', sold: false, owned: false },
  // head_start and momentum_core removed from the pool for now (starting-mult
  // bonus disabled — confusing for playtest). Types stay in RelicId; the
  // gameLogic branches that check for them are simply unreachable while unsold.
  { id: 'compound_chip',   name: 'Compound Chip',    cost: 12, emoji: '🏦', rarity: 'rare',      description: '+3% interest rate on deposited cash', sold: false, owned: false },
  { id: 'insurance_policy',name: 'Insurance Policy', cost: 12, emoji: '📋', rarity: 'rare',      description: 'Busts refund 30% of your bet', sold: false, owned: false },
  { id: 'high_roller',     name: 'High Roller',      cost: 12, emoji: '🎩', rarity: 'rare',      description: 'Bets ≥ half your wallet: −2 bombs', sold: false, owned: false },
  { id: 'bombproof_boots', name: 'Bombproof Boots',  cost: 20, emoji: '🥾', rarity: 'legendary', description: 'First TWO clicks each attempt can never be a bomb (first click is always safe for everyone)', sold: false, owned: false },
  // Combo-crafting expansion
  { id: 'synergist',       name: 'Synergist',        cost: 16, emoji: '🔁', rarity: 'legendary', description: 'Every combo permanently boosts that symbol\'s payout ×1.25 (stacks)', sold: false, owned: false },
  // Deduction expansion — information relics change the SHAPE of what you can prove
  { id: 'ledger',          name: 'Ledger',           cost: 14, emoji: '📒', rarity: 'rare',      description: 'The row you last revealed in shows its bomb total at the board edge', sold: false, owned: false },
  { id: 'logician',        name: 'Logician',         cost: 12, emoji: '🧠', rarity: 'rare',      description: `Proven-safe clicks give +${LOGICIAN_MULT_GAIN.toFixed(2)} mult instead of +${DEDUCTION_MULT_GAIN.toFixed(2)}`, sold: false, owned: false },
  { id: 'gut_feeling',     name: 'Gut Feeling',      cost: 16, emoji: '🫀', rarity: 'legendary', description: 'Once per cycle, a guess that would hit a bomb cashes you out instead — for half the winnings', sold: false, owned: false },
  { id: 'echo',            name: 'Echo',             cost: 10, emoji: '📣', rarity: 'common',    description: `After a bust, the next board starts with ${ECHO_REVEALED_EMPTIES} numbers already revealed`, sold: false, owned: false },
  { id: 'second_sight',    name: 'Second Sight',     cost: 12, emoji: '👁', rarity: 'rare',      description: 'Hinted (known-safe) tiles show their bomb count before you reveal them', sold: false, owned: false },
  { id: 'cartographer',    name: 'Cartographer',     cost: 18, emoji: '🗺', rarity: 'legendary', description: `Every board starts with ${ECHO_REVEALED_EMPTIES} numbers already revealed`, sold: false, owned: false },
  // Gambler archetype
  { id: 'double_down',     name: 'Double Down',      cost: 12, emoji: '🎲', rarity: 'rare',      description: 'Bets of at least half your wallet pay ×1.3 winnings', sold: false, owned: false },
  { id: 'loaded_dice',     name: 'Loaded Dice',      cost: 8,  emoji: '🎯', rarity: 'common',    description: '+1 bomb on every board, every tile pays ×1.25', sold: false, owned: false },
  // Banker archetype
  { id: 'vault',           name: 'Vault',            cost: 12, emoji: '🏦', rarity: 'rare',      description: 'Deposited cash earns half its interest even when you bust', sold: false, owned: false },
  { id: 'chain_reaction',  name: 'Chain Reaction',   cost: 14, emoji: '💥', rarity: 'rare',      description: '2+ combos in one attempt: cashout earns ×1.5', sold: false, owned: false },
  { id: 'specialist',      name: 'Specialist',       cost: 12, emoji: '🎯', rarity: 'rare',      description: 'Packs favor your most-boosted symbol instead of avoiding it', sold: false, owned: false },
];

// Relics that start LOCKED and enter the shop pool only once unlocked across
// runs (see UNLOCKABLES in meta.ts). Kept here so shop generation can filter.
export const LOCKED_RELIC_IDS: RelicId[] = ['cartographer', 'double_down', 'vault', 'second_sight'];

export const RELIC_MAP = Object.fromEntries(
  ALL_RELICS.map(r => [r.id, r])
) as Record<RelicId, ShopRelicItem>;

// ─── Grid constants ───────────────────────────────────────────────────────────

export const STARTING_WALLET = 150;
export const BET_STEP = 5;
export const MAX_ACTIVE_RELICS = 6;
export const MAX_SHOP_ITEMS = 3;

// Cascade skill (see src/meta.ts) level 1 cap — how many tiles a single
// flood-fill chain can reveal before it's fully upgraded (level 2, unlimited).
export const CASCADE_LEVEL1_CAP = 6;
