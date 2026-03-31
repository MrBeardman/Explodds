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
        {s.won ? (
          <>
            <div className="text-5xl mb-2">💸</div>
            <div className="font-display text-3xl text-glow-gold" style={{ color: 'var(--gold)', letterSpacing: '0.1em' }}>
              CASHED OUT
            </div>
          </>
        ) : (
          <>
            <div className="text-5xl mb-2">💥</div>
            <div className="font-display text-3xl" style={{ color: 'var(--red)', letterSpacing: '0.1em' }}>
              BUST
            </div>
          </>
        )}
        <div className="font-mono text-xs mt-1" style={{ color: 'var(--text-muted)', letterSpacing: '0.15em' }}>
          ROUND {s.round} / 6{s.isBoss ? ' · 👑 BOSS' : ''}
        </div>
      </div>

      <div className="gold-line w-48" />

      {/* Stats */}
      <div className="casino-panel p-4 w-full max-w-sm flex flex-col gap-2">
        <Row label="Score" value={s.score.toLocaleString()} />
        <Row label="Bet" value={`$${s.bet}`} />
        {s.won && <Row label="Cashout Mult" value={`${s.cashoutMult.toFixed(2)}×`} />}
        {s.won && (
          <Row
            label="Payout"
            value={`$${s.payout}`}
            highlight={true}
            color="var(--green)"
          />
        )}
        {!s.won && <Row label="Lost Bet" value={`-$${s.bet}`} color="var(--red)" />}

        <div className="gold-line my-1" />

        {s.starBonus > 0   && <Row label={`⭐ Star Bonus`}      value={`+$${s.starBonus}`} color="var(--gold)" />}
        {s.cherryCombo     && <Row label={`🍒 Cherry Combo!`}   value="+50% payout" color="var(--gold)" />}
        {s.bananaBonus > 0 && <Row label={`🍌 Banana Cluster`}  value={`+${s.bananaBonus} pts`} color="var(--gold)" />}
        {s.luckyCharmBonus > 0 && <Row label={`🍀 Lucky Charm`} value={`+$${s.luckyCharmBonus}`} color="var(--gold)" />}

        <div className="gold-line my-1" />

        <Row label="Tiles cleared"
             value={`${s.tilesCleared} / ${s.totalSafeTiles}`} />
        <Row label="Best multiplier" value={`×${s.multiplierReached.toFixed(1)}`} />
        <Row label="💎 Gems earned" value={`+${s.gemsEarned}`} color="#60c0ff" />
        <Row label="💵 Cash now" value={`$${state.cash}`} color="var(--gold)" />
      </div>

      <button
        onClick={onContinue}
        className="font-display text-xl px-10 py-3 rounded-xl cursor-pointer transition-all duration-200"
        style={{ background: 'var(--gold)', color: '#000', letterSpacing: '0.1em' }}
      >
        {state.lives > 0 ? 'GO TO SHOP →' : 'GAME OVER'}
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
