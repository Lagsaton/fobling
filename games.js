// Ten-second action mini-games for feeding, playing and washing. Each one runs
// in a full-screen overlay: intro card, 3-2-1, play, then a graded end card.
import { petSVG, esc, ICONS } from './render.js?v=mwy9c64y';
import * as S from './sound.js?v=mwy9c64y';
import { traits } from './pet.js?v=mwy9c64y';

const PLAY_MS = 10000;
const STEP_MS = 650; // each beat of the 3-2-1
const SCALE = [0.74, 0.83, 0.91, 1, 0.98]; // body scale per stage, as in render.js
const FACE_Y = [122, 114, 126, 132]; // eye height per body shape, as in render.js

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const plural = (n, one, many) => (n === 1 ? one : many);
const restart = (node, cls) => {
  node.classList.remove(cls);
  void node.offsetWidth;
  node.classList.add(cls);
};

const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.2l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8Z"/></svg>';
const SPARK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1Q12 12 23 12Q12 12 12 23Q12 12 1 12Q12 12 12 1Z"/></svg>';
const ROCK = '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M7 33c-3-9 3-19 13-21 9-2 19 2 21 11 2 9-3 15-13 15H14c-4 0-6-2-7-5Z" fill="#9a8f86" stroke="#1d1916" stroke-width="3.5" stroke-linejoin="round"/><path d="M15 20c3-3 7-4 10-3" stroke="#c9c0b6" stroke-width="3.5" fill="none" stroke-linecap="round"/><circle cx="31" cy="30" r="2.4" fill="#6f655d"/><circle cx="19" cy="32" r="1.8" fill="#6f655d"/></svg>';
const BALL = `<svg viewBox="0 0 100 100" aria-hidden="true">
  <defs><clipPath id="g-ball-clip"><circle cx="50" cy="50" r="45"/></clipPath></defs>
  <g class="g-spin"><g clip-path="url(#g-ball-clip)">
    <circle cx="50" cy="50" r="45" fill="var(--fun)"/>
    <path d="M0 36c30 14 70 14 100 0M4 76c26-18 66-18 92 0" stroke="#fffaf0" stroke-width="8" fill="none"/>
    <circle cx="50" cy="50" r="10" fill="#ffd34d" stroke="#fffaf0" stroke-width="4"/>
  </g></g>
  <circle cx="50" cy="50" r="45" fill="none" stroke="#1d1916" stroke-width="5"/>
  <ellipse cx="33" cy="27" rx="12" ry="7" transform="rotate(-30 33 27)" fill="#fff" opacity=".6"/>
</svg>`;

const GRADES = [
  { name: 'Okay', below: 0.35 },
  { name: 'Good', below: 0.65 },
  { name: 'Great', below: 0.9 },
  { name: 'Perfect', below: Infinity },
];
const CONFETTI = ['#e4513b', '#f0a35e', '#ffd34d', '#2e9b6f', '#2f8fd1', '#d94f8c', '#fffaf0'];

/* ---------------- the three games ---------------- */
// make(field, api) returns { layout(W, H), start(), step(dt, progress), result() }.
// Input listeners go through api.on so they're removed with the overlay.

const GOOD = ['🍓', '🍪', '🍙', '🥕', '🍇'];

const feed = {
  icon: 'food',
  kicker: 'Snack time',
  title: 'Snack catch',
  how: (name) => `Drag anywhere to move ${name}. Catch the snacks, dodge the socks and rocks.`,
  legend: `<div class="g-legend"><span><b>${GOOD.slice(0, 3).join('')}</b><small>yum +1</small></span><span class="g-legend-bad"><b>🧦<i>${ROCK}</i></b><small>yuck −1</small></span></div>`,
  unit: (s, m) => `${plural(s, 'snack', 'snacks')} <span>out of ${m}</span>`,
  make(field, api) {
    field.insertAdjacentHTML('beforeend', '<div class="g-floor"></div>');
    const pet = api.faces(['happy', 'miserable']);
    pet.classList.add('g-catcher');
    field.appendChild(pet);
    let W = 0, H = 0, px = 0, tx = 0, lean = 0;
    let spawnIn = 0.25, spawned = 0, score = 0, caught = 0, missed = 0, yuckT = 0, lastX = -1;
    const items = [];
    const SIZE = 46, PET = 90, PET_BOTTOM = 14;

    const aim = (e) => {
      if (api.phase !== 'play' && api.phase !== 'count') return;
      tx = api.pt(e).x;
    };
    api.on('pointerdown', aim);
    api.on('pointermove', aim);

    const spawn = (p) => {
      spawned++;
      const bad = spawned > 2 && Math.random() < 0.26;
      let x;
      do x = rand(SIZE / 2 + 4, W - SIZE / 2 - 4);
      while (lastX >= 0 && Math.abs(x - lastX) < 56 && W > 200);
      lastX = x;
      const node = document.createElement('span');
      node.className = `g-snack${bad ? ' g-bad' : ''}`;
      const kind = bad ? pick(['🧦', 'rock']) : pick(GOOD);
      node.innerHTML = kind === 'rock' ? ROCK : kind;
      field.insertBefore(node, pet);
      items.push({ node, bad, x, y: -SIZE, v: H * rand(0.3, 0.46) * (1 + 0.6 * p), r: rand(-20, 20), spin: rand(-90, 90) });
    };

    const eat = (it) => {
      const top = H - PET_BOTTOM - PET;
      if (it.bad) {
        score = Math.max(0, score - 1);
        yuckT = 0.7;
        pet.set('miserable');
        pet.pose('g-yuck');
        api.pop(it.x, top, 'yuck! −1', 'g-neg');
        S.play('yuck');
        S.buzz([30, 40, 30]);
      } else {
        score++;
        caught++;
        yuckT = 0;
        pet.set('happy');
        pet.pose('g-squish');
        api.pop(it.x, top - 6, '+1', 'g-plus');
        S.play('catch');
        S.buzz(12);
      }
      api.score(score);
    };

    return {
      layout(w, h) {
        W = w;
        H = h;
        if (!px) px = tx = W / 2;
        px = clamp(px, PET / 2, W - PET / 2);
        pet.style.transform = `translate3d(${px - PET / 2}px,0,0)`;
      },
      step(dt, p) {
        // the pet chases the finger quickly but smoothly, leaning into the move
        px += (tx - px) * (1 - Math.exp(-dt * 20));
        px = clamp(px, PET / 2, W - PET / 2);
        lean += (clamp((tx - px) * 0.3, -16, 16) - lean) * (1 - Math.exp(-dt * 12));
        pet.style.transform = `translate3d(${px - PET / 2}px,0,0) rotate(${lean}deg)`;
        if (yuckT > 0 && (yuckT -= dt) <= 0) pet.set('happy');

        if ((spawnIn -= dt) <= 0 && p < 0.97) {
          spawn(p);
          spawnIn = lerp(0.62, 0.4, p) * rand(0.8, 1.2);
        }
        const top = H - PET_BOTTOM - PET;
        const zoneTop = top + 8, zoneBottom = top + 62;
        for (let i = items.length - 1; i >= 0; i--) {
          const it = items[i];
          it.y += it.v * dt;
          it.r += it.spin * dt;
          let gone = false;
          if (it.y >= zoneTop && it.y <= zoneBottom && Math.abs(it.x - px) < PET / 2 - 4) {
            eat(it);
            gone = true;
          } else if (it.y > zoneBottom) {
            if (!it.bad && !it.passed) {
              it.passed = true;
              missed++;
            }
            if (it.y > H + SIZE) gone = true;
          }
          if (gone) {
            it.node.remove();
            items.splice(i, 1);
          } else {
            it.node.style.transform = `translate3d(${it.x - SIZE / 2}px,${it.y - SIZE / 2}px,0) rotate(${it.r}deg)`;
          }
        }
      },
      result: () => ({ score, max: Math.max(caught + missed, 1) }),
    };
  },
};

const TARGET = 12; // kicks for a full score (one every ~0.8s)

const play = {
  icon: 'fun',
  kicker: 'Play time',
  title: 'Keep it up',
  how: (name) => `Tap the ball to kick it up. Don’t let it hit the floor! ${name} is cheering you on.`,
  unit: (s) => `${plural(s, 'kick', 'kicks')} <span>out of ${TARGET}</span>`,
  make(field, api) {
    field.insertAdjacentHTML('beforeend', '<div class="g-floor"></div><div class="g-shadow"></div>');
    const shadow = field.querySelector('.g-shadow');
    const pet = api.faces(['happy', 'meh']);
    pet.classList.add('g-watcher');
    field.appendChild(pet);
    const ball = document.createElement('div');
    ball.className = 'g-ball';
    ball.innerHTML = BALL;
    field.appendChild(ball);
    const spin = ball.querySelector('.g-spin');

    let W = 0, H = 0, R = 34, G = 1700, floor = 0;
    let x = 0, y = 0, vx = 0, vy = 0, ang = 0, out = 0, kicks = 0, streak = 0, lean = 0, sadT = 0;
    const FLOOR = 26, PET = 96;

    const draw = () => {
      ball.style.transform = `translate3d(${x - R}px,${y - R}px,0)`;
      spin.style.transform = `rotate(${ang}deg)`;
      const h = clamp((floor - y) / floor, 0, 1);
      shadow.style.transform = `translate3d(${x - R}px,0,0) scale(${1 - h * 0.6},${1 - h * 0.4})`;
      shadow.style.opacity = String(0.9 - h * 0.6);
    };
    const respawn = (first) => {
      x = first ? W / 2 : rand(W * 0.25, W * 0.75);
      y = first ? H * 0.2 : -R;
      vx = first ? 0 : rand(-60, 60);
      vy = first ? 0 : 120;
      out = 0;
      ball.classList.remove('g-gone', 'g-squash');
      draw();
    };

    api.on('pointerdown', (e) => {
      if (api.phase !== 'play' || out) return;
      const p = api.pt(e);
      if (Math.hypot(p.x - x, p.y - y) > R * 1.75 || vy < -360) return;
      // kick up, pushed away from where it was hit, plus a little chaos
      vy = -Math.sqrt(2 * G * H * rand(0.3, 0.42));
      vx = clamp(((x - p.x) / R) * 260 + rand(-170, 170), -440, 440);
      kicks++;
      streak++;
      api.score(kicks);
      api.pop(p.x, p.y - R, streak === 5 ? 'Nice!' : streak === 10 ? 'Wow!' : streak === 15 ? 'Legend!' : '+1', 'g-plus');
      restart(ball, 'g-kicked');
      pet.set('happy');
      sadT = 0;
      pet.pose('g-jump');
      S.play('kick');
      S.buzz(15);
    });

    return {
      layout(w, h) {
        const first = !W;
        W = w;
        H = h;
        R = clamp(W * 0.09, 30, 40);
        G = H * 2.6;
        floor = H - FLOOR + 4;
        ball.style.width = ball.style.height = `${R * 2}px`;
        shadow.style.width = `${R * 2}px`;
        if (first) respawn(true);
        x = clamp(x, R, W - R);
        draw();
      },
      start() {
        vy = -Math.sqrt(2 * G * H * 0.12); // a little toss to get going
      },
      step(dt) {
        if (sadT > 0 && (sadT -= dt) <= 0) pet.set('happy');
        lean += (clamp(((x - W / 2) / W) * 30, -14, 14) - lean) * (1 - Math.exp(-dt * 6));
        pet.style.transform = `translateX(-50%) rotate(${lean}deg)`;
        if (out) {
          if ((out -= dt) <= 0) respawn(false);
          return;
        }
        vy += G * dt;
        x += vx * dt;
        y += vy * dt;
        vx *= Math.exp(-dt * 0.4);
        if (x < R) {
          x = R;
          vx = Math.abs(vx) * 0.85;
        } else if (x > W - R) {
          x = W - R;
          vx = -Math.abs(vx) * 0.85;
        }
        if (y < R && vy < 0) {
          y = R;
          vy = -vy * 0.35;
        }
        ang += vx * dt * 1.6;
        if (y > floor - R) {
          y = floor - R;
          out = 0.85;
          streak = 0;
          sadT = 0.9;
          pet.set('meh');
          ball.classList.add('g-squash');
          setTimeout(() => ball.classList.add('g-gone'), 180);
          api.pop(x, y - R - 10, 'oops', 'g-neg');
          S.play('drop');
          S.buzz(35);
        }
        draw();
      },
      result: () => ({ score: kicks, max: TARGET }),
    };
  },
};

const wash = {
  icon: 'clean',
  kicker: 'Bath time',
  title: 'Scrub-a-dub',
  how: (name) => `Rub the mud spots off ${name}. Get every last one!`,
  lookExtra: (st) => ({ sick: false, needs: { ...(st.needs || {}), clean: 100 } }),
  unit: (s, m) => `${plural(s, 'spot', 'spots')} cleaned <span>out of ${m}</span>`,
  make(field, api, st, pet0) {
    // a round tub; inside it the pet is zoomed so its body fills the tub whatever its size
    const big = document.createElement('div');
    big.className = 'g-big';
    const zoom = document.createElement('div');
    zoom.className = 'g-zoom';
    const pet = api.faces(['meh', 'happy']);
    const dirt = document.createElement('div');
    dirt.className = 'g-dirt';
    zoom.append(pet, dirt);
    big.appendChild(zoom);
    field.appendChild(big);

    // Scatter blobs over the body. Positions are in the pet's 200x200 drawing
    // units: picked in an ellipse on the unscaled body, then shrunk like the body.
    const sc = SCALE[st.stage] ?? 1;
    const eyeY = FACE_Y[traits(pet0.seed).body] ?? 122;
    const toView = (x, y) => [100 + (x - 100) * sc, 184 - (184 - y) * sc];
    const n = 10 + Math.floor(Math.random() * 3);
    const raw = [];
    for (let tries = 0; raw.length < n && tries < 5000; tries++) {
      const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random());
      const x = 100 + Math.cos(a) * d * 50, y = 126 + Math.sin(a) * d * 42;
      if (Math.abs(y - eyeY) < 17 && (Math.abs(x - 80) < 15 || Math.abs(x - 120) < 15)) continue; // leave the eyes peeking out
      const gap = tries < 3000 ? 22 : 15;
      if (raw.some((b) => Math.hypot(b.x - x, b.y - y) < gap)) continue;
      raw.push({ x, y });
    }
    const blobs = raw.map(({ x, y }) => {
      const [vx, vy] = toView(x, y);
      const vr = rand(9, 12.5) * sc;
      const node = document.createElement('i');
      node.className = 'g-blob';
      node.style.cssText = `left:${vx / 2}%;top:${vy / 2}%;width:${vr}%;height:${vr * rand(0.8, 1)}%;--rot:${rand(0, 360)}deg`;
      dirt.appendChild(node);
      return { vx, vy, vr, node, dirt: 1 };
    });
    const [, midY] = toView(100, 126);

    let S0 = 0, ox = 0, oy = 0, u = 1, cleaned = 0, bubT = 0, scrubT = 0;
    const FINGER = 12;
    const ptrs = new Map();
    const at = (b) => [ox + b.vx * u, oy + b.vy * u, b.vr * u];

    const segDist = (px, py, ax, ay, bx2, by2) => {
      const dx = bx2 - ax, dy = by2 - ay, L = dx * dx + dy * dy;
      const t = L ? clamp(((px - ax) * dx + (py - ay) * dy) / L, 0, 1) : 0;
      return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
    };
    const bubble = (x, y, big2) => {
      const sz = rand(10, big2 ? 26 : 18);
      api.fx('g-bub', x + rand(-12, 12), y + rand(-12, 12), '', 1000, { '--sz': `${sz}px`, '--dx': `${rand(-40, 40)}px`, '--dy': `${rand(-90, -40)}px` });
    };
    const clean = (b) => {
      b.dirt = 0;
      b.node.classList.add('g-clean');
      cleaned++;
      api.score(`${cleaned}/${blobs.length}`);
      const [cx, cy] = at(b);
      api.burst(cx, cy, 5, 46);
      pet.pose('g-squish');
      S.play('sparkle');
      S.buzz(10);
      if (cleaned * 2 >= blobs.length) pet.set('happy');
      if (cleaned === blobs.length) {
        api.burst(ox + 100 * u, oy + midY * u, 18, S0 * 0.55);
        api.end('Sparkling!', 'sparkle');
      }
    };

    api.on('pointerdown', (e) => {
      if (api.phase === 'play' || api.phase === 'count') ptrs.set(e.pointerId, api.pt(e));
    });
    api.on('pointermove', (e) => {
      const last = ptrs.get(e.pointerId);
      if (!last) return;
      const p = api.pt(e);
      ptrs.set(e.pointerId, p);
      if (api.phase !== 'play') return;
      const len = Math.hypot(p.x - last.x, p.y - last.y);
      if (!len) return;
      const rub = S0 * 0.8; // px of rubbing a spot needs: three or four passes
      let hit = false;
      for (const b of blobs) {
        if (!b.dirt) continue;
        const [cx, cy, r] = at(b);
        if (segDist(cx, cy, last.x, last.y, p.x, p.y) > r + FINGER) continue;
        hit = true;
        b.dirt = Math.max(0, b.dirt - Math.min(len, 2 * (r + FINGER)) / rub);
        b.node.style.opacity = String(0.2 + 0.8 * b.dirt);
        b.node.style.setProperty('--s', String(0.7 + 0.3 * b.dirt));
        if (!b.dirt) clean(b);
      }
      const now = performance.now();
      const onPet = Math.hypot(p.x - (ox + 100 * u), p.y - (oy + midY * u)) < S0 * 0.4;
      if ((hit || onPet) && now - bubT > (hit ? 30 : 90)) {
        bubT = now;
        bubble(p.x, p.y, hit);
      }
      if (hit && now - scrubT > 75) {
        scrubT = now;
        S.play('scrub');
      }
    });
    const lift = (e) => ptrs.delete(e.pointerId);
    api.on('pointerup', lift);
    api.on('pointercancel', lift);

    return {
      layout(w, h) {
        S0 = Math.round(Math.min(w - 32, h * 0.72, 380));
        const bx = (w - S0) / 2, by = (h - S0) / 2;
        big.style.cssText = `width:${S0}px;height:${S0}px;left:${bx}px;top:${by}px`;
        // the body is ~130 units tall at full size: make it fill ~62% of the tub
        const P = (S0 * 0.62 * 200) / (130 * sc);
        u = P / 200;
        const zx = S0 / 2 - 100 * u, zy = S0 * 0.53 - midY * u;
        zoom.style.cssText = `width:${P}px;height:${P}px;left:${zx}px;top:${zy}px`;
        ox = bx + zx;
        oy = by + zy;
      },
      step() {},
      result: () => ({ score: cleaned, max: blobs.length }),
    };
  },
};

const GAMES = { feed, play, wash };

/* ---------------- the overlay ---------------- */

/**
 * kind: 'feed' | 'play' | 'wash'
 * pet: the pet object (pass straight to petSVG)
 * st: its status object
 * Resolves { ratio, score, max, skipped } where ratio is 0..1 (how well they did).
 * If the player skips, resolves { ratio: 0.5, score: 0, max: 0, skipped: true }.
 */
export function playGame(kind, pet, st) {
  return new Promise((resolve) => {
    const id = GAMES[kind] ? kind : 'feed';
    const def = GAMES[id];
    const name = esc(pet.name);
    const extra = def.lookExtra ? def.lookExtra(st) : {};
    const look = (mood) => petSVG(pet, { ...st, ...extra, mood });
    const returnFocus = document.activeElement;

    const el = document.createElement('div');
    el.className = `g-wrap g-${id}`;
    el.dataset.phase = 'intro';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', def.title);
    el.tabIndex = -1;
    el.innerHTML = `
      <div class="g-hud">
        <div class="g-score" aria-live="polite">${ICONS[def.icon]}<b>0</b></div>
        <div class="g-time" aria-hidden="true"><i></i></div>
        <button class="g-skip" type="button">Skip</button>
      </div>
      <div class="g-field"></div>
      <div class="g-layer"></div>`;
    document.body.appendChild(el);
    const $ = (s) => el.querySelector(s);
    const field = $('.g-field');
    const layer = $('.g-layer');
    const scoreEl = $('.g-score b');
    const bar = $('.g-time i');

    const timers = new Set();
    const later = (fn, ms) => {
      const t = setTimeout(() => {
        timers.delete(t);
        fn();
      }, ms);
      timers.add(t);
    };
    const listeners = [];
    const on = (target, type, fn, opts) => {
      target.addEventListener(type, fn, opts);
      listeners.push(() => target.removeEventListener(type, fn, opts));
    };

    let rect = { left: 0, top: 0 };
    const measure = () => {
      const r = field.getBoundingClientRect();
      rect = { left: r.left + field.clientLeft, top: r.top + field.clientTop };
      game.layout(field.clientWidth, field.clientHeight);
    };

    const fx = (cls, x, y, html = '', life = 900, vars = {}) => {
      const e = document.createElement('span');
      e.className = cls;
      e.style.left = `${x}px`;
      e.style.top = `${y}px`;
      for (const k in vars) e.style.setProperty(k, vars[k]);
      e.innerHTML = html;
      field.appendChild(e);
      setTimeout(() => e.remove(), life);
      return e;
    };

    const api = {
      phase: 'intro',
      on: (type, fn) => on(el, type, (e) => !e.target.closest('button') && fn(e)),
      pt: (e) => ({ x: e.clientX - rect.left, y: e.clientY - rect.top }),
      fx,
      pop: (x, y, text, cls = '') => fx(`g-pop ${cls}`, x, y, esc(text), 800),
      burst(x, y, n, dist) {
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + rand(-0.3, 0.3), d = dist * rand(0.6, 1.1);
          fx('g-spark', x, y, SPARK, 800, { '--dx': `${Math.cos(a) * d}px`, '--dy': `${Math.sin(a) * d}px`, '--sz': `${rand(14, 24)}px` });
        }
      },
      score(v) {
        scoreEl.textContent = String(v);
        restart(scoreEl, 'g-bump');
      },
      faces(moods) {
        const box = document.createElement('div');
        box.className = 'g-pet';
        box.innerHTML = `<div class="g-pose">${moods.map((m) => `<div class="g-face" data-m="${m}">${look(m)}</div>`).join('')}</div>`;
        const pose = box.firstChild;
        box.set = (m) => box.querySelectorAll('.g-face').forEach((f) => (f.hidden = f.dataset.m !== m));
        box.pose = (cls) => {
          pose.classList.remove('g-squish', 'g-yuck', 'g-jump');
          void pose.offsetWidth;
          pose.classList.add(cls);
        };
        box.set(moods[0]);
        return box;
      },
      end: (msg, sound) => finish(msg, sound),
    };

    const game = def.make(field, api, st, pet);
    if (id === 'wash') scoreEl.textContent = `0/${game.result().max}`;
    measure();
    on(window, 'resize', measure);
    on(el, 'contextmenu', (e) => e.preventDefault());
    on(document, 'keydown', (e) => {
      if (e.key === 'Escape' && api.phase !== 'end') skip();
    });

    const setPhase = (p) => {
      api.phase = p;
      el.dataset.phase = p;
    };

    let resolved = false;
    let raf = 0;
    const done = (res) => {
      if (resolved) return;
      resolved = true;
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      listeners.forEach((off) => off());
      el.classList.add('g-out');
      if (!document.querySelector('.g-wrap:not(.g-out)')) document.documentElement.classList.remove('g-lock');
      setTimeout(() => el.remove(), 260);
      if (returnFocus && returnFocus.focus) returnFocus.focus({ preventScroll: true });
      resolve(res);
    };
    const skip = () => done({ ratio: 0.5, score: 0, max: 0, skipped: true });

    // ---- intro ----
    layer.innerHTML = `
      <div class="g-card g-intro">
        <p class="g-kicker">${ICONS[def.icon]}${def.kicker}</p>
        <h2>${def.title}</h2>
        <p class="g-how">${def.how(name)}</p>
        ${def.legend || ''}
        <button class="g-btn g-start" type="button">Start</button>
        <button class="g-link g-skip" type="button">Skip</button>
      </div>`;
    requestAnimationFrame(() => el.classList.add('g-in'));
    el.focus({ preventScroll: true });
    document.documentElement.classList.add('g-lock');
    el.querySelectorAll('.g-skip').forEach((b) => on(b, 'click', skip));
    on($('.g-start'), 'click', () => {
      S.unlock();
      countdown();
    });

    // ---- 3-2-1 ----
    const beat = (text, cls = '') => {
      layer.innerHTML = `<div class="g-count ${cls}">${text}</div>`;
    };
    const countdown = () => {
      setPhase('count');
      [3, 2, 1].forEach((n, i) =>
        later(() => {
          beat(n);
          S.play('tick');
          S.buzz(8);
        }, i * STEP_MS),
      );
      later(() => {
        beat('Go!', 'g-go');
        S.play('go');
        later(() => (layer.innerHTML = ''), 500);
        begin();
      }, 3 * STEP_MS);
    };

    // ---- play ----
    let elapsed = 0;
    let last = 0;
    let lastSec = 99;
    const begin = () => {
      setPhase('play');
      game.start?.();
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };
    const frame = (now) => {
      if (api.phase !== 'play') return;
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); // pauses while hidden
      last = now;
      elapsed += dt * 1000;
      const p = Math.min(1, elapsed / PLAY_MS);
      game.step(dt, p);
      bar.style.transform = `scaleX(${1 - p})`;
      const left = Math.ceil((PLAY_MS - elapsed) / 1000);
      if (left <= 3 && left < lastSec && left > 0) {
        lastSec = left;
        el.classList.add('g-low');
        S.play('tick');
      }
      if (elapsed >= PLAY_MS) finish("Time's up!");
    };

    // ---- the end ----
    const finish = (msg, sound = 'timeup') => {
      if (api.phase !== 'play') return;
      setPhase('over');
      cancelAnimationFrame(raf);
      el.classList.remove('g-low');
      const { score, max } = game.result();
      const ratio = max > 0 ? clamp(score / max, 0, 1) : 0;
      beat(esc(msg), 'g-banner');
      S.play(sound);
      S.buzz([20, 40, 20]);
      later(() => showEnd({ ratio, score, max, skipped: false }), 900);
    };

    const showEnd = (res) => {
      setPhase('end');
      const gi = GRADES.findIndex((g) => res.ratio < g.below);
      const g = GRADES[gi];
      layer.innerHTML = `
        <div class="g-card g-end g-grade-${g.name.toLowerCase()}">
          <p class="g-kicker">${ICONS[def.icon]}${def.title}</p>
          <div class="g-endpet">${look('happy')}</div>
          <div class="g-grade">${g.name}${gi === 3 ? '!' : ''}</div>
          <div class="g-pips" aria-label="${gi + 1} of 4 stars">${GRADES.map((_, i) => `<span class="${i <= gi ? 'on' : ''}" style="--i:${i}">${STAR}</span>`).join('')}</div>
          <p class="g-result"><b>${res.score}</b> ${def.unit(res.score, res.max)}</p>
          <button class="g-btn g-save" type="button">Tap your fob to save</button>
        </div>`;
      S.play(gi >= 2 ? 'fanfare' : 'tada');
      S.buzz(gi >= 2 ? [40, 60, 90] : 40);
      if (gi >= 2) confetti(gi === 3 ? 56 : 34);
      const save = $('.g-save');
      save.focus({ preventScroll: true });
      on(save, 'click', () => done(res));
    };

    const confetti = (n) => {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      for (let i = 0; i < n; i++) {
        const s = document.createElement('span');
        s.className = 'g-confetti';
        const a = Math.random() * Math.PI * 2, d = 110 + Math.random() * 170;
        s.style.setProperty('--dx', `${Math.cos(a) * d}px`);
        s.style.setProperty('--dy', `${Math.sin(a) * d - 70}px`);
        s.style.setProperty('--rot', `${rand(-360, 360)}deg`);
        s.style.background = CONFETTI[i % CONFETTI.length];
        s.style.animationDelay = `${Math.random() * 90}ms`;
        el.appendChild(s);
        setTimeout(() => s.remove(), 1800);
      }
    };
  });
}
