import { useEffect, useRef, useState } from 'react';
import type { ResultsBreakdown } from '../types';

interface Props {
  breakdown: ResultsBreakdown;
  onContinue: () => void;
}

type Line = { kind: 'cash' | 'ticket'; label: string; amount: number };

const LINE_STAGGER_MS = 500;
const LINE_COUNT_MS = 320;
const POST_LINES_PAUSE_MS = 350;
const FLY_MS = 550;
const PULSE_MS = 400;

// Docked over the RIGHT rail (not full-screen) so the freshly revealed board
// stays visible while the numbers count up — the player asked to study what
// they left on the table.
// Shown after every cashout, before advancing to BET/Shop/Game-Over (whichever
// handleCashout already resolved into pending_next_phase). Reveals each cash/ticket
// line one at a time (typewriter-style), counting that line's own value up and
// folding it into the center "TOTAL WON" as it lands, THEN flies the final total
// into the wallet/ticket stat cards which pulse and update — so a player watching
// closely sees exactly where each dollar/ticket came from, in order, before the
// summary lands. Clicking CONTINUE early skips straight to the final state.
export function ResultsOverlay({ breakdown, onContinue }: Props) {
  const lines: Line[] = [
    ...breakdown.cashLines.map((l) => ({ kind: 'cash' as const, label: l.label, amount: l.amount })),
    ...breakdown.ticketLines.map((l) => ({ kind: 'ticket' as const, label: l.label, amount: l.amount })),
  ];

  const [visibleCount, setVisibleCount] = useState(0);
  const [lineDisplay, setLineDisplay] = useState<number[]>(() => lines.map(() => 0));
  const [runningCash, setRunningCash] = useState(0);
  const [walletDisplay, setWalletDisplay] = useState(breakdown.walletBefore);
  const [ticketsDisplay, setTicketsDisplay] = useState(breakdown.ticketsBefore);
  const [pulseWallet, setPulseWallet] = useState(false);
  const [pulseTickets, setPulseTickets] = useState(false);
  const [flying, setFlying] = useState(false);
  const [sequenceDone, setSequenceDone] = useState(false);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const rafs = useRef<number[]>([]);
  const skipped = useRef(false);

  useEffect(() => {
    skipped.current = false;
    // cashPrefix[i]/ticketPrefix[i] = running total from lines BEFORE index i
    const cashPrefix: number[] = [0];
    const ticketPrefix: number[] = [0];
    for (const l of lines) {
      cashPrefix.push(cashPrefix[cashPrefix.length - 1] + (l.kind === 'cash' ? l.amount : 0));
      ticketPrefix.push(ticketPrefix[ticketPrefix.length - 1] + (l.kind === 'ticket' ? l.amount : 0));
    }

    const finish = () => {
      setWalletDisplay(breakdown.walletAfter);
      setPulseWallet(true);
      setFlying(true);
      timers.current.push(setTimeout(() => setPulseWallet(false), PULSE_MS));
      if (breakdown.ticketTotal !== 0) {
        timers.current.push(setTimeout(() => {
          setTicketsDisplay(breakdown.ticketsAfter);
          setPulseTickets(true);
          timers.current.push(setTimeout(() => setPulseTickets(false), PULSE_MS));
        }, 150));
      } else {
        setTicketsDisplay(breakdown.ticketsAfter);
      }
      timers.current.push(setTimeout(() => setFlying(false), FLY_MS + 250));
      setSequenceDone(true);
    };

    const animateLine = (i: number, done: () => void) => {
      const line = lines[i];
      const start = performance.now();
      const step = (now: number) => {
        if (skipped.current) return;
        const t = Math.min(1, (now - start) / LINE_COUNT_MS);
        const eased = 1 - Math.pow(1 - t, 3);
        const val = line.amount * eased;
        setLineDisplay((prev) => {
          const next = [...prev];
          next[i] = val;
          return next;
        });
        if (line.kind === 'cash') setRunningCash(cashPrefix[i] + val);
        if (t < 1) {
          rafs.current.push(requestAnimationFrame(step));
        } else {
          done();
        }
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
    // Runs once against the breakdown this overlay was mounted with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const skipToEnd = () => {
    skipped.current = true;
    timers.current.forEach(clearTimeout);
    rafs.current.forEach(cancelAnimationFrame);
    timers.current = [];
    rafs.current = [];
    setVisibleCount(lines.length);
    setLineDisplay(lines.map((l) => l.amount));
    setRunningCash(breakdown.cashTotal);
    setWalletDisplay(breakdown.walletAfter);
    setTicketsDisplay(breakdown.ticketsAfter);
    setPulseWallet(false);
    setPulseTickets(false);
    setFlying(false);
    setSequenceDone(true);
  };

  const handleContinue = () => {
    if (!sequenceDone) {
      skipToEnd();
      return;
    }
    onContinue();
  };

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center p-4 overlay-in pointer-events-none"
      style={{ background: 'rgba(4,6,10,0.35)' }}
    >
      {/* Same max width as the table below, so the card sits over the right rail
          of the layout (next to the revealed board), not at the screen edge */}
      <div className="w-full max-w-5xl flex justify-end pointer-events-none">
      <div
        className="card-rise w-full max-w-sm rounded-2xl flex flex-col relative overflow-hidden pointer-events-auto"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
      >
        {/* Wallet / Tickets */}
        <div className="px-6 pt-5 pb-4 flex gap-3">
          <div className={`stat-card flex-1 ${pulseWallet ? 'stat-card-pulse' : ''}`}>
            <div className="font-mono text-xs" style={{ color: 'var(--text-muted)', letterSpacing: '0.1em' }}>💵 WALLET</div>
            <div className="font-display text-2xl leading-none mt-1" style={{ color: 'var(--gold)' }}>
              ${Math.floor(walletDisplay)}
            </div>
          </div>
          <div className={`stat-card flex-1 ${pulseTickets ? 'stat-card-pulse' : ''}`}>
            <div className="font-mono text-xs" style={{ color: 'var(--text-muted)', letterSpacing: '0.1em' }}>🎫 TICKETS</div>
            <div className="font-display text-2xl leading-none mt-1" style={{ color: '#60c0ff' }}>
              {ticketsDisplay}
            </div>
          </div>
        </div>

        {/* Center counter */}
        <div
          className="flex flex-col items-center py-5"
          style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}
        >
          <div className="font-mono text-xs" style={{ color: 'var(--text-muted)', letterSpacing: '0.15em' }}>TOTAL WON</div>
          <div className="font-display text-4xl mt-1" style={{ color: 'var(--green-bright)' }}>
            +${runningCash.toFixed(2)}
          </div>
          {flying && (
            <div
              className="fly-to-card font-display text-2xl"
              style={{ top: 90, color: 'var(--gold-bright)' }}
            >
              +${breakdown.cashTotal.toFixed(2)}
            </div>
          )}
        </div>

        {/* Itemized breakdown — revealed one line at a time */}
        <div className="px-6 py-4 flex flex-col gap-2 min-h-[2rem]">
          {lines.slice(0, visibleCount).map((l, i) => (
            <div key={`${l.kind}-${i}`} className="card-rise">
              {l.kind === 'cash' ? (
                <ResultRow
                  label={l.label}
                  value={`${l.amount >= 0 ? '+' : '−'}$${Math.abs(lineDisplay[i]).toFixed(2)}`}
                  color={l.amount >= 0 ? 'var(--green-bright)' : 'var(--red)'}
                />
              ) : (
                <ResultRow label={l.label} value={`+${Math.round(lineDisplay[i])} 🎫`} color="#60c0ff" />
              )}
            </div>
          ))}
        </div>

        <div className="px-6 py-4" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            onClick={handleContinue}
            className="w-full font-display text-xl py-3 rounded-xl cursor-pointer transition-all duration-150 glow-green"
            style={{ background: 'var(--green)', color: '#000', letterSpacing: '0.08em' }}
          >
            CONTINUE
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}

function ResultRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex justify-between font-mono text-sm">
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ color, fontWeight: 700 }}>{value}</span>
    </div>
  );
}
