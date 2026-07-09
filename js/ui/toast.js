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

  let toastRoot = null;
  let offlineBadge = null;

  function _injectStyles() {
    if (document.getElementById('gl-toast-styles')) return;
    const style = document.createElement('style');
    style.id = 'gl-toast-styles';
    style.textContent = `
      #gl-toast-root {
        position: fixed;
        top: 16px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 99999;
        display: flex;
        flex-direction: column;
        gap: 8px;
        pointer-events: none;
        width: min(92vw, 480px);
      }
      .gl-toast {
        background: #fff;
        color: #222;
        padding: 14px 18px;
        border-radius: 10px;
        box-shadow: 0 6px 20px rgba(0,0,0,0.18);
        font-size: 15px;
        line-height: 1.4;
        border-left: 5px solid #2196f3;
        pointer-events: auto;
        animation: gl-toast-in 0.25s ease-out;
        word-break: break-word;
      }
      .gl-toast--info { border-left-color: #2196f3; }
      .gl-toast--success { border-left-color: #4caf50; }
      .gl-toast--warn { border-left-color: #ff9800; background: #fff8e1; }
      .gl-toast--error { border-left-color: #f44336; background: #ffebee; }
      .gl-toast--fadeout { animation: gl-toast-out 0.3s ease-in forwards; }
      @keyframes gl-toast-in {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes gl-toast-out {
        to { opacity: 0; transform: translateY(-10px); }
      }
      #gl-offline-badge {
        position: fixed;
        top: 12px;
        right: 12px;
        z-index: 99998;
        background: #f44336;
        color: #fff;
        padding: 6px 12px;
        border-radius: 16px;
        font-size: 12px;
        font-weight: 600;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        display: none;
      }
      #gl-offline-badge.show { display: block; }
    `;
    document.head.appendChild(style);
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
