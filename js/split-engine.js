/**
 * Group Pay Split Bill — pure calculation engine (no DOM).
 * All amounts in cents to avoid float errors.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.SplitEngine = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = 1;

  function toCents(value) {
    if (value === null || value === undefined || value === '') return 0;
    const n = typeof value === 'number' ? value : parseFloat(String(value).replace(/,/g, ''));
    if (!Number.isFinite(n) || n < 0) return NaN;
    return Math.round(n * 100);
  }

  function fromCents(cents) {
    return Math.round(cents) / 100;
  }

  function uid(prefix) {
    return prefix + '_' + Math.random().toString(36).slice(2, 10);
  }

  function emptyState() {
    return {
      v: VERSION,
      billTotalCents: 0,
      payers: [],
      splits: [],
    };
  }

  function parseNames(raw) {
    return String(raw || '')
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function initPayers(names) {
    return names.map((name, i) => ({
      id: 'p' + i,
      name,
      items: [],
    }));
  }

  /**
   * Split full amount across N participants with remainder to first shares.
   */
  function divideAmount(fullCents, count) {
    if (count < 1) return [];
    const base = Math.floor(fullCents / count);
    let remainder = fullCents - base * count;
    const shares = [];
    for (let i = 0; i < count; i++) {
      shares.push(base + (remainder > 0 ? 1 : 0));
      if (remainder > 0) remainder--;
    }
    return shares;
  }

  function createSplit(state, payerId, name, fullCents, partnerIds) {
    const payer = state.payers.find((p) => p.id === payerId);
    if (!payer) throw new Error('Payer not found');

    const participants = [payerId, ...partnerIds.filter((id) => id !== payerId)];
    const unique = [...new Set(participants)];
    if (unique.length < 2) throw new Error('Split requires at least 2 people');

    for (const id of unique) {
      if (!state.payers.some((p) => p.id === id)) throw new Error('Invalid split partner');
    }

    const splitId = uid('split');
    const shares = divideAmount(fullCents, unique.length);
    const split = {
      id: splitId,
      name: name.trim(),
      fullCents,
      participants: unique,
      createdBy: payerId,
    };

    payer.items.push({
      id: uid('item'),
      name: name.trim(),
      cents: shares[0],
      splitId,
      isSplit: true,
      editable: true,
    });

    for (let i = 1; i < unique.length; i++) {
      const target = state.payers.find((p) => p.id === unique[i]);
      if (target) {
        target.items.push({
          id: uid('item'),
          name: name.trim(),
          cents: shares[i],
          splitId,
          isSplit: true,
          editable: false,
          autoAdded: true,
        });
      }
    }

    state.splits.push(split);
    return state;
  }

  function addItem(state, payerId, name, cents, splitPartnerIds) {
    const fullCents = toCents(cents);
    if (!name || !name.trim()) throw new Error('Item name required');
    if (!Number.isFinite(fullCents) || fullCents <= 0) throw new Error('Invalid amount');

    if (splitPartnerIds && splitPartnerIds.length > 0) {
      return createSplit(state, payerId, name, fullCents, splitPartnerIds);
    }

    const payer = state.payers.find((p) => p.id === payerId);
    if (!payer) throw new Error('Payer not found');

    payer.items.push({
      id: uid('item'),
      name: name.trim(),
      cents: fullCents,
      splitId: null,
      isSplit: false,
      editable: true,
    });
    return state;
  }

  function removeItem(state, payerId, itemId) {
    const payer = state.payers.find((p) => p.id === payerId);
    if (!payer) return state;

    const item = payer.items.find((i) => i.id === itemId);
    if (!item) return state;

    if (item.splitId) {
      const splitId = item.splitId;
      state.payers.forEach((p) => {
        p.items = p.items.filter((i) => i.splitId !== splitId);
      });
      state.splits = state.splits.filter((s) => s.id !== splitId);
    } else {
      payer.items = payer.items.filter((i) => i.id !== itemId);
    }
    return state;
  }

  function payerTotalCents(payer) {
    return payer.items.reduce((sum, item) => sum + (item.cents || 0), 0);
  }

  function computeTotals(state) {
    const perPayer = state.payers.map((p) => ({
      id: p.id,
      name: p.name,
      cents: payerTotalCents(p),
    }));
    const assigned = perPayer.reduce((s, p) => s + p.cents, 0);
    const diff = state.billTotalCents - assigned;
    return {
      perPayer,
      assignedCents: assigned,
      billTotalCents: state.billTotalCents,
      diffCents: diff,
      balanced: diff === 0,
    };
  }

  function validateState(state) {
    const errors = [];
    if (!state.billTotalCents || state.billTotalCents <= 0) {
      errors.push('Bill total must be greater than zero');
    }
    if (!state.payers.length) {
      errors.push('Add at least one payer');
    }
    state.payers.forEach((p) => {
      p.items.forEach((item) => {
        if (item.splitId) {
          const split = state.splits.find((s) => s.id === item.splitId);
          if (split) {
            const sumShares = state.payers
              .flatMap((pp) => pp.items)
              .filter((i) => i.splitId === item.splitId)
              .reduce((s, i) => s + i.cents, 0);
            if (sumShares !== split.fullCents) {
              errors.push('Split "' + split.name + '" shares do not match full amount');
            }
          }
        }
      });
    });
    return errors;
  }

  function exportBackup(state) {
    return {
      format: 'group-pay-split-bill',
      version: VERSION,
      exportedAt: new Date().toISOString(),
      data: state,
    };
  }

  function importBackup(json) {
    const obj = typeof json === 'string' ? JSON.parse(json) : json;
    if (!obj || obj.format !== 'group-pay-split-bill') {
      throw new Error('Invalid backup file');
    }
    const data = obj.data || obj;
    if (!data.payers || !Array.isArray(data.payers)) {
      throw new Error('Corrupt backup: missing payers');
    }
    return {
      v: data.v || VERSION,
      billTotalCents: data.billTotalCents || 0,
      payers: data.payers,
      splits: data.splits || [],
    };
  }

  function encodeStateUrl(state) {
    try {
      const json = JSON.stringify(state);
      return btoa(unescape(encodeURIComponent(json)));
    } catch {
      return '';
    }
  }

  function decodeStateUrl(encoded) {
    try {
      const json = decodeURIComponent(escape(atob(encoded)));
      const parsed = JSON.parse(json);
      if (parsed.payers) return parsed;
      return importBackup(parsed);
    } catch {
      return null;
    }
  }

  return {
    VERSION,
    toCents,
    fromCents,
    emptyState,
    parseNames,
    initPayers,
    addItem,
    removeItem,
    payerTotalCents,
    computeTotals,
    validateState,
    exportBackup,
    importBackup,
    encodeStateUrl,
    decodeStateUrl,
    divideAmount,
  };
});
