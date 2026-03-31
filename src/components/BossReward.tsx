import type { GameState, RelicId } from '../types';
import { RELIC_MAP } from '../constants';

interface Props {
  state: GameState;
  onPickRelic: (id: RelicId) => void;
}

export function BossReward({ state, onPickRelic }: Props) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-6">
      <div className="text-center">
        <div className="text-5xl mb-3">👑</div>
        <div className="font-display text-4xl text-glow-gold" style={{ color: 'var(--gold)', letterSpacing: '0.1em' }}>
          BOSS CLEARED!
        </div>
        <div className="font-mono text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
          Choose one free relic
        </div>
      </div>

      <div className="gold-line w-48" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl">
        {state.bossRewardOptions.map(id => {
          const def = RELIC_MAP[id];
          if (!def) return null;
          return (
            <button
              key={id}
              onClick={() => onPickRelic(id)}
              className="casino-panel p-5 flex flex-col gap-3 text-left cursor-pointer transition-all duration-200 rounded-xl"
              style={{ border: '2px solid var(--gold)' }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(200,168,75,0.1)';
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)';
                (e.currentTarget as HTMLElement).style.boxShadow = '0 0 20px rgba(200,168,75,0.3)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = 'var(--bg-surface)';
                (e.currentTarget as HTMLElement).style.transform = 'none';
                (e.currentTarget as HTMLElement).style.boxShadow = 'none';
              }}
            >
              <div className="text-4xl">{def.emoji}</div>
              <div>
                <div className="font-display text-xl" style={{ color: 'var(--gold)', letterSpacing: '0.05em' }}>
                  {def.name.toUpperCase()}
                </div>
                <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{def.description}</div>
              </div>
              <div className="font-mono text-xs" style={{ color: 'var(--green)' }}>FREE</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
