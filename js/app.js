// Oberfläche: Startbildschirm mit einem Outfit, Menü, Schrank, Foto-Editor.
import { SLOTS, CATEGORIES, CATEGORY } from './catalog.js';
import { dominantColor, colorName } from './color.js';
import { generateOutfits } from './generator.js';
import { pieces, applyFeedback } from './rules.js';
import { getItems, putItem, deleteItem, getValue, setValue } from './db.js';
import { getWeather } from './weather.js';
import { classify } from './classify.js';

const $ = s => document.querySelector(s);
const el = (tag, props = {}, ...children) => {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...children);
  return e;
};
const dayNumber = d => Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);

let items = [];
const urls = new Map();
const photoUrl = item => {
  if (!urls.has(item.id)) urls.set(item.id, URL.createObjectURL(item.photo));
  return urls.get(item.id);
};
const forgetUrl = id => { URL.revokeObjectURL(urls.get(id)); urls.delete(id); };

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
    textContent: 'Noch leer. Fotografiere dein erstes Kleidungsstück – am besten flach hingelegt vor ruhigem Hintergrund.' }));
  for (const [slot, def] of Object.entries(SLOTS)) {
    const list = items.filter(i => CATEGORY[i.category].slot === slot);
    if (!list.length) continue;
    root.append(
      el('h2', { textContent: `${def.label} (${list.length})` }),
      el('div', { className: 'grid' }, ...list.map(i => el('button', { className: 'tile', onclick: () => openEditor(i) },
        el('img', { src: photoUrl(i), alt: '' }),
        el('span', {}, el('i', { className: 'dot', style: `background:${i.color}` }), CATEGORY[i.category].label)))));
  }
}

// --- Foto aufbereiten: verkleinern (spart Speicher) + Hauptfarbe bestimmen ---
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

async function processPhoto(file) {
  const img = await loadImage(file);
  const scale = Math.min(1, 512 / Math.max(img.width, img.height));
  const c = el('canvas', { width: Math.round(img.width * scale), height: Math.round(img.height * scale) });
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(img.src);
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.85));
  const small = el('canvas', { width: 64, height: 64 }).getContext('2d', { willReadFrequently: true });
  small.drawImage(c, 0, 0, 64, 64);
  return { blob, color: dominantColor(small.getImageData(0, 0, 64, 64).data, 64, 64) };
}

// --- Editor ---
const editor = $('#editor');
let editing = null, classifyToken = 0;

$('#ed-category').append(...Object.entries(SLOTS).map(([slot, def]) => el('optgroup', { label: def.label },
  ...CATEGORIES.filter(c => c.slot === slot).map(c => el('option', { value: c.id, textContent: c.label })))));
$('#ed-color').oninput = () => { $('#ed-colorname').textContent = colorName($('#ed-color').value); };

function openEditor(item, isNew = false) {
  editing = { item, isNew };
  editor.returnValue = '';
  $('#ed-photo').src = photoUrl(item);
  $('#ed-category').value = item.category;
  $('#ed-color').value = item.color;
  $('#ed-colorname').textContent = colorName(item.color);
  $('#ed-status').textContent = '';
  $('#ed-suggest').replaceChildren();
  $('#ed-delete').hidden = isNew;
  editor.showModal();
}

editor.onclose = async () => {
  const { item, isNew } = editing;
  classifyToken++;
  if (editor.returnValue === 'save') {
    await putItem({ ...item, category: $('#ed-category').value, color: $('#ed-color').value });
  } else if (editor.returnValue === 'delete' && confirm('Kleidungsstück löschen?')) {
    await deleteItem(item.id);
    forgetUrl(item.id);
  } else if (isNew) {
    forgetUrl(item.id);
  }
  items = await getItems();
  renderWardrobe();
  if (!$('#view-outfit').hidden) refreshOutfit();
};

$('#photo').onchange = async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (menu.open) menu.close();
  if (!file) return;
  const { blob, color } = await processPhoto(file);
  const item = { id: crypto.randomUUID(), category: CATEGORIES[0].id, color, photo: blob, createdAt: Date.now() };
  openEditor(item, true);

  const token = ++classifyToken, status = $('#ed-status');
  status.textContent = 'Erkenne Kleidungsstück …';
  try {
    const results = await classify(photoUrl(item), p => {
      if (token === classifyToken && p.status === 'progress' && p.total > 1e7)
        status.textContent = `Lade Erkennungsmodell (einmalig, ~150 MB) … ${Math.round(p.progress)} %`;
    });
    if (token !== classifyToken) return;
    $('#ed-category').value = results[0].category;
    status.textContent = 'Erkannt – bitte kurz prüfen:';
    $('#ed-suggest').replaceChildren(...results.slice(0, 3).map(r => el('button', {
      type: 'button',
      textContent: `${CATEGORY[r.category].label} · ${Math.round(r.score * 100)} %`,
      onclick: () => { $('#ed-category').value = r.category; },
    })));
  } catch (err) {
    console.error(err);
    if (token === classifyToken) status.textContent = 'Erkennung nicht verfügbar – bitte Art auswählen.';
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
      ? 'Damit ich dir Outfits zusammenstellen kann, brauche ich zuerst deine Kleidung. Fotografiere jedes Teil einzeln – am besten flach hingelegt vor ruhigem Hintergrund.'
      : 'Für ein komplettes Outfit fehlt noch etwas:' }),
    el('ul', { className: 'checklist' }, ...['base', 'bottom', 'shoes'].map(s =>
      el('li', { className: missing.includes(s) ? '' : 'done', textContent: SLOTS[s].label }))),
    el('label', { htmlFor: 'photo', className: 'primary button', textContent: first ? 'Erstes Kleidungsstück fotografieren' : 'Kleidungsstück hinzufügen' }));
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
    el('div', { className: 'pieces' }, ...pieces(outfit).map(i => el('div', { className: 'piece' },
      el('img', { src: photoUrl(i), alt: '' }), el('span', { textContent: CATEGORY[i.category].label })))),
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
  suggestions = outfits;
  current = 0;
  renderOutfit();
}

// --- Start ---
items = await getItems();
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
refreshOutfit();
