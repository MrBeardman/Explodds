import { useState } from 'react';
import { DIG_UPGRADES } from '../digMeta';
import { loadDigMeta, debugSetDigMeta, debugSetUpgradeOwned, type DigMetaProgress } from '../digMeta';
import { DIG_BOSSES } from '../digBosses';
import type { DigGameState, DigBossId } from '../types';

interface Props {
  state: DigGameState;
  onPatch: (patch: Partial<DigGameState>) => void;
  onClose: () => void;
}

// Dev-only testing console for Incremental mode — mirrors DebugPanel.tsx's
// generic-patch pattern, but as a fully separate component/file (Dig mode's
// meta lives in localStorage via digMeta.ts, not in DigGameState, so this
// panel patches both: DigGameState directly for in-run values, and digMeta.ts
// for persistent upgrade ownership).
export function DigDebugPanel({ state, onPatch, onClose }: Props) {
  const [meta, setMeta] = useState<DigMetaProgress>(() => loadDigMeta());

  const setCash = (v: number) => setMeta(debugSetDigMeta({ cash_balance: v }));

  const toggleUpgrade = (id: keyof DigMetaProgress['upgrades']) => {
    const owned = meta.upgrades[id] > 0;
    const next = debugSetUpgradeOwned(id, !owned);
    setMeta(next);
    // Also patch the CURRENT run's live skills snapshot so the effect is
    // visible immediately without needing to start a fresh dig.
    onPatch({ skills: { ...state.skills, [id]: next.upgrades[id] } });
  };

  return (
    <div className="absolute inset-0 z-50 flex justify-end pointer-events-none">
      <div
        className="pointer-events-auto w-80 h-full overflow-y-auto p-4 flex flex-col gap-4"
        style={{ background: 'var(--bg-surface)', borderLeft: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-between">
          <span className="font-display text-lg" style={{ color: '#f0a860', letterSpacing: '0.08em' }}>🛠 DIG DEBUG</span>
          <button
            onClick={onClose}
            className="font-mono text-xs px-2 py-1 rounded cursor-pointer"
            style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
          >
            CLOSE
          </button>
        </div>

        <Section title="META (persistent, digMeta.ts)">
          <NumberRow label="Cash balance $" value={meta.cash_balance} onSet={setCash} />
          <div className="font-mono text-xs" style={{ color: 'var(--text-dim)' }}>
            Lifetime earned: ${meta.lifetime_cash_earned.toFixed(2)}
          </div>
        </Section>

        <Section title="RUN (this run only, DigGameState)">
          <NumberRow label="Level" value={state.level} onSet={v => onPatch({ level: v })} />
          <NumberRow label="Charges remaining" value={state.chargesRemaining} onSet={v => onPatch({ chargesRemaining: v })} />
          <NumberRow label="Charges max" value={state.chargesMax} onSet={v => onPatch({ chargesMax: v })} />
          <NumberRow label="Banked $" value={state.bankedCash} onSet={v => onPatch({ bankedCash: v })} />
        </Section>

        <Section title="BOSS (forces the CURRENT level's boss)">
          <div className="flex flex-wrap gap-1.5">
            <BossButton label="None" active={state.activeBoss === null} onClick={() => onPatch({ activeBoss: null })} />
            {DIG_BOSSES.map(b => (
              <BossButton
                key={b.id}
                label={`${b.emoji} ${b.name}`}
                active={state.activeBoss === b.id}
                onClick={() => onPatch({ activeBoss: b.id as DigBossId })}
              />
            ))}
          </div>
        </Section>

        <Section title="UPGRADES (bypasses cost/parent gating — writes digMeta AND live-patches this run)">
          <div className="flex flex-col gap-1.5">
            {DIG_UPGRADES.map(u => (
              <button
                key={u.id}
                onClick={() => toggleUpgrade(u.id)}
                className="font-mono text-xs px-2 py-1 rounded cursor-pointer text-left"
                style={debugBtnStyle(meta.upgrades[u.id] > 0)}
              >
                {u.emoji} {u.name} {meta.upgrades[u.id] > 0 ? `(Lv ${meta.upgrades[u.id]}/${u.levels.length})` : ''}
              </button>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}

// ─── Shared bits (small, intentionally duplicated from DebugPanel.tsx's local
// helpers rather than imported — the two debug panels stay fully independent,
// same separation principle as the rest of Incremental mode) ──────────────────

function debugBtnStyle(active: boolean) {
  return {
    background: active ? 'rgba(240,168,96,0.2)' : 'var(--bg-raised)',
    border: `1px solid ${active ? '#f0a860' : 'var(--border)'}`,
    color: active ? '#f0a860' : 'var(--text-muted)',
  };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
      <div className="font-mono text-xs" style={{ color: 'var(--text-dim)', letterSpacing: '0.1em' }}>{title}</div>
      {children}
    </div>
  );
}

function NumberRow({ label, value, step = 1, onSet }: { label: string; value: number; step?: number; onSet: (v: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  return (
    <div className="flex items-center gap-1.5">
      <span className="font-mono text-xs flex-1" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <input
        type="number"
        step={step}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        className="w-20 font-mono text-xs px-1.5 py-1 rounded"
        style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
      />
      <button
        onClick={() => { const n = Number(draft); if (!Number.isNaN(n)) onSet(n); }}
        className="font-mono text-xs px-2 py-1 rounded cursor-pointer"
        style={debugBtnStyle(false)}
      >
        SET
      </button>
    </div>
  );
}

function BossButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="font-mono text-xs px-2 py-1 rounded cursor-pointer" style={debugBtnStyle(active)}>
      {label}
    </button>
  );
}
