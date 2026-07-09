import { useState } from 'react';
import {
  ALL_RELICS, ALL_CONSUMABLES, EVENT_CARDS, BOSSES, SYMBOLS,
} from '../constants';
import { SKILLS } from '../meta';
import type { GameState, RelicId, ConsumableId, EventCardId, BossId, SymbolBoost, BoostAxis } from '../types';

interface Props {
  state: GameState;
  debugReveal: boolean;
  onToggleReveal: () => void;
  onPatch: (patch: Partial<GameState>) => void;
  onClose: () => void;
}

// Dev-only testing console — direct state pokes for setting up combo/boss/relic
// scenarios without grinding. Never touched by normal play; gated to dev builds
// in App.tsx (import.meta.env.DEV) before this even renders.
export function DebugPanel({ state, debugReveal, onToggleReveal, onPatch, onClose }: Props) {
  return (
    <div className="absolute inset-0 z-50 flex justify-end pointer-events-none">
      <div
        className="pointer-events-auto w-80 h-full overflow-y-auto p-4 flex flex-col gap-4"
        style={{ background: 'var(--bg-surface)', borderLeft: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-between">
          <span className="font-display text-lg" style={{ color: 'var(--gold)', letterSpacing: '0.08em' }}>🛠 DEBUG</span>
          <button
            onClick={onClose}
            className="font-mono text-xs px-2 py-1 rounded cursor-pointer"
            style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
          >
            CLOSE
          </button>
        </div>

        <Section title="ECONOMY">
          <NumberRow label="Wallet $" value={state.wallet} onSet={v => onPatch({ wallet: v })} />
          <NumberRow label="Tickets" value={state.tickets} onSet={v => onPatch({ tickets: v })} />
        </Section>

        <Section title="CYCLE">
          <NumberRow label="Cycle #" value={state.cycle_number} onSet={v => onPatch({ cycle_number: v })} />
          <NumberRow label="Deadline $" value={state.deadline} onSet={v => onPatch({ deadline: v })} />
          <NumberRow label="Deposited $" value={state.deposited} onSet={v => onPatch({ deposited: v })} />
        </Section>

        <Section title="ATTEMPT">
          <NumberRow label="Multiplier" value={state.multiplier} step={0.1} onSet={v => onPatch({ multiplier: v })} />
          <NumberRow label="Streak" value={state.streak} onSet={v => onPatch({ streak: v })} />
          <NumberRow label="Attempts left" value={state.attempts_remaining} onSet={v => onPatch({ attempts_remaining: v })} />
        </Section>

        <Section title="BOARD">
          <NumberRow
            label="Bombs (next board)"
            value={state.debug_bomb_override ?? 0}
            onSet={v => onPatch({ debug_bomb_override: v })}
          />
          <div className="flex gap-1.5">
            <button
              onClick={() => onPatch({ debug_bomb_override: null })}
              className="flex-1 font-mono text-xs py-1 rounded cursor-pointer"
              style={debugBtnStyle(false)}
            >
              CLEAR OVERRIDE
            </button>
            <button
              onClick={onToggleReveal}
              className="flex-1 font-mono text-xs py-1 rounded cursor-pointer"
              style={debugBtnStyle(debugReveal)}
            >
              {debugReveal ? 'HIDE GHOST VIEW' : 'REVEAL BOARD'}
            </button>
          </div>
          <div className="font-mono text-xs mt-1" style={{ color: 'var(--text-dim)' }}>
            Bomb override applies on the NEXT board dealt. Reveal shows every
            tile's true content as a faint overlay — doesn't change game state.
          </div>
        </Section>

        <Section title="BOSS">
          <div className="flex flex-wrap gap-1.5">
            <BossButton label="None" active={state.active_boss === null} onClick={() => onPatch({ active_boss: null })} />
            {BOSSES.map(b => (
              <BossButton
                key={b.id}
                label={`${b.emoji} ${b.name.replace('The ', '')}`}
                active={state.active_boss === b.id}
                onClick={() => onPatch({ active_boss: b.id as BossId })}
              />
            ))}
          </div>
        </Section>

        <Section title="MODIFIERS (active_events)">
          <div className="flex flex-wrap gap-1.5">
            {EVENT_CARDS.map(c => {
              const active = state.active_events.includes(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => onPatch({
                    active_events: active
                      ? state.active_events.filter(id => id !== c.id)
                      : [...state.active_events, c.id as EventCardId],
                  })}
                  title={c.description}
                  className="font-mono text-xs px-2 py-1 rounded cursor-pointer"
                  style={debugBtnStyle(active)}
                >
                  {c.emoji} {c.name}
                </button>
              );
            })}
          </div>
        </Section>

        <Section title="RELICS">
          <div className="flex flex-wrap gap-1.5">
            {ALL_RELICS.map(r => {
              const owned = state.relics.includes(r.id);
              return (
                <button
                  key={r.id}
                  onClick={() => onPatch({
                    relics: owned
                      ? state.relics.filter(id => id !== r.id)
                      : [...state.relics, r.id as RelicId],
                  })}
                  title={r.description}
                  className="font-mono text-xs px-2 py-1 rounded cursor-pointer"
                  style={debugBtnStyle(owned)}
                >
                  {r.emoji} {r.name}
                </button>
              );
            })}
          </div>
        </Section>

        <Section title="CONSUMABLES (stacking — click to add one)">
          <div className="flex flex-wrap gap-1.5">
            {ALL_CONSUMABLES.map(c => (
              <button
                key={c.id}
                onClick={() => onPatch({ consumables_owned: [...state.consumables_owned, c.id as ConsumableId] })}
                title={c.description}
                className="font-mono text-xs px-2 py-1 rounded cursor-pointer"
                style={debugBtnStyle(false)}
              >
                {c.emoji} {c.name}
              </button>
            ))}
          </div>
          {state.consumables_owned.length > 0 && (
            <button
              onClick={() => onPatch({ consumables_owned: [] })}
              className="font-mono text-xs py-1 rounded cursor-pointer w-full mt-1"
              style={debugBtnStyle(false)}
            >
              CLEAR ALL OWNED
            </button>
          )}
        </Section>

        <Section title="SKILLS (this-run override — real progression is on the Start Screen)">
          <div className="flex flex-col gap-1.5">
            {SKILLS.map(skill => (
              <div key={skill.id} className="flex items-center gap-1.5">
                <span className="font-mono text-xs flex-1" style={{ color: 'var(--text-muted)' }}>
                  {skill.emoji} {skill.name}
                </span>
                {skill.levels.map(l => (
                  <button
                    key={l.level}
                    onClick={() => onPatch({ skills: { ...state.skills, [skill.id]: l.level } })}
                    title={l.description}
                    className="font-mono text-xs px-2 py-1 rounded cursor-pointer"
                    style={debugBtnStyle(state.skills[skill.id] === l.level)}
                  >
                    LV{l.level}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </Section>

        <Section title="SYMBOL BOOSTS (click to add a stack)">
          <div className="flex flex-col gap-1.5">
            {SYMBOLS.map(s => (
              <div key={s.id} className="flex items-center gap-1.5">
                <span className="text-base w-5 text-center">{s.emoji}</span>
                <BoostButton state={state} onPatch={onPatch} symbol={s.id} axis="frequency" label="freq" />
                <BoostButton state={state} onPatch={onPatch} symbol={s.id} axis="payout" label="pay" />
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}

// ─── Shared bits ──────────────────────────────────────────────────────────────

function debugBtnStyle(active: boolean) {
  return {
    background: active ? 'rgba(192,132,252,0.25)' : 'var(--bg-raised)',
    border: `1px solid ${active ? '#c084fc' : 'var(--border)'}`,
    color: active ? '#c084fc' : 'var(--text-muted)',
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

function BoostButton({
  state, onPatch, symbol, axis, label,
}: {
  state: GameState;
  onPatch: (patch: Partial<GameState>) => void;
  symbol: SymbolBoost['symbol'];
  axis: BoostAxis;
  label: string;
}) {
  const stacks = state.boosts.filter(b => b.symbol === symbol && b.axis === axis).length;
  return (
    <button
      onClick={() => onPatch({ boosts: [...state.boosts, { symbol, axis }] })}
      className="flex-1 font-mono text-xs py-1 rounded cursor-pointer"
      style={debugBtnStyle(stacks > 0)}
    >
      {label} {stacks > 0 ? `×${stacks}` : ''}
    </button>
  );
}
