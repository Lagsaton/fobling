// Draws a fobling as inline SVG from its seed, stage and mood.
import { traits, STAGES } from './pet.js';

const INK = 'var(--pet-ink)';
const SCALE = [0.6, 0.74, 0.86, 1, 0.97];

// Each body: an outline path (or circles, for the puff) plus where its face sits.
const BODIES = [
  { d: 'M100 44C148 44 166 88 166 124C166 160 136 176 100 176C64 176 34 160 34 124C34 88 52 44 100 44Z', face: 112 },
  { d: 'M102 30C140 30 154 70 152 110C150 150 140 176 100 176C62 176 48 150 50 112C52 72 64 30 102 30Z', face: 100 },
  { circles: [[100, 120, 56], [62, 132, 34], [138, 132, 34], [80, 86, 30], [122, 86, 30]], face: 116 },
  { d: 'M100 56C140 56 160 98 160 130C160 162 132 176 100 176C68 176 40 162 40 130C40 98 60 56 100 56Z', face: 122 },
];

function bodyShapes(b, attrs) {
  if (b.circles) return b.circles.map(([cx, cy, r]) => `<circle cx="${cx}" cy="${cy}" r="${r}" ${attrs}/>`).join('');
  return `<path d="${b.d}" ${attrs}/>`;
}

function pattern(kind, hue, face) {
  const c = `hsl(${hue} 72% 46%)`;
  if (kind === 1)
    return [[70, 70, 9], [132, 76, 7], [148, 130, 10], [56, 140, 8], [118, 158, 7], [90, 160, 5]]
      .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`).join('');
  if (kind === 2)
    return [52, 70, 150, 168].map((y) => `<path d="M20 ${y}Q100 ${y - 14} 180 ${y}" stroke="${c}" stroke-width="9" fill="none"/>`).join('');
  if (kind === 3) return `<ellipse cx="100" cy="${face + 44}" rx="40" ry="30" fill="hsl(${hue} 85% 86%)"/>`;
  return '';
}

function eyes(style, mood, y) {
  const L = 80, R = 120;
  if (mood === 'asleep') return [L, R].map((x) => `<path d="M${x - 8} ${y}q8 7 16 0" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/>`).join('');
  if (mood === 'dead') return [L, R].map((x) => `<path d="M${x - 6} ${y - 6}l12 12M${x + 6} ${y - 6}l-12 12" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`).join('');
  const r = [7, 9, 4.5, 7][style];
  const ry = style === 1 ? 11 : r;
  let s = [L, R].map((x, i) => {
    const rr = style === 3 && i === 1 ? r * 0.7 : r;
    const rry = style === 3 && i === 1 ? ry * 0.7 : ry;
    return `<ellipse cx="${x}" cy="${y}" rx="${rr}" ry="${rry}" fill="${INK}"/>` +
      (style !== 2 ? `<circle cx="${x + rr * 0.35}" cy="${y - rry * 0.4}" r="${Math.max(1.6, rr * 0.32)}" fill="#fff"/>` : '');
  }).join('');
  // heavy lids when meh, worried brows when miserable or starving
  if (mood === 'meh') s += [L, R].map((x) => `<path d="M${x - 11} ${y - 3}h22" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`).join('');
  if (mood === 'miserable' || mood === 'starving')
    s += `<path d="M${L - 10} ${y - 12}l14 -6M${R + 10} ${y - 12}l-14 -6" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`;
  return s;
}

function mouth(mood, y) {
  const m = y + 22;
  const line = (d) => `<path d="${d}" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
  switch (mood) {
    case 'happy': return `<path d="M88 ${m - 2}Q100 ${m + 12} 112 ${m - 2}Z" fill="${INK}"/>`;
    case 'meh': return line(`M92 ${m}h16`);
    case 'asleep': return `<circle cx="100" cy="${m}" r="3.5" fill="${INK}"/>`;
    case 'dead': return line(`M90 ${m + 2}q5 -5 10 0t10 0`);
    case 'starving': return `<ellipse cx="100" cy="${m + 2}" rx="7" ry="9" fill="${INK}"/>`;
    default: return line(`M89 ${m + 5}Q100 ${m - 6} 111 ${m + 5}`);
  }
}

function extras(stage, t, face, front) {
  let s = '';
  if (!front) {
    if (stage >= 1) s += `<ellipse cx="80" cy="176" rx="14" ry="8" fill="hsl(${t.hue} 55% 42%)" stroke="${INK}" stroke-width="4"/>` +
      `<ellipse cx="120" cy="176" rx="14" ry="8" fill="hsl(${t.hue} 55% 42%)" stroke="${INK}" stroke-width="4"/>`;
    if (stage >= 2) {
      const top = face - 62;
      s += t.extra & 1
        ? `<path d="M88 ${top + 10}L78 ${top - 20}M112 ${top + 10}L122 ${top - 20}" stroke="${INK}" stroke-width="4"/>` +
          `<circle cx="78" cy="${top - 22}" r="7" fill="hsl(${(t.hue + 150) % 360} 80% 60%)" stroke="${INK}" stroke-width="4"/>` +
          `<circle cx="122" cy="${top - 22}" r="7" fill="hsl(${(t.hue + 150) % 360} 80% 60%)" stroke="${INK}" stroke-width="4"/>`
        : `<path d="M58 ${top + 30}L62 ${top - 8}L90 ${top + 14}ZM142 ${top + 30}L138 ${top - 8}L110 ${top + 14}Z" fill="hsl(${t.hue} 55% 42%)" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`;
    }
  } else {
    if (stage >= 3 || t.extra & 2) s += `<ellipse cx="66" cy="${face + 14}" rx="9" ry="5" fill="hsl(350 90% 70% / .7)"/><ellipse cx="134" cy="${face + 14}" rx="9" ry="5" fill="hsl(350 90% 70% / .7)"/>`;
    if (stage >= 4) s += `<path d="M68 ${face - 18}q12 -8 24 0M108 ${face - 18}q12 -8 24 0" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round"/>`;
  }
  return s;
}

function sprout(hue) {
  return `<path d="M100 58V36" stroke="${INK}" stroke-width="4"/>` +
    `<path d="M100 40C88 22 70 24 66 30C76 42 92 44 100 40Z" fill="hsl(${(hue + 100) % 360} 60% 50%)" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`;
}

export function petSVG(p, st) {
  const t = traits(p.seed);
  if (st.dead) return graveSVG(p, t);
  if (st.egg) return eggSVG(t, st);
  const body = BODIES[t.body];
  const fill = `hsl(${t.hue} 68% 64%)`;
  const id = `b${p.seed}`;
  const face = body.face;
  const sc = SCALE[st.stage];
  const sick = st.sick ? `<g opacity=".55">${bodyShapes(body, `fill="hsl(95 60% 45%)"`)}</g>` : '';
  const zzz = st.mood === 'asleep' ? `<text class="zzz" x="150" y="54" font-size="26" font-weight="800" fill="${INK}">z</text><text class="zzz z2" x="166" y="36" font-size="18" font-weight="800" fill="${INK}">z</text>` : '';
  const sweat = st.mood === 'miserable' || st.mood === 'starving' ? `<path class="drop" d="M150 80q8 12 0 16q-8 -4 0 -16Z" fill="hsl(200 90% 70%)" stroke="${INK}" stroke-width="3"/>` : '';
  const dirt = st.needs.clean < 40 ? `<g fill="hsl(30 40% 30% / .55)"><circle cx="58" cy="150" r="6"/><circle cx="70" cy="160" r="3.5"/><circle cx="140" cy="154" r="5"/></g>` : '';
  return `<svg viewBox="0 0 200 200" class="pet mood-${st.mood}" role="img" aria-label="${esc(p.name)}, ${st.mood}">
  <defs><clipPath id="${id}">${bodyShapes(body, '')}</clipPath></defs>
  <ellipse class="shadow" cx="100" cy="184" rx="58" ry="8" fill="var(--shadow)"/>
  <g class="bob"><g transform="translate(100 184) scale(${sc}) translate(-100 -184)">
    ${extras(st.stage, t, face, false)}
    ${t.body === 3 ? sprout(t.hue) : ''}
    ${bodyShapes(body, `fill="${fill}" stroke="${INK}" stroke-width="${body.circles ? 8 : 4}"`)}
    ${body.circles ? bodyShapes(body, `fill="${fill}"`) : ''}
    <g clip-path="url(#${id})">${pattern(t.pattern, t.hue, face)}${sick}${dirt}</g>
    ${extras(st.stage, t, face, true)}
    <g class="face">${eyes(t.eyes, st.mood, face)}${mouth(st.mood, face)}</g>
  </g></g>
  ${sweat}${zzz}
</svg>`;
}

function eggSVG(t, st) {
  const c = `hsl(${t.hue} 70% 55%)`;
  const crack = st.hatchIn <= 5 ? `<path d="M68 120l12 -8l8 10l10 -12l10 9l10 -8l12 7" stroke="${INK}" stroke-width="4" fill="none" stroke-linejoin="round"/>` : '';
  return `<svg viewBox="0 0 200 200" class="pet egg" role="img" aria-label="An egg">
  <ellipse class="shadow" cx="100" cy="184" rx="44" ry="7" fill="var(--shadow)"/>
  <g class="wobble">
    <path d="M100 58C132 58 150 110 150 136C150 164 128 180 100 180C72 180 50 164 50 136C50 110 68 58 100 58Z" fill="#fff3dc" stroke="${INK}" stroke-width="4"/>
    <circle cx="82" cy="96" r="8" fill="${c}"/><circle cx="122" cy="140" r="11" fill="${c}"/><circle cx="76" cy="152" r="6" fill="${c}"/><circle cx="116" cy="88" r="5" fill="${c}"/>
    ${crack}
  </g>
</svg>`;
}

function graveSVG(p, t) {
  return `<svg viewBox="0 0 200 200" class="pet grave" role="img" aria-label="${esc(p.name)}'s grave">
  <ellipse cx="100" cy="184" rx="70" ry="9" fill="var(--shadow)"/>
  <path d="M56 182V86C56 58 76 44 100 44C124 44 144 58 144 86V182Z" fill="#d9d0c2" stroke="${INK}" stroke-width="4"/>
  <text x="100" y="94" text-anchor="middle" font-size="18" font-weight="800" fill="${INK}" letter-spacing="3">RIP</text>
  <text x="100" y="124" text-anchor="middle" font-size="${p.name.length > 7 ? 14 : 18}" font-weight="700" fill="${INK}">${esc(p.name)}</text>
  <path d="M40 182h120" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
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
};

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export const STAGE_NAMES = STAGES.map((s) => s.id);
