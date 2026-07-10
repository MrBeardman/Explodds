import { BackToMenuButton } from '../../components/BackToMenuButton';
import { loadDigMeta } from '../digMeta';

interface Props {
  onDig: () => void;
  onOpenUpgrades: () => void;
  onBackToMenu: () => void;
}

// Mirrors StartScreen.tsx's layout — Incremental mode's own home screen.
export function DigHomeScreen({ onDig, onOpenUpgrades, onBackToMenu }: Props) {
  const meta = loadDigMeta();

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center gap-8 p-6">
      <div className="absolute top-4 right-4">
        <BackToMenuButton hasProgress={false} onConfirm={onBackToMenu} />
      </div>

      <div className="text-center">
        <div className="text-7xl mb-2">⛏️</div>
        <div className="font-display text-3xl" style={{ color: '#f0a860', letterSpacing: '0.1em' }}>
          THE DIG
        </div>
        <div className="font-mono text-sm tracking-[0.3em] mt-2" style={{ color: 'var(--text-muted)' }}>
          HOW DEEP CAN YOU GO?
        </div>
      </div>

      <div className="gold-line w-64" />

      <div className="w-full max-w-sm flex flex-col gap-3">
        <div className="font-mono text-xs text-center" style={{ color: 'var(--text-muted)', letterSpacing: '0.2em' }}>
          HOW IT WORKS
        </div>
        <div className="casino-panel p-4 flex flex-col gap-2.5 rounded-xl">
          {[
            ['⛏️', 'Click tiles to dig — dirt pays cash, bombs end the run'],
            ['⛏️', 'Limited durability per run — 1 spent per click'],
            ['💰', 'Cash dug is yours the instant you dig it'],
            ['🏳️', 'Cash out any time to bank what you have and stop'],
            ['📈', 'Clear a level to descend deeper — bigger, harder boards'],
          ].map(([icon, text]) => (
            <div key={text} className="flex items-center gap-2 font-mono text-xs" style={{ color: 'var(--text-primary)' }}>
              <span className="text-base w-5">{icon}</span>
              <span>{text}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-6 text-sm font-mono" style={{ color: 'var(--text-muted)' }}>
        <span>💰 Lifetime ${meta.lifetime_cash_earned.toFixed(2)}</span>
      </div>

      <button
        onClick={onDig}
        className="font-display text-2xl px-12 py-4 rounded-xl transition-all duration-200 cursor-pointer glow-green"
        style={{ background: 'var(--green)', color: '#000', letterSpacing: '0.1em' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--green-bright)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'var(--green)')}
      >
        DIG
      </button>

      <button
        onClick={onOpenUpgrades}
        className="chip font-mono text-sm cursor-pointer"
        style={{ color: '#f0a860' }}
      >
        ⛏ UPGRADES {meta.cash_balance > 0 ? `(💰 ${meta.cash_balance.toFixed(2)})` : ''}
      </button>
    </div>
  );
}
