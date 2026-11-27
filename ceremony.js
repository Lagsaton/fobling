// Full-screen hatch and evolve animations. They wait for a tap before playing,
// so nobody misses them and the browser lets the sound play.
import { petSVG, eggSVG, esc, STAGE_NAMES } from './render.js?v=mwy9c64y';
import { FORM_TEXT, TRAIT_NAMES } from './pet.js?v=mwy9c64y';
import * as S from './sound.js?v=mwy9c64y';

const CONFETTI = ['#e4513b', '#f0a35e', '#ffd34d', '#2e9b6f', '#2f8fd1', '#d94f8c', '#fffaf0'];
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const article = (w) => (/^[aeiou]/.test(w) ? 'an' : 'a');

function confetti(host, n = 44) {
  if (reduced()) return;
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span');
    s.className = 'confetti';
    const a = Math.random() * Math.PI * 2;
    const d = 120 + Math.random() * 160;
    s.style.setProperty('--dx', `${Math.cos(a) * d}px`);
    s.style.setProperty('--dy', `${Math.sin(a) * d - 60}px`);
    s.style.setProperty('--rot', `${Math.random() * 720 - 360}deg`);
    s.style.background = CONFETTI[i % CONFETTI.length];
    s.style.animationDelay = `${Math.random() * 90}ms`;
    host.appendChild(s);
    setTimeout(() => s.remove(), 1800);
  }
}

/**
 * kind: 'hatch' | 'evolve'
 * pet: the pet; before/after: status objects for the old and new look.
 * Resolves when the person closes it.
 */
export function ceremony({ kind, pet, before, after }) {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = `cere cere-${kind}`;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.innerHTML = `
      <div class="cere-rays" aria-hidden="true"></div>
      <div class="cere-flash" aria-hidden="true"></div>
      <div class="cere-pet"></div>
      <div class="cere-text">
        <p class="cere-kicker">Something's happening…</p>
        <h2></h2>
        <p class="cere-sub"></p>
      </div>
      <button class="btn primary cere-go"></button>
      <button class="cere-skip">skip</button>`;
    document.body.appendChild(el);
    const $ = (s) => el.querySelector(s);
    const stage = $('.cere-pet');
    const name = esc(pet.name);
    let skipped = false;
    let finished = false;
    const sleep = (ms) => new Promise((r) => (skipped ? r() : setTimeout(r, ms)));

    const close = () => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 250);
      resolve();
    };

    // --- the before picture and the prompt ---
    if (kind === 'hatch') {
      stage.innerHTML = eggSVG(pet.seed, { cracks: 1 });
      $('h2').innerHTML = `${name} is hatching!`;
      $('.cere-go').textContent = 'Watch it hatch';
    } else {
      stage.innerHTML = `<div class="old">${petSVG(pet, before)}</div><div class="new">${petSVG(pet, after)}</div>`;
      $('h2').innerHTML = `${name} is growing!`;
      $('.cere-go').textContent = 'Watch';
    }
    requestAnimationFrame(() => el.classList.add('in'));

    const finale = ({ redraw = true } = {}) => {
      if (finished) return;
      finished = true;
      el.classList.remove('rolling');
      el.classList.add('done');
      stage.classList.remove('sil', 'swap', 'shake');
      if (redraw) stage.innerHTML = `<div class="reveal">${petSVG(pet, after)}</div>`;
      confetti(el);
      S.play('reveal');
      S.buzz([40, 60, 90]);
      if (kind === 'hatch') {
        $('.cere-kicker').textContent = 'Hatched!';
        $('h2').innerHTML = `Say hi to ${name}`;
        let sub = 'Keep it fed, played with and clean.';
        if (pet.shiny) sub = '✦ It’s a <b>shiny</b>! Only 1 in 64 hatch like this.';
        else if (pet.gen > 1 && pet.inherited) sub = `Generation ${pet.gen}. It has its parent’s ${TRAIT_NAMES[pet.inherited - 1]}.`;
        $('.cere-sub').innerHTML = sub;
        $('.cere-go').textContent = `Hello, ${pet.name}`;
      } else {
        const st = STAGE_NAMES[after.stage];
        const form = after.form && before.stage < 3 ? after.form : '';
        $('.cere-kicker').textContent = 'Evolved!';
        $('h2').innerHTML = `${name} is now ${form ? `${article(form)} ${form} ${st}` : `${article(st)} ${st}`}`;
        $('.cere-sub').innerHTML = form ? FORM_TEXT[form] : after.stage === 4 ? 'A wise old elder of the keyring.' : 'Keep caring for it to see what it becomes.';
        $('.cere-go').textContent = 'Nice';
      }
      $('.cere-go').hidden = false;
      $('.cere-skip').hidden = true;
    };

    const run = async () => {
      S.unlock();
      $('.cere-go').hidden = true;
      if (reduced()) return finale();
      el.classList.add('rolling');
      if (kind === 'hatch') {
        $('.cere-kicker').textContent = 'Crack…';
        for (let i = 1; i <= 3 && !skipped; i++) {
          stage.innerHTML = eggSVG(pet.seed, { cracks: i });
          stage.classList.remove('shake');
          void stage.offsetWidth;
          stage.classList.add('shake');
          S.play('crack');
          S.buzz(25 + i * 15);
          await sleep(i === 3 ? 900 : 720);
        }
        if (skipped) return finale();
        // the shell splits, then the creature pops out
        stage.classList.remove('shake');
        stage.innerHTML = `<div class="reveal">${petSVG(pet, after)}</div><div class="shells">${eggSVG(pet.seed, { split: true })}</div>`;
        el.classList.add('flashing');
        await sleep(650);
        el.classList.remove('flashing');
        finale({ redraw: false }); // keep the flying shells in the shot
      } else {
        $('.cere-kicker').textContent = 'Whoa…';
        S.play('rise');
        stage.classList.add('sil');
        const gaps = [420, 360, 300, 250, 210, 170, 140, 115, 95, 80, 70, 60, 55, 50, 45, 45];
        for (let i = 0; i < gaps.length && !skipped; i++) {
          stage.classList.toggle('swap');
          await sleep(gaps[i]);
        }
        if (skipped) return finale();
        el.classList.add('flashing');
        await sleep(350);
        finale();
        await sleep(400);
        el.classList.remove('flashing');
      }
    };

    $('.cere-go').addEventListener('click', () => (finished ? close() : run()));
    $('.cere-skip').addEventListener('click', () => {
      skipped = true;
      finale();
    });
  });
}
