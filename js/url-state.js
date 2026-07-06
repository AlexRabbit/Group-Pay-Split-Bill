/**
 * Compact URL state v2 — strip IDs, LZ-String, minimal payload.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.GPSUrlState = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  let idCounter = 0;
  function nextId(prefix) {
    idCounter += 1;
    return prefix + idCounter;
  }

  function resetIds() {
    idCounter = 0;
  }

  /** v2: no random IDs — names + cents only */
  function compact(state) {
    const payerIdx = {};
    state.payers.forEach((p, i) => {
      payerIdx[p.id] = i;
    });
    const splitIdx = {};
    (state.splits || []).forEach((s, i) => {
      splitIdx[s.id] = i;
    });

    return [
      2,
      state.billTotalCents || 0,
      state.payers.map((p) => [
        p.name,
        (p.items || []).map((it) => {
          const row = [it.name, it.cents];
          if (it.splitId != null && splitIdx[it.splitId] !== undefined) row.push(splitIdx[it.splitId]);
          const flags = (it.isSplit ? 1 : 0) | (it.autoAdded ? 2 : 0) | (it.editable === false ? 4 : 0);
          if (flags) row.push(flags);
          return row;
        }),
      ]),
      (state.splits || []).map((s) => [
        s.name,
        s.fullCents,
        s.participants.map((pid) => payerIdx[pid]),
        payerIdx[s.createdBy],
      ]),
    ];
  }

  function expandV1(raw) {
    const [v, billTotalCents, payersRaw, splitsRaw] = raw;
    const payers = (payersRaw || []).map((p) => ({
      id: p[0],
      name: p[1],
      items: (p[2] || []).map((row) => {
        const item = {
          id: row[0],
          name: row[1],
          cents: row[2],
          splitId: row[3] || null,
          isSplit: false,
          editable: true,
        };
        const flags = row[4] || 0;
        if (flags & 1) item.isSplit = true;
        if (flags & 2) item.autoAdded = true;
        if (flags & 4) item.editable = false;
        return item;
      }),
    }));
    const splits = (splitsRaw || []).map((s) => ({
      id: s[0],
      name: s[1],
      fullCents: s[2],
      participants: s[3],
      createdBy: s[4],
    }));
    return { v: v || 1, billTotalCents, payers, splits };
  }

  function expandV2(raw) {
    resetIds();
    const [, billTotalCents, payersRaw, splitsRaw] = raw;
    const payers = (payersRaw || []).map((p, pi) => ({
      id: 'p' + pi,
      name: p[0],
      items: [],
    }));

    const splits = (splitsRaw || []).map((s, si) => ({
      id: 'split_' + si,
      name: s[0],
      fullCents: s[1],
      participants: (s[2] || []).map((i) => 'p' + i),
      createdBy: 'p' + s[3],
    }));

    payersRaw.forEach((p, pi) => {
      (p[1] || []).forEach((row) => {
        const item = {
          id: nextId('i_'),
          name: row[0],
          cents: row[1],
          splitId: row[2] !== undefined ? 'split_' + row[2] : null,
          isSplit: false,
          editable: true,
        };
        const flags = row[3] || 0;
        if (flags & 1) item.isSplit = true;
        if (flags & 2) item.autoAdded = true;
        if (flags & 4) item.editable = false;
        payers[pi].items.push(item);
      });
    });

    return { v: 2, billTotalCents, payers, splits };
  }

  function expand(raw) {
    if (raw && raw.payers) return raw;
    if (!Array.isArray(raw) || raw.length < 3) return null;
    if (raw[0] === 2) return expandV2(raw);
    return expandV1(raw);
  }

  function encode(state, LZ) {
    const payload = JSON.stringify(compact(state));
    if (LZ && LZ.compressToBase64) {
      return 'b:' + LZ.compressToBase64(payload);
    }
    if (LZ && LZ.compressToEncodedURIComponent) {
      return 'z:' + LZ.compressToEncodedURIComponent(payload);
    }
    return 's:' + btoa(unescape(encodeURIComponent(payload)));
  }

  function decode(token, LZ) {
    if (!token) return null;
    try {
      let json;
      if (token.startsWith('b:')) {
        const body = token.slice(2);
        if (!LZ || !LZ.decompressFromBase64) return null;
        json = LZ.decompressFromBase64(body);
      } else if (token.startsWith('z:')) {
        const body = token.slice(2);
        if (!LZ || !LZ.decompressFromEncodedURIComponent) return null;
        json = LZ.decompressFromEncodedURIComponent(body);
      } else if (token.startsWith('s:')) {
        json = decodeURIComponent(escape(atob(token.slice(2))));
      } else {
        json = decodeURIComponent(escape(atob(token)));
      }
      if (!json) return null;
      const parsed = JSON.parse(json);
      if (Array.isArray(parsed)) return expand(parsed);
      if (parsed.payers) return parsed;
      if (parsed.data) return expand(parsed.data) || parsed.data;
      return null;
    } catch {
      return null;
    }
  }

  function buildUrl(pathname, lang, hashToken) {
    const params = new URLSearchParams();
    if (lang && lang !== 'en') params.set('lang', lang);
    const qs = params.toString();
    return pathname + (qs ? '?' + qs : '') + (hashToken ? '#p=' + encodeURIComponent(hashToken) : '');
  }

  function parseHash(hash) {
    const h = (hash || '').replace(/^#/, '');
    if (!h) return null;
    const m = h.match(/^(?:p|d|s)=(.+)$/);
    if (m) {
      const body = decodeURIComponent(m[1]);
      if (body.startsWith('b:') || body.startsWith('z:') || body.startsWith('s:')) return body;
      return 's:' + body;
    }
    if (h.startsWith('b:') || h.startsWith('z:') || h.startsWith('s:')) return h;
    return null;
  }

  return { compact, expand, encode, decode, buildUrl, parseHash };
});
