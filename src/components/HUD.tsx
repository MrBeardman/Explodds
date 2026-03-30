import { LEVELS } from '../constants';
import type { GameState } from '../types';

interface Props {
  state: GameState;
  onCashout: () => void;
}

export function HUD({ state, onCashout }: Props) {
  const levelConfig = LEVELS[state.level - 1];
  const progressPct = Math.min(100, (state.score / levelConfig.target) * 100);

  return (
    <div className="flex flex-col gap-3 p-4 bg-gray-900 border border-gray-700 rounded-xl">
      {/* Top row */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Money */}
        <div className="flex items-center gap-2">
          <span className="text-yellow-400 text-xl">💰</span>
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-widest">Money</div>
            <div className="text-2xl font-bold text-yellow-400">${state.money}</div>
          </div>
        </div>

        {/* Level */}
        <div className="text-center">
          <div className="text-xs text-gray-400 uppercase tracking-widest">Level</div>
          <div className="text-2xl font-bold text-purple-400">{state.level} / 6</div>
        </div>

        {/* Lives */}
        <div className="text-center">
          <div className="text-xs text-gray-400 uppercase tracking-widest">Lives</div>
          <div className="flex gap-1 mt-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <span key={i} className={`text-xl ${i < state.lives ? 'opacity-100' : 'opacity-20'}`}>
                ❤️
              </span>
            ))}
          </div>
        </div>

        {/* Multiplier */}
        <div className="text-center">
          <div className="text-xs text-gray-400 uppercase tracking-widest">Multiplier</div>
          <div className="text-2xl font-bold text-orange-400">{state.multiplier.toFixed(1)}×</div>
        </div>
      </div>

      {/* Score progress */}
      <div>
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-300">
            Score: <span className="font-bold text-white">{state.score.toLocaleString()}</span>
          </span>
          <span className="text-gray-400">
            Target: <span className="text-gray-200">{levelConfig.target.toLocaleString()}</span>
          </span>
        </div>
        <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              progressPct >= 100 ? 'bg-green-500' : 'bg-blue-500'
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Cashout button */}
      <button
        onClick={onCashout}
        disabled={!state.canCashout}
        className={`w-full py-3 rounded-lg font-bold text-lg transition-all duration-200 ${
          state.canCashout
            ? 'bg-green-500 hover:bg-green-400 text-black shadow-lg shadow-green-500/30 cursor-pointer'
            : 'bg-gray-800 text-gray-600 cursor-not-allowed'
        }`}
      >
        {state.canCashout ? '💸 CASH OUT' : 'Need more score to cash out'}
      </button>

      {/* Active relics / consumables */}
      {(state.relics.length > 0 || state.consumables.length > 0) && (
        <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-800">
          {state.relics.map(r => (
            <RelicBadge key={r} id={r} />
          ))}
          {state.consumables.map((c, i) => (
            <ConsumableBadge key={`${c}-${i}`} id={c} />
          ))}
        </div>
      )}
    </div>
  );
}

const RELIC_ICONS: Record<string, string> = {
  greed_chip: '🪙',
  adrenaline_core: '⚡',
  safety_net: '🛡',
  double_down: '🎯',
  dead_mans_hand: '💀',
  cartographer: '🗺',
};

const CONSUMABLE_ICONS: Record<string, string> = {
  scatter_reveal: '✨',
  scanner: '🔍',
  defuser: '🔧',
  multiplier_lens: '🔬',
};

function RelicBadge({ id }: { id: string }) {
  return (
    <span className="px-2 py-0.5 bg-purple-900/60 border border-purple-700 rounded text-xs text-purple-300">
      {RELIC_ICONS[id] ?? '◆'} {id.replace(/_/g, ' ')}
    </span>
  );
}

function ConsumableBadge({ id }: { id: string }) {
  return (
    <span className="px-2 py-0.5 bg-blue-900/60 border border-blue-700 rounded text-xs text-blue-300">
      {CONSUMABLE_ICONS[id] ?? '◇'} {id.replace(/_/g, ' ')}
    </span>
  );
}
