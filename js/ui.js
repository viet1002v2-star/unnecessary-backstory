/* Small shared interface helpers for the authoring pages:
   toasts (with optional Undo), the autosave stamp in the top bar, upload checks and the file viewer. */
(function () {
  'use strict';

  /* ---------- toasts ---------- */
  var region = null;
  function ensureRegion() {
    if (region) return region;
    region = document.createElement('div');
    region.className = 'toasts';
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', 'polite');
    document.body.appendChild(region);
    return region;
  }
  /* kind: 'ok' | 'error'; action: { label, run } */
  function toast(message, kind, action) {
    var r = ensureRegion();
    var t = document.createElement('div');
    t.className = 'toast' + (kind === 'error' ? ' is-error' : '');
    var p = document.createElement('span');
    p.textContent = message;
    t.appendChild(p);
    var timer = null;
    var close = function () { clearTimeout(timer); if (t.parentNode) t.parentNode.removeChild(t); };
    if (action) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn quiet';
      b.textContent = action.label;
      b.addEventListener('click', function () { action.run(); close(); });
      t.appendChild(b);
    }
    r.appendChild(t);
    while (r.children.length > 3) r.removeChild(r.firstChild);   /* keep at most three on screen */
    timer = setTimeout(close, action ? 8000 : kind === 'error' ? 7000 : 3500);
    return close;
  }

  /* ---------- autosave stamp ---------- */
  function bindAutosave(el) {
    if (!el || !window.UBDraft) return;
    UBDraft.onSave(function (when) {
      el.textContent = 'autosaved ' + when.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    });
  }

  /* ---------- uploads ---------- */
  var MAX_BYTES = 10 * 1024 * 1024;
  var ALLOWED = [
    { kind: 'image', mimes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'], ext: /\.(png|jpe?g|gif|webp)$/i },
    { kind: 'pdf', mimes: ['application/pdf'], ext: /\.pdf$/i },
    { kind: 'text', mimes: ['text/plain'], ext: /\.txt$/i },
    { kind: 'docx', mimes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'], ext: /\.docx$/i }
  ];
  var ACCEPT = '.png,.jpg,.jpeg,.gif,.webp,.pdf,.txt,.docx';

  /* Returns { ok, kind, message } */
  function checkFile(file) {
    var match = null;
    ALLOWED.forEach(function (a) { if (a.mimes.indexOf(file.type) >= 0 || a.ext.test(file.name)) match = match || a; });
    if (!match) return { ok: false, message: file.name + ' is not a supported file. Use a picture (PNG, JPG, GIF, WebP), a PDF, a .txt note or a .docx document.' };
    if (file.size > MAX_BYTES) return { ok: false, message: file.name + ' is ' + (file.size / 1048576).toFixed(1) + ' MB. The limit is 10 MB.' };
    if (file.size === 0) return { ok: false, message: file.name + ' is empty.' };
    return { ok: true, kind: match.kind };
  }

  function sizeLabel(n) {
    if (!n) return '';
    return n < 1024 ? n + ' B' : n < 1048576 ? Math.round(n / 1024) + ' KB' : (n / 1048576).toFixed(1) + ' MB';
  }

  /* ---------- file viewer (needs <dialog id="viewer"> with #viewer-title, #viewer-body, #viewer-close) ---------- */
  var viewerUrl = null;
  function viewer() { return document.getElementById('viewer'); }

  function closeViewer() { var v = viewer(); if (v && v.open) v.close(); }

  function initViewer() {
    var v = viewer();
    if (!v || v.dataset.ready) return;
    v.dataset.ready = '1';
    document.getElementById('viewer-close').addEventListener('click', closeViewer);
    v.addEventListener('click', function (e) { if (e.target === v) closeViewer(); });
    v.addEventListener('close', function () {
      document.getElementById('viewer-body').textContent = '';
      if (viewerUrl) { URL.revokeObjectURL(viewerUrl); viewerUrl = null; }
    });
  }

  /* block: an image/file/drawing block */
  function preview(block) {
    initViewer();
    var v = viewer(), body = document.getElementById('viewer-body');
    document.getElementById('viewer-title').textContent = block.name || block.alt || 'Drawing';
    body.textContent = '';
    if (typeof v.showModal === 'function') v.showModal(); else v.setAttribute('open', '');
    var say = function (t) { var p = document.createElement('p'); p.textContent = t; body.appendChild(p); };

    if (block.type === 'sheet') {
      body.appendChild(UBAssets.renderSheet(block));
      return;
    }
    if (block.type === 'drawing') {
      var slot = document.createElement('div');
      slot.className = 'drawing viewer-drawing';
      slot.setAttribute('data-asset', block.asset);
      slot.setAttribute('data-asset-alt', block.alt || '');
      body.appendChild(slot);
      UBAssets.fillSlot(slot);
      return;
    }
    if (typeof block.inline === 'string') {
      var pre = document.createElement('pre'); pre.textContent = block.inline; body.appendChild(pre); return;
    }
    say('Opening…');
    UBFiles.get(block.id).then(function (rec) {
      body.textContent = '';
      if (!rec || !rec.blob) { say('This file is no longer in this browser. It may have been cleared with the browser data.'); return; }
      viewerUrl = URL.createObjectURL(rec.blob);
      var c = checkFile(rec.blob instanceof File ? rec.blob : { name: rec.name, type: rec.type, size: rec.size || 1 });
      if (c.kind === 'image') {
        var img = document.createElement('img'); img.src = viewerUrl; img.alt = block.alt || rec.name; body.appendChild(img);
      } else if (c.kind === 'pdf') {
        var f = document.createElement('iframe'); f.src = viewerUrl; f.title = rec.name; body.appendChild(f);
      } else if (c.kind === 'text') {
        rec.blob.text().then(function (t) { var p = document.createElement('pre'); p.textContent = t.slice(0, 20000); body.appendChild(p); });
      } else {
        say('Word documents cannot be shown inside the browser. You can save a copy and open it in Word.');
        var a = document.createElement('a'); a.href = viewerUrl; a.download = rec.name; a.className = 'btn primary';
        a.textContent = 'Save a copy of ' + rec.name; body.appendChild(a);
      }
    }).catch(function () { body.textContent = ''; say('This browser could not open its file storage.'); });
  }

  /* Short human description of a block, for lists and chips. */
  function blockLabel(b) {
    if (b.type === 'image') return 'Picture · ' + (b.name || '');
    if (b.type === 'drawing') return ((b.asset === 'demo-cat' || /^a photo\b/i.test(b.alt || '')) ? 'Photo · ' : 'Drawing · ') + (b.alt || b.asset);
    if (b.type === 'sheet') return 'Handwritten page';
    if (b.type === 'file') {
      if (typeof b.inline === 'string') return 'Note · ' + b.name;
      return (/\.pdf$/i.test(b.name) ? 'PDF' : /\.txt$/i.test(b.name) ? 'Note' : 'Document') + ' · ' + b.name + (b.size ? ' · ' + sizeLabel(b.size) : '');
    }
    return '';
  }

  window.UBUI = {
    toast: toast, bindAutosave: bindAutosave, checkFile: checkFile, ACCEPT: ACCEPT,
    sizeLabel: sizeLabel, preview: preview, closeViewer: closeViewer, blockLabel: blockLabel
  };
})();
