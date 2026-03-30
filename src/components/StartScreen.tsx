import { LEVELS } from '../constants';

interface Props {
  onStart: () => void;
}

export function StartScreen({ onStart }: Props) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8 p-8">
      <div className="text-center">
        <div className="text-6xl mb-4">💣</div>
        <h1 className="text-5xl font-black text-white tracking-tight mb-2">
          Explodds
        </h1>
        <div className="text-yellow-400 font-semibold text-xl mb-4">Mine the Odds</div>
        <p className="text-gray-400 max-w-sm mx-auto text-sm leading-relaxed">
          A roguelite minesweeper. Clear tiles, build your multiplier, cash out before you blow up.
          Survive 6 levels to win.
        </p>
      </div>

      {/* Level preview */}
      <div className="w-full max-w-sm">
        <div className="text-xs text-gray-500 uppercase tracking-widest mb-3 text-center">6 Levels</div>
        <div className="flex flex-col gap-1.5">
          {LEVELS.map(l => (
            <div key={l.level} className="flex items-center justify-between px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm">
              <span className="text-gray-400">Lv {l.level}</span>
              <span className="text-gray-300">{l.target.toLocaleString()} pts</span>
              <span className="text-red-400">💣 ×{l.bombs}</span>
              <span className="text-yellow-400">${l.payout}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col items-center gap-3">
        <div className="flex gap-6 text-sm text-gray-500">
          <span>❤️ 3 lives</span>
          <span>💰 Start $0</span>
          <span>🎯 5×5 grid</span>
        </div>
        <button
          onClick={onStart}
          className="px-10 py-4 bg-purple-600 hover:bg-purple-500 text-white font-black text-2xl rounded-xl transition-all shadow-lg shadow-purple-500/30 cursor-pointer hover:scale-105 active:scale-95"
        >
          Start Run
        </button>
      </div>
    </div>
  );
}
