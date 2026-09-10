import { BOSS_MAP, EVENT_CARD_MAP, DEDUCTION_MULT_GAIN, LOGICIAN_MULT_GAIN, attemptsForCycle } from '../constants';
import { isBossCycle } from '../gameLogic';
import type { GameState } from '../types';

interface Props {
  state: GameState;
}

export function HUD({ state }: Props) {
  const boss = state.active_boss ? BOSS_MAP[state.active_boss] : null;
  const deductionGain = state.relics.includes('logician') ? LOGICIAN_MULT_GAIN : DEDUCTION_MULT_GAIN;

  return (
    <div className="flex flex-col gap-2.5">

      {/* Mult + streak — top of the right panel */}
      <div className="stat-card flex items-center justify-between">
        <div>
          <div className="font-mono text-xs" style={{ color: 'var(--text-muted)', letterSpacing: '0.12em' }}>MULT</div>
          <div className="font-display text-3xl leading-none mt-1" style={{ color: '#f97316' }}>
            ×{state.multiplier.toFixed(1)}
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-xs" style={{ color: 'var(--text-muted)', letterSpacing: '0.12em' }}>🔥 STREAK</div>
          <div
            className="font-display text-3xl leading-none mt-1"
            style={{ color: state.streak >= 10 ? '#f97316' : state.streak >= 5 ? 'var(--gold)' : 'var(--text-primary)' }}
          >
            {state.streak}
          </div>
          {/* milestone pips: 5 / 10 / 15 */}
          <div className="flex gap-1 mt-1.5 justify-end">
            {[5, 10, 15].map(m => (
              <div key={m} className={`pip ${state.streak >= m ? 'pip-lit' : ''}`} title={`streak ${m}`} />
            ))}
          </div>
        </div>
      </div>

      {/* Deduction — proven clicks build a second streak that feeds the multiplier */}
      <div className="stat-card flex items-center justify-between" title={`A click is PROVEN when the visible numbers make it certainly safe. Each proven click adds +${deductionGain.toFixed(2)} mult; a guess resets both streaks.`}>
        <div>
          <div className="font-mono text-xs" style={{ color: 'var(--text-muted)', letterSpacing: '0.12em' }}>🧠 PROVEN</div>
          <div className="font-display text-3xl leading-none mt-1" style={{ color: state.deduction_streak > 0 ? 'var(--green-bright)' : 'var(--text-primary)' }}>
            {state.deduction_streak}
          </div>
        </div>
        <div className="text-right font-mono text-xs leading-snug" style={{ color: 'var(--text-muted)' }}>
          <div><span style={{ color: 'var(--green-bright)' }}>{state.proven_clicks}</span> proven · <span style={{ color: state.guess_clicks > 0 ? 'var(--gold)' : 'var(--text-muted)' }}>{state.guess_clicks}</span> guess</div>
          <div style={{ color: 'var(--text-dim)' }}>+{deductionGain.toFixed(2)} mult each</div>
        </div>
      </div>

      {/* Boss rule card */}
      {boss && (
        <div className="stat-card stat-card-boss flex items-start gap-2.5">
          <span className="text-3xl leading-none">{boss.emoji}</span>
          <div className="min-w-0">
            <div className="font-display text-base leading-tight" style={{ color: 'var(--red)', letterSpacing: '0.05em' }}>
              {boss.name.toUpperCase()}
            </div>
            <div className="font-mono text-xs mt-0.5 leading-snug" style={{ color: 'var(--text-muted)' }}>
              {boss.description}
            </div>
          </div>
        </div>
      )}

      {/* Attempts */}
      <div className="stat-card flex items-center justify-between">
        <span className="font-mono text-xs" style={{ color: 'var(--text-muted)', letterSpacing: '0.12em' }}>ATTEMPTS</span>
        <div className="flex gap-2 items-center">
          {Array.from({ length: attemptsForCycle(state.cycle_number, state.active_boss) }).map((_, i) => (
            <span key={i} className="text-base leading-none" style={{ opacity: i < state.attempts_remaining ? 1 : 0.2 }}>
              💣
            </span>
          ))}
        </div>
      </div>

      {/* Modifiers — permanent traits (picked twice) and this cycle's pick */}
      {state.active_events.length > 0 && (
        <div className="stat-card">
          {state.traits.length > 0 && (
            <>
              <div className="font-mono text-xs mb-1.5" style={{ color: 'var(--text-muted)', letterSpacing: '0.12em' }}>
                TRAITS {state.traits.length}
              </div>
              <div className="flex flex-col gap-1 mb-2">
                {state.traits.map(id => {
                  const def = EVENT_CARD_MAP[id];
                  return (
                    <div key={id} className="flex items-center gap-1.5" title={`${def.description} — permanent this run`}>
                      <span className="text-sm leading-none">{def.emoji}</span>
                      <span className="font-mono text-xs truncate" style={{ color: 'var(--gold)' }}>{def.name.toUpperCase()}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          {state.cycle_events.length > 0 && (
            <>
              <div className="font-mono text-xs mb-1.5" style={{ color: 'var(--text-muted)', letterSpacing: '0.12em' }}>
                THIS CYCLE
              </div>
              <div className="flex flex-col gap-1">
                {state.cycle_events.map(id => {
                  const def = EVENT_CARD_MAP[id];
                  return (
                    <div key={id} className="flex items-center gap-1.5" title={`${def.description} — this cycle only`}>
                      <span className="text-sm leading-none">{def.emoji}</span>
                      <span className="font-mono text-xs truncate" style={{ color: 'var(--text-primary)' }}>{def.name.toUpperCase()}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Next-boss hint on the cycle before a boss */}
      {!state.active_boss && isBossCycle(state.cycle_number + 1) && (
        <div className="font-mono text-xs text-center py-1 rounded" style={{ color: 'var(--red)', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)' }}>
          ⚠ boss next cycle — prep in the shop
        </div>
      )}
    </div>
  );
}
