/**
 * G-LAND v2.7.0 - Home View UI
 * ============================
 * レイアウト大改造:
 *   ┌────────────────────────┐
 *   │ [🏌️ ラウンド][📖 履歴] │  ← 2x2メニュー（上部コンパクト）
 *   │ [🎁 共有  ][👤 マイページ]│
 *   ├────────────────────────┤
 *   │                        │
 *   │   ★ 広告カルーセル特等席  │  ← 下半分すべて活用
 *   │   (5秒自動送り・4枚)     │
 *   │                        │
 *   └────────────────────────┘
 */
(function () {
  'use strict';

  function _injectStyles() {
    if (document.getElementById('gl-home-styles')) return;
    const style = document.createElement('style');
    style.id = 'gl-home-styles';
    style.textContent = `
      #view-home {
        min-height: 100vh; padding: 20px 16px 24px; box-sizing: border-box;
        background: linear-gradient(180deg, #f8f9fa 0%, #eef2f0 100%);
        display: none; flex-direction: column;
      }
      #view-home.show { display: flex; }
      .gl-home__header {
        text-align: center; margin-bottom: 16px;
      }
      .gl-home__logo {
        font-size: 32px; font-weight: 800; color: #1a5f3f;
        letter-spacing: 2px; line-height: 1;
      }
      .gl-home__tagline {
        font-size: 12px; color: #666; margin-top: 4px;
      }
      .gl-home__menu {
        display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
        margin-bottom: 16px;
      }
      .gl-home__btn {
        padding: 20px 12px; border: none; border-radius: 14px;
        background: #fff; box-shadow: 0 4px 12px rgba(0,0,0,.08);
        display: flex; flex-direction: column; align-items: center; gap: 6px;
        cursor: pointer; font-family: inherit;
        transition: transform .15s, box-shadow .15s;
      }
      .gl-home__btn:active { transform: scale(.97); }
      .gl-home__btn-icon { font-size: 32px; line-height: 1; }
      .gl-home__btn-label { font-size: 14px; font-weight: 700; color: #222; }
      .gl-home__btn-sub { font-size: 11px; color: #888; }
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
      }
      #ad-slot-home { width: 100%; }
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
        <button class="gl-home__btn gl-home__btn--primary" data-nav="golf">
          <div class="gl-home__btn-icon">🏌️</div>
          <div class="gl-home__btn-label">ラウンド開始</div>
          <div class="gl-home__btn-sub">スコア入力・合流</div>
        </button>
        <button class="gl-home__btn" data-nav="history">
          <div class="gl-home__btn-icon">📖</div>
          <div class="gl-home__btn-label">履歴</div>
          <div class="gl-home__btn-sub">過去のスコア</div>
        </button>
        <button class="gl-home__btn" data-nav="share">
          <div class="gl-home__btn-icon">🎁</div>
          <div class="gl-home__btn-label">共有</div>
          <div class="gl-home__btn-sub">アプリを配る</div>
        </button>
        <button class="gl-home__btn" data-nav="mypage">
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

    view.querySelectorAll('[data-nav]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const nav = btn.dataset.nav;
        if (nav === 'share') {
          glHome._openShareSheet();
        } else {
          window.glEvents.emit('ui:navigate', { view: nav });
        }
      });
    });

    // 広告カルーセルをマウント
    const adSlot = document.getElementById('ad-slot-home');
    if (adSlot) window.glAdsUI.mount(adSlot, 'home');
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
      if (adSlot) window.glAdsUI.destroy(adSlot, 'home');
    },

    _openShareSheet() {
      const url = location.href.split('?')[0];
      const text = 'G-LAND でゴルフのスコアをリアルタイム共有しませんか？\n' + url;

      if (navigator.share) {
        navigator.share({ title: 'G-LAND', text, url }).catch(() => {});
      } else {
        // フォールバック: URLコピー
        navigator.clipboard.writeText(text).then(() => {
          window.glToast.success('リンクをコピーしました');
        }).catch(() => {
          window.glToast.info('URL: ' + url);
        });
      }
    },
  };

  window.glHome = glHome;
})();
