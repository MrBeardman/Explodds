// ─── Deduction layer ──────────────────────────────────────────────────────────
//
// Single source of truth for "what number does this tile show" and "what can a
// player PROVE from the visible numbers". Both the Grid (rendering) and the
// reducer (tagging a click as proven vs. guess) read from here, so the game can
// never call a click "proven" using information the player couldn't see, and
// boss rules that warp the numbers (Blackout / Mirror / Liar) only need to be
// implemented once.
//
// Pure functions only — no React, no state mutation.

import { GRID_COLS } from './constants';
import { mulberry32 } from './rng';
import type { GameState, Tile } from './types';

// Boards are always square; the column count is derived from the board itself
// so every function here works for 5×5, 6×6 and 7×7 alike.
export function boardCols(board: Tile[]): number {
  return board.length > 0 ? Math.round(Math.sqrt(board.length)) : GRID_COLS;
}

// ─── Neighborhoods ───────────────────────────────────────────────────────────

const OFFSETS_8: Array<[number, number]> = [
  [-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1],
];
const OFFSETS_DIAG: Array<[number, number]> = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

function offsetsFor(state: Pick<GameState, 'active_boss'>): Array<[number, number]> {
  return state.active_boss === 'mirror' ? OFFSETS_DIAG : OFFSETS_8;
}

function neighborsWith(index: number, cols: number, offsets: Array<[number, number]>): number[] {
  const row = Math.floor(index / cols), col = index % cols;
  const out: number[] = [];
  for (const [dr, dc] of offsets) {
    const r = row + dr, c = col + dc;
    if (r < 0 || r >= cols || c < 0 || c >= cols) continue;
    out.push(r * cols + c);
  }
  return out;
}

// True 8-neighborhood — used by board mechanics (cascade, opening relocation).
export function neighbors8(index: number, cols: number): number[] {
  return neighborsWith(index, cols, OFFSETS_8);
}

// The neighborhood the NUMBERS are counted over (diagonals only under Mirror).
export function numberNeighbors(state: Pick<GameState, 'active_boss'>, board: Tile[], index: number): number[] {
  return neighborsWith(index, boardCols(board), offsetsFor(state));
}

// Honest count of bombs around `index`, over the number-neighborhood in force.
export function trueNumber(state: Pick<GameState, 'active_boss'>, board: Tile[], index: number): number {
  let n = 0;
  for (const j of numberNeighbors(state, board, index)) if (board[j].type === 'bomb') n++;
  return n;
}

// ─── The Liar boss ───────────────────────────────────────────────────────────
//
// One tile per attempt shows a count that's off by one (never below 0 or above
// the neighborhood size). Which tile lies, and in which direction, is seeded
// per attempt so it's stable for the whole attempt. Players are told a liar
// exists, not where — a "proven" click that trusts the lie can still bust.

export function liarTile(state: Pick<GameState, 'active_boss' | 'seed' | 'cycle_number' | 'attempts_remaining'>, tileCount: number): { index: number; delta: 1 | -1 } | null {
  if (state.active_boss !== 'liar') return null;
  const attemptKey = (3 - state.attempts_remaining) + 1;
  const rng = mulberry32(state.seed + state.cycle_number * 53 + attemptKey * 17);
  return { index: Math.floor(rng() * tileCount), delta: rng() < 0.5 ? 1 : -1 };
}

// ─── What the player sees ────────────────────────────────────────────────────

type ShownState = Pick<GameState, 'active_boss' | 'seed' | 'cycle_number' | 'attempts_remaining' | 'relics'>;

function tileShowsNumber(state: Pick<GameState, 'active_boss' | 'relics'>, tile: Tile): boolean {
  if (tile.state === 'empty_revealed') return true;
  if (tile.state === 'revealed' && tile.type === 'symbol') {
    // Blackout: symbol tiles go dark — only empties keep their numbers
    return state.active_boss !== 'blackout';
  }
  // Second Sight relic: known-safe (hinted) tiles show their number unrevealed
  if (tile.state === 'hinted' && tile.type !== 'bomb') return state.relics.includes('second_sight');
  return false;
}

// The number rendered on this tile, or null when the tile shows none
// (still hidden, a bomb, or suppressed by a boss rule).
export function displayedNumber(state: ShownState, board: Tile[], index: number): number | null {
  const tile = board[index];
  if (!tile || !tileShowsNumber(state, tile)) return null;
  let n = trueNumber(state, board, index);
  const liar = liarTile(state, board.length);
  if (liar && liar.index === index) {
    const cap = numberNeighbors(state, board, index).length;
    n = Math.max(0, Math.min(cap, n + liar.delta));
  }
  return n;
}

// Ledger relic: bomb totals per row (all bombs, hidden or not). Column totals
// are computed too but not shown — rows alone keep the relic strong without
// turning every board into a fully determined puzzle.
export function rowColTotals(board: Tile[]): { rows: number[]; cols: number[] } {
  const n = boardCols(board);
  const rows = Array(n).fill(0), cols = Array(n).fill(0);
  for (const t of board) {
    if (t.type !== 'bomb') continue;
    rows[Math.floor(t.index / n)]++;
    cols[t.index % n]++;
  }
  return { rows, cols };
}

// ─── Constraint propagation ──────────────────────────────────────────────────
//
// Everything the player could legitimately conclude: hinted tiles are safe,
// ⚠/scanner-revealed bombs are bombs, every shown number is a constraint over
// its hidden neighbors, the remaining-bomb counter is a global constraint, and
// (with Ledger) each row/column total is one more. Propagates simple
// "all remaining are safe / all remaining are bombs" plus the subset rule to a
// fixpoint — the same reasoning a careful human does, no probability guessing.

export interface Deduction {
  safe: Set<number>;   // hidden tiles proven safe
  bombs: Set<number>;  // hidden tiles proven to be bombs
  hasInfo: boolean;    // at least one number is visible on the board
}

type AnalyzeState = ShownState & Pick<GameState, 'bombs_this_attempt'>;

export function analyzeBoard(state: AnalyzeState, board: Tile[]): Deduction {
  const hidden = new Set<number>();
  const safe = new Set<number>();
  const bombs = new Set<number>();
  for (const t of board) {
    if (t.state === 'hidden') hidden.add(t.index);
    else if (t.state === 'hinted') { hidden.add(t.index); safe.add(t.index); }
    else if (t.state === 'flagged') { hidden.add(t.index); bombs.add(t.index); }
    else if (t.state === 'revealed' && t.type === 'bomb') bombs.add(t.index);
  }

  // Constraints: [bombs among these tiles, tile list]
  const cons: Array<[number, number[]]> = [];
  let hasInfo = false;
  for (const t of board) {
    const n = displayedNumber(state, board, t.index);
    if (n === null) continue;
    hasInfo = true;
    const hs = numberNeighbors(state, board, t.index).filter(j => hidden.has(j) || bombs.has(j));
    if (hs.length) cons.push([n, hs]);
  }
  if (state.relics.includes('ledger')) {
    const size = boardCols(board);
    const { rows } = rowColTotals(board);
    for (let r = 0; r < size; r++) {
      const cells = Array.from({ length: size }, (_, c) => r * size + c).filter(j => hidden.has(j) || bombs.has(j));
      if (cells.length) cons.push([rows[r], cells]);
    }
  }
  // Global: total bombs still unaccounted for (the 💣 counter in the grid footer)
  const allHiddenOrKnown = [...hidden, ...[...bombs].filter(j => !hidden.has(j))];
  cons.push([state.bombs_this_attempt, allHiddenOrKnown]);

  let changed = true, guard = 0;
  while (changed && guard++ < 60) {
    changed = false;
    const reduced = cons
      .map(([n, hs]) => {
        const unknown = hs.filter(j => hidden.has(j) && !safe.has(j) && !bombs.has(j));
        const need = n - hs.filter(j => bombs.has(j)).length;
        return [need, unknown] as [number, number[]];
      })
      .filter(([, u]) => u.length > 0);

    for (const [need, u] of reduced) {
      if (need <= 0) { for (const j of u) if (!safe.has(j)) { safe.add(j); changed = true; } }
      else if (need >= u.length) { for (const j of u) if (!bombs.has(j)) { bombs.add(j); changed = true; } }
    }
    for (const [na, ua] of reduced) {
      for (const [nb, ub] of reduced) {
        if (ua === ub || ua.length >= ub.length) continue;
        if (!ua.every(j => ub.includes(j))) continue;
        const diff = ub.filter(j => !ua.includes(j));
        if (nb - na === diff.length) { for (const j of diff) if (!bombs.has(j)) { bombs.add(j); changed = true; } }
        else if (nb === na) { for (const j of diff) if (!safe.has(j)) { safe.add(j); changed = true; } }
      }
    }
  }

  return { safe, bombs, hasInfo };
}

export function isProvablySafe(state: AnalyzeState, board: Tile[], index: number): boolean {
  return analyzeBoard(state, board).safe.has(index);
}
