import { useEffect, useReducer, useRef, useState } from 'react';
import type { GameState, ConsumableId, RelicId, EventCardId, SymbolBoost } from '../types';
import {
  createInitialState, handleTileClick, handleCashout, handlePlaceBet,
  handleBustFlashEnd, getLockedBet, getConsumablePrice,
  effectiveBombs, toBetPhase, handleDeposit, buyPack, pickPackBoost, skipPackBoost, rerollPacks,
  maxPlayerFlags,
  rerollConsumables, rerollRelics, startNextCycle, drawEventCards, selectEventCard, interestRate, stakeReturnInfo, betOptions, snapBet,
  resolveCycleFailure,
  buyRelicCase, dismissResults,
} from '../gameLogic';
import { calcTileBaseCash, ALL_CONSUMABLES } from '../constants';
import { playSfx, isMuted, setMuted } from '../sound';
import { recordRunEnd, type DailyRecord } from '../meta';

import { StartScreen }         from './StartScreen';
import { SkillTree }           from './SkillTree';
import { ResultsOverlay }      from './ResultsOverlay';
import { EventChoice }         from './EventChoice';
import { BossIntro }           from './BossIntro';
import { Grid }                from './Grid';
import { HUD }                 from './HUD';
import { CycleHeader }         from './CycleHeader';
import { Paytable }            from './Paytable';
import { RelicShelf }          from './RelicShelf';
import { Shop }                from './Shop';
import { GameOver }            from './GameOver';
import { ConsumablePlacement } from './ConsumablePlacement';
import { ComboOverlay }        from './ComboOverlay';
import { DebugPanel }          from './DebugPanel';
import { BackToMenuButton }    from './BackToMenuButton';

// ─── Actions ──────────────────────────────────────────────────────────────────

type Action =
  | { type: 'START_GAME'; daily?: boolean }
  | { type: 'SELECT_EVENT_CARD'; id: EventCardId }
  | { type: 'CONFIRM_BOSS' }
  | { type: 'SET_BET'; amount: number }
  | { type: 'PLACE_BET' }
  | { type: 'DEPOSIT'; amount: number }
  | { type: 'PLACE_CONSUMABLE'; tileIndex: number }
  | { type: 'SKIP_PLACEMENT' }
  | { type: 'TILE_CLICK'; index: number }
  | { type: 'ACTIVATE_SCANNER'; axis: 'row' | 'col' }
  | { type: 'CANCEL_SCANNER' }
  | { type: 'ACTIVATE_PROBE' }
  | { type: 'CANCEL_PROBE' }
  | { type: 'TOGGLE_FLAG_MODE' }
  | { type: 'CASHOUT' }
  | { type: 'DISMISS_RESULTS' }
  | { type: 'BUST_FLASH_END' }
  | { type: 'CLEAR_COMBO_DISPLAY' }
  | { type: 'BUY_CONSUMABLE'; id: ConsumableId }
  | { type: 'BUY_RELIC'; id: RelicId }
  | { type: 'BUY_PACK'; index: number }
  | { type: 'PICK_PACK_BOOST'; boost: SymbolBoost }
  | { type: 'SKIP_PACK_BOOST' }
  | { type: 'BUY_RELIC_CASE' }
  | { type: 'REROLL_CONSUMABLES' }
  | { type: 'REROLL_RELICS' }
  | { type: 'REROLL_PACKS' }
  | { type: 'NEXT_CYCLE' }
  | { type: 'END_GAME' }
  | { type: 'RESTART' }
  | { type: 'DEBUG_PATCH'; patch: Partial<GameState> };

// ─── Reducer ──────────────────────────────────────────────────────────────────

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {

    case 'START_GAME': {
      const fresh = createInitialState({ daily: action.daily });
      const events = drawEventCards(fresh);
      return { ...fresh, phase: 'EVENT_CARD', event_card_options: events };
    }

    case 'SELECT_EVENT_CARD':
      // Lasts this cycle; a second pick of the same card makes it a permanent trait.
      // (Greed Mode can raise the min bet above the wallet — toBetPhase resolves that.)
      return selectEventCard(state, action.id);

    case 'CONFIRM_BOSS': {
      if (state.phase !== 'BOSS_INTRO') return state;
      return toBetPhase(state);
    }

    case 'SET_BET': {
      if (getLockedBet(state) !== null) return state; // Warden: bet is locked
      return { ...state, current_bet: snapBet(state, action.amount) };
    }

    case 'PLACE_BET':
      return handlePlaceBet(state);

    case 'DEPOSIT':
      return handleDeposit(state, action.amount);

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
      return { ...state, pending_scanner_axis: action.axis, flag_mode: false, pending_probe: false };

    case 'ACTIVATE_PROBE':
      if (state.phase !== 'CLEARING' || !state.consumables_owned.includes('probe')) return state;
      return { ...state, pending_probe: true, pending_scanner_axis: null, flag_mode: false };

    case 'CANCEL_PROBE':
      return { ...state, pending_probe: false };

    case 'CANCEL_SCANNER':
      return { ...state, pending_scanner_axis: null };

    case 'TOGGLE_FLAG_MODE':
      if (state.phase !== 'CLEARING' || maxPlayerFlags(state) <= 0) return state;
      return { ...state, flag_mode: !state.flag_mode, pending_scanner_axis: null, pending_probe: false };

    case 'CASHOUT': {
      // The opening click is free — cashing out needs at least one deliberate reveal
      if (state.phase !== 'CLEARING' || state.clicks_this_attempt < 2) return state;
      return handleCashout(state);
    }

    case 'DISMISS_RESULTS':
      return dismissResults(state);

    case 'BUST_FLASH_END':
      return handleBustFlashEnd(state);

    case 'CLEAR_COMBO_DISPLAY':
      return { ...state, active_combo_display: [] };

    case 'BUY_CONSUMABLE': {
      const item = state.shop_consumables.find(c => c.id === action.id);
      if (!item || item.sold) return state;
      const price = getConsumablePrice(state, item.price);
      if (state.wallet < price) return state;
      return {
        ...state,
        wallet: parseFloat((state.wallet - price).toFixed(2)),
        consumables_owned: [...state.consumables_owned, action.id],
        shop_consumables: state.shop_consumables.map(c =>
          c.id === action.id ? { ...c, sold: true } : c
        ),
      };
    }

    case 'BUY_RELIC': {
      const item = state.shop_relics.find(r => r.id === action.id);
      if (!item || item.sold || item.owned || state.tickets < item.cost) return state;
      if (state.relics.length >= state.max_relic_slots) return state;
      return {
        ...state,
        tickets: state.tickets - item.cost,
        relics: [...state.relics, action.id],
        shop_relics: state.shop_relics.map(r =>
          r.id === action.id ? { ...r, sold: true } : r
        ),
      };
    }

    case 'BUY_PACK':
      return buyPack(state, action.index);

    case 'PICK_PACK_BOOST':
      return pickPackBoost(state, action.boost);

    case 'SKIP_PACK_BOOST':
      return skipPackBoost(state);

    case 'BUY_RELIC_CASE':
      return buyRelicCase(state);

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

    case 'REROLL_PACKS': {
      if (state.shop_packs_rerolled || state.tickets < 2 || state.pending_pack_choices !== null) return state;
      return {
        ...state,
        tickets: state.tickets - 2,
        shop_packs: rerollPacks(state),
        shop_packs_rerolled: true,
      };
    }

    case 'NEXT_CYCLE':
      return state.pending_pack_choices !== null ? state : startNextCycle(state);

    case 'END_GAME':
      if (state.phase === 'START' || state.phase === 'GAME_OVER') return state;
      return resolveCycleFailure(state);

    case 'RESTART':
      return createInitialState();

    case 'DEBUG_PATCH':
      return { ...state, ...action.patch };

    default:
      return state;
  }
}

// ─── Sound wiring: reducer stays pure, this hook diffs state and plays SFX ─────

function useSounds(state: GameState) {
  const prev = useRef(state);

  useEffect(() => {
    const p = prev.current;
    prev.current = state;
    if (p === state) return;

    // Phase transitions
    if (p.phase !== state.phase) {
      if (state.phase === 'BUST_FLASH') playSfx('bomb', { volume: 0.6 });
      if (state.phase === 'RESULTS')    playSfx('cashout', { volume: 0.55 });
      if (state.phase === 'GAME_OVER')  playSfx('gameover', { volume: 0.6 });
      if (state.phase === 'BOSS_INTRO') playSfx('boss', { volume: 0.6 });
      if ((state.phase === 'CLEARING' || state.phase === 'PLACEMENT') && p.phase === 'BET') {
        playSfx('reveal', { volume: 0.4 });
      }
    }

    // Symbol cleared — pitch rises with streak
    if (state.tiles_cleared > p.tiles_cleared) {
      playSfx('symbol', { rate: 1 + Math.min(state.streak, 12) * 0.05 });
    }

    // Empty revealed mid-attempt
    if (p.phase === 'CLEARING' && state.phase === 'CLEARING') {
      const empties = (b: GameState) => b.board.filter(t => t.state === 'empty_revealed').length;
      if (empties(state) > empties(p)) playSfx('empty', { volume: 0.35 });
    }

    // Streak milestones
    if ((p.streak < 5 && state.streak >= 5) || (p.streak < 10 && state.streak >= 10)) {
      playSfx('milestone', { volume: 0.45 });
    }

    // Combos
    if (state.active_combo_display.length > p.active_combo_display.length) {
      playSfx('combo', { volume: 0.5 });
    }

    // Deposit toward the deadline (SHOP transition on deadline-met covered above)
    if (state.deposited > p.deposited && state.phase === 'BET') {
      playSfx('cashout', { volume: 0.45 });
    }

    // Shop purchases (relics, consumables, packs)
    if (state.phase === 'SHOP' &&
        (state.relics.length > p.relics.length ||
         state.consumables_owned.length > p.consumables_owned.length ||
         state.boosts.length > p.boosts.length)) {
      playSfx('buy', { volume: 0.45 });
    }
  }, [state]);
}

// ─── StandardGame ───────────────────────────────────────────────────────────────

export function StandardGame({ onBackToMenu }: { onBackToMenu: () => void }) {
  const [state, dispatch] = useReducer(reducer, createInitialState());
  const [muted, setMutedState] = useState(isMuted());
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugReveal, setDebugReveal] = useState(false);
  const [bustRevealReady, setBustRevealReady] = useState(false);
  const [showSkillTree, setShowSkillTree] = useState(false);
  const [endGameConfirm, setEndGameConfirm] = useState(false);
  const [runEnd, setRunEnd] = useState<{ newUnlocks: RelicId[]; daily: DailyRecord | null } | null>(null);
  const prestigeAwarded = useRef(false);

  // END GAME needs a second click to confirm — first click arms it, second
  // (within 4s) actually ends the run. Any phase change disarms it.
  useEffect(() => {
    if (!endGameConfirm) return;
    const t = setTimeout(() => setEndGameConfirm(false), 4000);
    return () => clearTimeout(t);
  }, [endGameConfirm]);
  useEffect(() => { setEndGameConfirm(false); }, [state.phase]);

  useSounds(state);

  // Award meta-progression prestige exactly once when a run ends — a side
  // effect (localStorage write), kept out of the pure reducer.
  useEffect(() => {
    if (state.phase === 'GAME_OVER' && !prestigeAwarded.current) {
      prestigeAwarded.current = true;
      // Prestige + relic unlocks + daily record, persisted once; what was new
      // is kept for the Game Over screen to announce. (setState here is
      // deliberate: the localStorage write must happen exactly once per run.)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRunEnd(recordRunEnd({ cycles_survived: state.cycles_survived, run_stats: state.run_stats, is_daily: state.is_daily }));
    }
    if (state.phase !== 'GAME_OVER') prestigeAwarded.current = false;
  }, [state.phase, state.cycles_survived, state.run_stats, state.is_daily]);

  const toggleMute = () => {
    const m = !muted;
    setMuted(m);
    setMutedState(m);
  };

  // BUST_FLASH: brief red flash (~700ms, matches .bust-flash), then hold on a
  // full board reveal until the player manually dismisses it (no more auto-advance).
  useEffect(() => {
    if (state.phase === 'BUST_FLASH') {
      setBustRevealReady(false);
      const t = setTimeout(() => setBustRevealReady(true), 700);
      return () => clearTimeout(t);
    }
    setBustRevealReady(false);
  }, [state.phase]);

  // Auto-clear combo display after animation finishes
  useEffect(() => {
    if (state.active_combo_display.length > 0) {
      const t = setTimeout(() => dispatch({ type: 'CLEAR_COMBO_DISPLAY' }), 2500);
      return () => clearTimeout(t);
    }
  }, [state.active_combo_display.length]);

  if (state.phase === 'START') {
    return (
      <div className="relative">
        <StartScreen
          onStart={() => { playSfx('click'); dispatch({ type: 'START_GAME' }); }}
          onStartDaily={() => { playSfx('click'); dispatch({ type: 'START_GAME', daily: true }); }}
          onOpenSkills={() => setShowSkillTree(true)}
        />
        <div className="absolute top-4 right-4">
          <BackToMenuButton hasProgress={false} onConfirm={onBackToMenu} />
        </div>
        {showSkillTree && <SkillTree onClose={() => setShowSkillTree(false)} />}
      </div>
    );
  }

  const isClearing = state.phase === 'CLEARING' || state.phase === 'BUST_FLASH';
  const isBetting  = state.phase === 'BET';

  return (
    <div className="casino-root h-screen overflow-hidden flex flex-col relative">
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-5 py-2.5 shrink-0"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}
      >
        <div className="font-display text-xl text-glow-gold" style={{ color: 'var(--gold)', letterSpacing: '0.1em' }}>
          EXPLODDS
        </div>
        <div className="flex items-center gap-2">
          {import.meta.env.DEV && (
            <button
              onClick={() => setDebugOpen(o => !o)}
              title="Debug console"
              className="chip font-mono text-sm cursor-pointer"
              style={{ color: debugOpen ? 'var(--gold)' : 'var(--text-muted)' }}
            >
              🛠
            </button>
          )}
          <button
            onClick={toggleMute}
            title={muted ? 'Unmute' : 'Mute'}
            className="chip font-mono text-sm cursor-pointer"
            style={{ color: muted ? 'var(--text-dim)' : 'var(--text-muted)' }}
          >
            {muted ? '🔇' : '🔊'}
          </button>
          {state.phase !== 'GAME_OVER' && (
            <button
              onClick={() => {
                if (endGameConfirm) { dispatch({ type: 'END_GAME' }); setEndGameConfirm(false); }
                else setEndGameConfirm(true);
              }}
              title={endGameConfirm ? 'Click again to confirm' : 'End this run'}
              className="chip font-mono text-sm cursor-pointer"
              style={{ color: endGameConfirm ? 'var(--red)' : 'var(--text-muted)' }}
            >
              {endGameConfirm ? 'CONFIRM END?' : 'END GAME'}
            </button>
          )}
          <BackToMenuButton
            hasProgress={state.phase !== 'GAME_OVER'}
            onConfirm={onBackToMenu}
          />
        </div>
      </div>

      {/* Centered game table */}
      <div className="flex-1 flex items-center justify-center overflow-y-auto px-4 py-4">
        <div className="w-full max-w-5xl flex gap-4 items-stretch justify-center">

          {/* ── Left panel: money, paytable, deadline+deposit, bet controls ── */}
          <div className="w-60 shrink-0 flex flex-col gap-2.5 self-center">
            <Paytable state={state} />
            <div className="casino-panel flex flex-col p-4 gap-3">
              <LeftPanel
                state={state}
                dispatch={dispatch}
                isBetting={isBetting}
                isClearing={isClearing}
                bustRevealReady={state.phase === 'BUST_FLASH' && bustRevealReady}
              />
            </div>
          </div>

          {/* ── Center ── */}
          <div className="flex flex-col items-center justify-center flex-1 min-w-0 gap-3">
            <CycleHeader state={state} />
            <div className="relative w-full flex justify-center">
              <ComboOverlay items={state.active_combo_display} />
              {state.board.length > 0 ? (
                <Grid
                  state={state}
                  onTileClick={i => dispatch({ type: 'TILE_CLICK', index: i })}
                  debugReveal={debugReveal}
                  revealAll={state.phase === 'BUST_FLASH' && bustRevealReady}
                />
              ) : (
                <EmptyBoardPlaceholder phase={state.phase} />
              )}
            </div>
            <RelicShelf state={state} />
          </div>

          {/* ── Right panel ── */}
          <div className="w-64 shrink-0 self-center">
            <HUD state={state} />
          </div>
        </div>
      </div>

      {/* ── Overlays ── */}
      {state.phase === 'EVENT_CARD' && (
        <EventChoice
          state={state}
          onSelect={id => { playSfx('click'); dispatch({ type: 'SELECT_EVENT_CARD', id }); }}
        />
      )}

      {state.phase === 'BOSS_INTRO' && (
        <BossIntro
          state={state}
          onConfirm={() => { playSfx('click'); dispatch({ type: 'CONFIRM_BOSS' }); }}
        />
      )}

      {state.phase === 'RESULTS' && state.pending_results && (
        <ResultsOverlay
          breakdown={state.pending_results}
          onContinue={() => dispatch({ type: 'DISMISS_RESULTS' })}
        />
      )}

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
          onBuyPack={index => dispatch({ type: 'BUY_PACK', index })}
          onPickPackBoost={boost => { playSfx('milestone'); dispatch({ type: 'PICK_PACK_BOOST', boost }); }}
          onSkipPackBoost={() => { playSfx('click'); dispatch({ type: 'SKIP_PACK_BOOST' }); }}
          onBuyRelicCase={() => dispatch({ type: 'BUY_RELIC_CASE' })}
          onRerollConsumables={() => dispatch({ type: 'REROLL_CONSUMABLES' })}
          onRerollRelics={() => dispatch({ type: 'REROLL_RELICS' })}
          onRerollPacks={() => dispatch({ type: 'REROLL_PACKS' })}
          onNextCycle={() => { playSfx('click'); dispatch({ type: 'NEXT_CYCLE' }); }}
        />
      )}

      {state.phase === 'GAME_OVER' && (
        <GameOver state={state} newUnlocks={runEnd?.newUnlocks ?? []} daily={runEnd?.daily ?? null} onRestart={() => { setRunEnd(null); dispatch({ type: 'RESTART' }); }} />
      )}

      {debugOpen && (
        <DebugPanel
          state={state}
          debugReveal={debugReveal}
          onToggleReveal={() => setDebugReveal(v => !v)}
          onPatch={patch => dispatch({ type: 'DEBUG_PATCH', patch })}
          onClose={() => setDebugOpen(false)}
        />
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
  bustRevealReady: boolean;
}

function LeftPanel({ state, dispatch, isBetting, isClearing, bustRevealReady }: LeftPanelProps) {
  const lockedBet = getLockedBet(state);
  const displayBet = lockedBet ?? state.current_bet;
  const options = isBetting ? betOptions(state) : [];
  const previewBombs = state.debug_bomb_override ?? effectiveBombs(state, displayBet, state.wallet);
  const previewTileCash = calcTileBaseCash(displayBet, state.board_cols * state.board_cols)
    * (state.active_events.includes('danger_pay') ? 1.4 : 1);

  // Cashout returns the stake plus winnings; it opens up after the free opening click.
  // The stake comes back pro rata until enough of the board is revealed.
  // Strictly the live phase — isClearing also covers BUST_FLASH, where neither the
  // cashout button nor the stake hint should render
  const isLiveClearing = state.phase === 'CLEARING';
  const canCashout = isLiveClearing && state.clicks_this_attempt >= 2;
  const stakeInfo = isLiveClearing ? stakeReturnInfo(state) : { fraction: 1, revealed: 0, required: 0 };
  const stakeBack = Math.round(state.current_bet * stakeInfo.fraction);
  // Cashing out now would let a deposit of everything clear the deadline
  const cashoutCoversDebt = state.deposited + state.wallet + state.attempt_earnings >= state.deadline;

  // Scanner / Probe state
  const hasScanner = state.consumables_owned.includes('scanner');
  const scannerActive = state.pending_scanner_axis !== null;
  const hasProbe = state.consumables_owned.includes('probe');
  const probeActive = state.pending_probe;

  // Bomb Sense flag state
  const flagCap = maxPlayerFlags(state);
  const flagsUsed = state.player_flags.length;

  // Deposit control — only actionable between attempts, while cash remains to commit
  const remainingDeadline = Math.max(0, state.deadline - state.deposited);
  const depositCap = Math.min(state.wallet, remainingDeadline);
  const progress = state.deadline > 0 ? Math.min(1, state.deposited / state.deadline) : 0;
  const covered = remainingDeadline <= 0;
  const rate = interestRate(state);

  // Pick an amount first, confirm separately — avoids fat-fingering a deposit
  const [depositAmount, setDepositAmount] = useState(depositCap);
  useEffect(() => {
    setDepositAmount(depositCap);
  }, [depositCap]);

  return (
    <>
      {/* Wallet + Tickets */}
      <div className="flex gap-2">
        <div className="stat-card flex-1">
          <div className="font-mono text-xs" style={{ color: 'var(--text-muted)', letterSpacing: '0.1em' }}>💵 WALLET</div>
          <div className="font-display text-2xl leading-none mt-1" style={{ color: 'var(--gold)' }}>
            ${Math.floor(state.wallet)}
          </div>
        </div>
        <div className="stat-card flex-1">
          <div className="font-mono text-xs" style={{ color: 'var(--text-muted)', letterSpacing: '0.1em' }}>🎫 TICKETS</div>
          <div className="font-display text-2xl leading-none mt-1" style={{ color: '#60c0ff' }}>
            {state.tickets}
          </div>
        </div>
      </div>

      {/* Deadline + deposit */}
      <div className="stat-card" style={covered ? { borderColor: 'var(--gold)' } : {}}>
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs" style={{ color: 'var(--text-muted)', letterSpacing: '0.12em' }}>💳 DEADLINE</span>
          <span className="font-mono text-xs font-bold" style={{ color: covered ? 'var(--gold)' : 'var(--red)' }}>
            {covered ? 'PAID ✦' : `OWED $${Math.ceil(remainingDeadline)}`}
          </span>
        </div>
        <div className="progress-track mt-2">
          <div className={`progress-fill ${covered ? 'progress-fill-gold' : ''}`} style={{ width: `${progress * 100}%` }} />
        </div>
        <div className="flex justify-between font-mono text-xs mt-1.5">
          <span style={{ color: covered ? 'var(--gold)' : 'var(--green)' }}>${Math.floor(state.deposited)}</span>
          <span style={{ color: 'var(--text-primary)' }}>${state.deadline}</span>
        </div>
        {!covered && (
          <div className="font-mono text-xs mt-1" style={{ color: 'var(--text-dim)' }} title="Earned on deposited cash, on every successful cashout — never on a bust">
            ✦ {(rate * 100).toFixed(0)}% interest / cashout
          </div>
        )}
        {isBetting && !covered && depositCap > 0 && (
          <div className="flex flex-col gap-1.5 mt-2">
            <div className="flex gap-1">
              {[0.25, 0.5, 1].map(frac => {
                // The 100% ("max") preset must always equal the full depositCap,
                // unrounded — rounding it to the nearest $5 could zero out a
                // small leftover wallet and soft-lock the BET phase (can't bet,
                // can't deposit, can't advance).
                const amt = frac === 1
                  ? depositCap
                  : Math.max(0, Math.min(depositCap, Math.round((depositCap * frac) / 5) * 5));
                return (
                  <button
                    key={frac}
                    onClick={() => setDepositAmount(amt)}
                    className="flex-1 font-mono text-xs py-1 rounded cursor-pointer"
                    style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', color: '#60c0ff' }}
                  >
                    ${amt}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => dispatch({ type: 'DEPOSIT', amount: depositAmount })}
              disabled={depositAmount <= 0}
              className="w-full font-mono text-xs py-1.5 rounded"
              style={{
                background: depositAmount > 0 ? '#60c0ff' : 'var(--bg-raised)',
                border: '1px solid var(--border)',
                color: depositAmount > 0 ? '#000' : 'var(--text-dim)',
                cursor: depositAmount > 0 ? 'pointer' : 'default',
                fontWeight: 700,
              }}
            >
              CONFIRM DEPOSIT ${depositAmount}
            </button>
          </div>
        )}
      </div>

      <div className="gold-line" />

      {/* Bet amount display */}
      <div className="flex flex-col gap-0.5">
        <div className="font-mono text-xs" style={{ color: 'var(--text-muted)', letterSpacing: '0.12em' }}>
          {isClearing ? 'ACTIVE BET' : 'BET AMOUNT'}
        </div>
        <div className="font-display text-4xl" style={{ color: 'var(--gold)' }}>
          ${displayBet}
        </div>
        {lockedBet !== null && isBetting && (
          <div className="font-mono text-xs" style={{ color: 'var(--red)' }}>
            ⛓ locked by The Warden
          </div>
        )}
      </div>

      {/* Bet options — one per bomb count (the biggest bet that still deals that
          many bombs) plus all-in; hidden when Warden locks the bet */}
      {isBetting && lockedBet === null && options.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {options.map(o => {
            const active = o.bet === state.current_bet;
            return (
              <button
                key={o.bet}
                onClick={() => dispatch({ type: 'SET_BET', amount: o.bet })}
                className="font-mono text-xs px-2 py-1.5 rounded cursor-pointer flex flex-col items-center leading-tight"
                title={o.allIn ? 'All-in' : `Largest bet that still deals ${o.bombs} bombs`}
                style={{
                  background: active ? 'rgba(200,168,75,0.18)' : 'var(--bg-raised)',
                  border: `1px solid ${active ? 'var(--gold)' : 'var(--border)'}`,
                  color: active ? 'var(--gold)' : 'var(--text-primary)',
                  minWidth: '3.4rem',
                }}
              >
                <span>${o.bet}{o.allIn ? ' ★' : ''}</span>
                <span style={{ color: 'var(--red)', fontSize: '10px' }}>💣 {o.bombs}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Board preview / live info */}
      <div className="flex flex-col gap-1 font-mono text-xs rounded-lg p-2.5" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
        <div className="flex justify-between">
          <span style={{ color: 'var(--text-muted)' }}>💣 Bombs</span>
          <span style={{ color: 'var(--red)' }}>{isClearing ? state.bombs_this_attempt : previewBombs}</span>
        </div>
        {!isClearing && (
          <div className="flex justify-between">
            <span style={{ color: 'var(--text-muted)' }}>💵 per tile</span>
            <span style={{ color: 'var(--text-primary)' }}>~${previewTileCash.toFixed(2)}</span>
          </div>
        )}
        {isClearing && (
          <div className="flex justify-between">
            <span style={{ color: 'var(--text-muted)' }}>💰 Earned</span>
            <span style={{ color: 'var(--green-bright)' }}>${state.attempt_earnings.toFixed(2)}</span>
          </div>
        )}
      </div>

      <div className="gold-line" />

      {/* PLACE BET button */}
      {isBetting && (
        <button
          onClick={() => dispatch({ type: 'PLACE_BET' })}
          disabled={state.wallet <= 0}
          className="w-full font-display text-lg py-3 rounded-xl cursor-pointer transition-all duration-150"
          style={{
            background: state.wallet > 0 ? 'var(--gold)' : 'var(--bg-card)',
            color: state.wallet > 0 ? '#000' : 'var(--text-dim)',
            letterSpacing: '0.06em',
            border: '1px solid var(--border)',
          }}
        >
          PLACE BET
        </button>
      )}

      {/* CONTINUE button — replaces CASHOUT once the post-bust board reveal is showing */}
      {bustRevealReady && (
        <button
          onClick={() => dispatch({ type: 'BUST_FLASH_END' })}
          className="w-full font-display text-lg py-3 rounded-xl cursor-pointer transition-all duration-150"
          style={{ background: 'var(--gold)', color: '#000', letterSpacing: '0.06em', border: '1px solid var(--border)' }}
        >
          CONTINUE
        </button>
      )}

      {/* CASHOUT button */}
      {isLiveClearing && !bustRevealReady && (
        <button
          onClick={() => dispatch({ type: 'CASHOUT' })}
          disabled={!canCashout}
          className={`w-full font-display text-lg py-3 rounded-xl transition-all duration-150 leading-tight ${canCashout ? 'cursor-pointer' : 'cursor-not-allowed'} ${cashoutCoversDebt && canCashout ? 'cashout-active' : ''}`}
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
          {canCashout
            ? (<>CASHOUT<br /><span className="text-sm">+${state.attempt_earnings.toFixed(2)} · stake ${stakeBack}{stakeInfo.fraction < 1 ? ` (${Math.round(stakeInfo.fraction * 100)}%)` : ''}</span></>)
            : (<>CASHOUT<br /><span className="text-xs font-mono" style={{ letterSpacing: 0 }}>reveal one more tile</span></>)}
        </button>
      )}

      {isLiveClearing && stakeInfo.fraction < 1 && (
        <div className="font-mono text-xs text-center" style={{ color: 'var(--gold)' }} title="The full stake only comes back once enough of the board is revealed — cashing out earlier returns it pro rata">
          reveal {stakeInfo.required - stakeInfo.revealed} more safe tile{stakeInfo.required - stakeInfo.revealed === 1 ? '' : 's'} for the full stake
        </div>
      )}

      {/* Bomb Sense: flag suspected bombs, cashed in for a bonus when the attempt ends */}
      {isClearing && flagCap > 0 && (
        <button
          onClick={() => dispatch({ type: 'TOGGLE_FLAG_MODE' })}
          className="font-mono text-xs px-2 py-1.5 rounded cursor-pointer"
          style={{
            background: state.flag_mode ? 'rgba(250,204,21,0.15)' : 'var(--bg-raised)',
            border: `1px solid ${state.flag_mode ? '#facc15' : 'var(--border)'}`,
            color: state.flag_mode ? '#facc15' : 'var(--text-muted)',
          }}
        >
          🚩 {state.flag_mode ? `FLAGGING (${flagsUsed}/${flagCap})` : `FLAG BOMB (${flagsUsed}/${flagCap})`}
        </button>
      )}

      {/* Probe: test one tile without revealing it */}
      {isClearing && hasProbe && (
        <button
          onClick={() => dispatch({ type: probeActive ? 'CANCEL_PROBE' : 'ACTIVATE_PROBE' })}
          className="font-mono text-xs px-2 py-1.5 rounded cursor-pointer"
          style={{
            background: probeActive ? 'rgba(192,132,252,0.15)' : 'var(--bg-raised)',
            border: `1px solid ${probeActive ? '#c084fc' : 'var(--border)'}`,
            color: probeActive ? '#c084fc' : 'var(--text-muted)',
          }}
        >
          🧪 {probeActive ? 'PROBING — pick a tile' : `PROBE (${state.consumables_owned.filter(c => c === 'probe').length})`}
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

      {/* Consumable shelf */}
      {state.consumables_owned.filter(c => c !== 'scanner' && c !== 'probe').length > 0 && (
        <div className="flex flex-col gap-1">
          <div className="font-mono text-xs" style={{ color: 'var(--text-muted)', letterSpacing: '0.12em' }}>ITEMS</div>
          <div className="flex flex-wrap gap-1.5">
            {state.consumables_owned.filter(c => c !== 'scanner' && c !== 'probe').map((c, i) => {
              const def = ALL_CONSUMABLES.find(x => x.id === c);
              return (
                <span key={i} title={`${def?.name}: ${def?.description}`} className="slot cursor-default">
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
      className="w-full max-w-[30rem] aspect-square rounded-2xl flex items-center justify-center"
      style={{ background: 'var(--bg-card)', border: '1px dashed var(--border)' }}
    >
      <div className="text-center font-mono text-sm" style={{ color: 'var(--text-dim)' }}>
        {phase === 'BET' ? 'Place your bet to deal the board' : '···'}
      </div>
    </div>
  );
}
