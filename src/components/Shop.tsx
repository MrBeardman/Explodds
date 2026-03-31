import { useState } from 'react';
import type { GameState, ConsumableId, RelicId } from '../types';

interface Props {
  state: GameState;
  onBuyConsumable: (id: ConsumableId) => void;
  onBuyRelic: (id: RelicId) => void;
  onRerollConsumables: () => void;
  onRerollRelics: () => void;
  onNextCycle: () => void;
}

export function Shop({
  state, onBuyConsumable, onBuyRelic,
  onRerollConsumables, onRerollRelics, onNextCycle,
}: Props) {
  const [tab, setTab] = useState<'consumables' | 'relics'>('consumables');

  const nextCycle = state.cycle_number + 1;
  const owed      = Math.max(0, state.deadline - state.deposited);
  const paid      = Math.min(state.deposited, state.deadline);
  // Interest bonus: leftover > 30% of deadline after paying
  const leftover  = state.wallet;
  const interestBonus = leftover > state.deadline * 0.3
    ? Math.floor(leftover * 0.15)
    : 0;

  return (
    /* Bottom-sheet overlay */
    <div
      className="absolute inset-0 z-30 flex flex-col justify-end"
      style={{ background: 'rgba(0,0,0,0.7)' }}
    >
      <div
        className="flex flex-col max-h-[85vh] overflow-hidden rounded-t-2xl"
        style={{ background: 'var(--bg-surface)', borderTop: '1px solid var(--border)' }}
      >
        {/* Header */}
        <div className="p-4 flex flex-col gap-1 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="font-display text-2xl text-center" style={{ color: 'var(--gold)', letterSpacing: '0.1em' }}>
            CYCLE {state.cycle_number} COMPLETE
          </div>
          <div className="flex justify-center gap-6 font-mono text-sm">
            <span style={{ color: 'var(--green)' }}>Paid ${Math.floor(paid)}</span>
            {interestBonus > 0 && (
              <span style={{ color: 'var(--gold)' }}>+${interestBonus} INTEREST ✦</span>
            )}
            {owed > 0 && (
              <span style={{ color: 'var(--red)' }}>Owed ${Math.ceil(owed)}</span>
            )}
          </div>
          <div className="flex justify-center gap-6 font-mono text-sm mt-1">
            <span style={{ color: 'var(--gold)' }}>💵 ${Math.floor(state.wallet)}</span>
            <span style={{ color: '#60c0ff' }}>🎫 {state.tickets}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          {(['consumables', 'relics'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 py-2.5 font-display text-base transition-colors cursor-pointer"
              style={{
                letterSpacing: '0.08em',
                background: tab === t ? 'var(--bg-raised)' : 'var(--bg-surface)',
                color: tab === t ? 'var(--gold)' : 'var(--text-muted)',
                borderBottom: tab === t ? '2px solid var(--gold)' : '2px solid transparent',
              }}
            >
              {t === 'consumables' ? '🎯 CONSUMABLES' : '💎 RELICS'}
            </button>
          ))}
        </div>

        {/* Item list */}
        <div className="flex-1 overflow-y-auto p-4">
          {tab === 'consumables' && (
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
                  Spend 💵 Cash
                </span>
                {!state.shop_consumables_rerolled && (
                  <button
                    onClick={onRerollConsumables}
                    disabled={state.tickets < 2}
                    className="font-mono text-xs px-2 py-1 rounded cursor-pointer"
                    style={{
                      background: 'var(--bg-raised)',
                      border: '1px solid var(--border)',
                      color: state.tickets >= 2 ? 'var(--text-muted)' : 'var(--text-dim)',
                    }}
                  >
                    🔄 Reroll (2🎫)
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {state.shop_consumables.map(item => (
                  <ShopCard
                    key={item.id}
                    emoji={item.emoji}
                    name={item.name}
                    desc={item.description}
                    cost={`$${item.price}`}
                    canAfford={!item.sold && state.wallet >= item.price}
                    sold={item.sold}
                    currency="cash"
                    onClick={() => onBuyConsumable(item.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {tab === 'relics' && (
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
                  Spend 🎫 Tickets · {state.relics.length}/6
                </span>
                {!state.shop_relics_rerolled && (
                  <button
                    onClick={onRerollRelics}
                    disabled={state.tickets < 2}
                    className="font-mono text-xs px-2 py-1 rounded cursor-pointer"
                    style={{
                      background: 'var(--bg-raised)',
                      border: '1px solid var(--border)',
                      color: state.tickets >= 2 ? 'var(--text-muted)' : 'var(--text-dim)',
                    }}
                  >
                    🔄 Reroll (2🎫)
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {state.shop_relics.map(item => (
                  <ShopCard
                    key={item.id}
                    emoji={item.emoji}
                    name={item.name}
                    desc={item.description}
                    cost={`${item.cost}🎫`}
                    canAfford={!item.sold && !item.owned && state.tickets >= item.cost && state.relics.length < 6}
                    sold={item.sold || item.owned}
                    soldLabel={item.owned ? 'OWNED' : 'SOLD'}
                    currency="tickets"
                    onClick={() => onBuyRelic(item.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Continue button */}
        <div className="p-4 shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            onClick={onNextCycle}
            className="w-full font-display text-xl py-3 rounded-xl cursor-pointer transition-all duration-200"
            style={{
              background: 'var(--green)',
              color: '#000',
              letterSpacing: '0.08em',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--green-bright)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--green)')}
          >
            → START CYCLE {nextCycle}
          </button>
        </div>
      </div>
    </div>
  );
}

function ShopCard({
  emoji, name, desc, cost, canAfford, sold, soldLabel = 'SOLD', currency, onClick,
}: {
  emoji: string; name: string; desc: string; cost: string;
  canAfford: boolean; sold: boolean; soldLabel?: string;
  currency: 'cash' | 'tickets'; onClick: () => void;
}) {
  const accentColor = currency === 'tickets' ? 'rgba(96,192,255,0.4)' : 'rgba(200,168,75,0.4)';
  const borderColor = sold ? 'var(--border)' : canAfford ? accentColor : 'var(--border)';

  return (
    <div
      className="casino-panel p-3 flex flex-col gap-2 rounded-xl"
      style={{ border: `1px solid ${borderColor}`, opacity: sold ? 0.5 : 1 }}
    >
      <div className="flex items-center gap-2">
        <span className="text-2xl">{emoji}</span>
        <div>
          <div className="font-display text-xs" style={{ color: 'var(--text-primary)', letterSpacing: '0.05em' }}>
            {name.toUpperCase()}
          </div>
          <div className="font-mono text-sm font-bold" style={{ color: currency === 'tickets' ? '#60c0ff' : 'var(--gold)' }}>
            {cost}
          </div>
        </div>
      </div>
      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{desc}</div>
      <button
        onClick={onClick}
        disabled={!canAfford || sold}
        className="font-mono text-xs py-1.5 rounded transition-colors cursor-pointer mt-auto"
        style={{
          background: sold ? 'var(--bg-raised)' : canAfford ? (currency === 'tickets' ? 'rgba(96,192,255,0.2)' : 'rgba(200,168,75,0.2)') : 'var(--bg-raised)',
          border: `1px solid ${sold ? 'var(--border)' : canAfford ? borderColor : 'var(--border)'}`,
          color: sold ? 'var(--text-dim)' : canAfford ? (currency === 'tickets' ? '#60c0ff' : 'var(--gold)') : 'var(--text-dim)',
          cursor: canAfford && !sold ? 'pointer' : 'not-allowed',
        }}
      >
        {sold ? soldLabel : canAfford ? 'BUY' : `Need ${cost}`}
      </button>
    </div>
  );
}
