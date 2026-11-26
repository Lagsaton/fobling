// Little synthesized sounds (no audio files) and vibration.
let ctx = null;
let muted = false;
try {
  muted = localStorage.getItem('fobling.muted') === '1';
} catch {
  /* private mode */
}

export const isMuted = () => muted;
export function setMuted(m) {
  muted = m;
  try {
    localStorage.setItem('fobling.muted', m ? '1' : '0');
  } catch {
    /* ignore */
  }
}

function ac() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** Call from any tap so later sounds (like the hatch) are allowed to play. */
export function unlock() {
  if (!muted) ac();
}

function tone(freq, dur, { at = 0, type = 'sine', vol = 0.16, to = null } = {}) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime + at;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur, { at = 0, vol = 0.2, freq = 2500 } = {}) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime + at;
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = a.createBufferSource();
  const f = a.createBiquadFilter();
  const g = a.createGain();
  src.buffer = buf;
  f.type = 'bandpass';
  f.frequency.value = freq;
  g.gain.value = vol;
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
}

const SOUNDS = {
  feed() {
    noise(0.07, { freq: 1200, vol: 0.35 });
    noise(0.07, { at: 0.15, freq: 1000, vol: 0.35 });
    tone(520, 0.12, { at: 0.3, type: 'triangle', to: 780 });
  },
  play() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.14, { at: i * 0.08, type: 'triangle' }));
  },
  wash() {
    [0, 0.09, 0.2, 0.28].forEach((at, i) => tone(400 + i * 140, 0.12, { at, to: 900 + i * 200, vol: 0.1 }));
  },
  poke() {
    tone(660, 0.09, { type: 'triangle', to: 990, vol: 0.12 });
    tone(880, 0.1, { at: 0.08, type: 'triangle', to: 1320, vol: 0.1 });
  },
  pat() {
    tone(784, 0.18, { type: 'sine', vol: 0.12 });
    tone(1175, 0.24, { at: 0.1, type: 'sine', vol: 0.1 });
  },
  saved() {
    tone(880, 0.08, { type: 'square', vol: 0.05 });
    tone(1320, 0.12, { at: 0.07, type: 'square', vol: 0.05 });
  },
  error() {
    tone(220, 0.25, { type: 'sawtooth', to: 140, vol: 0.06 });
  },
  sad() {
    tone(440, 0.3, { type: 'triangle', to: 330, vol: 0.1 });
    tone(330, 0.4, { at: 0.28, type: 'triangle', to: 247, vol: 0.1 });
  },
  crack() {
    noise(0.05, { freq: 3500, vol: 0.5 });
    tone(180, 0.06, { type: 'square', vol: 0.05 });
  },
  rise() {
    tone(200, 2.6, { type: 'sawtooth', to: 1400, vol: 0.035 });
    tone(300, 2.6, { type: 'sine', to: 2100, vol: 0.06 });
  },
  reveal() {
    [523, 659, 784].forEach((f) => tone(f, 0.9, { type: 'triangle', vol: 0.09 }));
    [1047, 1319, 1568, 2093].forEach((f, i) => tone(f, 0.25, { at: 0.12 + i * 0.07, type: 'sine', vol: 0.07 }));
  },
};

export function play(name) {
  if (muted || !SOUNDS[name]) return;
  try {
    SOUNDS[name]();
  } catch {
    /* audio is a nice-to-have */
  }
}

export function buzz(pattern) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* not supported */
  }
}
