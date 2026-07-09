import { useState } from 'react';
import type { GameState, ConsumableId, RelicId, SymbolBoost } from '../types';
import { BOSS_MAP, SYMBOL_MAP, PACK_TYPE_INFO, PACK_THEMES, calcDeadline } from '../constants';
import { getBossForCycle, getConsumablePrice } from '../gameLogic';
import { Paytable } from './Paytable';

interface Props {
  state: GameState;
  onBuyConsumable: (id: ConsumableId) => void;
  onBuyRelic: (id: RelicId) => void;
  onBuyPack: (index: number) => void;
  onPickPackBoost: (boost: SymbolBoost) => void;
  onSkipPackBoost: () => void;
  onBuyRelicCase: () => void;
  onRerollConsumables: () => void;
  onRerollRelics: () => void;
  onRerollPacks: () => void;
  onNextCycle: () => void;
}

export function Shop({
  state, onBuyConsumable, onBuyRelic, onBuyPack, onPickPackBoost, onSkipPackBoost,
  onBuyRelicCase,
  onRerollConsumables, onRerollRelics, onRerollPacks, onNextCycle,
}: Props) {
  const nextCycle = state.cycle_number + 1;
  const nextBossId = getBossForCycle(state.seed, nextCycle);
  const nextBoss = nextBossId ? BOSS_MAP[nextBossId] : null;
  let nextDeadline = calcDeadline(nextCycle);
  if (nextBossId === 'inflator') nextDeadline = Math.round((nextDeadline * 1.25) / 10) * 10;

  const relicsFull = state.relics.length >= state.max_relic_slots;
  const opening = state.pending_pack_choices !== null;
  const openingAxis = opening ? state.pending_pack_choices![0]?.axis : null;
  const [showOdds, setShowOdds] = useState(false);

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center p-4 overlay-in"
      style={{ background: 'rgba(4,6,10,0.88)' }}
    >
      <div
        className="card-rise w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl flex flex-col"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-4 text-center" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="font-display text-3xl" style={{ color: 'var(--gold)', letterSpacing: '0.1em' }}>
            CYCLE {state.cycle_number} CLEARED
          </div>
          <div className="flex justify-center gap-4 font-mono text-xs mt-1.5">
            <span style={{ color: 'var(--green)' }}>Paid ${state.deadline}</span>
            {state.interest_earned_this_cycle > 0 && (
              <span style={{ color: 'var(--gold)' }}>+${state.interest_earned_this_cycle.toFixed(2)} INTEREST ✦</span>
            )}
          </div>
          <div className="flex justify-center items-center gap-3 mt-3">
            <span className="chip font-mono text-sm" style={{ color: 'var(--gold)' }}>💵 ${Math.floor(state.wallet)}</span>
            <span className="chip font-mono text-sm" style={{ color: '#60c0ff' }}>🎫 {state.tickets}</span>
            <button
              onClick={() => setShowOdds(v => !v)}
              title="Check current odds & payouts before buying packs"
              className="chip font-mono text-sm cursor-pointer"
              style={{ color: showOdds ? 'var(--gold)' : 'var(--text-muted)' }}
            >
              👁 ODDS
            </button>
          </div>
        </div>

        {/* Odds/payout peek — same live data as the in-game Paytable, so you don't
            have to remember it while deciding on packs */}
        {showOdds && (
          <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <Paytable state={state} />
          </div>
        )}

        {/* Pack opening reveal — takes over the shop until all picks are made */}
        {opening && openingAxis && (
          <div className="px-6 py-6 flex flex-col items-center gap-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="font-display text-lg text-center" style={{ color: 'var(--gold)', letterSpacing: '0.08em' }}>
              {PACK_TYPE_INFO[openingAxis].emoji} PICK {state.pending_pack_picks_remaining > 1 ? `${state.pending_pack_picks_remaining} SYMBOLS` : 'A SYMBOL'} — {PACK_TYPE_INFO[openingAxis].name.toUpperCase()}
            </div>
            <div className="flex gap-3 flex-wrap justify-center">
              {state.pending_pack_choices!.map((boost, i) => {
                const def = SYMBOL_MAP[boost.symbol];
                const label = boost.axis === 'frequency' ? '×1.5 appearance rate' : '×1.25 payout';
                return (
                  <button
                    key={i}
                    onClick={() => onPickPackBoost(boost)}
                    className="choice-card flex flex-col items-center gap-2 p-4 w-36"
                  >
                    <span className="text-4xl leading-none">{def.emoji}</span>
                    <span className="font-mono text-xs" style={{ color: 'var(--text-primary)' }}>{def.name}</span>
                    <span className="font-mono text-xs font-bold" style={{ color: boost.axis === 'frequency' ? '#60a5fa' : 'var(--gold)' }}>
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
            <button
              onClick={onSkipPackBoost}
              className="font-mono text-xs cursor-pointer px-4 py-2 rounded-lg transition-colors duration-150"
              style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
            >
              SKIP — keep none of these
            </button>
          </div>
        )}

        {/* Consumables — on top */}
        <ShopSection
          title="CONSUMABLES · pay 💵"
          rerolled={state.shop_consumables_rerolled}
          canReroll={state.tickets >= 2}
          onReroll={onRerollConsumables}
        >
          {state.shop_consumables.map(item => {
            const price = getConsumablePrice(state, item.price);
            const affordable = !item.sold && state.wallet >= price;
            return (
              <ItemCard
                key={item.id}
                emoji={item.emoji}
                name={item.name}
                description={item.description}
                priceLabel={item.sold ? 'SOLD' : `$${price}`}
                discounted={price < item.price && !item.sold}
                disabled={!affordable}
                onBuy={() => onBuyConsumable(item.id)}
              />
            );
          })}
        </ShopSection>

        {/* Packs — 3 slots, each randomly frequency/payout/themed, some "huge" */}
        <ShopSection
          title="PACKS · pay 💵 · permanent symbol boosts"
          rerolled={state.shop_packs_rerolled}
          canReroll={state.tickets >= 2 && !opening}
          onReroll={onRerollPacks}
        >
          {state.shop_packs.map((pack, i) => {
            const affordable = !pack.sold && state.wallet >= pack.price && !opening;
            if (pack.kind === 'themed') {
              const theme = PACK_THEMES[pack.symbol!];
              const symDef = SYMBOL_MAP[pack.symbol!];
              return (
                <ItemCard
                  key={i}
                  emoji={theme.emoji}
                  name={`${theme.name} (${symDef.name})`}
                  description={`Guaranteed ${symDef.name} — ×1.5 frequency AND ×1.25 payout, permanently`}
                  priceLabel={pack.sold ? 'SOLD' : `$${pack.price}`}
                  disabled={!affordable}
                  onBuy={() => onBuyPack(i)}
                />
              );
            }
            const info = PACK_TYPE_INFO[pack.kind];
            return (
              <ItemCard
                key={i}
                emoji={info.emoji}
                name={pack.huge ? `${info.name} (Huge)` : info.name}
                description={pack.huge ? `${info.description} — huge pack: 5 choices instead of 3` : info.description}
                priceLabel={pack.sold ? 'SOLD' : `$${pack.price}`}
                rarity={pack.huge ? 'rare' : undefined}
                disabled={!affordable}
                onBuy={() => onBuyPack(i)}
              />
            );
          })}
        </ShopSection>

        {/* Relics — Relic Case is listed here too, not a separate section */}
        <ShopSection
          title={`RELICS · pay 🎫 ${relicsFull ? '· shelf full!' : ''}`}
          rerolled={state.shop_relics_rerolled}
          canReroll={state.tickets >= 2}
          onReroll={onRerollRelics}
        >
          {state.shop_relics.map(item => (
            <ItemCard
              key={item.id}
              emoji={item.emoji}
              name={item.name}
              description={item.description}
              priceLabel={item.sold ? 'SOLD' : `${item.cost}🎫`}
              rarity={item.rarity}
              disabled={item.sold || relicsFull || state.tickets < item.cost}
              onBuy={() => onBuyRelic(item.id)}
            />
          ))}
          {state.shop_relic_case && (
            <ItemCard
              emoji="🧰"
              name="Relic Case"
              description={`Permanently raise your relic shelf from ${state.max_relic_slots} to ${state.max_relic_slots + 1}`}
              priceLabel={state.shop_relic_case.sold ? 'SOLD' : `${state.shop_relic_case.price}🎫`}
              disabled={state.shop_relic_case.sold || state.tickets < state.shop_relic_case.price}
              onBuy={onBuyRelicCase}
            />
          )}
        </ShopSection>

        {/* Footer — next cycle preview + start */}
        <div className="px-6 py-4 flex items-center justify-between gap-4" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="min-w-0">
            <div className="font-mono text-xs" style={{ color: 'var(--text-muted)', letterSpacing: '0.12em' }}>
              NEXT: CYCLE {nextCycle} · DEADLINE <span style={{ color: 'var(--red)' }}>${nextDeadline}</span>
            </div>
            {nextBoss ? (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xl leading-none">{nextBoss.emoji}</span>
                <div>
                  <span className="font-display text-sm" style={{ color: 'var(--red)', letterSpacing: '0.05em' }}>
                    {nextBoss.name.toUpperCase()}
                  </span>
                  <span className="font-mono text-xs ml-2" style={{ color: 'var(--text-muted)' }}>
                    {nextBoss.description}
                  </span>
                </div>
              </div>
            ) : (
              <div className="font-mono text-xs mt-1" style={{ color: 'var(--text-dim)' }}>
                normal cycle — you'll pick a modifier
              </div>
            )}
          </div>
          <button
            onClick={onNextCycle}
            disabled={opening}
            className="font-display text-xl px-8 py-3 rounded-xl shrink-0 transition-all duration-150 glow-green"
            style={{
              background: opening ? 'var(--bg-card)' : 'var(--green)',
              color: opening ? 'var(--text-dim)' : '#000',
              letterSpacing: '0.08em',
              cursor: opening ? 'default' : 'pointer',
            }}
            onMouseEnter={e => { if (!opening) e.currentTarget.style.background = 'var(--green-bright)'; }}
            onMouseLeave={e => { if (!opening) e.currentTarget.style.background = 'var(--green)'; }}
          >
            START CYCLE {nextCycle}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function ShopSection({
  title, rerolled, canReroll, onReroll, children,
}: {
  title: string;
  rerolled: boolean;
  canReroll: boolean;
  onReroll: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-xs" style={{ color: 'var(--text-muted)', letterSpacing: '0.15em' }}>{title}</span>
        <button
          onClick={onReroll}
          disabled={rerolled || !canReroll}
          className={`font-mono text-xs px-2.5 py-1 rounded ${rerolled || !canReroll ? 'cursor-default' : 'cursor-pointer'}`}
          style={{
            background: 'var(--bg-raised)',
            border: '1px solid var(--border)',
            color: rerolled || !canReroll ? 'var(--text-dim)' : '#60c0ff',
          }}
        >
          {rerolled ? 'REROLLED' : '↻ REROLL 2🎫'}
        </button>
      </div>
      <div className="flex gap-2.5 flex-wrap">{children}</div>
    </div>
  );
}

// ─── Item card ────────────────────────────────────────────────────────────────

function ItemCard({
  emoji, name, description, priceLabel, rarity, discounted, disabled, onBuy,
}: {
  emoji: string;
  name: string;
  description: string;
  priceLabel: string;
  rarity?: 'common' | 'rare' | 'legendary';
  discounted?: boolean;
  disabled: boolean;
  onBuy: () => void;
}) {
  const rarityBorder = { common: '#5a6478', rare: '#3b82f6', legendary: 'var(--gold)' };
  return (
    <button
      onClick={onBuy}
      disabled={disabled}
      title={description}
      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl w-[104px] transition-all duration-150 ${rarity ? `rarity-${rarity}` : ''} ${disabled ? 'opacity-45 cursor-default' : 'cursor-pointer hover:-translate-y-1'}`}
      style={{ background: 'var(--bg-card)', border: `1px solid ${rarity ? rarityBorder[rarity] : 'var(--border)'}` }}
    >
      <span className="text-3xl leading-none">{emoji}</span>
      <span className="font-mono text-xs text-center leading-tight" style={{ color: 'var(--text-primary)' }}>
        {name}
      </span>
      <span className="font-mono text-xs font-bold" style={{ color: discounted ? 'var(--green-bright)' : 'var(--gold)' }}>
        {priceLabel}{discounted ? ' ✂' : ''}
      </span>
    </button>
  );
}
