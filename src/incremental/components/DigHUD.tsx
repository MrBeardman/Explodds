import { isDigCheckpointLevel } from '../constants';
import { DIG_BOSS_MAP } from '../digBosses';
import type { DigGameState } from '../types';

interface Props {
  state: DigGameState;
  onCashOut: () => void;
}

export function DigHUD({ state, onCashOut }: Props) {
  const chargesPct = state.chargesMax > 0 ? (state.chargesRemaining / state.chargesMax) * 100 : 0;
  const checkpoint = isDigCheckpointLevel(state.level);
  const boss = state.activeBoss ? DIG_BOSS_MAP[state.activeBoss] : null;

  return (
    <div className="w-60 shrink-0 flex flex-col gap-2.5">
      <div className="flex gap-2">
        <div className="stat-card flex-1">
          <div className="font-mono text-xs" style={{ color: 'var(--text-muted)', letterSpacing: '0.1em' }}>💰 BANKED</div>
          <div className="font-display text-2xl leading-none mt-1" style={{ color: 'var(--gold)' }}>
            ${state.bankedCash.toFixed(2)}
          </div>
        </div>
        <div className="stat-card flex-1">
          <div className="font-mono text-xs" style={{ color: 'var(--text-muted)', letterSpacing: '0.1em' }}>⚠️ AT RISK</div>
          <div className="font-display text-2xl leading-none mt-1" style={{ color: 'var(--green-bright)' }}>
            ${state.currentLevelCash.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="stat-card">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs" style={{ color: 'var(--text-muted)', letterSpacing: '0.12em' }}>⛏️ DURABILITY</span>
          <span className="font-mono text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
            {state.chargesRemaining} / {state.chargesMax}
          </span>
        </div>
        <div className="progress-track mt-2">
          <div className="progress-fill" style={{ width: `${chargesPct}%` }} />
        </div>
      </div>

      <div className="stat-card flex items-center justify-between">
        <span className="font-mono text-xs" style={{ color: 'var(--text-muted)', letterSpacing: '0.12em' }}>LEVEL</span>
        <span className="font-display text-xl" style={{ color: checkpoint ? '#f0a860' : 'var(--text-primary)' }}>
          {state.level}{checkpoint ? ' ⚠' : ''}
        </span>
      </div>

      {boss && (
        <div className="stat-card" style={{ borderColor: '#f0a860' }} title={boss.description}>
          <div className="font-mono text-xs" style={{ color: 'var(--text-muted)', letterSpacing: '0.1em' }}>CHECKPOINT BOSS</div>
          <div className="font-display text-sm mt-1" style={{ color: '#f0a860' }}>
            {boss.emoji} {boss.name.toUpperCase()}
          </div>
          <div className="font-mono text-[10px] mt-1" style={{ color: 'var(--text-dim)' }}>{boss.description}</div>
        </div>
      )}

      <button
        onClick={onCashOut}
        className="w-full font-display text-lg py-3 rounded-xl cursor-pointer transition-all duration-150"
        style={{ background: 'var(--gold)', color: '#000', letterSpacing: '0.06em', border: '1px solid var(--border)' }}
      >
        CASH OUT
      </button>
    </div>
  );
}
