import { RELIC_MAP } from '../constants';
import type { GameState } from '../types';

interface Props {
  state: GameState;
}

export function HUD({ state }: Props) {
  const owed = Math.max(0, state.deadline - state.deposited);
  const attemptsTotal = 3;
  const attemptsLeft = state.attempts_remaining;

  return (
    <>
      {/* Cycle */}
      <div className="flex flex-col gap-0.5">
        <div className="font-mono text-xs" style={{ color: 'var(--text-muted)', letterSpacing: '0.15em' }}>CYCLE</div>
        <div className="font-display text-2xl" style={{ color: 'var(--text-primary)' }}>
          {state.cycle_number}
        </div>
      </div>

      <div className="gold-line" />

      {/* Deadline / deposited / owed */}
      <div className="flex flex-col gap-1.5">
        <StatRow label="DEADLINE"  value={`$${state.deadline}`} />
        <StatRow label="DEPOSITED" value={`$${Math.floor(state.deposited)}`} valueColor="var(--green)" />
        <StatRow label="OWED"      value={`$${Math.ceil(owed)}`} valueColor={owed > 0 ? 'var(--red)' : 'var(--green)'} />
      </div>

      <div className="gold-line" />

      {/* Multiplier */}
      <div className="flex flex-col gap-0.5">
        <div className="font-mono text-xs" style={{ color: 'var(--text-muted)', letterSpacing: '0.1em' }}>MULT</div>
        <div className="font-display text-3xl" style={{ color: '#f97316' }}>
          ×{state.multiplier.toFixed(1)}
        </div>
      </div>

      {/* Streak */}
      <div className="flex flex-col gap-0.5">
        <div className="font-mono text-xs" style={{ color: 'var(--text-muted)', letterSpacing: '0.1em' }}>🔥 STREAK</div>
        <div
          className="font-display text-2xl"
          style={{ color: state.streak >= 10 ? '#f97316' : state.streak >= 5 ? 'var(--gold)' : 'var(--text-primary)' }}
        >
          {state.streak}
        </div>
      </div>

      <div className="gold-line" />

      {/* Attempts remaining — dots */}
      <div className="flex flex-col gap-1.5">
        <div className="font-mono text-xs" style={{ color: 'var(--text-muted)', letterSpacing: '0.1em' }}>ATTEMPTS</div>
        <div className="flex gap-2">
          {Array.from({ length: attemptsTotal }).map((_, i) => (
            <div
              key={i}
              className="w-4 h-4 rounded-full"
              style={{
                background: i < attemptsLeft ? 'var(--green)' : 'var(--bg-raised)',
                border: `2px solid ${i < attemptsLeft ? 'var(--green-bright)' : 'var(--border)'}`,
              }}
            />
          ))}
        </div>
        <div className="font-mono text-xs" style={{ color: 'var(--text-dim)' }}>
          {attemptsLeft}/3 left
        </div>
      </div>

      {/* Relics */}
      {state.relics.length > 0 && (
        <>
          <div className="gold-line" />
          <div className="flex flex-col gap-1">
            <div className="font-mono text-xs" style={{ color: 'var(--text-muted)', letterSpacing: '0.1em' }}>RELICS</div>
            <div className="flex flex-wrap gap-1">
              {state.relics.map((r, i) => {
                const def = RELIC_MAP[r];
                return (
                  <span key={i} title={`${def.name}: ${def.description}`}
                    className="text-lg cursor-default" style={{ lineHeight: 1 }}>
                    {def.emoji}
                  </span>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Active event */}
      {state.active_event && (
        <>
          <div className="gold-line" />
          <div className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>EVENT</div>
          <div className="font-mono text-xs" style={{ color: 'var(--gold)' }}>
            {state.active_event.replace(/_/g, ' ').toUpperCase()}
          </div>
        </>
      )}
    </>
  );
}

function StatRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex justify-between items-baseline gap-1">
      <span className="font-mono text-xs shrink-0" style={{ color: 'var(--text-muted)', letterSpacing: '0.1em' }}>{label}</span>
      <span className="font-mono font-bold text-xs" style={{ color: valueColor ?? 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}
