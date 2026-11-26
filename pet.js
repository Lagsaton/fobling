// Fobling core: the pet's state, how it is packed into a URL, and how time treats it.
// No DOM here, so it runs (and is tested) in Node too.

export const VERSION = 1;
export const NAME_MAX = 10; // bytes (UTF-8)
export const NOTE_MAX = 20; // bytes (UTF-8)

// An NTAG213 holds 144 bytes. NDEF headers take ~8, and Android abbreviates
// "https://" to one byte, so a full URL of up to ~143 chars fits. Keep a margin.
export const URL_BUDGET = 134;

// Hours for each need to drain from full to empty.
export const HOURS = { food: 20, fun: 16, clean: 30 };
// Once food hits zero, how long it survives before dying.
export const STARVE_GRACE_H = 48;
// Minutes it spends as an egg.
export const EGG_MIN = 10;

// To grow into a stage it needs to be old enough AND cared for enough.
export const STAGES = [
  { id: 'baby', ageH: 0, xp: 0 },
  { id: 'kid', ageH: 24, xp: 30 },
  { id: 'teen', ageH: 72, xp: 100 },
  { id: 'adult', ageH: 168, xp: 220 },
  { id: 'elder', ageH: 504, xp: 420 },
];

export const ACTIONS = {
  feed: { key: 'fed', need: 'food', full: 'Not hungry', verb: 'Fed' },
  play: { key: 'play', need: 'fun', full: 'Not bored', verb: 'Played with' },
  wash: { key: 'wash', need: 'clean', full: 'Already clean', verb: 'Washed' },
};

const FULL_AT = 90; // a need above this can't be topped up
const SICK_BELOW = 15; // clean below this = sick

const te = new TextEncoder();
const td = new TextDecoder('utf-8', { fatal: true });
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const nowMin = (date = Date.now()) => Math.floor(date / 60000);

/** Cut a string to at most `max` UTF-8 bytes without splitting a character. */
export function clipBytes(s, max) {
  let out = '';
  let n = 0;
  for (const ch of s) {
    const b = te.encode(ch).length;
    if (n + b > max) break;
    out += ch;
    n += b;
  }
  return out;
}
export const byteLen = (s) => te.encode(s).length;

function checksum(bytes) {
  let h = 0x5a;
  for (const x of bytes) h = (h * 31 + x) & 0xff;
  return h;
}

function toB64url(bytes) {
  let s = '';
  for (const x of bytes) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(str) {
  const s = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

/*
 Binary layout (big-endian):
   0      version  u8
   1-2    seed     u16   looks/personality
   3-6    born     u32   minutes since epoch
   7-9    fed      u24   minutes after born
   10-12  play     u24
   13-15  wash     u24
   16-17  xp       u16
   18-19  hands    u16   how many times it changed phones
   20     carer    u8    id of the last phone that cared for it
   21     noteBy   u8    id of the phone that left the note
   22     nameLen  u8, then name bytes
   ..     noteLen  u8, then note bytes
   last   checksum u8
*/
export function encode(p) {
  const name = te.encode(clipBytes(p.name, NAME_MAX));
  const note = te.encode(clipBytes(p.note || '', NOTE_MAX));
  const b = new Uint8Array(22 + 1 + name.length + 1 + note.length + 1);
  const dv = new DataView(b.buffer);
  let o = 0;
  b[o++] = VERSION;
  dv.setUint16(o, p.seed & 0xffff); o += 2;
  dv.setUint32(o, p.born >>> 0); o += 4;
  for (const k of ['fed', 'play', 'wash']) {
    const d = clamp(p[k] - p.born, 0, 0xffffff);
    b[o++] = d >> 16; b[o++] = (d >> 8) & 0xff; b[o++] = d & 0xff;
  }
  dv.setUint16(o, clamp(p.xp, 0, 0xffff)); o += 2;
  dv.setUint16(o, clamp(p.hands, 0, 0xffff)); o += 2;
  b[o++] = p.carer & 0xff;
  b[o++] = p.noteBy & 0xff;
  b[o++] = name.length; b.set(name, o); o += name.length;
  b[o++] = note.length; b.set(note, o); o += note.length;
  b[o] = checksum(b.subarray(0, o));
  return toB64url(b);
}

/** Parse a packed pet. Throws on anything malformed. */
export function decode(str) {
  const b = fromB64url(str);
  if (b.length < 25) throw new Error('too short');
  if (b[0] !== VERSION) throw new Error('unknown version');
  if (checksum(b.subarray(0, b.length - 1)) !== b[b.length - 1]) throw new Error('checksum');
  const dv = new DataView(b.buffer);
  const u24 = (o) => (b[o] << 16) | (b[o + 1] << 8) | b[o + 2];
  const born = dv.getUint32(3);
  let o = 22;
  const nameLen = b[o++];
  const name = td.decode(b.subarray(o, o + nameLen)); o += nameLen;
  const noteLen = b[o++];
  const note = td.decode(b.subarray(o, o + noteLen)); o += noteLen;
  if (o !== b.length - 1 || nameLen > NAME_MAX || noteLen > NOTE_MAX) throw new Error('bad length');
  return {
    seed: dv.getUint16(1),
    born,
    fed: born + u24(7),
    play: born + u24(10),
    wash: born + u24(13),
    xp: dv.getUint16(16),
    hands: dv.getUint16(18),
    carer: b[20],
    noteBy: b[21],
    name,
    note,
  };
}

export const petUrl = (base, p) => `${base}#${encode(p)}`;

/** Pull the packed state out of a URL like https://x/fobling/#AbC... */
export function stateFromUrl(url) {
  const i = url.indexOf('#');
  return i === -1 ? null : url.slice(i + 1);
}

/** Longest version of `note` that still keeps the URL inside the tag. */
export function fitNote(base, p, note) {
  let n = clipBytes(note, NOTE_MAX);
  while (n && petUrl(base, { ...p, note: n }).length > URL_BUDGET) n = [...n].slice(0, -1).join('');
  return n;
}

export const sameId = (a, b) => !!a && !!b && a.seed === b.seed && a.born === b.born;

/** Looks, fixed for life by the seed. */
export function traits(seed) {
  return {
    body: seed & 3, // blob, bean, puff, sprout
    hue: Math.round((((seed >> 2) & 127) * 360) / 128),
    eyes: (seed >> 9) & 3,
    pattern: (seed >> 11) & 3, // none, spots, stripes, belly
    extra: (seed >> 13) & 7,
  };
}

export function needs(p, now) {
  const level = (last, h) => clamp(100 - ((now - last) / (h * 60)) * 100, 0, 100);
  const emptyIn = (last, h) => Math.max(0, last + h * 60 - now);
  return {
    food: level(p.fed, HOURS.food),
    fun: level(p.play, HOURS.fun),
    clean: level(p.wash, HOURS.clean),
    emptyIn: {
      food: emptyIn(p.fed, HOURS.food),
      fun: emptyIn(p.play, HOURS.fun),
      clean: emptyIn(p.wash, HOURS.clean),
    },
  };
}

export const deathAt = (p) => p.fed + (HOURS.food + STARVE_GRACE_H) * 60;

export function stageOf(p, now) {
  const ageH = (now - p.born) / 60;
  let s = 0;
  for (let i = 0; i < STAGES.length; i++) if (ageH >= STAGES[i].ageH && p.xp >= STAGES[i].xp) s = i;
  return s;
}

/** Everything the UI needs to know about the pet right now. */
export function status(p, now, date = new Date(now * 60000)) {
  const ageMin = Math.max(0, now - p.born);
  const dies = deathAt(p);
  if (now >= dies) {
    return { dead: true, ageMin, livedMin: Math.max(0, dies - p.born), diedAt: dies, stage: stageOf(p, dies) };
  }
  const n = needs(p, now);
  const egg = ageMin < EGG_MIN;
  const sick = !egg && n.clean < SICK_BELOW;
  const hour = date.getHours();
  const night = hour >= 23 || hour < 7;
  const low = Math.min(n.food, n.fun, n.clean);
  let mood;
  if (egg) mood = 'egg';
  else if (n.food === 0) mood = 'starving';
  else if (night && low > 30) mood = 'asleep';
  else if (low < 20) mood = 'miserable';
  else if (low < 50) mood = 'meh';
  else mood = 'happy';
  return {
    dead: false,
    egg,
    hatchIn: egg ? EGG_MIN - ageMin : 0,
    sick,
    mood,
    needs: n,
    ageMin,
    stage: stageOf(p, now),
    diesIn: n.food === 0 ? dies - now : null,
  };
}

export function canAct(p, action, now) {
  const st = status(p, now);
  if (st.dead) return { ok: false, reason: 'Dead' };
  if (st.egg) return { ok: false, reason: 'Still an egg' };
  const a = ACTIONS[action];
  if (st.needs[a.need] > FULL_AT) return { ok: false, reason: a.full };
  return { ok: true };
}

/** Returns a new pet with the action applied. Caller checks canAct first. */
export function applyAction(p, action, now, carer, note = '') {
  const a = ACTIONS[action];
  const st = status(p, now);
  const level = st.needs[a.need];
  let gain = level < 60 ? 10 : 4;
  if (st.sick && action !== 'wash') gain = Math.ceil(gain / 2);
  const q = { ...p, [a.key]: now, xp: Math.min(0xffff, p.xp + gain) };
  if (carer !== p.carer) {
    q.hands = Math.min(0xffff, p.hands + 1);
    q.carer = carer;
  }
  if (note) {
    q.note = note;
    q.noteBy = carer;
  }
  return q;
}

export function hatch(name, now, carer, rand = Math.random) {
  return {
    seed: Math.floor(rand() * 65536),
    born: now,
    fed: now,
    play: now,
    wash: now,
    xp: 0,
    hands: 1,
    carer,
    noteBy: 0,
    name: clipBytes(name.trim() || 'Fob', NAME_MAX),
    note: '',
  };
}

export function fmtDuration(min) {
  min = Math.max(0, Math.round(min));
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  if (d) return h ? `${d}d ${h}h` : `${d}d`;
  if (h) return m ? `${h}h ${m}m` : `${h}h`;
  return `${m}m`;
}
