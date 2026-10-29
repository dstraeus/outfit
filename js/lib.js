// transformers.js (läuft im Browser, Modelle werden nach dem ersten Laden gecacht).
const URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.6';
let lib;

export const transformers = () => lib ??= import(URL);
