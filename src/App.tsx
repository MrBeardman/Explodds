import { useReducer } from 'react';
import type { GameState, ConsumableId, RelicId, EventCardId } from './types';
import {
  createInitialState, startRound, handleTileClick, handleCashout,
  generateShop, rerollConsumableShop, rerollRelicShop, drawEventCards,
  calcCashout, calcDynamicBombs, calcTileBaseValue,
} from './gameLogic';
import { MIN_BET, BET_STEP, LEVELS } from './constants';

import { StartScreen }          from './components/StartScreen';
import { EventCards }            from './components/EventCards';
import { BetPhase }              from './components/BetPhase';
import { ConsumablePlacement }   from './components/ConsumablePlacement';
import { Grid }                  from './components/Grid';
import { HUD }                   from './components/HUD';
import { RoundSummary }          from './components/RoundSummary';
import { Shop }                  from './components/Shop';
import { BossReward }            from './components/BossReward';
import { GameOver }              from './components/GameOver';
import { WinScreen }             from './components/WinScreen';

// ─── Actions ──────────────────────────────────────────────────────────────────

type Action =
  | { type: 'START_RUN' }
  | { type: 'SELECT_EVENT_CARD'; id: EventCardId }
  | { type: 'CONFIRM_EVENT_CARD' }
  | { type: 'SET_BET'; amount: number }
  | { type: 'START_ROUND' }
  | { type: 'PLACE_CONSUMABLE'; tileIndex: number }
  | { type: 'SKIP_PLACEMENT' }
  | { type: 'TILE_CLICK'; index: number }
  | { type: 'ACTIVATE_SCANNER'; axis: 'row' | 'col' }
  | { type: 'CANCEL_SCANNER' }
  | { type: 'CASHOUT' }
  | { type: 'GO_TO_SHOP' }
  | { type: 'BUY_CONSUMABLE'; id: ConsumableId }
  | { type: 'BUY_RELIC'; id: RelicId }
  | { type: 'REROLL_CONSUMABLES' }
  | { type: 'REROLL_RELICS' }
  | { type: 'NEXT_ROUND' }
  | { type: 'PICK_BOSS_RELIC'; id: RelicId }
  | { type: 'RESTART' };

// ─── Reducer ──────────────────────────────────────────────────────────────────

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {

    case 'START_RUN': {
      const fresh = createInitialState();
      const eventCards = drawEventCards(fresh);
      return { ...fresh, phase: 'event_card', eventCardOptions: eventCards };
    }

    case 'SELECT_EVENT_CARD':
      return { ...state, activeEventCard: action.id };

    case 'CONFIRM_EVENT_CARD': {
      if (!state.activeEventCard) return state;
      return { ...state, phase: 'bet', lastEventCard: state.activeEventCard };
    }

    case 'SET_BET': {
      const clamped = Math.max(
        state.activeEventCard === 'greed_mode' ? 30 : MIN_BET,
        Math.min(action.amount, state.cash)
      );
      const snapped = Math.round(clamped / BET_STEP) * BET_STEP;
      return { ...state, bet: Math.max(MIN_BET, snapped) };
    }

    case 'START_ROUND':
      return startRound(state);

    case 'PLACE_CONSUMABLE': {
      // Place the current consumable in the queue onto the clicked tile
      const idx = state.placingIndex;
      if (idx < 0 || idx >= state.placementQueue.length) return state;
      const consumableId = state.placementQueue[idx];
      const newGrid = state.grid.map(t =>
        t.id === action.tileIndex ? { ...t, placedConsumable: consumableId } : t
      );
      const nextIdx = idx + 1;
      const done = nextIdx >= state.placementQueue.length;
      return {
        ...state,
        grid: newGrid,
        placingIndex: done ? -1 : nextIdx,
        phase: done ? 'playing' : 'consumable_placement',
      };
    }

    case 'SKIP_PLACEMENT':
      return { ...state, placingIndex: -1, phase: 'playing' };

    case 'TILE_CLICK':
      return handleTileClick(state, action.index);

    case 'ACTIVATE_SCANNER':
      return { ...state, pendingScannerAxis: action.axis };

    case 'CANCEL_SCANNER':
      return { ...state, pendingScannerAxis: null };

    case 'CASHOUT':
      return handleCashout(state);

    case 'GO_TO_SHOP': {
      const shop = generateShop(state);
      return {
        ...state,
        phase: 'shop',
        shopConsumables: shop.consumables,
        shopRelics: shop.relics,
        shopRerollUsed: false,
        relicRerollUsed: false,
      };
    }

    case 'BUY_CONSUMABLE': {
      const item = state.shopConsumables.find(c => c.id === action.id);
      if (!item || item.sold || state.cash < item.price) return state;
      // Reroll Shop: handled separately via REROLL_CONSUMABLES action
      if (action.id === 'reroll_shop') return state;
      return {
        ...state,
        cash: state.cash - item.price,
        consumables: [...state.consumables, action.id],
        shopConsumables: state.shopConsumables.map(c => c.id === action.id ? { ...c, sold: true } : c),
      };
    }

    case 'BUY_RELIC': {
      const item = state.shopRelics.find(r => r.id === action.id);
      if (!item || item.sold || item.owned || state.gems < item.cost) return state;
      if (state.relics.length >= 6) return state; // max relics
      return {
        ...state,
        gems: state.gems - item.cost,
        relics: [...state.relics, action.id],
        shopRelics: state.shopRelics.map(r => r.id === action.id ? { ...r, sold: true } : r),
      };
    }

    case 'REROLL_CONSUMABLES': {
      if (state.shopRerollUsed) return state;
      const rerollItem = state.shopConsumables.find(c => c.id === 'reroll_shop');
      const cost = rerollItem ? 0 : 10;
      if (state.cash < cost && cost > 0) return state;
      return {
        ...state,
        cash: state.cash - cost,
        shopConsumables: rerollConsumableShop(state),
        shopRerollUsed: true,
      };
    }

    case 'REROLL_RELICS': {
      if (state.relicRerollUsed || state.gems < 3) return state;
      return {
        ...state,
        gems: state.gems - 3,
        shopRelics: rerollRelicShop(state),
        relicRerollUsed: true,
      };
    }

    case 'NEXT_ROUND': {
      const next = state.round + 1;
      if (next > 6) return { ...state, phase: 'win' };
      const eventCards = drawEventCards({ ...state, round: next });
      return {
        ...state,
        round: next,
        phase: 'event_card',
        eventCardOptions: eventCards,
        activeEventCard: null,
        cumulativeRoundScore: 0,
        roundAttempts: 0,
        bustMessage: null,
        gemsThisRound: 0,
      };
    }

    case 'PICK_BOSS_RELIC': {
      if (!state.bossRewardOptions.includes(action.id)) return state;
      const shop = generateShop({ ...state, relics: [...state.relics, action.id] });
      return {
        ...state,
        relics: [...state.relics, action.id],
        phase: 'round_summary',
        shopConsumables: shop.consumables,
        shopRelics: shop.relics,
      };
    }

    case 'RESTART':
      return createInitialState();

    default:
      return state;
  }
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [state, dispatch] = useReducer(reducer, createInitialState());

  return (
    <div className="casino-root min-h-screen">
      {state.phase === 'start' && (
        <StartScreen onStart={() => dispatch({ type: 'START_RUN' })} />
      )}

      {state.phase === 'event_card' && (
        <EventCards
          state={state}
          onSelect={id => dispatch({ type: 'SELECT_EVENT_CARD', id })}
          onConfirm={() => dispatch({ type: 'CONFIRM_EVENT_CARD' })}
        />
      )}

      {state.phase === 'bet' && (
        <BetPhase
          state={state}
          onSetBet={amount => dispatch({ type: 'SET_BET', amount })}
          onStart={() => dispatch({ type: 'START_ROUND' })}
        />
      )}

      {state.phase === 'consumable_placement' && (
        <ConsumablePlacement
          state={state}
          onPlace={tileIndex => dispatch({ type: 'PLACE_CONSUMABLE', tileIndex })}
          onSkip={() => dispatch({ type: 'SKIP_PLACEMENT' })}
        />
      )}

      {state.phase === 'playing' && (
        <PlayingLayout
          state={state}
          onTileClick={i => dispatch({ type: 'TILE_CLICK', index: i })}
          onCashout={() => dispatch({ type: 'CASHOUT' })}
          onActivateScanner={axis => dispatch({ type: 'ACTIVATE_SCANNER', axis })}
          onCancelScanner={() => dispatch({ type: 'CANCEL_SCANNER' })}
        />
      )}

      {state.phase === 'round_summary' && (
        <RoundSummary
          state={state}
          onContinue={() => dispatch({ type: 'GO_TO_SHOP' })}
        />
      )}

      {state.phase === 'boss_reward' && (
        <BossReward
          state={state}
          onPickRelic={id => dispatch({ type: 'PICK_BOSS_RELIC', id })}
        />
      )}

      {state.phase === 'shop' && (
        <Shop
          state={state}
          onBuyConsumable={id => dispatch({ type: 'BUY_CONSUMABLE', id })}
          onBuyRelic={id => dispatch({ type: 'BUY_RELIC', id })}
          onRerollConsumables={() => dispatch({ type: 'REROLL_CONSUMABLES' })}
          onRerollRelics={() => dispatch({ type: 'REROLL_RELICS' })}
          onNextRound={() => dispatch({ type: 'NEXT_ROUND' })}
        />
      )}

      {state.phase === 'gameover' && (
        <GameOver state={state} onRestart={() => dispatch({ type: 'RESTART' })} />
      )}

      {state.phase === 'win' && (
        <WinScreen state={state} onRestart={() => dispatch({ type: 'RESTART' })} />
      )}
    </div>
  );
}

// ─── Playing layout (3-column) ────────────────────────────────────────────────

interface PlayingProps {
  state: GameState;
  onTileClick: (i: number) => void;
  onCashout: () => void;
  onActivateScanner: (axis: 'row' | 'col') => void;
  onCancelScanner: () => void;
}

function PlayingLayout({ state, onTileClick, onCashout, onActivateScanner, onCancelScanner }: PlayingProps) {
  const cfg = LEVELS[state.round - 1];
  const dynamicBombs = cfg.isBoss
    ? cfg.bombs
    : calcDynamicBombs(state.bet, state.cash, cfg.bombs);
  const tileVal = calcTileBaseValue(state.bet);
  const { totalPayout } = state.canCashout ? calcCashout(state) : { totalPayout: 0 };
  const hasScanner = state.consumables.includes('scanner');
  const scannerActive = state.pendingScannerAxis !== null;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ── Left panel ───────────────────────────────── */}
      <div className="w-52 shrink-0 flex flex-col p-4 gap-4 overflow-y-auto"
           style={{ borderRight: '1px solid var(--border)', background: 'var(--bg-surface)' }}>

        <div className="font-display text-xl text-glow-gold" style={{ color: 'var(--gold)', letterSpacing: '0.08em' }}>
          EXPLODDS
        </div>
        <div className="gold-line" />

        <div className="flex flex-col gap-1">
          <div className="font-mono text-xs" style={{ color: 'var(--text-muted)', letterSpacing: '0.1em' }}>CURRENT BET</div>
          <div className="font-display text-3xl" style={{ color: 'var(--gold)' }}>${state.bet}</div>
        </div>

        <div className="flex flex-col gap-1.5 font-mono text-xs">
          <div className="flex justify-between">
            <span style={{ color: 'var(--text-muted)' }}>Bombs</span>
            <span style={{ color: 'var(--red)' }}>💣 {dynamicBombs}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: 'var(--text-muted)' }}>Tile value</span>
            <span style={{ color: 'var(--text-primary)' }}>{tileVal} pts</span>
          </div>
        </div>

        <div className="gold-line" />

        <button
          onClick={onCashout}
          disabled={!state.canCashout}
          className={`w-full font-display text-lg py-3 rounded-xl transition-all duration-200 leading-tight ${state.canCashout ? 'cashout-active cursor-pointer' : 'cursor-not-allowed'}`}
          style={{
            letterSpacing: '0.06em',
            background: state.canCashout ? 'var(--green)' : 'var(--bg-card)',
            color: state.canCashout ? '#000' : 'var(--text-dim)',
            border: state.canCashout ? '1px solid var(--green-bright)' : '1px solid var(--border)',
          }}
        >
          {state.canCashout ? (<>CASHOUT<br />${totalPayout}</>) : 'NEED MORE\nSCORE'}
        </button>

        {hasScanner && (
          <div className="flex flex-col gap-2">
            <button
              onClick={() => scannerActive ? onCancelScanner() : onActivateScanner('row')}
              className="font-mono text-xs px-2 py-1.5 rounded cursor-pointer"
              style={{
                background: scannerActive ? 'rgba(59,130,246,0.2)' : 'var(--bg-raised)',
                border: `1px solid ${scannerActive ? '#3b82f6' : 'var(--border)'}`,
                color: scannerActive ? '#60a5fa' : 'var(--text-muted)',
              }}
            >
              🔍 {scannerActive ? 'SCANNER ON' : 'SCANNER'}
            </button>
            {scannerActive && (
              <div className="flex gap-1">
                <button onClick={() => onActivateScanner('row')}
                  className="flex-1 font-mono text-xs py-1 rounded cursor-pointer"
                  style={{ background: state.pendingScannerAxis === 'row' ? '#3b82f6' : 'var(--bg-raised)', border: '1px solid var(--border)', color: '#fff' }}>
                  ROW →
                </button>
                <button onClick={() => onActivateScanner('col')}
                  className="flex-1 font-mono text-xs py-1 rounded cursor-pointer"
                  style={{ background: state.pendingScannerAxis === 'col' ? '#3b82f6' : 'var(--bg-raised)', border: '1px solid var(--border)', color: '#fff' }}>
                  COL ↓
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Center: grid ─────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-4">
        <Grid state={state} onTileClick={onTileClick} />
      </div>

      {/* ── Right panel: stats ───────────────────────── */}
      <div className="w-52 shrink-0 flex flex-col p-4 gap-3 overflow-y-auto"
           style={{ borderLeft: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
        <HUD state={state} />
      </div>
    </div>
  );
}
