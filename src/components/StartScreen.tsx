import { LEVELS } from '../constants';

interface Props { onStart: () => void; }

export function StartScreen({ onStart }: Props) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 p-6">
      {/* Title */}
      <div className="text-center">
        <div className="font-display text-7xl md:text-9xl text-glow-gold" style={{ color: 'var(--gold)' }}>
          EXPLODDS
        </div>
        <div className="font-mono text-sm tracking-[0.3em] mt-1" style={{ color: 'var(--text-muted)' }}>
          MINE THE ODDS
        </div>
      </div>

      <div className="gold-line w-64" />

      {/* Round preview */}
      <div className="w-full max-w-sm">
        <div className="font-mono text-xs text-center mb-3" style={{ color: 'var(--text-muted)', letterSpacing: '0.2em' }}>
          6 ROUNDS · PLACE BETS · CLEAR TILES
        </div>
        <div className="casino-panel p-1 overflow-hidden rounded-xl">
          {LEVELS.map(l => (
            <div
              key={l.round}
              className="flex items-center justify-between px-3 py-2 text-sm"
              style={{ borderBottom: l.round < 6 ? '1px solid var(--border)' : undefined }}
            >
              <span className="font-mono" style={{ color: l.isBoss ? 'var(--gold)' : 'var(--text-muted)' }}>
                {l.isBoss ? '👑' : '  '} RD {l.round}
              </span>
              <span style={{ color: 'var(--text-primary)' }}>{l.target.toLocaleString()} pts</span>
              <span style={{ color: 'var(--red)' }}>💣 ×{l.bombs}</span>
              <span className="font-mono" style={{ color: l.isBoss ? 'var(--gold)' : 'var(--text-muted)' }}>
                {l.isBoss ? 'BOSS' : ''}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div className="flex gap-6 text-sm font-mono" style={{ color: 'var(--text-muted)' }}>
        <span>💵 Start $150</span>
        <span>❤️ 3 lives</span>
        <span>💎 Earn gems</span>
      </div>

      <button
        onClick={onStart}
        className="font-display text-2xl px-12 py-4 rounded-xl transition-all duration-200 cursor-pointer glow-green"
        style={{
          background: 'var(--green)',
          color: '#000',
          letterSpacing: '0.1em',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--green-bright)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'var(--green)')}
      >
        NEW RUN
      </button>

      <div className="font-mono text-xs" style={{ color: 'var(--text-dim)' }}>
        // TODO: sound
      </div>
    </div>
  );
}
