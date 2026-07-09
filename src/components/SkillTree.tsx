import { useState } from 'react';
import { SKILLS, maxSkillLevel, loadMeta, upgradeSkill } from '../meta';
import type { MetaProgress } from '../meta';
import type { SkillId } from '../types';

interface Props {
  onClose: () => void;
}

// Start-screen overlay for spending prestige points (earned per run, based on
// cycles_survived) on permanent, cross-run skill upgrades. Reads/writes
// src/meta.ts's localStorage store directly — this has no relationship to the
// in-run GameState, which only ever reads a snapshot of it at run start.
export function SkillTree({ onClose }: Props) {
  const [meta, setMeta] = useState<MetaProgress>(() => loadMeta());

  const handleUpgrade = (id: SkillId) => {
    setMeta(upgradeSkill(id));
  };

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center p-4 overlay-in"
      style={{ background: 'rgba(4,6,10,0.9)' }}
    >
      <div
        className="card-rise w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl flex flex-col"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
      >
        <div className="px-6 pt-5 pb-4 text-center" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="font-display text-2xl" style={{ color: 'var(--gold)', letterSpacing: '0.1em' }}>
            SKILL TREE
          </div>
          <div className="font-mono text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            Permanent upgrades, carried across every run
          </div>
          <div className="chip font-mono text-sm mt-3 inline-flex" style={{ color: '#c084fc' }}>
            ✦ {meta.prestige_points} PRESTIGE
          </div>
        </div>

        <div className="px-6 py-4 flex flex-col gap-3">
          {SKILLS.map(skill => {
            const level = meta.skills[skill.id] ?? 0;
            const max = maxSkillLevel(skill.id);
            const maxed = level >= max;
            const next = !maxed ? skill.levels[level + 1] : null;
            const current = skill.levels[level];
            const affordable = next !== null && meta.prestige_points >= next.cost;

            return (
              <div
                key={skill.id}
                className="p-3 rounded-xl flex flex-col gap-2"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl leading-none">{skill.emoji}</span>
                  <span className="font-mono text-sm font-bold flex-1" style={{ color: 'var(--text-primary)' }}>
                    {skill.name}
                  </span>
                  <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
                    LV {level} / {max}
                  </span>
                </div>

                <div className="font-mono text-xs" style={{ color: 'var(--text-dim)' }}>
                  Now: {current.name} — {current.description}
                </div>

                {next && (
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 font-mono text-xs" style={{ color: '#60a5fa' }}>
                      Next: {next.name} — {next.description}
                    </div>
                    <button
                      onClick={() => handleUpgrade(skill.id)}
                      disabled={!affordable}
                      className={`font-mono text-xs px-3 py-1.5 rounded shrink-0 ${affordable ? 'cursor-pointer' : 'cursor-default'}`}
                      style={{
                        background: affordable ? '#c084fc' : 'var(--bg-raised)',
                        border: '1px solid var(--border)',
                        color: affordable ? '#000' : 'var(--text-dim)',
                        fontWeight: 700,
                      }}
                    >
                      UPGRADE {next.cost}✦
                    </button>
                  </div>
                )}
                {maxed && (
                  <div className="font-mono text-xs" style={{ color: 'var(--gold)' }}>MAXED ✦</div>
                )}
              </div>
            );
          })}
        </div>

        <div className="px-6 py-4" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            onClick={onClose}
            className="w-full font-display text-lg py-3 rounded-xl cursor-pointer transition-all duration-150"
            style={{ background: 'var(--green)', color: '#000', letterSpacing: '0.08em' }}
          >
            BACK
          </button>
        </div>
      </div>
    </div>
  );
}
