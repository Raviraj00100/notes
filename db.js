/**
 * MyNotes — db.js
 * IndexedDB wrapper + localStorage helpers for persistent storage
 */

const DB_NAME = 'MyNotesDB';
const DB_VERSION = 1;
const STORE_NOTES = 'notes';
const STORE_FILES = 'files';
const STORE_CATEGORIES = 'categories';
const STORE_RECYCLE = 'recycle';

let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (db) return resolve(db);
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains(STORE_NOTES)) {
        d.createObjectStore(STORE_NOTES, { keyPath: 'id' });
      }
      if (!d.objectStoreNames.contains(STORE_FILES)) {
        d.createObjectStore(STORE_FILES, { keyPath: 'id' });
      }
      if (!d.objectStoreNames.contains(STORE_CATEGORIES)) {
        d.createObjectStore(STORE_CATEGORIES, { keyPath: 'id' });
      }
      if (!d.objectStoreNames.contains(STORE_RECYCLE)) {
        d.createObjectStore(STORE_RECYCLE, { keyPath: 'id' });
      }
    };
    req.onsuccess = (e) => { db = e.target.result; resolve(db); };
    req.onerror = (e) => reject(e.target.error);
  });
}

function dbGet(store, id) {
  return openDB().then(d => new Promise((res, rej) => {
    const t = d.transaction(store, 'readonly');
    const req = t.objectStore(store).get(id);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  }));
}

function dbGetAll(store) {
  return openDB().then(d => new Promise((res, rej) => {
    const t = d.transaction(store, 'readonly');
    const req = t.objectStore(store).getAll();
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  }));
}

function dbPut(store, value) {
  return openDB().then(d => new Promise((res, rej) => {
    const t = d.transaction(store, 'readwrite');
    const req = t.objectStore(store).put(value);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  }));
}

function dbDelete(store, id) {
  return openDB().then(d => new Promise((res, rej) => {
    const t = d.transaction(store, 'readwrite');
    const req = t.objectStore(store).delete(id);
    req.onsuccess = () => res();
    req.onerror = () => rej(req.error);
  }));
}

function dbClear(store) {
  return openDB().then(d => new Promise((res, rej) => {
    const t = d.transaction(store, 'readwrite');
    const req = t.objectStore(store).clear();
    req.onsuccess = () => res();
    req.onerror = () => rej(req.error);
  }));
}

// High-level helpers
const NotesDB = {
  getAllNotes: () => dbGetAll(STORE_NOTES),
  getNote: (id) => dbGet(STORE_NOTES, id),
  saveNote: (note) => dbPut(STORE_NOTES, note),
  deleteNote: (id) => dbDelete(STORE_NOTES, id),

  getAllFiles: () => dbGetAll(STORE_FILES),
  saveFile: (file) => dbPut(STORE_FILES, file),
  deleteFile: (id) => dbDelete(STORE_FILES, id),

  getAllCategories: () => dbGetAll(STORE_CATEGORIES),
  saveCategory: (cat) => dbPut(STORE_CATEGORIES, cat),
  deleteCategory: (id) => dbDelete(STORE_CATEGORIES, id),

  getAllRecycle: () => dbGetAll(STORE_RECYCLE),
  saveRecycle: (note) => dbPut(STORE_RECYCLE, note),
  deleteRecycle: (id) => dbDelete(STORE_RECYCLE, id),
  clearRecycle: () => dbClear(STORE_RECYCLE),
};

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// Settings helpers (localStorage)
const Settings = {
  get: (key, def = null) => {
    const v = localStorage.getItem('mynotes_' + key);
    if (v === null) return def;
    try { return JSON.parse(v); } catch { return v; }
  },
  set: (key, val) => localStorage.setItem('mynotes_' + key, JSON.stringify(val)),
};
