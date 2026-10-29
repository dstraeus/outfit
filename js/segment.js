// Freistellen direkt auf dem Handy: ISNet trennt das Kleidungsstück vom Hintergrund.
// Mit WebGPU (iOS 26+) fp16 (~88 MB), sonst WASM q8 (~44 MB); beides einmalig geladen.
import { transformers } from './lib.js';

const MODEL = 'onnx-community/ISNet-ONNX';
let segmenter;

function load(onProgress) {
  return segmenter ??= transformers().then(async ({ pipeline }) => {
    if (navigator.gpu) {
      try {
        return await pipeline('background-removal', MODEL, { device: 'webgpu', dtype: 'fp16', progress_callback: onProgress });
      } catch (e) { console.warn('WebGPU nicht nutzbar, nehme WASM', e); }
    }
    return pipeline('background-removal', MODEL, { dtype: 'q8', progress_callback: onProgress });
  });
}

// Liefert ein Canvas mit transparentem Hintergrund, auf das Kleidungsstück zugeschnitten,
// oder null, wenn kaum etwas erkannt wurde.
export async function removeBackground(imageUrl, onProgress) {
  const seg = await load(onProgress);
  const [img] = await seg(imageUrl);
  return cropToContent(img.toCanvas());
}

function cropToContent(src) {
  const { width: w, height: h } = src;
  const alpha = src.getContext('2d').getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1, count = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (alpha[(y * w + x) * 4 + 3] < 128) continue;
    count++;
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (count < w * h * 0.03) return null;
  const pad = Math.round(Math.max(x1 - x0, y1 - y0) * 0.03);
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
  x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
  const out = document.createElement('canvas');
  out.width = x1 - x0 + 1;
  out.height = y1 - y0 + 1;
  out.getContext('2d').drawImage(src, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}
