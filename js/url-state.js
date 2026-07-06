/**
 * Compact URL state — minified JSON + optional LZ-String compression.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.GPSUrlState = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /** Compact array format to shrink URLs before compression. */
  function compact(state) {
    return [
      state.v || 1,
      state.billTotalCents || 0,
      (state.payers || []).map((p) => [
        p.id,
        p.name,
        (p.items || []).map((it) => {
          const row = [it.id, it.name, it.cents];
          if (it.splitId) row.push(it.splitId);
          const flags = (it.isSplit ? 1 : 0) | (it.autoAdded ? 2 : 0) | (it.editable === false ? 4 : 0);
          if (flags) row.push(flags);
          return row;
        }),
      ]),
      (state.splits || []).map((s) => [s.id, s.name, s.fullCents, s.participants, s.createdBy]),
    ];
  }

  function expand(raw) {
    if (raw && raw.payers) return raw;
    if (!Array.isArray(raw) || raw.length < 3) return null;
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

  function encode(state, LZ) {
    const payload = JSON.stringify(compact(state));
    if (LZ && LZ.compressToEncodedURIComponent) {
      return 'z:' + LZ.compressToEncodedURIComponent(payload);
    }
    return 's:' + btoa(unescape(encodeURIComponent(payload)));
  }

  function decode(token, LZ) {
    if (!token) return null;
    try {
      let json;
      if (token.startsWith('z:')) {
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

  function buildUrl(pathname, lang, hashToken, searchParams) {
    const params = new URLSearchParams(searchParams || '');
    if (lang && lang !== 'en') params.set('lang', lang);
    else params.delete('lang');
    const qs = params.toString();
    return pathname + (qs ? '?' + qs : '') + (hashToken ? '#d=' + hashToken : '');
  }

  function parseHash(hash) {
    const h = (hash || '').replace(/^#/, '');
    if (!h) return null;
    const m = h.match(/^(?:d|s)=(.+)$/);
    if (m) {
      const body = m[1];
      if (body.startsWith('z:') || body.startsWith('s:')) return body;
      return 's:' + body;
    }
    if (h.startsWith('z:') || h.startsWith('s:')) return h;
    return null;
  }

  return { compact, expand, encode, decode, buildUrl, parseHash };
});
