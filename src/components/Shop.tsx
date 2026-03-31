import { useState } from 'react';
import type { GameState, ConsumableId, RelicId } from '../types';

interface Props {
  state: GameState;
  onBuyConsumable: (id: ConsumableId) => void;
  onBuyRelic: (id: RelicId) => void;
  onRerollConsumables: () => void;
  onRerollRelics: () => void;
  onNextRound: () => void;
}

export function Shop({ state, onBuyConsumable, onBuyRelic, onRerollConsumables, onRerollRelics, onNextRound }: Props) {
  const [tab, setTab] = useState<'consumables' | 'relics'>('consumables');
  const nextRound = state.round + 1;
  const hasNextRound = nextRound <= 6;

  return (
    <div className="min-h-screen flex flex-col max-w-lg mx-auto p-4 gap-4">
      {/* Header */}
      <div className="text-center pt-4">
        <div className="font-display text-3xl" style={{ color: 'var(--gold)', letterSpacing: '0.1em' }}>SHOP</div>
        <div className="flex justify-center gap-6 font-mono text-sm mt-2">
          <span style={{ color: 'var(--gold)' }}>💵 ${state.cash}</span>
          <span style={{ color: '#60c0ff' }}>💎 {state.gems} gems</span>
          <span style={{ color: 'var(--text-muted)' }}>💎 {state.gems} gems</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        {(['consumables', 'relics'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 py-2.5 font-display text-lg transition-colors cursor-pointer"
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

      {/* Consumables tab */}
      {tab === 'consumables' && (
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <div className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
              Buy with 💵 Cash
            </div>
            {!state.shopRerollUsed && (
              <button
                onClick={onRerollConsumables}
                className="font-mono text-xs px-3 py-1 rounded cursor-pointer"
                style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
              >
                🔄 Reroll ($10)
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {state.shopConsumables.map(item => (
              <ShopCard
                key={item.id}
                emoji={item.emoji}
                name={item.name}
                desc={item.description}
                cost={`$${item.price}`}
                canAfford={!item.sold && state.cash >= item.price}
                sold={item.sold}
                currency="cash"
                onClick={() => onBuyConsumable(item.id as ConsumableId)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Relics tab */}
      {tab === 'relics' && (
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <div className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
              Buy with 💎 Gems · {state.relics.length}/6 active
            </div>
            {!state.relicRerollUsed && (
              <button
                onClick={onRerollRelics}
                className="font-mono text-xs px-3 py-1 rounded cursor-pointer"
                style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
              >
                🔄 Reroll (3💎)
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {state.shopRelics.map(item => (
              <ShopCard
                key={item.id}
                emoji={item.emoji}
                name={item.name}
                desc={item.description}
                cost={`${item.cost}💎`}
                canAfford={!item.sold && !item.owned && state.gems >= item.cost && state.relics.length < 6}
                sold={item.sold || item.owned}
                soldLabel={item.owned ? 'OWNED' : 'SOLD'}
                currency="gems"
                onClick={() => onBuyRelic(item.id as RelicId)}
              />
            ))}
          </div>
          {state.relics.length >= 6 && (
            <div className="font-mono text-xs text-center" style={{ color: 'var(--text-muted)' }}>
              Relic slots full (6/6)
            </div>
          )}
        </div>
      )}

      <div className="flex-1" />

      {/* Active relics reminder */}
      {state.relics.length > 0 && (
        <div className="font-mono text-xs" style={{ color: 'var(--text-dim)' }}>
          Active: {state.relics.join(', ')}
        </div>
      )}

      {/* Continue button */}
      <button
        onClick={onNextRound}
        className="w-full font-display text-2xl py-4 rounded-xl cursor-pointer transition-all duration-200"
        style={{
          background: 'var(--green)',
          color: '#000',
          letterSpacing: '0.08em',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--green-bright)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'var(--green)')}
      >
        {hasNextRound ? `→ ROUND ${nextRound}` : '→ FINAL RESULTS'}
      </button>
    </div>
  );
}

function ShopCard({ emoji, name, desc, cost, canAfford, sold, soldLabel = 'SOLD', currency, onClick }: {
  emoji: string; name: string; desc: string; cost: string;
  canAfford: boolean; sold: boolean; soldLabel?: string;
  currency: 'cash' | 'gems'; onClick: () => void;
}) {
  const borderColor = sold ? 'var(--border)' : canAfford
    ? (currency === 'gems' ? 'rgba(96,192,255,0.4)' : 'rgba(200,168,75,0.4)')
    : 'var(--border)';

  return (
    <div
      className="casino-panel p-3 flex flex-col gap-2 rounded-xl"
      style={{ border: `1px solid ${borderColor}`, opacity: sold ? 0.5 : 1 }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{emoji}</span>
          <div>
            <div className="font-display text-sm" style={{ color: 'var(--text-primary)', letterSpacing: '0.05em' }}>
              {name.toUpperCase()}
            </div>
            <div className="font-mono text-lg font-bold" style={{ color: currency === 'gems' ? '#60c0ff' : 'var(--gold)' }}>
              {cost}
            </div>
          </div>
        </div>
      </div>
      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{desc}</div>
      <button
        onClick={onClick}
        disabled={!canAfford || sold}
        className="font-mono text-xs py-1.5 rounded transition-colors cursor-pointer mt-auto"
        style={{
          background: sold ? 'var(--bg-raised)'
            : canAfford ? (currency === 'gems' ? 'rgba(96,192,255,0.2)' : 'rgba(200,168,75,0.2)')
            : 'var(--bg-raised)',
          border: `1px solid ${sold ? 'var(--border)' : canAfford ? borderColor : 'var(--border)'}`,
          color: sold ? 'var(--text-dim)'
            : canAfford ? (currency === 'gems' ? '#60c0ff' : 'var(--gold)')
            : 'var(--text-dim)',
          cursor: canAfford && !sold ? 'pointer' : 'not-allowed',
        }}
      >
        {sold ? soldLabel : canAfford ? 'BUY' : `Need ${cost}`}
      </button>
    </div>
  );
}
