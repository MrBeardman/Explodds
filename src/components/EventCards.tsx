import { useState, useEffect } from 'react';
import { EVENT_CARD_MAP } from '../constants';
import type { GameState, EventCardId } from '../types';

interface Props {
  state: GameState;
  onSelect: (id: EventCardId) => void;
}

export function EventBanner({ state, onSelect }: Props) {
  const [countdown, setCountdown] = useState(8);

  useEffect(() => {
    setCountdown(8);
    const interval = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(interval); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const cards = state.event_card_options
    .map(id => EVENT_CARD_MAP[id])
    .filter(Boolean);

  return (
    <div
      className="w-full max-w-sm p-3 rounded-xl flex flex-col gap-3"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
    >
      <div className="flex justify-between items-center">
        <div className="font-mono text-xs" style={{ color: 'var(--text-muted)', letterSpacing: '0.15em' }}>
          CYCLE {state.cycle_number} — PICK YOUR MODIFIER
        </div>
        <div className="font-mono text-xs" style={{ color: countdown <= 3 ? 'var(--red)' : 'var(--text-dim)' }}>
          {countdown}s
        </div>
      </div>

      <div className="flex gap-2">
        {cards.map(card => (
          <button
            key={card.id}
            onClick={() => onSelect(card.id)}
            className="flex-1 flex flex-col items-center gap-1 p-2 rounded-xl cursor-pointer transition-all duration-150"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--gold)';
              (e.currentTarget as HTMLElement).style.background = 'rgba(200,168,75,0.08)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
              (e.currentTarget as HTMLElement).style.background = 'var(--bg-card)';
            }}
          >
            <span className="text-2xl">{card.emoji}</span>
            <div className="font-display text-xs text-center" style={{ color: 'var(--gold)', letterSpacing: '0.05em' }}>
              {card.name.toUpperCase()}
            </div>
            <div className="font-mono text-xs text-center leading-tight" style={{ color: 'var(--text-muted)' }}>
              {card.description}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
