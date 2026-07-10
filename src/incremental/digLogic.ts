import type { DigTile, DigTileType, DigGameState, DigEndReason, DigUpgradeId, OreTierId, DigBossId } from './types';
import {
  calcDigBoardDim, calcDigBombDensity, calcDigCashBase, DIG_EMPTY_FRACTION, DIG_CLEAR_BUFFER,
  ORE_TIERS, DIG_BASE_COPPER_CHANCE, DIG_COPPER_VEIN_BONUS_BY_LEVEL, DIG_HIGHER_VEIN_BONUS,
  DIG_BASE_CHARGES, DIG_PICKAXE_CHARGES_BY_LEVEL, DIG_PICKAXE_2_CHARGES,
  DIG_NUGGET_CHANCE, DIG_SCANNER_BASE_CHANCE, DIG_SCANNER_BASE_COUNT, DIG_SCANNER_COUNT_BONUS,
  DIG_BASE_TOUGHNESS, DIG_DURABILITY_DIRT_TOUGHNESS, DIG_DURABILITY_COPPER_LEVEL, DIG_BASE_STRENGTH, DIG_STRENGTH_BONUS,
} from './constants';
import { getDigBossForCheckpoint } from './digBosses';
import { mulberry32, rngShuffle, newSeed } from '../rng';
import { loadDigMeta } from './digMeta';

function emptyMinedTotals(): Record<OreTierId, { count: number; cash: number }> {
  return {
    dirt: { count: 0, cash: 0 }, copper: { count: 0, cash: 0 }, silver: { count: 0, cash: 0 },
    gold: { count: 0, cash: 0 }, platinum: { count: 0, cash: 0 }, diamond: { count: 0, cash: 0 },
  };
}

// ─── Board generation ──────────────────────────────────────────────────────────

// boss is passed in (computed once by the caller via getDigBossForCheckpoint)
// rather than recomputed here, keeping this function a pure board generator.
export function generateDigBoard(level: number, seed: number, skills: Record<DigUpgradeId, number>, boss: DigBossId | null): DigTile[] {
  const dim = calcDigBoardDim(level);
  const total = dim * dim;
  const densityMult = boss === 'cave_in' ? 1.6 : 1;
  const bombCount = Math.max(2, Math.min(total - 5, Math.round(total * calcDigBombDensity(level) * densityMult)));
  const remaining = total - bombCount;
  const emptyCount = Math.round(remaining * DIG_EMPTY_FRACTION);
  const dirtCount = remaining - emptyCount;

  const rng = mulberry32(seed + level * 1000);
  const types: DigTileType[] = [
    ...Array(bombCount).fill('bomb' as const),
    ...Array(emptyCount).fill('empty' as const),
    ...Array(dirtCount).fill('dirt' as const),
  ];
  const order = rngShuffle(rng, Array.from({ length: total }, (_, i) => i));

  const tiles: DigTile[] = Array.from({ length: total }, (_, i) => ({
    index: i, type: 'empty', state: 'hidden', oreTier: null, cashValue: null, toughness: 1, hitsTaken: 0,
  }));
  for (let i = 0; i < total; i++) {
    tiles[order[i]].type = types[i];
  }

  // Roll ore tier + cash value + toughness for every dirt tile. Rarest tiers
  // are rolled first (each claims a slice of the roll range), whatever's left
  // over is plain Dirt — see constants.ts for why this additive-slices model
  // was chosen over a fully-normalized weighted distribution.
  //
  // The tree is strictly respected: a tier is not even a candidate to roll
  // unless its Vein node is owned. Copper used to have a nonzero base chance
  // even unskilled — that exception is gone, so a fresh player sees nothing
  // but plain Dirt until they invest in Copper Vein.
  const base = calcDigCashBase(level, skills.dirt_value_1);
  const oreMult = boss === 'golden_layer' ? 2 : 1;
  const candidates: { id: OreTierId; chance: number }[] = [];
  if (skills.diamond_vein_1 > 0) candidates.push({ id: 'diamond', chance: DIG_HIGHER_VEIN_BONUS });
  if (skills.platinum_vein_1 > 0) candidates.push({ id: 'platinum', chance: DIG_HIGHER_VEIN_BONUS });
  if (skills.gold_vein_1 > 0) candidates.push({ id: 'gold', chance: DIG_HIGHER_VEIN_BONUS });
  if (skills.silver_vein_1 > 0) candidates.push({ id: 'silver', chance: DIG_HIGHER_VEIN_BONUS });
  if (skills.copper_vein_1 > 0) {
    const bonus = DIG_COPPER_VEIN_BONUS_BY_LEVEL[Math.min(skills.copper_vein_1, DIG_COPPER_VEIN_BONUS_BY_LEVEL.length) - 1];
    candidates.push({ id: 'copper', chance: DIG_BASE_COPPER_CHANCE + bonus });
  }

  for (const t of tiles) {
    if (t.type !== 'dirt') continue;
    const roll = rng();
    let cumulative = 0;
    let tier: OreTierId = 'dirt';
    for (const c of candidates) {
      cumulative += c.chance * oreMult;
      if (roll < cumulative) { tier = c.id; break; }
    }
    const tierDef = ORE_TIERS.find(o => o.id === tier)!;
    t.oreTier = tier;
    t.cashValue = parseFloat((base * tierDef.mult).toFixed(2));
    // Everything is 2 hits to mine by default, including plain Dirt. Durability
    // level 1 eases Dirt back down to 1 hit; level 2 extends that same relief
    // to Copper ore too. Higher tiers stay tough regardless of Durability.
    const eased = (tier === 'dirt' && skills.durability_1 >= 1) || (tier === 'copper' && skills.durability_1 >= DIG_DURABILITY_COPPER_LEVEL);
    t.toughness = eased ? DIG_DURABILITY_DIRT_TOUGHNESS : DIG_BASE_TOUGHNESS;
  }

  // Danger Sense: mark 1 (or 2, with Danger Sense II) random bombs' locations —
  // still hidden/clickable, just visually flagged as a known danger.
  const dangerHints = skills.bomb_sense_2 > 0 ? 2 : skills.bomb_sense_1 > 0 ? 1 : 0;
  if (dangerHints > 0) {
    const bombIndices = tiles.filter(t => t.type === 'bomb').map(t => t.index);
    const chosen = rngShuffle(rng, bombIndices).slice(0, dangerHints);
    for (const idx of chosen) tiles[idx].state = 'hinted';
  }

  return tiles;
}

// Generic 8-neighborhood bomb counter, parameterized by board dimensions since
// Incremental's board grows — Standard's adjacentBombCount hardcodes GRID_COLS=5.
export function digAdjacentBombCount(board: DigTile[], index: number, cols: number): number {
  const row = Math.floor(index / cols);
  const col = index % cols;
  const rows = board.length / cols;
  let n = 0;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const r = row + dr, c = col + dc;
      if (r < 0 || r >= rows || c < 0 || c >= cols) continue;
      if (board[r * cols + c].type === 'bomb') n++;
    }
  }
  return n;
}

// Strict "every non-bomb tile revealed" check — kept for a possible future
// "Perfect Clear"-style bonus. The actual clear condition used during play is
// the buffer-aware isDigLevelClearable below.
export function isDigBoardFullyCleared(board: DigTile[]): boolean {
  return board.every(t => t.type === 'bomb' || t.state === 'revealed');
}

// A level counts as cleared once at most `buffer` hidden non-bomb tiles remain
// — forgives the last few highest-risk clicks. See constants.ts DIG_CLEAR_BUFFER
// for why (the sim showed literal 100%-clear is a brutal compounding-risk
// target regardless of charge budget).
export function isDigLevelClearable(board: DigTile[], buffer: number): boolean {
  const hiddenNonBomb = board.filter(t => t.type !== 'bomb' && t.state !== 'revealed').length;
  return hiddenNonBomb <= buffer;
}

// ─── Run lifecycle ─────────────────────────────────────────────────────────────

export function createInitialDigState(): DigGameState {
  return {
    phase: 'HOME',
    level: 0,
    boardRows: 0,
    boardCols: 0,
    board: [],
    chargesRemaining: 0,
    chargesMax: 0,
    bankedCash: 0,
    currentLevelCash: 0,
    minedBanked: emptyMinedTotals(),
    minedThisLevel: emptyMinedTotals(),
    activeBoss: null,
    endReason: null,
    levelsClearedThisRun: 0,
    seed: newSeed(),
    skills: loadDigMeta().upgrades,
  };
}

function calcChargesMax(skills: Record<DigUpgradeId, number>): number {
  const pickaxeLevel = skills.pickaxe_1;
  const base = pickaxeLevel > 0
    ? DIG_PICKAXE_CHARGES_BY_LEVEL[Math.min(pickaxeLevel, DIG_PICKAXE_CHARGES_BY_LEVEL.length) - 1]
    : DIG_BASE_CHARGES;
  return base + (skills.pickaxe_2 > 0 ? DIG_PICKAXE_2_CHARGES : 0);
}

// Re-reads digMeta fresh here (not state.skills) — this is the true "run
// start" boundary, mirroring Standard mode's START_GAME always calling
// createInitialState() fresh. Without this, an upgrade bought on the Home
// screen (DigUpgradeTree writes straight to localStorage, bypassing the
// reducer, same as SkillTree.tsx) wouldn't be visible until the component
// happened to remount, since IncrementalGame's useReducer only snapshots
// skills once at mount.
export function startDig(state: DigGameState): DigGameState {
  const skills = loadDigMeta().upgrades;
  const chargesMax = calcChargesMax(skills);
  const seed = newSeed();
  const level = 1;
  const dim = calcDigBoardDim(level);
  const boss = getDigBossForCheckpoint(seed, level);
  return {
    ...state,
    phase: 'DIGGING',
    level,
    boardRows: dim,
    boardCols: dim,
    board: generateDigBoard(level, seed, skills, boss),
    chargesRemaining: chargesMax,
    chargesMax,
    bankedCash: 0,
    currentLevelCash: 0,
    minedBanked: emptyMinedTotals(),
    minedThisLevel: emptyMinedTotals(),
    activeBoss: boss,
    endReason: null,
    levelsClearedThisRun: 0,
    seed,
    skills,
  };
}

export function resolveDigRunEnd(state: DigGameState, reason: DigEndReason): DigGameState {
  return { ...state, phase: 'RUN_OVER', endReason: reason };
}

// Merges minedThisLevel into minedBanked (the level's dig is now permanent).
function bankCurrentLevel(state: DigGameState): DigGameState {
  const tiers = Object.keys(state.minedBanked) as OreTierId[];
  const minedBanked = Object.fromEntries(tiers.map(id => [id, {
    count: state.minedBanked[id].count + state.minedThisLevel[id].count,
    cash: state.minedBanked[id].cash + state.minedThisLevel[id].cash,
  }])) as Record<OreTierId, { count: number; cash: number }>;
  return {
    ...state,
    bankedCash: state.bankedCash + state.currentLevelCash,
    currentLevelCash: 0,
    minedBanked,
    minedThisLevel: emptyMinedTotals(),
  };
}

export function advanceDigLevel(state: DigGameState): DigGameState {
  const banked = bankCurrentLevel(state);
  const nextLevel = state.level + 1;
  const dim = calcDigBoardDim(nextLevel);
  const boss = getDigBossForCheckpoint(state.seed, nextLevel);
  return {
    ...banked,
    level: nextLevel,
    boardRows: dim,
    boardCols: dim,
    board: generateDigBoard(nextLevel, state.seed, state.skills, boss),
    activeBoss: boss,
    levelsClearedThisRun: state.levelsClearedThisRun + 1,
  };
}

export function handleCashOut(state: DigGameState): DigGameState {
  if (state.phase !== 'DIGGING') return state;
  return resolveDigRunEnd(bankCurrentLevel(state), 'cashed_out');
}

// Re-derives fresh state (including a fresh skills snapshot from digMeta.ts,
// in case upgrades were purchased on the home screen since the last run).
export function backToDigHome(_state: DigGameState): DigGameState {
  return createInitialDigState();
}

// ─── Tile click ────────────────────────────────────────────────────────────────

// Fully mines a non-bomb tile if `dmg` brings it to full toughness, otherwise
// just cracks it. Returns the cash gained this hit (0 unless fully mined).
function applyDamage(tile: DigTile, dmg: number, nuggetLuck: boolean, rng: () => number): number {
  if (tile.type === 'empty') { tile.state = 'revealed'; return 0; }
  tile.hitsTaken += dmg;
  if (tile.hitsTaken < tile.toughness) { tile.state = 'cracked'; return 0; }
  tile.state = 'revealed';
  let cash = tile.cashValue ?? 0;
  if (nuggetLuck && rng() < DIG_NUGGET_CHANCE) cash *= 2;
  return cash;
}

export function handleDigTileClick(state: DigGameState, index: number): DigGameState {
  if (state.phase !== 'DIGGING') return state;
  const tile = state.board[index];
  if (!tile || tile.state === 'revealed') return state;

  // Iron Will boss: every click costs 2 charges this level instead of 1.
  const chargeCost = state.activeBoss === 'iron_will' ? 2 : 1;
  // Deterministic per-click RNG (chargesRemaining changes every click, so a
  // second hit on the same still-cracked tile gets a fresh roll) — keeps the
  // reducer pure, matching this project's convention of seeded rng.ts usage
  // everywhere instead of Math.random().
  const rng = mulberry32(state.seed + state.level * 100000 + index * 977 + state.chargesRemaining);
  const strength = DIG_BASE_STRENGTH + (state.skills.strength_1 > 0 ? DIG_STRENGTH_BONUS : 0);
  const nuggetLuck = state.skills.nugget_luck_1 > 0;

  const newBoard = state.board.map(t => ({ ...t }));
  let cashGained = 0;
  let bombHit = false;
  let minedThisLevel = state.minedThisLevel;

  const recordMined = (t: DigTile, cash: number) => {
    const tier = t.oreTier!;
    minedThisLevel = { ...minedThisLevel, [tier]: { count: minedThisLevel[tier].count + 1, cash: minedThisLevel[tier].cash + cash } };
  };

  const targetTile = newBoard[index];
  if (targetTile.type === 'bomb') {
    targetTile.state = 'revealed';
    bombHit = true;
  } else if (targetTile.type === 'empty') {
    targetTile.state = 'revealed';
    // Scanner: chance a dig on an empty tile also reveals nearby bomb(s).
    if (state.skills.scanner_prob_1 > 0 && rng() < DIG_SCANNER_BASE_CHANCE) {
      const count = DIG_SCANNER_BASE_COUNT + (state.skills.scanner_count_1 > 0 ? DIG_SCANNER_COUNT_BONUS : 0);
      const hiddenBombs = newBoard.filter(t => t.type === 'bomb' && t.state === 'hidden');
      const picked = rngShuffle(rng, hiddenBombs).slice(0, count);
      for (const b of picked) newBoard[b.index].state = 'hinted';
    }
  } else {
    // dirt
    const cash = applyDamage(targetTile, strength, nuggetLuck, rng);
    if (cash > 0) { cashGained += cash; recordMined(targetTile, cash); }

    // Bulk Click: also damage the tile immediately to the right (same row) with
    // full strength — a deliberately simple, deterministic splash pattern (see
    // constants.ts for why "full strength per tile" was chosen over dividing
    // strength across a pattern). Never splashes onto a bomb.
    if (state.skills.bulk_click_1 > 0) {
      const col = index % state.boardCols;
      if (col + 1 < state.boardCols) {
        const rt = newBoard[index + 1];
        if (rt.type === 'empty' && rt.state === 'hidden') {
          rt.state = 'revealed';
        } else if (rt.type === 'dirt' && (rt.state === 'hidden' || rt.state === 'cracked')) {
          const cash2 = applyDamage(rt, strength, nuggetLuck, rng);
          if (cash2 > 0) { cashGained += cash2; recordMined(rt, cash2); }
        }
      }
    }
  }

  const chargesRemaining = Math.max(0, state.chargesRemaining - chargeCost);

  if (bombHit) {
    return resolveDigRunEnd(
      { ...state, board: newBoard, chargesRemaining, currentLevelCash: 0, minedThisLevel: emptyMinedTotals() },
      'bomb'
    );
  }

  const next: DigGameState = {
    ...state,
    board: newBoard,
    chargesRemaining,
    currentLevelCash: state.currentLevelCash + cashGained,
    minedThisLevel,
  };

  if (chargesRemaining <= 0) {
    return resolveDigRunEnd(bankCurrentLevel(next), 'out_of_charges');
  }

  if (isDigLevelClearable(newBoard, DIG_CLEAR_BUFFER)) {
    return advanceDigLevel(next);
  }

  return next;
}
