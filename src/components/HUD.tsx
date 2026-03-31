import { LEVELS, RELIC_MAP } from '../constants';
import type { GameState } from '../types';

interface Props {
  state: GameState;
}

export function HUD({ state }: Props) {
  const cfg = LEVELS[state.round - 1];
  const targetScore = Math.round(cfg.target * (state.activeEventCard === 'high_roller' ? 1.5 : 1));
  const cumulativeScore = state.cumulativeRoundScore + state.score;

  return (
    <>
      {/* Cash */}
      <div className="flex flex-col gap-0.5">
        <div className="font-mono text-xs" style={{ color: 'var(--text-muted)', letterSpacing: '0.15em' }}>CASH</div>
        <div className="font-display text-3xl" style={{ color: 'var(--gold)' }}>${state.cash}</div>
      </div>

      <div className="gold-line" />

      {/* Round / Target / Score */}
      <div className="flex flex-col gap-1.5">
        <StatRow label="ROUND" value={`${state.round} / 6${cfg.isBoss ? ' 👑' : ''}`}
                 valueColor={cfg.isBoss ? 'var(--gold)' : 'var(--text-primary)'} />
        <StatRow label="TARGET" value={targetScore.toLocaleString()} />
        <StatRow
          label="SCORE"
          value={cumulativeScore.toLocaleString()}
          valueColor={state.canCashout ? 'var(--green)' : 'var(--text-primary)'}
          large
        />
        {state.roundAttempts > 0 && (
          <div className="font-mono text-xs" style={{ color: 'var(--text-dim)' }}>
            {state.roundAttempts} bust{state.roundAttempts > 1 ? 's' : ''} this round
          </div>
        )}
      </div>

      <div className="gold-line" />

      {/* Multiplier */}
      <div className="flex flex-col gap-0.5">
        <div className="font-mono text-xs" style={{ color: 'var(--text-muted)', letterSpacing: '0.1em' }}>MULTIPLIER</div>
        <div className="font-display text-3xl" style={{ color: '#f97316' }}>
          ×{state.multiplier.toFixed(1)}
        </div>
        {state.streakGuaranteed && (
          <div className="font-mono text-xs streak-full" style={{ color: 'var(--gold)' }}>
            ✦ NEXT TILE SAFE ×3
          </div>
        )}
      </div>

      <div className="gold-line" />

      {/* Streak counter */}
      <div className="flex flex-col gap-0.5">
        <div className="font-mono text-xs" style={{ color: 'var(--text-muted)', letterSpacing: '0.1em' }}>🔥 STREAK</div>
        <div className="font-display text-2xl" style={{ color: state.consecutiveClears >= 5 ? '#f97316' : 'var(--text-primary)' }}>
          {state.consecutiveClears}
        </div>
      </div>

      <div className="gold-line" />

      {/* Gems */}
      <StatRow label="💎 GEMS" value={`${state.gems}`} valueColor="#60c0ff" />

      {/* Active relics */}
      {state.relics.length > 0 && (
        <>
          <div className="gold-line" />
          <div className="flex flex-col gap-1">
            <div className="font-mono text-xs" style={{ color: 'var(--text-muted)', letterSpacing: '0.1em' }}>RELICS</div>
            <div className="flex flex-wrap gap-1">
              {state.relics.map(r => {
                const def = RELIC_MAP[r];
                return (
                  <span key={r} title={def.description}
                    className="text-lg cursor-default" style={{ lineHeight: 1 }}>
                    {def.emoji}
                  </span>
                );
              })}
            </div>
          </div>
        </>
      )}
    </>
  );
}

function StatRow({ label, value, valueColor, large }: {
  label: string; value: string; valueColor?: string; large?: boolean;
}) {
  return (
    <div className="flex justify-between items-baseline gap-1">
      <span className="font-mono text-xs shrink-0" style={{ color: 'var(--text-muted)', letterSpacing: '0.1em' }}>{label}</span>
      <span className={`font-mono font-bold ${large ? 'text-base' : 'text-xs'}`}
            style={{ color: valueColor ?? 'var(--text-primary)' }}>
        {value}
      </span>
    </div>
  );
}
