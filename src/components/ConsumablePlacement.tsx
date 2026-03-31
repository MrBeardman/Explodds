import { ALL_CONSUMABLES } from '../constants';
import type { GameState } from '../types';

interface Props {
  state: GameState;
  onPlace: (tileIndex: number) => void;
  onSkip: () => void;
}

export function ConsumablePlacement({ state, onPlace, onSkip }: Props) {
  const { placement_queue, placing_index, board } = state;
  const current = placing_index >= 0 ? placement_queue[placing_index] : null;
  const currentDef = current ? ALL_CONSUMABLES.find(c => c.id === current) : null;
  const remaining = placement_queue.length - placing_index;

  return (
    <div
      className="flex flex-col items-center gap-4 p-6 rounded-2xl w-full max-w-sm"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
    >
      <div className="text-center">
        <div className="font-display text-xl" style={{ color: 'var(--gold)', letterSpacing: '0.1em' }}>
          PLACE CONSUMABLE
        </div>
        {currentDef && (
          <div className="mt-2 flex items-center justify-center gap-2">
            <span className="text-2xl">{currentDef.emoji}</span>
            <div>
              <div className="font-display text-sm" style={{ color: 'var(--text-primary)', letterSpacing: '0.05em' }}>
                {currentDef.name.toUpperCase()}
              </div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{currentDef.description}</div>
            </div>
          </div>
        )}
        {remaining > 1 && (
          <div className="font-mono text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            {remaining} remaining to place
          </div>
        )}
      </div>

      {/* Board grid for placement */}
      <div className="grid grid-cols-5 gap-1.5 w-full">
        {board.map((tile) => {
          const hasConsumable = tile.consumable !== null;
          const def = hasConsumable ? ALL_CONSUMABLES.find(c => c.id === tile.consumable) : null;

          return (
            <button
              key={tile.index}
              onClick={() => !hasConsumable && onPlace(tile.index)}
              disabled={hasConsumable}
              className="aspect-square rounded-xl flex items-center justify-center text-xl border-2 transition-all duration-150 cursor-pointer"
              style={{
                background: hasConsumable ? 'rgba(200,168,75,0.15)' : 'var(--bg-card)',
                borderColor: hasConsumable ? 'var(--gold)' : 'var(--border)',
              }}
              onMouseEnter={e => {
                if (!hasConsumable) (e.currentTarget as HTMLElement).style.borderColor = 'var(--gold)';
              }}
              onMouseLeave={e => {
                if (!hasConsumable) (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
              }}
            >
              {hasConsumable && def ? def.emoji : ''}
            </button>
          );
        })}
      </div>

      <button
        onClick={onSkip}
        className="font-mono text-sm px-6 py-2 rounded-lg cursor-pointer transition-colors"
        style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
      >
        Skip remaining
      </button>
    </div>
  );
}
