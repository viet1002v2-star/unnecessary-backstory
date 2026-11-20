(function () {
  'use strict';

  var KEY = 'ub.draft.v1';
  var listeners = [];

  function empty() {
    return { v: 1, thoughts: [], curation: { shared: [], hiddenBlocks: {} }, wrap: { final: '', from: '', gift: '' } };
  }

  function load() {
    try {
      var d = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!d || !Array.isArray(d.thoughts)) return empty();
      d.curation = d.curation || { shared: [], hiddenBlocks: {} };
      d.curation.shared = (d.curation.shared || []).filter(function (id) { return d.thoughts.some(function (t) { return t.id === id; }); });
      d.curation.hiddenBlocks = d.curation.hiddenBlocks || {};
      d.wrap = d.wrap || { final: '', from: '', gift: '' };
      return d;
    } catch (e) {
      return empty();
    }
  }

  function save(d) {
    try {
      localStorage.setItem(KEY, JSON.stringify(d));
      var when = new Date();
      listeners.forEach(function (fn) { fn(when); });
      return true;
    } catch (e) {
      return false;
    }
  }

  function onSave(fn) { listeners.push(fn); }

  function newId() { return 't_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  function find(d, id) {
    for (var i = 0; i < d.thoughts.length; i++) if (d.thoughts[i].id === id) return d.thoughts[i];
    return null;
  }

  function isShared(d, id) { return d.curation.shared.indexOf(id) >= 0; }

  function sharedBlocks(d, t) {
    var hidden = d.curation.hiddenBlocks[t.id] || [];
    return t.blocks.filter(function (b, i) { return b.type === 'text' || b.type === 'sheet' || hidden.indexOf(i) < 0; });
  }

  function localMedia(blocks) {
    return blocks.filter(function (b) { return (b.type === 'image') || (b.type === 'file' && typeof b.inline !== 'string'); });
  }

  function buildStory(d) {
    var thoughts = d.curation.shared.map(function (id) {
      var t = find(d, id);
      if (!t) return null;
      return { at: t.at, blocks: sharedBlocks(d, t) };
    }).filter(function (t) { return t && t.blocks.length; });
    var s = { v: 1, thoughts: thoughts, final: d.wrap.final || '' };
    if (d.wrap.from) s.from = d.wrap.from;
    if (d.wrap.gift) s.gift = d.wrap.gift;
    return s;
  }

  function examples() {
    var base = Date.now() - 4 * 24 * 3600 * 1000;
    var mk = function (h, blocks) { return { id: newId() + h, at: new Date(base + h * 3600 * 1000).toISOString(), updated: Date.now(), blocks: blocks }; };
    return [
      mk(1, [{ type: 'text', text: 'I think flowers would be nice.' }]),
      mk(4, [{ type: 'text', text: "Are roses too much? That's practically a marriage proposal." }]),
      mk(9, [{ type: 'text', text: 'Should I just text her instead? No. Maybe.' }]),
      mk(16, [{ type: 'text', text: 'Asked three friends. Got four answers.' }]),
      mk(20, [{ type: 'text', text: 'Made a list. It did not help.' }, UBStory.SAMPLE.thoughts[3].blocks[1]]),
      mk(30, [{ type: 'text', text: "Drew the flowers so I'd remember which ones. Forgot to write down which ones." }, { type: 'drawing', asset: 'demo-flowers', alt: 'A quick sketch of five pink flowers on long stems, gathered at the bottom like a small bunch.' }]),
      mk(40, [{ type: 'text', text: 'Saw a cat staring at a closed gate for ten minutes. Same, honestly.' }, { type: 'drawing', asset: 'demo-cat', alt: 'Just a cat like me, don\'t know what to do.' }]),
      mk(52, [{ type: 'text', text: 'Is it weird that I remember what colour she likes? It is fine. People remember things.' }]),
      mk(70, [{ type: 'text', text: 'Bought the flowers.' }])
    ];
  }

  window.UBDraft = {
    load: load, save: save, onSave: onSave, newId: newId, find: find, isShared: isShared,
    sharedBlocks: sharedBlocks, localMedia: localMedia, buildStory: buildStory, examples: examples
  };
})();
