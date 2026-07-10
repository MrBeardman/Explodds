import { useEffect, useState } from 'react';

interface Props {
  hasProgress: boolean;
  onConfirm: () => void;
}

// Always-visible way back to the mode-select screen. Mirrors the two-click
// arm/confirm pattern already used by Standard mode's END_GAME button — but
// unlike END_GAME (hidden at START/GAME_OVER), this is always present since
// there's always a menu to go back to. No confirm needed when there's nothing
// to lose (hasProgress=false).
export function BackToMenuButton({ hasProgress, onConfirm }: Props) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);

  const handleClick = () => {
    if (!hasProgress) { onConfirm(); return; }
    if (armed) { setArmed(false); onConfirm(); }
    else setArmed(true);
  };

  return (
    <button
      onClick={handleClick}
      title={armed ? 'Click again to confirm' : 'Back to menu'}
      className="chip font-mono text-sm cursor-pointer"
      style={{ color: armed ? 'var(--red)' : 'var(--text-muted)' }}
    >
      {armed ? 'CONFIRM?' : '☰ MENU'}
    </button>
  );
}
