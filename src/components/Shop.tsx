import type { GameState, ShopItem } from '../types';

interface Props {
  state: GameState;
  onBuy: (itemId: string) => void;
  onContinue: () => void;
}

export function Shop({ state, onBuy, onContinue }: Props) {
  return (
    <div className="flex flex-col gap-6 p-6 max-w-2xl mx-auto">
      <div className="text-center">
        <div className="text-3xl font-bold text-yellow-400 mb-1">🛒 Shop</div>
        <div className="text-gray-400 text-sm">Level {state.level - 1} cleared! Heading into Level {state.level}.</div>
        <div className="text-yellow-300 font-semibold mt-1">Balance: ${state.money}</div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {state.shopItems.map(item => (
          <ItemCard
            key={item.id}
            item={item}
            canAfford={state.money >= item.price}
            onBuy={() => onBuy(item.id)}
          />
        ))}
        {state.shopItems.length === 0 && (
          <div className="col-span-2 text-center text-gray-500 py-8">All items purchased!</div>
        )}
      </div>

      <button
        onClick={onContinue}
        className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg text-lg transition-colors cursor-pointer"
      >
        Continue to Level {state.level} →
      </button>
    </div>
  );
}

function ItemCard({ item, canAfford, onBuy }: { item: ShopItem; canAfford: boolean; onBuy: () => void }) {
  const typeColor = item.type === 'relic'
    ? 'border-purple-700 bg-purple-950/40'
    : 'border-blue-700 bg-blue-950/40';

  const typeBadge = item.type === 'relic'
    ? 'bg-purple-800/60 text-purple-300'
    : 'bg-blue-800/60 text-blue-300';

  const ICONS: Record<string, string> = {
    greed_chip: '🪙',
    adrenaline_core: '⚡',
    safety_net: '🛡',
    double_down: '🎯',
    dead_mans_hand: '💀',
    cartographer: '🗺',
    scatter_reveal: '✨',
    scanner: '🔍',
    defuser: '🔧',
    multiplier_lens: '🔬',
  };

  return (
    <div className={`flex flex-col gap-3 p-4 rounded-xl border-2 ${typeColor}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{ICONS[item.id] ?? '◆'}</span>
          <div>
            <div className="font-bold text-white">{item.name}</div>
            <span className={`text-xs px-2 py-0.5 rounded ${typeBadge}`}>
              {item.type}
            </span>
          </div>
        </div>
        <div className="text-yellow-400 font-bold text-lg shrink-0">${item.price}</div>
      </div>

      <p className="text-gray-300 text-sm">{item.description}</p>

      <button
        onClick={onBuy}
        disabled={!canAfford}
        className={`mt-auto py-2 rounded-lg font-semibold transition-colors cursor-pointer
          ${canAfford
            ? 'bg-yellow-500 hover:bg-yellow-400 text-black'
            : 'bg-gray-800 text-gray-600 cursor-not-allowed'
          }`}
      >
        {canAfford ? 'Buy' : `Need $${item.price}`}
      </button>
    </div>
  );
}
