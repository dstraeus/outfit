// Modelle laufen in einem eigenen Worker: Es ist nie mehr als ein Modell im Speicher, und beim
// Beenden des Workers gibt iOS dessen Speicher vollständig frei (WebAssembly-Speicher schrumpft
// sonst nie). Aufträge laufen der Reihe nach.
const BUSY = 'ml-busy', LEVEL = 'ml-safe-level';
const store = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* privater Modus */ } },
  del: k => { try { localStorage.removeItem(k); } catch { /* privater Modus */ } },
};

// Sicherer Modus: 0 = normal, 1 = Freistellen ohne Grafikchip und keine automatische Erkennung,
// 2 = gar keine Modelle mehr. Wurde die Seite während eines Modells beendet (Flag steht noch),
// war das vermutlich ein Absturz – dann eine Stufe vorsichtiger.
export const safeLevel = () => Number(store.get(LEVEL)) || 0;
export const resetSafeMode = () => store.del(LEVEL);
if (store.get(BUSY)) {
  store.set(LEVEL, String(Math.min(2, safeLevel() + 1)));
  store.del(BUSY);
}

let worker = null, workerTask = null, running = null, idleTimer, queue = Promise.resolve(), nextId = 0;

// App weggewischt oder gewechselt ist kein Absturz: Flag nur setzen, solange die App sichtbar ist.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) store.del(BUSY);
  else if (running) store.set(BUSY, running);
});

function stop() {
  worker?.terminate();
  worker = workerTask = null;
}

function run(task, payload, onProgress) {
  const job = queue.then(() => new Promise((resolve, reject) => {
    clearTimeout(idleTimer);
    if (workerTask !== task) {
      stop();
      worker = new Worker(new URL('./ml-worker.js', import.meta.url), { type: 'module' });
      workerTask = task;
    }
    const id = ++nextId;
    const finish = () => {
      running = null;
      store.del(BUSY);
      worker.onmessage = worker.onerror = null;
      idleTimer = setTimeout(stop, 15000);
    };
    worker.onmessage = ({ data }) => {
      if (data.id !== id) return;
      if (data.progress) return onProgress?.(data.progress);
      finish();
      if (data.error) reject(new Error(data.error));
      else resolve(data.result);
    };
    worker.onerror = e => {
      finish();
      stop();
      reject(new Error(e.message || 'Worker-Fehler'));
    };
    running = task;
    if (!document.hidden) store.set(BUSY, task);
    worker.postMessage({ id, task, ...payload });
  }));
  queue = job.catch(() => {});
  return job;
}

// PNG-Blob mit transparentem Hintergrund oder null, wenn kaum etwas erkannt wurde.
export const removeBackground = (blob, onProgress) => run('segment', { blob, gpu: safeLevel() === 0 }, onProgress);

// [{ category, score }] absteigend sortiert.
export const classify = (blob, onProgress) => run('classify', { blob }, onProgress);
