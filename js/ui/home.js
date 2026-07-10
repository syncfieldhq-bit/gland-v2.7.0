/**
 * G-LAND v2.7.3 - Home View UI
 * ============================
 * レイアウト:
 *   ┌────────────────────────┐
 *   │ [🏌️ ラウンド][📖 履歴] │
 *   │ [📱 配布QR ][👤 マイページ]│
 *   ├────────────────────────┤
 *   │   広告カルーセル (下半分)  │
 *   └────────────────────────┘
 *
 * v2.7.3 変更:
 *   - セーフエリアマージンでロゴが切れない
 *   - 「共有」→「配布用QRコード」に変更（アプリのURLをQR表示）
 *   - ナビゲーションを PubSub + 直接呼出のハイブリッド化（イベント未購読でも動作）
 *   - 広告枠が pointer-events を奪わないように修正
 */
(function () {
  'use strict';

  function _injectStyles() {
    if (document.getElementById('gl-home-styles')) return;
    const style = document.createElement('style');
    style.id = 'gl-home-styles';
    style.textContent = `
      #view-home {
        min-height: 100vh;
        padding: calc(env(safe-area-inset-top, 0px) + 20px) 16px calc(env(safe-area-inset-bottom, 0px) + 24px);
        box-sizing: border-box;
        background: linear-gradient(180deg, #f8f9fa 0%, #eef2f0 100%);
        display: none; flex-direction: column;
      }
      #view-home.show { display: flex; }
      .gl-home__header {
        text-align: center; margin-bottom: 16px;
        padding-top: 8px;
      }
      .gl-home__logo {
        font-size: 32px; font-weight: 800; color: #1a5f3f;
        letter-spacing: 2px; line-height: 1.2;
      }
      .gl-home__tagline {
        font-size: 12px; color: #666; margin-top: 4px;
      }
      .gl-home__menu {
        display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
        margin-bottom: 16px;
        position: relative;
        z-index: 10;
      }
      .gl-home__btn {
        padding: 20px 12px; border: none; border-radius: 14px;
        background: #fff; box-shadow: 0 4px 12px rgba(0,0,0,.08);
        display: flex; flex-direction: column; align-items: center; gap: 6px;
        cursor: pointer; font-family: inherit;
        transition: transform .15s, box-shadow .15s;
        -webkit-tap-highlight-color: rgba(0,0,0,.1);
        touch-action: manipulation;
        position: relative;
        z-index: 11;
      }
      .gl-home__btn:active { transform: scale(.97); }
      .gl-home__btn-icon { font-size: 32px; line-height: 1; pointer-events: none; }
      .gl-home__btn-label { font-size: 14px; font-weight: 700; color: #222; pointer-events: none; }
      .gl-home__btn-sub { font-size: 11px; color: #888; pointer-events: none; }
      .gl-home__btn--primary { background: linear-gradient(135deg, #1a5f3f, #2d7a56); }
      .gl-home__btn--primary .gl-home__btn-label { color: #fff; }
      .gl-home__btn--primary .gl-home__btn-sub { color: rgba(255,255,255,.85); }
      .gl-home__ads-title {
        font-size: 12px; color: #888; text-align: center; margin: 4px 0 8px;
        letter-spacing: 1px;
      }
      .gl-home__ads {
        flex: 1; display: flex; align-items: stretch;
        min-height: 240px;
        position: relative;
        z-index: 1;
      }
      #ad-slot-home { width: 100%; }

      /* 配布QRモーダル */
      .gl-distqr-overlay {
        position: fixed; inset: 0; z-index: 9500;
        background: rgba(0,0,0,.5);
        display: flex; align-items: center; justify-content: center;
        padding: 20px;
      }
      .gl-distqr-modal {
        background: #fff; border-radius: 16px; padding: 24px;
        max-width: 340px; width: 100%;
        box-shadow: 0 8px 32px rgba(0,0,0,.3);
        text-align: center;
      }
      .gl-distqr-title {
        font-size: 18px; font-weight: 800; color: #1a5f3f;
        margin-bottom: 8px;
      }
      .gl-distqr-desc {
        font-size: 13px; color: #666; margin-bottom: 16px;
      }
      .gl-distqr-canvas {
        background: #fff; padding: 12px; border-radius: 10px;
        display: inline-block; margin-bottom: 12px;
        border: 1px solid #e0e0e0;
      }
      .gl-distqr-url {
        font-size: 11px; color: #888; word-break: break-all;
        background: #f5f5f5; padding: 8px; border-radius: 6px;
        margin-bottom: 12px;
      }
      .gl-distqr-actions {
        display: flex; gap: 8px; justify-content: center;
      }
      .gl-distqr-btn {
        flex: 1; padding: 12px; border: none; border-radius: 8px;
        font-size: 14px; font-weight: 700; cursor: pointer;
        font-family: inherit;
      }
      .gl-distqr-btn--primary { background: #1a5f3f; color: #fff; }
      .gl-distqr-btn--secondary { background: #eee; color: #333; }
    `;
    document.head.appendChild(style);
  }

  function _render() {
    _injectStyles();
    const view = document.getElementById('view-home');
    if (!view) return;

    view.innerHTML = `
      <div class="gl-home__header">
        <div class="gl-home__logo">G-LAND</div>
        <div class="gl-home__tagline">ゴルフスコア共有アプリ</div>
      </div>

      <div class="gl-home__menu">
        <button class="gl-home__btn gl-home__btn--primary" data-nav="golf" type="button">
          <div class="gl-home__btn-icon">🏌️</div>
          <div class="gl-home__btn-label">ラウンド開始</div>
          <div class="gl-home__btn-sub">スコア入力・合流</div>
        </button>
        <button class="gl-home__btn" data-nav="history" type="button">
          <div class="gl-home__btn-icon">📖</div>
          <div class="gl-home__btn-label">履歴</div>
          <div class="gl-home__btn-sub">過去のスコア</div>
        </button>
        <button class="gl-home__btn" data-nav="distqr" type="button">
          <div class="gl-home__btn-icon">📱</div>
          <div class="gl-home__btn-label">配布用QR</div>
          <div class="gl-home__btn-sub">アプリを配る</div>
        </button>
        <button class="gl-home__btn" data-nav="mypage" type="button">
          <div class="gl-home__btn-icon">👤</div>
          <div class="gl-home__btn-label">マイページ</div>
          <div class="gl-home__btn-sub">プロフィール</div>
        </button>
      </div>

      <div class="gl-home__ads-title">- 情報広告 -</div>
      <div class="gl-home__ads">
        <div id="ad-slot-home"></div>
      </div>
    `;

    // イベント委任: メニュー全体で1つのリスナー（buttonの子要素タップも捕捉）
    const menu = view.querySelector('.gl-home__menu');
    if (menu) {
      menu.addEventListener('click', _onMenuClick);
      // iOS Safari の click 遅延回避
      menu.addEventListener('touchend', _onMenuTouch, { passive: false });
    }

    // 広告カルーセルをマウント
    const adSlot = document.getElementById('ad-slot-home');
    if (adSlot && window.glAdsUI) window.glAdsUI.mount(adSlot, 'home');
  }

  let _lastTouchTime = 0;

  function _onMenuTouch(e) {
    const btn = e.target.closest('[data-nav]');
    if (!btn) return;
    _lastTouchTime = Date.now();
    // touchend で先に処理して、後続 click は無視
    e.preventDefault();
    _handleNav(btn.dataset.nav);
  }

  function _onMenuClick(e) {
    // touchend の直後の合成 click は無視
    if (Date.now() - _lastTouchTime < 500) return;
    const btn = e.target.closest('[data-nav]');
    if (!btn) return;
    _handleNav(btn.dataset.nav);
  }

  function _handleNav(nav) {
    console.log('[home] nav click:', nav);
    if (nav === 'distqr') {
      _openDistributionQR();
      return;
    }
    // ハイブリッド: PubSub + 直接呼出フォールバック
    try {
      if (window.glEvents && typeof window.glEvents.emit === 'function') {
        window.glEvents.emit('ui:navigate', { view: nav });
      }
    } catch (err) {
      console.warn('[home] emit failed, using direct call:', err);
    }
    // フォールバック: 500ms待って画面が切り替わっていなければ直接呼ぶ
    setTimeout(() => {
      const homeStill = document.getElementById('view-home')?.classList.contains('show');
      const targetView = document.getElementById('view-' + nav);
      const targetShown = targetView?.classList.contains('show');
      if (homeStill && !targetShown) {
        console.warn('[home] fallback direct navigation to:', nav);
        _directNavigate(nav);
      }
    }, 500);
  }

  function _directNavigate(view) {
    ['home', 'golf', 'score', 'history', 'mypage'].forEach((v) => {
      const el = document.getElementById('view-' + v);
      if (el) el.classList.remove('show');
    });
    switch (view) {
      case 'golf': return window.glRoundUI && window.glRoundUI.show();
      case 'history': return window.glHistoryUI && window.glHistoryUI.show();
      case 'mypage': return window.glMyPageUI && window.glMyPageUI.show();
      case 'score': return window.glScoreUI && window.glScoreUI.show();
      default: return glHome.show();
    }
  }

  /**
   * 配布用QRコードモーダル
   * このアプリのURL（?join= などのパラメータ無し）をQRコードで表示
   */
  function _openDistributionQR() {
    const url = location.origin + location.pathname;

    // 既存があれば除去
    const existing = document.getElementById('gl-distqr-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'gl-distqr-overlay';
    overlay.className = 'gl-distqr-overlay';
    overlay.innerHTML = `
      <div class="gl-distqr-modal">
        <div class="gl-distqr-title">📱 アプリを配る</div>
        <div class="gl-distqr-desc">このQRコードを読み取ると G-LAND を開けます</div>
        <div id="gl-distqr-canvas" class="gl-distqr-canvas">
          <div style="width:200px;height:200px;display:flex;align-items:center;justify-content:center;color:#888;">生成中…</div>
        </div>
        <div class="gl-distqr-url">${url}</div>
        <div class="gl-distqr-actions">
          <button type="button" class="gl-distqr-btn gl-distqr-btn--secondary" data-action="copy">🔗 コピー</button>
          <button type="button" class="gl-distqr-btn gl-distqr-btn--primary" data-action="close">閉じる</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    // モーダル外タップで閉じる
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
    overlay.querySelector('[data-action="close"]').addEventListener('click', () => overlay.remove());
    overlay.querySelector('[data-action="copy"]').addEventListener('click', () => {
      navigator.clipboard?.writeText(url).then(() => {
        window.glToast?.success('URLをコピーしました');
      }).catch(() => {
        window.glToast?.info('URL: ' + url);
      });
    });

    // QR生成
    setTimeout(() => _generateDistQR(url), 100);
  }

  function _generateDistQR(url) {
    const container = document.getElementById('gl-distqr-canvas');
    if (!container) return;

    if (window.QRCode) {
      try {
        container.innerHTML = '';
        new window.QRCode(container, {
          text: url,
          width: 200,
          height: 200,
          correctLevel: window.QRCode.CorrectLevel.M
        });
      } catch (err) {
        console.warn('[distqr] QRCode.js failed, using fallback:', err);
        _fallbackQR(container, url);
      }
    } else {
      _fallbackQR(container, url);
    }
  }

  function _fallbackQR(container, url) {
    // Google Chart API は 2019 に廃止、qrserver.com を使用
    const src = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(url);
    container.innerHTML = `<img src="${src}" width="200" height="200" alt="配布用QR">`;
  }

  const glHome = {
    show() {
      _render();
      const view = document.getElementById('view-home');
      if (view) view.classList.add('show');
      window.glState.set('phase', 'S4');
    },

    hide() {
      const view = document.getElementById('view-home');
      if (view) view.classList.remove('show');
      const adSlot = document.getElementById('ad-slot-home');
      if (adSlot && window.glAdsUI) window.glAdsUI.destroy(adSlot, 'home');
    },

    _openDistributionQR,
  };

  window.glHome = glHome;
})();
