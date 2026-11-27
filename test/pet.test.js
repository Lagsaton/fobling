import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../pet.js';

const BASE = 'https://lagsaton.github.io/fobling/';
const T0 = P.nowMin(Date.UTC(2026, 10, 26, 12, 0));
const H = 60;
const fresh = (over = {}) => ({ ...P.hatch('Bob', T0, 1, { seed: 1234, rand: () => 0.5 }), ...over });

// The real v1 URL hatched on the owner's fob, before this format change.
const V1_HASH = 'AYsCAcir2QAAAAAAAAAAAAAAAAF0AAZQaWNrbGUAug';

test('v2 round-trips every field', () => {
  const p = fresh({ xp: 377, hands: 9, note: 'feed me pls', noteBy: 7, gen: 3, neglect: 4, shiny: true, form: 2, inherited: 3, cntBase: 0x37 });
  p.fed = T0 + 5 * H; p.play = T0 + 3 * H; p.wash = T0 + 1;
  assert.deepEqual(P.decodeState(P.encodeState(p)), p);
});

test('old v1 fobs still load, with sensible defaults', () => {
  const { pet, counter, mirror } = P.parseHash(V1_HASH);
  assert.equal(pet.name, 'Pickle');
  assert.equal(pet.version, 1);
  assert.equal(pet.gen, 1);
  assert.equal(pet.cntBase, P.NO_BASE);
  assert.equal(counter, null);
  assert.equal(mirror, 'legacy');
  // the first write upgrades it
  const q = P.applyAction(pet, 'feed', pet.born + 15 * H, 9);
  assert.equal(P.parseHash(P.hashFor(q)).pet.version, 2);
});

test('links with an old counter stamped in still load', () => {
  const p = fresh();
  const state = P.encodeState(p);
  assert.deepEqual(P.parseHash(P.SLOT + state), { pet: p, counter: null, mirror: 'off' });
  assert.equal(P.parseHash('00003A~~~~~' + state).counter, 0x3a);
  assert.equal(P.parseHash('~~~~~00003A' + state).counter, 0x3a);
  assert.equal(P.parseHash('~~~~~00003A' + state).mirror, 'ok');
  assert.equal(P.parseHash('~~0003A~~~~' + state).mirror, 'weird');
  assert.equal(P.parseHash(P.hashFor(p, 0x1234)).counter, 0x1234);
});

test('the fob always gets a blank slot', () => {
  assert.ok(P.petUrl(BASE, fresh()).startsWith(BASE + '#' + P.SLOT));
});

test('corrupted state is rejected', () => {
  const s = P.encodeState(fresh());
  const broken = s.slice(0, 5) + (s[5] === 'A' ? 'B' : 'A') + s.slice(6);
  assert.throws(() => P.decodeState(broken));
  assert.throws(() => P.parseHash(P.SLOT + broken));
  assert.throws(() => P.parseHash('A044EAEC29E2191x000037AAAAFUAAhDb2'));
});

test('worst-case URL fits on an NTAG213', () => {
  const p = fresh({ name: P.clipBytes('ЖЖЖЖЖЖ', P.NAME_MAX), xp: 65535, hands: 65535, gen: 255, neglect: 255, shiny: true, form: 4, inherited: 4 });
  const note = P.fitNote(BASE, p, 'ЩЩЩЩЩЩЩЩЩЩЩЩЩЩЩЩЩЩЩЩ');
  const url = P.petUrl(BASE, { ...p, note });
  assert.ok(url.length <= P.URL_BUDGET, `${url.length} chars`);
  assert.ok(P.byteLen(note) >= 14, `note squeezed to ${P.byteLen(note)} bytes`);
});

test('egg, then hatches, then needs drain', () => {
  const p = fresh();
  assert.equal(P.status(p, T0 + 2).mood, 'egg');
  assert.equal(P.canAct(p, 'feed', T0 + 2).ok, false);
  const later = P.status(p, T0 + 10 * H);
  assert.equal(later.egg, false);
  assert.equal(Math.round(later.needs.food), 50);
});

test('feeding resets food, gives xp, counts a new holder', () => {
  const q = P.applyAction(fresh(), 'feed', T0 + 15 * H, 2, 'hi');
  assert.equal(q.fed, T0 + 15 * H);
  assert.equal(q.xp, 10);
  assert.equal(q.hands, 2);
  assert.equal(q.note, 'hi');
  assert.equal(q.neglect, 0);
  const r = P.applyAction(q, 'play', T0 + 15 * H, 2);
  assert.equal(r.hands, 2);
  assert.equal(r.note, 'hi');
});

test('letting a need run empty counts as neglect', () => {
  const p = fresh();
  assert.equal(P.status(p, T0 + 25 * H).neglect, 2, 'food and fun are empty right now');
  const q = P.applyAction(p, 'feed', T0 + 25 * H, 1);
  assert.equal(q.neglect, 1, 'only the need you fixed is booked');
  assert.equal(P.status(q, T0 + 25 * H).neglect, 2, 'fun is still empty');
});

test('starves to death 48h after food runs out', () => {
  const p = fresh();
  const starving = P.status(p, T0 + 30 * H);
  assert.equal(starving.mood, 'starving');
  assert.equal(starving.diesIn, 38 * H);
  const dead = P.status(p, T0 + 68 * H);
  assert.equal(dead.dead, true);
  assert.equal(dead.livedMin, 68 * H);
  assert.equal(P.canAct(p, 'feed', T0 + 69 * H).ok, false);
});

test('growth needs both age and care', () => {
  const p = fresh();
  assert.equal(P.stageOf(p, T0 + 30 * H), 0);
  assert.equal(P.stageOf({ ...p, xp: 30 }, T0 + 30 * H), 1);
  assert.equal(P.stageOf({ ...p, xp: 999 }, T0 + 80 * H), 2);
});

test('adult form follows upbringing and is locked on the first adult write', () => {
  const at = T0 + 170 * H;
  const cared = (over) => fresh({ xp: 300, fed: at - H, play: at - H, wash: at - H, ...over });
  assert.equal(P.status(cared({ neglect: 0 }), at).form, 'radiant');
  assert.equal(P.status(cared({ neglect: 7 }), at).form, 'grumpy');
  assert.equal(P.status(cared({ neglect: 3, hands: 4 }), at).form, 'cuddly');
  assert.equal(P.status(cared({ neglect: 3 }), at).form, 'classic');
  assert.equal(P.status(fresh({ xp: 300 }), T0 + 30 * H).form, '', 'no form before adulthood');
  const locked = P.applyAction(cared({ neglect: 0, fed: at - 10 * H }), 'feed', at, 1);
  assert.equal(P.FORMS[locked.form], 'radiant');
  const later = { ...locked, neglect: 9 };
  assert.equal(P.status(later, at + H).form, 'radiant', 'stays what it became');
});

test('generations inherit one trait', () => {
  const parent = fresh({ seed: 0b1010101010101010, gen: 2 });
  for (let trait = 0; trait < 4; trait++) {
    const kid = P.hatch('Kid', T0, 1, { seed: 0, parent, trait, rand: () => 0.9 });
    assert.equal(kid.gen, 3);
    assert.equal(kid.inherited, trait + 1);
    const k = P.traits(kid.seed);
    const pt = P.traits(parent.seed);
    assert.equal(k[['body', 'hue', 'eyes', 'pattern'][trait]], pt[['body', 'hue', 'eyes', 'pattern'][trait]]);
  }
});

test('shiny is rare', () => {
  assert.equal(P.hatch('a', T0, 1, { rand: () => 0.001 }).shiny, true);
  assert.equal(P.hatch('a', T0, 1, { rand: () => 0.5 }).shiny, false);
});

test('traits stay in range', () => {
  for (let s = 0; s < 65536; s += 997) {
    const t = P.traits(s);
    assert.ok(t.body < 4 && t.eyes < 4 && t.pattern < 4 && t.hue >= 0 && t.hue < 360);
  }
});
