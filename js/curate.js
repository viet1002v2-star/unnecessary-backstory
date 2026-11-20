(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var draft = UBDraft.load();
  UBUI.bindAutosave($('autosave'));

  function persist() {
    if (UBDraft.save(draft)) return true;
    UBUI.toast('Could not save your choices. This browser is blocking storage or it is full.', 'error');
    return false;
  }
  function say(text) { var a = $('announce'); a.textContent = ''; setTimeout(function () { a.textContent = text; }, 30); }

  function firstText(t) {
    var b = t.blocks.filter(function (x) { return x.type === 'text'; })[0];
    return b ? b.text : UBUI.blockLabel(t.blocks[0]);
  }
  function short(s) { return s.length > 60 ? s.slice(0, 57) + '…' : s; }

  function renderAll() {
    var list = $('all');
    list.textContent = '';
    draft.thoughts.forEach(function (t) {
      var shared = UBDraft.isShared(draft, t.id);
      var li = document.createElement('li');
      li.className = 'thought' + (shared ? ' is-shared' : '');
      var left = document.createElement('div');
      var meta = document.createElement('div');
      meta.className = 'thought-meta';
      var w = document.createElement('span'); w.textContent = UBStory.stamp(t.at);
      var s = document.createElement('span');
      s.textContent = shared ? 'in the gift' : 'private';
      if (shared) s.className = 'is-shared-label';
      meta.appendChild(w); meta.appendChild(s);
      var p = document.createElement('p'); p.className = 'thought-text'; p.textContent = firstText(t);
      left.appendChild(meta); left.appendChild(p);
      var extra = t.blocks.filter(function (b) { return b.type !== 'text'; });
      if (extra.length) {
        var m = document.createElement('div'); m.className = 'thought-meta mt-1';
        m.textContent = '+ ' + extra.map(function (b) { return UBUI.blockLabel(b).split(' · ')[0].toLowerCase(); }).join(', ');
        left.appendChild(m);
      }

      var label = document.createElement('label');
      label.className = 'check';
      var box = document.createElement('input');
      box.type = 'checkbox'; box.checked = shared; box.id = 'pick-' + t.id;
      box.setAttribute('aria-label', 'In the gift: ' + short(firstText(t)));
      var span = document.createElement('span'); span.textContent = 'In the gift';
      span.setAttribute('aria-hidden', 'true');
      label.appendChild(box); label.appendChild(span);
      box.addEventListener('change', function () { toggle(t.id, box.checked); });

      li.appendChild(left); li.appendChild(label);
      list.appendChild(li);
    });
    $('all-count').textContent = draft.thoughts.length;
  }

  function toggle(id, on) {
    var i = draft.curation.shared.indexOf(id);
    if (on && i < 0) draft.curation.shared.push(id);
    if (!on && i >= 0) draft.curation.shared.splice(i, 1);
    if (!persist()) return;
    var t = UBDraft.find(draft, id);
    say(on ? 'Added to the gift at position ' + draft.curation.shared.length + '.' : 'Left out. "' + short(firstText(t)) + '" stays private.');
    render();
    var again = $('pick-' + id); if (again) again.focus();
  }

  function renderGift() {
    var list = $('gift');
    list.textContent = '';
    var ids = draft.curation.shared;
    $('gift-empty').hidden = ids.length > 0;
    $('order-hint').hidden = ids.length < 2;
    $('gift-count').textContent = ids.length;

    ids.forEach(function (id, pos) {
      var t = UBDraft.find(draft, id);
      if (!t) return;
      var hidden = draft.curation.hiddenBlocks[id] || [];
      var li = document.createElement('li');
      var card = document.createElement('div');
      card.className = 'thought is-shared';
      card.dataset.id = id;
      card.draggable = true;

      var left = document.createElement('div');
      var meta = document.createElement('div'); meta.className = 'thought-meta';
      meta.textContent = UBStory.stamp(t.at);
      var p = document.createElement('p'); p.className = 'thought-text'; p.textContent = firstText(t);
      left.appendChild(meta); left.appendChild(p);

      var media = [];
      t.blocks.forEach(function (b, bi) { if (b.type !== 'text' && b.type !== 'sheet') media.push({ b: b, bi: bi }); });
      if (media.length) {
        var chips = document.createElement('div'); chips.className = 'chips';
        media.forEach(function (m) {
          var off = hidden.indexOf(m.bi) >= 0;
          var row = document.createElement('span'); row.className = 'chip-row';
          var c = document.createElement('button');
          c.type = 'button'; c.className = 'chip' + (off ? ' is-off' : '');
          c.textContent = UBUI.blockLabel(m.b);
          c.setAttribute('aria-label', 'Preview ' + UBUI.blockLabel(m.b) + (off ? ' (left out)' : ''));
          c.addEventListener('click', function () { UBUI.preview(m.b); });
          var tg = document.createElement('button');
          tg.type = 'button'; tg.className = 'btn quiet'; tg.dataset.role = 'media-' + m.bi;
          tg.textContent = off ? 'Put back' : 'Leave out';
          tg.setAttribute('aria-label', (off ? 'Put back ' : 'Leave out ') + UBUI.blockLabel(m.b));
          tg.addEventListener('click', function () { toggleMedia(id, m.bi); });
          row.appendChild(c); row.appendChild(tg);
          chips.appendChild(row);
        });
        left.appendChild(chips);
      }

      var actions = document.createElement('div'); actions.className = 'thought-actions';
      var moves = document.createElement('div'); moves.className = 'move-btns';
      var up = mk('Up', 'up', 'Move up: ' + short(firstText(t)), pos === 0, function () { move(id, -1, 'up'); });
      var down = mk('Down', 'down', 'Move down: ' + short(firstText(t)), pos === ids.length - 1, function () { move(id, 1, 'down'); });
      var out = mk('Remove', 'remove', 'Remove from the gift: ' + short(firstText(t)), false, function () { toggle(id, false); $('gift-title').focus(); });
      moves.appendChild(up); moves.appendChild(down);
      actions.appendChild(moves); actions.appendChild(out);

      card.appendChild(left); card.appendChild(actions);
      li.appendChild(card);
      list.appendChild(li);
      bindDrag(card);
    });
  }

  function mk(text, role, label, disabled, fn) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'btn'; b.textContent = text; b.dataset.role = role;
    b.setAttribute('aria-label', label); b.disabled = disabled;
    b.addEventListener('click', fn);
    return b;
  }

  function move(id, delta, role) {
    var ids = draft.curation.shared, i = ids.indexOf(id), j = i + delta;
    if (j < 0 || j >= ids.length) return;
    ids.splice(i, 1); ids.splice(j, 0, id);
    if (!persist()) return;
    render();
    say('Moved to position ' + (j + 1) + ' of ' + ids.length + '.');
    var card = document.querySelector('.order .thought[data-id="' + id + '"]');
    if (card) {
      var b = card.querySelector('[data-role="' + role + '"]');
      if (!b || b.disabled) b = card.querySelector('[data-role="' + (role === 'up' ? 'down' : 'up') + '"]');
      if (b) b.focus();
    }
  }

  function toggleMedia(id, bi) {
    var h = draft.curation.hiddenBlocks[id] || [];
    var k = h.indexOf(bi);
    if (k >= 0) h.splice(k, 1); else h.push(bi);
    if (h.length) draft.curation.hiddenBlocks[id] = h; else delete draft.curation.hiddenBlocks[id];
    if (!persist()) return;
    render();
    say(k >= 0 ? 'Put back into the gift.' : 'Left out of the gift. The file stays in My Thoughts.');
    var card = document.querySelector('.order .thought[data-id="' + id + '"]');
    var b = card && card.querySelector('[data-role="media-' + bi + '"]');
    if (b) b.focus();
  }

  var dragId = null;
  function bindDrag(card) {
    card.addEventListener('dragstart', function (e) {
      dragId = card.dataset.id; card.classList.add('is-dragging');
      try { e.dataTransfer.setData('text/plain', dragId); e.dataTransfer.effectAllowed = 'move'; } catch (x) {  }
    });
    card.addEventListener('dragend', function () {
      dragId = null; card.classList.remove('is-dragging');
      document.querySelectorAll('.drop-before').forEach(function (c) { c.classList.remove('drop-before'); });
    });
    card.addEventListener('dragover', function (e) {
      if (!dragId || dragId === card.dataset.id) return;
      e.preventDefault();
      document.querySelectorAll('.drop-before').forEach(function (c) { c.classList.remove('drop-before'); });
      card.classList.add('drop-before');
    });
    card.addEventListener('drop', function (e) {
      e.preventDefault();
      if (!dragId || dragId === card.dataset.id) return;
      var ids = draft.curation.shared;
      ids.splice(ids.indexOf(dragId), 1);
      ids.splice(ids.indexOf(card.dataset.id), 0, dragId);
      if (persist()) { render(); say('Moved.'); }
    });
  }

  function renderSummary() {
    var story = UBDraft.buildStory(draft);
    var shared = draft.curation.shared.length;
    var priv = draft.thoughts.length - shared;
    var media = 0;
    story.thoughts.forEach(function (t) { media += UBDraft.localMedia(t.blocks).length; });
    var parts = [shared + (shared === 1 ? ' thought' : ' thoughts') + ' in the gift', priv + ' private'];
    if (media) parts.push(media + (media === 1 ? ' picture or file' : ' pictures and files') + ' (these stay on this computer if you share by link)');
    $('summary-text').textContent = parts.join(' · ');
    var c = $('continue');
    if (shared) { c.removeAttribute('aria-disabled'); c.classList.remove('is-disabled'); c.style.opacity = ''; c.style.pointerEvents = ''; }
    else { c.setAttribute('aria-disabled', 'true'); c.style.opacity = '.45'; }
  }
  $('continue').addEventListener('click', function (e) {
    if (!draft.curation.shared.length) { e.preventDefault(); UBUI.toast('Choose at least one thought for the gift first.', 'error'); }
  });

  function render() {
    var none = draft.thoughts.length === 0;
    $('no-thoughts').hidden = !none;
    $('columns').hidden = none;
    $('summary').hidden = none;
    if (none) return;
    renderAll(); renderGift(); renderSummary();
  }

  window.addEventListener('storage', function () { draft = UBDraft.load(); render(); });
  render();
})();
