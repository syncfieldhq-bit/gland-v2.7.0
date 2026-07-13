/**
 * G-LAND v2.7.10 - Score Input Panel (共通モジュール)
 * ====================================================
 * 3テーマ (Classic / Simple / Counter) で共通利用する入力パネル。
 *
 * 【設計原則】
 * - アニメーション/トランジション一切なし
 * - CSS変数や祖先要素のtransformの影響を受けない
 * - position: fixed + z-index: 十分大きい値で貼り付けるだけ
 * - display: block ↔ display: none の単純切替
 * - 各テーマは「何を表示するか」の HTML と、各種コールバックだけを渡す
 *
 * 【使い方】
 *   glScorePanel.open({
 *     content: '<div>...</div>',   // パネル内部の HTML
 *     onBind: (panelEl) => {...},  // レンダ後のイベントバインド
 *     onClose: () => {...},        // 閉じられたときに呼ばれる（キャンセル/背景タップ）
 *   });
 *
 *   glScorePanel.rerender(newContent, onBind); // 中身を差し替え（session進行時）
 *   glScorePanel.close();                       // 明示的に閉じる
 *
 * 【重要】このモジュールは DOM の生成/破棄だけを担当。ロジックは各テーマ側で持つ。
 */
(function () {
  'use strict';

  const OVERLAY_ID = 'gl-panel-overlay';
  const PANEL_ID = 'gl-panel-root';
  const STYLE_ID = 'gl-panel-styles';

  let _onCloseCallback = null;

  function _injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    // ★ ここが根本解決の核心：
    //   - transform / transition / will-change を一切使わない
    //   - position: fixed で bottom:0 / left:0 / right:0 に固定
    //   - display の切替だけで表示/非表示
    //   - z-index は十分高く（他モーダルよりも高くしない = 9500）
    style.textContent = `
      #${OVERLAY_ID} {
        display: none;
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0, 0, 0, 0.4);
        z-index: 9500;
      }
      #${OVERLAY_ID}.gl-panel-open { display: block; }

      #${PANEL_ID} {
        display: none;
        position: fixed;
        left: 0; right: 0; bottom: 0;
        background: #ffffff;
        border-radius: 16px 16px 0 0;
        box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.2);
        z-index: 9600;
        max-height: 80vh;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        padding: 16px 16px calc(env(safe-area-inset-bottom, 0px) + 20px);
        box-sizing: border-box;
      }
      #${PANEL_ID}.gl-panel-open { display: block; }
    `;
    document.head.appendChild(style);
  }

  function _ensureDom() {
    _injectStyles();

    let overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = OVERLAY_ID;
      // 背景タップで閉じる
      overlay.addEventListener('click', () => {
        glScorePanel.close();
      });
      document.body.appendChild(overlay);
    }

    let panel = document.getElementById(PANEL_ID);
    if (!panel) {
      panel = document.createElement('div');
      panel.id = PANEL_ID;
      document.body.appendChild(panel);
    }

    return { overlay, panel };
  }

  const glScorePanel = {
    /**
     * パネルを開く
     * @param {Object} opts
     * @param {string} opts.content - パネル内部の HTML
     * @param {Function} [opts.onBind] - レンダ後に呼ばれる（panelEl を受け取る）
     * @param {Function} [opts.onClose] - 閉じられたときに呼ばれる
     */
    open(opts) {
      window.glDebug && glDebug.log('[glScorePanel] open() called');
      const { overlay, panel } = _ensureDom();
      window.glDebug && glDebug.log('[glScorePanel] DOM ready, panel el=' + !!panel);
      panel.innerHTML = opts.content || '';
      _onCloseCallback = typeof opts.onClose === 'function' ? opts.onClose : null;

      // 表示（display 切替のみ、アニメなし）
      overlay.classList.add('gl-panel-open');
      panel.classList.add('gl-panel-open');
      panel.scrollTop = 0;

      // 実際の display 状態を確認
      setTimeout(function () {
        const cs = window.getComputedStyle(panel);
        window.glDebug && glDebug.log('[glScorePanel] display=' + cs.display + ' pos=' + cs.position + ' bottom=' + cs.bottom + ' zi=' + cs.zIndex);
        const rect = panel.getBoundingClientRect();
        window.glDebug && glDebug.log('[glScorePanel] rect top=' + Math.round(rect.top) + ' bottom=' + Math.round(rect.bottom) + ' h=' + Math.round(rect.height));
      }, 50);

      if (typeof opts.onBind === 'function') {
        try { opts.onBind(panel); } catch (err) {
          window.glDebug && glDebug.err('[glScorePanel] onBind error: ' + err.message);
        }
      }

      window.glDebug && glDebug.log('[glScorePanel] opened');
    },

    /**
     * パネル内部を差し替える（開いたまま中身だけ更新）
     * @param {string} content
     * @param {Function} [onBind]
     */
    rerender(content, onBind) {
      const panel = document.getElementById(PANEL_ID);
      if (!panel || !panel.classList.contains('gl-panel-open')) {
        console.warn('[glScorePanel] rerender called but panel is not open');
        return;
      }
      panel.innerHTML = content || '';
      if (typeof onBind === 'function') {
        try { onBind(panel); } catch (err) {
          console.error('[glScorePanel] onBind error (rerender):', err);
        }
      }
    },

    /**
     * パネルを閉じる
     */
    close() {
      const overlay = document.getElementById(OVERLAY_ID);
      const panel = document.getElementById(PANEL_ID);
      if (overlay) overlay.classList.remove('gl-panel-open');
      if (panel) {
        panel.classList.remove('gl-panel-open');
        panel.innerHTML = ''; // 内容クリア（次回開くとき変な残骸が見えない）
      }
      const cb = _onCloseCallback;
      _onCloseCallback = null;
      if (cb) {
        try { cb(); } catch (err) {
          console.error('[glScorePanel] onClose error:', err);
        }
      }
      console.log('[glScorePanel] closed');
    },

    /**
     * パネル要素を取得（テーマ側で内部操作したい時用）
     */
    getPanelEl() {
      return document.getElementById(PANEL_ID);
    },

    /**
     * 現在開いているかどうか
     */
    isOpen() {
      const panel = document.getElementById(PANEL_ID);
      return !!(panel && panel.classList.contains('gl-panel-open'));
    },
  };

  window.glScorePanel = glScorePanel;
})();
