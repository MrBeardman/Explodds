// Placeholder SFX generator — `npm run sfx`
//
// Synthesizes simple arcade-style WAVs into public/sfx/. These are stand-ins:
// drop licensed/produced files with the SAME NAMES into public/sfx/ to replace
// them — src/sound.ts loads by filename and needs no code change.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'sfx');
mkdirSync(OUT, { recursive: true });

const RATE = 44100;

// ─── WAV writer (16-bit PCM mono) ─────────────────────────────────────────────

function writeWav(name, samples) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);        // PCM
  buf.writeUInt16LE(1, 22);        // mono
  buf.writeUInt32LE(RATE, 24);
  buf.writeUInt32LE(RATE * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  writeFileSync(join(OUT, `${name}.wav`), buf);
  console.log(`  ${name}.wav (${(buf.length / 1024).toFixed(1)} kB)`);
}

// ─── Synth helpers ────────────────────────────────────────────────────────────

const sec = s => Math.floor(s * RATE);

/** A tone with attack/decay envelope. shape: 'sine' | 'square' | 'saw' | 'tri' */
function tone(freq, dur, { shape = 'sine', vol = 1, attack = 0.005, slideTo = null } = {}) {
  const n = sec(dur);
  const out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const f = slideTo === null ? freq : freq + (slideTo - freq) * t;
    phase += (2 * Math.PI * f) / RATE;
    let v;
    const p = phase % (2 * Math.PI);
    if (shape === 'square')   v = p < Math.PI ? 1 : -1;
    else if (shape === 'saw') v = (p / Math.PI) - 1;
    else if (shape === 'tri') v = p < Math.PI ? (2 * p / Math.PI) - 1 : 3 - (2 * p / Math.PI);
    else                      v = Math.sin(phase);
    const env = Math.min(1, i / sec(attack)) * Math.pow(1 - t, 1.8);
    out[i] = v * env * vol;
  }
  return out;
}

function noise(dur, { vol = 1, lowpass = 0.3 } = {}) {
  const n = sec(dur);
  const out = new Float32Array(n);
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    prev = prev + lowpass * ((Math.random() * 2 - 1) - prev);
    out[i] = prev * Math.pow(1 - t, 2.2) * vol;
  }
  return out;
}

/** Concatenate segments with optional gaps (in seconds) */
function seq(...parts) {
  const total = parts.reduce((s, p) => s + (typeof p === 'number' ? sec(p) : p.length), 0);
  const out = new Float32Array(total);
  let at = 0;
  for (const p of parts) {
    if (typeof p === 'number') { at += sec(p); continue; }
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** Mix arrays (sum, same start) */
function mix(...arrs) {
  const n = Math.max(...arrs.map(a => a.length));
  const out = new Float32Array(n);
  for (const a of arrs) for (let i = 0; i < a.length; i++) out[i] += a[i];
  return out;
}

// ─── The sounds ───────────────────────────────────────────────────────────────

console.log(`Generating placeholder SFX → ${OUT}`);

// UI click
writeWav('click', tone(1000, 0.04, { shape: 'square', vol: 0.25 }));

// Board dealt
writeWav('reveal', seq(
  tone(500, 0.05, { vol: 0.4 }), tone(700, 0.05, { vol: 0.4 }), tone(900, 0.07, { vol: 0.4 })
));

// Symbol tile (pitch is varied at play time via playbackRate)
writeWav('symbol', mix(
  tone(660, 0.12, { vol: 0.5 }),
  tone(990, 0.09, { vol: 0.2 })
));

// Empty tile — dull thud
writeWav('empty', mix(
  tone(150, 0.12, { shape: 'tri', vol: 0.5, slideTo: 90 }),
  noise(0.05, { vol: 0.12, lowpass: 0.15 })
));

// Bomb — noise burst + falling boom
writeWav('bomb', mix(
  noise(0.45, { vol: 0.8, lowpass: 0.5 }),
  tone(160, 0.5, { shape: 'saw', vol: 0.5, slideTo: 40 })
));

// Cashout — rising coin arpeggio
writeWav('cashout', seq(
  tone(523, 0.09, { vol: 0.45 }), tone(659, 0.09, { vol: 0.45 }),
  tone(784, 0.09, { vol: 0.45 }), tone(1047, 0.16, { vol: 0.5 })
));

// Combo — fast fanfare
writeWav('combo', seq(
  tone(587, 0.07, { shape: 'square', vol: 0.28 }), tone(740, 0.07, { shape: 'square', vol: 0.28 }),
  tone(880, 0.07, { shape: 'square', vol: 0.28 }), tone(1175, 0.18, { shape: 'square', vol: 0.3 })
));

// Streak milestone — dual chime
writeWav('milestone', mix(
  tone(880, 0.25, { vol: 0.4 }),
  tone(1320, 0.2, { vol: 0.25 })
));

// Shop purchase
writeWav('buy', seq(
  tone(440, 0.06, { vol: 0.4 }), tone(660, 0.1, { vol: 0.45 })
));

// Boss intro — ominous low sting (minor second rumble)
writeWav('boss', mix(
  tone(110, 0.8, { shape: 'saw', vol: 0.45 }),
  tone(116.5, 0.8, { shape: 'saw', vol: 0.35 }),
  seq(0.35, tone(220, 0.45, { shape: 'square', vol: 0.15, slideTo: 210 }))
));

// Game over — descending line
writeWav('gameover', seq(
  tone(440, 0.22, { vol: 0.45 }), tone(370, 0.22, { vol: 0.45 }),
  tone(311, 0.22, { vol: 0.45 }), tone(220, 0.5, { vol: 0.5, slideTo: 196 })
));

console.log('Done. Replace any file in public/sfx/ with a licensed one of the same name.');
