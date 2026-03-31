import { LEVELS, RELIC_MAP, ALL_CONSUMABLES } from '../constants';
import type { GameState } from '../types';
import { calcCashout } from '../gameLogic';

interface Props {
  state: GameState;
  onCashout: () => void;
  onActivateScanner: (axis: 'row' | 'col') => void;
  onCancelScanner: () => void;
}

export function HUD({ state, onCashout, onActivateScanner, onCancelScanner }: Props) {
  const cfg = LEVELS[state.round - 1];
  const targetScore = Math.round(cfg.target * (state.activeEventCard === 'high_roller' ? 1.5 : 1));
  const progress = Math.min(100, (state.score / targetScore) * 100);
  const hasCashout = state.canCashout;

  const { totalPayout, cashoutMult } = hasCashout ? calcCashout(state) : { totalPayout: 0, cashoutMult: 0 };

  const hasScanner = state.consumables.includes('scanner');
  const scannerActive = state.pendingScannerAxis !== null;

  return (
    <div className="w-full" style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
      {/* ── Top bar ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2">
        {/* Left: round + lives */}
        <div className="flex items-center gap-4">
          <div>
            <div className="font-mono text-xs" style={{ color: 'var(--text-muted)', letterSpacing: '0.15em' }}>ROUND</div>
            <div className="font-display text-xl" style={{ color: cfg.isBoss ? 'var(--gold)' : 'var(--text-primary)' }}>
              {state.round}/6{cfg.isBoss ? ' 👑' : ''}
            </div>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: state.maxLives }).map((_, i) => (
              <span key={i} className="text-lg" style={{ opacity: i < state.lives ? 1 : 0.2 }}>❤️</span>
            ))}
          </div>
        </div>

        {/* Center: title */}
        <div className="font-display text-2xl text-glow-gold hidden sm:block" style={{ color: 'var(--gold)' }}>
          EXPLODDS
        </div>

        {/* Right: cash + gems */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="font-mono text-xs" style={{ color: 'var(--text-muted)', letterSpacing: '0.1em' }}>CASH</div>
            <div className="font-mono font-bold" style={{ color: 'var(--gold)' }}>${state.cash}</div>
          </div>
          <div className="text-right">
            <div className="font-mono text-xs" style={{ color: 'var(--text-muted)', letterSpacing: '0.1em' }}>GEMS</div>
            <div className="font-mono font-bold" style={{ color: '#60c0ff' }}>💎 {state.gems}</div>
          </div>
        </div>
      </div>

      <div className="gold-line" />

      {/* ── Main stats row ────────────────────────────────────────────── */}
      <div className="px-4 py-2 flex items-center gap-4">
        {/* Score + progress */}
        <div className="flex-1">
          <div className="flex justify-between font-mono text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
            <span>{state.score.toLocaleString()}</span>
            <span>{targetScore.toLocaleString()}</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-raised)' }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${progress}%`,
                background: progress >= 100
                  ? 'linear-gradient(90deg, var(--green), var(--green-bright))'
                  : 'linear-gradient(90deg, #3b82f6, #60a5fa)',
              }}
            />
          </div>
        </div>

        {/* Multiplier */}
        <div className="text-center shrink-0">
          <div className="font-mono text-xs" style={{ color: 'var(--text-muted)', letterSpacing: '0.1em' }}>MULT</div>
          <div className="font-display text-2xl" style={{ color: '#f97316' }}>
            ×{state.multiplier.toFixed(1)}
          </div>
        </div>
      </div>

      {/* ── Streak meter ─────────────────────────────────────────────── */}
      <div className="px-4 pb-2">
        <div className="flex justify-between font-mono text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
          <span style={{ letterSpacing: '0.15em' }}>STREAK</span>
          {state.streakGuaranteed && (
            <span className="streak-full" style={{ color: 'var(--gold)' }}>✦ NEXT TILE SAFE +3×</span>
          )}
        </div>
        <div className="h-3 rounded-full overflow-hidden" style={{ background: 'var(--bg-raised)' }}>
          <div
            className={`h-full rounded-full transition-all duration-200 ${state.streakMeter >= 100 ? 'streak-full' : ''}`}
            style={{
              width: `${state.streakMeter}%`,
              background: state.streakMeter >= 80
                ? 'linear-gradient(90deg, #dc2626, #f97316)'
                : state.streakMeter >= 50
                ? 'linear-gradient(90deg, var(--green), #f97316)'
                : 'linear-gradient(90deg, var(--green), var(--green-bright))',
            }}
          />
        </div>
      </div>

      {/* ── Scanner toolbar (if scanner is pending) ───────────────────── */}
      {hasScanner && (
        <div className="px-4 pb-2 flex items-center gap-2">
          <button
            onClick={() => scannerActive ? onCancelScanner() : onActivateScanner('row')}
            className="font-mono text-xs px-3 py-1.5 rounded cursor-pointer transition-colors"
            style={{
              background: scannerActive ? 'rgba(59,130,246,0.3)' : 'var(--bg-raised)',
              border: `1px solid ${scannerActive ? '#3b82f6' : 'var(--border)'}`,
              color: scannerActive ? '#60a5fa' : 'var(--text-muted)',
            }}
          >
            🔍 Scanner {scannerActive ? '(active)' : ''}
          </button>
          {scannerActive && (
            <>
              <button onClick={() => onActivateScanner('row')}
                className="font-mono text-xs px-2 py-1 rounded cursor-pointer"
                style={{ background: state.pendingScannerAxis === 'row' ? '#3b82f6' : 'var(--bg-raised)', border: '1px solid var(--border)', color: '#fff' }}>
                ROW →
              </button>
              <button onClick={() => onActivateScanner('col')}
                className="font-mono text-xs px-2 py-1 rounded cursor-pointer"
                style={{ background: state.pendingScannerAxis === 'col' ? '#3b82f6' : 'var(--bg-raised)', border: '1px solid var(--border)', color: '#fff' }}>
                COL ↓
              </button>
              <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>then click a tile</span>
            </>
          )}
        </div>
      )}

      {/* ── Bottom: active relics + consumables ──────────────────────── */}
      {(state.relics.length > 0 || state.consumables.filter(c => c !== 'scanner').length > 0) && (
        <div className="px-4 pb-2 flex flex-wrap gap-1">
          {state.relics.map(r => {
            const def = RELIC_MAP[r];
            return (
              <span key={r} className="font-mono text-xs px-2 py-0.5 rounded"
                style={{ background: 'rgba(200,168,75,0.1)', border: '1px solid rgba(200,168,75,0.3)', color: 'var(--gold)' }}>
                {def.emoji} {def.name}
              </span>
            );
          })}
          {state.consumables.filter(c => c !== 'scanner').map((c, i) => {
            const def = ALL_CONSUMABLES.find(x => x.id === c)!;
            return (
              <span key={`${c}-${i}`} className="font-mono text-xs px-2 py-0.5 rounded"
                style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa' }}>
                {def.emoji} {def.name}
              </span>
            );
          })}
        </div>
      )}

      {/* ── Cashout button (bottom bar) ───────────────────────────────── */}
      <div className="px-4 pb-3 flex items-center justify-between gap-3"
           style={{ borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
        <div className="font-mono text-sm">
          <span style={{ color: 'var(--text-muted)' }}>BET </span>
          <span style={{ color: 'var(--gold)' }}>${state.bet}</span>
          {hasCashout && (
            <span style={{ color: 'var(--text-muted)' }}> · {cashoutMult.toFixed(2)}×</span>
          )}
        </div>

        <button
          onClick={onCashout}
          disabled={!hasCashout}
          className={`font-display text-xl px-6 py-2 rounded-xl transition-all duration-200 ${hasCashout ? 'cashout-active cursor-pointer' : 'cursor-not-allowed'}`}
          style={{
            letterSpacing: '0.08em',
            background: hasCashout ? 'var(--green)' : 'var(--bg-card)',
            color: hasCashout ? '#000' : 'var(--text-dim)',
            border: hasCashout ? '1px solid var(--green-bright)' : '1px solid var(--border)',
          }}
        >
          {hasCashout ? `CASHOUT $${totalPayout}` : 'NEED MORE SCORE'}
        </button>
      </div>
    </div>
  );
}
