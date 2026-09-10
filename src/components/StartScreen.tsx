import logoSrc from '../assets/logo.png';
import { loadMeta, dailyRecord, todayKey, UNLOCKABLES } from '../meta';
import { calcDeadline, DEADLINE_GROWTH, STARTING_WALLET } from '../constants';

interface Props { onStart: () => void; onStartDaily: () => void; onOpenSkills: () => void; }

export function StartScreen({ onStart, onStartDaily, onOpenSkills }: Props) {
  const meta = loadMeta();
  const prestige = meta.prestige_points;
  const daily = dailyRecord(meta);
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
            ['💣', 'Minesweeper board — 5×5, growing to 7×7'],
            ['💵', 'Stake a bet: cash out to keep it + winnings, bust to lose it'],
            ['🔢', 'Every revealed tile shows its adjacent bombs'],
            ['🧠', 'Proven-safe clicks build your multiplier — guesses reset it'],
            ['💳', 'Deposit toward the cycle DEADLINE to advance'],
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
          {[1, 2, 3, 4, 5].map(cycle => ({ cycle, debt: calcDeadline(cycle) })).map(({ cycle, debt }) => (
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
            <div style={{ color: 'var(--red)' }}>×{DEADLINE_GROWTH}</div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex gap-6 text-sm font-mono" style={{ color: 'var(--text-muted)' }}>
        <span>💵 Start ${STARTING_WALLET}</span>
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

      <div className="flex items-center gap-3">
        <button
          onClick={onStartDaily}
          className="chip font-mono text-sm cursor-pointer"
          style={{ color: 'var(--gold)' }}
          title={`Same seed for everyone today (${todayKey()}) — compare cycles survived`}
        >
          📅 DAILY RUN{daily ? ` · best ${daily.best_cycles}` : ''}
        </button>
        <button
          onClick={onOpenSkills}
          className="chip font-mono text-sm cursor-pointer"
          style={{ color: '#c084fc' }}
        >
          🌳 SKILLS {prestige > 0 ? `(✦ ${prestige})` : ''}
        </button>
      </div>

      {/* Cross-run unlocks — feats that add relics to the shop pool */}
      <div className="w-full max-w-sm">
        <div className="font-mono text-xs text-center mb-2" style={{ color: 'var(--text-muted)', letterSpacing: '0.2em' }}>
          UNLOCKS {meta.unlocks.length}/{UNLOCKABLES.length}
        </div>
        <div className="casino-panel p-3 rounded-xl flex flex-col gap-1.5">
          {UNLOCKABLES.map(u => {
            const done = meta.unlocks.includes(u.id);
            return (
              <div key={u.id} className="flex items-center gap-2 font-mono text-xs" style={{ color: done ? 'var(--text-primary)' : 'var(--text-dim)' }}>
                <span className="w-5 text-base" style={{ filter: done ? 'none' : 'grayscale(1) opacity(0.5)' }}>{u.emoji}</span>
                <span className="w-24 shrink-0" style={{ color: done ? 'var(--gold)' : 'var(--text-muted)' }}>{u.name}</span>
                <span className="truncate">{done ? 'unlocked' : u.requirement}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
