/* Story model shared by every page.

   Content, narrative order and presentation are kept apart:
   {
     v: 1,
     from: "Sam",                 // optional signature
     gift: "flowers",             // optional, shown on the lock screen
     thoughts: [                  // narrative order = array order (Curate only reorders this list)
       { at: ISO time, tag?: "unrelated",
         blocks: [                // the author's content, as written
           { type: "text",    text },
           { type: "drawing", asset, alt },          // bundled with the site (assets/drawings/<asset>.png)
           { type: "image",   id, name, alt },       // the giver's own picture, kept in this browser (IndexedDB)
           { type: "file",    id | inline, name, mime }
         ],
         layout?: { ... }         // presentation hints only; content stays readable without them
       } ],
     final: "Anyway. I hope you like them."
   }

   Share links carry words only. Pictures and files the giver added stay on their computer;
   in a link they become { type: "missing", kind, label } so the recipient knows something stayed behind.
   Bundled drawings (part of the site itself) do travel, because every copy of the site has them.

   Where the Backstory page gets its story:
     #s=<code>            a share link
     ?source=preview      the giver's own preview from localStorage (pictures and files work)
     nothing              the built-in demo story
*/
(function () {
  'use strict';

  var PREVIEW_KEY = 'ub.preview.v1';
  var LIMITS = { thoughts: 30, blocks: 8, text: 600, final: 400, from: 40, gift: 40, alt: 200 };

  var SAMPLE = {
    v: 1,
    from: 'Sam',
    gift: 'flowers',
    thoughts: [
      { at: '2026-11-09T21:43:00', blocks: [{ type: 'text', text: 'I think flowers would be nice.' }] },
      { at: '2026-11-10T00:12:00', blocks: [{ type: 'text', text: "Are roses too much? That's practically a marriage proposal." }] },
      { at: '2026-11-10T13:20:00', blocks: [
        { type: 'text', text: 'Asked three friends. Got four answers.' },
        { type: 'file', name: 'what_my_friends_said.txt', mime: 'text/plain',
          inline: 'Friend 1: flowers.\nFriend 2: a book?\nFriend 3: just ask her.\nFriend 4: [sent a meme I still do not understand]' }
      ] },
      { at: '2026-11-10T15:02:00', blocks: [
        { type: 'text', text: 'Made a list. It did not help.' },
        { type: 'sheet', w: 510, h: 291, layer: 'demo-sheet', items: [],
          alt: 'A handwritten list in pencil: "gift ideas (final (4?))". 1) flowers?, with a note in yellow beside it. 2) a book? does she read? 3) nothing ????. 4) just ask her?, followed by a squiggly arrow pointing away. A small bee is doodled in the bottom corner.' }
      ] },
      { at: '2026-11-11T17:05:00', blocks: [
        { type: 'text', text: "Drew the flowers so I'd remember which ones. Forgot to write down which ones." },
        { type: 'drawing', asset: 'demo-flowers', alt: 'A quick sketch of five pink flowers on long stems, gathered at the bottom like a small bunch.' }
      ] },
      { at: '2026-11-12T13:40:00', tag: 'unrelated', blocks: [
        { type: 'text', text: 'Saw a cat staring at a closed gate for ten minutes. Same, honestly.' },
        { type: 'drawing', asset: 'demo-cat', alt: 'A photo: a thin white cat with a striped tail, seen from behind, sitting very still and staring through a closed gate.' }
      ] },
      { at: '2026-11-12T19:30:00', blocks: [{ type: 'text', text: 'Decided not to buy anything. A card is enough. Cards are mature.' }] },
      { at: '2026-11-12T23:47:00', blocks: [{ type: 'text', text: 'Bought the flowers.' }] },
      { at: '2026-11-13T08:15:00', blocks: [{ type: 'text', text: 'Yellow ones. You said once you liked yellow. I think. I hope that was you.' }] }
    ],
    final: 'Anyway. I hope you like them.'
  };

  function clip(s, n) { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n) : s; }

  function cleanBlock(b, keepFiles) {
    if (!b || typeof b !== 'object') return null;
    switch (b.type) {
      case 'text':
        return typeof b.text === 'string' && b.text.trim() ? { type: 'text', text: clip(b.text, LIMITS.text) } : null;
      case 'drawing':
        return /^[a-z0-9-]{1,40}$/.test(b.asset || '') ? { type: 'drawing', asset: b.asset, alt: clip(b.alt || '', LIMITS.alt) } : null;
      case 'image':
        if (!keepFiles) return { type: 'missing', kind: 'picture', label: clip(b.alt || b.name || '', LIMITS.alt) };
        return { type: 'image', id: String(b.id || ''), name: clip(b.name || 'picture', 80), alt: clip(b.alt || '', LIMITS.alt) };
      case 'file':
        if (typeof b.inline === 'string') return { type: 'file', name: clip(b.name || 'note.txt', 80), mime: 'text/plain', inline: clip(b.inline, 2000) };
        if (!keepFiles) return { type: 'missing', kind: 'file', label: clip(b.name || '', 80) };
        return { type: 'file', id: String(b.id || ''), name: clip(b.name || 'file', 80), mime: clip(b.mime || '', 80) };
      case 'sheet': {
        var w = Math.max(200, Math.min(1200, Math.round(Number(b.w) || 360)));
        var h = Math.max(200, Math.min(2000, Math.round(Number(b.h) || 480)));
        var num = function (v, lo, hi) { v = Number(v); return isNaN(v) ? lo : Math.max(lo, Math.min(hi, v)); };
        var items = (Array.isArray(b.items) ? b.items : []).slice(0, 24).map(function (it) {
          if (!it || typeof it.text !== 'string' || !it.text.trim()) return null;
          return { text: clip(it.text, 200), x: num(it.x, 0, w), y: num(it.y, 0, h), w: num(it.w, 20, w), size: num(it.size, 10, 120), rot: num(it.rot, -20, 20) };
        }).filter(Boolean);
        var out = { type: 'sheet', w: w, h: h, alt: clip(b.alt || '', LIMITS.alt), items: items };
        if (/^[a-z0-9-]{1,40}$/.test(b.layer || '')) out.layer = b.layer;
        return items.length || out.layer ? out : null;
      }
      case 'missing':
        return { type: 'missing', kind: b.kind === 'picture' ? 'picture' : 'file', label: clip(b.label || '', LIMITS.alt) };
      default:
        return null;
    }
  }

  /* Older drafts stored { text, attachment }; turn them into blocks. */
  function toBlocks(t) {
    if (Array.isArray(t.blocks)) return t.blocks;
    var blocks = [];
    if (t.text) blocks.push({ type: 'text', text: t.text });
    if (t.attachment) {
      var a = t.attachment, isImg = /^image\//.test(a.type || '');
      blocks.push(isImg ? { type: 'image', id: a.id, name: a.name, alt: a.alt }
                        : { type: 'file', id: a.id, name: a.name, mime: a.type, inline: a.inline });
    }
    return blocks;
  }

  /* Keep only known fields with sane sizes. Everything shown on screen goes through textContent. */
  function sanitize(raw, keepFiles) {
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.thoughts)) return null;
    var out = { v: 1, thoughts: [], final: clip(raw.final || '', LIMITS.final) };
    if (raw.from) out.from = clip(raw.from, LIMITS.from);
    if (raw.gift) out.gift = clip(raw.gift, LIMITS.gift);
    raw.thoughts.slice(0, LIMITS.thoughts).forEach(function (t) {
      if (!t || typeof t !== 'object') return;
      var blocks = toBlocks(t).slice(0, LIMITS.blocks)
        .map(function (b) { return cleanBlock(b, keepFiles); })
        .filter(Boolean);
      if (!blocks.length) return;
      var item = { blocks: blocks };
      if (t.at && !isNaN(new Date(t.at).getTime())) item.at = String(t.at);
      if (t.tag) item.tag = clip(t.tag, 20);
      out.thoughts.push(item);
    });
    return out.thoughts.length ? out : null;
  }

  /* ---- share links: base64url of UTF-8 JSON ---- */
  function toBase64Url(str) {
    var bytes = new TextEncoder().encode(str), bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function fromBase64Url(code) {
    var b64 = code.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    var bin = atob(b64), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  /* Compact form: each thought is [at, tag, [blocks]] where a block is
     ["t", text] | ["d", asset, alt] | ["m", "picture"|"file", label]. */
  function encode(story) {
    var clean = sanitize(story, false);
    var slim = { v: 1, f: clean.final, t: clean.thoughts.map(function (t) {
      return [t.at || '', t.tag || '', t.blocks.map(function (b) {
        if (b.type === 'text') return ['t', b.text];
        if (b.type === 'drawing') return ['d', b.asset, b.alt];
        if (b.type === 'missing') return ['m', b.kind, b.label];
        if (b.type === 'file' && typeof b.inline === 'string') return ['n', b.name, b.inline];
        if (b.type === 'sheet') return ['s', b.w, b.h, b.alt, b.layer || '', b.items.map(function (it) { return [it.x, it.y, it.w, it.size, it.rot, it.text]; })];
        return ['m', 'file', b.name || ''];
      })];
    }) };
    if (clean.from) slim.n = clean.from;
    if (clean.gift) slim.g = clean.gift;
    return toBase64Url(JSON.stringify(slim));
  }

  function decode(code) {
    var slim = JSON.parse(fromBase64Url(code));
    if (!slim || !Array.isArray(slim.t)) throw new Error('bad story');
    var story = sanitize({
      from: slim.n, gift: slim.g, final: slim.f,
      thoughts: slim.t.map(function (r) {
        return { at: r[0] || undefined, tag: r[1] || undefined, blocks: (r[2] || []).map(function (b) {
          if (b[0] === 't') return { type: 'text', text: b[1] };
          if (b[0] === 'd') return { type: 'drawing', asset: b[1], alt: b[2] };
          if (b[0] === 'n') return { type: 'file', name: b[1], mime: 'text/plain', inline: b[2] };
          if (b[0] === 's') return { type: 'sheet', w: b[1], h: b[2], alt: b[3], layer: b[4] || undefined,
            items: (b[5] || []).map(function (it) { return { x: it[0], y: it[1], w: it[2], size: it[3], rot: it[4], text: it[5] }; }) };
          return { type: 'missing', kind: b[1], label: b[2] };
        }) };
      })
    }, false);
    if (!story) throw new Error('empty story');
    return story;
  }

  function savePreview(story) {
    try { localStorage.setItem(PREVIEW_KEY, JSON.stringify(story)); return true; }
    catch (e) { return false; }
  }

  /* Returns { story, source: 'link' | 'preview' | 'demo', problem? } */
  function load() {
    var m = (location.hash || '').match(/[#&]s=([A-Za-z0-9_-]+)/);
    if (m) {
      try { return { story: decode(m[1]), source: 'link' }; }
      catch (e) { return { story: sanitize(SAMPLE, true), source: 'demo', problem: 'This link looks damaged, so the demo story is shown instead.' }; }
    }
    if (/[?&]source=preview\b/.test(location.search)) {
      try {
        var saved = sanitize(JSON.parse(localStorage.getItem(PREVIEW_KEY) || 'null'), true);
        if (saved) return { story: saved, source: 'preview' };
      } catch (e) { /* fall through */ }
      return { story: sanitize(SAMPLE, true), source: 'demo', problem: 'No preview was found in this browser, so the demo story is shown instead.' };
    }
    return { story: sanitize(SAMPLE, true), source: 'demo' };
  }

  /* Helpers for display */
  function firstText(t) {
    for (var i = 0; i < t.blocks.length; i++) if (t.blocks[i].type === 'text') return t.blocks[i].text;
    var d = t.blocks[0];
    return d.alt || d.label || d.name || '';
  }
  function extras(t) {
    var seenText = false, out = [];
    t.blocks.forEach(function (b) {
      if (b.type === 'text' && !seenText) { seenText = true; return; }
      var word = b.type === 'text' ? 'more' : b.type === 'drawing' ? (/^a photo\b/i.test(b.alt || '') ? 'photo' : 'drawing') : b.type === 'sheet' ? 'handwritten page' : b.type === 'image' ? 'picture'
        : b.type === 'missing' ? (b.kind === 'picture' ? 'picture' : 'file')
        : (b.inline !== undefined || /^text\//.test(b.mime || '') ? 'note' : 'file');
      if (out.indexOf(word) < 0) out.push(word);
    });
    return out;
  }
  function stamp(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-GB', { weekday: 'short' }) + ' ' +
           d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }
  function dayName(iso) {
    var d = new Date(iso);
    return isNaN(d.getTime()) ? 'Earlier' : d.toLocaleDateString('en-GB', { weekday: 'long' });
  }

  window.UBStory = {
    SAMPLE: SAMPLE, LIMITS: LIMITS, PREVIEW_KEY: PREVIEW_KEY,
    sanitize: sanitize, encode: encode, decode: decode, savePreview: savePreview, load: load,
    firstText: firstText, extras: extras, stamp: stamp, dayName: dayName
  };
})();
