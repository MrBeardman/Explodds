import { useCallback, useState } from 'react';
import { SYMBOL_MAP, ALL_CONSUMABLES } from '../constants';
import type { GameState, Tile } from '../types';
import bombSrc from '../assets/bomb.png';

interface Props {
  state: GameState;
  onTileClick: (index: number) => void;
}

export function Grid({ state, onTileClick }: Props) {
  const { board, phase } = state;
  const [animating, setAnimating] = useState<Set<number>>(new Set());
  const [infoOpen, setInfoOpen] = useState(false);

  const handleClick = useCallback((index: number) => {
    const tile = board[index];
    if (!tile || tile.state === 'revealed' || tile.state === 'bomb_hit' || tile.state === 'empty_revealed') return;
    if (phase !== 'CLEARING') return;
    setAnimating(prev => new Set(prev).add(index));
    onTileClick(index);
    setTimeout(() => setAnimating(prev => { const n = new Set(prev); n.delete(index); return n; }), 520);
  }, [board, onTileClick, phase]);

  const scannerActive = state.pending_scanner_axis !== null;
  const isBustFlash = phase === 'BUST_FLASH';
  const bombsHidden = board.filter(t => t.type === 'bomb' && t.state === 'hidden').length;
  const safeHidden  = board.filter(t => t.type !== 'bomb' && (t.state === 'hidden' || t.state === 'hinted')).length;
  const emptyHidden = board.filter(t => t.type === 'empty' && t.state === 'hidden').length;

  return (
    <div className="flex flex-col gap-2 w-full max-w-sm">
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
              isAnimating={animating.has(tile.index)}
              scannerActive={scannerActive}
              clearing={phase === 'CLEARING'}
              onClick={handleClick}
            />
          ))}
        </div>

        {/* Bust flash overlay */}
        {isBustFlash && (
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
  index?: number;
  isAnimating: boolean;
  scannerActive: boolean;
  clearing: boolean;
  onClick: (i: number) => void;
}

function GridTile({ tile, isAnimating, scannerActive, clearing, onClick }: TileProps) {
  const isHidden    = tile.state === 'hidden';
  const isHinted    = tile.state === 'hinted';
  const isRevealed  = tile.state === 'revealed';
  const isBombHit   = tile.state === 'bomb_hit';
  const isEmpty     = tile.state === 'empty_revealed';
  const isClickable = (isHidden || isHinted) && clearing;

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
  } else if (isHinted) {
    bg = 'rgba(59,130,246,0.12)';
    borderColor = 'rgba(59,130,246,0.5)';
  } else if (tile.combo_highlight) {
    borderColor = 'rgba(255,217,61,0.8)';
    bg = 'rgba(255,217,61,0.1)';
  } else if (scannerActive && isClickable) {
    borderColor = 'rgba(59,130,246,0.4)';
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
        cursor: isClickable ? (scannerActive ? 'crosshair' : 'pointer') : 'default',
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
      <TileContent tile={tile} isAnimating={isAnimating} consumableDef={consumableDef ?? null} />
    </button>
  );
}

function TileContent({
  tile,
  isAnimating,
  consumableDef,
}: {
  tile: Tile;
  isAnimating: boolean;
  consumableDef: typeof ALL_CONSUMABLES[0] | null;
}) {
  if (tile.state === 'bomb_hit') {
    return <img src={bombSrc} alt="bomb" className={`w-3/4 h-3/4 object-contain ${isAnimating ? 'icon-pop' : ''}`} />;
  }

  if (tile.state === 'revealed' && tile.type === 'bomb') {
    return <img src={bombSrc} alt="bomb" className="w-3/4 h-3/4 object-contain opacity-60" />;
  }

  if (tile.state === 'revealed' && tile.symbol) {
    const def = SYMBOL_MAP[tile.symbol];
    return (
      <span className={`text-2xl sm:text-3xl leading-none ${isAnimating ? 'icon-pop' : ''}`}>
        {def.emoji}
      </span>
    );
  }

  if (tile.state === 'empty_revealed') {
    return (
      <div className="w-1/3 h-1/3 rounded-sm" style={{ background: 'rgba(255,255,255,0.06)' }} />
    );
  }

  if (tile.state === 'hinted') {
    return <span className="text-xl opacity-40">💎</span>;
  }

  // Hidden — show placed consumable if any
  if (consumableDef) {
    return <span className="text-xl opacity-60">{consumableDef.emoji}</span>;
  }

  return null;
}

// ─── Combo info overlay ───────────────────────────────────────────────────────

import type { RelicId } from '../types';

function ComboInfoOverlay({ onClose, relics }: { onClose: () => void; relics: RelicId[] }) {
  const rows = [
    {
      emoji: '🍒', name: 'Cherry Rush', trigger: '3 in row/col',
      base: '$12', modified: relics.includes('cherry_picker') ? '$20' : null,
    },
    {
      emoji: '🍌', name: 'Banana Split', trigger: '2 adjacent',
      base: '×2 each', modified: relics.includes('banana_baron') ? '×3 each' : null,
    },
    {
      emoji: '⭐', name: 'Star Power', trigger: '3 stars',
      base: '$18', modified: relics.includes('star_magnet') ? '$28' : null,
    },
    {
      emoji: '🔔', name: 'Bell Storm', trigger: '4 bells',
      base: 'streak ×10', modified: relics.includes('bell_captain') ? 'streak ×20' : null,
    },
    {
      emoji: '💎', name: 'Diamond Run', trigger: '4 diamonds',
      base: '+15%', modified: relics.includes('diamond_dealer') ? '+25%' : null,
    },
    {
      emoji: '🪙', name: 'Coin Jackpot', trigger: '2 coins',
      base: '+4🎫', modified: relics.includes('coin_tycoon') ? '+8🎫' : null,
    },
  ];

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.85)' }}
      onClick={onClose}
    >
      <div
        className="casino-panel p-4 w-72 rounded-xl"
        style={{ border: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="font-display text-base text-center mb-3" style={{ color: 'var(--gold)', letterSpacing: '0.1em' }}>
          COMBO PAYOUTS
        </div>
        <div className="flex flex-col gap-2">
          {rows.map(r => (
            <div key={r.name} className="flex items-center gap-2 font-mono text-xs">
              <span className="text-lg w-6 shrink-0">{r.emoji}</span>
              <span className="flex-1" style={{ color: 'var(--text-muted)' }}>{r.name}</span>
              <span style={{ color: 'var(--text-dim)' }}>{r.trigger}</span>
              <span style={{ color: 'var(--text-primary)' }}>→</span>
              {r.modified ? (
                <span style={{ color: 'var(--gold)' }}>{r.modified} ✦</span>
              ) : (
                <span style={{ color: 'var(--text-primary)' }}>{r.base}</span>
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
