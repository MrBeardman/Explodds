import { useReducer } from 'react';
import type { GameState, ConsumableId } from './types';
import {
  createInitialState,
  startLevel,
  handleTileClick,
  handleCashout,
  handleBuyItem,
} from './gameLogic';
import { HUD } from './components/HUD';
import { Grid } from './components/Grid';
import { Shop } from './components/Shop';
import { GameOver } from './components/GameOver';
import { StartScreen } from './components/StartScreen';

type Action =
  | { type: 'START_RUN' }
  | { type: 'TILE_CLICK'; index: number }
  | { type: 'CASHOUT' }
  | { type: 'BUY_ITEM'; itemId: string }
  | { type: 'CONTINUE_TO_LEVEL' }
  | { type: 'RESTART' }
  | { type: 'USE_CONSUMABLE'; id: ConsumableId }
  | { type: 'SET_SCANNER_AXIS'; axis: 'row' | 'col' };

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'START_RUN': {
      const fresh = createInitialState();
      return startLevel({ ...fresh, phase: 'playing' });
    }

    case 'TILE_CLICK':
      return handleTileClick(state, action.index);

    case 'CASHOUT':
      return handleCashout(state);

    case 'BUY_ITEM':
      return handleBuyItem(state, action.itemId);

    case 'CONTINUE_TO_LEVEL':
      return startLevel(state);

    case 'RESTART':
      return createInitialState();

    case 'USE_CONSUMABLE': {
      const id = action.id;
      if (id === 'multiplier_lens') {
        return {
          ...state,
          multiplierLensCount: state.multiplierLensCount + 5,
          consumables: removeOne(state.consumables, id),
        };
      }
      if (id === 'scanner') {
        if (state.pendingConsumable === 'scanner') {
          return { ...state, pendingConsumable: null, scannerAxis: null };
        }
        return { ...state, pendingConsumable: 'scanner', scannerAxis: 'row' };
      }
      if (state.pendingConsumable === id) {
        return { ...state, pendingConsumable: null };
      }
      return { ...state, pendingConsumable: id };
    }

    case 'SET_SCANNER_AXIS':
      return { ...state, scannerAxis: action.axis };

    default:
      return state;
  }
}

function removeOne<T>(arr: T[], val: T): T[] {
  const i = arr.indexOf(val);
  if (i === -1) return arr;
  return [...arr.slice(0, i), ...arr.slice(i + 1)];
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, createInitialState());

  return (
    <div className="min-h-screen bg-[#0d0f14] text-gray-100">
      {state.phase === 'start' && (
        <StartScreen onStart={() => dispatch({ type: 'START_RUN' })} />
      )}

      {state.phase === 'playing' && (
        <div className="max-w-lg mx-auto p-4 flex flex-col gap-4">
          <HUD
            state={state}
            onCashout={() => dispatch({ type: 'CASHOUT' })}
          />
          <Grid
            state={state}
            onTileClick={i => dispatch({ type: 'TILE_CLICK', index: i })}
            onUseConsumable={id => dispatch({ type: 'USE_CONSUMABLE', id })}
            onScannerAxis={axis => dispatch({ type: 'SET_SCANNER_AXIS', axis })}
          />
        </div>
      )}

      {state.phase === 'shop' && (
        <Shop
          state={state}
          onBuy={itemId => dispatch({ type: 'BUY_ITEM', itemId })}
          onContinue={() => dispatch({ type: 'CONTINUE_TO_LEVEL' })}
        />
      )}

      {state.phase === 'gameover' && (
        <GameOver
          state={state}
          onRestart={() => dispatch({ type: 'RESTART' })}
        />
      )}
    </div>
  );
}
