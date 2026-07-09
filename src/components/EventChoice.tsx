import { EVENT_CARD_MAP } from '../constants';
import type { GameState, EventCardId } from '../types';

interface Props {
  state: GameState;
  onSelect: (id: EventCardId) => void;
}

// Full-screen, untimed modifier pick at the start of each normal cycle.
export function EventChoice({ state, onSelect }: Props) {
  const cards = state.event_card_options
    .map(id => EVENT_CARD_MAP[id])
    .filter(Boolean);

  return (
    <div
      className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-8 p-6 overlay-in"
      style={{ background: 'rgba(4,6,10,0.92)' }}
    >
      <div className="text-center">
        <div className="font-mono text-xs mb-1" style={{ color: 'var(--text-muted)', letterSpacing: '0.3em' }}>
          CYCLE {state.cycle_number} · DEADLINE ${state.deadline}
        </div>
        <div className="font-display text-4xl" style={{ color: 'var(--gold)', letterSpacing: '0.08em' }}>
          CHOOSE YOUR MODIFIER
        </div>
      </div>

      <div className="flex gap-5 flex-wrap justify-center">
        {cards.map((card, i) => (
          <button
            key={card.id}
            onClick={() => onSelect(card.id)}
            className="choice-card card-rise w-52 p-6 flex flex-col items-center gap-3 text-center"
            style={{ animationDelay: `${i * 90}ms` }}
          >
            <span className="text-6xl leading-none">{card.emoji}</span>
            <span className="font-display text-xl" style={{ color: 'var(--gold)', letterSpacing: '0.06em' }}>
              {card.name.toUpperCase()}
            </span>
            <span className="font-mono text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              {card.description}
            </span>
          </button>
        ))}
      </div>

      <div className="font-mono text-xs" style={{ color: 'var(--text-dim)' }}>
        The modifier lasts the whole cycle — pick what fits your build
      </div>
    </div>
  );
}
