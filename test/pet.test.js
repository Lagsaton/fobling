import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../pet.js';

const BASE = 'https://lagsaton.github.io/fobling/';
const T0 = P.nowMin(Date.UTC(2026, 10, 26, 12, 0));
const H = 60;

test('encode/decode round-trips every field', () => {
  const p = { ...P.hatch('Bob', T0, 42, () => 0.3), xp: 377, hands: 9, note: 'feed me pls', noteBy: 7 };
  p.fed = T0 + 5 * H; p.play = T0 + 3 * H; p.wash = T0 + 1;
  assert.deepEqual(P.decode(P.encode(p)), p);
});

test('unicode names survive and are clipped by bytes', () => {
  const p = P.hatch('Пухчо🐸🐸🐸', T0, 1);
  assert.ok(P.byteLen(p.name) <= P.NAME_MAX);
  assert.equal(P.decode(P.encode(p)).name, p.name);
});

test('corrupted state is rejected', () => {
  const s = P.encode(P.hatch('Bob', T0, 1));
  const broken = s.slice(0, 5) + (s[5] === 'A' ? 'B' : 'A') + s.slice(6);
  assert.throws(() => P.decode(broken));
  assert.throws(() => P.decode('hello'));
});

test('worst-case URL fits on an NTAG213', () => {
  const p = { ...P.hatch('ЖЖЖЖЖ', T0, 255), xp: 65535, hands: 65535 };
  const note = P.fitNote(BASE, p, 'ЩЩЩЩЩЩЩЩЩЩЩЩЩЩЩЩЩЩЩЩ');
  const url = P.petUrl(BASE, { ...p, note });
  assert.ok(url.length <= P.URL_BUDGET, `${url.length} chars`);
  // a short username leaves room for the full note
  assert.equal(P.byteLen(note), P.NOTE_MAX);
});

test('egg, then hatches, then needs drain', () => {
  const p = P.hatch('Bob', T0, 1);
  assert.equal(P.status(p, T0 + 2).mood, 'egg');
  assert.equal(P.canAct(p, 'feed', T0 + 2).ok, false);
  const later = P.status(p, T0 + 10 * H);
  assert.equal(later.egg, false);
  assert.equal(Math.round(later.needs.food), 50); // 10h of a 20h drain
});

test('cannot top up a full need, can when it is low', () => {
  const p = P.hatch('Bob', T0, 1);
  assert.equal(P.canAct(p, 'feed', T0 + 20).ok, false);
  assert.equal(P.canAct(p, 'feed', T0 + 6 * H).ok, true);
});

test('feeding resets food, gives xp, counts a new holder', () => {
  const p = P.hatch('Bob', T0, 1);
  const q = P.applyAction(p, 'feed', T0 + 15 * H, 2, 'hi');
  assert.equal(q.fed, T0 + 15 * H);
  assert.equal(q.xp, 10);
  assert.equal(q.hands, 2);
  assert.equal(q.note, 'hi');
  assert.equal(q.noteBy, 2);
  const r = P.applyAction(q, 'play', T0 + 15 * H, 2);
  assert.equal(r.hands, 2, 'same phone again is not a new holder');
  assert.equal(r.note, 'hi', 'empty note keeps the old one');
});

test('starves to death 48h after food runs out', () => {
  const p = P.hatch('Bob', T0, 1);
  const starving = P.status(p, T0 + 30 * H);
  assert.equal(starving.mood, 'starving');
  assert.equal(starving.diesIn, 38 * H);
  const dead = P.status(p, T0 + 68 * H);
  assert.equal(dead.dead, true);
  assert.equal(dead.livedMin, 68 * H);
  assert.equal(P.canAct(p, 'feed', T0 + 69 * H).ok, false);
});

test('growth needs both age and care', () => {
  const p = P.hatch('Bob', T0, 1);
  assert.equal(P.stageOf(p, T0 + 30 * H), 0, 'old enough but no xp');
  assert.equal(P.stageOf({ ...p, xp: 30 }, T0 + 30 * H), 1);
  assert.equal(P.stageOf({ ...p, xp: 999 }, T0 + 80 * H), 2);
});

test('traits stay in range', () => {
  for (let s = 0; s < 65536; s += 997) {
    const t = P.traits(s);
    assert.ok(t.body < 4 && t.eyes < 4 && t.pattern < 4 && t.hue >= 0 && t.hue < 360);
  }
});
