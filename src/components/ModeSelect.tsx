import logoSrc from '../assets/logo.png';
import { playSfx } from '../sound';

interface Props {
  onSelectStandard: () => void;
  onSelectIncremental: () => void;
}

// Root screen — picks which of the two games to play. Each mode owns its
// own home screen after this; Standard's is StartScreen.tsx (unchanged),
// Incremental's is DigHomeScreen.tsx.
export function ModeSelect({ onSelectStandard, onSelectIncremental }: Props) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 p-6">
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
          CHOOSE YOUR GAME
        </div>
      </div>

      <div className="flex gap-5 flex-wrap justify-center">
        <button
          onClick={() => { playSfx('click'); onSelectStandard(); }}
          className="choice-card card-rise w-64 p-6 flex flex-col items-center gap-3 text-center"
        >
          <span className="text-6xl leading-none">🎰</span>
          <span className="font-display text-2xl" style={{ color: 'var(--gold)', letterSpacing: '0.06em' }}>
            STANDARD
          </span>
          <span className="font-mono text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            Mine the Odds — bet, clear boards, pay off your cycle deadline, build a run with relics and packs.
          </span>
        </button>

        <button
          onClick={() => { playSfx('click'); onSelectIncremental(); }}
          className="choice-card card-rise w-64 p-6 flex flex-col items-center gap-3 text-center"
          style={{ animationDelay: '90ms' }}
        >
          <span className="text-6xl leading-none">⛏️</span>
          <span className="font-display text-2xl" style={{ color: '#f0a860', letterSpacing: '0.06em' }}>
            THE DIG
          </span>
          <span className="font-mono text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            Dig as deep as you can before you run out of charges or hit a bomb. Cash out any time — spend what you earn on permanent upgrades.
          </span>
        </button>
      </div>
    </div>
  );
}
