// Läuft als Web Worker (siehe ml.js): führt einen Modell-Auftrag aus und meldet Fortschritt.
import { removeBackground } from './segment.js';
import { classify } from './classify.js';

self.onmessage = async ({ data: { id, task, blob, gpu } }) => {
  const onProgress = p => self.postMessage({ id, progress: p });
  try {
    const result = task === 'segment' ? await removeBackground(blob, gpu, onProgress) : await classify(blob, onProgress);
    self.postMessage({ id, result });
  } catch (e) {
    self.postMessage({ id, error: String(e?.message || e) });
  }
};
