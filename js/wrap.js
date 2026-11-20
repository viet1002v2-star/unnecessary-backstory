(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var draft = UBDraft.load();
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var QR_LIMIT = 2900;

  UBUI.bindAutosave($('autosave'));

  function say(text) { var a = $('announce'); a.textContent = ''; setTimeout(function () { a.textContent = text; }, 30); }

  function publicBase() {
    if (/^https?:$/.test(location.protocol)) return location.href.replace(/[#?].*$/, '').replace(/[^/]*$/, '');
    var u = (window.UB_CONFIG && UB_CONFIG.SITE_URL || '').trim();
    if (!u) return null;
    return /\/$/.test(u) ? u : u + '/';
  }

  var fields = ['final', 'from', 'gift'];
  fields.forEach(function (f) { $(f).value = draft.wrap[f] || ''; });
  var saveTimer = null;
  fields.forEach(function (f) {
    $(f).addEventListener('input', function () {
      draft.wrap[f] = $(f).value;
      clearTimeout(saveTimer);
      saveTimer = setTimeout(function () {
        if (!UBDraft.save(draft)) UBUI.toast('Could not save. This browser is blocking storage or it is full.', 'error');
      }, 400);
      staleOutput();
    });
  });

  function story() {
    var s = UBDraft.buildStory(draft);
    if (!s.final) s.final = 'Anyway. I hope you like it.';
    return s;
  }
  function mediaCount(s) {
    var n = 0;
    s.thoughts.forEach(function (t) { n += UBDraft.localMedia(t.blocks).length; });
    return n;
  }

  function renderIncluded() {
    var s = story();
    var list = $('included');
    list.textContent = '';
    s.thoughts.forEach(function (t, i) {
      var li = document.createElement('li');
      var x = document.createElement('span'); x.className = 'x'; x.textContent = UBStory.firstText(t);
      var m = document.createElement('span'); m.className = 'm';
      var extras = t.blocks.filter(function (b) { return b.type !== 'text'; }).map(function (b) { return UBUI.blockLabel(b); });
      m.textContent = String(i + 1).padStart(2, '0') + ' · ' + UBStory.stamp(t.at) + (extras.length ? ' · ' + extras.join(' · ') : '');
      li.appendChild(x); li.appendChild(m);
      list.appendChild(li);
    });
    var media = mediaCount(s);
    $('media-warning').hidden = media === 0;
    $('media-warning-text').textContent = 'Your gift includes ' + media + (media === 1 ? ' picture or file' : ' pictures and files') + ' stored on this computer.';
    $('no-address').hidden = !!publicBase();
    $('make').textContent = publicBase() ? 'Create link and QR code' : 'Create a link for this computer';
    $('share-status').textContent = s.thoughts.length + (s.thoughts.length === 1 ? ' thought' : ' thoughts');
  }

  $('preview').addEventListener('click', function (e) {
    if (!UBStory.savePreview(story())) {
      e.preventDefault();
      UBUI.toast('Could not prepare the preview: this browser is blocking storage.', 'error');
    }
  });

  function staleOutput() {
    if (!$('out').hidden) {
      $('out').hidden = true;
      UBUI.toast('You changed the story, so the old link was removed. Create it again.');
    }
  }

  function showError(text) { var e = $('make-error'); e.textContent = text; e.hidden = !text; }

  $('make').addEventListener('click', function () {
    showError('');
    var s = story();
    if (!s.thoughts.length) { showError('Choose at least one thought in Curate first.'); return; }
    if (mediaCount(s) && !$('words-only').checked) {
      showError('Tick "Share the words only" first, so nobody expects the pictures to arrive.');
      $('words-only').focus();
      return;
    }
    var code;
    try { code = UBStory.encode(s); } catch (x) { showError('The story could not be turned into a link.'); return; }

    var base = publicBase();
    var link = (base || location.href.replace(/[#?].*$/, '').replace(/[^/]*$/, '')) + 'Backstory.html#s=' + code;

    $('make').disabled = true;
    $('out').hidden = true;
    $('exporting').hidden = false;
    $('export-label').textContent = 'Exporting brain…';
    $('bar').style.width = '0';
    var delay = reduceMotion.matches ? 0 : 900;
    requestAnimationFrame(function () { $('bar').style.width = '100%'; });
    setTimeout(function () {
      $('exporting').hidden = true;
      $('make').disabled = false;
      $('link').value = link;
      $('open-link').href = link;

      var qrOk = false;
      $('qr').textContent = '';
      if (!base) {
        $('qr-caption').textContent = 'No QR code: this link only opens on this computer.';
      } else if (link.length > QR_LIMIT) {
        $('qr-caption').textContent = 'No QR code: the story is too long to fit in one. Leave out a few thoughts in Curate, or send the link instead.';
      } else {
        try {
          var q = qrcode(0, 'L');
          q.addData(link, 'Byte');
          q.make();
          $('qr').innerHTML = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true, alt: 'QR code for the share link', title: 'QR code for the share link' });
          qrOk = true;
          $('qr-caption').textContent = 'Contains words only. Scan it with your own phone before you wrap the gift.' +
            (link.length > 1200 ? ' It is dense, so print it at least 4 cm wide.' : '');
        } catch (x) {
          $('qr-caption').textContent = 'The QR code could not be made. The link still works.';
        }
      }
      $('qr').hidden = !qrOk;
      $('out').hidden = false;
      say(qrOk ? 'Link and QR code ready.' : 'Link ready. ' + $('qr-caption').textContent);
      $('link').focus();
      $('link').select();
    }, delay);
  });

  $('copy').addEventListener('click', function () {
    var v = $('link').value;
    var done = function () { UBUI.toast('Link copied.'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(v).then(done, function () { $('link').select(); UBUI.toast('Press Ctrl+C (or Cmd+C) to copy the selected link.'); });
    } else { $('link').select(); UBUI.toast('Press Ctrl+C (or Cmd+C) to copy the selected link.'); }
  });
  $('words-only').addEventListener('change', function () { showError(''); });

  function render() {
    var has = draft.curation.shared.length > 0;
    $('nothing').hidden = has;
    $('content').hidden = !has;
    if (has) renderIncluded();
  }
  window.addEventListener('storage', function () { draft = UBDraft.load(); render(); staleOutput(); });
  render();
})();
