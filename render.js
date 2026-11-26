// Draws a fobling as inline SVG from its seed, stage, mood and adult form.
import { traits, STAGES } from './pet.js';

const INK = 'var(--pet-ink)';
const SCALE = [0.6, 0.74, 0.86, 1, 0.97];
let uid = 0;

// Each body: an outline path (or circles, for the puff), where the face sits, and the top of the head.
const BODIES = [
  { d: 'M100 44C148 44 166 88 166 124C166 160 136 176 100 176C64 176 34 160 34 124C34 88 52 44 100 44Z', face: 112, top: 44 },
  { d: 'M102 30C140 30 154 70 152 110C150 150 140 176 100 176C62 176 48 150 50 112C52 72 64 30 102 30Z', face: 100, top: 30 },
  { circles: [[100, 120, 56], [62, 132, 34], [138, 132, 34], [80, 86, 30], [122, 86, 30]], face: 116, top: 56 },
  { d: 'M100 56C140 56 160 98 160 130C160 162 132 176 100 176C68 176 40 162 40 130C40 98 60 56 100 56Z', face: 122, top: 56 },
];

const shapes = (b, attrs) =>
  b.circles ? b.circles.map(([cx, cy, r]) => `<circle cx="${cx}" cy="${cy}" r="${r}" ${attrs}/>`).join('') : `<path d="${b.d}" ${attrs}/>`;

const line = (d, w = 4, extra = '') => `<path d="${d}" stroke="${INK}" stroke-width="${w}" fill="none" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
const star = (x, y, r, fill, cls = '') =>
  `<path class="${cls}" d="M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z" fill="${fill}"/>`;

function colours(t, form) {
  if (form === 'grumpy') return { body: `hsl(${t.hue} 22% 50%)`, dark: `hsl(${t.hue} 20% 34%)`, pat: `hsl(${t.hue} 24% 40%)`, light: `hsl(${t.hue} 25% 70%)` };
  if (form === 'radiant') return { body: `hsl(${t.hue} 80% 68%)`, dark: `hsl(${t.hue} 60% 44%)`, pat: `hsl(${(t.hue + 40) % 360} 85% 58%)`, light: `hsl(48 100% 88%)` };
  return { body: `hsl(${t.hue} 68% 64%)`, dark: `hsl(${t.hue} 55% 42%)`, pat: `hsl(${t.hue} 72% 46%)`, light: `hsl(${t.hue} 85% 86%)` };
}

function pattern(kind, c, face) {
  if (kind === 1)
    return [[70, 70, 9], [132, 76, 7], [148, 130, 10], [56, 140, 8], [118, 158, 7], [90, 160, 5]]
      .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c.pat}"/>`).join('');
  if (kind === 2) return [52, 70, 150, 168].map((y) => `<path d="M20 ${y}Q100 ${y - 14} 180 ${y}" stroke="${c.pat}" stroke-width="9" fill="none"/>`).join('');
  if (kind === 3) return `<ellipse cx="100" cy="${face + 44}" rx="40" ry="30" fill="${c.light}"/>`;
  return '';
}

function eyes(style, mood, y, form) {
  const L = 80, R = 120;
  if (mood === 'asleep') return [L, R].map((x) => line(`M${x - 8} ${y}q8 7 16 0`)).join('');
  if (mood === 'dead') return [L, R].map((x) => line(`M${x - 6} ${y - 6}l12 12M${x + 6} ${y - 6}l-12 12`)).join('');
  const r = [7, 9, 4.5, 7][style];
  const ry = style === 1 ? 11 : r;
  let s = '<g class="eyes">';
  s += [L, R].map((x, i) => {
    const small = style === 3 && i === 1;
    const rx = small ? r * 0.7 : r;
    const rr = small ? ry * 0.7 : ry;
    return `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${rr}" fill="${INK}"/>` +
      (style !== 2 ? `<circle cx="${x + rx * 0.35}" cy="${y - rr * 0.4}" r="${Math.max(1.6, rx * 0.32)}" fill="#fff"/>` : '');
  }).join('');
  s += '</g>';
  if (mood === 'meh') s += [L, R].map((x) => line(`M${x - 11} ${y - 3}h22`)).join('');
  if (form === 'grumpy') {
    s += line(`M${L - 12} ${y - 16}l16 7M${R + 12} ${y - 16}l-16 7`, 5);
    s += line(`M${L - 7} ${y + 12}q7 4 14 0M${R - 7} ${y + 12}q7 4 14 0`, 2.5, 'opacity=".5"');
  } else if (mood === 'miserable' || mood === 'starving') {
    s += line(`M${L - 10} ${y - 12}l14 -6M${R + 10} ${y - 12}l-14 -6`);
  }
  return s;
}

function mouth(mood, y, form) {
  const m = y + 22;
  if (form === 'grumpy' && (mood === 'happy' || mood === 'meh')) return line(`M90 ${m + 2}q8 -5 20 -1`);
  switch (mood) {
    case 'happy': return `<path d="M88 ${m - 2}Q100 ${m + 12} 112 ${m - 2}Z" fill="${INK}"/>`;
    case 'meh': return line(`M92 ${m}h16`);
    case 'asleep': return `<circle cx="100" cy="${m}" r="3.5" fill="${INK}"/>`;
    case 'dead': return line(`M90 ${m + 2}q5 -5 10 0t10 0`);
    case 'starving': return `<ellipse cx="100" cy="${m + 2}" rx="7" ry="9" fill="${INK}"/>`;
    default: return line(`M89 ${m + 5}Q100 ${m - 6} 111 ${m + 5}`);
  }
}

const heart = (x, y, s, fill) =>
  `<path d="M${x} ${y + s * 0.9}C${x - s * 1.6} ${y - s * 0.1} ${x - s * 0.8} ${y - s * 1.3} ${x} ${y - s * 0.4}C${x + s * 0.8} ${y - s * 1.3} ${x + s * 1.6} ${y - s * 0.1} ${x} ${y + s * 0.9}Z" fill="${fill}"/>`;

function behind(stage, t, b, c, form, id) {
  let s = '';
  if (stage >= 1)
    s += [80, 120].map((x) => `<ellipse cx="${x}" cy="176" rx="14" ry="8" fill="${c.dark}" stroke="${INK}" stroke-width="4"/>`).join('');
  if (stage >= 2) {
    const top = b.face - 62;
    s += t.extra & 1
      ? line(`M88 ${top + 10}L78 ${top - 20}M112 ${top + 10}L122 ${top - 20}`) +
        [78, 122].map((x) => `<circle cx="${x}" cy="${top - 22}" r="7" fill="hsl(${(t.hue + 150) % 360} 80% 60%)" stroke="${INK}" stroke-width="4"/>`).join('')
      : `<path d="M58 ${top + 30}L62 ${top - 8}L90 ${top + 14}ZM142 ${top + 30}L138 ${top - 8}L110 ${top + 14}Z" fill="${c.dark}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`;
  }
  if (form === 'cuddly') s += shapes(b, `fill="${c.body}" stroke="${c.body}" stroke-width="16" stroke-dasharray="1.5 8" stroke-linecap="round"`);
  if (form === 'radiant') s += `<circle cx="100" cy="${b.face + 10}" r="92" fill="url(#${id}g)"/>`;
  return s;
}

function front(stage, t, b, c, form, mood) {
  const f = b.face;
  let s = '';
  if (form === 'cuddly') s += heart(64, f + 14, 7, 'hsl(345 90% 66%)') + heart(136, f + 14, 7, 'hsl(345 90% 66%)');
  else if (stage >= 3 || t.extra & 2) s += `<ellipse cx="66" cy="${f + 14}" rx="9" ry="5" fill="hsl(350 90% 70% / .7)"/><ellipse cx="134" cy="${f + 14}" rx="9" ry="5" fill="hsl(350 90% 70% / .7)"/>`;
  if (stage >= 4 && form !== 'grumpy' && mood !== 'asleep') s += line(`M68 ${f - 18}q12 -8 24 0M108 ${f - 18}q12 -8 24 0`, 6, 'stroke="#fff"').replace(`stroke="${INK}" `, '');
  if (form === 'grumpy') s += line(`M84 ${b.top + 4}l6 -14l5 12l6 -16l5 14l6 -12l4 14`, 4);
  return s;
}

function sprout(hue) {
  return line('M100 58V36') +
    `<path d="M100 40C88 22 70 24 66 30C76 42 92 44 100 40Z" fill="hsl(${(hue + 100) % 360} 60% 50%)" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`;
}

/** Things that float above the scaled body (so they don't shrink with it). */
function overlay(st, b, sc, form) {
  const headY = 184 - (184 - b.top) * sc;
  let s = '';
  if (form === 'radiant')
    s += `<g class="halo"><ellipse cx="100" cy="${headY - 16}" rx="28" ry="7" fill="none" stroke="${INK}" stroke-width="9"/><ellipse cx="100" cy="${headY - 16}" rx="28" ry="7" fill="none" stroke="#ffd34d" stroke-width="5"/></g>`;
  if (st.shiny || form === 'radiant')
    s += star(40, 70, 8, '#fff6c2', 'twinkle') + star(164, 98, 6, '#fff6c2', 'twinkle t2') + star(150, 40, 5, '#fff6c2', 'twinkle t3');
  if (st.mood === 'asleep')
    s += `<text class="zzz" x="150" y="54" font-size="26" font-weight="800" fill="${INK}">z</text><text class="zzz z2" x="166" y="36" font-size="18" font-weight="800" fill="${INK}">z</text>`;
  if (st.mood === 'miserable' || st.mood === 'starving')
    s += `<path class="drop" d="M150 80q8 12 0 16q-8 -4 0 -16Z" fill="hsl(200 90% 70%)" stroke="${INK}" stroke-width="3"/>`;
  return s;
}

/** st needs: dead, egg, stage, mood, sick, needs.clean, form, shiny */
export function petSVG(p, st) {
  const t = traits(p.seed);
  if (st.dead) return graveSVG(p, t);
  if (st.egg) return eggSVG(p.seed, { cracks: st.hatchIn <= 5 ? 1 : 0 });
  const form = st.form || '';
  const b = BODIES[t.body];
  const c = colours(t, form);
  const id = `f${++uid}`;
  const sc = SCALE[st.stage];
  const sick = st.sick ? `<g opacity=".55">${shapes(b, 'fill="hsl(95 60% 45%)"')}</g>` : '';
  const dirt = st.needs && st.needs.clean < 40 ? `<g fill="hsl(30 40% 30% / .55)"><circle cx="58" cy="150" r="6"/><circle cx="70" cy="160" r="3.5"/><circle cx="140" cy="154" r="5"/></g>` : '';
  const sheen = st.shiny
    ? `<rect x="0" y="0" width="200" height="200" fill="url(#${id}r)" opacity=".38" style="mix-blend-mode:soft-light"/>` +
      `<rect x="0" y="0" width="200" height="200" fill="url(#${id}r)" opacity=".22"/>` +
      `<rect class="sheen" x="-60" y="0" width="40" height="200" fill="url(#${id}s)" transform="rotate(20 100 100)"/>`
    : '';
  return `<svg viewBox="0 0 200 200" class="pet mood-${st.mood}${form ? ` form-${form}` : ''}${st.shiny ? ' shiny' : ''}" role="img" aria-label="${esc(p.name)}, ${st.mood}">
  <defs>
    <clipPath id="${id}">${shapes(b, '')}</clipPath>
    <linearGradient id="${id}s" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <linearGradient id="${id}r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff7ad9"/><stop offset=".35" stop-color="#7ad7ff"/><stop offset=".7" stop-color="#b6ff8a"/><stop offset="1" stop-color="#ffe066"/></linearGradient>
    <radialGradient id="${id}g"><stop offset=".55" stop-color="#ffe680" stop-opacity=".55"/><stop offset="1" stop-color="#ffe680" stop-opacity="0"/></radialGradient>
    <radialGradient id="${id}h" cx=".35" cy=".3" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  </defs>
  <ellipse class="shadow" cx="100" cy="184" rx="58" ry="8" fill="var(--shadow)"/>
  <g class="bob"><g class="squish"><g transform="translate(100 184) scale(${sc}) translate(-100 -184)">
    ${behind(st.stage, t, b, c, form, id)}
    ${t.body === 3 ? sprout(t.hue) : ''}
    ${shapes(b, `fill="${c.body}" stroke="${INK}" stroke-width="${b.circles ? 8 : 4}"`)}
    ${b.circles ? shapes(b, `fill="${c.body}"`) : ''}
    <g clip-path="url(#${id})">
      ${pattern(t.pattern, c, b.face)}
      <ellipse cx="100" cy="${b.face + 60}" rx="80" ry="30" fill="#000" opacity=".08"/>
      <rect x="0" y="0" width="200" height="200" fill="url(#${id}h)"/>
      ${sick}${dirt}${sheen}
    </g>
    ${front(st.stage, t, b, c, form, st.mood)}
    <g class="face">${eyes(t.eyes, st.mood, b.face, form)}${mouth(st.mood, b.face, form)}</g>
  </g></g></g>
  ${overlay(st, b, sc, form)}
</svg>`;
}

// The egg's crack line, also the line the shell splits along when it hatches.
const ZIG = [[50, 122], [62, 112], [74, 124], [86, 110], [98, 124], [110, 110], [122, 124], [134, 112], [150, 122]];
const zigPath = ZIG.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join('');
const EGG = 'M100 58C132 58 150 110 150 136C150 164 128 180 100 180C72 180 50 164 50 136C50 110 68 58 100 58Z';

/** An egg. `cracks` 0-3 shows a growing crack. `split` draws the two halves separately. */
export function eggSVG(seed, { cracks = 0, split = false } = {}) {
  const t = traits(seed);
  const c = `hsl(${t.hue} 70% 55%)`;
  const id = `e${++uid}`;
  const body = `<path d="${EGG}" fill="#fff3dc" stroke="${INK}" stroke-width="4"/>` +
    `<circle cx="82" cy="96" r="8" fill="${c}"/><circle cx="122" cy="140" r="11" fill="${c}"/><circle cx="76" cy="152" r="6" fill="${c}"/><circle cx="116" cy="88" r="5" fill="${c}"/>` +
    `<ellipse cx="84" cy="84" rx="10" ry="16" fill="#fff" opacity=".5" transform="rotate(25 84 84)"/>`;
  // how much of the crack is drawn
  const len = [0, 0.3, 0.65, 1][cracks];
  const crack = len ? line(zigPath, 4, `pathLength="1" stroke-dasharray="${len} 1"`) : '';
  const top = `0,0 200,0 200,${ZIG[8][1]} ${[...ZIG].reverse().map((p) => p.join(',')).join(' ')} 0,${ZIG[0][1]}`;
  const bottom = `0,200 200,200 200,${ZIG[8][1]} ${[...ZIG].reverse().map((p) => p.join(',')).join(' ')} 0,${ZIG[0][1]}`;
  const inner = split
    ? `<defs><clipPath id="${id}t"><polygon points="${top}"/></clipPath><clipPath id="${id}b"><polygon points="${bottom}"/></clipPath></defs>
       <g class="shell-bottom"><g clip-path="url(#${id}b)">${body}</g>${line(zigPath)}</g>
       <g class="shell-top"><g clip-path="url(#${id}t)">${body}</g>${line(zigPath)}</g>`
    : `<g class="wobble">${body}${crack}</g>`;
  return `<svg viewBox="0 0 200 200" class="pet egg" role="img" aria-label="An egg">
  <ellipse class="shadow" cx="100" cy="184" rx="44" ry="7" fill="var(--shadow)"/>${inner}</svg>`;
}

function graveSVG(p, t) {
  return `<svg viewBox="0 0 200 200" class="pet grave" role="img" aria-label="${esc(p.name)}'s grave">
  <ellipse cx="100" cy="184" rx="70" ry="9" fill="var(--shadow)"/>
  <path d="M56 182V86C56 58 76 44 100 44C124 44 144 58 144 86V182Z" fill="#d9d0c2" stroke="${INK}" stroke-width="4"/>
  <text x="100" y="94" text-anchor="middle" font-size="18" font-weight="800" fill="${INK}" letter-spacing="3">RIP</text>
  <text x="100" y="124" text-anchor="middle" font-size="${p.name.length > 7 ? 14 : 18}" font-weight="700" fill="${INK}">${esc(p.name)}</text>
  ${p.gen > 1 ? `<text x="100" y="150" text-anchor="middle" font-size="12" font-weight="700" fill="${INK}" opacity=".6">gen ${p.gen}</text>` : ''}
  ${line('M40 182h120')}
  <path d="M152 182v-18" stroke="hsl(110 45% 35%)" stroke-width="4"/>
  <circle cx="152" cy="160" r="7" fill="hsl(${t.hue} 75% 62%)" stroke="${INK}" stroke-width="3"/>
  <g class="ghost" opacity=".55">
    <path d="M150 74c0-16 10-26 22-26s22 10 22 26v26l-7 -6l-7 6l-8 -6l-8 6l-7 -6l-7 6Z" fill="#fffaf0" stroke="${INK}" stroke-width="3"/>
    <path d="M164 68l6 6M170 68l-6 6M178 68l6 6M184 68l-6 6" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>
  </g>
</svg>`;
}

export const ICONS = {
  food: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11h18a9 9 0 0 1-18 0Z" fill="currentColor"/><path d="M8 8c0-2 2-2 2-4M13 8c0-2 2-2 2-4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
  fun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="currentColor"/><path d="M3.5 9.5c5 2 12 2 17 0M5 17c4-3 10-3 14 0" stroke="var(--card)" stroke-width="1.8" fill="none"/></svg>',
  clean: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5c4 5 7 8.5 7 12a7 7 0 0 1-14 0c0-3.5 3-7 7-12Z" fill="currentColor"/></svg>',
  heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21C4 15 2 11 2 8a5 5 0 0 1 10-1 5 5 0 0 1 10 1c0 3-2 7-10 13Z" fill="currentColor"/></svg>',
  sound: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4Z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
  mute: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4Z" fill="currentColor"/><path d="M16 9l6 6M22 9l-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  spark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1Q12 12 23 12Q12 12 12 23Q12 12 1 12Q12 12 12 1Z" fill="currentColor"/></svg>',
};

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export const STAGE_NAMES = STAGES.map((s) => s.id);
