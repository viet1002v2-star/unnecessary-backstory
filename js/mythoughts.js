/* My Thoughts — a private brain dump.
   Add, edit and delete thoughts; attach pictures and files (stored in IndexedDB on this computer). */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var draft = UBDraft.load();
  var pending = [];          // [{ file, kind, alt }] waiting to be added with the next thought
  var editing = null;        // id of the thought being edited

  UBUI.bindAutosave($('autosave'));
  $('file-input').setAttribute('accept', UBUI.ACCEPT);

  function persist(message) {
    if (UBDraft.save(draft)) { if (message) UBUI.toast(message); return true; }
    UBUI.toast('Could not save. This browser is blocking storage (private window?) or it is full.', 'error');
    return false;
  }

  /* ---------- pending attachments ---------- */
  function renderPending() {
    var list = $('pending-list');
    list.textContent = '';
    $('pending').hidden = pending.length === 0;
    pending.forEach(function (p, i) {
      var li = document.createElement('li');
      li.className = 'd-grid gap-2';
      var row = document.createElement('div');
      row.className = 'chip-row';
      var name = document.createElement('span');
      name.className = 'mono';
      name.textContent = (p.kind === 'image' ? 'Picture' : p.kind === 'pdf' ? 'PDF' : p.kind === 'text' ? 'Note' : 'Document') + ' · ' + p.file.name + ' · ' + UBUI.sizeLabel(p.file.size);
      var rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'btn quiet';
      rm.textContent = 'Remove';
      rm.setAttribute('aria-label', 'Remove ' + p.file.name);
      rm.addEventListener('click', function () { pending.splice(i, 1); renderPending(); $('attach').focus(); });
      row.appendChild(name); row.appendChild(rm);
      li.appendChild(row);
      if (p.kind === 'image') {
        var f = document.createElement('div');
        f.className = 'field';
        var id = 'alt-' + i;
        var l = document.createElement('label');
        l.setAttribute('for', id);
        l.textContent = 'Describe this picture (optional)';
        var input = document.createElement('input');
        input.className = 'input'; input.id = id; input.maxLength = 200; input.value = p.alt || '';
        input.placeholder = 'A clump of flowers, drawn in pen';
        input.addEventListener('input', function () { p.alt = input.value; });
        var hint = document.createElement('span');
        hint.className = 'hint';
        hint.textContent = 'Read out by screen readers, and shown instead of the picture where it cannot be shared.';
        f.appendChild(l); f.appendChild(input); f.appendChild(hint);
        li.appendChild(f);
      }
      list.appendChild(li);
    });
  }

  $('attach').addEventListener('click', function () { $('file-input').click(); });
  $('file-input').addEventListener('change', function (e) {
    Array.prototype.forEach.call(e.target.files, function (file) {
      if (pending.length >= 4) { UBUI.toast('A thought can hold up to 4 files.', 'error'); return; }
      var c = UBUI.checkFile(file);
      if (!c.ok) { UBUI.toast(c.message, 'error'); return; }
      pending.push({ file: file, kind: c.kind, alt: '' });
    });
    e.target.value = '';
    renderPending();
  });

  /* ---------- adding ---------- */
  function add() {
    var box = $('compose');
    var text = box.value.trim();
    if (!text && !pending.length) {
      box.setAttribute('aria-invalid', 'true');
      UBUI.toast('Write something or attach a file first.', 'error');
      box.focus();
      return;
    }
    box.removeAttribute('aria-invalid');
    $('add').disabled = true;
    var files = pending.slice();
    Promise.all(files.map(function (p) { return UBFiles.put(p.file).then(function (meta) { return { p: p, meta: meta }; }); }))
      .then(function (stored) {
        var blocks = [];
        if (text) blocks.push({ type: 'text', text: text });
        stored.forEach(function (s) {
          if (s.p.kind === 'image') blocks.push({ type: 'image', id: s.meta.id, name: s.meta.name, size: s.meta.size, alt: (s.p.alt || '').trim() });
          else blocks.push({ type: 'file', id: s.meta.id, name: s.meta.name, mime: s.meta.type, size: s.meta.size });
        });
        draft.thoughts.push({ id: UBDraft.newId(), at: new Date().toISOString(), updated: Date.now(), blocks: blocks });
        if (persist(files.length ? 'Saved with ' + files.length + (files.length === 1 ? ' file.' : ' files.') : 'Saved.')) {
          box.value = '';
          pending = [];
          renderPending();
          render();
        }
      })
      .catch(function () {
        UBUI.toast('The file could not be stored. The browser may be out of space or blocking storage. Your text is still in the box.', 'error');
      })
      .then(function () { $('add').disabled = false; box.focus(); });
  }

  $('add').addEventListener('click', add);
  $('compose').addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); add(); }
  });
  $('compose').addEventListener('input', function () { $('compose').removeAttribute('aria-invalid'); });

  /* ---------- list ---------- */
  function when(iso) { return UBStory.stamp(iso) || ''; }

  function chip(b, onClick, extraLabel) {
    var c = document.createElement('button');
    c.type = 'button';
    c.className = 'chip';
    c.textContent = UBUI.blockLabel(b);
    c.setAttribute('aria-label', 'Preview ' + UBUI.blockLabel(b) + (extraLabel || ''));
    c.addEventListener('click', onClick || function () { UBUI.preview(b); });
    return c;
  }

  function render() {
    var list = $('list');
    list.textContent = '';
    var n = draft.thoughts.length;
    var shared = draft.curation.shared.length;
    $('empty').hidden = n > 0;
    $('next-wrap').hidden = n === 0;
    $('count').textContent = n === 0 ? '' : n + (n === 1 ? ' thought' : ' thoughts') + (shared ? ' · ' + shared + ' chosen for the gift' : ' · all private');

    draft.thoughts.slice().reverse().forEach(function (t) {
      var li = document.createElement('li');
      li.className = 'thought';
      li.dataset.id = t.id;
      var left = document.createElement('div');
      var meta = document.createElement('div');
      meta.className = 'thought-meta';
      var w = document.createElement('span'); w.textContent = when(t.at);
      var s = document.createElement('span');
      if (UBDraft.isShared(draft, t.id)) { s.className = 'is-shared-label'; s.textContent = 'in the gift'; } else { s.textContent = 'private'; }
      meta.appendChild(w); meta.appendChild(s);
      left.appendChild(meta);

      var actions = document.createElement('div');
      actions.className = 'thought-actions';

      if (editing === t.id) {
        left.appendChild(editor(t));
      } else {
        var textBlock = t.blocks.filter(function (b) { return b.type === 'text'; })[0];
        if (textBlock) {
          var p = document.createElement('p');
          p.className = 'thought-text';
          p.textContent = textBlock.text;
          left.appendChild(p);
        }
        var others = t.blocks.filter(function (b) { return b.type !== 'text'; });
        if (others.length) {
          var chips = document.createElement('div');
          chips.className = 'chips';
          others.forEach(function (b) { chips.appendChild(chip(b)); });
          left.appendChild(chips);
        }
        var eb = document.createElement('button');
        eb.type = 'button'; eb.className = 'btn'; eb.textContent = 'Edit';
        eb.setAttribute('aria-label', 'Edit thought from ' + when(t.at));
        eb.addEventListener('click', function () { editing = t.id; render(); var ta = document.getElementById('edit-' + t.id); if (ta) ta.focus(); });
        var db = document.createElement('button');
        db.type = 'button'; db.className = 'btn'; db.textContent = 'Delete';
        db.setAttribute('aria-label', 'Delete thought from ' + when(t.at));
        db.addEventListener('click', function () { remove(t.id); });
        actions.appendChild(eb); actions.appendChild(db);
      }
      li.appendChild(left);
      li.appendChild(actions);
      list.appendChild(li);
    });
  }

  function editor(t) {
    var wrap = document.createElement('div');
    wrap.className = 'edit-area mt-2';
    var textBlock = t.blocks.filter(function (b) { return b.type === 'text'; })[0];
    var label = document.createElement('label');
    label.className = 'visually-hidden';
    label.setAttribute('for', 'edit-' + t.id);
    label.textContent = 'Edit thought';
    var ta = document.createElement('textarea');
    ta.className = 'textarea hand'; ta.id = 'edit-' + t.id; ta.rows = 3; ta.maxLength = 600;
    ta.value = textBlock ? textBlock.text : '';
    wrap.appendChild(label); wrap.appendChild(ta);

    var keep = t.blocks.filter(function (b) { return b.type !== 'text'; }).slice();
    var chips = document.createElement('div');
    chips.className = 'chips';
    function drawChips() {
      chips.textContent = '';
      keep.forEach(function (b, i) {
        var row = document.createElement('span');
        row.className = 'chip-row';
        row.appendChild(chip(b));
        var rm = document.createElement('button');
        rm.type = 'button'; rm.className = 'btn quiet'; rm.textContent = 'Remove';
        rm.setAttribute('aria-label', 'Remove ' + UBUI.blockLabel(b) + ' from this thought');
        rm.addEventListener('click', function () { keep.splice(i, 1); drawChips(); });
        row.appendChild(rm);
        chips.appendChild(row);
      });
    }
    drawChips();
    wrap.appendChild(chips);

    var row = document.createElement('div');
    row.className = 'chip-row';
    var save = document.createElement('button');
    save.type = 'button'; save.className = 'btn primary'; save.textContent = 'Save';
    var cancel = document.createElement('button');
    cancel.type = 'button'; cancel.className = 'btn'; cancel.textContent = 'Cancel';
    row.appendChild(save); row.appendChild(cancel);
    wrap.appendChild(row);

    function finish() {
      editing = null; render();
      var b = document.querySelector('.thought[data-id="' + t.id + '"] .thought-actions .btn');
      if (b) b.focus();
    }
    save.addEventListener('click', function () {
      var text = ta.value.trim();
      if (!text && !keep.length) { ta.setAttribute('aria-invalid', 'true'); UBUI.toast('A thought needs some text or a file. To remove it, use Delete.', 'error'); ta.focus(); return; }
      var removed = t.blocks.filter(function (b) { return b.type !== 'text' && keep.indexOf(b) < 0; });
      t.blocks = (text ? [{ type: 'text', text: text }] : []).concat(keep);
      t.updated = Date.now();
      delete draft.curation.hiddenBlocks[t.id];   // block positions changed; reset per-thought removals
      if (persist('Thought updated.')) {
        removed.forEach(function (b) { if (b.id) UBFiles.remove(b.id).catch(function () {}); });
        finish();
      }
    });
    cancel.addEventListener('click', finish);
    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); finish(); }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save.click(); }
    });
    return wrap;
  }

  /* ---------- deleting with undo ---------- */
  function remove(id) {
    var index = -1;
    draft.thoughts.forEach(function (t, i) { if (t.id === id) index = i; });
    if (index < 0) return;
    var t = draft.thoughts[index];
    var sharedAt = draft.curation.shared.indexOf(id);
    var hidden = draft.curation.hiddenBlocks[id];
    draft.thoughts.splice(index, 1);
    if (sharedAt >= 0) draft.curation.shared.splice(sharedAt, 1);
    delete draft.curation.hiddenBlocks[id];
    if (!persist()) return;
    render();
    $('list-title').focus();

    var undone = false;
    UBUI.toast('Thought deleted.', 'ok', { label: 'Undo', run: function () {
      undone = true;
      draft.thoughts.splice(index, 0, t);
      if (sharedAt >= 0) draft.curation.shared.splice(sharedAt, 0, id);
      if (hidden) draft.curation.hiddenBlocks[id] = hidden;
      persist('Thought restored.');
      render();
    } });
    setTimeout(function () {
      if (undone) return;
      t.blocks.forEach(function (b) { if (b.id) UBFiles.remove(b.id).catch(function () {}); });
    }, 9000);
  }

  $('examples').addEventListener('click', function () {
    draft.thoughts = draft.thoughts.concat(UBDraft.examples());
    if (persist('Added ' + UBDraft.examples().length + ' example thoughts. Edit or delete them freely.')) { render(); $('list-title').focus(); }
  });

  /* keep two open tabs in step */
  window.addEventListener('storage', function () { draft = UBDraft.load(); if (!editing) render(); });

  render();
})();
