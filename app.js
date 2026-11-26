import * as P from './pet.js';
import { petSVG, ICONS, esc, STAGE_NAMES } from './render.js';

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

const app = document.getElementById('app');
const now = () => P.nowMin() + SKIP;

// A small random id for this phone, so the pet can tell when it changes hands.
let me = 0;
function carer() {
  if (me) return me;
  try {
    me = Number(localStorage.getItem('fobling.carer')) || 0;
    if (!me) localStorage.setItem('fobling.carer', String((me = 1 + Math.floor(Math.random() * 255))));
  } catch {
    me = me || 1 + Math.floor(Math.random() * 255);
  }
  return me;
}

let pet = null;
let broken = false;
let previewSeed = Math.floor(Math.random() * 65536);

function load() {
  const s = location.hash.slice(1);
  pet = null;
  broken = false;
  if (!s) return;
  try {
    pet = P.decode(s);
  } catch {
    broken = true;
  }
}

function commit(next) {
  history.replaceState(null, '', next ? `#${P.encode(next)}` : location.pathname + location.search);
  load();
  render();
}

/* ---------- views ---------- */

const header = (chip = '') => `<header class="top"><span class="brand">fob<b>ling</b></span>${chip}</header>`;
const banner = () =>
  CAN_TAP ? '' : `<p class="banner">You can look, but to care for it open this in <b>Chrome on Android</b> with NFC switched on.</p>`;

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
      const lines = ['Vibing', 'Content', 'Very pleased with itself', 'Doing great', 'Chilling on your keys'];
      return lines[(pet.seed + new Date().getHours()) % lines.length] + sick;
    }
  }
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
    const xpOk = pet.xp >= next.xp;
    grow = `<p class="grow">Grows into a <b>${next.id}</b> once it's
      <span class="${ageOk ? 'met' : ''}">${P.fmtDuration(next.ageH * 60)} old</span> and has
      <span class="${xpOk ? 'met' : ''}">${next.xp} xp</span>.</p>`;
  }
  return `<div class="stat"><b>${P.fmtDuration(st.ageMin)}</b><span>old</span></div>
    <div class="stat"><b>${pet.hands}</b><span>${pet.hands === 1 ? 'phone' : 'phones'}</span></div>
    <div class="stat"><b>${pet.xp}</b><span>xp</span></div>${grow}`;
}

function noteMax() {
  return P.byteLen(P.fitNote(BASE, pet, 'x'.repeat(P.NOTE_MAX)));
}

function viewPet() {
  const st = P.status(pet, now());
  if (st.dead) return viewGrave(st);
  const chip = `<span class="chip" id="chip">${st.egg ? 'egg' : STAGE_NAMES[st.stage]}</span>`;
  const note = pet.note
    ? `<blockquote class="card note">“${esc(pet.note)}”<cite>left on the fob by ${pet.noteBy === carer() ? 'you' : 'a previous holder'}</cite></blockquote>`
    : '';
  const noteIn = CAN_TAP
    ? `<label class="note-in"><span>Leave a note on the fob for whoever holds it next</span>
        <input id="note" maxlength="${P.NOTE_MAX}" placeholder="optional, saved with your next tap" autocomplete="off">
        <small id="note-left">${noteMax()} bytes left</small></label>`
    : '';
  return `${header(chip)}${banner()}
  <section class="card hero">
    <div class="window" id="stage">${petSVG(pet, st)}</div>
    <h1>${esc(pet.name)}</h1>
    <p class="mood" id="mood">${moodLine(st)}</p>
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
  return `${header('<span class="chip dead">deceased</span>')}
  <section class="card hero">
    <div class="window grave-window">${petSVG(pet, st)}</div>
    <h1>${esc(pet.name)}</h1>
    <p class="mood">Starved ${P.fmtDuration(now() - st.diedAt)} ago</p>
  </section>
  <section class="card stats">
    <div class="stat"><b>${P.fmtDuration(st.livedMin)}</b><span>lived</span></div>
    <div class="stat"><b>${pet.hands}</b><span>${pet.hands === 1 ? 'phone' : 'phones'}</span></div>
    <div class="stat"><b>${STAGE_NAMES[st.stage]}</b><span>reached</span></div>
    <p class="grow">Last meal ${P.fmtDuration(now() - pet.fed)} ago. Nobody tapped in time.</p>
  </section>
  <footer class="foot"><button class="btn primary" data-do="new">Hatch a new one on this fob</button></footer>`;
}

function viewHatch() {
  const preview = { seed: previewSeed, name: '' };
  return `${header()}${banner()}
  <section class="card hero">
    <button class="window egg-pick" data-do="reroll" aria-label="Pick a different egg">${petSVG(preview, { egg: true, hatchIn: P.EGG_MIN })}</button>
    <p class="hint">tap the egg for a different one</p>
    <h1>Hatch a fobling</h1>
    <p class="lede">A tiny creature that lives <em>on your keyring</em>. Its whole life is stored on the fob, so anyone with an Android phone can tap it and feed it. Forget it for about three days and it starves.</p>
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
      <li>It grows through 5 stages, but only if it's both old enough and looked after enough.</li>
      <li>Pass your keys to a friend: it counts how many phones have cared for it, and you can leave notes for each other.</li>
    </ul>
  </details>`;
}

function viewBroken() {
  return `${header()}
  <section class="card hero"><h1>Scrambled fob</h1>
    <p class="lede">This link doesn't hold a fobling I can read. It may have been cut short or edited.</p></section>
  <footer class="foot">${CAN_TAP ? '<button class="btn" data-do="scan">Scan a fob</button>' : ''}
    <button class="btn primary" data-do="new">Hatch a new fobling</button></footer>`;
}

function render() {
  app.innerHTML = pet ? viewPet() : broken ? viewBroken() : viewHatch();
  const note = document.getElementById('note');
  if (note) note.addEventListener('input', updateNoteLeft);
}

function updateNoteLeft() {
  const el = document.getElementById('note-left');
  const left = noteMax() - P.byteLen(document.getElementById('note').value);
  el.textContent = left >= 0 ? `${left} bytes left` : `${-left} bytes too long, it'll be cut`;
  el.classList.toggle('over', left < 0);
}

// Refresh the parts that change with time, without wiping what's being typed.
function tick() {
  if (!pet) return;
  const st = P.status(pet, now());
  const stage = document.getElementById('stage');
  if (st.dead || !stage) return render();
  const chip = document.getElementById('chip');
  const was = chip?.textContent;
  const label = st.egg ? 'egg' : STAGE_NAMES[st.stage];
  if (was !== label) return render();
  stage.innerHTML = petSVG(pet, st);
  document.getElementById('mood').innerHTML = moodLine(st);
  document.getElementById('needs').innerHTML = needsHTML(st);
  document.getElementById('acts').innerHTML = actionsHTML();
  document.getElementById('stats').innerHTML = statsHTML(st);
}

/* ---------- talking to the fob ---------- */

class FobError extends Error {
  constructor(code, detail) {
    super(code);
    this.code = code;
    this.detail = detail;
  }
}

function petFromMessage(msg) {
  for (const r of msg.records || []) {
    if (r.recordType !== 'url' && r.recordType !== 'absolute-url') continue;
    const s = P.stateFromUrl(new TextDecoder().decode(r.data));
    if (!s) continue;
    try {
      return P.decode(s);
    } catch {
      /* not ours */
    }
  }
  return null;
}

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
 * `build(foundPetOrNull)` returns the pet to write, or throws a FobError.
 */
async function withFob(title, build, { write = true, allowUnreadable = false } = {}) {
  sheet.open(title);
  try {
    if (!HAS_NFC) {
      // ?sim: pretend the same fob was tapped
      await new Promise((res, rej) => {
        const t = setTimeout(res, 900);
        sheet.onCancel = () => { clearTimeout(t); rej(new FobError('cancelled')); };
      });
      return build(pet);
    }
    const ctrl = new AbortController();
    const reader = new NDEFReader();
    let busy = false;
    const done = new Promise((resolve, reject) => {
      sheet.onCancel = () => { ctrl.abort(); reject(new FobError('cancelled')); };
      const handle = async (found, msg) => {
        if (busy) return;
        busy = true;
        try {
          const next = build(found, msg);
          if (write && next) {
            sheet.hint('Writing… keep holding it there');
            await reader.write({ records: [{ recordType: 'url', data: P.petUrl(BASE, next) }] });
          }
          resolve(next);
        } catch (e) {
          reject(e);
        }
      };
      reader.onreading = (ev) => handle(petFromMessage(ev.message), ev.message);
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

function explain(e) {
  if (e instanceof FobError) {
    switch (e.code) {
      case 'cancelled': return null;
      case 'blank': return `That fob has no fobling on it. ${e.detail || ''}`.trim();
      case 'cant': return e.detail;
      default: return e.message;
    }
  }
  switch (e.name) {
    case 'NotAllowedError': return 'NFC permission was blocked. Allow it in Chrome’s site settings and try again.';
    case 'NotSupportedError': return 'This phone has no NFC, or it’s switched off in Android settings.';
    case 'NotReadableError': return 'NFC is busy or off. Check it’s on in Android settings.';
    case 'NetworkError': return 'Lost the fob mid-write. Hold it still and try again.';
    case 'AbortError': return null;
    default: return e.message || 'Something went wrong.';
  }
}

async function care(action) {
  const input = document.getElementById('note');
  const note = input ? input.value.trim() : '';
  try {
    const next = await withFob(`${P.ACTIONS[action].verb} ${pet.name}`, (found, msg) => {
      if (!found) throw new FobError('blank', describe(msg));
      if (!P.sameId(found, pet)) throw new FobError('other', found);
      const t = now();
      const c = P.canAct(found, action, t);
      if (!c.ok) throw new FobError('cant', c.reason);
      return P.applyAction(found, action, t, carer(), note ? P.fitNote(BASE, found, note) : '');
    });
    const gained = next.xp - pet.xp;
    commit(next);
    burst(action);
    toast(`${P.ACTIONS[action].verb} ${next.name}  +${gained} xp${note ? ' · note saved' : ''}`);
  } catch (e) {
    if (e instanceof FobError && e.code === 'other') {
      toast(`That fob holds ${e.detail.name}, not ${pet.name}.`, { label: `Open ${e.detail.name}`, run: () => commit(e.detail) });
      return;
    }
    const msg = explain(e);
    if (msg) toast(msg);
  }
}

async function scan() {
  try {
    let seen = '';
    const found = await withFob('Scan a fob', (f, msg) => ((seen = describe(msg)), f), { write: false });
    if (!found) return toast(`No fobling on that fob. ${seen}`, { label: 'Hatch one', run: () => commit(null) });
    commit(found);
  } catch (e) {
    const msg = explain(e);
    if (msg) toast(msg);
  }
}

async function hatchFlow(force = false) {
  const name = (document.getElementById('name')?.value || '').trim();
  if (!name) {
    document.getElementById('name')?.focus();
    return toast('Give it a name first.');
  }
  try {
    const next = await withFob(`Hatch ${name}`, (found) => {
      const t = now();
      if (found && !force && !P.status(found, t).dead) throw new FobError('occupied', found);
      return { ...P.hatch(name, t, carer()), seed: previewSeed };
    }, { allowUnreadable: true });
    previewSeed = Math.floor(Math.random() * 65536);
    commit(next);
    toast(`${next.name} is on your keyring. It hatches in ${P.EGG_MIN} minutes.`);
  } catch (e) {
    if (e instanceof FobError && e.code === 'occupied') {
      const f = e.detail;
      if (confirm(`This fob already holds ${f.name}, alive and ${P.fmtDuration(now() - f.born)} old.\n\nReplace it? ${f.name} will be gone for good.`)) {
        return hatchFlow(true);
      }
      return;
    }
    const msg = explain(e);
    if (msg) toast(msg);
  }
}

/* ---------- little bits of feedback ---------- */

function burst(action) {
  const stage = document.getElementById('stage');
  if (!stage || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const kind = { feed: 'crumb', play: 'heart', wash: 'bubble' }[action];
  for (let i = 0; i < 12; i++) {
    const s = document.createElement('span');
    s.className = `p ${kind}`;
    const ang = (Math.PI * 2 * i) / 12 + Math.random() * 0.4;
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

let toastTimer;
function toast(text, action) {
  const el = document.getElementById('toast');
  el.innerHTML = `<span>${esc(text)}</span>${action ? `<button>${esc(action.label)}</button>` : ''}`;
  if (action) el.querySelector('button').onclick = () => { el.hidden = true; action.run(); };
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), action ? 7000 : 4000);
}

/* ---------- wiring ---------- */

app.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b || b.disabled) return;
  if (b.dataset.act) return care(b.dataset.act);
  switch (b.dataset.do) {
    case 'scan': return scan();
    case 'hatch': return hatchFlow();
    case 'new': return commit(null);
    case 'reroll': {
      previewSeed = Math.floor(Math.random() * 65536);
      b.innerHTML = petSVG({ seed: previewSeed, name: '' }, { egg: true, hatchIn: P.EGG_MIN });
    }
  }
});
app.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.id === 'name') hatchFlow();
});

window.addEventListener('hashchange', () => { load(); render(); });
document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && tick());
setInterval(tick, 30000);

load();
render();
