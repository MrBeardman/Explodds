import { useEffect, useReducer } from 'react';
import type { GameState, ConsumableId, RelicId, EventCardId } from './types';
import {
  createInitialState, handleTileClick, handleCashout, handlePlaceBet,
  handleBustFlashEnd,
  rerollConsumables, rerollRelics, startNextCycle, drawEventCards,
} from './gameLogic';
import { calcBombs, calcTileBaseCash, ALL_CONSUMABLES } from './constants';
import { MIN_BET, BET_STEP, MAX_ACTIVE_RELICS } from './constants';

import { StartScreen }         from './components/StartScreen';
import { EventBanner }         from './components/EventCards';
import { Grid }                from './components/Grid';
import { HUD }                 from './components/HUD';
import { Shop }                from './components/Shop';
import { GameOver }            from './components/GameOver';
import { ConsumablePlacement } from './components/ConsumablePlacement';
import { ComboOverlay }        from './components/ComboOverlay';

// ─── Actions ──────────────────────────────────────────────────────────────────

type Action =
  | { type: 'START_GAME' }
  | { type: 'SELECT_EVENT_CARD'; id: EventCardId }
  | { type: 'AUTO_SELECT_EVENT' }
  | { type: 'SET_BET'; amount: number }
  | { type: 'PLACE_BET' }
  | { type: 'PLACE_CONSUMABLE'; tileIndex: number }
  | { type: 'SKIP_PLACEMENT' }
  | { type: 'TILE_CLICK'; index: number }
  | { type: 'ACTIVATE_SCANNER'; axis: 'row' | 'col' }
  | { type: 'CANCEL_SCANNER' }
  | { type: 'CASHOUT' }
  | { type: 'BUST_FLASH_END' }
  | { type: 'CLEAR_COMBO_DISPLAY' }
  | { type: 'BUY_CONSUMABLE'; id: ConsumableId }
  | { type: 'BUY_RELIC'; id: RelicId }
  | { type: 'REROLL_CONSUMABLES' }
  | { type: 'REROLL_RELICS' }
  | { type: 'NEXT_CYCLE' }
  | { type: 'RESTART' };

// ─── Reducer ──────────────────────────────────────────────────────────────────

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {

    case 'START_GAME': {
      const fresh = createInitialState();
      const events = drawEventCards(fresh);
      return { ...fresh, phase: 'EVENT_CARD', event_card_options: events };
    }

    case 'SELECT_EVENT_CARD':
      return {
        ...state,
        active_event: action.id,
        phase: 'BET',
      };

    case 'AUTO_SELECT_EVENT': {
      if (state.phase !== 'EVENT_CARD' || state.event_card_options.length === 0) return state;
      const id = state.event_card_options[Math.floor(Math.random() * state.event_card_options.length)];
      return { ...state, active_event: id, phase: 'BET' };
    }

    case 'SET_BET': {
      const minBet = state.active_event === 'greed_mode' ? 25 : MIN_BET;
      const clamped = Math.max(minBet, Math.min(action.amount, state.wallet));
      const snapped = Math.round(clamped / BET_STEP) * BET_STEP;
      return { ...state, current_bet: Math.max(minBet, snapped) };
    }

    case 'PLACE_BET':
      return handlePlaceBet(state);

    case 'PLACE_CONSUMABLE': {
      const idx = state.placing_index;
      if (idx < 0 || idx >= state.placement_queue.length) return state;
      const consumableId = state.placement_queue[idx];

      // Don't allow placing on already-occupied tile
      if (state.board[action.tileIndex]?.consumable !== null) return state;

      const newBoard = state.board.map(t =>
        t.index === action.tileIndex ? { ...t, consumable: consumableId } : t
      );
      const newPlaced = [...state.consumables_placed, { tile_index: action.tileIndex, type: consumableId }];
      const nextIdx = idx + 1;
      const done = nextIdx >= state.placement_queue.length;

      return {
        ...state,
        board: newBoard,
        consumables_placed: newPlaced,
        placing_index: done ? -1 : nextIdx,
        phase: done ? 'CLEARING' : 'PLACEMENT',
      };
    }

    case 'SKIP_PLACEMENT':
      return { ...state, placing_index: -1, phase: 'CLEARING' };

    case 'TILE_CLICK':
      return handleTileClick(state, action.index);

    case 'ACTIVATE_SCANNER':
      return { ...state, pending_scanner_axis: action.axis };

    case 'CANCEL_SCANNER':
      return { ...state, pending_scanner_axis: null };

    case 'CASHOUT': {
      if (state.phase !== 'CLEARING') return state;
      return handleCashout(state);
    }

    case 'BUST_FLASH_END':
      return handleBustFlashEnd(state);

    case 'CLEAR_COMBO_DISPLAY':
      return { ...state, active_combo_display: [] };

    case 'BUY_CONSUMABLE': {
      const item = state.shop_consumables.find(c => c.id === action.id);
      if (!item || item.sold || state.wallet < item.price) return state;
      return {
        ...state,
        wallet: parseFloat((state.wallet - item.price).toFixed(2)),
        consumables_owned: [...state.consumables_owned, action.id],
        shop_consumables: state.shop_consumables.map(c =>
          c.id === action.id ? { ...c, sold: true } : c
        ),
      };
    }

    case 'BUY_RELIC': {
      const item = state.shop_relics.find(r => r.id === action.id);
      if (!item || item.sold || item.owned || state.tickets < item.cost) return state;
      if (state.relics.length >= MAX_ACTIVE_RELICS) return state;
      return {
        ...state,
        tickets: state.tickets - item.cost,
        relics: [...state.relics, action.id],
        shop_relics: state.shop_relics.map(r =>
          r.id === action.id ? { ...r, sold: true } : r
        ),
      };
    }

    case 'REROLL_CONSUMABLES': {
      if (state.shop_consumables_rerolled || state.tickets < 2) return state;
      return {
        ...state,
        tickets: state.tickets - 2,
        shop_consumables: rerollConsumables(state),
        shop_consumables_rerolled: true,
      };
    }

    case 'REROLL_RELICS': {
      if (state.shop_relics_rerolled || state.tickets < 2) return state;
      return {
        ...state,
        tickets: state.tickets - 2,
        shop_relics: rerollRelics(state),
        shop_relics_rerolled: true,
      };
    }

    case 'NEXT_CYCLE':
      return startNextCycle(state);

    case 'RESTART':
      return createInitialState();

    default:
      return state;
  }
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [state, dispatch] = useReducer(reducer, createInitialState());

  // BUST_FLASH auto-transition after 1.2s
  useEffect(() => {
    if (state.phase === 'BUST_FLASH') {
      const t = setTimeout(() => dispatch({ type: 'BUST_FLASH_END' }), 1200);
      return () => clearTimeout(t);
    }
  }, [state.phase]);

  // Event card auto-select after 8s
  useEffect(() => {
    if (state.phase === 'EVENT_CARD') {
      const t = setTimeout(() => dispatch({ type: 'AUTO_SELECT_EVENT' }), 8000);
      return () => clearTimeout(t);
    }
  }, [state.phase]);

  // Auto-clear combo display after animation finishes
  useEffect(() => {
    if (state.active_combo_display.length > 0) {
      const t = setTimeout(() => dispatch({ type: 'CLEAR_COMBO_DISPLAY' }), 2500);
      return () => clearTimeout(t);
    }
  }, [state.active_combo_display.length]);

  if (state.phase === 'START') {
    return <StartScreen onStart={() => dispatch({ type: 'START_GAME' })} />;
  }

  const isClearing = state.phase === 'CLEARING' || state.phase === 'BUST_FLASH';
  const isBetting  = state.phase === 'BET' || state.phase === 'EVENT_CARD';

  return (
    <div className="casino-root h-screen overflow-hidden flex flex-col">
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-4 py-2 shrink-0"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}
      >
        <div className="font-display text-xl text-glow-gold" style={{ color: 'var(--gold)', letterSpacing: '0.1em' }}>
          EXPLODDS
        </div>
        <div className="flex gap-5 font-mono text-sm">
          <span style={{ color: 'var(--gold)' }}>💵 ${Math.floor(state.wallet)}</span>
          <span style={{ color: '#60c0ff' }}>🎫 {state.tickets}</span>
        </div>
      </div>

      {/* 3-column layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left panel ───────────────────────────────── */}
        <div
          className="w-48 shrink-0 flex flex-col p-3 gap-3 overflow-y-auto"
          style={{ borderRight: '1px solid var(--border)', background: 'var(--bg-surface)' }}
        >
          <LeftPanel state={state} dispatch={dispatch} isBetting={isBetting} isClearing={isClearing} />
        </div>

        {/* ── Center ───────────────────────────────────── */}
        <div className="flex-1 flex flex-col items-center p-4 gap-3 overflow-y-auto">
          {state.phase === 'EVENT_CARD' && (
            <EventBanner
              state={state}
              onSelect={id => dispatch({ type: 'SELECT_EVENT_CARD', id })}
            />
          )}

          <div className="relative w-full flex justify-center">
            <ComboOverlay items={state.active_combo_display} />
            {state.board.length > 0 ? (
              <Grid
                state={state}
                onTileClick={i => dispatch({ type: 'TILE_CLICK', index: i })}
              />
            ) : (
              <EmptyBoardPlaceholder phase={state.phase} />
            )}
          </div>
        </div>

        {/* ── Right panel ──────────────────────────────── */}
        <div
          className="w-48 shrink-0 flex flex-col p-3 gap-3 overflow-y-auto"
          style={{ borderLeft: '1px solid var(--border)', background: 'var(--bg-surface)' }}
        >
          <HUD state={state} />
        </div>
      </div>

      {/* ── Overlays ─────────────────────────────────── */}
      {state.phase === 'PLACEMENT' && (
        <div className="absolute inset-0 z-20 bg-black/80 flex items-center justify-center p-4">
          <ConsumablePlacement
            state={state}
            onPlace={i => dispatch({ type: 'PLACE_CONSUMABLE', tileIndex: i })}
            onSkip={() => dispatch({ type: 'SKIP_PLACEMENT' })}
          />
        </div>
      )}

      {state.phase === 'SHOP' && (
        <Shop
          state={state}
          onBuyConsumable={id => dispatch({ type: 'BUY_CONSUMABLE', id })}
          onBuyRelic={id => dispatch({ type: 'BUY_RELIC', id })}
          onRerollConsumables={() => dispatch({ type: 'REROLL_CONSUMABLES' })}
          onRerollRelics={() => dispatch({ type: 'REROLL_RELICS' })}
          onNextCycle={() => dispatch({ type: 'NEXT_CYCLE' })}
        />
      )}

      {state.phase === 'GAME_OVER' && (
        <GameOver state={state} onRestart={() => dispatch({ type: 'RESTART' })} />
      )}
    </div>
  );
}

// ─── Left panel ───────────────────────────────────────────────────────────────

interface LeftPanelProps {
  state: GameState;
  dispatch: React.Dispatch<Action>;
  isBetting: boolean;
  isClearing: boolean;
}

function LeftPanel({ state, dispatch, isBetting, isClearing }: LeftPanelProps) {
  const minBet = state.active_event === 'greed_mode' ? 25 : MIN_BET;
  const maxBet = Math.max(minBet, Math.floor(state.wallet / BET_STEP) * BET_STEP);
  const previewBombs = calcBombs(state.current_bet, state.wallet, state.cycle_number)
    + (state.active_event === 'danger_pay' ? 3 : 0);
  const previewTileCash = calcTileBaseCash(state.current_bet)
    * (state.active_event === 'danger_pay' ? 1.4 : 1);

  const canCashout = isClearing && state.attempt_earnings >= 0.01;
  const cashoutCoversDebt = state.deposited + state.attempt_earnings >= state.deadline;

  // Scanner state
  const hasScanner = state.consumables_owned.includes('scanner');
  const scannerActive = state.pending_scanner_axis !== null;

  return (
    <>
      {/* Bet amount display */}
      <div className="flex flex-col gap-0.5">
        <div className="font-mono text-xs" style={{ color: 'var(--text-muted)', letterSpacing: '0.12em' }}>
          {isClearing ? 'ACTIVE BET' : 'BET AMOUNT'}
        </div>
        <div className="font-display text-3xl" style={{ color: 'var(--gold)' }}>
          ${state.current_bet}
        </div>
      </div>

      {/* Bet slider — only in BET phase */}
      {isBetting && (
        <div className="flex flex-col gap-1.5">
          <input
            type="range"
            min={minBet}
            max={maxBet}
            step={BET_STEP}
            value={state.current_bet}
            onChange={e => dispatch({ type: 'SET_BET', amount: Number(e.target.value) })}
            className="w-full accent-gold"
            style={{ accentColor: 'var(--gold)' }}
          />
          <div className="flex flex-col gap-0.5 font-mono text-xs">
            <div className="flex justify-between">
              <span style={{ color: 'var(--text-muted)' }}>💣 Bombs</span>
              <span style={{ color: 'var(--red)' }}>{previewBombs}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--text-muted)' }}>💵/tile</span>
              <span style={{ color: 'var(--text-primary)' }}>~${previewTileCash.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Live bomb/tile info during clearing */}
      {isClearing && (
        <div className="flex flex-col gap-0.5 font-mono text-xs">
          <div className="flex justify-between">
            <span style={{ color: 'var(--text-muted)' }}>💣 Bombs</span>
            <span style={{ color: 'var(--red)' }}>{state.bombs_this_attempt}</span>
          </div>
        </div>
      )}

      <div className="gold-line" />

      {/* PLACE BET button */}
      {isBetting && (
        <button
          onClick={() => dispatch({ type: 'PLACE_BET' })}
          disabled={state.wallet < minBet || state.phase === 'EVENT_CARD'}
          className="w-full font-display text-base py-2.5 rounded-xl cursor-pointer transition-all duration-150"
          style={{
            background: state.phase !== 'EVENT_CARD' && state.wallet >= minBet ? 'var(--gold)' : 'var(--bg-card)',
            color: state.phase !== 'EVENT_CARD' && state.wallet >= minBet ? '#000' : 'var(--text-dim)',
            letterSpacing: '0.06em',
            border: '1px solid var(--border)',
          }}
        >
          PLACE BET
        </button>
      )}

      {/* CASHOUT button */}
      {isClearing && (
        <button
          onClick={() => dispatch({ type: 'CASHOUT' })}
          disabled={!canCashout}
          className={`w-full font-display text-base py-2.5 rounded-xl transition-all duration-150 leading-tight ${canCashout ? 'cursor-pointer' : 'cursor-not-allowed'} ${cashoutCoversDebt && canCashout ? 'cashout-active' : ''}`}
          style={{
            background: !canCashout
              ? 'var(--bg-card)'
              : cashoutCoversDebt
                ? 'var(--gold)'
                : 'var(--green)',
            color: canCashout ? '#000' : 'var(--text-dim)',
            letterSpacing: '0.06em',
            border: cashoutCoversDebt && canCashout
              ? '1px solid var(--gold-bright)'
              : '1px solid var(--border)',
          }}
        >
          {canCashout ? (<>CASHOUT<br />+${state.attempt_earnings.toFixed(2)}</>) : 'CASHOUT'}
        </button>
      )}

      {/* Scanner controls */}
      {isClearing && hasScanner && (
        <div className="flex flex-col gap-1.5">
          <button
            onClick={() => scannerActive ? dispatch({ type: 'CANCEL_SCANNER' }) : dispatch({ type: 'ACTIVATE_SCANNER', axis: 'row' })}
            className="font-mono text-xs px-2 py-1.5 rounded cursor-pointer"
            style={{
              background: scannerActive ? 'rgba(59,130,246,0.2)' : 'var(--bg-raised)',
              border: `1px solid ${scannerActive ? '#3b82f6' : 'var(--border)'}`,
              color: scannerActive ? '#60a5fa' : 'var(--text-muted)',
            }}
          >
            🔍 {scannerActive ? 'SCANNING' : 'SCANNER'}
          </button>
          {scannerActive && (
            <div className="flex gap-1">
              <button
                onClick={() => dispatch({ type: 'ACTIVATE_SCANNER', axis: 'row' })}
                className="flex-1 font-mono text-xs py-1 rounded cursor-pointer"
                style={{
                  background: state.pending_scanner_axis === 'row' ? '#3b82f6' : 'var(--bg-raised)',
                  border: '1px solid var(--border)',
                  color: '#fff',
                }}
              >ROW →</button>
              <button
                onClick={() => dispatch({ type: 'ACTIVATE_SCANNER', axis: 'col' })}
                className="flex-1 font-mono text-xs py-1 rounded cursor-pointer"
                style={{
                  background: state.pending_scanner_axis === 'col' ? '#3b82f6' : 'var(--bg-raised)',
                  border: '1px solid var(--border)',
                  color: '#fff',
                }}
              >COL ↓</button>
            </div>
          )}
        </div>
      )}

      {/* Consumables list */}
      {state.consumables_owned.filter(c => c !== 'scanner').length > 0 && (
        <div className="flex flex-col gap-0.5">
          <div className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>ITEMS</div>
          <div className="flex flex-wrap gap-1">
            {state.consumables_owned.filter(c => c !== 'scanner').map((c, i) => {
              const def = ALL_CONSUMABLES.find(x => x.id === c);
              return (
                <span key={i} title={def?.description} className="text-lg cursor-default">
                  {def?.emoji}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

// ─── Empty board placeholder ──────────────────────────────────────────────────

function EmptyBoardPlaceholder({ phase }: { phase: string }) {
  return (
    <div
      className="w-full max-w-sm aspect-square rounded-2xl flex items-center justify-center"
      style={{ background: 'var(--bg-card)', border: '1px dashed var(--border)' }}
    >
      <div className="text-center font-mono text-sm" style={{ color: 'var(--text-dim)' }}>
        {phase === 'EVENT_CARD' ? 'Pick an event card →' : 'Place your bet to start'}
      </div>
    </div>
  );
}
