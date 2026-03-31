import type { ComboDisplay } from '../types';

interface Props {
  items: ComboDisplay[];
}

export function ComboOverlay({ items }: Props) {
  if (items.length === 0) return null;

  return (
    <div
      className="absolute top-2 left-1/2 z-10 flex flex-col items-center gap-1.5 pointer-events-none"
      style={{ transform: 'translateX(-50%)' }}
    >
      {items.map((item, idx) => (
        <div
          key={item.id}
          className="combo-pop flex items-center gap-2 px-4 py-2 rounded-xl whitespace-nowrap"
          style={{
            background: 'rgba(8,8,18,0.95)',
            border: `1px solid ${item.color}`,
            boxShadow: `0 0 14px ${item.color}55`,
            animationDelay: `${idx * 250}ms`,
          }}
        >
          <span className="font-display text-sm" style={{ color: item.color, letterSpacing: '0.06em' }}>
            {item.text}
          </span>
          <span className="font-mono font-bold text-sm" style={{ color: '#fff' }}>
            {item.amount}
          </span>
        </div>
      ))}
    </div>
  );
}
