import { useLayoutEffect, useRef, useState } from 'react';
import { DIG_UPGRADES, isDigUpgradeRevealed, loadDigMeta, purchaseDigUpgrade, type DigMetaProgress, type DigUpgradeNode } from '../digMeta';
import type { DigUpgradeId } from '../types';
import { playSfx } from '../../sound';

interface Props {
  onClose: () => void;
  onPlayAgain: () => void;
}

interface TreeCtx {
  meta: DigMetaProgress;
  childrenOf: (id: DigUpgradeId) => DigUpgradeNode[];
  levelOf: (id: DigUpgradeId) => number;
  onBuy: (id: DigUpgradeId) => void;
  registerNode: (id: DigUpgradeId) => (el: HTMLDivElement | null) => void;
}

type EdgePath = { id: string; x1: number; y1: number; x2: number; y2: number };

// Full-screen sibling view to DigHomeScreen (not a popup/overlay), reached
// straight from cash-out (see IncrementalGame.tsx) as well as from the home
// screen's UPGRADES button. Root-centered, fog-of-war tree: a node is not
// rendered AT ALL until isDigUpgradeRevealed(node, meta) is true (digMeta.ts —
// shared with the actual purchase gate so the two can't disagree). Connector
// lines are drawn by a single SVG overlay computed from each node's REAL
// measured DOM position (see edge-measurement effect below) rather than
// hand-placed CSS borders — that earlier approach couldn't cleanly express a
// multi-child T junction and drifted out of alignment whenever sibling nodes
// had different heights (e.g. a two-line name) or a purchase changed layout.
export function DigUpgradeTree({ onClose, onPlayAgain }: Props) {
  const [meta, setMeta] = useState<DigMetaProgress>(() => loadDigMeta());
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeEls = useRef<Map<DigUpgradeId, HTMLDivElement>>(new Map());
  const [edges, setEdges] = useState<EdgePath[]>([]);

  const root = DIG_UPGRADES.find(u => u.parentId === null)!;
  const childrenOf = (id: DigUpgradeId) => DIG_UPGRADES.filter(u => u.parentId === id);
  const levelOf = (id: DigUpgradeId) => meta.upgrades[id] ?? 0;
  const rootLevel = levelOf(root.id);

  const buy = (id: DigUpgradeId) => {
    const before = levelOf(id);
    const next = purchaseDigUpgrade(id);
    if ((next.upgrades[id] ?? 0) > before) playSfx('milestone');
    setMeta(next);
  };

  const registerNode = (id: DigUpgradeId) => (el: HTMLDivElement | null) => {
    if (el) nodeEls.current.set(id, el);
    else nodeEls.current.delete(id);
  };

  // Re-measure every visible parent→child pair after any render that could
  // have moved something: a purchase (meta changes), a node newly revealing
  // (also a meta change, same effect run), or a window resize. Measuring the
  // actual DOM instead of computing offsets by hand is what keeps the lines
  // straight regardless of asymmetric branch widths/heights.
  useLayoutEffect(() => {
    const measure = () => {
      const container = containerRef.current;
      if (!container) return;
      const cRect = container.getBoundingClientRect();
      const next: EdgePath[] = [];
      for (const node of DIG_UPGRADES) {
        if (node.parentId === null) continue;
        if (!isDigUpgradeRevealed(node, meta)) continue; // child not revealed
        const childEl = nodeEls.current.get(node.id);
        const parentEl = nodeEls.current.get(node.parentId);
        if (!childEl || !parentEl) continue;
        const c = childEl.getBoundingClientRect();
        const p = parentEl.getBoundingClientRect();
        const down = c.top >= p.top;
        next.push({
          id: node.id,
          x1: p.left + p.width / 2 - cRect.left,
          y1: (down ? p.bottom : p.top) - cRect.top,
          x2: c.left + c.width / 2 - cRect.left,
          y2: (down ? c.top : c.bottom) - cRect.top,
        });
      }
      setEdges(next);
    };

    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta]);

  // Root's direct branches split into two groups so the root can sit in the
  // middle with growth radiating both up and down, rather than everything
  // hanging below a top-anchored root. Durability II is the shallowest direct
  // branch (just Danger Sense/Scanner hanging off it) so it goes up; Dirt
  // Value and Pickaxe are the two deep "core progression" branches and stay
  // below, reading top-to-bottom like a normal skill path.
  const rootChildren = childrenOf(root.id);
  const upIds: DigUpgradeId[] = ['pickaxe_2'];
  const upBranches = rootChildren.filter(c => upIds.includes(c.id));
  const downBranches = rootChildren.filter(c => !upIds.includes(c.id));

  const ctx: TreeCtx = { meta, childrenOf, levelOf, onBuy: buy, registerNode };
  const nextRootCost = rootLevel < root.levels.length ? root.levels[rootLevel].cost : null;

  return (
    <div className="relative min-h-screen flex flex-col items-center p-6 overlay-in">
      <div className="text-center shrink-0 mt-2">
        <div className="font-display text-2xl" style={{ color: '#f0a860', letterSpacing: '0.08em' }}>
          UPGRADES
        </div>
        <div className="font-mono text-sm mt-1" style={{ color: 'var(--gold)' }}>
          💰 ${meta.cash_balance.toFixed(2)}
        </div>
      </div>

      <div ref={containerRef} className="relative flex-1 w-full flex flex-col items-center justify-center overflow-x-auto py-6 gap-4">
        <svg className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
          {edges.map(e => <ElbowPath key={e.id} {...e} />)}
        </svg>

        <TreeRow nodes={upBranches} direction="up" ctx={ctx} />

        <div ref={registerNode(root.id)}>
          <TreeNode
            emoji={root.emoji}
            name={root.name}
            description={root.description}
            level={rootLevel}
            maxLevel={root.levels.length}
            nextCost={nextRootCost}
            affordable={nextRootCost !== null && meta.cash_balance >= nextRootCost}
            onBuy={() => buy(root.id)}
          />
        </div>

        <TreeRow nodes={downBranches} direction="down" ctx={ctx} />
      </div>

      <div className="flex flex-col items-center gap-3 shrink-0 mb-2">
        <button
          onClick={onPlayAgain}
          className="font-display text-xl px-10 py-3 rounded-xl transition-all duration-200 cursor-pointer glow-green"
          style={{ background: 'var(--green)', color: '#000', letterSpacing: '0.1em' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--green-bright)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--green)')}
        >
          ⛏️ DIG AGAIN
        </button>
        <button
          onClick={onClose}
          className="font-mono text-xs cursor-pointer"
          style={{ color: 'var(--text-muted)' }}
        >
          BACK
        </button>
      </div>
    </div>
  );
}

// Straight-angle (elbow) connector between a parent's edge-center and a
// child's edge-center: out from the parent, one bend at the vertical
// midpoint, into the child — always axis-aligned (never a diagonal), and
// since every sibling's edge shares the same parent anchor point, several of
// these drawn together naturally read as one trunk fanning into a T/comb of
// horizontal branches, for any number of children.
function ElbowPath({ x1, y1, x2, y2 }: EdgePath) {
  const midY = (y1 + y2) / 2;
  const d = `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`;
  return <path d={d} stroke="var(--gold)" strokeWidth={2} fill="none" opacity={0.9} />;
}

// One generation of siblings, purely for layout spacing — no line-drawing
// here anymore (the SVG overlay owns that). Filters to only nodes that are
// actually revealed (isDigUpgradeRevealed) rather than taking a shared
// `revealed` boolean, since siblings under the same parent can now have
// different reveal requirements (e.g. Copper Vein needs Dirt Value MAXED,
// while Silver Vein just needs Copper Vein owned). `direction` controls
// which side of the node its own children render on ('up' branches must grow
// further up, away from the root, not back down toward it) and which edge
// siblings align to, so nodes at the same generation sit at the same height
// even when a neighboring branch is deeper/taller.
function TreeRow({ nodes, direction, ctx }: { nodes: DigUpgradeNode[]; direction: 'up' | 'down'; ctx: TreeCtx }) {
  const visible = nodes.filter(n => isDigUpgradeRevealed(n, ctx.meta));
  if (visible.length === 0) return null;
  return (
    <div className="flex gap-8" style={{ alignItems: direction === 'down' ? 'flex-start' : 'flex-end' }}>
      {visible.map(node => <TreeBranch key={node.id} node={node} direction={direction} ctx={ctx} />)}
    </div>
  );
}

// Recursive: a node plus (if it has children) a further row of its own
// children — stacked above it for 'up' branches, below it for 'down'
// branches. Whether any given child actually renders is decided by TreeRow
// (isDigUpgradeRevealed), not here.
function TreeBranch({ node, direction, ctx }: { node: DigUpgradeNode; direction: 'up' | 'down'; ctx: TreeCtx }) {
  const level = ctx.levelOf(node.id);
  const children = ctx.childrenOf(node.id);
  const nextCost = level < node.levels.length ? node.levels[level].cost : null;
  const affordable = nextCost !== null && ctx.meta.cash_balance >= nextCost;

  const nodeEl = (
    <div ref={ctx.registerNode(node.id)}>
      <TreeNode
        emoji={node.emoji}
        name={node.name}
        description={node.description}
        level={level}
        maxLevel={node.levels.length}
        nextCost={nextCost}
        affordable={affordable}
        onBuy={() => ctx.onBuy(node.id)}
      />
    </div>
  );
  const row = children.length > 0 && <TreeRow nodes={children} direction={direction} ctx={ctx} />;

  return (
    <div className="flex flex-col items-center gap-4">
      {direction === 'up' && row}
      {nodeEl}
      {direction === 'down' && row}
    </div>
  );
}

// Icon-only node: a small square, name below (fixed two-line height so
// single-line and wrapped names still bottom out at the same y — this is
// what kept siblings like Danger Sense/Scanner from visually sitting at
// different heights), price/MAXED below that. A row of small green segments
// along the bottom border shows level/maxLevel. `description` is exposed as
// a native hover tooltip (same convention as Paytable.tsx/DigHUD.tsx's boss
// card) so players can check exactly what a node does before spending —
// there's no room for description text in the compact icon-grid layout
// itself.
function TreeNode({
  emoji, name, description, level, maxLevel, nextCost, affordable, onBuy,
}: {
  emoji: string; name: string; description: string; level: number; maxLevel: number;
  nextCost: number | null; affordable: boolean; onBuy: () => void;
}) {
  const owned = level > 0;
  const maxed = nextCost === null;
  return (
    <button
      onClick={onBuy}
      disabled={maxed || !affordable}
      className="flex flex-col items-center gap-1.5 shrink-0"
      style={{ cursor: (!maxed && affordable) ? 'pointer' : 'default' }}
      title={`${name} — ${description}`}
    >
      <div
        className="relative w-14 h-14 rounded-lg flex items-center justify-center"
        style={{ background: 'var(--bg-card)', border: `2px solid ${owned ? 'var(--gold)' : 'var(--border)'}` }}
      >
        <span className="text-2xl leading-none">{emoji}</span>
        {maxLevel > 1 && (
          <div className="absolute left-1 right-1 flex gap-0.5" style={{ bottom: 3 }}>
            {Array.from({ length: maxLevel }).map((_, i) => (
              <div key={i} className="flex-1 rounded-sm" style={{ height: 3, background: i < level ? 'var(--green-bright)' : 'rgba(255,255,255,0.15)' }} />
            ))}
          </div>
        )}
      </div>
      <span
        className="font-mono text-[10px] text-center leading-tight w-16 flex items-center justify-center"
        style={{ color: 'var(--text-primary)', minHeight: '2.4em' }}
      >
        {name}
      </span>
      <span className="font-mono text-xs font-bold" style={{ color: maxed ? 'var(--green-bright)' : affordable ? 'var(--gold)' : 'var(--text-dim)' }}>
        {maxed ? 'MAXED' : `$${nextCost}`}
      </span>
    </button>
  );
}
