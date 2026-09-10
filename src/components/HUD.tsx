import {
  BOSS_MAP, EVENT_CARD_MAP, DEDUCTION_MULT_GAIN, LOGICIAN_MULT_GAIN, attemptsForCycle,
  INSIGHT_SLOTS_BY_LEVEL, CASCADE_LEVEL1_CAP, CURFEW_CLICKS, COLLATERAL_DEPOSIT_FRAC,
} from '../constants';
import { isBossCycle, maxPlayerFlags } from '../gameLogic';
import { ledgerRow } from '../deduction';
import type { GameState } from '../types';

// One row of the ACTIVE RULES card: an icon, a name, a live value. `tone`
// colours the value (ok / warn / bad / info). Only rules with live state get a
// row — static relics live on the relic shelf.
interface RuleRow { key: string; icon: string; name: string; value: string; tone?: 'ok' | 'warn' | 'bad' | 'info'; title: string }

function activeRules(state: GameState): RuleRow[] {
  const rows: RuleRow[] = [];
  const inAttempt = state.phase === 'CLEARING' || state.phase === 'PLACEMENT' || state.phase === 'BUST_FLASH';

  // ── Skills (this run) ──
  const sixth = state.relics.includes('sixth_sense');
  const slots = INSIGHT_SLOTS_BY_LEVEL[Math.min(state.skills.insight ?? 0, INSIGHT_SLOTS_BY_LEVEL.length - 1)];
  if (sixth) {
    rows.push({ key: 'insight', icon: '🧿', name: 'Sixth Sense', value: 'all symbol tiles numbered', tone: 'ok', title: 'Every revealed symbol tile shows its bomb count this run (relic)' });
  } else if (state.active_boss === 'blackout') {
    rows.push({ key: 'insight', icon: '🔢', name: 'Insight', value: 'symbols dark (Blackout)', tone: 'bad', title: 'The Blackout boss hides bomb counts on symbol tiles; empties still show theirs' });
  } else if (slots === Infinity) {
    rows.push({ key: 'insight', icon: '🔢', name: 'Insight', value: 'every tile numbered', tone: 'ok', title: 'Insight level 3: every revealed tile shows its bomb count' });
  } else {
    const left = Math.max(0, slots - state.numbered_symbols.length);
    rows.push({
      key: 'insight', icon: '🔢', name: 'Insight',
      value: inAttempt ? `${left} / ${slots} numbered tiles left` : `${slots} numbered symbol tiles / attempt`,
      tone: !inAttempt ? 'info' : left === 0 ? 'bad' : left === 1 ? 'warn' : 'ok',
      title: 'Empty tiles always show their bomb count. Symbol tiles only do for the first N you reveal each attempt — a revealed symbol with a "?" got no number. Raise Insight on the Start Screen or find the Sixth Sense relic.',
    });
  }
  const cascade = state.skills.cascade ?? 0;
  rows.push({
    key: 'cascade', icon: '🌊', name: 'Cascade Sense',
    value: cascade === 0 ? 'single-tile opening · no cascade' : cascade === 1 ? `plus opening · cascade ≤${CASCADE_LEVEL1_CAP}` : 'plus opening · unlimited cascade',
    tone: 'info',
    title: 'What your first click guarantees bomb-free, and how far an empty 0 chains open connected safe tiles',
  });
  const flagCap = maxPlayerFlags(state);
  if ((state.skills.bomb_flag ?? 0) > 0) {
    rows.push({ key: 'flags', icon: '🚩', name: 'Bomb Sense', value: inAttempt ? `flags ${state.player_flags.length} / ${flagCap}` : `up to ${state.skills.bomb_flag} flags / attempt`, tone: 'info', title: 'Flag suspected bombs; each correct flag pays a bonus when the attempt ends' });
  }

  // ── Relics with state ──
  if (state.relics.includes('gut_feeling')) rows.push({ key: 'gut', icon: '🫀', name: 'Gut Feeling', value: state.gut_feeling_used ? 'used this cycle' : 'ready', tone: state.gut_feeling_used ? 'bad' : 'ok', title: 'Once per cycle, a guess that would hit a bomb cashes you out instead, for half the winnings' });
  if (state.relics.includes('bomb_suit')) rows.push({ key: 'suit', icon: '🦺', name: 'Bomb Suit', value: state.bomb_suit_used ? 'used this cycle' : 'ready', tone: state.bomb_suit_used ? 'bad' : 'ok', title: 'The first bust each cycle refunds your stake' });
  if (state.relics.includes('echo') && state.last_attempt_busted && !inAttempt) rows.push({ key: 'echo', icon: '📣', name: 'Echo', value: 'next board starts with 2 numbers', tone: 'ok', title: 'After a bust, the next board starts with two empties already revealed' });
  if (state.relics.includes('ledger')) {
    const r = ledgerRow(state, state.board);
    rows.push({ key: 'ledger', icon: '📒', name: 'Ledger', value: r === null ? 'reveal a tile to read its row' : `reading row ${r + 1}`, tone: r === null ? 'info' : 'ok', title: 'The row you last revealed in shows its bomb total at the board edge' });
  }

  // ── Cycle rules ──
  const collateralNeed = state.deadline * COLLATERAL_DEPOSIT_FRAC;
  if (state.deposited >= collateralNeed) rows.push({ key: 'collateral', icon: '🏦', name: 'Collateral', value: '−1 bomb this cycle', tone: 'ok', title: `At least ${Math.round(COLLATERAL_DEPOSIT_FRAC * 100)}% of the deadline is deposited — every board this cycle deals one fewer bomb` });
  else if (state.phase === 'BET') rows.push({ key: 'collateral', icon: '🏦', name: 'Collateral', value: `deposit $${Math.ceil(collateralNeed - state.deposited)} more for −1 bomb`, tone: 'info', title: `Deposit ${Math.round(COLLATERAL_DEPOSIT_FRAC * 100)}% of the deadline and every board this cycle deals one fewer bomb` });
  if (state.active_boss === 'curfew' && inAttempt) rows.push({ key: 'curfew', icon: '⏰', name: 'Curfew', value: `${Math.max(0, CURFEW_CLICKS - state.clicks_this_attempt)} clicks left`, tone: 'warn', title: 'The attempt cashes out on its own when the clicks run out' });
  if (state.active_boss === 'saboteur' && inAttempt) rows.push({ key: 'sab', icon: '🧨', name: 'Saboteur', value: `arms a bomb in ${4 - (state.tiles_cleared % 4)} clears`, tone: 'warn', title: 'Every 4th symbol cleared turns a hidden tile into a bomb' });

  // ── Modifiers: permanent traits + this cycle's pick ──
  for (const id of state.traits) { const d = EVENT_CARD_MAP[id]; rows.push({ key: `trait-${id}`, icon: d.emoji, name: d.name, value: 'trait · all run', tone: 'ok', title: `${d.description} — permanent this run` }); }
  for (const id of state.cycle_events) { const d = EVENT_CARD_MAP[id]; rows.push({ key: `cycle-${id}`, icon: d.emoji, name: d.name, value: 'this cycle', tone: 'info', title: `${d.description} — this cycle only` }); }
  return rows;
}

const TONE: Record<NonNullable<RuleRow['tone']>, string> = { ok: 'var(--green-bright)', warn: 'var(--gold-bright)', bad: 'var(--red)', info: 'var(--text-muted)' };

interface Props {
  state: GameState;
}

export function HUD({ state }: Props) {
  const boss = state.active_boss ? BOSS_MAP[state.active_boss] : null;
  const deductionGain = state.relics.includes('logician') ? LOGICIAN_MULT_GAIN : DEDUCTION_MULT_GAIN;

  return (
    <div className="flex flex-col gap-2.5">

      {/* Mult + streak — top of the right panel */}
      <div className="stat-card flex items-center justify-between">
        <div>
          <div className="font-mono text-xs" style={{ color: 'var(--text-muted)', letterSpacing: '0.12em' }}>MULT</div>
          <div className="font-display text-3xl leading-none mt-1" style={{ color: '#f97316' }}>
            ×{state.multiplier.toFixed(1)}
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-xs" style={{ color: 'var(--text-muted)', letterSpacing: '0.12em' }}>🔥 STREAK</div>
          <div
            className="font-display text-3xl leading-none mt-1"
            style={{ color: state.streak >= 10 ? '#f97316' : state.streak >= 5 ? 'var(--gold)' : 'var(--text-primary)' }}
          >
            {state.streak}
          </div>
          {/* milestone pips: 5 / 10 / 15 */}
          <div className="flex gap-1 mt-1.5 justify-end">
            {[5, 10, 15].map(m => (
              <div key={m} className={`pip ${state.streak >= m ? 'pip-lit' : ''}`} title={`streak ${m}`} />
            ))}
          </div>
        </div>
      </div>

      {/* Deduction — proven clicks build a second streak that feeds the multiplier */}
      <div className="stat-card flex items-center justify-between" title={`A click is PROVEN when the visible numbers make it certainly safe. Each proven click adds +${deductionGain.toFixed(2)} mult; a guess resets both streaks.`}>
        <div>
          <div className="font-mono text-xs" style={{ color: 'var(--text-muted)', letterSpacing: '0.12em' }}>🧠 PROVEN</div>
          <div className="font-display text-3xl leading-none mt-1" style={{ color: state.deduction_streak > 0 ? 'var(--green-bright)' : 'var(--text-primary)' }}>
            {state.deduction_streak}
          </div>
        </div>
        <div className="text-right font-mono text-xs leading-snug" style={{ color: 'var(--text-muted)' }}>
          <div><span style={{ color: 'var(--green-bright)' }}>{state.proven_clicks}</span> proven · <span style={{ color: state.guess_clicks > 0 ? 'var(--gold)' : 'var(--text-muted)' }}>{state.guess_clicks}</span> guess</div>
          <div style={{ color: 'var(--text-dim)' }}>+{deductionGain.toFixed(2)} mult each</div>
        </div>
      </div>

      {/* Boss rule card */}
      {boss && (
        <div className="stat-card stat-card-boss flex items-start gap-2.5">
          <span className="text-3xl leading-none">{boss.emoji}</span>
          <div className="min-w-0">
            <div className="font-display text-base leading-tight" style={{ color: 'var(--red)', letterSpacing: '0.05em' }}>
              {boss.name.toUpperCase()}
            </div>
            <div className="font-mono text-xs mt-0.5 leading-snug" style={{ color: 'var(--text-muted)' }}>
              {boss.description}
            </div>
          </div>
        </div>
      )}

      {/* Attempts */}
      <div className="stat-card flex items-center justify-between">
        <span className="font-mono text-xs" style={{ color: 'var(--text-muted)', letterSpacing: '0.12em' }}>ATTEMPTS</span>
        <div className="flex gap-2 items-center">
          {Array.from({ length: attemptsForCycle(state.cycle_number, state.active_boss) }).map((_, i) => (
            <span key={i} className="text-base leading-none" style={{ opacity: i < state.attempts_remaining ? 1 : 0.2 }}>
              💣
            </span>
          ))}
        </div>
      </div>

      {/* ACTIVE RULES — every rule with live state: skills, stateful relics, cycle rules, modifiers */}
      <div className="stat-card">
        <div className="font-mono text-xs mb-1.5" style={{ color: 'var(--text-muted)', letterSpacing: '0.12em' }}>ACTIVE RULES</div>
        <div className="flex flex-col gap-1">
          {activeRules(state).map(r => (
            <div key={r.key} className="flex items-center gap-1.5 font-mono text-xs" title={r.title}>
              <span className="text-sm leading-none w-4 text-center">{r.icon}</span>
              <span className="truncate" style={{ color: 'var(--text-primary)' }}>{r.name}</span>
              <span className="ml-auto text-right shrink-0" style={{ color: TONE[r.tone ?? 'info'] }}>{r.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Next-boss hint on the cycle before a boss */}
      {!state.active_boss && isBossCycle(state.cycle_number + 1) && (
        <div className="font-mono text-xs text-center py-1 rounded" style={{ color: 'var(--red)', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)' }}>
          ⚠ boss next cycle — prep in the shop
        </div>
      )}
    </div>
  );
}
