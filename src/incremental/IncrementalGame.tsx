import { useEffect, useReducer, useRef, useState } from 'react';
import type { DigGameState } from './types';
import { createInitialDigState, startDig, handleDigTileClick, handleCashOut, backToDigHome } from './digLogic';
import { awardRunCash } from './digMeta';
import { isDigCheckpointLevel } from './constants';
import { playSfx } from '../sound';
import { BackToMenuButton } from '../components/BackToMenuButton';
import { DigHomeScreen } from './components/DigHomeScreen';
import { DigUpgradeTree } from './components/DigUpgradeTree';
import { DigGrid } from './components/DigGrid';
import { DigHUD } from './components/DigHUD';
import { DigRunOverOverlay } from './components/DigRunOverOverlay';
import { DigDebugPanel } from './components/DigDebugPanel';

// Reducer stays pure — this hook diffs consecutive states and plays SFX,
// mirroring StandardGame.tsx's useSounds hook.
function useDigSounds(state: DigGameState) {
  const prev = useRef(state);

  useEffect(() => {
    const p = prev.current;
    prev.current = state;
    if (p === state) return;

    if (p.phase !== state.phase) {
      if (state.phase === 'DIGGING' && p.phase === 'HOME') playSfx('reveal', { volume: 0.4 });
      if (state.phase === 'RUN_OVER') {
        if (state.endReason === 'bomb') playSfx('bomb', { volume: 0.6 });
        else if (state.endReason === 'cashed_out') playSfx('cashout', { volume: 0.55 });
        else playSfx('gameover', { volume: 0.5 });
      }
    }

    if (state.phase === 'DIGGING' && p.phase === 'DIGGING' && state.level > p.level) {
      playSfx('reveal', { volume: 0.4 });
      if (isDigCheckpointLevel(state.level)) playSfx('boss', { volume: 0.5 });
    }

    if (state.phase === 'DIGGING' && p.phase === 'DIGGING' && state.level === p.level) {
      const dirtNow = state.board.filter(t => t.type === 'dirt' && t.state === 'revealed').length;
      const dirtPrev = p.board.filter(t => t.type === 'dirt' && t.state === 'revealed').length;
      if (dirtNow > dirtPrev) playSfx('symbol', { volume: 0.5 });

      const emptyNow = state.board.filter(t => t.type === 'empty' && t.state === 'revealed').length;
      const emptyPrev = p.board.filter(t => t.type === 'empty' && t.state === 'revealed').length;
      if (emptyNow > emptyPrev) playSfx('empty', { volume: 0.35 });
    }
  }, [state]);
}

type DigAction =
  | { type: 'START_DIG' }
  | { type: 'DIG_TILE_CLICK'; index: number }
  | { type: 'CASH_OUT' }
  | { type: 'BACK_TO_HOME' }
  | { type: 'DEBUG_PATCH'; patch: Partial<DigGameState> };

function digReducer(state: DigGameState, action: DigAction): DigGameState {
  switch (action.type) {
    case 'START_DIG': return startDig(state);
    case 'DIG_TILE_CLICK': return handleDigTileClick(state, action.index);
    case 'CASH_OUT': return handleCashOut(state);
    case 'BACK_TO_HOME': return backToDigHome(state);
    case 'DEBUG_PATCH': return { ...state, ...action.patch };
    default: return state;
  }
}

export function IncrementalGame({ onBackToMenu }: { onBackToMenu: () => void }) {
  const [state, dispatch] = useReducer(digReducer, undefined, createInitialDigState);
  const cashAwarded = useRef(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [showUpgrades, setShowUpgrades] = useState(false);

  useDigSounds(state);

  // Award banked cash to the persistent meta store exactly once when a run ends
  // — a side effect (localStorage write), kept out of the pure reducer. Mirrors
  // StandardGame.tsx's prestigeAwarded pattern.
  useEffect(() => {
    if (state.phase === 'RUN_OVER' && !cashAwarded.current) {
      cashAwarded.current = true;
      awardRunCash(state.bankedCash);
    }
    if (state.phase !== 'RUN_OVER') cashAwarded.current = false;
  }, [state.phase, state.bankedCash]);

  if (state.phase === 'HOME') {
    if (showUpgrades) {
      return (
        <DigUpgradeTree
          onClose={() => setShowUpgrades(false)}
          onPlayAgain={() => { playSfx('click'); dispatch({ type: 'START_DIG' }); }}
        />
      );
    }
    return (
      <DigHomeScreen
        onDig={() => { playSfx('click'); dispatch({ type: 'START_DIG' }); }}
        onOpenUpgrades={() => setShowUpgrades(true)}
        onBackToMenu={onBackToMenu}
      />
    );
  }

  const isDigging = state.phase === 'DIGGING';

  return (
    <div className="casino-root h-screen overflow-hidden flex flex-col relative">
      <div
        className="flex items-center justify-between px-5 py-2.5 shrink-0"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}
      >
        <div className="font-display text-xl" style={{ color: '#f0a860', letterSpacing: '0.1em' }}>
          THE DIG
        </div>
        <div className="flex items-center gap-2">
          {import.meta.env.DEV && (
            <button
              onClick={() => setDebugOpen(o => !o)}
              title="Debug console"
              className="chip font-mono text-sm cursor-pointer"
              style={{ color: debugOpen ? '#f0a860' : 'var(--text-muted)' }}
            >
              🛠
            </button>
          )}
          <BackToMenuButton hasProgress={isDigging} onConfirm={onBackToMenu} />
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center overflow-y-auto px-4 py-4">
        <div className="w-full max-w-3xl flex gap-4 items-stretch justify-center">
          <DigHUD state={state} onCashOut={() => dispatch({ type: 'CASH_OUT' })} />

          <div className="flex flex-col items-center justify-center flex-1 min-w-0">
            <DigGrid
              board={state.board}
              cols={state.boardCols}
              clickable={isDigging}
              suppressAdjacency={state.activeBoss === 'fog'}
              onTileClick={i => dispatch({ type: 'DIG_TILE_CLICK', index: i })}
            />
          </div>
        </div>
      </div>

      {state.phase === 'RUN_OVER' && (
        <DigRunOverOverlay
          state={state}
          onContinue={() => {
            dispatch({ type: 'BACK_TO_HOME' });
            setShowUpgrades(true);
          }}
        />
      )}

      {debugOpen && (
        <DigDebugPanel
          state={state}
          onPatch={patch => dispatch({ type: 'DEBUG_PATCH', patch })}
          onClose={() => setDebugOpen(false)}
        />
      )}
    </div>
  );
}
