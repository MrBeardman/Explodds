// File-based SFX manager. Files live in public/sfx/<name>.wav — regenerate
// placeholders with `npm run sfx`, or drop in licensed files with the same names.
// Missing files and blocked autoplay fail silently.

export type SfxName =
  | 'reveal' | 'symbol' | 'empty' | 'bomb' | 'cashout' | 'combo'
  | 'milestone' | 'buy' | 'boss' | 'click' | 'gameover';

const MUTE_KEY = 'explodds_muted';

let muted = false;
try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch { /* SSR/privacy mode */ }

const cache: Partial<Record<SfxName, HTMLAudioElement>> = {};

export function isMuted(): boolean {
  return muted;
}

export function setMuted(m: boolean): void {
  muted = m;
  try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch { /* ignore */ }
}

export function playSfx(name: SfxName, opts?: { rate?: number; volume?: number }): void {
  if (muted) return;
  try {
    let base = cache[name];
    if (!base) {
      base = new Audio(`${import.meta.env.BASE_URL}sfx/${name}.wav`);
      base.preload = 'auto';
      cache[name] = base;
    }
    // Clone so rapid repeats overlap instead of restarting
    const node = base.cloneNode(true) as HTMLAudioElement;
    node.playbackRate = opts?.rate ?? 1;
    node.volume = opts?.volume ?? 0.5;
    void node.play().catch(() => { /* not loaded yet or no user gesture */ });
  } catch { /* stay silent */ }
}
