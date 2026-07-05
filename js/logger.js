/**
 * Intrusive client-side debug logger — stored separately in localStorage.
 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'gps_debug_logs';
  const MAX_ENTRIES = 500;

  function load() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  }

  function save(entries) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
    } catch (_) { /* quota */ }
  }

  function log(level, area, message, data) {
    const entry = {
      t: new Date().toISOString(),
      level,
      area,
      message,
      data: data !== undefined ? JSON.parse(JSON.stringify(data)) : undefined,
    };
    const entries = load();
    entries.push(entry);
    save(entries);
    if (level === 'error') {
      console.error('[GPS]', area, message, data);
    } else if (level === 'warn') {
      console.warn('[GPS]', area, message, data);
    } else {
      console.log('[GPS]', area, message, data);
    }
    return entry;
  }

  const GPSLogger = {
    debug: (area, msg, data) => log('debug', area, msg, data),
    info: (area, msg, data) => log('info', area, msg, data),
    warn: (area, msg, data) => log('warn', area, msg, data),
    error: (area, msg, data) => log('error', area, msg, data),
    getAll: load,
    clear: () => {
      localStorage.removeItem(STORAGE_KEY);
    },
    export: () => ({
      format: 'group-pay-split-bill-logs',
      exportedAt: new Date().toISOString(),
      entries: load(),
    }),
  };

  global.GPSLogger = GPSLogger;
})(typeof window !== 'undefined' ? window : globalThis);
