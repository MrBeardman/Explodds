import type { GameState } from '../types';
import { LEVELS } from '../constants';

interface Props {
  state: GameState;
  onRestart: () => void;
}

export function GameOver({ state, onRestart }: Props) {
  const tokens = state.runTokens;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-6">
      <div className="text-center">
        <div className="text-6xl mb-3">💥</div>
        <div className="font-display text-5xl" style={{ color: 'var(--red)', letterSpacing: '0.08em' }}>
          GAME OVER
        </div>
        <div className="font-mono text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
          Reached round {state.round} of 6
        </div>
      </div>

      <div className="gold-line w-48" />

      <div className="casino-panel p-4 w-full max-w-sm flex flex-col gap-2">
        <StatRow label="Round reached"        value={`${state.round} / 6`} />
        <StatRow label="Rounds cleared"       value={`${state.roundsCleared}`} />
        <StatRow label="Boss rounds cleared"  value={`${state.bossRoundsCleared}`} />
        <StatRow label="Total tiles cleared"  value={`${state.totalTilesCleared}`} />
        <StatRow label="Best multiplier"      value={`×${state.bestMultiplier.toFixed(1)}`} />
        <StatRow label="Relics collected"     value={`${state.relics.length}`} />
        <div className="gold-line my-1" />
        <StatRow label="Cash remaining"       value={`$${state.cash}`}       color="var(--gold)" />
        <StatRow label="Gems earned"          value={`💎 ${state.gems}`}      color="#60c0ff" />
        <StatRow label="Run tokens earned"    value={`⚙ ${tokens}`}          color="var(--green)" />
      </div>

      {/* Level completion grid */}
      <div className="w-full max-w-sm">
        <div className="font-mono text-xs text-center mb-2" style={{ color: 'var(--text-muted)', letterSpacing: '0.15em' }}>
          PROGRESS
        </div>
        <div className="grid grid-cols-6 gap-1.5">
          {LEVELS.map(l => {
            const cleared = l.round <= state.roundsCleared;
            const current = l.round === state.round && !cleared;
            return (
              <div
                key={l.round}
                className="flex flex-col items-center p-2 rounded-lg text-center"
                style={{
                  background: cleared ? 'rgba(46,168,74,0.2)' : current ? 'rgba(220,38,38,0.2)' : 'var(--bg-card)',
                  border: `1px solid ${cleared ? 'var(--green)' : current ? 'var(--red)' : 'var(--border)'}`,
                }}
              >
                <div className="font-mono text-xs" style={{ color: l.isBoss ? 'var(--gold)' : 'var(--text-muted)' }}>
                  {l.isBoss ? '👑' : `R${l.round}`}
                </div>
                <div className="text-sm">{cleared ? '✓' : current ? '✗' : '·'}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="font-mono text-xs text-center" style={{ color: 'var(--text-muted)' }}>
        Seed: <span style={{ color: 'var(--text-primary)' }}>{state.seed.toString(16).toUpperCase()}</span>
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
