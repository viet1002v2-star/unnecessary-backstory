/* Local attachment storage (IndexedDB).
   Files live only in this browser on this computer. They never travel inside a share link.
   API (all return Promises):
     UBFiles.put(file)   -> { id, name, type, size }
     UBFiles.get(id)     -> { id, name, type, size, blob } or null
     UBFiles.remove(id)
*/
(function () {
  'use strict';

  var DB_NAME = 'unnecessary-backstory';
  var STORE = 'files';
  var dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (!('indexedDB' in window)) { reject(new Error('This browser cannot store files.')); return; }
      var req;
      try { req = indexedDB.open(DB_NAME, 1); } catch (e) { reject(e); return; }
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error('Could not open file storage.')); };
    });
    return dbPromise;
  }

  function tx(mode, work) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t = db.transaction(STORE, mode);
        var store = t.objectStore(STORE);
        var result = work(store);
        t.oncomplete = function () { resolve(result && result.__value !== undefined ? result.__value : result); };
        t.onerror = function () { reject(t.error || new Error('File storage failed.')); };
        t.onabort = function () { reject(t.error || new Error('File storage was interrupted (the disk may be full).')); };
      });
    });
  }

  function newId() {
    return 'f_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function put(file) {
    var record = { id: newId(), name: file.name, type: file.type || '', size: file.size, blob: file, added: Date.now() };
    return tx('readwrite', function (store) { store.put(record); }).then(function () {
      return { id: record.id, name: record.name, type: record.type, size: record.size };
    });
  }

  function get(id) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var req = db.transaction(STORE, 'readonly').objectStore(STORE).get(id);
        req.onsuccess = function () { resolve(req.result || null); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  function remove(id) {
    return tx('readwrite', function (store) { store.delete(id); });
  }

  window.UBFiles = { put: put, get: get, remove: remove };
})();
