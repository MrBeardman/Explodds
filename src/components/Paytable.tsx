import { SYMBOL_MAP } from '../constants';
import { getSymbolOdds } from '../gameLogic';
import type { GameState } from '../types';

interface Props {
  state: GameState;
}

const MODIFIED_COLOR = '#c084fc';

// General odds+payout per symbol (not counted from this specific board — see
// getSymbolOdds). Values shift color when an event/boss/boost is actively
// changing them, with a tooltip explaining the delta.
export function Paytable({ state }: Props) {
  const rows = getSymbolOdds(state);

  return (
    <div className="stat-card">
      <div className="font-mono text-xs mb-2" style={{ color: 'var(--text-muted)', letterSpacing: '0.12em' }}>
        ODDS
      </div>
      <div className="flex flex-col gap-1">
        {rows.map(r => {
          const def = SYMBOL_MAP[r.id];
          // Show as an explicit multiplier + before/after values — a bare "+50%"
          // reads as "+50 percentage points" to most players, which is wildly
          // wrong for a relative (multiplicative) change on a % stat.
          const oddsMult = r.baseWeight > 0 ? r.weight / r.baseWeight : 1;
          const payoutMult = r.basePayout > 0 ? r.payout / r.basePayout : 1;

          const tooltipParts: string[] = [];
          if (r.oddsModified) {
            tooltipParts.push(`Odds ×${oddsMult.toFixed(2)} (${(r.basePct * 100).toFixed(0)}% → ${(r.pct * 100).toFixed(0)}%)`);
          }
          if (r.payoutModified) {
            tooltipParts.push(`Payout ×${payoutMult.toFixed(2)} ($${r.basePayout.toFixed(2)} → $${r.payout.toFixed(2)})`);
          }
          const tooltip = tooltipParts.join(' · ') || undefined;

          return (
            <div key={r.id} className="flex items-center gap-2 font-mono text-xs" title={tooltip}>
              <span className="text-base leading-none w-5 text-center">{def.emoji}</span>
              <span className="flex-1" style={{ color: 'var(--text-dim)' }}>{def.name}</span>
              <span style={{ color: r.oddsModified ? MODIFIED_COLOR : 'var(--text-muted)' }}>
                {(r.pct * 100).toFixed(0)}%
              </span>
              <span className="font-bold w-12 text-right" style={{ color: r.payoutModified ? MODIFIED_COLOR : 'var(--gold)' }}>
                ${r.payout.toFixed(2)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
