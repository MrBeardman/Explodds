import logoSrc from '../assets/logo.png';
import { loadMeta } from '../meta';

interface Props { onStart: () => void; onOpenSkills: () => void; }

export function StartScreen({ onStart, onOpenSkills }: Props) {
  const prestige = loadMeta().prestige_points;
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 p-6">
      {/* Title — logo art has black padding baked in, crop it with a window */}
      <div className="text-center">
        <div className="overflow-hidden flex items-center justify-center mx-auto" style={{ height: 150, maxWidth: 560 }}>
          <img
            src={logoSrc}
            alt="EXPLODDS"
            className="w-full"
            style={{ filter: 'drop-shadow(0 0 24px rgba(200,120,40,0.35))' }}
          />
        </div>
        <div className="font-mono text-sm tracking-[0.3em] mt-2" style={{ color: 'var(--text-muted)' }}>
          MINE THE ODDS
        </div>
      </div>

      <div className="gold-line w-64" />

      {/* How to play */}
      <div className="w-full max-w-sm flex flex-col gap-3">
        <div className="font-mono text-xs text-center" style={{ color: 'var(--text-muted)', letterSpacing: '0.2em' }}>
          HOW IT WORKS
        </div>
        <div className="casino-panel p-4 flex flex-col gap-2.5 rounded-xl">
          {[
            ['💣', 'Mines field with 5×5 grid'],
            ['💵', 'Bet before each board — bet lost on bust'],
            ['🎯', 'Earn cash per tile cleared'],
            ['🔢', 'Empty tiles show # of adjacent bombs'],
            ['💳', 'Pay off your cycle DEADLINE to advance'],
            ['3️⃣', '3 attempts per cycle (bust = attempt used)'],
            ['🎫', 'Earn tickets → spend on relics in shop'],
          ].map(([icon, text]) => (
            <div key={text} className="flex items-center gap-2 font-mono text-xs" style={{ color: 'var(--text-primary)' }}>
              <span className="text-base w-5">{icon}</span>
              <span>{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Deadlines preview */}
      <div className="w-full max-w-sm">
        <div className="font-mono text-xs text-center mb-2" style={{ color: 'var(--text-muted)', letterSpacing: '0.2em' }}>
          CYCLE DEADLINES
        </div>
        <div className="flex justify-center gap-2 font-mono text-xs">
          {[
            { cycle: 1, debt: 80 },
            { cycle: 2, debt: 140 },
            { cycle: 3, debt: 190 },
            { cycle: 4, debt: 280 },
            { cycle: 5, debt: 400 },
          ].map(({ cycle, debt }) => (
            <div
              key={cycle}
              className="flex flex-col items-center p-2 rounded-lg"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
              <div style={{ color: 'var(--text-muted)' }}>C{cycle}</div>
              <div style={{ color: 'var(--red)' }}>${debt}</div>
            </div>
          ))}
          <div
            className="flex flex-col items-center p-2 rounded-lg"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            <div style={{ color: 'var(--text-muted)' }}>6+</div>
            <div style={{ color: 'var(--red)' }}>×1.3</div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex gap-6 text-sm font-mono" style={{ color: 'var(--text-muted)' }}>
        <span>💵 Start $150</span>
        <span>🎯 3 attempts</span>
        <span>🎫 Earn tickets</span>
      </div>

      <button
        onClick={onStart}
        className="font-display text-2xl px-12 py-4 rounded-xl transition-all duration-200 cursor-pointer glow-green"
        style={{ background: 'var(--green)', color: '#000', letterSpacing: '0.1em' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--green-bright)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'var(--green)')}
      >
        NEW RUN
      </button>

      <button
        onClick={onOpenSkills}
        className="chip font-mono text-sm cursor-pointer"
        style={{ color: '#c084fc' }}
      >
        🌳 SKILLS {prestige > 0 ? `(✦ ${prestige})` : ''}
      </button>
    </div>
  );
}
