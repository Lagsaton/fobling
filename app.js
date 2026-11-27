import * as P from './pet.js';
import { petSVG, eggSVG, ICONS, esc, STAGE_NAMES } from './render.js';
import { ceremony } from './ceremony.js';
import * as S from './sound.js';

const params = new URLSearchParams(location.search);
const SIM = params.has('sim'); // fake taps, for trying it on a computer
const SKIP = (Number(params.get('skip')) || 0) * 60; // pretend N hours have passed
const HAS_NFC = 'NDEFReader' in window;
const CAN_TAP = HAS_NFC || SIM;
const BASE = location.origin + location.pathname;
const NEED_LABEL = { food: 'Food', fun: 'Fun', clean: 'Clean' };
const NEED_WANT = { food: 'food', fun: 'fun', clean: 'a wash' };
const ACT_FOR = { food: 'feed', fun: 'play', clean: 'wash' };
const ACT_LABEL = { feed: 'Feed', play: 'Play', wash: 'Wash' };
const rand16 = () => Math.floor(Math.random() * 65536);

const app = document.getElementById('app');
const now = () => P.nowMin() + SKIP;

/* ---------- small storage helpers (this phone only) ---------- */

function lsGet(k) {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function lsSet(k, v) {
  try {
    localStorage.setItem(k, String(v));
  } catch {
    /* private mode */
  }
}

// A small random id for this phone, so the pet can tell when it changes hands.
let me = 0;
function carer() {
  if (!me) me = Number(lsGet('fobling.carer')) || 0;
  if (!me) lsSet('fobling.carer', (me = 1 + Math.floor(Math.random() * 255)));
  return me;
}

/* ---------- state ---------- */

let pet = null; // the pet in the URL
let mirror = 'off'; // 'ok' | 'off' | 'weird' | 'legacy'
let broken = false;
let rawHash = '';
let previewSeed = rand16();
let legacy = null; // a dead pet whose fob we're about to hatch on
let legacyTrait = 0;
let ceremonyOpen = false;
// ?sim: a pretend fob, so the whole flow can be tried on a computer
let simFob = null;

function load() {
  try {
    rawHash = decodeURIComponent(location.hash.slice(1));
  } catch {
    rawHash = location.hash.slice(1);
  }
  pet = null;
  mirror = 'off';
  broken = false;
  if (!rawHash) return;
  try {
    ({ pet, mirror } = P.parseHash(rawHash));
    if (SIM && !simFob) simFob = pet;
  } catch {
    broken = true;
  }
}

function commit(next) {
  history.replaceState(null, '', next ? `#${P.hashFor(next)}` : location.pathname + location.search);
  load();
  render();
}

const statusNow = () => P.status(pet, now());

/* ---------- views ---------- */

function header() {
  return `<header class="top"><span class="brand">fob<b>ling</b></span>
    <button class="icon-btn" data-do="mute" aria-label="${S.isMuted() ? 'Turn sound on' : 'Turn sound off'}">${S.isMuted() ? ICONS.mute : ICONS.sound}</button></header>`;
}
const banner = () =>
  CAN_TAP ? '' : `<p class="banner">You can look, but to care for it open this in <b>Chrome on Android</b> with NFC switched on.</p>`;

function timeOfDay(d = new Date(now() * 60000)) {
  const h = d.getHours();
  if (h >= 21 || h < 6) return 'night';
  if (h < 9) return 'dawn';
  if (h >= 18) return 'dusk';
  return 'day';
}
const sky = () => `<div class="sky" aria-hidden="true"><i class="sun"></i><i class="stars"></i><i class="hill"></i></div>`;

function moodLine(st) {
  const lowest = ['food', 'fun', 'clean'].reduce((a, b) => (st.needs[a] <= st.needs[b] ? a : b));
  const sick = st.sick ? ' · feeling sick' : '';
  switch (st.mood) {
    case 'egg': return `Hatching in ${P.fmtDuration(st.hatchIn)}`;
    case 'starving': return `<span class="danger">Starving! Dies in ${P.fmtDuration(st.diesIn)}</span>`;
    case 'asleep': return `Fast asleep${sick}`;
    case 'miserable': return `Really needs ${NEED_WANT[lowest]}${sick}`;
    case 'meh': return `Could use ${NEED_WANT[lowest]}${sick}`;
    default: {
      const lines = st.form === 'grumpy'
        ? ['Tolerating you', 'Fine. Whatever.', 'Not impressed']
        : ['Vibing', 'Content', 'Very pleased with itself', 'Doing great', 'Chilling on your keys'];
      return lines[(pet.seed + new Date().getHours()) % lines.length] + sick;
    }
  }
}

function chips(st) {
  const c = [];
  c.push(`<span class="chip">${st.egg ? 'egg' : STAGE_NAMES[st.stage]}</span>`);
  if (st.form) c.push(`<span class="chip form-chip ${st.form}">${st.form}</span>`);
  if (pet.gen > 1) c.push(`<span class="chip">gen ${pet.gen}</span>`);
  if (pet.shiny && !st.egg) c.push(`<span class="chip shiny-chip">${ICONS.spark} shiny</span>`);
  return c.join('');
}

const chipKey = (st) => `${st.egg}|${st.stage}|${st.form}`;

// A fob still running an old counter/serial mirror: offer the fix.
function mirrorLine() {
  if (mirror === 'ok' || mirror === 'weird') return `<p class="pats off"><button class="link" data-do="doc-weird">Something's stamping on the link. Fix it</button></p>`;
  return '';
}

function needsHTML(st) {
  return ['food', 'fun', 'clean'].map((k) => {
    const v = Math.round(st.needs[k]);
    const lvl = v > 50 ? 'ok' : v > 20 ? 'warn' : 'bad';
    const left = st.needs.emptyIn[k];
    return `<div class="need ${lvl}">
      <span class="need-ic">${ICONS[k]}</span>
      <span class="need-name">${NEED_LABEL[k]}</span>
      <span class="bar"><i style="width:${v}%"></i></span>
      <span class="need-left">${left ? P.fmtDuration(left) : 'empty'}</span>
    </div>`;
  }).join('');
}

function actionsHTML() {
  const t = now();
  return ['food', 'fun', 'clean'].map((k) => {
    const a = ACT_FOR[k];
    const c = P.canAct(pet, a, t);
    const off = !CAN_TAP || !c.ok;
    return `<button class="act act-${k}" data-act="${a}" ${off ? 'disabled' : ''}>
      ${ICONS[k]}<span>${ACT_LABEL[a]}</span><small>${c.ok ? (CAN_TAP ? 'tap fob' : '—') : c.reason}</small>
    </button>`;
  }).join('');
}

function statsHTML(st) {
  const next = P.STAGES[st.stage + 1];
  const ageH = st.ageMin / 60;
  let grow = `<p class="grow">Fully grown. A true elder of the keyring.</p>`;
  if (next) {
    const ageOk = ageH >= next.ageH;
    const xpOk = st.xp >= next.xp;
    grow = `<p class="grow">Grows into ${next.id === 'adult' ? 'an' : 'a'} <b>${next.id}</b> once it's
      <span class="${ageOk ? 'met' : ''}">${P.fmtDuration(next.ageH * 60)} old</span> and has
      <span class="${xpOk ? 'met' : ''}">${next.xp} xp</span>.</p>`;
  }
  let raise = '';
  if (st.stage < P.ADULT) {
    const f = P.forecastForm(st.neglect, pet.hands);
    raise = `<p class="grow raise">Raised like this, it'll be a <b class="form-word ${f}">${f}</b> adult.
      <span>Neglected ${st.neglect}×${st.neglect <= P.RADIANT_MAX ? ` (radiant allows ${P.RADIANT_MAX})` : st.neglect < P.GRUMPY_MIN ? ` (grumpy at ${P.GRUMPY_MIN})` : ''}${f !== 'radiant' && f !== 'grumpy' ? `, ${pet.hands}/${P.CUDDLY_HANDS} phones for cuddly` : ''}.</span></p>`;
  }
  return `<div class="stat"><b>${P.fmtDuration(st.ageMin)}</b><span>old</span></div>
    <div class="stat"><b>${pet.hands}</b><span>${pet.hands === 1 ? 'phone' : 'phones'}</span></div>
    <div class="stat"><b>${st.xp}</b><span>xp</span></div>${grow}${raise}`;
}

const noteMax = () => P.byteLen(P.fitNote(BASE, pet, 'x'.repeat(P.NOTE_MAX)));

function viewPet(st) {
  const note = pet.note
    ? `<blockquote class="card note">“${esc(pet.note)}”<cite>left on the fob by ${pet.noteBy === carer() ? 'you' : 'a previous holder'}</cite></blockquote>`
    : '';
  const noteIn = CAN_TAP
    ? `<label class="note-in"><span>Leave a note on the fob for whoever holds it next</span>
        <input id="note" maxlength="${P.NOTE_MAX}" placeholder="optional, saved with your next tap" autocomplete="off">
        <small id="note-left">${noteMax()} bytes left</small></label>`
    : '';
  return `${header()}${banner()}
  <section class="card hero${pet.shiny ? ' is-shiny' : ''}">
    <div class="chips" id="chips" data-k="${chipKey(st)}">${chips(st)}</div>
    <div class="window sky-${timeOfDay()}" id="stage">${sky()}<div class="petbox" id="petbox">${petSVG(pet, st)}</div></div>
    <h1>${esc(pet.name)}</h1>
    <p class="mood" id="mood">${moodLine(st)}</p>
    ${mirrorLine()}
  </section>
  <section class="card needs" id="needs">${needsHTML(st)}</section>
  <section class="actions" id="acts">${actionsHTML()}</section>
  ${noteIn}${note}
  <section class="card stats" id="stats">${statsHTML(st)}</section>
  <footer class="foot">
    ${CAN_TAP ? '<button class="btn" data-do="scan">Scan a different fob</button>' : ''}
    <button class="btn quiet" data-do="new">Hatch a new fobling</button>
  </footer>`;
}

function viewGrave(st) {
  return `${header()}
  <section class="card hero">
    <div class="chips"><span class="chip dead">deceased</span>${pet.gen > 1 ? `<span class="chip">gen ${pet.gen}</span>` : ''}</div>
    <div class="window grave-window">${sky()}<div class="petbox">${petSVG(pet, st)}</div></div>
    <h1>${esc(pet.name)}</h1>
    <p class="mood">Starved ${P.fmtDuration(now() - st.diedAt)} ago</p>
  </section>
  <section class="card stats">
    <div class="stat"><b>${P.fmtDuration(st.livedMin)}</b><span>lived</span></div>
    <div class="stat"><b>${pet.hands}</b><span>${pet.hands === 1 ? 'phone' : 'phones'}</span></div>
    <div class="stat"><b>${st.form || STAGE_NAMES[st.stage]}</b><span>reached</span></div>
    <p class="grow">Last meal ${P.fmtDuration(now() - pet.fed)} ago. Nobody tapped in time.</p>
  </section>
  <section class="card legacy">
    <b>Its line goes on.</b>
    <span>Hatch a new one on this fob and it becomes generation ${pet.gen + 1}, with one of ${esc(pet.name)}'s traits.</span>
  </section>
  <footer class="foot"><button class="btn primary" data-do="heir">Hatch its descendant</button></footer>`;
}

function hatchPreviewSeed() {
  return legacy ? P.inheritSeed(previewSeed, legacy.seed, legacyTrait) : previewSeed;
}

function viewHatch() {
  const heir = legacy
    ? `<p class="lede">Generation ${legacy.gen + 1}. It'll have ${esc(legacy.name)}'s <b>${P.TRAIT_NAMES[legacyTrait]}</b>.</p>`
    : `<p class="lede">A tiny creature that lives <em>on your keyring</em>. Its whole life is stored on the fob, so anyone with an Android phone can tap it and care for it. Forget it for about three days and it starves.</p>`;
  return `${header()}${banner()}
  <section class="card hero">
    <button class="window egg-pick sky-${timeOfDay()}" data-do="reroll" aria-label="Pick a different egg">${sky()}<div class="petbox" id="eggbox">${eggSVG(hatchPreviewSeed())}</div></button>
    <p class="hint">tap the egg for a different one</p>
    <h1>${legacy ? `${esc(legacy.name)}'s heir` : 'Hatch a fobling'}</h1>
    ${heir}
  </section>
  <section class="card form">
    <label for="name">Name it</label>
    <input id="name" maxlength="${P.NAME_MAX}" placeholder="e.g. Pickle" autocomplete="off">
    <button class="btn primary" data-do="hatch" ${CAN_TAP ? '' : 'disabled'}>Hatch onto a fob</button>
    ${CAN_TAP ? '<button class="btn" data-do="scan">I already have one, scan it</button>' : ''}
  </section>
  <details class="card how"><summary>How it works</summary>
    <ul>
      <li>The fob holds a link with the pet packed inside it. Tapping opens this page, which reads the pet from the link. No app, no account, no server.</li>
      <li>Feeding, playing and washing write the new state back onto the fob, so you tap again to save.</li>
      <li>Food lasts ${P.HOURS.food}h, fun ${P.HOURS.fun}h, clean ${P.HOURS.clean}h. Once food runs out it has ${P.STARVE_GRACE_H}h before it dies.</li>
      <li>It grows through 5 stages. What kind of adult it becomes depends on how well it was raised.</li>
      <li>1 in ${P.SHINY_ODDS} hatch shiny.</li>
    </ul>
  </details>`;
}

function viewBroken() {
  const ours = /[0-9A-F]{14}x[0-9A-F]{6}/.test(rawHash) || rawHash.length > 20;
  return `${header()}
  <section class="card hero"><h1>Scrambled fob</h1>
    <p class="lede">This link doesn't hold a fobling I can read.${ours ? ' It looks like something on the fob is stamping over part of it.' : ''}</p></section>
  <footer class="foot">
    ${ours ? '<button class="btn primary" data-do="doc-weird">Diagnose the fob</button>' : ''}
    ${CAN_TAP ? '<button class="btn" data-do="scan">Scan a fob</button>' : ''}
    <button class="btn ${ours ? 'quiet' : 'primary'}" data-do="new">Hatch a new fobling</button></footer>`;
}

function render() {
  if (!pet) {
    app.innerHTML = broken ? viewBroken() : viewHatch();
    return;
  }
  const st = statusNow();
  app.innerHTML = st.dead ? viewGrave(st) : viewPet(st);
  const note = document.getElementById('note');
  if (note) note.addEventListener('input', updateNoteLeft);
  if (!st.dead) {
    maybeCeremony(st);
  }
}

function updateNoteLeft() {
  const el = document.getElementById('note-left');
  const left = noteMax() - P.byteLen(document.getElementById('note').value);
  el.textContent = left >= 0 ? `${left} bytes left` : `${-left} bytes too long, it'll be cut`;
  el.classList.toggle('over', left < 0);
}

// Refresh the parts that change with time, without wiping what's being typed.
function tick() {
  if (!pet || ceremonyOpen) return;
  const st = statusNow();
  const box = document.getElementById('petbox');
  if (st.dead || !box) return render();
  if (document.getElementById('chips').dataset.k !== chipKey(st)) return render();
  box.innerHTML = petSVG(pet, st);
  document.getElementById('stage').className = `window sky-${timeOfDay()}`;
  document.getElementById('mood').innerHTML = moodLine(st);
  document.getElementById('needs').innerHTML = needsHTML(st);
  document.getElementById('acts').innerHTML = actionsHTML();
  document.getElementById('stats').innerHTML = statsHTML(st);
}

/* ---------- moments: hatching, evolving ---------- */

// Plays the hatch / evolve animation the first time this phone sees the change,
// and only while the page is actually on screen.
function maybeCeremony(st) {
  if (ceremonyOpen || document.visibilityState !== 'visible') return;
  const key = `fobling.stage.${P.petKey(pet)}`;
  const nowStage = st.egg ? -1 : st.stage;
  const seenRaw = lsGet(key);
  if (seenRaw === null) return lsSet(key, nowStage);
  const seen = Number(seenRaw);
  if (nowStage <= seen) {
    if (nowStage < seen) lsSet(key, nowStage);
    return;
  }
  ceremonyOpen = true;
  const look = (over) => ({ ...st, mood: 'happy', sick: false, needs: { ...st.needs, clean: 100 }, ...over });
  (async () => {
    if (seen === -1) {
      await ceremony({ kind: 'hatch', pet, after: look({ stage: 0, form: '' }) });
      lsSet(key, 0);
    }
    const from = Math.max(seen, 0);
    if (nowStage > from) {
      await ceremony({ kind: 'evolve', pet, before: look({ stage: from, form: from >= P.ADULT ? st.form : '' }), after: look({}) });
    }
    lsSet(key, nowStage);
    ceremonyOpen = false;
  })();
}

/* ---------- talking to the fob ---------- */

class FobError extends Error {
  constructor(code, detail) {
    super(code);
    this.code = code;
    this.detail = detail;
  }
}

/** What a fob's message holds: { url, parsed } where parsed is parseHash's result or null. */
function readMessage(msg) {
  for (const r of msg?.records || []) {
    if (r.recordType !== 'url' && r.recordType !== 'absolute-url') continue;
    const url = new TextDecoder().decode(r.data);
    const h = P.stateFromUrl(url);
    if (!h) return { url, parsed: null };
    try {
      return { url, parsed: P.parseHash(decodeURIComponent(h)) };
    } catch {
      return { url, parsed: null };
    }
  }
  return { url: null, parsed: null };
}

// Say what is actually on a fob that has no fobling, so a bad write is easy to spot.
function describe(msg) {
  const recs = msg?.records || [];
  if (!recs.length) return 'The fob is empty.';
  const r = recs[0];
  let txt = '';
  try {
    if (['url', 'absolute-url', 'text'].includes(r.recordType) && r.data) txt = new TextDecoder(r.encoding || 'utf-8').decode(r.data);
  } catch {
    /* not text */
  }
  if (txt.length > 70) txt = `${txt.slice(0, 70)}…`;
  const more = recs.length > 1 ? ` (+${recs.length - 1} more)` : '';
  return `It holds a ${r.recordType} record${txt ? `: ${txt}` : ''}${more}.`;
}
const isOurs = (url) => !!url && url.split('#')[0] === BASE;

const sheet = {
  el: document.getElementById('sheet'),
  open(title) {
    document.getElementById('sheet-title').textContent = title;
    this.hint('Hold the fob flat against the back of your phone, near the camera.');
    this.el.hidden = false;
  },
  hint(t) {
    document.getElementById('sheet-hint').textContent = t;
  },
  close() {
    this.el.hidden = true;
    this.onCancel = null;
  },
  onCancel: null,
};
document.getElementById('sheet-cancel').addEventListener('click', () => {
  if (sheet.onCancel) sheet.onCancel();
  sheet.close();
});

/**
 * Wait for a fob, read it, let `build` decide what should be on it, write that.
 * `build(parsed, msg, url)` returns the pet to write, or throws a FobError.
 * Resolves { next, parsed }.
 */
async function withFob(title, build, { write = true, allowUnreadable = false } = {}) {
  sheet.open(title);
  try {
    if (!HAS_NFC) {
      await new Promise((res, rej) => {
        const t = setTimeout(res, 900);
        sheet.onCancel = () => { clearTimeout(t); rej(new FobError('cancelled')); };
      });
      const parsed = simFob ? { pet: simFob, mirror: 'off' } : null;
      const next = build(parsed, null, null);
      if (write && next) simFob = next;
      return { next, parsed };
    }
    const ctrl = new AbortController();
    const reader = new NDEFReader();
    let busy = false;
    const done = new Promise((resolve, reject) => {
      sheet.onCancel = () => { ctrl.abort(); reject(new FobError('cancelled')); };
      const handle = async (msg) => {
        if (busy) return;
        busy = true;
        try {
          S.buzz(15);
          const { url, parsed } = readMessage(msg);
          const next = build(parsed, msg, url);
          if (write && next) {
            sheet.hint('Saving… keep holding it there');
            try {
              await reader.write({ records: [{ recordType: 'url', data: P.petUrl(BASE, next) }] });
            } catch (e) {
              throw new FobError('write', e);
            }
          }
          resolve({ next, parsed });
        } catch (e) {
          reject(e);
        }
      };
      reader.onreading = (ev) => handle(ev.message);
      reader.onreadingerror = () => {
        // Brand-new fobs sometimes aren't formatted yet; writing formats them.
        if (allowUnreadable) handle(null);
        else sheet.hint("Couldn't read it. Hold it flat and keep still for a second.");
      };
    });
    await reader.scan({ signal: ctrl.signal });
    try {
      return await done;
    } finally {
      ctrl.abort();
    }
  } finally {
    sheet.close();
  }
}

function fail(e) {
  if (e instanceof FobError) {
    switch (e.code) {
      case 'cancelled': return;
      case 'blank': return oops(`That fob has no fobling on it. ${e.detail || ''}`.trim(), e.ours ? { label: 'Fix it', run: () => doctor('weird') } : null);
      case 'cant': return oops(e.detail);
      case 'write': {
        const inner = e.detail;
        if (inner?.name === 'NotAllowedError') return oops('NFC permission was blocked. Allow it in Chrome’s site settings and try again.');
        return oops('The fob wouldn’t take the save. Hold it still and try again.', { label: 'Still failing?', run: () => doctor('write') });
      }
      default: return oops(e.message);
    }
  }
  switch (e.name) {
    case 'NotAllowedError': return oops('NFC permission was blocked. Allow it in Chrome’s site settings and try again.');
    case 'NotSupportedError': return oops('This phone has no NFC, or it’s switched off in Android settings.');
    case 'NotReadableError': return oops('NFC is busy or off. Check it’s on in Android settings.');
    case 'AbortError': return;
    default: return oops(e.message || 'Something went wrong.');
  }
}
function oops(msg, action) {
  S.play('error');
  S.buzz([70, 50, 70]);
  toast(msg, action);
}

function blankError(msg, url) {
  const err = new FobError('blank', describe(msg));
  err.ours = isOurs(url);
  return err;
}

async function care(action) {
  const input = document.getElementById('note');
  const note = input ? input.value.trim() : '';
  try {
    const { next, parsed } = await withFob(`${P.ACTIONS[action].verb} ${pet.name}`, (found, msg, url) => {
      if (!found) throw blankError(msg, url);
      if (!P.sameId(found.pet, pet)) throw new FobError('other', found);
      const t = now();
      const c = P.canAct(found.pet, action, t);
      if (!c.ok) throw new FobError('cant', c.reason);
      return P.applyAction(found.pet, action, t, carer(), note ? P.fitNote(BASE, found.pet, note) : '');
    });
    const before = P.status(parsed.pet, now());
    commit(next);
    const after = statusNow();
    burst(action);
    S.play(action);
    S.buzz([20, 40, 60]);
    toast(`${P.ACTIONS[action].verb} ${next.name}  +${after.xp - before.xp} xp${note ? ' · note saved' : ''}`);
  } catch (e) {
    if (e instanceof FobError && e.code === 'other') {
      const other = e.detail;
      return oops(`That fob holds ${other.pet.name}, not ${pet.name}.`, { label: `Open ${other.pet.name}`, run: () => commit(other.pet) });
    }
    fail(e);
  }
}

async function scan() {
  try {
    let seen = '';
    let ours = false;
    const { parsed } = await withFob('Scan a fob', (f, msg, url) => {
      seen = describe(msg);
      ours = isOurs(url);
      return f;
    }, { write: false });
    if (!parsed) {
      return oops(`No fobling on that fob. ${seen}`, ours ? { label: 'Fix it', run: () => doctor('weird') } : { label: 'Hatch one', run: () => commit(null) });
    }
    S.play('saved');
    commit(parsed.pet);
  } catch (e) {
    fail(e);
  }
}

async function hatchFlow(force = false) {
  const name = (document.getElementById('name')?.value || '').trim();
  if (!name) {
    document.getElementById('name')?.focus();
    return oops('Give it a name first.');
  }
  try {
    const { next, parsed } = await withFob(`Hatch ${name}`, (found) => {
      const t = now();
      const old = found?.pet || null;
      const oldDead = old && P.status(old, t).dead;
      if (old && !force && !oldDead) throw new FobError('occupied', old);
      const parent = oldDead ? old : null;
      const trait = parent && legacy && P.sameId(parent, legacy) ? legacyTrait : Math.floor(Math.random() * 4);
      return P.hatch(name, t, carer(), { seed: previewSeed, parent, trait });
    }, { allowUnreadable: true });
    previewSeed = rand16();
    legacy = null;
    commit(next);
    S.play('saved');
    S.buzz([20, 40, 60]);
    toast(`${next.name} is on your keyring. Come back in ${P.EGG_MIN} minutes to watch it hatch.`);
  } catch (e) {
    if (e instanceof FobError && e.code === 'occupied') {
      const f = e.detail;
      if (confirm(`This fob already holds ${f.name}, alive and ${P.fmtDuration(now() - f.born)} old.\n\nReplace it? ${f.name} will be gone for good.`)) {
        return hatchFlow(true);
      }
      return;
    }
    fail(e);
  }
}

/* ---------- the fob doctor: exact NFC Tools commands for common problems ---------- */

const cmd = (c, why) => `<li><div class="cmd"><code>${c}</code><button class="copy" data-copy="${c}">copy</button></div><span>${why}</span></li>`;

function doctor(kind) {
  const how = `<p class="doc-how">In <b>NFC Tools</b>: Other → <b>Advanced NFC commands</b>, set the tech to <b>NfcA</b>. Hold the fob still while you send each one.</p>`;
  const pw = `<p class="doc-note">IO failure? The fob has a password. Send <code>1BFFFFFFFF</code> (or your own password) first, then the command, without moving the fob.</p>`;
  let title = '';
  let body = '';
  if (kind === 'weird') {
    title = 'Something is stamping on the link';
    body = `<p>A counter or serial-number “mirror” is switched on in the fob and is writing into the link, usually left over from an earlier setup. Switching it off brings the fobling back. Nothing is lost.</p>
      ${how}<ol>
      ${cmd('A229040000FF', 'Turn all mirrors off and keep the password off. <code>0A</code> means it worked.')}
      <li><span>Tap the fob again. Your fobling should be back.</span></li></ol>${pw}`;
  } else {
    title = 'The fob won’t take the save';
    body = `<p>Usually the fob has a password or some of its memory is locked.</p>${how}<ol>
      ${cmd('3029', 'Look at the 4th byte. <code>FF</code> means no password. Anything else: a password guards the memory from that page on.')}
      ${cmd('1BFFFFFFFF', 'Unlock with the factory password. A 2-byte reply means unlocked. IO failure means it’s a different password.')}
      ${cmd('A229040000FF', 'Straight after, without moving the fob: switch the password off.')}
      ${cmd('3002', 'If saving still fails: bytes 11–12 that aren’t <code>00 00</code> mean memory is permanently locked. That fob can’t be used, so try another.')}
      </ol>`;
  }
  const el = document.getElementById('doc');
  el.querySelector('h2').textContent = title;
  el.querySelector('.doc-body').innerHTML = body;
  el.hidden = false;
}

document.getElementById('doc').addEventListener('click', async (e) => {
  const el = document.getElementById('doc');
  const b = e.target.closest('button');
  if (e.target === el || b?.dataset.close !== undefined) return (el.hidden = true);
  if (b?.dataset.copy) {
    try {
      await navigator.clipboard.writeText(b.dataset.copy);
      b.textContent = 'copied';
      setTimeout(() => (b.textContent = 'copy'), 1500);
    } catch {
      b.textContent = 'select it';
    }
  }
});

/* ---------- little bits of feedback ---------- */

function burst(kind, n = 12) {
  const stage = document.getElementById('stage');
  if (!stage || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cls = { feed: 'crumb', play: 'heart', wash: 'bubble', heart: 'heart' }[kind];
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span');
    s.className = `p ${cls}`;
    const ang = (Math.PI * 2 * i) / n + Math.random() * 0.4;
    const dist = 70 + Math.random() * 50;
    s.style.setProperty('--dx', `${Math.cos(ang) * dist}px`);
    s.style.setProperty('--dy', `${Math.sin(ang) * dist - 40}px`);
    s.style.animationDelay = `${Math.random() * 120}ms`;
    stage.appendChild(s);
    setTimeout(() => s.remove(), 1400);
  }
  stage.classList.remove('jump');
  void stage.offsetWidth;
  stage.classList.add('jump');
}

function poke() {
  const box = document.getElementById('petbox');
  if (!box) return;
  box.classList.remove('poked');
  void box.offsetWidth;
  box.classList.add('poked');
  S.play('poke');
  S.buzz(12);
  burst('heart', 4);
}

let toastTimer;
function toast(text, action) {
  const el = document.getElementById('toast');
  el.innerHTML = `<span>${esc(text)}</span>${action ? `<button>${esc(action.label)}</button>` : ''}`;
  if (action) el.querySelector('button').onclick = () => { el.hidden = true; action.run(); };
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), action ? 8000 : 4500);
}

/* ---------- wiring ---------- */

document.addEventListener('pointerdown', () => S.unlock());

app.addEventListener('click', (e) => {
  if (e.target.closest('#stage') && pet && !statusNow().dead) return poke();
  const b = e.target.closest('button');
  if (!b || b.disabled) return;
  if (b.dataset.act) return care(b.dataset.act);
  switch (b.dataset.do) {
    case 'scan': return scan();
    case 'hatch': return hatchFlow();
    case 'new': legacy = null; return commit(null);
    case 'heir':
      legacy = pet;
      legacyTrait = Math.floor(Math.random() * 4);
      return commit(null);
    case 'mute':
      S.setMuted(!S.isMuted());
      b.innerHTML = S.isMuted() ? ICONS.mute : ICONS.sound;
      b.setAttribute('aria-label', S.isMuted() ? 'Turn sound on' : 'Turn sound off');
      return S.play('poke');
    case 'doc-weird': return doctor('weird');
    case 'reroll': {
      previewSeed = rand16();
      document.getElementById('eggbox').innerHTML = eggSVG(hatchPreviewSeed());
      S.play('poke');
    }
  }
});
app.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.id === 'name') hatchFlow();
});

window.addEventListener('hashchange', () => { load(); render(); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  tick();
  if (pet && !ceremonyOpen) {
    const st = statusNow();
    if (!st.dead) maybeCeremony(st);
  }
});
setInterval(() => document.visibilityState === 'visible' && tick(), 30000);

load();
render();
