import { ALL_CONSUMABLES } from '../constants';
import type { GameState } from '../types';

interface Props {
  state: GameState;
  onPlace: (tileIndex: number) => void;
  onSkip: () => void;
}

export function ConsumablePlacement({ state, onPlace, onSkip }: Props) {
  const { placementQueue, placingIndex, grid } = state;
  const current = placingIndex >= 0 ? placementQueue[placingIndex] : null;
  const currentDef = current ? ALL_CONSUMABLES.find(c => c.id === current) : null;
  const remaining = placementQueue.length - placingIndex;

  return (
    <div className="min-h-screen flex flex-col items-center p-4 gap-4 pt-8">
      <div className="text-center">
        <div className="font-display text-2xl" style={{ color: 'var(--gold)', letterSpacing: '0.1em' }}>
          PLACE CONSUMABLES
        </div>
        {currentDef && (
          <div className="mt-2 flex items-center justify-center gap-2">
            <span className="text-2xl">{currentDef.emoji}</span>
            <div>
              <div className="font-display text-lg" style={{ color: 'var(--text-primary)', letterSpacing: '0.05em' }}>
                {currentDef.name.toUpperCase()}
              </div>
              <div className="text-sm" style={{ color: 'var(--text-muted)' }}>{currentDef.description}</div>
            </div>
          </div>
        )}
        {remaining > 0 && (
          <div className="font-mono text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
            {remaining} remaining to place
          </div>
        )}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-5 gap-2 w-full max-w-xs">
        {grid.map((tile, i) => {
          const hasConsumable = tile.placedConsumable !== null;
          const def = hasConsumable ? ALL_CONSUMABLES.find(c => c.id === tile.placedConsumable) : null;

          return (
            <button
              key={tile.id}
              onClick={() => !hasConsumable && onPlace(i)}
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

      <div className="flex gap-3">
        <button
          onClick={onSkip}
          className="font-mono text-sm px-6 py-2 rounded-lg cursor-pointer transition-colors"
          style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
        >
          Skip remaining
        </button>
      </div>
    </div>
  );
}
