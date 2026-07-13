/**
 * G-LAND v2.8.0-rev5 - Loading Overlay UI
 * =========================================
 * 全画面ローディング（くるくる回るスピナー）を表示する軽量モジュール。
 *
 * 提供API (window.glLoading):
 *   - show(message, options): ローディング開始
 *   - hide(): ローディング終了
 *   - update(message): メッセージ更新
 *
 * options:
 *   - showCancelAfter: number  ← N秒後にキャンセルボタンを表示
 *   - onCancel: function       ← キャンセルボタン押下時のコールバック
 */
(function () {
  'use strict';

  let overlayEl = null;
  let messageEl = null;
  let cancelBtnEl = null;
  let timeoutId = null;
  let cancelCallback = null;
  let slowMessageTimeoutId = null;

  function _injectStyles() {
    if (document.getElementById('gl-loading-styles')) return;
    const style = document.createElement('style');
    style.id = 'gl-loading-styles';
    style.textContent = `
      #gl-loading-overlay {
        position: fixed; inset: 0; z-index: 9999;
        background: rgba(255, 255, 255, 0.92);
        display: none;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        backdrop-filter: blur(3px);
        -webkit-backdrop-filter: blur(3px);
      }
      #gl-loading-overlay.show { display: flex; }
      .gl-loading__spinner {
        width: 60px; height: 60px;
        border: 5px solid #e0e0e0;
        border-top-color: #1a5f3f;
        border-radius: 50%;
        animation: gl-loading-spin 0.9s linear infinite;
      }
      @keyframes gl-loading-spin {
        0%   { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      .gl-loading__message {
        margin-top: 20px;
        font-size: 15px;
        color: #333;
        font-weight: 600;
        text-align: center;
        line-height: 1.5;
        max-width: 300px;
      }
      .gl-loading__sub {
        margin-top: 8px;
        font-size: 12px;
        color: #999;
        text-align: center;
        line-height: 1.4;
        max-width: 300px;
      }
      .gl-loading__cancel {
        margin-top: 24px;
        padding: 10px 24px;
        background: #fff;
        color: #666;
        border: 1px solid #ccc;
        border-radius: 8px;
        font-size: 13px;
        cursor: pointer;
        display: none;
      }
      .gl-loading__cancel.show { display: inline-block; }
      .gl-loading__cancel:active { background: #f0f0f0; }
    `;
    document.head.appendChild(style);
  }

  function _ensureEl() {
    _injectStyles();
    if (overlayEl) return;

    overlayEl = document.createElement('div');
    overlayEl.id = 'gl-loading-overlay';
    overlayEl.innerHTML = `
      <div class="gl-loading__spinner"></div>
      <div class="gl-loading__message" id="gl-loading-message">読み込み中...</div>
      <div class="gl-loading__sub" id="gl-loading-sub"></div>
      <button class="gl-loading__cancel" id="gl-loading-cancel" type="button">キャンセル</button>
    `;
    document.body.appendChild(overlayEl);

    messageEl = document.getElementById('gl-loading-message');
    cancelBtnEl = document.getElementById('gl-loading-cancel');

    cancelBtnEl.addEventListener('click', () => {
      if (cancelCallback) {
        try { cancelCallback(); } catch (e) { console.error(e); }
      }
      glLoading.hide();
    });
  }

  const glLoading = {
    /**
     * ローディング開始
     * @param {string} message - メイン表示メッセージ
     * @param {Object} options - {showCancelAfter, onCancel}
     */
    show(message, options) {
      _ensureEl();
      options = options || {};

      messageEl.textContent = message || '読み込み中...';
      document.getElementById('gl-loading-sub').textContent = '';
      cancelBtnEl.classList.remove('show');
      cancelCallback = null;

      // タイマー系リセット
      if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }
      if (slowMessageTimeoutId) { clearTimeout(slowMessageTimeoutId); slowMessageTimeoutId = null; }

      // 3秒以上かかったら「少しお待ちください」を追加表示
      slowMessageTimeoutId = setTimeout(() => {
        const sub = document.getElementById('gl-loading-sub');
        if (sub) sub.textContent = '少しお待ちください...';
      }, 3000);

      // N秒後にキャンセルボタン表示
      const showCancelAfter = options.showCancelAfter || 7000;
      if (options.onCancel || options.showCancelAfter) {
        cancelCallback = options.onCancel || null;
        timeoutId = setTimeout(() => {
          const sub = document.getElementById('gl-loading-sub');
          if (sub) sub.textContent = '時間がかかっています。電波の良い場所でお試しください。';
          cancelBtnEl.classList.add('show');
        }, showCancelAfter);
      }

      overlayEl.classList.add('show');
    },

    /**
     * メッセージ更新
     */
    update(message) {
      if (messageEl && message) messageEl.textContent = message;
    },

    /**
     * ローディング終了
     */
    hide() {
      if (overlayEl) overlayEl.classList.remove('show');
      if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }
      if (slowMessageTimeoutId) { clearTimeout(slowMessageTimeoutId); slowMessageTimeoutId = null; }
      cancelCallback = null;
    },

    /**
     * 現在表示中か
     */
    isShown() {
      return overlayEl && overlayEl.classList.contains('show');
    },

    /**
     * async 関数をローディング付きで実行するヘルパー
     * @example await glLoading.wrap(async () => { await api.save(); }, '保存中...');
     */
    async wrap(asyncFn, message, options) {
      this.show(message, options);
      try {
        return await asyncFn();
      } finally {
        this.hide();
      }
    },
  };

  window.glLoading = glLoading;
})();
