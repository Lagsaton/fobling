// Draws a fobling as inline SVG from its seed, stage, mood and adult form.
// Style: soft vinyl-toy look. Big low-set shiny eyes, blush, outlines in a deep
// shade of the body colour, a glossy highlight, tidy markings.
import { traits, STAGES } from './pet.js?v=mwy9c64y';

const INK = 'var(--pet-ink)';
const SCALE = [0.74, 0.83, 0.91, 1, 0.98];
let uid = 0;

// Each body: outline (path, or circles for the puff), face height, top of head, where the arms go.
const BODIES = [
  { d: 'M100 50C146 50 168 92 168 130C168 164 140 178 100 178C60 178 32 164 32 130C32 92 54 50 100 50Z', face: 122, top: 50, arm: [60, 150] },
  { d: 'M100 34C140 34 158 78 158 120C158 158 134 178 100 178C66 178 42 158 42 120C42 78 60 34 100 34Z', face: 114, top: 34, arm: [54, 146] },
  { circles: [[100, 130, 50], [64, 142, 34], [136, 142, 34], [76, 100, 30], [124, 100, 30], [100, 86, 30]], face: 126, top: 56, arm: null },
  { d: 'M100 60C138 60 160 102 160 136C160 166 134 178 100 178C66 178 40 166 40 136C40 102 62 60 100 60Z', face: 132, top: 60, arm: [58, 156] },
];

const shapes = (b, attrs) =>
  b.circles ? b.circles.map(([cx, cy, r]) => `<circle cx="${cx}" cy="${cy}" r="${r}" ${attrs}/>`).join('') : `<path d="${b.d}" ${attrs}/>`;

const stroke = (d, colour, w = 4, extra = '') =>
  `<path d="${d}" stroke="${colour}" stroke-width="${w}" fill="none" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
const line = (d, w = 4, extra = '') => stroke(d, INK, w, extra);
const star = (x, y, r, fill, cls = '') =>
  `<path class="${cls}" d="M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z" fill="${fill}"/>`;
const heart = (x, y, s, fill) =>
  `<path d="M${x} ${y + s * 0.9}C${x - s * 1.6} ${y - s * 0.1} ${x - s * 0.8} ${y - s * 1.3} ${x} ${y - s * 0.4}C${x + s * 0.8} ${y - s * 1.3} ${x + s * 1.6} ${y - s * 0.1} ${x} ${y + s * 0.9}Z" fill="${fill}"/>`;

function colours(t, form) {
  const h = t.hue;
  if (form === 'grumpy') return { body: `hsl(${h} 18% 58%)`, dark: `hsl(${h} 16% 42%)`, line: `hsl(${h} 20% 22%)`, mark: `hsl(${h} 18% 47%)`, light: `hsl(${h} 18% 76%)` };
  if (form === 'radiant') return { body: `hsl(${h} 85% 76%)`, dark: `hsl(${h} 70% 58%)`, line: `hsl(${h} 55% 28%)`, mark: `hsl(${(h + 30) % 360} 90% 64%)`, light: `hsl(48 100% 92%)` };
  return { body: `hsl(${h} 72% 72%)`, dark: `hsl(${h} 55% 55%)`, line: `hsl(${h} 45% 25%)`, mark: `hsl(${h} 62% 60%)`, light: `hsl(${h} 90% 90%)` };
}

// Tidy markings, kept on the head and belly so they read as a design, not a rash.
function markings(kind, c, b) {
  const top = b.top;
  if (kind === 1) return `<circle cx="100" cy="${top + 16}" r="8" fill="${c.mark}"/><circle cx="80" cy="${top + 24}" r="5.5" fill="${c.mark}"/><circle cx="120" cy="${top + 24}" r="5.5" fill="${c.mark}"/>`;
  if (kind === 2) return [-16, 0, 16].map((dx) => stroke(`M${100 + dx} ${top - 4}v${dx ? 22 : 28}`, c.mark, 7)).join('');
  if (kind === 3) return `<ellipse cx="100" cy="${b.face + 46}" rx="38" ry="26" fill="${c.light}"/>`;
  return '';
}

const EYES = [[11.5, 13], [11, 15.5], [9, 10], [13, 11.5]];

function eyes(t, mood, F, form, k, c) {
  const L = 80, R = 120;
  if (mood === 'asleep') return [L, R].map((x) => line(`M${x - 8} ${F + 1}q8 6 16 0`, 3.6)).join('');
  if (mood === 'dead') return [L, R].map((x) => line(`M${x - 6} ${F - 6}l12 12M${x + 6} ${F - 6}l-12 12`)).join('');
  const [rx, ry] = EYES[t.eyes].map((v) => v * k);
  if (mood === 'dizzy') return [L, R].map((x) => line(`M${x} ${F}m-1 0a2 2 0 1 1 3 1a4.5 4.5 0 1 1 -6.5 -2a7 7 0 1 1 10 3.5`, 2.8)).join('');
  if (mood === 'scared')
    return [L, R].map((x) => `<ellipse cx="${x}" cy="${F}" rx="${rx * 1.05}" ry="${ry * 1.1}" fill="#fff" stroke="${INK}" stroke-width="3"/><circle cx="${x}" cy="${F + 1}" r="${rx * 0.32}" fill="${INK}"/>`).join('') +
      line(`M${L - 9} ${F - ry - 5}l13 -6M${R + 9} ${F - ry - 5}l-13 -6`, 3.4);
  let s = '<g class="eyes">' + [L, R].map((x) =>
    `<ellipse cx="${x}" cy="${F}" rx="${rx}" ry="${ry}" fill="${INK}"/>` +
    `<circle cx="${x + rx * 0.3}" cy="${F - ry * 0.38}" r="${rx * 0.4}" fill="#fff"/>` +
    `<circle cx="${x - rx * 0.36}" cy="${F + ry * 0.42}" r="${rx * 0.18}" fill="#fff" opacity=".9"/>`).join('') + '</g>';
  if (mood === 'meh')
    s += [L, R].map((x) => `<rect x="${x - rx - 2}" y="${F - ry - 3}" width="${2 * rx + 4}" height="${ry * 0.9 + 3}" fill="${c.body}"/>` + line(`M${x - rx - 1} ${F - ry * 0.1}h${2 * rx + 2}`, 3.4)).join('');
  if (form === 'grumpy') s += line(`M${L - 11} ${F - ry - 9}l16 6M${R + 11} ${F - ry - 9}l-16 6`, 4.6);
  else if (mood === 'miserable' || mood === 'starving') s += line(`M${L - 9} ${F - ry - 4}l13 -6M${R + 9} ${F - ry - 4}l-13 -6`, 3.6);
  return s;
}

function mouth(t, mood, F, form) {
  const M = F + 18;
  if (form === 'grumpy' && (mood === 'happy' || mood === 'meh')) return line(`M91 ${M + 3}q4.5 -3 9 0t9 0`, 3.4);
  switch (mood) {
    case 'happy':
      return t.extra & 4
        ? line(`M91 ${M}q4.5 5 9 0q4.5 5 9 0`, 3.4)
        : `<path d="M91 ${M - 1}Q100 ${M + 12} 109 ${M - 1}Z" fill="${INK}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><ellipse cx="100" cy="${M + 4}" rx="4" ry="2.2" fill="#ff8fa3"/>`;
    case 'meh': return line(`M95 ${M + 2}h10`, 3.4);
    case 'dizzy': return line(`M90 ${M + 3}q2.5 -4 5 0t5 0t5 0t5 0`, 3);
    case 'scared': return `<ellipse cx="100" cy="${M + 3}" rx="5" ry="4" fill="${INK}"/>`;
    case 'asleep': return `<ellipse cx="100" cy="${M + 1}" rx="2.6" ry="3" fill="${INK}"/>`;
    case 'dead': return line(`M91 ${M + 2}q4.5 -4 9 0t9 0`, 3.4);
    case 'starving': return `<ellipse cx="100" cy="${M + 3}" rx="4.5" ry="6" fill="${INK}"/>`;
    default: return line(`M92 ${M + 5}Q100 ${M - 2} 108 ${M + 5}`, 3.4);
  }
}

function behind(stage, t, b, c, form, id) {
  let s = '';
  // feet on every stage
  s += [86, 114].map((x) => `<ellipse cx="${x}" cy="178" rx="13" ry="7.5" fill="${c.dark}" stroke="${c.line}" stroke-width="4"/>`).join('');
  // little arms from kid up
  if (stage >= 1 && b.arm) {
    const [dx, y] = b.arm;
    s += `<ellipse cx="${100 - dx}" cy="${y}" rx="9" ry="14" transform="rotate(30 ${100 - dx} ${y})" fill="${c.body}" stroke="${c.line}" stroke-width="4"/>`;
    s += `<ellipse cx="${100 + dx}" cy="${y}" rx="9" ry="14" transform="rotate(-30 ${100 + dx} ${y})" fill="${c.body}" stroke="${c.line}" stroke-width="4"/>`;
  }
  // ears or antennae from teen up
  if (stage >= 2) {
    const top = b.top + 8;
    s += t.extra & 1
      ? stroke(`M88 ${top + 6}Q84 ${top - 14} 78 ${top - 24}M112 ${top + 6}Q116 ${top - 14} 122 ${top - 24}`, c.line, 4) +
        [78, 122].map((x) => `<circle cx="${x}" cy="${top - 26}" r="7.5" fill="hsl(${(t.hue + 150) % 360} 80% 66%)" stroke="${c.line}" stroke-width="4"/>`).join('')
      : `<path d="M62 ${top + 26}Q58 ${top - 10} 66 ${top - 14}Q80 ${top - 4} 90 ${top + 8}ZM138 ${top + 26}Q142 ${top - 10} 134 ${top - 14}Q120 ${top - 4} 110 ${top + 8}Z" fill="${c.dark}" stroke="${c.line}" stroke-width="4" stroke-linejoin="round"/>` +
        `<path d="M66 ${top + 14}Q65 ${top - 2} 69 ${top - 5}Q77 ${top} 82 ${top + 6}ZM134 ${top + 14}Q135 ${top - 2} 131 ${top - 5}Q123 ${top} 118 ${top + 6}Z" fill="hsl(350 80% 80%)"/>`;
  }
  if (form === 'cuddly') s += shapes(b, `fill="${c.body}" stroke="${c.body}" stroke-width="16" stroke-dasharray="1.5 8" stroke-linecap="round"`);
  if (form === 'radiant') s += `<circle cx="100" cy="${b.face + 8}" r="96" fill="url(#${id}g)"/>`;
  return s;
}

function front(stage, t, b, c, form, mood, k) {
  const F = b.face;
  let s = '';
  if (form === 'cuddly') s += heart(62, F + 15, 7, 'hsl(345 90% 70%)') + heart(138, F + 15, 7, 'hsl(345 90% 70%)');
  else if (mood !== 'dead') s += `<ellipse cx="58" cy="${F + 17}" rx="${9 * k}" ry="${5.5 * k}" fill="hsl(350 95% 72% / .6)"/><ellipse cx="142" cy="${F + 17}" rx="${9 * k}" ry="${5.5 * k}" fill="hsl(350 95% 72% / .6)"/>`;
  if (stage >= 4) {
    // elders get round glasses and bushy white brows
    if (mood !== 'asleep') s += `<g fill="none" stroke="${c.line}" stroke-width="3.2"><circle cx="80" cy="${F}" r="17"/><circle cx="120" cy="${F}" r="17"/><path d="M97 ${F - 2}q3 -3 6 0"/></g>`;
    if (form !== 'grumpy') s += stroke(`M70 ${F - 22}q12 -8 24 0M106 ${F - 22}q12 -8 24 0`, '#fff', 6);
  }
  if (form === 'grumpy') s += stroke(`M86 ${b.top + 4}l5 -13l5 11l5 -15l5 13l5 -11l4 13`, c.line, 4);
  return s;
}

function sprout(c) {
  return stroke('M100 62V40', c.line, 4) +
    `<path d="M100 44C90 24 70 24 64 32C74 46 92 48 100 44Z" fill="hsl(125 50% 52%)" stroke="${c.line}" stroke-width="4" stroke-linejoin="round"/>` +
    stroke('M96 42C88 36 80 33 72 33', 'hsl(125 55% 70%)', 2.5);
}

/* ---------- clothes and weather gear ---------- */

const RED = '#e23b3b';

function scarfBand(F) {
  const y = F + 32;
  return `<rect x="0" y="${y}" width="200" height="15" fill="${RED}"/>` +
    [30, 62, 94, 126, 158].map((x) => `<rect x="${x}" y="${y}" width="9" height="15" fill="#fff" opacity=".85"/>`).join('');
}

function hat(kind, T, c, t) {
  if (kind === 'santa')
    return `<path d="M70 ${T + 14}C76 ${T - 22} 112 ${T - 44} 142 ${T - 26}C128 ${T - 14} 124 ${T - 2} 130 ${T + 14}Z" fill="${RED}" stroke="${c.line}" stroke-width="4" stroke-linejoin="round"/>` +
      `<rect x="64" y="${T + 4}" width="72" height="15" rx="7.5" fill="#fff" stroke="${c.line}" stroke-width="4"/>` +
      `<circle cx="143" cy="${T - 27}" r="9" fill="#fff" stroke="${c.line}" stroke-width="4"/>`;
  if (kind === 'party')
    return `<g transform="rotate(-14 100 ${T + 6})"><path d="M80 ${T + 10}L100 ${T - 42}L120 ${T + 10}Z" fill="#7ad7ff" stroke="${c.line}" stroke-width="4" stroke-linejoin="round"/>` +
      `<circle cx="96" cy="${T - 8}" r="3.5" fill="#ff7ad9"/><circle cx="106" cy="${T - 22}" r="3" fill="#ffd34d"/><circle cx="104" cy="${T + 2}" r="3.5" fill="#ffd34d"/><circle cx="92" cy="${T + 4}" r="2.6" fill="#ff7ad9"/>` +
      `<circle cx="100" cy="${T - 44}" r="7" fill="#ff7ad9" stroke="${c.line}" stroke-width="3.5"/></g>`;
  if (kind === 'pumpkin')
    return `<path d="M100 ${T - 18}q2 -10 8 -12" stroke="hsl(110 45% 35%)" stroke-width="5" fill="none" stroke-linecap="round"/>` +
      `<ellipse cx="100" cy="${T - 2}" rx="25" ry="17" fill="#f28c28" stroke="${c.line}" stroke-width="4"/>` +
      `<path d="M90 ${T - 17}q-6 15 0 31M110 ${T - 17}q6 15 0 31" stroke="#c96a14" stroke-width="3" fill="none"/>`;
  if (kind === 'beanie') {
    const col = `hsl(${(t.hue + 180) % 360} 60% 55%)`;
    return `<path d="M64 ${T + 18}Q64 ${T - 30} 100 ${T - 30}Q136 ${T - 30} 136 ${T + 18}Z" fill="${col}" stroke="${c.line}" stroke-width="4" stroke-linejoin="round"/>` +
      `<rect x="60" y="${T + 6}" width="80" height="16" rx="7" fill="${col}" stroke="${c.line}" stroke-width="4"/>` +
      [72, 84, 96, 108, 120].map((x) => `<path d="M${x + 4} ${T + 9}v10" stroke="${c.line}" stroke-width="2" opacity=".35"/>`).join('') +
      `<circle cx="100" cy="${T - 33}" r="9" fill="#fff" stroke="${c.line}" stroke-width="4"/>`;
  }
  return '';
}

function gear(st, b, c, t) {
  const T = b.top;
  const F = b.face;
  let s = '';
  if (st.weather === 'hot' && st.mood !== 'asleep' && st.mood !== 'dizzy')
    s += `<g><rect x="61" y="${F - 10}" width="36" height="20" rx="9" fill="#1d1916"/><rect x="103" y="${F - 10}" width="36" height="20" rx="9" fill="#1d1916"/>` +
      `<path d="M97 ${F - 3}h6M61 ${F - 6}l-12 -4M139 ${F - 6}l12 -4" stroke="#1d1916" stroke-width="3.5" stroke-linecap="round"/>` +
      `<path d="M67 ${F - 4}l8 -4M109 ${F - 4}l8 -4" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/></g>`;
  if (st.weather === 'snow')
    s += `<path d="M126 ${F + 40}l18 4l-6 32l-15 -3Z" fill="${RED}" stroke="${c.line}" stroke-width="3.5" stroke-linejoin="round"/><path d="M128 ${F + 54}l13 3" stroke="#fff" stroke-width="5" opacity=".85"/>`;
  const wear = st.hat || (st.weather === 'snow' ? 'beanie' : '');
  s += hat(wear, T, c, t);
  if (st.weather === 'rain' && st.mood !== 'asleep') {
    const y = T - 16;
    s += `<g class="umbrella">${stroke(`M100 ${y}C104 ${y + 40} 120 ${F + 6} 146 ${F + 28}`, 'hsl(30 40% 35%)', 5)}` +
      `<path d="M34 ${y}Q100 ${y - 66} 166 ${y}Q150 ${y - 9} 133 ${y}Q117 ${y - 9} 100 ${y}Q83 ${y - 9} 67 ${y}Q50 ${y - 9} 34 ${y}Z" fill="hsl(125 50% 50%)" stroke="${c.line}" stroke-width="4" stroke-linejoin="round"/>` +
      stroke(`M100 ${y - 33}V${y}M100 ${y - 22}l-22 10M100 ${y - 22}l22 10M100 ${y - 10}l-34 8M100 ${y - 10}l34 8`, 'hsl(125 55% 72%)', 2.5) + '</g>';
  }
  return s;
}

/** Things that float above the scaled body (so they don't shrink with it). */
function overlay(st, b, sc, form) {
  const headY = 184 - (184 - b.top) * sc;
  let s = '';
  if (form === 'radiant')
    s += `<g class="halo"><ellipse cx="100" cy="${headY - 18}" rx="28" ry="7" fill="none" stroke="#8a6a12" stroke-width="9"/><ellipse cx="100" cy="${headY - 18}" rx="28" ry="7" fill="none" stroke="#ffd34d" stroke-width="5"/></g>`;
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
  const k = 1 + (1 - sc) * 0.9; // little ones get relatively bigger eyes
  const sick = st.sick ? `<g opacity=".45">${shapes(b, 'fill="hsl(95 60% 45%)"')}</g>` : '';
  const dirt = st.needs && st.needs.clean < 40 ? `<g fill="hsl(30 40% 30% / .5)"><circle cx="58" cy="152" r="5.5"/><circle cx="68" cy="162" r="3"/><circle cx="142" cy="156" r="4.5"/></g>` : '';
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
  </defs>
  <ellipse class="shadow" cx="100" cy="183" rx="${50 * sc}" ry="6" fill="var(--shadow)"/>
  <g class="bob"><g class="squish"><g transform="translate(100 184) scale(${sc}) translate(-100 -184)">
    ${behind(st.stage, t, b, c, form, id)}
    ${t.body === 3 ? sprout(c) : ''}
    ${shapes(b, `fill="${c.body}" stroke="${c.line}" stroke-width="${b.circles ? 8 : 4}"`)}
    ${b.circles ? shapes(b, `fill="${c.body}"`) : ''}
    <g clip-path="url(#${id})">
      ${markings(t.pattern, c, b)}
      <ellipse cx="100" cy="184" rx="96" ry="34" fill="${c.dark}" opacity=".22"/>
      <ellipse cx="72" cy="${b.top + 30}" rx="15" ry="8" transform="rotate(-28 72 ${b.top + 30})" fill="#fff" opacity=".55"/>
      <circle cx="58" cy="${b.top + 48}" r="3.2" fill="#fff" opacity=".5"/>
      ${sick}${dirt}${sheen}
      ${st.weather === 'snow' ? scarfBand(b.face) : ''}
    </g>
    ${front(st.stage, t, b, c, form, st.mood, k)}
    <g class="face">${eyes(t, st.mood, b.face, form, k, c)}${mouth(t, st.mood, b.face, form)}</g>
    ${gear(st, b, c, t)}
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
