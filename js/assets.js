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
      if (!img.dataset.triedJpg) { img.dataset.triedJpg = '1'; img.src = 'assets/drawings/' + name + '.jpg'; return; }
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
