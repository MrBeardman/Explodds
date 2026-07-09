import { useCallback, useState } from 'react';
import { SYMBOL_MAP, ALL_CONSUMABLES } from '../constants';
import { adjacentBombCount } from '../gameLogic';
import type { GameState, Tile } from '../types';
import bombSrc from '../assets/bomb.png';

interface Props {
  state: GameState;
  onTileClick: (index: number) => void;
  debugReveal?: boolean;
  revealAll?: boolean;
}

export function Grid({ state, onTileClick, debugReveal = false, revealAll = false }: Props) {
  const { board, phase } = state;
  const [animating, setAnimating] = useState<Set<number>>(new Set());
  const [infoOpen, setInfoOpen] = useState(false);

  const handleClick = useCallback((index: number) => {
    const tile = board[index];
    if (!tile || tile.state === 'revealed' || tile.state === 'bomb_hit' || tile.state === 'empty_revealed') return;
    if (phase !== 'CLEARING') return;
    // Flagging a tile doesn't reveal it — skip the reveal-pop animation
    if (state.flag_mode) { onTileClick(index); return; }
    setAnimating(prev => new Set(prev).add(index));
    onTileClick(index);
    setTimeout(() => setAnimating(prev => { const n = new Set(prev); n.delete(index); return n; }), 520);
  }, [board, onTileClick, phase, state.flag_mode]);

  const scannerActive = state.pending_scanner_axis !== null;
  const flagModeActive = state.flag_mode;
  const playerFlags = state.player_flags;
  const isBustFlash = phase === 'BUST_FLASH';
  const blackout = state.active_boss === 'blackout';
  const sixthSense = state.relics.includes('sixth_sense');
  const bombsHidden = board.filter(t => t.type === 'bomb' && (t.state === 'hidden' || t.state === 'flagged')).length;
  const safeHidden  = board.filter(t => t.type !== 'bomb' && (t.state === 'hidden' || t.state === 'hinted')).length;
  const emptyHidden = board.filter(t => t.type === 'empty' && t.state === 'hidden').length;

  return (
    <div className="flex flex-col gap-2 w-full max-w-[30rem]">
      {/* Info bar */}
      <div className="flex justify-between items-center font-mono text-xs px-1">
        <span style={{ color: 'var(--red)' }}>💣 {bombsHidden}</span>
        <span style={{ color: 'var(--text-muted)' }}>{safeHidden} safe · {emptyHidden} empty</span>
        <button
          onClick={() => setInfoOpen(true)}
          className="font-mono text-xs px-1.5 py-0.5 rounded cursor-pointer"
          style={{
            background: 'var(--bg-raised)',
            border: '1px solid var(--border)',
            color: 'var(--text-muted)',
          }}
        >ⓘ</button>
      </div>

      {/* Grid */}
      <div className="relative">
        <div className="grid grid-cols-5 gap-1.5">
          {board.map((tile) => (
            <GridTile
              key={tile.index}
              tile={tile}
              adjacentBombs={
                !blackout && (tile.state === 'empty_revealed' || (sixthSense && tile.state === 'revealed' && tile.type === 'symbol'))
                  ? adjacentBombCount(board, tile.index)
                  : 0
              }
              ghostAdjacentBombs={debugReveal ? adjacentBombCount(board, tile.index) : 0}
              isAnimating={animating.has(tile.index)}
              scannerActive={scannerActive}
              flagModeActive={flagModeActive}
              playerFlagged={playerFlags.includes(tile.index)}
              clearing={phase === 'CLEARING'}
              onClick={handleClick}
              debugReveal={debugReveal}
              revealAll={revealAll}
            />
          ))}
        </div>

        {/* Bust flash overlay — only during the brief initial flash, before the
            full board reveal (revealAll) takes over */}
        {isBustFlash && !revealAll && (
          <div
            className="absolute inset-0 flex items-center justify-center rounded-xl bust-flash"
            style={{ background: 'rgba(180,30,30,0.75)', zIndex: 10 }}
          >
            <div className="text-center">
              <div className="text-4xl mb-1">💣</div>
              <div className="font-display text-xl" style={{ color: '#fff', letterSpacing: '0.1em' }}>
                BUST!
              </div>
              <div className="font-mono text-sm mt-1" style={{ color: 'rgba(255,255,255,0.7)' }}>
                Lost ${state.current_bet}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Streak guaranteed indicator */}
      {state.streak_5_given && state.streak >= 5 && (
        <div
          className="text-center font-mono text-xs py-1 rounded"
          style={{ color: 'var(--gold)', background: 'rgba(200,168,75,0.1)', border: '1px solid rgba(200,168,75,0.3)' }}
        >
          🔥 STREAK {state.streak} — BONUS ACTIVE
        </div>
      )}

      {/* Info overlay */}
      {infoOpen && <ComboInfoOverlay onClose={() => setInfoOpen(false)} relics={state.relics} />}
    </div>
  );
}

// ─── Single tile ──────────────────────────────────────────────────────────────

interface TileProps {
  tile: Tile;
  adjacentBombs: number;
  ghostAdjacentBombs: number;
  isAnimating: boolean;
  scannerActive: boolean;
  flagModeActive: boolean;
  playerFlagged: boolean;
  clearing: boolean;
  onClick: (i: number) => void;
  debugReveal: boolean;
  revealAll?: boolean;
}

function GridTile({ tile, adjacentBombs, ghostAdjacentBombs, isAnimating, scannerActive, flagModeActive, playerFlagged, clearing, onClick, debugReveal, revealAll = false }: TileProps) {
  const isHidden    = tile.state === 'hidden';
  const isHinted    = tile.state === 'hinted';
  const isFlagged   = tile.state === 'flagged';
  const isRevealed  = tile.state === 'revealed';
  const isBombHit   = tile.state === 'bomb_hit';
  const isEmpty     = tile.state === 'empty_revealed';
  const isClickable = (isHidden || isHinted || isFlagged) && clearing;
  // Post-bust board reveal: still-hidden tiles show their true content, same
  // visual treatment as GameOver's FinalBoard reveal (dimmed, non-interactive).
  const isGhostReveal = revealAll && (isHidden || isHinted || isFlagged);

  const entranceDelay = `${(tile.index % 5) * 20 + Math.floor(tile.index / 5) * 30}ms`;

  let bg = 'var(--bg-card)';
  let borderColor = 'var(--border)';

  if (isBombHit) {
    bg = 'rgba(180,30,30,0.5)';
    borderColor = 'var(--red)';
  } else if (isRevealed && tile.type === 'bomb') {
    bg = 'rgba(180,30,30,0.2)';
    borderColor = 'rgba(200,50,50,0.5)';
  } else if (isRevealed) {
    bg = 'rgba(20,30,50,0.8)';
    borderColor = 'rgba(255,255,255,0.08)';
  } else if (isEmpty) {
    bg = 'rgba(30,30,30,0.6)';
    borderColor = 'rgba(255,255,255,0.04)';
  } else if (isGhostReveal && tile.type === 'bomb') {
    bg = 'rgba(180,30,30,0.15)';
    borderColor = 'rgba(200,50,50,0.4)';
  } else if (isGhostReveal) {
    bg = 'rgba(20,30,50,0.5)';
    borderColor = 'rgba(255,255,255,0.06)';
  } else if (isHinted) {
    bg = 'rgba(59,130,246,0.12)';
    borderColor = 'rgba(59,130,246,0.5)';
  } else if (isFlagged) {
    bg = 'rgba(220,38,38,0.10)';
    borderColor = 'rgba(220,38,38,0.55)';
  } else if (tile.combo_highlight) {
    borderColor = 'rgba(255,217,61,0.8)';
    bg = 'rgba(255,217,61,0.1)';
  } else if (scannerActive && isClickable) {
    borderColor = 'rgba(59,130,246,0.4)';
  } else if (flagModeActive && isClickable) {
    borderColor = 'rgba(250,204,21,0.4)';
  }

  const consumableDef = tile.consumable
    ? ALL_CONSUMABLES.find(c => c.id === tile.consumable)
    : null;

  return (
    <button
      onClick={() => onClick(tile.index)}
      disabled={!isClickable}
      style={{
        animationDelay: entranceDelay,
        background: bg,
        borderColor,
        cursor: isClickable ? (scannerActive ? 'crosshair' : flagModeActive ? 'cell' : 'pointer') : 'default',
      }}
      className={[
        'aspect-square rounded-xl border-2 flex items-center justify-center relative',
        'transition-[border-color,background] duration-100',
        'tile-entrance',
        isClickable && !scannerActive
          ? 'hover:scale-110 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/40 transition-transform duration-100'
          : '',
        isAnimating ? 'tile-reveal' : '',
      ].filter(Boolean).join(' ')}
    >
      <TileContent tile={tile} adjacentBombs={adjacentBombs} isAnimating={isAnimating} consumableDef={consumableDef ?? null} isGhostReveal={isGhostReveal} />
      {playerFlagged && (isHidden || isHinted || isFlagged) && (
        <span
          className="absolute top-0.5 left-1 text-xs leading-none"
          style={{ filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.9))' }}
        >
          🚩
        </span>
      )}
      {debugReveal && !revealAll && (tile.state === 'hidden' || tile.state === 'hinted' || tile.state === 'flagged') && (
        <DebugGhost tile={tile} adjacentBombs={ghostAdjacentBombs} />
      )}
    </button>
  );
}

// Debug-only peek at a tile's true content, without touching game state —
// purely visual, still fully clickable/playable underneath. Shows the adjacent
// bomb count for every non-bomb tile too (not just what Sixth Sense/empties
// would reveal in real play) since this is a full "true info" testing aid.
function DebugGhost({ tile, adjacentBombs }: { tile: Tile; adjacentBombs: number }) {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center rounded-xl pointer-events-none"
      style={{ border: '1px dashed rgba(192,132,252,0.6)', background: 'rgba(192,132,252,0.06)' }}
    >
      {tile.type === 'bomb' ? (
        <img src={bombSrc} alt="bomb" className="w-1/2 h-1/2 object-contain opacity-50" />
      ) : tile.type === 'symbol' && tile.symbol ? (
        <span className="text-xl leading-none opacity-50">{SYMBOL_MAP[tile.symbol].emoji}</span>
      ) : null}
      {tile.type !== 'bomb' && adjacentBombs > 0 && (
        <span
          className="absolute bottom-0.5 right-1 font-mono font-bold text-xs leading-none opacity-70"
          style={{ color: ADJ_COLORS[adjacentBombs] }}
        >
          {adjacentBombs}
        </span>
      )}
    </div>
  );
}

// Minesweeper-style number colors, indexed by adjacent bomb count (1-8)
const ADJ_COLORS = ['', '#60a5fa', '#4ade80', '#f87171', '#c084fc', '#fb923c', '#f472b6', '#facc15', '#f87171'];

function TileContent({
  tile,
  adjacentBombs,
  isAnimating,
  consumableDef,
  isGhostReveal = false,
}: {
  tile: Tile;
  adjacentBombs: number;
  isAnimating: boolean;
  consumableDef: typeof ALL_CONSUMABLES[0] | null;
  isGhostReveal?: boolean;
}) {
  if (tile.state === 'bomb_hit') {
    return <img src={bombSrc} alt="bomb" className={`w-3/4 h-3/4 object-contain ${isAnimating ? 'icon-pop' : ''}`} />;
  }

  if (tile.state === 'revealed' && tile.type === 'bomb') {
    return <img src={bombSrc} alt="bomb" className="w-3/4 h-3/4 object-contain opacity-60" />;
  }

  // Post-bust board reveal — show this still-hidden tile's true content, dimmed
  if (isGhostReveal) {
    if (tile.type === 'bomb') {
      return <img src={bombSrc} alt="bomb" className="w-3/4 h-3/4 object-contain opacity-55" />;
    }
    if (tile.type === 'symbol' && tile.symbol) {
      return <span className="text-2xl sm:text-3xl leading-none opacity-45">{SYMBOL_MAP[tile.symbol].emoji}</span>;
    }
    return null;
  }

  if (tile.state === 'revealed' && tile.symbol) {
    const def = SYMBOL_MAP[tile.symbol];
    return (
      <>
        <span className={`text-2xl sm:text-3xl leading-none ${isAnimating ? 'icon-pop' : ''}`}>
          {def.emoji}
        </span>
        {/* Sixth Sense relic: adjacent bomb count, same as an empty tile's number */}
        {adjacentBombs > 0 && (
          <span
            className="absolute bottom-0.5 right-1 font-mono font-bold text-xs leading-none"
            style={{ color: ADJ_COLORS[adjacentBombs] }}
          >
            {adjacentBombs}
          </span>
        )}
      </>
    );
  }

  if (tile.state === 'empty_revealed') {
    if (adjacentBombs > 0) {
      return (
        <span
          className={`font-mono font-bold text-xl leading-none ${isAnimating ? 'icon-pop' : ''}`}
          style={{ color: ADJ_COLORS[adjacentBombs] }}
        >
          {adjacentBombs}
        </span>
      );
    }
    return (
      <div className="w-1/3 h-1/3 rounded-sm" style={{ background: 'rgba(255,255,255,0.06)' }} />
    );
  }

  if (tile.state === 'hinted') {
    return <span className="text-xl opacity-40">💎</span>;
  }

  if (tile.state === 'flagged') {
    return <span className="text-xl" style={{ opacity: 0.85 }}>⚠️</span>;
  }

  // Hidden — show placed consumable if any
  if (consumableDef) {
    return <span className="text-xl opacity-60">{consumableDef.emoji}</span>;
  }

  return null;
}

// ─── Combo info overlay ───────────────────────────────────────────────────────

import type { RelicId } from '../types';

// Small mini-tile strip standing in for the text trigger description — tight
// touching tiles mean "must land in a line/adjacent", spaced tiles mean "just
// need this many anywhere on the board".
function MiniPattern({ emoji, count, touching }: { emoji: string; count: number; touching: boolean }) {
  return (
    <div className={`flex shrink-0 ${touching ? 'gap-0.5' : 'gap-1'}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="w-5 h-5 rounded flex items-center justify-center text-[10px] leading-none"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          {emoji}
        </div>
      ))}
    </div>
  );
}

function ComboInfoOverlay({ onClose, relics }: { onClose: () => void; relics: RelicId[] }) {
  // `touching: true` = must land in a line/adjacent (Cherry Rush/Banana Split);
  // `touching: false` = just needs the count anywhere on the board — the mini
  // tile spacing communicates this instead of a text description.
  const rows = [
    {
      emoji: '🍒', name: 'Cherry Rush', count: 3, touching: true,
      base: '$12', modified: relics.includes('cherry_picker') ? '$20' : null,
    },
    {
      emoji: '🍌', name: 'Banana Split', count: 2, touching: true,
      base: '×2 each', modified: relics.includes('banana_baron') ? '×3 each' : null,
    },
    {
      emoji: '⭐', name: 'Star Power', count: 3, touching: false,
      base: '$18', modified: relics.includes('star_magnet') ? '$28' : null,
    },
    {
      emoji: '🔔', name: 'Bell Storm', count: 4, touching: false,
      base: 'streak ×10', modified: relics.includes('bell_captain') ? 'streak ×20' : null,
    },
    {
      emoji: '💎', name: 'Diamond Run', count: 4, touching: false,
      base: '+15%', modified: relics.includes('diamond_dealer') ? '+25%' : null,
    },
    {
      emoji: '🏆', name: 'Perfect Clear', count: 5, touching: false,
      base: '+30% earnings', modified: null,
    },
  ];

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.85)' }}
      onClick={onClose}
    >
      <div
        className="casino-panel p-4 w-80 rounded-xl"
        style={{ border: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="font-display text-base text-center mb-3" style={{ color: 'var(--gold)', letterSpacing: '0.1em' }}>
          COMBO PAYOUTS
        </div>
        <div className="flex flex-col gap-3">
          {rows.map(r => (
            <div key={r.name} className="flex items-center gap-3 font-mono text-xs">
              <MiniPattern emoji={r.emoji} count={r.count} touching={r.touching} />
              <span className="flex-1 min-w-0 truncate" style={{ color: 'var(--text-muted)' }}>{r.name}</span>
              <span style={{ color: 'var(--text-primary)' }}>→</span>
              {r.modified ? (
                <span className="shrink-0" style={{ color: 'var(--gold)' }}>{r.modified} ✦</span>
              ) : (
                <span className="shrink-0" style={{ color: 'var(--text-primary)' }}>{r.base}</span>
              )}
            </div>
          ))}
        </div>
        <div className="font-mono text-xs text-center mt-3" style={{ color: 'var(--text-dim)' }}>
          click anywhere to dismiss
        </div>
      </div>
    </div>
  );
}
