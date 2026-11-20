(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var root = $('bs');
  var els = {
    status: $('bs-status'), prompt: $('bs-prompt'), waiting: $('bs-waiting'),
    center: $('bs-center'), list: $('bs-list'), more: $('bs-more'), pending: $('bs-pending'),
    spaceWrap: $('bs-space-wrap'), space: $('bs-space'),
    final: $('bs-final'), finalText: $('bs-final-text'),
    prev: $('bs-prev'), next: $('bs-next'), count: $('bs-count'), backEnd: $('bs-back-end'),
    sheet: $('bs-sheet'), sheetBody: $('bs-sheet-body'), sheetTitle: $('bs-sheet-title'),
    sheetPrev: $('bs-sheet-prev'), sheetNext: $('bs-sheet-next'), sheetCount: $('bs-sheet-count'),
    viewer: $('bs-viewer'), viewerBody: $('bs-viewer-body'), viewerTitle: $('bs-viewer-title'),
    announce: $('bs-announce')
  };
  var desktop = window.matchMedia('(min-width: 900px)');

  var loaded = UBStory.load();
  var story = loaded.story;
  var total = story.thoughts.length;
  var from = story.from || '';

  var state = { phase: 'locked', delivered: 0, current: 0, later: false, expanded: false, arriving: -1 };

  var layout = { pos: {}, z: {}, top: 10, front: -1 };
  var viewerUrl = null;

  var owner = loaded.source === 'demo' ? 'Demo brain' : from ? from + "'s brain" : "Someone's brain";
  $('bs-owner').textContent = owner;
  document.title = owner + ' · The Unnecessary Backstory';
  $('bs-prompt-text').textContent = "You've received " + total + (total === 1 ? ' thought' : ' thoughts') +
    " that probably should have stayed in someone's head.";
  els.finalText.textContent = story.final || 'That is all of it.';
  $('bs-final-from').textContent = from;

  var notice = loaded.problem ||
    (loaded.source === 'demo' ? 'Demo story: this is what the person receiving the gift sees.' :
     loaded.source === 'preview' ? 'Preview: only you can see this. Pictures and files show because they are on this computer.' : '');
  if (notice) {
    var nEl = $('bs-notice');
    nEl.textContent = notice + ' ';
    if (loaded.source !== 'link') {
      var back = document.createElement('a');
      back.href = loaded.source === 'preview' ? 'WrapItUp.html' : 'HomePage.html';
      back.textContent = loaded.source === 'preview' ? 'Back to Wrap It Up' : 'Back to the home page';
      nEl.appendChild(back);
    }
    nEl.hidden = false;
  }

  function tick() {
    var now = new Date();
    var hm = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    $('bs-time').textContent = hm;
    $('bs-clock').textContent = hm;
    $('bs-date').textContent = now.toLocaleDateString('en-GB', { weekday: 'long' }) +
      ' · came with ' + (story.gift ? 'the ' + story.gift : 'a gift');
  }
  tick();
  setInterval(tick, 30000);

  function fileKind(b) {
    var m = (b.mime || '').toLowerCase(), n = (b.name || '').toLowerCase();
    if (b.inline !== undefined || m.indexOf('text/') === 0 || /\.txt$/.test(n)) return 'note';
    if (m === 'application/pdf' || /\.pdf$/.test(n)) return 'pdf';
    if (m.indexOf('image/') === 0 || /\.(png|jpe?g|gif|webp)$/.test(n)) return 'picture';
    return 'file';
  }

  function figureWithDescription(media, alt) {
    var fig = document.createElement('figure');
    fig.className = 'th-figure';
    fig.appendChild(media);
    if (alt) {
      var d = document.createElement('details');
      var s = document.createElement('summary');
      s.textContent = 'Description';
      d.appendChild(s);
      d.appendChild(document.createTextNode(alt));
      fig.appendChild(d);
    }
    return fig;
  }

  function renderThought(container, i) {
    (container._urls || []).forEach(function (u) { URL.revokeObjectURL(u); });
    var urls = container._urls = [];
    container.textContent = '';
    var t = story.thoughts[i];
    var wrap = document.createElement('div');
    wrap.className = 'th';
    if (t.tag) {
      var tag = document.createElement('p');
      tag.className = 'th-tag';
      tag.textContent = '#' + t.tag;
      wrap.appendChild(tag);
    }
    t.blocks.forEach(function (b) {
      if (b.type === 'text') {
        var p = document.createElement('p');
        p.className = 'th-text';
        p.textContent = b.text;
        wrap.appendChild(p);
      } else if (b.type === 'drawing') {
        var slot = document.createElement('div');
        slot.className = 'drawing';
        slot.setAttribute('data-asset', b.asset);
        slot.setAttribute('data-asset-alt', b.alt || 'Drawing');
        wrap.appendChild(figureWithDescription(slot, b.alt));
        UBAssets.fillSlot(slot);
      } else if (b.type === 'sheet') {
        wrap.appendChild(UBAssets.renderSheet(b));
      } else if (b.type === 'image') {
        var holder = document.createElement('div');
        holder.textContent = 'Loading picture…';
        var fig = figureWithDescription(holder, b.alt);
        wrap.appendChild(fig);
        UBFiles.get(b.id).then(function (rec) {
          holder.textContent = '';
          if (!rec || !rec.blob) { holder.className = 'th-missing'; holder.textContent = 'This picture is not in this browser.'; return; }
          var u = URL.createObjectURL(rec.blob); urls.push(u);
          var img = document.createElement('img');
          img.src = u; img.alt = b.alt || 'Picture from ' + (from || 'the giver');
          holder.appendChild(img);
        }).catch(function () { holder.className = 'th-missing'; holder.textContent = 'This browser could not open its file storage.'; });
      } else if (b.type === 'file') {
        var kind = fileKind(b);
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'th-file';
        var k = document.createElement('b');
        k.textContent = kind === 'note' ? 'Note' : kind === 'pdf' ? 'PDF' : kind === 'picture' ? 'Picture' : 'File';
        var n = document.createElement('span');
        n.textContent = b.name;
        btn.appendChild(k); btn.appendChild(n);
        btn.setAttribute('aria-label', 'Open ' + k.textContent.toLowerCase() + ', ' + b.name);
        btn.addEventListener('click', function () { openFile(b); });
        wrap.appendChild(btn);
      } else if (b.type === 'missing') {
        var m = document.createElement('p');
        m.className = 'th-missing';
        m.textContent = 'A ' + (b.kind === 'picture' ? 'picture' : 'file') + ' stayed on ' +
          (from ? from + "'s" : 'their') + ' computer' + (b.label ? ': ' + b.label : '') + '. Share links carry words only.';
        wrap.appendChild(m);
      }
    });
    container.appendChild(wrap);
  }

  function notification(i) {
    var t = story.thoughts[i];
    var li = document.createElement('li');
    if (i === state.current && state.phase !== 'locked') li.className = 'is-current';
    if (i === state.arriving) li.classList.add('is-arriving');

    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'notif';
    if (li.classList.contains('is-current')) b.setAttribute('aria-current', 'true');

    var head = document.createElement('span');
    head.className = 'notif-head';
    var app = document.createElement('span');
    app.className = 'notif-app';
    app.textContent = owner;
    var when = document.createElement('span');
    when.textContent = UBStory.stamp(t.at) || 'earlier';
    head.appendChild(app); head.appendChild(when);

    var text = document.createElement('span');
    text.className = 'notif-text';
    text.textContent = UBStory.firstText(t);

    b.appendChild(head); b.appendChild(text);
    var extra = UBStory.extras(t);
    if (extra.length) {
      var more = document.createElement('span');
      more.className = 'notif-more';
      more.textContent = '+ ' + extra.join(', ');
      b.appendChild(more);
    }
    b.setAttribute('aria-label', 'Thought ' + (i + 1) + ' of ' + total + ', ' + (UBStory.stamp(t.at) || '') + ': ' +
      UBStory.firstText(t) + (extra.length ? '. Also has: ' + extra.join(', ') : ''));
    b.addEventListener('click', function () { pick(i); });
    li.appendChild(b);
    return li;
  }

  function renderList() {
    var list = els.list;
    list.textContent = '';
    var count = state.phase === 'review' ? total : state.delivered;
    var chronological = desktop.matches || state.phase === 'review';
    var lastDay = '';
    for (var k = 0; k < count; k++) {
      var i = chronological ? k : count - 1 - k;
      if (state.phase === 'review') {
        var day = UBStory.dayName(story.thoughts[i].at);
        if (day !== lastDay) {
          var dl = document.createElement('li');
          dl.className = 'bs-day';
          dl.setAttribute('aria-hidden', 'true');
          dl.textContent = day;
          list.appendChild(dl);
          lastDay = day;
        }
      }
      list.appendChild(notification(i));
    }
    var expanded = state.phase === 'review' || state.expanded;
    els.center.dataset.expanded = String(expanded);
    var others = count - 1;
    els.more.hidden = state.phase === 'review' || others < 1;
    els.more.setAttribute('aria-expanded', String(state.expanded));
    els.more.textContent = state.expanded ? 'Fold the other thoughts away' : 'Show ' + others + ' other ' + (others === 1 ? 'thought' : 'thoughts');
    var waiting = total - state.delivered;
    els.pending.hidden = state.phase === 'review' || waiting < 1;
    els.pending.textContent = waiting + ' more on the way';
    $('bs-center-title').textContent = state.phase === 'review' ? 'Notification history' : 'Notifications';
  }

  function rnd(i, k) { var x = Math.sin((i + 1) * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); }

  function card(i) {
    var t = story.thoughts[i];
    var li = document.createElement('li');
    li.className = 'card ' + (desktop.matches ? 'card-win' : 'card-notif');
    li.dataset.index = i;
    if (i === state.current) li.classList.add('is-current');
    if (i === state.arriving) li.classList.add('is-arriving');

    var handle = document.createElement('button');
    handle.type = 'button';
    handle.className = 'drag-handle';
    handle.setAttribute('aria-describedby', 'bs-space-help');
    handle.setAttribute('aria-label', 'Move thought ' + (i + 1) + ' of ' + total + (t.at ? ', ' + UBStory.stamp(t.at) : ''));

    if (desktop.matches) {
      var f = document.createElement('span'); f.textContent = 'thought_' + String(i + 1).padStart(3, '0');
      var w = document.createElement('span'); w.textContent = t.at ? UBStory.stamp(t.at) : '';
      handle.appendChild(f); handle.appendChild(w);
      li.appendChild(handle);
      var body = document.createElement('div');
      body.className = 'card-body';
      body.tabIndex = -1;
      body.setAttribute('aria-label', 'Thought ' + (i + 1) + ' of ' + total);
      renderThought(body, i);
      li.appendChild(body);
    } else {
      li.appendChild(handle);
      li.appendChild(notification(i).firstChild);
    }

    li.addEventListener('pointerdown', function () { toFront(li); }, true);
    li.addEventListener('focusin', function () { toFront(li); });
    bindDrag(li, handle);
    return li;
  }

  function defaultPos(i, w, h, W, H) {
    var step = i % 6, round = Math.floor(i / 6);
    if (desktop.matches) {
      return { x: 32 + step * 44 + round * 140 + rnd(i, 1) * 16, y: 20 + step * 46 + rnd(i, 2) * 8 };
    }
    return { x: rnd(i, 1) * Math.max(0, W - w), y: 4 + step * 36 + rnd(i, 2) * 10 };
  }

  function clamp(p, w, H, W) {
    var keep = 44;
    return {
      x: Math.round(Math.max(0, Math.min(p.x, Math.max(0, W - w)))),
      y: Math.round(Math.max(0, Math.min(p.y, Math.max(0, H - keep))))
    };
  }

  function place(li) {
    var i = Number(li.dataset.index);
    var W = els.space.clientWidth, H = els.space.clientHeight;
    var w = li.offsetWidth, h = li.offsetHeight;
    var p = layout.pos[i] || defaultPos(i, w, h, W, H);
    p = clamp(p, w, H, W);
    layout.pos[i] = p;
    li.style.left = p.x + 'px';
    li.style.top = p.y + 'px';
    if (!layout.z[i]) { layout.top += 1; layout.z[i] = layout.top; }
    li.style.zIndex = layout.z[i];
    li.classList.toggle('is-front', layout.front === i);
  }

  function toFront(li) {
    var i = Number(li.dataset.index);
    if (layout.front === i) return;
    layout.top += 1;
    layout.z[i] = layout.top;
    layout.front = i;
    li.style.zIndex = layout.top;
    els.space.querySelectorAll('.card.is-front').forEach(function (c) { c.classList.remove('is-front'); });
    li.classList.add('is-front');
  }

  function renderSpace() {
    els.space.querySelectorAll('.card-body').forEach(function (b) { (b._urls || []).forEach(function (u) { URL.revokeObjectURL(u); }); });
    els.space.textContent = '';
    for (var i = 0; i < state.delivered; i++) els.space.appendChild(card(i));
    els.space.querySelectorAll('.card').forEach(place);

    var cur = els.space.querySelector('.card[data-index="' + state.current + '"]');
    if (cur) toFront(cur);
  }

  function moveBy(li, dx, dy) {
    var i = Number(li.dataset.index);
    var p = layout.pos[i] || { x: 0, y: 0 };
    layout.pos[i] = clamp({ x: p.x + dx, y: p.y + dy }, li.offsetWidth, els.space.clientHeight, els.space.clientWidth);
    li.style.left = layout.pos[i].x + 'px';
    li.style.top = layout.pos[i].y + 'px';
  }

  function bindDrag(li, handle) {
    var start = null;
    handle.addEventListener('pointerdown', function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      toFront(li);
      var i = Number(li.dataset.index), p = layout.pos[i] || { x: 0, y: 0 };
      start = { px: e.clientX, py: e.clientY, x: p.x, y: p.y, moved: false };
      try { handle.setPointerCapture(e.pointerId); } catch (x) {  }
      li.classList.add('is-dragging');
    });
    handle.addEventListener('pointermove', function (e) {
      if (!start) return;
      var dx = e.clientX - start.px, dy = e.clientY - start.py;
      if (Math.abs(dx) + Math.abs(dy) > 3) start.moved = true;
      var i = Number(li.dataset.index);
      layout.pos[i] = clamp({ x: start.x + dx, y: start.y + dy }, li.offsetWidth, els.space.clientHeight, els.space.clientWidth);
      li.style.left = layout.pos[i].x + 'px';
      li.style.top = layout.pos[i].y + 'px';
    });
    var end = function () {
      if (!start) return;
      start = null;
      li.classList.remove('is-dragging');
    };

    var stop = function (e) { if (e.cancelable) e.preventDefault(); };
    handle.addEventListener('touchstart', stop, { passive: false });
    handle.addEventListener('touchmove', stop, { passive: false });
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
    handle.addEventListener('lostpointercapture', end);
    handle.addEventListener('keydown', function (e) {
      var step = e.shiftKey ? 48 : 16;
      var d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (d) { e.preventDefault(); e.stopPropagation(); moveBy(li, d[0], d[1]); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toFront(li); say('Thought ' + (Number(li.dataset.index) + 1) + ' brought to the front.'); }
    });
  }

  function resetLayout() {
    layout = { pos: {}, z: {}, top: 10, front: -1 };
    state.arriving = state.current;
    renderSpace();
    state.arriving = -1;
    say('Layout reset.');
  }

  function renderSheet() {
    var i = state.current;
    els.sheetTitle.textContent = 'Thought ' + (i + 1) + ' of ' + total + (story.thoughts[i].at ? ' · ' + UBStory.stamp(story.thoughts[i].at) : '');
    renderThought(els.sheetBody, i);
    els.sheetBody.scrollTop = 0;
    els.sheetCount.textContent = (i + 1) + ' / ' + total;
    els.sheetPrev.disabled = i === 0;
    els.sheetNext.textContent = nextLabel();
    if (state.phase === 'review') els.sheetNext.disabled = i >= total - 1;
    else els.sheetNext.disabled = false;
  }

  function nextLabel() {
    if (state.phase === 'locked') return 'Open';
    if (state.phase === 'review') return 'Next';
    var atEdge = state.current >= state.delivered - 1;
    return atEdge && state.delivered >= total ? 'Finish' : 'Next';
  }

  function render() {
    var p = state.phase;
    root.dataset.phase = p;

    els.prompt.hidden = p !== 'locked' || state.later;
    els.waiting.hidden = p !== 'locked' || !state.later;
    els.waiting.textContent = total + ' thoughts waiting · Open';
    els.center.hidden = !(p === 'review' || (p === 'reading' && desktop.matches));
    var spatial = p === 'reading' || (p === 'review' && desktop.matches);
    els.spaceWrap.hidden = !spatial;
    els.final.hidden = p !== 'final';
    if (p === 'reading' || p === 'review') renderList();
    if (spatial) renderSpace();

    els.status.textContent =
      p === 'locked' ? total + ' notifications' :
      p === 'final' ? 'Do Not Disturb' :
      p === 'review' ? 'history' :
      (desktop.matches ? 'processing thought ' : 'thought ') + (state.current + 1) + ' of ' + total;

    els.count.textContent = p === 'locked' ? '0 / ' + total : (state.current + 1) + ' / ' + total;
    els.prev.disabled = p === 'locked' || ((p === 'reading' || p === 'review') && state.current === 0);
    els.next.textContent = nextLabel();
    els.next.disabled = p === 'review' && state.current >= total - 1;
    els.backEnd.hidden = p !== 'review';

    if (els.sheet.open) {
      if (p === 'reading' || p === 'review') renderSheet(); else els.sheet.close();
    }
    state.arriving = -1;
  }

  function say(text) {
    els.announce.textContent = '';
    setTimeout(function () { els.announce.textContent = text; }, 30);
  }
  function sayCurrent() {
    var t = story.thoughts[state.current];
    say('Thought ' + (state.current + 1) + ' of ' + total + '. ' + UBStory.firstText(t));
  }

  function open() {
    state.phase = 'reading';
    state.delivered = Math.max(1, state.delivered);
    state.current = 0;
    state.arriving = 0;
    render();
    sayCurrent();
    els.next.focus();
  }

  function next() {
    var p = state.phase;
    if (p === 'locked') { open(); return; }
    if (p === 'final') return;
    if (p === 'review') {
      if (state.current < total - 1) { state.current += 1; render(); sayCurrent(); }
      return;
    }
    if (state.current < state.delivered - 1) {
      state.current += 1;
    } else if (state.delivered < total) {
      state.delivered += 1;
      state.current = state.delivered - 1;
      state.arriving = state.current;
    } else {
      finish();
      return;
    }
    render();
    sayCurrent();
  }

  function prev() {
    var p = state.phase;
    if (p === 'final') {
      state.phase = 'reading';
      state.current = total - 1;
      render(); sayCurrent();
      els.next.focus();
      return;
    }
    if ((p === 'reading' || p === 'review') && state.current > 0) {
      state.current -= 1;
      render(); sayCurrent();
    }
  }

  function finish() {
    state.phase = 'final';
    state.delivered = total;
    if (els.sheet.open) els.sheet.close();
    render();
    say('Notifications cleared. ' + els.finalText.textContent + (from ? ' From ' + from + '.' : ''));
    els.finalText.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  function pick(i) {
    state.current = i;
    render();
    if (desktop.matches) {
      var li = els.space.querySelector('.card[data-index="' + i + '"]');
      if (li) { toFront(li); li.querySelector('.card-body').focus(); }
      sayCurrent();
    } else openSheet();
  }

  function modalOpen(on) { document.documentElement.classList.toggle('bs-modal-open', on || els.sheet.open || els.viewer.open); }

  function openSheet() {
    renderSheet();
    modalOpen(true);
    if (typeof els.sheet.showModal === 'function') els.sheet.showModal(); else els.sheet.setAttribute('open', '');
    els.sheetTitle.focus();
  }

  function history() {
    state.phase = 'review';
    state.delivered = total;
    state.current = 0;
    render();
    say('Notification history. All ' + total + ' thoughts.');
    var first = els.list.querySelector('.notif');
    if (first) first.focus();
  }

  function again() {
    state = { phase: 'locked', delivered: 0, current: 0, later: false, expanded: false, arriving: -1 };
    layout = { pos: {}, z: {}, top: 10, front: -1 };
    render();
    $('bs-open').focus();
  }

  function openFile(b) {
    els.viewerTitle.textContent = b.name;
    els.viewerBody.textContent = '';
    if (typeof els.viewer.showModal === 'function') els.viewer.showModal(); else els.viewer.setAttribute('open', '');
    modalOpen(true);
    var note = function (text) { var p = document.createElement('p'); p.textContent = text; els.viewerBody.appendChild(p); };
    if (typeof b.inline === 'string') {
      var pre = document.createElement('pre'); pre.textContent = b.inline; els.viewerBody.appendChild(pre); return;
    }
    if (!b.id) { note('This file stayed on the giver\'s computer. Share links carry words only.'); return; }
    note('Opening…');
    UBFiles.get(b.id).then(function (rec) {
      els.viewerBody.textContent = '';
      if (!rec || !rec.blob) { note('This file is not in this browser. It may have been deleted, or the story was opened on another device.'); return; }
      viewerUrl = URL.createObjectURL(rec.blob);
      var kind = fileKind({ mime: rec.type, name: rec.name });
      if (kind === 'picture') {
        var img = document.createElement('img'); img.src = viewerUrl; img.alt = rec.name; els.viewerBody.appendChild(img);
      } else if (kind === 'pdf') {
        var f = document.createElement('iframe'); f.src = viewerUrl; f.title = rec.name; els.viewerBody.appendChild(f);
      } else if (kind === 'note') {
        rec.blob.text().then(function (txt) { var p2 = document.createElement('pre'); p2.textContent = txt.slice(0, 20000); els.viewerBody.appendChild(p2); });
      } else {
        note('This kind of file cannot be shown in the browser. You can save a copy and open it on your computer.');
        var a = document.createElement('a'); a.href = viewerUrl; a.download = rec.name; a.className = 'btn primary';
        a.textContent = 'Save a copy of ' + rec.name; els.viewerBody.appendChild(a);
      }
    }).catch(function () { els.viewerBody.textContent = ''; note('This browser could not open its file storage, so the file cannot be shown.'); });
  }
  els.sheet.addEventListener('close', function () { modalOpen(false); });
  els.viewer.addEventListener('close', function () {
    modalOpen(false);
    els.viewerBody.textContent = '';
    if (viewerUrl) { URL.revokeObjectURL(viewerUrl); viewerUrl = null; }
  });

  [els.sheet, els.viewer].forEach(function (d) {
    if (typeof d.close === 'function') return;
    Object.defineProperty(d, 'open', { get: function () { return d.hasAttribute('open'); } });
    d.close = function () { if (!d.hasAttribute('open')) return; d.removeAttribute('open'); d.dispatchEvent(new Event('close')); };
  });

  $('bs-open').addEventListener('click', open);
  $('bs-later').addEventListener('click', function () { state.later = true; render(); els.waiting.focus(); });
  els.waiting.addEventListener('click', open);
  els.next.addEventListener('click', next);
  els.prev.addEventListener('click', prev);
  els.backEnd.addEventListener('click', finish);
  $('bs-again').addEventListener('click', again);
  $('bs-history').addEventListener('click', history);
  els.more.addEventListener('click', function () { state.expanded = !state.expanded; render(); els.more.focus(); });

  els.sheetNext.addEventListener('click', next);
  els.sheetPrev.addEventListener('click', prev);
  $('bs-sheet-close').addEventListener('click', function () { els.sheet.close(); });
  els.sheet.addEventListener('close', function () {
    if (state.phase === 'reading' || state.phase === 'review') {
      var cur = els.list.querySelector('.is-current .notif');
      (cur || els.next).focus();
    }
  });
  $('bs-viewer-close').addEventListener('click', function () { els.viewer.close(); });
  [els.sheet, els.viewer].forEach(function (d) {
    d.addEventListener('click', function (e) { if (e.target === d) d.close(); });
  });

  document.addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    if (els.viewer.open) return;
    var tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) return;
    if (e.target.closest && e.target.closest('.drag-handle')) return;
    if (state.phase === 'review' && !desktop.matches && !els.sheet.open) return;
    e.preventDefault();
    if (e.key === 'ArrowRight') next(); else prev();
  });

  $('bs-reset').addEventListener('click', resetLayout);
  var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { if (!els.spaceWrap.hidden) els.space.querySelectorAll('.card').forEach(place); }, 120);
  });

  desktop.addEventListener('change', function () {
    layout = { pos: {}, z: {}, top: 10, front: -1 };
    if (els.sheet.open && desktop.matches) els.sheet.close();
    render();
  });

  render();
})();
