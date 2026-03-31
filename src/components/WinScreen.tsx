import type { GameState } from '../types';

interface Props {
  state: GameState;
  onRestart: () => void;
}

export function WinScreen({ state, onRestart }: Props) {
  const tokens = state.runTokens;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-6">
      <div className="text-center">
        <div className="text-6xl mb-3">🏆</div>
        <div className="font-display text-5xl text-glow-gold" style={{ color: 'var(--gold)', letterSpacing: '0.08em' }}>
          YOU WON!
        </div>
        <div className="font-mono text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
          All 6 rounds cleared · Run complete
        </div>
      </div>

      <div className="gold-line w-48" />

      <div className="casino-panel p-4 w-full max-w-sm flex flex-col gap-2">
        <StatRow label="Final cash"           value={`$${state.cash}`}        color="var(--gold)" />
        <StatRow label="Total earned"         value={`$${state.totalCashEarned}`} color="var(--gold)" />
        <StatRow label="Gems collected"       value={`💎 ${state.gems}`}      color="#60c0ff" />
        <StatRow label="Relics"               value={`${state.relics.length}`} />
        <StatRow label="Boss rounds cleared"  value={`${state.bossRoundsCleared} / 2`} color="var(--green)" />
        <StatRow label="Total tiles cleared"  value={`${state.totalTilesCleared}`} />
        <StatRow label="Best multiplier"      value={`×${state.bestMultiplier.toFixed(1)}`} color="#f97316" />
        <div className="gold-line my-1" />
        <StatRow label="Run tokens earned"    value={`⚙ ${tokens}`}          color="var(--green)" />
      </div>

      <div className="font-mono text-xs text-center" style={{ color: 'var(--text-muted)' }}>
        Seed: <span style={{ color: 'var(--text-primary)' }}>{state.seed.toString(16).toUpperCase()}</span>
      </div>

      <button
        onClick={onRestart}
        className="font-display text-2xl px-12 py-4 rounded-xl cursor-pointer transition-all duration-200 glow-gold"
        style={{ background: 'var(--gold)', color: '#000', letterSpacing: '0.1em' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--gold-bright)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'var(--gold)')}
      >
        PLAY AGAIN
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
