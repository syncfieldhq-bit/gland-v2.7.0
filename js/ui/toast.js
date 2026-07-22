/**
 * G-LAND v2.7.0 - Toast Notification & Offline Badge
 * ==================================================
 * alert() の完全代替。音は絶対に鳴らさない（ゴルフマナー配慮）。
 * error時のみ短振動 navigator.vibrate(200)。
 *
 * 使用例:
 *   glToast.info('メッセージ')
 *   glToast.success('保存しました')
 *   glToast.warn('やり直してください')
 *   glToast.error('エラーが発生しました')
 */
(function () {
  'use strict';

  const DEFAULT_DURATION_MS = 3000;
  const ERROR_DURATION_MS = 5000;
  const DEDUP_MS = 2000; // 同じメッセージは2秒内は重複させない

  let toastRoot = null;
  let offlineBadge = null;
  const recentMessages = new Map(); // msg -> timestamp

  function _injectStyles() {
    // v3.0.0: CSS は css/*.css に完全移管済み。互換のため関数は残置（no-op）。
    return;
  }

  function _ensureRoot() {
    if (toastRoot && document.body.contains(toastRoot)) return toastRoot;
    _injectStyles();
    toastRoot = document.getElementById('gl-toast-root');
    if (!toastRoot) {
      toastRoot = document.createElement('div');
      toastRoot.id = 'gl-toast-root';
      document.body.appendChild(toastRoot);
    }
    return toastRoot;
  }

  function _ensureBadge() {
    if (offlineBadge && document.body.contains(offlineBadge)) return offlineBadge;
    _injectStyles();
    offlineBadge = document.getElementById('gl-offline-badge');
    if (!offlineBadge) {
      offlineBadge = document.createElement('div');
      offlineBadge.id = 'gl-offline-badge';
      offlineBadge.textContent = '⚠ オフライン';
      document.body.appendChild(offlineBadge);
    }
    return offlineBadge;
  }

  function _show(msg, variant, durationMs) {
    if (!msg) return;

    // ★ v2.7.15：重複メッセージの連発を防ぐ
    const key = variant + '::' + msg;
    const now = Date.now();
    const lastTime = recentMessages.get(key);
    if (lastTime && now - lastTime < DEDUP_MS) {
      return; // 短時間に同じメッセージが来たら無視
    }
    recentMessages.set(key, now);
    // 古いエントリを掎除（メモリリーク回避）
    if (recentMessages.size > 50) {
      const cutoff = now - DEDUP_MS;
      for (const [k, t] of recentMessages) {
        if (t < cutoff) recentMessages.delete(k);
      }
    }

    const root = _ensureRoot();
    const el = document.createElement('div');
    el.className = `gl-toast gl-toast--${variant}`;
    el.textContent = msg;
    root.appendChild(el);

    // 振動（errorのみ）
    if (variant === 'error' && navigator.vibrate) {
      try {
        navigator.vibrate(200);
      } catch (e) {
        /* ignore */
      }
    }

    const duration = durationMs || (variant === 'error' ? ERROR_DURATION_MS : DEFAULT_DURATION_MS);
    setTimeout(() => {
      el.classList.add('gl-toast--fadeout');
      setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 350);
    }, duration);
  }

  const glToast = {
    info(msg) {
      _show(msg, 'info');
    },
    success(msg) {
      _show(msg, 'success');
    },
    warn(msg) {
      _show(msg, 'warn');
    },
    error(msg) {
      _show(msg, 'error');
    },

    offline() {
      const b = _ensureBadge();
      b.classList.add('show');
    },
    online() {
      const b = _ensureBadge();
      b.classList.remove('show');
    },

    /**
     * boot.js から一度だけ呼ぶ
     */
    _init() {
      _ensureRoot();
      _ensureBadge();

      // オンライン状態を監視してバッジ表示制御
      if (window.glEvents) {
        window.glEvents.on('online:changed', (isOnline) => {
          if (isOnline) {
            this.online();
            this.success('オンラインに復帰しました');
          } else {
            this.offline();
          }
        });
      }
      // 初期状態
      if (!navigator.onLine) this.offline();
    },
  };

  window.glToast = glToast;
})();
