import { EVENT_CARD_MAP } from '../constants';
import type { GameState, EventCardId } from '../types';

interface Props {
  state: GameState;
  onSelect: (id: EventCardId) => void;
  onConfirm: () => void;
}

export function EventCards({ state, onSelect, onConfirm }: Props) {
  const { eventCardOptions, activeEventCard, round } = state;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-6">
      <div className="text-center">
        <div className="font-display text-2xl" style={{ color: 'var(--gold)', letterSpacing: '0.1em' }}>
          ROUND {round} / 6
        </div>
        <div className="font-mono text-xs mt-1" style={{ color: 'var(--text-muted)', letterSpacing: '0.15em' }}>
          CHOOSE AN EVENT
        </div>
      </div>

      <div className="gold-line w-48" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl">
        {eventCardOptions.map(id => {
          const card = EVENT_CARD_MAP[id];
          const selected = activeEventCard === id;
          return (
            <button
              key={id}
              onClick={() => onSelect(id)}
              className="casino-panel p-5 flex flex-col gap-3 text-left cursor-pointer transition-all duration-200 rounded-xl"
              style={{
                border: selected
                  ? `2px solid var(--gold)`
                  : '2px solid var(--border)',
                background: selected ? 'rgba(200,168,75,0.08)' : 'var(--bg-surface)',
                transform: selected ? 'translateY(-3px)' : 'none',
                boxShadow: selected ? '0 0 16px rgba(200,168,75,0.3)' : 'none',
              }}
            >
              <div className="text-4xl">{card.emoji}</div>
              <div>
                <div className="font-display text-xl" style={{ color: selected ? 'var(--gold)' : 'var(--text-primary)', letterSpacing: '0.05em' }}>
                  {card.name.toUpperCase()}
                </div>
                <div className="text-sm mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  {card.description}
                </div>
              </div>
              {selected && (
                <div className="font-mono text-xs" style={{ color: 'var(--gold)' }}>▶ SELECTED</div>
              )}
            </button>
          );
        })}
      </div>

      <button
        onClick={onConfirm}
        disabled={!activeEventCard}
        className="font-display text-xl px-10 py-3 rounded-xl transition-all duration-200 cursor-pointer"
        style={{
          letterSpacing: '0.1em',
          background: activeEventCard ? 'var(--gold)' : 'var(--bg-card)',
          color: activeEventCard ? '#000' : 'var(--text-dim)',
          cursor: activeEventCard ? 'pointer' : 'not-allowed',
        }}
      >
        CONFIRM &amp; SET BET
      </button>
    </div>
  );
}
