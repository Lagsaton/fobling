// Fobling core: the pet's state, how it is packed into a URL, and how time treats it.
// No DOM here, so it runs (and is tested) in Node too.

export const VERSION = 2;
export const NAME_MAX = 10; // bytes (UTF-8)
export const NOTE_MAX = 20; // bytes (UTF-8)

// An NTAG213 holds 144 bytes. NDEF headers take ~8, and Android abbreviates
// "https://" to one byte, so a full URL of up to ~143 chars fits. Keep a margin.
export const URL_BUDGET = 134;

// The first 11 characters of the hash are a reserved slot. An earlier version used it
// for the fob's tap counter ("pats"); that feature is gone, but a fob with its counter
// mirror still switched on stamps hex digits here, so those links must keep loading.
export const SLOT = '~~~~~~~~~~~';
const SLOT_LEN = SLOT.length;
export const NO_BASE = 0xffffff;

// Hours for each need to drain from full to empty.
export const HOURS = { food: 20, fun: 16, clean: 30 };
// Once food hits zero, how long it survives before dying.
export const STARVE_GRACE_H = 48;
// Minutes it spends as an egg.
export const EGG_MIN = 10;

// To grow into a stage it needs to be old enough AND have enough xp.
export const STAGES = [
  { id: 'baby', ageH: 0, xp: 0 },
  { id: 'kid', ageH: 24, xp: 30 },
  { id: 'teen', ageH: 72, xp: 100 },
  { id: 'adult', ageH: 168, xp: 220 },
  { id: 'elder', ageH: 504, xp: 420 },
];
export const ADULT = 3;

// What an adult turns into depends on how it was raised.
export const FORMS = ['', 'classic', 'radiant', 'grumpy', 'cuddly'];
export const FORM_TEXT = {
  classic: 'A classic adult. A solid, ordinary upbringing.',
  radiant: 'Radiant! Raised with almost no neglect.',
  grumpy: 'Grumpy. It remembers every missed meal.',
  cuddly: 'Cuddly! Loved by lots of different phones.',
};
export const RADIANT_MAX = 1; // neglects allowed for radiant
export const GRUMPY_MIN = 6; // neglects that make it grumpy
export const CUDDLY_HANDS = 4; // different phones that cared for it
export const SHINY_ODDS = 64;

export const TRAIT_NAMES = ['shape', 'colour', 'eyes', 'pattern'];
const TRAIT_MASKS = [0x0003, 0x01fc, 0x0600, 0x1800];

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
 Binary layout, version 2 (big-endian):
   0      version  u8
   1-2    seed     u16   looks
   3-6    born     u32   minutes since epoch
   7-9    fed      u24   minutes after born
   10-12  play     u24
   13-15  wash     u24
   16-17  xp       u16
   18-19  hands    u16   how many times it changed phones
   20     carer    u8    id of the last phone that cared for it
   21     noteBy   u8    id of the phone that left the note
   22     gen      u8    generation on this fob
   23     neglect  u8    times a need was left to run empty
   24     flags    u8    bit0 shiny, bits1-3 adult form, bits4-6 inherited trait + 1
   25-27  cntBase  u24   fob tap counter when it hatched (NO_BASE = unknown)
   28     nameLen  u8, then name bytes
   ..     noteLen  u8, then note bytes
   last   checksum u8
 Version 1 was the same up to byte 21, then name and note.
*/
export function encodeState(p) {
  const name = te.encode(clipBytes(p.name, NAME_MAX));
  const note = te.encode(clipBytes(p.note || '', NOTE_MAX));
  const b = new Uint8Array(28 + 1 + name.length + 1 + note.length + 1);
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
  b[o++] = clamp(p.gen, 1, 255);
  b[o++] = clamp(p.neglect, 0, 255);
  b[o++] = (p.shiny ? 1 : 0) | ((p.form & 7) << 1) | ((p.inherited & 7) << 4);
  const base = clamp(p.cntBase, 0, NO_BASE);
  b[o++] = base >> 16; b[o++] = (base >> 8) & 0xff; b[o++] = base & 0xff;
  b[o++] = name.length; b.set(name, o); o += name.length;
  b[o++] = note.length; b.set(note, o); o += note.length;
  b[o] = checksum(b.subarray(0, o));
  return toB64url(b);
}

/** Parse packed state (version 1 or 2). Throws on anything malformed. */
export function decodeState(str) {
  const b = fromB64url(str);
  if (b.length < 25) throw new Error('too short');
  const version = b[0];
  if (version !== 1 && version !== 2) throw new Error('unknown version');
  if (checksum(b.subarray(0, b.length - 1)) !== b[b.length - 1]) throw new Error('checksum');
  const dv = new DataView(b.buffer);
  const u24 = (o) => (b[o] << 16) | (b[o + 1] << 8) | b[o + 2];
  const born = dv.getUint32(3);
  const p = {
    version,
    seed: dv.getUint16(1),
    born,
    fed: born + u24(7),
    play: born + u24(10),
    wash: born + u24(13),
    xp: dv.getUint16(16),
    hands: dv.getUint16(18),
    carer: b[20],
    noteBy: b[21],
    gen: 1,
    neglect: 0,
    shiny: false,
    form: 0,
    inherited: 0,
    cntBase: NO_BASE,
  };
  let o = 22;
  if (version === 2) {
    if (b.length < 32) throw new Error('too short');
    p.gen = b[22] || 1;
    p.neglect = b[23];
    p.shiny = !!(b[24] & 1);
    p.form = (b[24] >> 1) & 7;
    p.inherited = (b[24] >> 4) & 7;
    p.cntBase = u24(25);
    o = 28;
  }
  const nameLen = b[o++];
  if (nameLen > NAME_MAX) throw new Error('bad length');
  p.name = td.decode(b.subarray(o, o + nameLen)); o += nameLen;
  const noteLen = b[o++];
  if (noteLen > NOTE_MAX) throw new Error('bad length');
  p.note = td.decode(b.subarray(o, o + noteLen)); o += noteLen;
  if (o !== b.length - 1 || p.form >= FORMS.length || p.inherited > 4) throw new Error('bad length');
  return p;
}

const hex6 = (n) => n.toString(16).toUpperCase().padStart(6, '0').slice(-6);

/**
 * Read the part after '#'. Returns { pet, counter, mirror } where counter is the
 * fob's tap count (or null) and mirror is 'ok' | 'off' | 'weird' | 'legacy'.
 */
export function parseHash(h) {
  if (h.length > SLOT_LEN && /^[~0-9A-F]{11}/.test(h)) {
    try {
      const pet = decodeState(h.slice(SLOT_LEN));
      const region = h.slice(0, SLOT_LEN);
      let counter = null;
      let mirror = 'off';
      if (/^[0-9A-F]{6}~{5}$/.test(region)) counter = parseInt(region.slice(0, 6), 16);
      else if (/^~{5}[0-9A-F]{6}$/.test(region)) counter = parseInt(region.slice(5), 16);
      else if (region !== SLOT) mirror = 'weird';
      if (counter !== null) mirror = 'ok';
      return { pet, counter, mirror };
    } catch {
      /* fall through to the old format */
    }
  }
  return { pet: decodeState(h), counter: null, mirror: 'legacy' };
}

/** The hash as the page should show it (the counter filled in, if known). */
export function hashFor(p, counter = null) {
  const slot = counter === null ? SLOT : hex6(counter) + SLOT.slice(6);
  return slot + encodeState(p);
}

/** The URL written to the fob. The slot stays blank; the chip fills it in on read. */
export const petUrl = (base, p) => `${base}#${SLOT}${encodeState(p)}`;

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
export const petKey = (p) => `${p.seed}.${p.born}`;

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

/** A child's seed: random, except one trait copied from the parent. */
export function inheritSeed(seed, parentSeed, trait) {
  const m = TRAIT_MASKS[trait];
  return (seed & ~m & 0xffff) | (parentSeed & m);
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

export function stageOf(p, now, xp = p.xp) {
  const ageH = (now - p.born) / 60;
  let s = 0;
  for (let i = 0; i < STAGES.length; i++) if (ageH >= STAGES[i].ageH && xp >= STAGES[i].xp) s = i;
  return s;
}

function formIndex(neglect, hands) {
  if (neglect >= GRUMPY_MIN) return 3;
  if (neglect <= RADIANT_MAX) return 2;
  if (hands >= CUDDLY_HANDS) return 4;
  return 1;
}

/** What it would turn into if it became an adult right now. */
export const forecastForm = (neglect, hands) => FORMS[formIndex(neglect, hands)];

/** Everything the UI needs to know about the pet right now. */
export function status(p, now, { date = new Date(now * 60000) } = {}) {
  const ageMin = Math.max(0, now - p.born);
  const xp = p.xp;
  const dies = deathAt(p);
  const base = { xp, ageMin, shiny: p.shiny };
  if (now >= dies) {
    const stage = stageOf(p, dies, xp);
    return { ...base, dead: true, livedMin: Math.max(0, dies - p.born), diedAt: dies, stage, form: formName(p, stage, p.neglect + 1) };
  }
  const n = needs(p, now);
  const egg = ageMin < EGG_MIN;
  const sick = !egg && n.clean < SICK_BELOW;
  const hour = date.getHours();
  const night = hour >= 23 || hour < 7;
  const low = Math.min(n.food, n.fun, n.clean);
  const neglectNow = p.neglect + [n.food, n.fun, n.clean].filter((v) => v === 0).length;
  let mood;
  if (egg) mood = 'egg';
  else if (n.food === 0) mood = 'starving';
  else if (night && low > 30) mood = 'asleep';
  else if (low < 20) mood = 'miserable';
  else if (low < 50) mood = 'meh';
  else mood = 'happy';
  const stage = stageOf(p, now, xp);
  return {
    ...base,
    dead: false,
    egg,
    hatchIn: egg ? EGG_MIN - ageMin : 0,
    sick,
    mood,
    needs: n,
    stage,
    neglect: neglectNow,
    form: formName(p, stage, neglectNow),
    diesIn: n.food === 0 ? dies - now : null,
  };
}

function formName(p, stage, neglect) {
  if (stage < ADULT) return '';
  return FORMS[p.form || formIndex(neglect, p.hands)];
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
  const q = { ...p, version: VERSION, [a.key]: now, xp: Math.min(0xffff, p.xp + gain) };
  if (level === 0) q.neglect = Math.min(255, p.neglect + 1);
  if (carer !== p.carer) {
    q.hands = Math.min(0xffff, p.hands + 1);
    q.carer = carer;
  }
  if (note) {
    q.note = note;
    q.noteBy = carer;
  }
  // The adult form is settled the first time it's cared for as an adult.
  if (!q.form && stageOf(q, now, q.xp) >= ADULT) {
    const live = needs(q, now);
    const neglect = q.neglect + [live.food, live.fun, live.clean].filter((v) => v === 0).length;
    q.form = formIndex(neglect, q.hands);
  }
  return q;
}

/**
 * A fresh pet. `parent` (a dead pet from the same fob) makes it the next generation
 * and passes on one trait, `trait` (0-3).
 */
export function hatch(name, now, carer, { seed, parent = null, trait = 0, rand = Math.random } = {}) {
  let s = seed ?? Math.floor(rand() * 65536);
  let inherited = 0;
  if (parent) {
    s = inheritSeed(s, parent.seed, trait);
    inherited = trait + 1;
  }
  return {
    version: VERSION,
    seed: s,
    born: now,
    fed: now,
    play: now,
    wash: now,
    xp: 0,
    hands: 1,
    carer,
    noteBy: 0,
    gen: parent ? Math.min(255, (parent.gen || 1) + 1) : 1,
    neglect: 0,
    shiny: rand() < 1 / SHINY_ODDS,
    form: 0,
    inherited,
    cntBase: NO_BASE, // unused; kept so the format stays the same
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
