/* Drawing slots.
   <div class="drawing" data-asset="name" data-asset-alt="description"> loads assets/drawings/<name>.png (or <name>.jpg for photos).
   If the file is missing:
     data-asset-fallback="hide"  → the slot disappears (used for small icons)
     otherwise                   → a labelled placeholder shows the file name and description,
                                   so the designer only has to drop finished drawings into that folder. */
(function () {
  'use strict';

  function fillSlot(el) {
    if (el.dataset.assetDone) return;
    el.dataset.assetDone = '1';
    var name = el.getAttribute('data-asset');
    if (!/^[a-z0-9-]+$/.test(name || '')) return;
    var alt = el.getAttribute('data-asset-alt') || '';
    var img = new Image();
    img.alt = alt;
    img.decoding = 'async';
    img.onload = function () {
      el.textContent = '';
      el.appendChild(img);
      el.classList.add('has-drawing');
    };
    img.onerror = function () {
      if (!img.dataset.triedJpg) { img.dataset.triedJpg = '1'; img.src = 'assets/drawings/' + name + '.jpg'; return; }   /* photos are bundled as JPG */
      if (el.getAttribute('data-asset-fallback') === 'hide') { el.hidden = true; return; }
      el.textContent = '';
      var slot = document.createElement('div');
      slot.className = 'slot';
      slot.setAttribute('role', 'img');
      slot.setAttribute('aria-label', alt || 'Drawing not added yet');
      slot.textContent = 'drawing not added yet: ' + name + '.png' + (alt ? '\n' + alt : '');
      el.appendChild(slot);
    };
    img.src = 'assets/drawings/' + name + '.png';
  }

  function fillAll(root) {
    (root || document).querySelectorAll('.drawing[data-asset]').forEach(fillSlot);
  }

  /* A visual thought sheet: a fixed-size page (w × h units) with text placed at coordinates and an
     optional hand-drawn layer on top (assets/drawings/<layer>.png, same proportions as the sheet).
     The whole sheet scales evenly to the available width, so the author's layout is kept on any screen.
     Text stays real text (readable, selectable, read by screen readers); the description covers the drawing. */
  function renderSheet(b) {
    var fig = document.createElement('figure');
    fig.className = 'th-figure';
    var sheet = document.createElement('div');
    sheet.className = 'sheet';
    sheet.style.aspectRatio = b.w + ' / ' + b.h;
    sheet.setAttribute('role', 'group');
    sheet.setAttribute('aria-label', 'Handwritten page');
    (b.items || []).forEach(function (it) {
      var p = document.createElement('p');
      p.className = 'sheet-text';
      p.textContent = it.text;
      p.style.left = (it.x / b.w * 100) + '%';
      p.style.top = (it.y / b.h * 100) + '%';
      p.style.width = (it.w / b.w * 100) + '%';
      p.style.fontSize = (it.size / b.w * 100) + 'cqw';
      if (it.rot) p.style.transform = 'rotate(' + it.rot + 'deg)';
      sheet.appendChild(p);
    });
    if (b.layer) {
      var layer = document.createElement('div');
      layer.className = 'drawing sheet-layer';
      layer.setAttribute('data-asset', b.layer);
      layer.setAttribute('data-asset-fallback', 'hide');
      layer.setAttribute('aria-hidden', 'true');
      sheet.appendChild(layer);
      fillSlot(layer);
    }
    fig.appendChild(sheet);
    if (b.alt) {
      var d = document.createElement('details');
      var s = document.createElement('summary');
      s.textContent = 'Description';
      d.appendChild(s);
      d.appendChild(document.createTextNode(b.alt));
      fig.appendChild(d);
    }
    return fig;
  }

  window.UBAssets = { fillAll: fillAll, fillSlot: fillSlot, renderSheet: renderSheet };
  document.addEventListener('DOMContentLoaded', function () { fillAll(document); });
})();
