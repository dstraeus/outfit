// Bewertung eines Outfits: Layering, modische Grundregeln, Farbharmonie, Wärme, Abwechslung, gelernte Vorlieben.
// Ein Outfit ist { tops: [innen … außen], bottom, shoes, accessories: [] } aus Items { id, category, color }.
// ctx: { temp: °C oder null, affinity: { 'idA|idB': Zahl }, wornDaysAgo: { id: Tage } }
import { CATEGORY } from './catalog.js';
import { hexToLab, lch, deltaE, hueDistance, isNeutral, nearestWada } from './color.js';

// Reihenfolge für die Anzeige: von außen nach innen, dann Hose, Schuhe, Accessoires.
export const pieces = o => [...o.tops].reverse().concat([o.bottom, o.shoes], o.accessories || []);
const core = o => [...o.tops, o.bottom, o.shoes];
const is = (item, ...ids) => !!item && ids.includes(item.category);
const anyTop = (o, ...ids) => o.tops.some(t => ids.includes(t.category));
const outermost = o => o.tops[o.tops.length - 1];
const mild = c => c.temp == null || c.temp < 22;

// Zielwärme je gefühlter Temperatur – Stützpunkte, dazwischen linear.
const WARMTH_CURVE = [[-5, 10.5], [0, 9], [5, 7.5], [10, 5.5], [15, 4], [20, 2.8], [25, 1.8], [30, 1.5]];

export function targetWarmth(t) {
  const c = WARMTH_CURVE;
  if (t <= c[0][0]) return c[0][1];
  for (let i = 1; i < c.length; i++) {
    const [t1, w1] = c[i - 1], [t2, w2] = c[i];
    if (t <= t2) return w1 + (w2 - w1) * (t - t1) / (t2 - t1);
  }
  return c[c.length - 1][1];
}

// Layering: Schichten müssen von innen nach außen zunehmen, "over"/"notOver" müssen erfüllt sein.
export function validLayers(tops) {
  for (let i = 0; i < tops.length; i++) {
    const c = CATEGORY[tops[i].category];
    if (i > 0 && CATEGORY[tops[i - 1].category].layer >= c.layer) return false;
    if (c.over && !(i > 0 && c.over.includes(tops[i - 1].category))) return false;
    if (c.notOver && tops.slice(0, i).some(t => c.notOver.includes(t.category))) return false;
  }
  return tops.some(t => CATEGORY[t.category].slot === 'base');
}

// Modische Grundregeln. points < 0 = Abzug, > 0 = Bonus. Neue Regeln einfach anhängen.
export const RULES = [
  { points: 1, text: 'Layering-Look', test: (o, c) => mild(c) && o.tops.length >= 2 },
  { points: 1, text: 'Kragen unter dem Pulli', test: (o, c) => mild(c) && o.tops.some((t, i) => is(t, 'shirtpolo') && is(o.tops[i + 1], 'pullover', 'knitvest')) },
  { points: -2, text: 'Hemd/Polo über Langarmshirt', test: o => o.tops.some((t, i) => is(t, 'longsleeve') && is(o.tops[i + 1], 'shirtpolo')) },
  { points: -3, text: 'Zu viele Schichten unter der Jacke', test: o => o.tops.filter(t => CATEGORY[t.category].slot !== 'outer').length > 3 },
  { points: -4, text: 'Keine warme Jacke bei Kälte', test: (o, c) => c.temp != null && c.temp < 8 && !anyTop(o, 'heavyjacket', 'coat') },
  { points: -3, text: 'Pulli bei über 22 °C', test: (o, c) => !mild(c) && o.tops.some(t => CATEGORY[t.category].slot === 'mid') },
  { points: -3, text: 'Hoodie unter Sakko', test: o => anyTop(o, 'hoodie') && anyTop(o, 'blazer') },
  { points: 1, text: 'Shorts bei Hitze', test: (o, c) => c.temp != null && c.temp >= 25 && is(o.bottom, 'shorts') },
  { points: -6, text: 'Shorts bei unter 18 °C', test: (o, c) => c.temp != null && c.temp < 18 && is(o.bottom, 'shorts') },
  { points: -3, text: 'Boots bei über 22 °C', test: (o, c) => c.temp != null && c.temp > 22 && is(o.shoes, 'boots') },
  { points: -4, text: 'Jacke bei über 24 °C', test: (o, c) => c.temp != null && c.temp > 24 && anyTop(o, 'lightjacket', 'heavyjacket', 'coat') },
  { points: -5, text: 'Shorts mit Mantel, dicker Jacke oder Sakko', test: o => is(o.bottom, 'shorts') && anyTop(o, 'coat', 'heavyjacket', 'blazer') },
  { points: -4, text: 'Shorts mit Boots oder Lederschuhen', test: o => is(o.bottom, 'shorts') && is(o.shoes, 'boots', 'leathershoe') },
  { points: -3, text: 'Gürtel zur Jogginghose', test: o => is(o.bottom, 'joggers') && o.accessories?.some(a => is(a, 'belt')) },
  { points: 1, text: 'Gürtel passt zu den Schuhen', test: o => {
      const belt = o.accessories?.find(a => is(a, 'belt'));
      return !!belt && deltaE(hexToLab(belt.color), hexToLab(o.shoes.color)) < 25;
    } },
];

function formalityScore(o) {
  const f = core(o).map(i => CATEGORY[i.category].formality);
  const spread = Math.max(...f) - Math.min(...f);
  return spread > 2 ? { points: -2 * (spread - 2), text: 'Stilbruch (sportlich + elegant)' } : null;
}

function warmthScore(o, temp) {
  if (temp == null) return null;
  const sum = pieces(o).reduce((s, i) => s + CATEGORY[i.category].warmth, 0);
  const diff = sum - targetWarmth(temp);
  if (Math.abs(diff) < 1) return { points: 1, text: `Passt zu ${Math.round(temp)} °C` };
  return { points: -1.5 * Math.abs(diff), text: diff > 0 ? 'Zu warm' : 'Zu kalt' };
}

export function colorScore(o) {
  const res = [];
  const items = pieces(o).map(i => ({ ...i, lab: hexToLab(i.color), neutral: isNeutral(i.color, i.category) }));
  const accents = items.filter(i => !i.neutral);

  if (accents.length <= 1) res.push({ points: accents.length ? 2 : 1, text: accents.length ? 'Ein Farbakzent, Rest neutral' : 'Ruhige neutrale Farben' });
  else if (accents.length > 3) res.push({ points: -1.5 * (accents.length - 3), text: 'Zu viele Farben' });
  for (let i = 0; i < accents.length; i++) for (let j = i + 1; j < accents.length; j++) {
    const a = lch(accents[i].lab), b = lch(accents[j].lab), d = hueDistance(a.h, b.h);
    if (d <= 35) res.push({ points: 1.5, text: 'Ton-in-Ton / benachbarte Farben' });
    else if (d >= 150) res.push({ points: 1, text: 'Komplementärfarben' });
    else if (a.C > 40 && b.C > 40) res.push({ points: -2, text: 'Farben beißen sich' });
  }

  // Sichtbare Schichten: übereinander getragene Teile sollen sich abheben.
  for (let i = 1; i < o.tops.length; i++)
    if (deltaE(hexToLab(o.tops[i - 1].color), hexToLab(o.tops[i].color)) < 8) res.push({ points: -0.5, text: 'Schichten in fast gleicher Farbe' });

  // Oben vs. unten: etwas Helligkeitskontrast wirkt ruhiger als zwei gleiche Töne.
  const top = outermost(o);
  const tl = hexToLab(top.color), bl = hexToLab(o.bottom.color);
  if (Math.abs(tl[0] - bl[0]) >= 20) res.push({ points: 1, text: 'Guter Hell-Dunkel-Kontrast' });
  else if (deltaE(tl, bl) < 10 && !isNeutral(top.color, top.category)) res.push({ points: -1, text: 'Oben und unten fast gleiche Farbe' });

  // Wada: Farbpaare, die im Buch gemeinsam in einer Kombination stehen.
  const wada = [...new Map(items.map(i => nearestWada(i.color)).filter(Boolean).map(w => [w.index, w])).values()];
  let pairs = 0;
  for (let i = 0; i < wada.length; i++) for (let j = i + 1; j < wada.length; j++)
    if (wada[i].combos.some(c => wada[j].combos.includes(c))) pairs++;
  if (pairs) res.push({ points: Math.min(3, 1.5 * pairs), text: `${pairs} Farbpaar${pairs > 1 ? 'e' : ''} aus Wadas Farbkombinationen` });
  const counts = {};
  for (const w of wada) for (const c of w.combos) counts[c] = (counts[c] || 0) + 1;
  const full = Object.entries(counts).find(([, n]) => n >= 3);
  if (full) res.push({ points: 2, text: `Wada-Kombination Nr. ${full[0]}` });
  return res;
}

export const pairKey = (a, b) => a < b ? `${a}|${b}` : `${b}|${a}`;

function idPairs(o) {
  const ids = pieces(o).map(i => i.id), out = [];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) out.push(pairKey(ids[i], ids[j]));
  return out;
}

// Feedback lernen: 👍 = +1, 👎 = -1 für jedes Teile-Paar des Outfits.
export function applyFeedback(affinity, o, delta) {
  for (const k of idPairs(o)) affinity[k] = (affinity[k] || 0) + delta;
  return affinity;
}

function affinityScore(o, affinity = {}) {
  const pairs = idPairs(o);
  const avg = pairs.reduce((s, k) => s + (affinity[k] || 0), 0) / pairs.length;
  const points = Math.max(-4, Math.min(4, 2 * avg));
  if (Math.abs(points) < 0.5) return null;
  return { points, text: points > 0 ? 'Ähnliche Outfits mochtest du' : 'Ähnliche Outfits mochtest du nicht' };
}

function varietyScore(o, wornDaysAgo = {}) {
  const points = -pieces(o).reduce((s, i) => i.id in wornDaysAgo ? s + 1.5 * Math.max(0, 1 - wornDaysAgo[i.id] / 7) : s, 0);
  return points < -0.5 ? { points, text: 'Teile kürzlich getragen' } : null;
}

export function scoreOutfit(o, ctx = {}) {
  const reasons = [
    ...RULES.filter(r => r.test(o, ctx)).map(({ points, text }) => ({ points, text })),
    formalityScore(o), warmthScore(o, ctx.temp), ...colorScore(o),
    affinityScore(o, ctx.affinity), varietyScore(o, ctx.wornDaysAgo),
  ].filter(Boolean);
  const merged = new Map();
  for (const r of reasons) merged.set(r.text, (merged.get(r.text) || 0) + r.points);
  return {
    total: reasons.reduce((s, r) => s + r.points, 0),
    reasons: [...merged].map(([text, points]) => ({ text, points })).sort((a, b) => b.points - a.points),
  };
}
