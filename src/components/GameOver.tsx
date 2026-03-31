import type { GameState } from '../types';

interface Props {
  state: GameState;
  onRestart: () => void;
}

export function GameOver({ state, onRestart }: Props) {
  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center p-6"
      style={{ background: 'rgba(0,0,0,0.88)' }}
    >
      <div className="flex flex-col items-center gap-5 w-full max-w-sm">
        <div className="text-center">
          <div className="text-5xl mb-2">💥</div>
          <div className="font-display text-5xl" style={{ color: 'var(--red)', letterSpacing: '0.08em' }}>
            GAME OVER
          </div>
          <div className="font-mono text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
            Couldn't meet cycle {state.cycle_number} deadline
          </div>
        </div>

        <div className="gold-line w-48" />

        <div className="casino-panel p-4 w-full flex flex-col gap-2" style={{ border: '1px solid var(--border)' }}>
          <StatRow label="Cycles survived"   value={`${state.cycles_survived}`} />
          <StatRow label="Reached cycle"     value={`${state.cycle_number}`} />
          <StatRow label="Deadline"          value={`$${state.deadline}`} />
          <div className="gold-line my-1" />
          <StatRow label="Total earned"      value={`$${Math.floor(state.total_earned)}`} color="var(--gold)" />
          <StatRow label="Best multiplier"   value={`×${state.highest_multiplier.toFixed(1)}`} color="#f97316" />
          <StatRow label="Best streak"       value={`${state.best_streak}`} color="var(--gold)" />
          <StatRow label="Relics collected"  value={`${state.relics.length}`} />
          <div className="gold-line my-1" />
          <StatRow label="Cash remaining"    value={`$${Math.floor(state.wallet)}`} color="var(--gold)" />
          <StatRow label="Tickets saved"     value={`🎫 ${state.tickets}`} color="#60c0ff" />
        </div>

        <button
          onClick={onRestart}
          className="font-display text-2xl px-12 py-4 rounded-xl cursor-pointer transition-all duration-200"
          style={{ background: 'var(--green)', color: '#000', letterSpacing: '0.1em' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--green-bright)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--green)')}
        >
          TRY AGAIN
        </button>

        <div className="font-mono text-xs" style={{ color: 'var(--text-dim)' }}>
          Seed: {state.seed.toString(16).toUpperCase()}
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between">
      <span className="font-mono text-sm" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="font-mono text-sm font-bold" style={{ color: color ?? 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}
