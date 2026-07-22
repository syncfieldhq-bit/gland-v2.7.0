/**
 * G-LAND v3.0.0 - Home View UI
 * ============================
 * レイアウト:
 *   ┌────────────────────────┐
 *   │ [🏌️ ラウンド][📖 履歴] │
 *   │ [📱 配布QR ][👤 マイページ]│
 *   ├────────────────────────┤
 *   │   広告カルーセル (下半分)  │
 *   └────────────────────────┘
 *
 * v3.0.0 変更点:
 *   - _injectStyles() を no-op 化（CSS は css/screens.css / css/modal.css へ移管）
 *   - 配布QRモーダルを window.glModal.open() へ移行
 *   - 文言・QR生成ロジック・URLコピー・閉じる挙動は 100% 現行維持
 *
 * v2.7.3 からの継承機能:
 *   - セーフエリアマージンでロゴが切れない
 *   - 「共有」→「配布用QRコード」に変更（アプリのURLをQR表示）
 *   - ナビゲーションを PubSub + 直接呼出のハイブリッド化
 *   - 広告枠が pointer-events を奪わないように修正
 */
(function () {
  'use strict';

  function _injectStyles() {
    // v3.0.0: CSS は css/*.css に完全移管済み。互換のため関数は残置（no-op）。
    return;
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

    // シンプルなクリック委任（子要素は pointer-events:none で target=ボタン保証）
    const menu = view.querySelector('.gl-home__menu');
    if (menu) {
      menu.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-nav]');
        if (!btn) return;
        const nav = btn.dataset.nav;
        console.log('[home] nav click:', nav);
        if (nav === 'distqr') {
          _openDistributionQR();
        } else {
          window.glEvents.emit('ui:navigate', { view: nav });
        }
      });
    }

    // 広告カルーセルをマウント
    const adSlot = document.getElementById('ad-slot-home');
    if (adSlot && window.glAdsUI) window.glAdsUI.mount(adSlot, 'home');
  }

  /**
   * 配布用QRコードモーダル
   * このアプリのURL（?join= などのパラメータ無し）をQRコードで表示
   *
   * v3.0.0: glModal.open() に移行。以下は 100% 現行維持:
   *   - タイトル文言「📱 アプリを配る」
   *   - 説明文言「このQRコードを読み取ると G-LAND を開けます」
   *   - QR 生成タイミング（open 後 100ms）
   *   - URL 表示、コピー処理、閉じる挙動、モーダル外タップで閉じる
   */
  function _openDistributionQR() {
    const url = location.origin + location.pathname;

    // 既存があれば除去（多層化防止）
    window.glModal.closeByType && window.glModal.closeByType('distqr');
    // 旧仕様互換: 旧 overlay が残っていたら除去
    var legacy = document.getElementById('gl-distqr-overlay');
    if (legacy && legacy.parentNode) legacy.parentNode.removeChild(legacy);

    var body = ''
      + '<div class="gl-distqr-title">📱 アプリを配る</div>'
      + '<div class="gl-distqr-desc">このQRコードを読み取ると G-LAND を開けます</div>'
      + '<div id="gl-distqr-canvas" class="gl-distqr-canvas">'
      +   '<div class="gl-u-56">生成中…</div>'
      + '</div>'
      + '<div class="gl-distqr-url">' + url + '</div>'
      + '<div class="gl-distqr-actions">'
      +   '<button type="button" class="gl-distqr-btn gl-distqr-btn--secondary" data-action="copy">🔗 コピー</button>'
      +   '<button type="button" class="gl-distqr-btn gl-distqr-btn--primary" data-action="close">閉じる</button>'
      + '</div>';

    var handle = window.glModal.open({
      body: body,
      modalType: 'distqr',
      variant: 'distqr',
      dismissible: true, // 背景クリックで閉じる（従来仕様）
      showClose: false,  // × は出さない（従来はフッター「閉じる」ボタンのみ）
      onBind: function (root) {
        // 閉じるボタン
        var closeBtn = root.querySelector('[data-action="close"]');
        if (closeBtn) {
          closeBtn.addEventListener('click', function () { handle.close(); });
        }
        // コピーボタン（従来仕様: navigator.clipboard 失敗時は toast で URL 表示）
        var copyBtn = root.querySelector('[data-action="copy"]');
        if (copyBtn) {
          copyBtn.addEventListener('click', function () {
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(url).then(function () {
                window.glToast && window.glToast.success('URLをコピーしました');
              }).catch(function () {
                window.glToast && window.glToast.info('URL: ' + url);
              });
            } else {
              window.glToast && window.glToast.info('URL: ' + url);
            }
          });
        }
        // QR 生成（従来と同じく 100ms 遅延）
        setTimeout(function () { _generateDistQR(url); }, 100);
      },
    });
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
