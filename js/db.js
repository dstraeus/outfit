// Lokaler Speicher (IndexedDB): Kleidungsstücke inkl. Foto + Schlüssel/Wert-Daten (Feedback, Trage-Historie).
let dbPromise;

function open() {
  return dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open('outfit-app', 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('items', { keyPath: 'id' });
      req.result.createObjectStore('kv');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
  });
}

export const getItems = () => run('items', 'readonly', s => s.getAll());
export const putItem = item => run('items', 'readwrite', s => s.put(item));
export const deleteItem = id => run('items', 'readwrite', s => s.delete(id));
export const getValue = (key, fallback) => run('kv', 'readonly', s => s.get(key)).then(v => v ?? fallback);
export const setValue = (key, value) => run('kv', 'readwrite', s => s.put(value, key));
