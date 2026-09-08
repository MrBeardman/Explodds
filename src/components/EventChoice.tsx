import { EVENT_CARD_MAP, MAX_TRAITS } from '../constants';
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
        {cards.map((card, i) => {
          const pickedBefore = state.event_history.includes(card.id);
          const traitsFull = state.traits.length >= MAX_TRAITS;
          return (
          <button
            key={card.id}
            onClick={() => onSelect(card.id)}
            className="choice-card card-rise w-52 p-6 flex flex-col items-center gap-3 text-center relative"
            style={{ animationDelay: `${i * 90}ms`, borderColor: pickedBefore && !traitsFull ? 'var(--gold)' : undefined }}
          >
            {pickedBefore && (
              <span
                className="absolute -top-2 font-mono text-[10px] px-2 py-0.5 rounded"
                style={{ background: traitsFull ? 'var(--bg-raised)' : 'var(--gold)', color: traitsFull ? 'var(--text-muted)' : '#000', letterSpacing: '0.1em' }}
              >
                {traitsFull ? 'PICKED BEFORE · TRAITS FULL' : 'PICK AGAIN → KEEP ALL RUN'}
              </span>
            )}
            <span className="text-6xl leading-none">{card.emoji}</span>
            <span className="font-display text-xl" style={{ color: 'var(--gold)', letterSpacing: '0.06em' }}>
              {card.name.toUpperCase()}
            </span>
            <span className="font-mono text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              {card.description}
            </span>
          </button>
          );
        })}
      </div>

      <div className="font-mono text-xs text-center leading-relaxed" style={{ color: 'var(--text-dim)' }}>
        Lasts this cycle only. Pick the same card a second time to keep it for the whole run
        {' '}({state.traits.length}/{MAX_TRAITS} traits kept).
      </div>
    </div>
  );
}
