import type { GameState } from '../types';

interface Props {
  state: GameState;
  onContinue: () => void;
}

export function RoundSummary({ state, onContinue }: Props) {
  const s = state.roundSummary;
  if (!s) return null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-6">
      {/* Header */}
      <div className="text-center">
        <div className="text-5xl mb-2">💸</div>
        <div className="font-display text-3xl text-glow-gold" style={{ color: 'var(--gold)', letterSpacing: '0.1em' }}>
          CASHED OUT
        </div>
        <div className="font-mono text-xs mt-1" style={{ color: 'var(--text-muted)', letterSpacing: '0.15em' }}>
          ROUND {s.round} / 6{s.isBoss ? ' · 👑 BOSS' : ''}
          {s.attempts > 0 ? ` · ${s.attempts} bust${s.attempts > 1 ? 's' : ''} survived` : ''}
        </div>
      </div>

      <div className="gold-line w-48" />

      {/* Stats */}
      <div className="casino-panel p-4 w-full max-w-sm flex flex-col gap-2">
        <Row label="Bet"             value={`$${s.bet}`} />
        <Row label="Multiplier"      value={`×${s.cashoutMult.toFixed(2)}`} />
        <Row label="Base payout"     value={`$${s.payout}`} />

        {(s.starBonus > 0 || s.cherryCombo || s.luckyCharmBonus > 0) && (
          <div className="gold-line my-1" />
        )}
        {s.starBonus > 0      && <Row label="⭐ Star bonus"   value={`+$${s.starBonus}`}      color="var(--gold)" />}
        {s.cherryCombo        && <Row label="🍒 Cherry combo!" value="+50% base"              color="var(--gold)" />}
        {s.luckyCharmBonus > 0&& <Row label="🍀 Lucky charm"  value={`+$${s.luckyCharmBonus}`} color="var(--gold)" />}

        <div className="gold-line my-1" />

        <Row label="TOTAL PAYOUT" value={`$${s.payout}`} highlight color="var(--green)" />

        <div className="gold-line my-1" />

        <Row label="Score this attempt" value={s.score.toLocaleString()} />
        {s.attempts > 0 && (
          <Row label="Cumulative score"  value={s.cumulativeScore.toLocaleString()} />
        )}
        <Row label="Tiles cleared"  value={`${s.tilesCleared} / ${s.totalSafeTiles}`} />
        <Row label="Best mult"      value={`×${s.multiplierReached.toFixed(1)}`} />
        <Row label="💎 Gems earned" value={`+${s.gemsEarned}`}  color="#60c0ff" />
        <Row label="💵 Cash now"    value={`$${state.cash}`}    color="var(--gold)" />
      </div>

      <button
        onClick={onContinue}
        className="font-display text-xl px-10 py-3 rounded-xl cursor-pointer transition-all duration-200"
        style={{ background: 'var(--gold)', color: '#000', letterSpacing: '0.1em' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--gold-bright)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'var(--gold)')}
      >
        GO TO SHOP →
      </button>
    </div>
  );
}

function Row({ label, value, highlight, color }: {
  label: string; value: string; highlight?: boolean; color?: string;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="font-mono text-sm" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span
        className={`font-mono font-bold text-sm ${highlight ? 'text-glow-green' : ''}`}
        style={{ color: color ?? 'var(--text-primary)' }}
      >
        {value}
      </span>
    </div>
  );
}
