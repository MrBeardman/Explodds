import type { GameState, ConsumableId } from '../types';
import { LEVELS } from '../constants';

interface Props {
  state: GameState;
  onTileClick: (index: number) => void;
  onUseConsumable: (id: ConsumableId) => void;
  onScannerAxis: (axis: 'row' | 'col') => void;
}

export function Grid({ state, onTileClick, onUseConsumable, onScannerAxis }: Props) {
  const levelConfig = LEVELS[state.level - 1];
  const safeTilesLeft = state.grid.filter(t => !t.isBomb && t.state === 'hidden').length;

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
      <div className="flex justify-between text-sm text-gray-400">
        <span>💣 {levelConfig.bombs} bombs on board</span>
        <span>{safeTilesLeft} safe tiles hidden</span>
      </div>

      {/* 5×5 Grid */}
      <div className="grid grid-cols-5 gap-2">
        {state.grid.map((tile, i) => {
          const isRevealed = tile.state === 'revealed';
          const isDefused = tile.state === 'defused';
          const isSafeHint = tile.isSafeRevealed && isRevealed;
          const isPending = state.pendingConsumable !== null;
          const hasDefuserPlaced = tile.isDefused && !isRevealed;

          let bg = 'bg-gray-800 hover:bg-gray-700 border-gray-700 cursor-pointer';
          if (isRevealed && tile.isBomb) bg = 'bg-red-900/80 border-red-700';
          else if (isRevealed && isSafeHint) bg = 'bg-blue-900/60 border-blue-700';
          else if (isRevealed) bg = 'bg-gray-900 border-gray-700';
          else if (isDefused) bg = 'bg-yellow-900/60 border-yellow-600';
          else if (hasDefuserPlaced) bg = 'bg-yellow-900/40 border-yellow-700 cursor-pointer';
          else if (isPending) bg = 'bg-gray-800 hover:bg-blue-900/40 border-gray-600 cursor-crosshair';

          let icon = '';
          if (isRevealed && tile.isBomb) icon = '💣';
          else if (isDefused) icon = '🔧';
          else if (hasDefuserPlaced) icon = '🔧';
          else if (isSafeHint) icon = '✓';

          return (
            <button
              key={tile.id}
              onClick={() => onTileClick(i)}
              disabled={isRevealed && !isPending}
              className={`aspect-square rounded-lg border-2 text-2xl font-bold transition-all duration-150 flex items-center justify-center
                ${bg}
                ${isRevealed || isDefused ? 'cursor-default' : ''}
                disabled:cursor-default
              `}
            >
              {icon}
            </button>
          );
        })}
      </div>
    </div>
  );
}

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

      {/* Scanner axis selector */}
      {pendingConsumable === 'scanner' && (
        <div className="flex gap-2 items-center">
          <span className="text-xs text-gray-400">Scan:</span>
          <button
            onClick={() => onScannerAxis('row')}
            className={`px-2 py-1 rounded text-xs border cursor-pointer ${scannerAxis === 'row' ? 'bg-blue-700 border-blue-500 text-white' : 'bg-gray-800 border-gray-600 text-gray-400 hover:border-blue-500'}`}
          >
            Row →
          </button>
          <button
            onClick={() => onScannerAxis('col')}
            className={`px-2 py-1 rounded text-xs border cursor-pointer ${scannerAxis === 'col' ? 'bg-blue-700 border-blue-500 text-white' : 'bg-gray-800 border-gray-600 text-gray-400 hover:border-blue-500'}`}
          >
            Col ↓
          </button>
          <span className="text-xs text-blue-400 ml-2">Then click a tile</span>
        </div>
      )}

      {pendingConsumable === 'defuser' && (
        <div className="text-xs text-yellow-400">Click a tile to place the Defuser</div>
      )}
    </div>
  );
}
