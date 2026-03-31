import { useState, useCallback } from 'react';
import type { GameState, ConsumableId } from '../types';
import { LEVELS } from '../constants';
import diamondSrc from '../assets/diamond.png';
import bombSrc from '../assets/bomb.png';

interface Props {
  state: GameState;
  onTileClick: (index: number) => void;
  onUseConsumable: (id: ConsumableId) => void;
  onScannerAxis: (axis: 'row' | 'col') => void;
}

export function Grid({ state, onTileClick, onUseConsumable, onScannerAxis }: Props) {
  const levelConfig = LEVELS[state.level - 1];
  const safeTilesLeft = state.grid.filter(t => !t.isBomb && (t.state === 'hidden' || t.state === 'hinted')).length;

  // Track which tiles are mid-reveal animation
  const [animating, setAnimating] = useState<Set<number>>(new Set());

  const handleTileClick = useCallback((index: number) => {
    const tile = state.grid[index];
    if (tile.state === 'revealed' || tile.state === 'defused') return;
    if (state.pendingConsumable === 'defuser' || state.pendingConsumable === 'scanner') {
      onTileClick(index);
      return;
    }
    // Trigger reveal animation
    setAnimating(prev => new Set(prev).add(index));
    onTileClick(index);
    setTimeout(() => {
      setAnimating(prev => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
    }, 500);
  }, [state.grid, state.pendingConsumable, onTileClick]);

  return (
    <div className="flex flex-col gap-4">
      {/* Consumable toolbar */}
      {state.consumables.length > 0 && state.phase === 'playing' && (
        <ConsumableToolbar
          consumables={state.consumables}
          pendingConsumable={state.pendingConsumable}
          scannerAxis={state.scannerAxis}
          onUse={onUseConsumable}
          onScannerAxis={onScannerAxis}
        />
      )}

      {/* Grid info */}
      <div className="flex justify-between text-sm text-gray-400 px-1">
        <span>💣 {levelConfig.bombs} bombs</span>
        <span>{safeTilesLeft} safe tiles left</span>
      </div>

      {/* 5×5 Grid — key on gridKey so entrance animation replays on reset */}
      <div key={state.gridKey} className="grid grid-cols-5 gap-2">
        {state.grid.map((tile, i) => {
          const isRevealed = tile.state === 'revealed';
          const isDefused = tile.state === 'defused';
          const isHinted = tile.state === 'hinted';
          const isAnimating = animating.has(i);
          const isPendingMode = state.pendingConsumable !== null;

          // Determine visual state
          let bg = '';
          let cursor = 'cursor-pointer';

          if (isRevealed && tile.isBomb) {
            bg = 'bg-red-950 border-red-700';
            cursor = 'cursor-default';
          } else if (isRevealed) {
            bg = 'bg-slate-900 border-slate-700';
            cursor = 'cursor-default';
          } else if (isDefused) {
            bg = 'bg-yellow-950 border-yellow-700';
            cursor = 'cursor-default';
          } else if (isHinted) {
            bg = 'bg-blue-950/70 border-blue-600';
          } else {
            // hidden
            bg = isPendingMode
              ? 'bg-gray-800 border-gray-600 hover:border-blue-500'
              : 'bg-gray-800 border-gray-700';
          }

          const entranceDelay = `${(i % 5) * 30 + Math.floor(i / 5) * 40}ms`;

          return (
            <button
              key={tile.id}
              onClick={() => handleTileClick(i)}
              disabled={(isRevealed || isDefused) && !isPendingMode}
              style={{ animationDelay: entranceDelay }}
              className={[
                'aspect-square rounded-xl border-2 flex items-center justify-center',
                'transition-[border-color] duration-150',
                'tile-entrance',
                bg,
                cursor,
                // Hover effect: levitate (only on clickable tiles)
                (!isRevealed && !isDefused)
                  ? 'hover:scale-110 hover:shadow-lg hover:shadow-black/50 hover:-translate-y-0.5 transition-transform duration-150'
                  : '',
                // Reveal animation
                isAnimating ? 'tile-reveal' : '',
              ].filter(Boolean).join(' ')}
            >
              <TileIcon tile={tile} isAnimating={isAnimating} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Tile Icon ────────────────────────────────────────────────────────────────

function TileIcon({ tile, isAnimating }: { tile: import('../types').Tile; isAnimating: boolean }) {
  const isRevealed = tile.state === 'revealed';
  const isDefused = tile.state === 'defused';
  const isHinted = tile.state === 'hinted';

  if (isRevealed && tile.isBomb) {
    return (
      <img
        src={bombSrc}
        alt="bomb"
        className={`w-3/4 h-3/4 object-contain drop-shadow-lg ${isAnimating ? 'icon-pop' : ''}`}
      />
    );
  }

  if (isRevealed && !tile.isBomb) {
    return (
      <img
        src={diamondSrc}
        alt="safe"
        className={`w-3/4 h-3/4 object-contain drop-shadow-lg ${isAnimating ? 'icon-pop' : ''}`}
      />
    );
  }

  if (isDefused) {
    return <span className="text-2xl">🔧</span>;
  }

  if (isHinted) {
    // Semi-transparent diamond indicating "safe to click"
    return (
      <img
        src={diamondSrc}
        alt="safe hint"
        className="w-1/2 h-1/2 object-contain opacity-50"
      />
    );
  }

  // Defuser placed but tile not yet clicked
  if (tile.isDefused) {
    return <span className="text-xl opacity-60">🔧</span>;
  }

  return null;
}

// ─── Consumable Toolbar ───────────────────────────────────────────────────────

interface ToolbarProps {
  consumables: ConsumableId[];
  pendingConsumable: ConsumableId | null;
  scannerAxis: 'row' | 'col' | null;
  onUse: (id: ConsumableId) => void;
  onScannerAxis: (axis: 'row' | 'col') => void;
}

const CONSUMABLE_LABELS: Record<string, string> = {
  scatter_reveal: '✨ Scatter Reveal',
  scanner: '🔍 Scanner',
  defuser: '🔧 Defuser',
  multiplier_lens: '🔬 ×2 Lens',
};

function ConsumableToolbar({ consumables, pendingConsumable, scannerAxis, onUse, onScannerAxis }: ToolbarProps) {
  const unique = [...new Set(consumables)];

  return (
    <div className="flex flex-col gap-2 p-3 bg-gray-900 border border-blue-900 rounded-lg">
      <div className="text-xs text-blue-400 uppercase tracking-widest">Consumables</div>
      <div className="flex flex-wrap gap-2">
        {unique.map(id => (
          <button
            key={id}
            onClick={() => onUse(id)}
            className={`px-3 py-1.5 rounded text-sm font-medium border transition-all duration-150 cursor-pointer
              ${pendingConsumable === id
                ? 'bg-blue-600 border-blue-400 text-white'
                : 'bg-gray-800 border-gray-600 text-gray-300 hover:border-blue-500 hover:text-blue-300'
              }`}
          >
            {CONSUMABLE_LABELS[id] ?? id}
          </button>
        ))}
      </div>

      {pendingConsumable === 'scanner' && (
        <div className="flex gap-2 items-center flex-wrap">
          <span className="text-xs text-gray-400">Scan:</span>
          <button
            onClick={() => onScannerAxis('row')}
            className={`px-2 py-1 rounded text-xs border cursor-pointer ${scannerAxis === 'row' ? 'bg-blue-700 border-blue-500 text-white' : 'bg-gray-800 border-gray-600 text-gray-400 hover:border-blue-500'}`}
          >Row →</button>
          <button
            onClick={() => onScannerAxis('col')}
            className={`px-2 py-1 rounded text-xs border cursor-pointer ${scannerAxis === 'col' ? 'bg-blue-700 border-blue-500 text-white' : 'bg-gray-800 border-gray-600 text-gray-400 hover:border-blue-500'}`}
          >Col ↓</button>
          <span className="text-xs text-blue-400">then click a tile</span>
        </div>
      )}
      {pendingConsumable === 'defuser' && (
        <div className="text-xs text-yellow-400">Click any tile to place the Defuser</div>
      )}
    </div>
  );
}
