import { RELIC_MAP } from '../constants';
import type { GameState } from '../types';

interface Props {
  state: GameState;
}

// Horizontal relic row under the grid — Balatro-style joker shelf.
export function RelicShelf({ state }: Props) {
  return (
    <div className="stat-card w-full flex items-center gap-3">
      <span className="font-mono text-xs shrink-0" style={{ color: 'var(--text-muted)', letterSpacing: '0.12em' }}>
        RELICS {state.relics.length}/{state.max_relic_slots}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: state.max_relic_slots }).map((_, i) => {
          const id = state.relics[i];
          if (!id) return <div key={i} className="slot slot-empty" />;
          const def = RELIC_MAP[id];
          return (
            <div key={i} className={`slot rarity-${def.rarity}`} title={`${def.name}: ${def.description}`}>
              {def.emoji}
            </div>
          );
        })}
      </div>
    </div>
  );
}
