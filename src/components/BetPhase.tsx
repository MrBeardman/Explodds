import { LEVELS, EVENT_CARD_MAP } from '../constants';
import type { GameState } from '../types';
import { calcDynamicBombs, calcTileBaseValue } from '../gameLogic';

interface Props {
  state: GameState;
  onSetBet: (amount: number) => void;
  onStart: () => void;
}

export function BetPhase({ state, onSetBet, onStart }: Props) {
  const cfg = LEVELS[state.round - 1];
  const eventCard = state.activeEventCard ? EVENT_CARD_MAP[state.activeEventCard] : null;
  const minBet = state.activeEventCard === 'greed_mode' ? 30 : 10;
  const maxBet = Math.max(minBet, state.cash);

  const targetScore = Math.round(cfg.target * (state.activeEventCard === 'high_roller' ? 1.5 : 1));
  const dynamicBombs = cfg.isBoss ? cfg.bombs : calcDynamicBombs(state.bet, state.cash, cfg.bombs);
  const tileVal = calcTileBaseValue(state.bet);

  const cumulativeScore = state.cumulativeRoundScore;
  const scoreLeft = Math.max(0, targetScore - cumulativeScore);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-5 p-6">

      {/* Bust flash */}
      {state.bustMessage && (
        <div className="casino-panel px-6 py-3 rounded-xl text-center animate-pulse"
             style={{ border: '2px solid var(--red)', background: 'rgba(220,38,38,0.12)' }}>
          <div className="font-display text-2xl" style={{ color: 'var(--red)', letterSpacing: '0.06em' }}>
            {state.bustMessage}
          </div>
          {cumulativeScore > 0 && (
            <div className="font-mono text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Banked score: {cumulativeScore.toLocaleString()} · Need {scoreLeft.toLocaleString()} more
            </div>
          )}
        </div>
      )}

      <div className="text-center">
        <div className="font-display text-2xl" style={{ color: 'var(--gold)', letterSpacing: '0.1em' }}>
          {state.roundAttempts > 0 ? 'PLACE NEXT BET' : 'PLACE YOUR BET'}
        </div>
        <div className="font-mono text-xs mt-1" style={{ color: 'var(--text-muted)', letterSpacing: '0.15em' }}>
          ROUND {state.round} / 6{cfg.isBoss ? ' · 👑 BOSS ROUND' : ''}
        </div>
      </div>

      {/* Event card reminder */}
      {eventCard && (
        <div className="casino-panel px-4 py-2 flex items-center gap-3 rounded-xl"
             style={{ border: '1px solid var(--gold)', background: 'rgba(200,168,75,0.05)' }}>
          <span className="text-2xl">{eventCard.emoji}</span>
          <div>
            <div className="font-display text-sm" style={{ color: 'var(--gold)', letterSpacing: '0.05em' }}>
              {eventCard.name.toUpperCase()}
            </div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{eventCard.description}</div>
          </div>
        </div>
      )}

      {/* Round info */}
      <div className="flex gap-6 font-mono text-sm">
        <div className="text-center">
          <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', letterSpacing: '0.15em' }}>TARGET</div>
          <div style={{ color: 'var(--text-primary)' }}>{targetScore.toLocaleString()}</div>
        </div>
        {cumulativeScore > 0 && (
          <div className="text-center">
            <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', letterSpacing: '0.15em' }}>BANKED</div>
            <div style={{ color: 'var(--green)' }}>{cumulativeScore.toLocaleString()}</div>
          </div>
        )}
        <div className="text-center">
          <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', letterSpacing: '0.15em' }}>YOUR CASH</div>
          <div style={{ color: 'var(--gold)' }}>${state.cash}</div>
        </div>
      </div>

      {/* Bet slider */}
      <div className="casino-panel p-6 w-full max-w-sm flex flex-col gap-4">
        <div className="flex justify-between items-end">
          <div>
            <div className="font-mono text-xs" style={{ color: 'var(--text-muted)', letterSpacing: '0.15em' }}>BET</div>
            <div className="font-display text-5xl" style={{ color: 'var(--gold)' }}>${state.bet}</div>
          </div>
          <div className="text-right flex flex-col gap-1">
            <div>
              <div className="font-mono text-xs" style={{ color: 'var(--text-muted)', letterSpacing: '0.1em' }}>BOMBS</div>
              <div className="font-mono font-bold" style={{ color: 'var(--red)' }}>💣 {dynamicBombs}</div>
            </div>
            <div>
              <div className="font-mono text-xs" style={{ color: 'var(--text-muted)', letterSpacing: '0.1em' }}>TILE VALUE</div>
              <div className="font-mono font-bold" style={{ color: 'var(--text-primary)' }}>{tileVal} pts</div>
            </div>
          </div>
        </div>

        <input
          type="range"
          min={minBet}
          max={maxBet}
          step={5}
          value={Math.min(state.bet, maxBet)}
          onChange={e => onSetBet(Number(e.target.value))}
          className="w-full cursor-pointer"
          style={{ accentColor: 'var(--gold)' }}
        />

        <div className="flex justify-between font-mono text-xs" style={{ color: 'var(--text-dim)' }}>
          <span>MIN ${minBet}</span>
          <span>MAX ${maxBet}</span>
        </div>

        {/* Quick bet buttons */}
        <div className="flex gap-2">
          {[0.25, 0.5, 1.0].map(pct => {
            const amt = Math.max(minBet, Math.floor(state.cash * pct / 5) * 5);
            return (
              <button
                key={pct}
                onClick={() => onSetBet(Math.min(amt, maxBet))}
                className="flex-1 py-1.5 rounded text-xs font-mono transition-colors cursor-pointer"
                style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
              >
                {pct === 1.0 ? 'ALL IN' : `${Math.round(pct * 100)}%`}
              </button>
            );
          })}
        </div>
      </div>

      <button
        onClick={onStart}
        disabled={state.cash <= 0}
        className="font-display text-2xl px-12 py-4 rounded-xl transition-all duration-200 cursor-pointer glow-green"
        style={{ background: 'var(--green)', color: '#000', letterSpacing: '0.1em' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--green-bright)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'var(--green)')}
      >
        PLACE BET
      </button>
    </div>
  );
}
