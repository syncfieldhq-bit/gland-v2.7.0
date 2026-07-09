/**
 * G-LAND v2.7.0 - History Domain
 * ==============================
 * サーバーがマスター、localStorageはキャッシュ。
 * 起動時に一度だけ apiSyncHistory() でサーバから引き込む。
 */
(function () {
  'use strict';

  const CACHE_KEY = 'gl_history_v1';
  const LAST_SYNC_KEY = 'gl_history_last_sync_v1';

  function _readCache() {
    const arr = window.glStorage.readLocalJSON(CACHE_KEY);
    return Array.isArray(arr) ? arr : [];
  }

  function _writeCache(arr) {
    window.glStorage.writeLocal(CACHE_KEY, arr);
  }

  const glHistory = {
    /**
     * 起動時にサーバから同期（一度きり）
     */
    async syncFromServer() {
      const userId = window.glProfile.getUserId();
      if (!userId) return [];

      try {
        const result = await window.glandApi.syncHistory({ userId });
        const rounds = result?.rounds || result || [];
        if (Array.isArray(rounds)) {
          _writeCache(rounds);
          window.glStorage.writeLocal(LAST_SYNC_KEY, String(Date.now()));
          window.glEvents.emit('history:synced', { count: rounds.length });
        }
        return rounds;
      } catch (err) {
        window.glErrors.handle(err, { silent: true, context: 'history.sync' });
        return _readCache();
      }
    },

    /**
     * ラウンド完了時にローカルキャッシュへ追加
     */
    saveRound(roundData) {
      if (!roundData || !roundData.roundId) return;
      const arr = _readCache();
      const idx = arr.findIndex((r) => r.roundId === roundData.roundId);
      if (idx >= 0) {
        arr[idx] = { ...arr[idx], ...roundData };
      } else {
        arr.unshift(roundData);
      }
      _writeCache(arr);
      window.glEvents.emit('history:updated', roundData);
    },

    /**
     * 全履歴（キャッシュから即返却）
     */
    list() {
      return _readCache();
    },

    get(roundId) {
      return _readCache().find((r) => r.roundId === roundId) || null;
    },

    delete(roundId) {
      const arr = _readCache().filter((r) => r.roundId !== roundId);
      _writeCache(arr);
      window.glEvents.emit('history:deleted', { roundId });
    },

    lastSyncAt() {
      const ts = window.glStorage.readLocal(LAST_SYNC_KEY);
      return ts ? parseInt(ts, 10) : 0;
    },
  };

  window.glHistory = glHistory;
})();
