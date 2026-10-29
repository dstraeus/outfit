// Outfit-Generator: zieht zufällige Kombinationen, bewertet sie mit rules.js
// und gibt die besten, untereinander unterschiedlichen Vorschläge zurück.
import { SLOTS, CATEGORY } from './catalog.js';
import { scoreOutfit, validLayers } from './rules.js';

const pick = (list, rng) => list[Math.floor(rng() * list.length)];

function accessoryAllowed(item, temp) {
  const c = CATEGORY[item.category];
  if (c.minTemp == null && c.maxTemp == null) return true;
  if (temp == null) return false;
  return (c.minTemp == null || temp >= c.minTemp) && (c.maxTemp == null || temp <= c.maxTemp);
}

// Pro Accessoire-Art das am besten passende Teil hinzufügen, sofern es das Outfit nicht verschlechtert.
function addAccessories(outfit, accessories, ctx) {
  const byCat = {};
  for (const a of accessories) if (accessoryAllowed(a, ctx.temp)) (byCat[a.category] = byCat[a.category] || []).push(a);
  let best = { outfit, ...scoreOutfit(outfit, ctx) };
  for (const options of Object.values(byCat)) {
    const top = options
      .map(a => { const o = { ...best.outfit, accessories: [...best.outfit.accessories, a] }; return { outfit: o, ...scoreOutfit(o, ctx) }; })
      .reduce((x, y) => y.total > x.total ? y : x);
    if (top.total >= best.total) best = top;
  }
  return best;
}

const coreIds = o => [...o.tops, o.bottom, o.shoes].map(i => i.id);

// Oberteile: pro Schicht zufällig keins oder eins, von innen nach außen; ungültige Stapel verwerfen.
function sampleTops(layers, rng) {
  const tops = [];
  for (const list of layers) if (rng() < 0.35) tops.push(pick(list, rng));
  return tops;
}

export function generateOutfits(items, ctx = {}, { count = 3, samples = 5000, rng = Math.random } = {}) {
  const bySlot = Object.fromEntries(Object.keys(SLOTS).map(s => [s, []]));
  for (const it of items) bySlot[CATEGORY[it.category].slot].push(it);
  const missing = Object.entries(SLOTS).filter(([s, def]) => def.required && !bySlot[s].length).map(([s]) => s);
  if (missing.length) return { outfits: [], missing };

  const byLayer = {};
  for (const it of items) {
    const layer = CATEGORY[it.category].layer;
    if (layer != null) (byLayer[layer] = byLayer[layer] || []).push(it);
  }
  const layers = Object.keys(byLayer).sort((a, b) => a - b).map(l => byLayer[l]);

  const seen = new Map();
  for (let i = 0; i < samples; i++) {
    const tops = sampleTops(layers, rng);
    if (!validLayers(tops)) continue;
    const o = { tops, bottom: pick(bySlot.bottom, rng), shoes: pick(bySlot.shoes, rng), accessories: [] };
    const k = coreIds(o).join('/');
    if (!seen.has(k)) seen.set(k, { outfit: o, ...scoreOutfit(o, ctx) });
  }

  const ranked = [...seen.values()].sort((a, b) => b.total - a.total).slice(0, 40)
    .map(c => addAccessories(c.outfit, bySlot.accessory, ctx))
    .sort((a, b) => b.total - a.total);

  // Vielfalt: ein weiterer Vorschlag darf höchstens 2 Hauptteile mit einem bereits gewählten teilen.
  const chosen = [];
  for (const r of ranked) {
    if (chosen.length >= count) break;
    const ids = coreIds(r.outfit);
    if (chosen.every(c => coreIds(c.outfit).filter(x => ids.includes(x)).length <= 2)) chosen.push(r);
  }
  for (const r of ranked) if (chosen.length < count && !chosen.includes(r)) chosen.push(r);
  return { outfits: chosen, missing: [] };
}
