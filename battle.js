// The battle screen: your pet against a pet read from someone else's fob.
// Three rounds. You time your strike on a meter; their attacks are rolled.
import { petSVG, esc, STAGE_NAMES } from './render.js?v=mwy9c64y';
import * as P from './pet.js?v=mwy9c64y';
import * as S from './sound.js?v=mwy9c64y';

const rand = (a, b) => a + Math.random() * (b - a);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Resolves true (you won), false (you lost) or null (you ran away).
 * The caller saves the result onto your own fob afterwards.
 */
export function battle(me, foe, now) {
  return new Promise((resolve) => {
    const A = P.fighter(me, now);
    const B = P.fighter(foe, now);
    const edge = P.typeEdge(me, foe);
    const foeEdge = P.typeEdge(foe, me);
    const shape = (p) => P.BODY_NAMES[P.traits(p.seed).body];
    const look = (st) => ({ ...st, mood: 'happy', sick: false, needs: { ...st.needs, clean: 100 } });
    let hpA = A.hp;
    let hpB = B.hp;
    let over = false;

    const el = document.createElement('div');
    el.className = 'bt';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    const tag = (p, st, side) => `<div class="bt-tag ${side}"><b>${esc(p.name)}</b><small>${STAGE_NAMES[st.stage]} · ${shape(p)}${st.form ? ` · ${st.form}` : ''}</small><span class="bt-hp"><i></i></span></div>`;
    el.innerHTML = `
      <button class="bt-flee">run away</button>
      ${tag(foe, B.st, 'foe')}
      <div class="bt-arena">
        <div class="bt-pet foe"><div class="bt-flip">${petSVG(foe, look(B.st))}</div></div>
        <div class="bt-pet me">${petSVG(me, look(A.st))}</div>
      </div>
      ${tag(me, A.st, 'me')}
      <p class="bt-msg"></p>
      <div class="bt-meter" hidden><div class="bt-zone"></div><div class="bt-needle"></div></div>
      <button class="btn primary bt-go">Fight!</button>`;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('in'));
    const $ = (s) => el.querySelector(s);
    const msg = (t) => ($('.bt-msg').innerHTML = t);
    const petEl = { me: $('.bt-pet.me'), foe: $('.bt-pet.foe') };
    const hpBar = (side, hp, max) => {
      const i = $(`.bt-tag.${side} .bt-hp i`);
      const pct = Math.max(0, hp / max) * 100;
      i.style.width = `${pct}%`;
      i.className = pct > 50 ? 'ok' : pct > 20 ? 'warn' : 'bad';
    };
    hpBar('me', hpA, A.hp);
    hpBar('foe', hpB, B.hp);

    if (edge > 1) msg(`Your <b>${shape(me)}</b> has the edge over their <b>${shape(foe)}</b>!`);
    else if (edge < 1) msg(`Uh oh: ${shape(me)}s are weak against ${shape(foe)}s.`);
    else msg(`${esc(me.name)} vs ${esc(foe.name)}. An even match.`);

    const anim = (node, cls, ms) => {
      node.classList.remove(cls);
      void node.offsetWidth;
      node.classList.add(cls);
      return wait(ms);
    };
    const pop = (side, text, big) => {
      const s = document.createElement('span');
      s.className = `bt-pop${big ? ' big' : ''}`;
      s.textContent = text;
      petEl[side].appendChild(s);
      setTimeout(() => s.remove(), 1100);
    };

    // The strike meter: a needle sweeps; stop it in the middle for a big hit.
    const strike = (round) =>
      new Promise((done) => {
        const meter = $('.bt-meter');
        const needle = $('.bt-needle');
        const go = $('.bt-go');
        meter.hidden = false;
        go.textContent = 'Strike!';
        go.hidden = false;
        const speed = 1.1 + round * 0.45;
        const t0 = performance.now();
        let pos = 0;
        let raf = 0;
        const step = (t) => {
          pos = 0.5 - 0.5 * Math.cos(((t - t0) / 1000) * speed * Math.PI);
          needle.style.left = `${pos * 100}%`;
          raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
        go.onclick = () => {
          cancelAnimationFrame(raf);
          go.onclick = null;
          go.hidden = true;
          const mult = 1.5 - Math.abs(pos - 0.5) * 2; // 0.5 .. 1.5
          setTimeout(() => (meter.hidden = true), 350);
          done(mult);
        };
      });

    const finish = async (won) => {
      over = true;
      $('.bt-flee').hidden = true;
      await anim(petEl[won ? 'foe' : 'me'], 'ko', 700);
      anim(petEl[won ? 'me' : 'foe'], 'win', 900);
      S.play(won ? 'reveal' : 'sad');
      S.buzz(won ? [40, 60, 90] : [120]);
      el.classList.add(won ? 'won' : 'lost');
      msg(won ? `<b>You win!</b> +25 xp, and it had fun.` : `<b>You lost.</b> +6 xp for trying.`);
      const go = $('.bt-go');
      go.textContent = 'Tap your fob to save';
      go.hidden = false;
      go.onclick = () => close(won);
    };

    const close = (result) => {
      el.classList.remove('in');
      setTimeout(() => el.remove(), 250);
      resolve(result);
    };

    const fight = async () => {
      S.unlock();
      S.play('rise');
      for (let round = 0; round < 3 && !over; round++) {
        msg(`Round ${round + 1}. Stop the needle in the middle!`);
        const mult = await strike(round);
        if (over) return;
        msg(mult > 1.35 ? '<b>Perfect strike!</b>' : mult > 1 ? 'Nice hit!' : 'A weak swipe…');
        const dmg = Math.max(1, Math.round(A.power * mult * edge * rand(0.85, 1.15) * 0.55));
        await anim(petEl.me, 'lunge', 260);
        anim(petEl.foe, 'hit', 500);
        S.play('crack');
        S.buzz(30);
        pop('foe', `-${dmg}`, mult > 1.35);
        hpB -= dmg;
        hpBar('foe', hpB, B.hp);
        await wait(650);
        if (hpB <= 0) return finish(true);
        if (over) return;
        const back = Math.max(1, Math.round(B.power * rand(0.7, 1.3) * foeEdge * 0.55));
        msg(`${esc(foe.name)} strikes back!`);
        await anim(petEl.foe, 'lunge', 260);
        anim(petEl.me, 'hit', 500);
        S.play('poke');
        S.buzz([20, 30, 20]);
        pop('me', `-${back}`);
        hpA -= back;
        hpBar('me', hpA, A.hp);
        await wait(750);
        if (hpA <= 0) return finish(false);
      }
      if (!over) finish(hpA / A.hp >= hpB / B.hp);
    };

    $('.bt-go').onclick = () => {
      $('.bt-go').onclick = null;
      fight();
    };
    $('.bt-flee').onclick = () => {
      if (over) return;
      over = true;
      close(null);
    };
  });
}
