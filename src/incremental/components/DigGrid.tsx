import { digAdjacentBombCount } from '../digLogic';
import type { DigTile, OreTierId } from '../types';

interface Props {
  board: DigTile[];
  cols: number;
  clickable: boolean;
  suppressAdjacency?: boolean; // Fog boss: empty tiles show no numbers this level
  onTileClick: (index: number) => void;
}

const ADJ_COLORS = ['', '#60a5fa', '#4ade80', '#f87171', '#c084fc', '#fb923c', '#f472b6', '#facc15', '#f87171'];

const ORE_ICONS: Record<OreTierId, string> = {
  dirt: '🟫', copper: '🟠', silver: '⚪', gold: '🟡', platinum: '⚙️', diamond: '💎',
};
const ORE_COLORS: Record<OreTierId, string> = {
  dirt: 'var(--green-bright)', copper: '#f0a860', silver: '#d4d4d8', gold: '#facc15',
  platinum: '#93c5fd', diamond: '#67e8f9',
};

export function DigGrid({ board, cols, clickable, suppressAdjacency = false, onTileClick }: Props) {
  return (
    <div
      className="grid gap-1.5 w-full max-w-[30rem]"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {board.map(tile => (
        <DigGridTile
          key={tile.index}
          tile={tile}
          adjacentBombs={tile.state === 'revealed' && tile.type === 'empty' && !suppressAdjacency ? digAdjacentBombCount(board, tile.index, cols) : 0}
          clickable={clickable}
          onClick={() => onTileClick(tile.index)}
        />
      ))}
    </div>
  );
}

function DigGridTile({ tile, adjacentBombs, clickable, onClick }: { tile: DigTile; adjacentBombs: number; clickable: boolean; onClick: () => void }) {
  const isHidden = tile.state === 'hidden';
  const isHinted = tile.state === 'hinted';
  const isCracked = tile.state === 'cracked';
  const isRevealed = tile.state === 'revealed';
  const isClickable = (isHidden || isHinted || isCracked) && clickable;

  let bg = 'var(--bg-card)';
  let borderColor = 'var(--border)';

  if (isRevealed && tile.type === 'bomb') {
    bg = 'rgba(180,30,30,0.5)';
    borderColor = 'var(--red)';
  } else if (isRevealed && tile.type === 'dirt') {
    const tier = tile.oreTier ?? 'dirt';
    bg = tier === 'dirt' ? 'rgba(20,30,50,0.8)' : 'rgba(200,120,40,0.18)';
    borderColor = tier === 'dirt' ? 'rgba(255,255,255,0.08)' : ORE_COLORS[tier];
  } else if (isRevealed) {
    bg = 'rgba(30,30,30,0.6)';
    borderColor = 'rgba(255,255,255,0.04)';
  } else if (isCracked) {
    bg = 'rgba(120,90,40,0.15)';
    borderColor = 'rgba(200,150,60,0.5)';
  } else if (isHinted) {
    bg = 'rgba(220,38,38,0.10)';
    borderColor = 'rgba(220,38,38,0.55)';
  }

  return (
    <button
      onClick={onClick}
      disabled={!isClickable}
      style={{ background: bg, borderColor, cursor: isClickable ? 'pointer' : 'default' }}
      className={[
        'aspect-square rounded-xl border-2 flex items-center justify-center relative tile-entrance',
        isClickable ? 'hover:scale-110 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/40 transition-transform duration-100' : '',
      ].join(' ')}
    >
      <DigTileContent tile={tile} adjacentBombs={adjacentBombs} />
    </button>
  );
}

function DigTileContent({ tile, adjacentBombs }: { tile: DigTile; adjacentBombs: number }) {
  if (tile.state === 'revealed' && tile.type === 'bomb') {
    return <span className="text-2xl leading-none">💣</span>;
  }
  if (tile.state === 'revealed' && tile.type === 'dirt') {
    const tier = tile.oreTier ?? 'dirt';
    return (
      <div className="flex flex-col items-center leading-none">
        <span className="text-lg">{ORE_ICONS[tier]}</span>
        <span className="font-mono text-[10px] font-bold" style={{ color: ORE_COLORS[tier] }}>
          ${tile.cashValue?.toFixed(2)}
        </span>
      </div>
    );
  }
  if (tile.state === 'revealed') {
    return adjacentBombs > 0 ? <span className="font-mono font-bold text-xl" style={{ color: ADJ_COLORS[adjacentBombs] }}>{adjacentBombs}</span> : null;
  }
  if (tile.state === 'cracked') {
    // Durability: shows a crack + hits remaining, still hidden underneath
    return (
      <div className="flex flex-col items-center leading-none">
        <span className="text-lg" style={{ opacity: 0.7 }}>⛏️</span>
        <span className="font-mono text-[10px] font-bold" style={{ color: '#f0a860' }}>
          {Math.max(0, tile.toughness - tile.hitsTaken)}
        </span>
      </div>
    );
  }
  if (tile.state === 'hinted') {
    return <span className="text-lg" style={{ opacity: 0.85 }}>⚠️</span>;
  }
  return null;
}
