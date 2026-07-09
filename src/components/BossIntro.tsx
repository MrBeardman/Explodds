import { BOSS_MAP } from '../constants';
import type { GameState } from '../types';

interface Props {
  state: GameState;
  onConfirm: () => void;
}

// Full-screen boss reveal at the start of every boss cycle (3, 6, 9, …).
// Boss cycles have no event card — the boss rule is the modifier.
export function BossIntro({ state, onConfirm }: Props) {
  if (!state.active_boss) return null;
  const boss = BOSS_MAP[state.active_boss];

  return (
    <div
      className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-7 p-6 overlay-in"
      style={{ background: 'radial-gradient(ellipse at 50% 40%, rgba(90,10,10,0.55), rgba(4,6,10,0.96) 70%)' }}
    >
      <div className="font-mono text-sm" style={{ color: 'var(--red)', letterSpacing: '0.45em' }}>
        ⚠ BOSS CYCLE {state.cycle_number} ⚠
      </div>

      <div className="card-rise flex flex-col items-center gap-4 text-center">
        <span className="text-8xl leading-none">{boss.emoji}</span>
        <div className="font-display text-6xl boss-title" style={{ color: 'var(--red)', letterSpacing: '0.06em' }}>
          {boss.name.toUpperCase()}
        </div>
        <div
          className="font-mono text-sm px-5 py-2.5 rounded-lg"
          style={{ color: 'var(--text-primary)', background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.4)' }}
        >
          {boss.description}
        </div>
      </div>

      <div className="flex gap-8 font-mono text-sm" style={{ color: 'var(--text-muted)' }}>
        <span>💳 DEADLINE <span style={{ color: 'var(--red)' }}>${state.deadline}</span></span>
        <span>🎯 ATTEMPTS <span style={{ color: 'var(--text-primary)' }}>{state.attempts_remaining}</span></span>
        <span>🏆 REWARD <span style={{ color: '#60c0ff' }}>+8🎫</span></span>
      </div>

      <button
        onClick={onConfirm}
        className="font-display text-2xl px-14 py-4 rounded-xl cursor-pointer transition-all duration-200 glow-red"
        style={{ background: 'var(--red)', color: '#fff', letterSpacing: '0.12em', border: '1px solid rgba(255,120,120,0.5)' }}
        onMouseEnter={e => (e.currentTarget.style.background = '#ef4444')}
        onMouseLeave={e => (e.currentTarget.style.background = 'var(--red)')}
      >
        FACE THE BOSS
      </button>
    </div>
  );
}
