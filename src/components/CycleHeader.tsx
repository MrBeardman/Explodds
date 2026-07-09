import type { GameState } from '../types';

interface Props {
  state: GameState;
}

// Slim horizontal cycle indicator above the board — cycle number + boss countdown.
export function CycleHeader({ state }: Props) {
  const boss = state.active_boss !== null;
  const cyclesToBoss = boss ? 0 : 3 - (state.cycle_number % 3);

  return (
    <div className="stat-card w-full flex items-center justify-between px-4 py-2.5">
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-xs" style={{ color: 'var(--text-muted)', letterSpacing: '0.15em' }}>CYCLE</span>
        <span className="font-display text-2xl leading-none" style={{ color: 'var(--text-primary)' }}>
          {state.cycle_number}
        </span>
      </div>
      {boss ? (
        <div className="font-mono text-xs px-2 py-1 rounded" style={{ color: '#fff', background: 'rgba(220,38,38,0.35)', border: '1px solid var(--red)' }}>
          BOSS CYCLE
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs" style={{ color: 'var(--text-dim)' }}>BOSS IN</span>
          <div className="flex gap-1">
            {[...Array(3)].map((_, i) => (
              <div key={i} className={`pip pip-notch ${i >= cyclesToBoss ? '' : 'pip-lit'}`}
                style={i >= cyclesToBoss ? {} : { background: 'var(--red)', borderColor: '#f87171', boxShadow: '0 0 5px rgba(220,38,38,0.7)' }} />
            ))}
          </div>
          <span className="font-mono text-xs" style={{ color: 'var(--red)' }}>{cyclesToBoss}</span>
        </div>
      )}
    </div>
  );
}
