/**
 * G-LAND v2.7.0 - Network Layer
 * =============================
 * オンライン監視 + タイムアウト付きfetch。
 * オンライン/オフライン切替時に 'online:changed' イベントを発火。
 */
(function () {
  'use strict';

  const DEFAULT_TIMEOUT = 12000; // 12秒

  const glNet = {
    isOnline() {
      return navigator.onLine;
    },

    /**
     * オンライン状態変更を購読
     */
    onStatusChange(cb) {
      if (!window.glEvents) return () => {};
      return window.glEvents.on('online:changed', cb);
    },

    /**
     * タイムアウト付き fetch
     * @param {string} url
     * @param {RequestInit} opts
     * @param {number} timeoutMs
     * @returns {Promise<Response>}
     */
    async fetchWithTimeout(url, opts = {}, timeoutMs = DEFAULT_TIMEOUT) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, { ...opts, signal: controller.signal });
        return res;
      } catch (err) {
        if (err.name === 'AbortError') {
          const e = new Error('TIMEOUT');
          e.code = 'N2';
          e.timeoutMs = timeoutMs;
          throw e;
        }
        const e = new Error(err.message || 'NETWORK_ERROR');
        e.code = 'N1';
        e.original = err;
        throw e;
      } finally {
        clearTimeout(timer);
      }
    },

    /**
     * 内部初期化（boot.js から一度だけ呼ぶ）
     */
    _init() {
      const handler = (isOnline) => {
        if (window.glState) window.glState.set('online', isOnline);
        if (window.glEvents) window.glEvents.emit('online:changed', isOnline);
      };
      window.addEventListener('online', () => handler(true));
      window.addEventListener('offline', () => handler(false));
    },
  };

  window.glNet = glNet;
})();
