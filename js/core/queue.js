/**
 * G-LAND v2.7.0 - Persistent Retry Queue
 * ======================================
 * オフライン中のスコア送信等を localStorage に永続化。
 * オンライン復帰時に自動flush + 指数バックオフでリトライ。
 *
 * ペイロード形式:
 *   { id, type, payload, retryCount, createdAt, lastAttemptAt, nextAttemptAt }
 */
(function () {
  'use strict';

  const QUEUE_KEY = 'gl_score_queue_v1';
  const MAX_RETRY = 8;
  const BACKOFF_MS = [2000, 4000, 8000, 16000, 30000, 30000, 30000, 30000];
  const FLUSH_INTERVAL_MS = 5000; // 5秒ごとに未送信をチェック

  let flushTimer = null;
  let isFlushing = false;

  function _now() {
    return Date.now();
  }

  function _uid() {
    return 'q-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 8);
  }

  function _load() {
    if (!window.glStorage) return [];
    const arr = window.glStorage.readLocalJSON(QUEUE_KEY);
    return Array.isArray(arr) ? arr : [];
  }

  function _save(arr) {
    if (!window.glStorage) return;
    window.glStorage.writeLocal(QUEUE_KEY, arr);
  }

  /**
   * ペイロードを実際にAPIへ送信する処理
   * type毎にディスパッチ
   */
  async function _dispatch(item) {
    const api = window.glandApi;
    if (!api) throw new Error('glandApi not ready');

    switch (item.type) {
      case 'saveScore':
        return await api.saveScore(item.payload);
      case 'updateUser':
        return await api.updateUser(item.payload);
      default:
        console.warn('[glQueue] unknown type:', item.type);
        return null;
    }
  }

  const glQueue = {
    /**
     * キューに投入
     */
    enqueue(type, payload) {
      const arr = _load();
      const item = {
        id: _uid(),
        type,
        payload,
        retryCount: 0,
        createdAt: _now(),
        lastAttemptAt: 0,
        nextAttemptAt: _now(),
      };
      arr.push(item);
      _save(arr);

      if (window.glEvents) {
        window.glEvents.emit('score:queued', { id: item.id, type, size: arr.length });
      }

      // 即座にflushトライ
      this.flush();
      return item.id;
    },

    /**
     * キューをフラッシュ（順次送信）
     */
    async flush() {
      if (isFlushing) return;
      if (!navigator.onLine) return;
      if (!window.glandApi) return;

      isFlushing = true;
      try {
        let arr = _load();
        const now = _now();
        const remaining = [];

        for (const item of arr) {
          // 待機時間中はスキップ
          if (item.nextAttemptAt > now) {
            remaining.push(item);
            continue;
          }
          // リトライ上限超過は破棄
          if (item.retryCount >= MAX_RETRY) {
            console.warn('[glQueue] dropping item after max retries:', item);
            if (window.glEvents) {
              window.glEvents.emit('queue:dropped', item);
            }
            continue;
          }

          try {
            await _dispatch(item);
            // 成功
            if (window.glEvents) {
              window.glEvents.emit('score:saved', { id: item.id, type: item.type, fromQueue: true });
            }
          } catch (err) {
            // 失敗 → リトライ待機
            item.retryCount += 1;
            item.lastAttemptAt = now;
            const backoff = BACKOFF_MS[Math.min(item.retryCount - 1, BACKOFF_MS.length - 1)];
            item.nextAttemptAt = now + backoff;
            remaining.push(item);
            console.warn(`[glQueue] retry ${item.retryCount}/${MAX_RETRY} in ${backoff}ms:`, err);
          }
        }

        _save(remaining);

        if (remaining.length === 0 && window.glEvents) {
          window.glEvents.emit('score:flushed', { size: 0 });
        }
      } finally {
        isFlushing = false;
      }
    },

    /**
     * 現在のキューサイズ
     */
    size() {
      return _load().length;
    },

    /**
     * キューの中身（デバッグ用）
     */
    peek() {
      return _load();
    },

    /**
     * キューをクリア（緊急用）
     */
    clear() {
      _save([]);
    },

    /**
     * オンライン復帰時の自動flush
     */
    onOnline() {
      this.flush();
    },

    /**
     * 定期flush開始（boot.js から呼ぶ）
     */
    _startAutoFlush() {
      if (flushTimer) return;
      flushTimer = setInterval(() => {
        if (navigator.onLine && this.size() > 0) {
          this.flush();
        }
      }, FLUSH_INTERVAL_MS);

      // オンライン復帰時にも即flush
      if (window.glEvents) {
        window.glEvents.on('online:changed', (isOnline) => {
          if (isOnline) this.flush();
        });
      }
    },

    _stopAutoFlush() {
      if (flushTimer) {
        clearInterval(flushTimer);
        flushTimer = null;
      }
    },
  };

  window.glQueue = glQueue;
})();
