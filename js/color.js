// Farb-Hilfen: Umrechnung, Benennung, neutrale Farben, Wada-Zuordnung, Farbe aus Foto.
import { WADA } from './wada.js';
import { CATEGORY } from './catalog.js';

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
}

// sRGB -> CIE Lab (D65)
export function rgbToLab([r, g, b]) {
  const lin = v => (v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const y = (R * 0.2126 + G * 0.7152 + B * 0.0722);
  const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = t => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

export const hexToLab = hex => rgbToLab(hexToRgb(hex));

export function lch([L, a, b]) {
  const h = (Math.atan2(b, a) * 180 / Math.PI + 360) % 360;
  return { L, C: Math.hypot(a, b), h };
}

export const deltaE = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);

export function hueDistance(h1, h2) {
  const d = Math.abs(h1 - h2) % 360;
  return d > 180 ? 360 - d : d;
}

// Neutral = kombinierbar mit fast allem: Schwarz/Weiß/Grau, Navy, Erdtöne (Beige, Camel, Braun, Oliv), Denim.
export function isNeutral(hex, categoryId) {
  if (CATEGORY[categoryId]?.neutral) return true;
  const { L, C, h } = lch(hexToLab(hex));
  if (C < 12) return true;
  if (L < 35 && C < 40 && h >= 240 && h <= 310) return true; // Navy
  if (C < 35 && h >= 40 && h <= 125) return true;            // Erdtöne
  return false;
}

const NAMES = [
  ['Schwarz', '#111111'], ['Anthrazit', '#3a3a3a'], ['Grau', '#808080'], ['Hellgrau', '#c8c8c8'],
  ['Weiß', '#f5f5f5'], ['Creme', '#f2ead3'], ['Beige', '#d8c3a0'], ['Camel', '#b8865b'],
  ['Braun', '#6b4a2f'], ['Dunkelbraun', '#3f2a1c'], ['Navy', '#1f2a44'], ['Blau', '#2f5fb3'],
  ['Hellblau', '#9cc3e6'], ['Jeansblau', '#4a6a8f'], ['Türkis', '#2aa7a1'], ['Dunkelgrün', '#1f4d36'],
  ['Grün', '#3c8d3f'], ['Olivgrün', '#6b6b3a'], ['Mint', '#b5e3c8'], ['Gelb', '#f2d13c'], ['Hellgelb', '#ece28f'],
  ['Senf', '#c9a227'], ['Orange', '#e07b28'], ['Rot', '#c62a2a'], ['Bordeaux', '#6d1a2a'],
  ['Rosa', '#f2b6c6'], ['Lila', '#6a4c9c'], ['Flieder', '#c3b1e1'],
].map(([name, hex]) => ({ name, lab: hexToLab(hex) }));

export function colorName(hex) {
  const lab = hexToLab(hex);
  return NAMES.reduce((best, n) => deltaE(n.lab, lab) < deltaE(best.lab, lab) ? n : best).name;
}

const WADA_LAB = WADA.map(([name, hex, combos], index) => ({ index, name, hex, combos, lab: hexToLab(hex) }));

const wadaCache = new Map();

// Nächstliegende Wada-Farbe; null, wenn keine nah genug ist.
export function nearestWada(hex, maxDist = 20) {
  const key = hex + maxDist;
  if (!wadaCache.has(key)) wadaCache.set(key, findWada(hex, maxDist));
  return wadaCache.get(key);
}

function findWada(hex, maxDist) {
  const lab = hexToLab(hex);
  let best = null, bestD = Infinity;
  for (const w of WADA_LAB) {
    const d = deltaE(w.lab, lab);
    if (d < bestD) { best = w; bestD = d; }
  }
  return bestD <= maxDist ? best : null;
}

// Unterschiede in der Helligkeit (Falten, Schatten) zählen nur halb. In dunklen Tönen schluckt
// der Schatten auch die Sättigung (dunkles Navy wirkt fast schwarz), dort zählt auch die Farbe weniger.
function shadeDistance(p, q) {
  const f = Math.min(1, (Math.min(p[0], q[0]) + 10) / 50);
  return Math.hypot((p[0] - q[0]) * 0.5, (p[1] - q[1]) * f, (p[2] - q[2]) * f);
}

// Farben eines Fotos: k-means in Lab, ähnliche Cluster zusammengefasst, bis zu 3 Farben mit Anteil.
// Mit transparentem Hintergrund (freigestellt) zählen nur die Pixel des Kleidungsstücks;
// sonst die Bildmitte, und Cluster ähnlich dem Bildrand (Hintergrund) werden übersprungen.
export function dominantColors(data, w, h, k = 6) {
  const px = i => [data[i], data[i + 1], data[i + 2]];
  const mean = list => [0, 1, 2].map(c => list.reduce((s, p) => s + p[c], 0) / list.length);
  let cutout = false;
  for (let i = 3; i < data.length; i += 4) if (data[i] < 250) { cutout = true; break; }

  const fg = [], border = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (cutout) { if (data[i + 3] > 200) fg.push(px(i)); continue; }
    if (x < w * 0.1 || x >= w * 0.9 || y < h * 0.1 || y >= h * 0.9) border.push(px(i));
    else if (x >= w * 0.15 && x < w * 0.85 && y >= h * 0.15 && y < h * 0.85) fg.push(px(i));
  }
  const bgLab = cutout ? null : rgbToLab(mean(border));

  const pts = fg.map(rgb => ({ rgb, lab: rgbToLab(rgb) })).sort((a, b) => a.lab[0] - b.lab[0]);
  let cents = Array.from({ length: k }, (_, i) => pts[Math.floor((i + 0.5) * pts.length / k)].lab);
  let groups;
  for (let iter = 0; iter < 10; iter++) {
    groups = cents.map(() => []);
    for (const p of pts) {
      let bi = 0;
      for (let i = 1; i < k; i++) if (deltaE(p.lab, cents[i]) < deltaE(p.lab, cents[bi])) bi = i;
      groups[bi].push(p);
    }
    cents = groups.map((g, i) => g.length ? mean(g.map(p => p.lab)) : cents[i]);
  }
  let clusters = groups.filter(g => g.length)
    .map(g => ({ size: g.length, rgb: mean(g.map(p => p.rgb)), lab: mean(g.map(p => p.lab)) }))
    .sort((a, b) => b.size - a.size);
  if (bgLab) {
    const garment = clusters.filter(c => deltaE(c.lab, bgLab) > 15);
    if (garment.length) clusters = garment;
  }

  const merged = [];
  for (const c of clusters) {
    const m = merged.find(x => shadeDistance(x.lab, c.lab) < 14);
    if (!m) { merged.push({ ...c }); continue; }
    const t = m.size + c.size;
    m.rgb = m.rgb.map((v, i) => (v * m.size + c.rgb[i] * c.size) / t);
    m.lab = m.lab.map((v, i) => (v * m.size + c.lab[i] * c.size) / t);
    m.size = t;
  }
  const total = merged.reduce((s, c) => s + c.size, 0);
  return merged.sort((a, b) => b.size - a.size)
    .filter((c, i) => i === 0 || c.size / total >= 0.08).slice(0, 3)
    .map(c => ({ hex: rgbToHex(c.rgb), share: Math.round(c.size / total * 100) / 100 }));
}
