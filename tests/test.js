// Ausführen mit: npm test
import assert from 'assert';
import { isNeutral, colorName, nearestWada, dominantColor } from '../js/color.js';
import { WADA } from '../js/wada.js';
import { targetWarmth, scoreOutfit, applyFeedback, pieces, validLayers } from '../js/rules.js';
import { generateOutfits } from '../js/generator.js';

let failed = 0;
function test(name, fn) {
  try { fn(); console.log('ok  ', name); }
  catch (e) { failed++; console.log('FAIL', name, '\n     ', e.message); }
}

function seeded(seed) { // mulberry32
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const W = (id, category, color) => ({ id, category, color });
const wardrobe = [
  W('t1', 'tshirt', '#f5f5f5'), W('t2', 'tshirt', '#1f2a44'), W('l1', 'longsleeve', '#808080'),
  W('s1', 'shirtpolo', '#9cc3e6'), W('p1', 'pullover', '#6d1a2a'), W('h1', 'hoodie', '#3a3a3a'),
  W('v1', 'knitvest', '#b8865b'), W('j1', 'lightjacket', '#6b6b3a'), W('j2', 'heavyjacket', '#111111'),
  W('c1', 'coat', '#b8865b'), W('b1', 'jeans', '#4a6a8f'), W('b2', 'chino', '#d8c3a0'), W('b3', 'shorts', '#1f2a44'),
  W('f1', 'sneaker', '#f5f5f5'), W('f2', 'boots', '#6b4a2f'), W('a1', 'beanie', '#3a3a3a'), W('a2', 'cap', '#1f2a44'),
  W('a3', 'belt', '#6b4a2f'),
];
const has = (o, cat) => pieces(o).some(i => i.category === cat);
const run = (ctx, opts = {}) => generateOutfits(wardrobe, ctx, { rng: seeded(1), ...opts });

test('neutrale Farben', () => {
  for (const hex of ['#111111', '#f5f5f5', '#1f2a44', '#d8c3a0', '#6b4a2f']) assert.ok(isNeutral(hex, 'tshirt'), hex);
  for (const hex of ['#c62a2a', '#3c8d3f', '#f2d13c']) assert.ok(!isNeutral(hex, 'tshirt'), hex);
  assert.ok(isNeutral('#c62a2a', 'jeans'), 'Denim ist immer neutral');
});

test('Farbnamen', () => {
  assert.strictEqual(colorName('#c52b2b'), 'Rot');
  assert.strictEqual(colorName('#202b45'), 'Navy');
});

test('Wada-Zuordnung', () => {
  assert.strictEqual(nearestWada(WADA[10][1]).name, WADA[10][0]);
  assert.ok(WADA.length === 159);
});

test('Hauptfarbe aus Foto ignoriert Hintergrund', () => {
  const w = 40, h = 40, data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const inside = x > 10 && x < 30 && y > 8 && y < 32, i = (y * w + x) * 4;
    data.set(inside ? [200, 30, 40, 255] : [240, 240, 235, 255], i);
  }
  assert.strictEqual(colorName(dominantColor(data, w, h)), 'Rot');
});

test('Zielwärme sinkt mit steigender Temperatur', () => {
  assert.ok(targetWarmth(-10) > targetWarmth(0) && targetWarmth(0) > targetWarmth(15) && targetWarmth(15) > targetWarmth(30));
  assert.strictEqual(targetWarmth(12.5), (5.5 + 4) / 2);
});

test('fehlende Pflicht-Kategorien werden gemeldet', () => {
  const r = generateOutfits([W('t1', 'tshirt', '#ffffff')]);
  assert.deepStrictEqual(r.missing, ['bottom', 'shoes']);
});

test('30 °C: keine Jacke, kein Pulli', () => {
  const { outfits } = run({ temp: 30 });
  assert.strictEqual(outfits.length, 3);
  for (const { outfit } of outfits) assert.strictEqual(outfit.tops.length, 1, pieces(outfit).map(i => i.category).join());
});

test('0 °C: Schichten, dicke Jacke/Mantel, Mütze, keine Shorts/Cap', () => {
  const { outfits } = run({ temp: 0 });
  for (const { outfit } of outfits) {
    assert.ok(has(outfit, 'heavyjacket') || has(outfit, 'coat'), 'warme Jacke');
    assert.ok(!has(outfit, 'shorts') && !has(outfit, 'cap'));
  }
  assert.ok(outfits.some(r => has(r.outfit, 'beanie')), 'Mütze bei Kälte');
});

test('Vorschläge unterscheiden sich', () => {
  const keys = run({ temp: 12 }).outfits.map(r => pieces(r.outfit).map(i => i.id).join());
  assert.strictEqual(new Set(keys).size, keys.length);
});

const byId = id => wardrobe.find(i => i.id === id);
const tops = (...ids) => ids.map(byId);

test('Schichten: nur von innen nach außen, Pullunder nur über Kragen/Langarm', () => {
  assert.ok(validLayers(tops('l1', 't1')), 'Langarm unter T-Shirt');
  assert.ok(validLayers(tops('t1', 's1', 'p1', 'c1')), 'T-Shirt, Hemd, Pulli, Mantel');
  assert.ok(validLayers(tops('s1', 'v1')), 'Pullunder über Hemd');
  assert.ok(!validLayers(tops('t1', 'l1')), 'T-Shirt nicht unter Langarm');
  assert.ok(!validLayers(tops('t1', 'v1')), 'Pullunder nicht über T-Shirt');
  assert.ok(!validLayers(tops('p1', 'h1')), 'Pulli und Hoodie nicht übereinander');
  assert.ok(!validLayers(tops('s1', 'v1', 'h1')), 'Hoodie nicht über Pullunder');
  assert.ok(!validLayers(tops('j2', 't1')), 'Jacke nicht unter Shirt');
  assert.ok(!validLayers(tops('t1', 'j1', 'j2')), 'dicke Jacke nicht über leichter Jacke');
  assert.ok(!validLayers(tops('p1')), 'mindestens ein Shirt/Hemd');
});

test('bei mildem Wetter wird gelayert', () => {
  const { outfits } = run({ temp: 14 });
  assert.ok(outfits.every(r => r.outfit.tops.length >= 2), outfits.map(r => r.outfit.tops.map(t => t.category).join('+')).join(' | '));
});

test('Hemd über Langarmshirt kostet Punkte', () => {
  const o = t => ({ tops: t, bottom: byId('b2'), shoes: byId('f1'), accessories: [] });
  assert.ok(scoreOutfit(o(tops('l1', 's1'))).total < scoreOutfit(o(tops('t1', 's1'))).total);
});

test('sich beißende Farben schlechter als Navy/Beige', () => {
  const o = (top, bottom) => ({ tops: [W('x', 'tshirt', top)], bottom: W('y', 'chino', bottom), shoes: byId('f1'), accessories: [] });
  assert.ok(scoreOutfit(o('#c62a2a', '#3c8d3f')).total < scoreOutfit(o('#1f2a44', '#d8c3a0')).total);
});

test('Feedback verschiebt die Bewertung', () => {
  const o = run({ temp: 12 }).outfits[0].outfit;
  const before = scoreOutfit(o, { temp: 12 }).total;
  const liked = applyFeedback({}, o, 1), disliked = applyFeedback({}, o, -1);
  assert.ok(scoreOutfit(o, { temp: 12, affinity: liked }).total > before);
  assert.ok(scoreOutfit(o, { temp: 12, affinity: disliked }).total < before);
});

test('gestern getragenes Outfit wird nicht wieder Platz 1', () => {
  const first = run({ temp: 12 }).outfits[0].outfit;
  const wornDaysAgo = Object.fromEntries(pieces(first).map(i => [i.id, 1]));
  const next = run({ temp: 12, wornDaysAgo }).outfits[0].outfit;
  assert.notStrictEqual(pieces(next).map(i => i.id).join(), pieces(first).map(i => i.id).join());
});

console.log(failed ? `\n${failed} Test(s) fehlgeschlagen` : '\nAlle Tests bestanden');
process.exit(failed ? 1 : 0);
