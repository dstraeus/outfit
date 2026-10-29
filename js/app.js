// Oberfläche: Startbildschirm mit einem Outfit (Flat-Lay), Menü, Schrank, Foto-Editor.
import { SLOTS, CATEGORIES, CATEGORY, CATEGORY_ALIASES } from './catalog.js';
import { dominantColors, colorName } from './color.js';
import { generateOutfits } from './generator.js';
import { pieces, applyFeedback } from './rules.js';
import { getItems, putItem, deleteItem, getValue, setValue } from './db.js';
import { getWeather } from './weather.js';
import { classify } from './classify.js';
import { removeBackground } from './segment.js';

const $ = s => document.querySelector(s);
const el = (tag, props = {}, ...children) => {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...children);
  return e;
};
const dayNumber = d => Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);
const VERSION = 2; // Teile mit kleinerer Version werden (neu) freigestellt

let items = [];
const urls = new Map();
// Freigestelltes Bild, falls vorhanden, sonst das Foto.
const imageUrl = item => {
  const key = item.id + (item.cutout ? ':cut' : ':photo');
  if (!urls.has(key)) urls.set(key, URL.createObjectURL(item.cutout || item.photo));
  return urls.get(key);
};
const forgetUrl = id => {
  for (const key of [id + ':cut', id + ':photo']) { URL.revokeObjectURL(urls.get(key)); urls.delete(key); }
};
const itemName = i => `${colorName(i.color)} · ${CATEGORY[i.category].label}`;
const groups = [...new Set(Object.values(SLOTS).map(s => s.label))];
const groupOf = i => SLOTS[CATEGORY[i.category].slot].label;

async function loadItems() {
  items = await getItems();
  for (const it of items) {
    if (!CATEGORY_ALIASES[it.category]) continue;
    it.category = CATEGORY_ALIASES[it.category];
    await putItem(it);
  }
}

// --- Navigation: Start (Outfit) ↔ Schrank, alles andere übers Menü ---
function show(view) {
  $('#view-outfit').hidden = view !== 'outfit';
  $('#view-wardrobe').hidden = view !== 'wardrobe';
  $('#back').hidden = view === 'outfit';
  $('#title').textContent = view === 'outfit' ? 'Heute' : 'Schrank';
  if (view === 'outfit') refreshOutfit();
}
$('#back').onclick = () => show('outfit');

const menu = $('#menu');
$('#menu-btn').onclick = () => { menu.returnValue = ''; menu.showModal(); };
menu.onclose = () => { if (menu.returnValue === 'wardrobe') show('wardrobe'); };
$('#temp').onchange = refreshOutfit;

// --- Schrank ---
function renderWardrobe() {
  const root = $('#wardrobe');
  root.replaceChildren();
  if (!items.length) root.append(el('p', { className: 'muted',
    textContent: 'Noch leer. Fotografiere dein erstes Kleidungsstück – einzeln und hingelegt, nicht angezogen.' }));
  for (const g of groups) {
    const list = items.filter(i => groupOf(i) === g);
    if (!list.length) continue;
    root.append(
      el('h2', { textContent: `${g} (${list.length})` }),
      el('div', { className: 'grid' }, ...list.map(i => el('button', { className: 'tile', onclick: () => openEditor(i) },
        el('img', { src: imageUrl(i), alt: '' }),
        el('span', {}, ...(i.colors?.length ? i.colors : [{ hex: i.color }]).map(c => el('i', { className: 'dot', style: `background:${c.hex}` })),
          CATEGORY[i.category].label)))));
  }
}

// --- Bilder: verkleinern, freistellen, Farben bestimmen ---
function loadImage(blob) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(img.src); resolve(img); };
    img.onerror = reject;
    img.src = URL.createObjectURL(blob);
  });
}

const toBlob = (canvas, type, quality) => new Promise(r => canvas.toBlob(r, type, quality));

async function resizePhoto(file) {
  const img = await loadImage(file);
  const scale = Math.min(1, 512 / Math.max(img.width, img.height));
  const c = el('canvas', { width: Math.round(img.width * scale), height: Math.round(img.height * scale) });
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return { blob: await toBlob(c, 'image/jpeg', 0.85), canvas: c };
}

function colorsFromCanvas(src) {
  const scale = 64 / Math.max(src.width, src.height);
  const w = Math.max(1, Math.round(src.width * scale)), h = Math.max(1, Math.round(src.height * scale));
  const ctx = el('canvas', { width: w, height: h }).getContext('2d', { willReadFrequently: true });
  ctx.drawImage(src, 0, 0, w, h);
  return dominantColors(ctx.getImageData(0, 0, w, h).data, w, h);
}

// Freigestelltes Teil auf Weiß – damit die Erkennung nicht vom Hintergrund abgelenkt wird.
async function flatUrl(canvas) {
  const c = el('canvas', { width: canvas.width, height: canvas.height });
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(canvas, 0, 0);
  return URL.createObjectURL(await toBlob(c, 'image/jpeg', 0.9));
}

const progress = (name, say) => p => {
  if (p.status === 'progress' && p.total > 1e7) say(`Lade ${name} (einmalig) … ${Math.round(p.progress)} %`);
};

async function analyze(photo, say = () => {}) {
  const source = el('canvas');
  const img = await loadImage(photo);
  Object.assign(source, { width: img.width, height: img.height });
  source.getContext('2d').drawImage(img, 0, 0);
  let cut = null;
  const url = URL.createObjectURL(photo);
  try {
    say('Stelle Kleidungsstück frei …');
    cut = await removeBackground(url, progress('Freisteller', say));
  } catch (e) { console.error(e); }
  URL.revokeObjectURL(url);
  const canvas = cut || source;
  return { cutout: cut && await toBlob(cut, 'image/png'), colors: colorsFromCanvas(canvas), canvas };
}

// Ältere oder unfertig gespeicherte Teile im Hintergrund nachbearbeiten.
async function processPending() {
  const pending = items.filter(i => (i.v || 0) < VERSION);
  for (let n = 0; n < pending.length; n++) {
    $('#status').hidden = false;
    $('#status').textContent = `Kleidung wird freigestellt … ${n + 1} / ${pending.length}`;
    const it = pending[n];
    const { cutout, colors } = await analyze(it.photo, t => { if (t.startsWith('Lade')) $('#status').textContent = t; });
    await putItem({ ...it, cutout, colors, color: colors[0].hex, v: VERSION });
    forgetUrl(it.id);
  }
  $('#status').hidden = true;
  if (!pending.length) return;
  await loadItems();
  renderWardrobe();
  if (!$('#view-outfit').hidden) refreshOutfit();
}

// --- Editor ---
const editor = $('#editor');
let editing = null, editColors = [], token = 0;

$('#ed-category').append(...groups.map(g => el('optgroup', { label: g },
  ...CATEGORIES.filter(c => SLOTS[c.slot].label === g).map(c => el('option', { value: c.id, textContent: c.label })))));

function renderColors() {
  $('#ed-colors').replaceChildren(...editColors.map((c, i) => el('span', { className: 'color-row' },
    el('input', { type: 'color', value: c.hex, oninput: e => { c.hex = e.target.value; renderColors(); } }),
    el('span', { textContent: colorName(c.hex) + (editColors.length > 1 ? ` · ${Math.round(c.share * 100)} %` : '') }),
    i > 0 ? el('button', { type: 'button', className: 'remove', textContent: '×', onclick: () => { editColors.splice(i, 1); renderColors(); } }) : '')),
    editColors.length < 3 ? el('button', { type: 'button', className: 'add-color', textContent: '+ Farbe',
      onclick: () => { editColors.push({ hex: '#808080', share: 0.15 }); renderColors(); } }) : '');
}

function openEditor(item, isNew = false) {
  editing = { item, isNew };
  editor.returnValue = '';
  $('#ed-photo').src = imageUrl(item);
  $('#ed-category').value = item.category;
  editColors = (item.colors?.length ? item.colors : [{ hex: item.color, share: 1 }]).map(c => ({ ...c }));
  renderColors();
  $('#ed-status').textContent = '';
  $('#ed-suggest').replaceChildren();
  $('#ed-delete').hidden = isNew;
  editor.showModal();
}

editor.onclose = async () => {
  const { item, isNew } = editing;
  token++;
  if (editor.returnValue === 'save') {
    await putItem({ ...item, category: $('#ed-category').value, colors: editColors, color: editColors[0].hex });
    forgetUrl(item.id);
  } else if (editor.returnValue === 'delete' && confirm('Kleidungsstück löschen?')) {
    await deleteItem(item.id);
    forgetUrl(item.id);
  } else if (isNew) {
    forgetUrl(item.id);
  }
  await loadItems();
  renderWardrobe();
  if (!$('#view-outfit').hidden) refreshOutfit();
};

$('#photo').onchange = async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (menu.open) menu.close();
  if (!file) return;
  const { blob, canvas } = await resizePhoto(file);
  const colors = colorsFromCanvas(canvas);
  const item = { id: crypto.randomUUID(), category: CATEGORIES[0].id, color: colors[0].hex, colors, photo: blob, createdAt: Date.now() };
  openEditor(item, true);

  const mine = ++token;
  const say = t => { if (mine === token) $('#ed-status').textContent = t; };
  try {
    const result = await analyze(blob, say);
    if (mine !== token) return;
    Object.assign(item, { cutout: result.cutout, colors: result.colors, color: result.colors[0].hex, v: VERSION });
    forgetUrl(item.id);
    $('#ed-photo').src = imageUrl(item);
    editColors = result.colors.map(c => ({ ...c }));
    renderColors();

    say('Erkenne Kleidungsstück …');
    const url = await flatUrl(result.canvas);
    const results = await classify(url, progress('Erkennung', say));
    URL.revokeObjectURL(url);
    if (mine !== token) return;
    $('#ed-category').value = results[0].category;
    say('Erkannt – bitte kurz prüfen:');
    $('#ed-suggest').replaceChildren(...results.slice(0, 3).map(r => el('button', {
      type: 'button',
      textContent: `${CATEGORY[r.category].label} · ${Math.round(r.score * 100)} %`,
      onclick: () => { $('#ed-category').value = r.category; },
    })));
  } catch (err) {
    console.error(err);
    say('Erkennung nicht verfügbar – bitte Art auswählen.');
  }
};

// --- Outfit des Tages ---
let suggestions = [], current = 0;

async function context() {
  const t = parseFloat($('#temp').value);
  const today = dayNumber(new Date()), wornDaysAgo = {};
  for (const w of await getValue('worn', []))
    for (const id of w.ids) wornDaysAgo[id] = Math.min(wornDaysAgo[id] ?? Infinity, today - w.day);
  return { temp: isNaN(t) ? null : t, affinity: await getValue('affinity', {}), wornDaysAgo };
}

// Erster Start / unvollständiger Schrank: erklären, was fehlt.
function renderOnboarding(missing) {
  const first = !items.length;
  return el('div', { className: 'card onboarding' },
    el('h2', { textContent: first ? 'Willkommen!' : 'Fast geschafft' }),
    el('p', { textContent: first
      ? 'Damit ich dir Outfits zusammenstellen kann, brauche ich zuerst deine Kleidung. Fotografiere jedes Teil einzeln und hingelegt – den Hintergrund entferne ich automatisch.'
      : 'Für ein komplettes Outfit fehlt noch etwas:' }),
    el('ul', { className: 'checklist' }, ...['base', 'bottom', 'shoes'].map(s =>
      el('li', { className: missing.includes(s) ? '' : 'done', textContent: SLOTS[s].label }))),
    el('label', { htmlFor: 'photo', className: 'primary button', textContent: first ? 'Erstes Kleidungsstück fotografieren' : 'Kleidungsstück hinzufügen' }));
}

// Flat-Lay: äußerstes Oberteil vorn links, innere Schichten versetzt dahinter,
// darunter die Hose, rechts Schuhe und Accessoires. Angaben in % der Fläche.
function renderBoard(outfit) {
  const board = el('div', { className: 'board' });
  const place = (item, [x, y, w, h], z) => board.append(el('img', {
    src: imageUrl(item), alt: itemName(item), className: item.cutout ? 'garment' : 'garment photo',
    style: `left:${x}%;top:${y}%;width:${w}%;height:${h}%;z-index:${z}`,
  }));
  const tops = [...outfit.tops].reverse(), n = tops.length;
  const w = n === 1 ? 60 : 52, step = n > 1 ? Math.min(18, (96 - w) / (n - 1)) : 0;
  tops.forEach((t, i) => place(t, [n === 1 ? 20 : 2 + i * step, 2 + i * 2, w, 46], 20 - i));
  place(outfit.bottom, [6, 48, 44, 50], 5);
  place(outfit.shoes, [54, 76, 42, 21], 6);
  outfit.accessories.forEach((a, i) => place(a, [56 + (i % 2) * 20, 50 + Math.floor(i / 2) * 12, 18, 11], 7));
  return board;
}

function renderOutfit() {
  const { outfit, reasons } = suggestions[current];
  const like = el('button', { textContent: '👍' });
  const dislike = el('button', { textContent: '👎' });
  const next = el('button', { textContent: 'Anderes' });
  const wear = el('button', { textContent: 'Anziehen' });
  like.onclick = async () => {
    await setValue('affinity', applyFeedback(await getValue('affinity', {}), outfit, 1));
    like.disabled = dislike.disabled = true;
    like.classList.add('on');
  };
  // 👎 merkt sich die Abneigung und zeigt direkt das nächste Outfit.
  dislike.onclick = async () => {
    await setValue('affinity', applyFeedback(await getValue('affinity', {}), outfit, -1));
    showNext();
  };
  next.onclick = showNext;
  wear.onclick = async () => {
    const today = dayNumber(new Date());
    const worn = (await getValue('worn', [])).filter(w => w.day !== today);
    worn.push({ day: today, ids: pieces(outfit).map(i => i.id) });
    await setValue('worn', worn.slice(-60));
    wear.textContent = 'Getragen ✓';
    wear.disabled = true;
    wear.classList.add('on');
  };
  $('#outfit').replaceChildren(el('div', { className: 'card outfit' },
    renderBoard(outfit),
    el('div', { className: 'names' }, ...pieces(outfit).map(i => el('span', { textContent: itemName(i) }))),
    el('ul', { className: 'reasons' }, ...reasons.map(r => el('li', { className: r.points > 0 ? 'plus' : 'minus', textContent: r.text }))),
    el('div', { className: 'actions' }, like, dislike, next, wear)));
}

function showNext() {
  current = (current + 1) % suggestions.length;
  renderOutfit();
}

async function refreshOutfit() {
  const { outfits, missing } = generateOutfits(items, await context(), { count: 10 });
  if (missing.length) return $('#outfit').replaceChildren(renderOnboarding(missing));
  // Nur Vorschläge, die nicht deutlich schlechter als der beste sind (kleiner Schrank = weniger Auswahl).
  suggestions = outfits.filter(o => o.total >= outfits[0].total - 6);
  current = 0;
  renderOutfit();
}

// --- Start ---
await loadItems();
renderWardrobe();
navigator.storage?.persist?.();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');

// Auf das Wetter höchstens 8 s warten, dann ohne Temperatur weitermachen.
const weather = await Promise.race([getWeather().catch(() => null), new Promise(r => setTimeout(r, 8000, null))]);
if (weather) {
  $('#temp').value = Math.round(weather.temp);
  $('#weather-text').textContent = `${Math.round(weather.min)} bis ${Math.round(weather.max)} °C gefühlt` +
    (weather.rain != null ? ` · Regen ${weather.rain} %` : '');
} else {
  $('#weather-text').textContent = 'Kein Wetter verfügbar – Temperatur im Menü eintragen';
}
await refreshOutfit();
processPending();
