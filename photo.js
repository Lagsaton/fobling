// A shareable "photo card" of the pet: a 1080x1350 PNG in the app's sticker style.
// Drawn on a canvas; the creature itself comes from petSVG, rasterised via an <img>.
import { petSVG, STAGE_NAMES } from './render.js?v=mwy9c64y';
import { fmtDuration } from './pet.js?v=mwy9c64y';

const W = 1080;
const H = 1350;
const C = {
  paper: '#f2e8d5',
  card: '#fffaf0',
  ink: '#1d1916',
  muted: '#6e6156',
  shadow: 'rgba(29,25,22,.16)',
  accent: '#e4513b',
};
const FORM_CHIP = {
  radiant: ['#ffe680', C.ink],
  grumpy: ['#9a8f86', C.card],
  cuddly: ['#ffc2d6', C.ink],
  classic: [C.card, C.ink],
};
const HOLO = ['#ffe6fa', '#e0f4ff', '#fff6c2', '#ffe6fa'];
const PET_K = 0.94; // pet size as a share of the window's diameter
const URL_TEXT = 'lagsaton.github.io/fobling';

const BRICOLAGE = '"Bricolage Grotesque"';
const FALLBACK = 'ui-rounded, system-ui, sans-serif';
let family = `${BRICOLAGE}, ${FALLBACK}`;

/** Make sure the web font is ready before measuring text; fall back to system-ui if not. */
async function loadFont() {
  try {
    const faces = await Promise.race([
      document.fonts.load(`800 80px ${BRICOLAGE}`),
      new Promise((_, no) => setTimeout(() => no(new Error('font timeout')), 2500)),
    ]);
    // the variable font covers every weight, but ask for the others in case it's static
    await Promise.all([600, 700].map((w) => document.fonts.load(`${w} 40px ${BRICOLAGE}`).catch(() => {})));
    family = faces.length ? `${BRICOLAGE}, ${FALLBACK}` : FALLBACK;
  } catch {
    family = FALLBACK;
  }
}

const font = (weight, size) => `${weight} ${size}px ${family}`;

function spacing(ctx, em, size) {
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${em * size}px`;
}

function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) return ctx.roundRect(x, y, w, h, r);
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

function holoGradient(ctx, x0, y0, x1, y1, stops = HOLO) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  return g;
}

/** A four-point sparkle, the same shape the app uses for shiny twinkles. */
function sparkle(ctx, x, y, r, fill) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

/** petSVG markup -> a standalone SVG image the browser can rasterise at `size` px. */
async function petImage(pet, st, size) {
  const look = st.dead || st.egg ? st : { ...st, mood: 'happy', sick: false, needs: { ...st.needs, clean: 100 } };
  let svg = petSVG(pet, look)
    .replace(/var\(--pet-ink\)/g, C.ink)
    .replace(/var\(--shadow\)/g, C.shadow);
  // the shiny sheen normally sweeps across; freeze it mid-body instead of off the edge
  svg = svg.replace(/(<rect class="sheen" x=)"-60"/, '$1"70"');
  // a long name on the gravestone would spill off the stone: squeeze it to fit
  svg = svg.replace(/(<text x="100" y="124" text-anchor="middle" font-size="(\d+)" font-weight="700")/, (m, all, fs) => {
    const c = document.createElement('canvas').getContext('2d');
    c.font = `700 ${fs}px ${FALLBACK}`;
    return c.measureText(pet.name).width > 78 ? `${all} textLength="78" lengthAdjust="spacingAndGlyphs"` : all;
  });
  svg = svg.replace(
    /^<svg\b/,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" font-family="${FALLBACK.replace(/"/g, '')}"`,
  );
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.width = size;
    img.height = size;
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function background(ctx) {
  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = C.shadow;
  const step = 40;
  for (let y = step / 2; y < H; y += step)
    for (let x = step / 2; x < W; x += step) {
      circle(ctx, x, y, 2.6);
      ctx.fill();
    }
}

function windowArt(ctx, cx, cy, R, pet, memorial) {
  const D = R * 2;
  const k = D / 260; // the app's window is 260px wide; scale its details to match
  // ink border, card-coloured gap, outer ink ring
  circle(ctx, cx, cy, R + 28);
  ctx.fillStyle = C.ink;
  ctx.fill();
  circle(ctx, cx, cy, R + 21);
  ctx.fillStyle = C.card;
  ctx.fill();
  circle(ctx, cx, cy, R + 7);
  ctx.fillStyle = C.ink;
  ctx.fill();

  ctx.save();
  circle(ctx, cx, cy, R);
  ctx.clip();
  const top = cy - R;
  const sky = ctx.createLinearGradient(0, top, 0, top + D);
  sky.addColorStop(0, memorial ? '#c9cfbf' : '#bfe6f5');
  sky.addColorStop(0.7, memorial ? '#e6e3d4' : '#fbe7c4');
  ctx.fillStyle = sky;
  ctx.fillRect(cx - R, top, D, D);

  if (!memorial) {
    const s = 17 * k;
    const sx = cx + R - 0.18 * D - s;
    const sy = top + 0.16 * D + s;
    circle(ctx, sx, sy, s + 7 * k);
    ctx.fillStyle = 'rgba(255,211,77,.3)';
    ctx.fill();
    circle(ctx, sx, sy, s);
    ctx.fillStyle = '#ffd34d';
    ctx.fill();
  }

  // the hill, with its pale top lip
  const hill = memorial ? '#9aa58a' : '#a8d27e';
  const hy = top + 0.76 * D + 0.35 * D;
  ctx.beginPath();
  ctx.ellipse(cx, hy, 0.7 * D, 0.35 * D, 0, 0, Math.PI * 2);
  ctx.fillStyle = hill;
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.35)';
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx, hy + 6 * k, 0.7 * D, 0.35 * D, 0, 0, Math.PI * 2);
  ctx.fillStyle = hill;
  ctx.fill();

  // the window's inset shade along the bottom
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.arc(cx, cy - 10 * k, R, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,.06)';
  ctx.fill('evenodd');

  // bigger than in the app, standing a little lower so it plants its feet on the hill
  const size = pet.width;
  ctx.drawImage(pet, cx - size / 2, cy + 0.7 * R - (184 / 200) * size, size, size);
  ctx.restore();
}

/** Largest font size (<= max) at which `text` fits in `maxW`. */
function fit(ctx, text, weight, max, maxW, em = 0) {
  let size = max;
  for (; size > 24; size -= 2) {
    ctx.font = font(weight, size);
    spacing(ctx, em, size);
    if (ctx.measureText(text).width <= maxW) break;
  }
  return size;
}

/** A row of pill chips centred on cx; shrinks the whole row if it would be wider than maxW. */
function drawChips(ctx, chips, cx, y, maxW) {
  const measure = (k) => {
    ctx.font = font(700, 26 * k);
    spacing(ctx, 0.08, 26 * k);
    // letter-spacing also trails the last letter, so take it back off for centring
    return chips.map((c) => ctx.measureText(c.text.toUpperCase()).width - 0.08 * 26 * k + 48 * k);
  };
  const total = (ws, k) => ws.reduce((a, b) => a + b, 0) + 14 * k * (ws.length - 1);
  let k = 1;
  let widths = measure(1);
  if (total(widths, 1) > maxW) widths = measure((k = Math.max(0.6, maxW / total(widths, 1)) * 0.98));
  const h = 58 * k;
  let x = cx - total(widths, k) / 2;
  chips.forEach((chip, i) => {
    const w = widths[i];
    rrect(ctx, x, y + (58 - h) / 2, w, h, h / 2);
    ctx.fillStyle = chip.holo ? holoGradient(ctx, x, y, x + w, y + h) : chip.bg || C.card;
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = C.ink;
    ctx.stroke();
    ctx.font = font(700, 26 * k);
    spacing(ctx, 0.08, 26 * k);
    ctx.fillStyle = chip.fg || C.ink;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(chip.text.toUpperCase(), x + 24 * k, y + 29 + 2 * k);
    x += w + 14 * k;
  });
  ctx.textBaseline = 'alphabetic';
}

function drawStats(ctx, stats, x0, x1, y) {
  ctx.save();
  ctx.setLineDash([14, 12]);
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(29,25,22,.22)';
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x1, y);
  ctx.stroke();
  const colW = (x1 - x0) / stats.length;
  for (let i = 1; i < stats.length; i++) {
    const x = x0 + colW * i;
    ctx.beginPath();
    ctx.moveTo(x, y + 34);
    ctx.lineTo(x, y + 116);
    ctx.stroke();
  }
  ctx.restore();
  ctx.textAlign = 'center';
  stats.forEach(([value, label], i) => {
    const cx = x0 + colW * (i + 0.5);
    fit(ctx, value, 800, 58, colW - 44, -0.02);
    ctx.fillStyle = C.ink;
    ctx.fillText(value, cx, y + 86);
    ctx.font = font(600, 26);
    spacing(ctx, 0.02, 26);
    ctx.fillStyle = C.muted;
    ctx.fillText(label, cx, y + 124);
  });
}

const dateText = (min) =>
  new Date(min * 60000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** Just builds the image, for previews/tests. */
export async function makeCard(pet, st) {
  await loadFont();
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const dead = !!st.dead;

  // card geometry
  const cardX = 58;
  const cardY = 52;
  const cardW = 950;
  const cardH = 1170;
  const cx = cardX + cardW / 2;
  const padX = 48;

  const R = 280;
  const winCY = 150 + R + 28;
  // the grave (with its ghost) is wider than a creature, so it gets a little less
  const petImg = await petImage(pet, st, Math.round((dead ? 0.86 : PET_K) * R * 2));

  background(ctx);

  // the card: hard shadow, fill, ink border
  rrect(ctx, cardX + 16, cardY + 16, cardW, cardH, 52);
  ctx.fillStyle = C.ink;
  ctx.fill();
  rrect(ctx, cardX, cardY, cardW, cardH, 52);
  ctx.fillStyle = C.card;
  ctx.fill();
  if (pet.shiny) {
    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = holoGradient(ctx, cardX, cardY, cardX + cardW, cardY + cardH);
    ctx.fill();
    ctx.restore();
  }
  ctx.lineWidth = 7;
  ctx.strokeStyle = C.ink;
  ctx.stroke();

  // top strip
  ctx.font = font(700, 28);
  spacing(ctx, 0.12, 28);
  ctx.fillStyle = C.muted;
  ctx.textBaseline = 'alphabetic';
  const stripY = cardY + 70;
  if (dead) {
    ctx.textAlign = 'center';
    ctx.fillText('IN LOVING MEMORY', cx, stripY);
    const w = ctx.measureText('IN LOVING MEMORY').width;
    sparkle(ctx, cx - w / 2 - 34, stripY - 10, 12, C.muted);
    sparkle(ctx, cx + w / 2 + 30, stripY - 10, 12, C.muted);
  } else {
    ctx.textAlign = 'left';
    ctx.fillText(`NO. ${(pet.seed & 0xffff).toString(16).toUpperCase().padStart(4, '0')}`, cardX + padX, stripY);
    ctx.textAlign = 'right';
    ctx.fillText(`HATCHED ${dateText(pet.born).toUpperCase()}`, cardX + cardW - padX, stripY);
  }

  windowArt(ctx, cx, winCY, R, petImg, dead);

  if (pet.shiny && !dead) {
    // a few sparkles scattered around the window
    for (const [dx, dy, r] of [[-318, -230, 26], [-352, -150, 14], [330, 210, 22], [356, 120, 12], [300, -268, 12]])
      sparkle(ctx, cx + dx, winCY + dy, r, dx < 0 ? '#e0a22a' : '#d94f8c');
  }

  // the name
  const nameY = winCY + R + 28 + 136;
  const size = fit(ctx, pet.name, 800, 150, cardW - 2 * padX - 30, -0.035);
  ctx.textAlign = 'center';
  if (pet.shiny && !dead) {
    const w = ctx.measureText(pet.name).width;
    ctx.fillStyle = holoGradient(ctx, cx - w / 2, 0, cx + w / 2, 0, ['#d94f8c', '#7a5cd6', '#2f8fd1', '#e0a22a']);
  } else ctx.fillStyle = C.ink;
  ctx.fillText(pet.name, cx, nameY - (150 - size) * 0.25);

  // chips
  const chips = [];
  if (dead) chips.push({ text: 'deceased', bg: C.ink, fg: C.paper });
  chips.push({ text: st.egg ? 'egg' : STAGE_NAMES[st.stage] || '' });
  if (st.form) chips.push({ text: st.form, bg: FORM_CHIP[st.form]?.[0], fg: FORM_CHIP[st.form]?.[1] });
  if (pet.gen > 1) chips.push({ text: `gen ${pet.gen}` });
  if (pet.shiny && !st.egg) chips.push({ text: '✦ shiny', holo: true });
  drawChips(ctx, chips, cx, nameY + 54, cardW - 2 * padX);

  // stats
  const stats = [
    [fmtDuration(dead ? st.livedMin ?? st.ageMin : st.ageMin), dead ? 'lived' : 'old'],
    [String(st.xp ?? pet.xp ?? 0), 'xp'],
    [String(pet.hands ?? 1), pet.hands === 1 ? 'phone' : 'phones'],
  ];
  if (pet.wins !== undefined && pet.losses !== undefined) stats.push([`${pet.wins}–${pet.losses}`, 'W–L']);
  drawStats(ctx, stats, cardX + padX, cardX + cardW - padX, nameY + 148);

  // footer on the paper
  const footY = cardY + cardH + 16 + 78;
  ctx.textAlign = 'left';
  ctx.font = font(800, 60);
  spacing(ctx, -0.02, 60);
  ctx.fillStyle = C.ink;
  const fobW = ctx.measureText('fob').width;
  ctx.fillText('fob', cardX + 6, footY);
  ctx.fillStyle = C.accent;
  ctx.fillText('ling', cardX + 6 + fobW, footY);
  ctx.textAlign = 'right';
  ctx.font = font(700, 30);
  spacing(ctx, 0, 30);
  ctx.fillStyle = C.muted;
  ctx.fillText(URL_TEXT, cardX + cardW + 16, footY - 6);

  return new Promise((ok, no) => canvas.toBlob((b) => (b ? ok(b) : no(new Error('toBlob failed'))), 'image/png'));
}

const fileName = (name) => `${String(name || 'fob').trim().replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '') || 'fob'}-fobling.png`;

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/**
 * Draws a 1080x1350 PNG portrait card of the pet and shares it (Web Share API with files)
 * or, if sharing files isn't supported, downloads it.
 * Resolves 'shared' | 'downloaded' | 'cancelled'.
 */
export async function shareCard(pet, st) {
  const blob = await makeCard(pet, st);
  const name = fileName(pet.name);
  const file = new File([blob], name, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: `${pet.name} on Fobling` });
      return 'shared';
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelled';
      // e.g. NotAllowedError if the tap's user activation ran out while drawing: save it instead
    }
  }
  download(blob, name);
  return 'downloaded';
}
