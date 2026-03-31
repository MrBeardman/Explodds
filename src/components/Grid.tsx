import { useState, useCallback } from 'react';
import { SYMBOL_MAP, ALL_CONSUMABLES } from '../constants';
import type { GameState, Tile } from '../types';
import bombSrc from '../assets/bomb.png';

interface Props {
  state: GameState;
  onTileClick: (index: number) => void;
}

export function Grid({ state, onTileClick }: Props) {
  const { grid, gridKey, isBossRound } = state;
  const [animating, setAnimating] = useState<Set<number>>(new Set());

  const handleClick = useCallback((index: number) => {
    const tile = grid[index];
    if (tile.state === 'revealed' || tile.state === 'defused') return;
    setAnimating(prev => new Set(prev).add(index));
    onTileClick(index);
    setTimeout(() => setAnimating(prev => { const n = new Set(prev); n.delete(index); return n; }), 520);
  }, [grid, onTileClick]);

  const bombsLeft = grid.filter(t => t.isBomb && t.state === 'hidden').length;
  const safeTilesLeft = grid.filter(t => !t.isBomb && (t.state === 'hidden' || t.state === 'hinted')).length;

  return (
    <div className="flex flex-col gap-3 w-full max-w-sm">
      {/* Info bar */}
      <div className="flex justify-between font-mono text-xs px-1" style={{ color: 'var(--text-muted)' }}>
        <span>💣 {bombsLeft} hidden bombs</span>
        {isBossRound && <span style={{ color: 'var(--gold)' }}>👑 BOSS</span>}
        <span>{safeTilesLeft} safe left</span>
      </div>

      {/* 5×5 Grid */}
      <div
        key={gridKey}
        className="grid grid-cols-5 gap-1.5 sm:gap-2"
      >
        {grid.map((tile, i) => (
          <GridTile
            key={tile.id}
            tile={tile}
            index={i}
            isAnimating={animating.has(i)}
            scannerActive={state.pendingScannerAxis !== null}
            onClick={handleClick}
          />
        ))}
      </div>

      {/* Streak guaranteed indicator */}
      {state.streakGuaranteed && (
        <div className="text-center font-mono text-xs streak-full py-1 rounded"
             style={{ color: 'var(--gold)', background: 'rgba(200,168,75,0.1)', border: '1px solid rgba(200,168,75,0.3)' }}>
          ✦ STREAK ACTIVE — NEXT CLICK IS SAFE · 3× POINTS
        </div>
      )}
    </div>
  );
}

// ─── Single tile ──────────────────────────────────────────────────────────────

interface TileProps {
  tile: Tile;
  index: number;
  isAnimating: boolean;
  scannerActive: boolean;
  onClick: (i: number) => void;
}

function GridTile({ tile, index, isAnimating, scannerActive, onClick }: TileProps) {
  const isRevealed = tile.state === 'revealed';
  const isDefused = tile.state === 'defused';
  const isHinted = tile.state === 'hinted';
  const isClickable = !isRevealed && !isDefused;

  const entranceDelay = `${(index % 5) * 25 + Math.floor(index / 5) * 35}ms`;

  // Background & border
  let bg = 'var(--bg-card)';
  let borderColor = 'var(--border)';
  let opacity = 1;

  if (isRevealed && tile.isBomb) {
    bg = 'rgba(180,30,30,0.3)';
    borderColor = 'var(--red)';
  } else if (isRevealed) {
    bg = 'rgba(20,30,50,0.8)';
    borderColor = 'rgba(255,255,255,0.08)';
  } else if (isDefused) {
    bg = 'rgba(200,168,75,0.15)';
    borderColor = 'var(--gold)';
  } else if (isHinted) {
    bg = 'rgba(59,130,246,0.12)';
    borderColor = 'rgba(59,130,246,0.5)';
  } else if (scannerActive) {
    borderColor = 'rgba(59,130,246,0.4)';
  }

  const consumableDef = tile.placedConsumable
    ? ALL_CONSUMABLES.find(c => c.id === tile.placedConsumable)
    : null;

  return (
    <button
      onClick={() => onClick(index)}
      disabled={!isClickable}
      style={{
        animationDelay: entranceDelay,
        background: bg,
        borderColor,
        opacity,
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
      <TileContent tile={tile} isAnimating={isAnimating} consumableDef={consumableDef} />
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
  consumableDef: typeof ALL_CONSUMABLES[0] | undefined | null;
}) {
  const isRevealed = tile.state === 'revealed';
  const isDefused = tile.state === 'defused';
  const isHinted = tile.state === 'hinted';

  if (isRevealed && tile.isBomb) {
    return <img src={bombSrc} alt="bomb" className={`w-3/4 h-3/4 object-contain ${isAnimating ? 'icon-pop' : ''}`} />;
  }

  if (isRevealed && tile.symbol) {
    const def = SYMBOL_MAP[tile.symbol];
    return (
      <div className={`flex flex-col items-center gap-0.5 ${isAnimating ? 'icon-pop' : ''}`}>
        <span className="text-2xl sm:text-3xl leading-none">{def.emoji}</span>
      </div>
    );
  }

  if (isDefused) {
    return <span className="text-2xl">🔧</span>;
  }

  if (isHinted) {
    return (
      <span className="text-2xl opacity-40" style={{ filter: 'brightness(0.7)' }}>💎</span>
    );
  }

  // Hidden — show placed consumable if any
  if (consumableDef) {
    return (
      <span className="text-xl opacity-60">{consumableDef.emoji}</span>
    );
  }

  return null;
}
