import { useEffect, useRef, useState } from 'react';
import type { DigGameState, OreTierId } from '../types';
import { ORE_TIERS } from '../constants';

interface Props {
  state: DigGameState;
  onContinue: () => void;
}

type Line = { tier: OreTierId; label: string; count: number; cash: number };

const LINE_STAGGER_MS = 500;
const LINE_COUNT_MS = 320;
const POST_LINES_PAUSE_MS = 350;

const END_REASON_COPY: Record<string, { title: string; icon: string; color: string }> = {
  bomb: { title: 'STRUCK A BOMB', icon: '💣', color: 'var(--red)' },
  out_of_charges: { title: 'OUT OF CHARGES', icon: '⚡', color: 'var(--gold)' },
  cashed_out: { title: 'CASHED OUT', icon: '🏳️', color: 'var(--green-bright)' },
};

// Ports ResultsOverlay.tsx's typewriter-reveal/count-up pattern (staggered
// per-line reveal, running total climbing in sync) rather than editing that
// component — Standard mode stays untouched, the reveal feel carries over.
export function DigRunOverOverlay({ state, onContinue }: Props) {
  const lines: Line[] = ORE_TIERS
    .map(t => ({ tier: t.id, label: t.name, count: state.minedBanked[t.id].count, cash: state.minedBanked[t.id].cash }))
    .filter(l => l.count > 0);

  const [visibleCount, setVisibleCount] = useState(0);
  const [lineDisplay, setLineDisplay] = useState<number[]>(() => lines.map(() => 0));
  const [runningTotal, setRunningTotal] = useState(0);
  const [sequenceDone, setSequenceDone] = useState(false);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const rafs = useRef<number[]>([]);
  const skipped = useRef(false);

  const finalTotal = state.bankedCash;
  const reason = state.endReason ?? 'cashed_out';
  const copy = END_REASON_COPY[reason];

  useEffect(() => {
    skipped.current = false;
    const cashPrefix: number[] = [0];
    for (const l of lines) cashPrefix.push(cashPrefix[cashPrefix.length - 1] + l.cash);

    const finish = () => setSequenceDone(true);

    const animateLine = (i: number, done: () => void) => {
      const line = lines[i];
      const start = performance.now();
      const step = (now: number) => {
        if (skipped.current) return;
        const t = Math.min(1, (now - start) / LINE_COUNT_MS);
        const eased = 1 - Math.pow(1 - t, 3);
        const val = line.cash * eased;
        setLineDisplay(prev => { const next = [...prev]; next[i] = val; return next; });
        setRunningTotal(cashPrefix[i] + val);
        if (t < 1) rafs.current.push(requestAnimationFrame(step));
        else done();
      };
      rafs.current.push(requestAnimationFrame(step));
    };

    const revealLine = (i: number) => {
      if (i >= lines.length) {
        timers.current.push(setTimeout(finish, POST_LINES_PAUSE_MS));
        return;
      }
      setVisibleCount(i + 1);
      animateLine(i, () => {});
      timers.current.push(setTimeout(() => revealLine(i + 1), LINE_STAGGER_MS));
    };

    revealLine(0);

    return () => {
      skipped.current = true;
      timers.current.forEach(clearTimeout);
      rafs.current.forEach(cancelAnimationFrame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const skipToEnd = () => {
    skipped.current = true;
    timers.current.forEach(clearTimeout);
    rafs.current.forEach(cancelAnimationFrame);
    timers.current = [];
    rafs.current = [];
    setVisibleCount(lines.length);
    setLineDisplay(lines.map(l => l.cash));
    setRunningTotal(finalTotal);
    setSequenceDone(true);
  };

  const handleContinue = () => {
    if (!sequenceDone) { skipToEnd(); return; }
    onContinue();
  };

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center p-4 overlay-in" style={{ background: 'rgba(4,6,10,0.92)' }}>
      <div className="card-rise w-full max-w-sm rounded-2xl flex flex-col relative overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <div className="px-6 pt-5 pb-4 text-center" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="text-3xl mb-1">{copy.icon}</div>
          <div className="font-display text-xl" style={{ color: copy.color, letterSpacing: '0.08em' }}>{copy.title}</div>
          <div className="font-mono text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            Reached level {state.level} · {state.levelsClearedThisRun} level{state.levelsClearedThisRun === 1 ? '' : 's'} cleared
          </div>
        </div>

        <div className="flex flex-col items-center py-5" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="font-mono text-xs" style={{ color: 'var(--text-muted)', letterSpacing: '0.15em' }}>TOTAL BANKED</div>
          <div className="font-display text-4xl mt-1" style={{ color: 'var(--green-bright)' }}>
            ${runningTotal.toFixed(2)}
          </div>
        </div>

        <div className="px-6 py-4 flex flex-col gap-2 min-h-[2rem]">
          {lines.slice(0, visibleCount).map((l, i) => (
            <div key={l.tier} className="card-rise flex justify-between font-mono text-sm">
              <span style={{ color: 'var(--text-muted)' }}>{l.label} ×{l.count}</span>
              <span style={{ color: 'var(--green-bright)', fontWeight: 700 }}>+${lineDisplay[i].toFixed(2)}</span>
            </div>
          ))}
        </div>

        <div className="px-6 py-4" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            onClick={handleContinue}
            className="w-full font-display text-xl py-3 rounded-xl cursor-pointer transition-all duration-150 glow-green"
            style={{ background: 'var(--green)', color: '#000', letterSpacing: '0.08em' }}
          >
            CONTINUE TO UPGRADES
          </button>
        </div>
      </div>
    </div>
  );
}
