import type { GameState } from '../types';
import { LEVELS } from '../constants';

interface Props {
  state: GameState;
  onRestart: () => void;
}

export function GameOver({ state, onRestart }: Props) {
  const isWin = state.level > 6;
  const reached = isWin ? 6 : state.level;
  const unlockCurrency = calcUnlockCurrency(reached, state.totalMoneyEarned);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8 p-8">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-4">{isWin ? '🏆' : '💥'}</div>
        <h1 className="text-4xl font-black text-white mb-2">
          {isWin ? 'You Won!' : 'Game Over'}
        </h1>
        <p className="text-gray-400 text-lg">
          {isWin
            ? 'You conquered all 6 levels!'
            : `Reached Level ${reached}`
          }
        </p>
      </div>

      {/* Stats */}
      <div className="w-full max-w-sm flex flex-col gap-3">
        <StatRow label="Level Reached" value={`${reached} / 6`} color="text-purple-400" />
        <StatRow label="Money Earned" value={`$${state.totalMoneyEarned}`} color="text-yellow-400" />
        <StatRow label="Relics Collected" value={`${state.relics.length}`} color="text-blue-400" />
        <StatRow label="Unlock Currency" value={`⚙ ${unlockCurrency}`} color="text-orange-400" />
      </div>

      {/* Level breakdown */}
      <div className="w-full max-w-sm">
        <div className="text-xs text-gray-500 uppercase tracking-widest mb-3 text-center">Level Targets</div>
        <div className="grid grid-cols-3 gap-2">
          {LEVELS.map(l => {
            const cleared = l.level < reached || (l.level === reached && isWin);
            const current = l.level === reached && !isWin;
            return (
              <div
                key={l.level}
                className={`p-2 rounded-lg border text-center text-xs
                  ${cleared ? 'bg-green-900/40 border-green-700 text-green-400'
                    : current ? 'bg-red-900/40 border-red-700 text-red-400'
                    : 'bg-gray-900 border-gray-800 text-gray-600'
                  }`}
              >
                <div className="font-bold">Lv {l.level}</div>
                <div>{cleared ? '✓' : current ? '✗' : '—'}</div>
              </div>
            );
          })}
        </div>
      </div>

      <button
        onClick={onRestart}
        className="px-8 py-4 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xl rounded-xl transition-colors shadow-lg shadow-purple-500/20 cursor-pointer"
      >
        Play Again
      </button>
    </div>
  );
}

function StatRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex justify-between items-center p-3 bg-gray-900 border border-gray-800 rounded-lg">
      <span className="text-gray-400 text-sm">{label}</span>
      <span className={`font-bold ${color}`}>{value}</span>
    </div>
  );
}

function calcUnlockCurrency(levelReached: number, moneyEarned: number): number {
  return levelReached * 10 + Math.floor(moneyEarned / 5);
}
