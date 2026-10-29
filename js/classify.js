// Bilderkennung direkt auf dem Handy: CLIP vergleicht das Foto mit den
// englischen Beschreibungen aus catalog.js (neue Kategorie = neuer prompt, kein Training nötig).
// Das Modell (~150 MB) wird beim ersten Mal geladen und danach vom Browser gecacht.
import { CATEGORIES } from './catalog.js';

const LIB = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2';
const MODEL = 'Xenova/clip-vit-base-patch32';
let classifier;

function load(onProgress) {
  return classifier ??= import(LIB).then(({ pipeline }) =>
    pipeline('zero-shot-image-classification', MODEL, { dtype: 'q8', progress_callback: onProgress }));
}

// Liefert [{ category, score }] absteigend sortiert; Prompts einer Kategorie werden addiert.
export async function classify(imageUrl, onProgress) {
  const clf = await load(onProgress);
  const prompts = CATEGORIES.flatMap(c => c.prompts.map(p => [p, c.id]));
  const out = await clf(imageUrl, prompts.map(([p]) => p), { hypothesis_template: 'a photo of {}' });
  const scores = {};
  for (const r of out) {
    const id = prompts.find(([p]) => p === r.label)[1];
    scores[id] = (scores[id] || 0) + r.score;
  }
  return Object.entries(scores).map(([category, score]) => ({ category, score })).sort((a, b) => b.score - a.score);
}
