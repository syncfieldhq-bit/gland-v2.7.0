/**
 * G-LAND v2.7.0 - Install Gate UI
 * ===============================
 * PWA未インストール時の案内画面。端末別最適UX。
 * インストール完了後は自動非表示 → onboarding.js が起動
 *
 * 端末判定:
 *   - iOS Safari: 「共有→ホーム画面に追加」誘導
 *   - iOS Chrome/その他ブラウザ: 「Safariで開く」誘導 + URLコピーボタン
 *   - Android Chrome: beforeinstallprompt でネイティブ install
 *   - PWA起動中: 自動スキップ
 */
(function () {
  'use strict';

  let deferredPrompt = null;
  let gateEl = null;

  function _isPWA() {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||
      document.referrer.startsWith('android-app://')
    );
  }

  function _detectEnv() {
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    const isAndroid = /Android/.test(ua);
    const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(ua);
    const isIOSChrome = /CriOS/.test(ua);
    const isIOSOther = isIOS && !isSafari && !isIOSChrome;
    return { isIOS, isAndroid, isSafari, isIOSChrome, isIOSOther };
  }

  function _injectStyles() {
    if (document.getElementById('gl-gate-styles')) return;
    const style = document.createElement('style');
    style.id = 'gl-gate-styles';
    style.textContent = `
      body.gl-gate-active { overflow: hidden; }
      #install-gate {
        position: fixed; inset: 0; z-index: 9990;
        background: linear-gradient(135deg, #1a5f3f 0%, #2d7a56 100%);
        color: #fff; display: none; overflow-y: auto;
        padding: 24px 20px;
      }
      #install-gate.show { display: block; }
      .gl-gate__inner { max-width: 480px; margin: 0 auto; padding-top: 24px; }
      .gl-gate__logo { text-align: center; font-size: 42px; font-weight: 800; letter-spacing: 2px; margin-bottom: 8px; }
      .gl-gate__sub { text-align: center; font-size: 15px; opacity: .9; margin-bottom: 24px; }
      .gl-gate__panel {
        background: #fff; color: #222; border-radius: 16px;
        padding: 20px 18px; margin-bottom: 16px;
        box-shadow: 0 8px 24px rgba(0,0,0,.2);
      }
      .gl-gate__panel h3 { margin: 0 0 12px; font-size: 18px; color: #1a5f3f; }
      .gl-gate__panel p { font-size: 15px; line-height: 1.7; margin: 0 0 12px; }
      .gl-gate__panel ol { padding-left: 22px; font-size: 15px; line-height: 1.9; margin: 0 0 8px; }
      .gl-gate__btn {
        display: block; width: 100%; padding: 14px 16px;
        background: #1a5f3f; color: #fff; border: none;
        border-radius: 10px; font-size: 16px; font-weight: 700;
        cursor: pointer; margin-top: 8px;
      }
      .gl-gate__btn--secondary { background: #666; }
      .gl-gate__url {
        background: #f5f5f5; padding: 10px; border-radius: 8px;
        font-size: 12px; word-break: break-all; margin: 8px 0;
        color: #333;
      }
      .gl-gate__icon { font-size: 32px; text-align: center; margin-bottom: 8px; }
    `;
    document.head.appendChild(style);
  }

  function _renderPanel(env) {
    _injectStyles();
    const currentUrl = location.href.split('?')[0];

    if (env.isAndroid) {
      return `
        <div class="gl-gate__panel">
          <div class="gl-gate__icon">📱</div>
          <h3>アプリをインストール</h3>
          <p>G-LANDをネイティブアプリのように使えます</p>
          <button class="gl-gate__btn" id="gl-gate-install" data-install-status="waiting">
            📥 アプリをインストール
          </button>
          <div id="gl-gate-fallback" style="display:none;margin-top:12px;font-size:13px;color:#666;text-align:left;">
            <p style="margin-bottom:6px;">自動インストールができない場合：</p>
            <ol style="padding-left:24px;margin:0;">
              <li>Chromeの右上メニュー <b>⋮</b> をタップ</li>
              <li>「<b>アプリをインストール</b>」を選択</li>
            </ol>
          </div>
        </div>
      `;
    }

    if (env.isSafari) {
      return `
        <div class="gl-gate__panel">
          <div class="gl-gate__icon">📱</div>
          <h3>ホーム画面に追加</h3>
          <ol>
            <li>下の <b>共有ボタン</b> <span style="font-size:20px;">⬆️</span> をタップ</li>
            <li>メニューを下にスクロール</li>
            <li>「<b>ホーム画面に追加</b>」をタップ</li>
            <li>右上の「追加」をタップ</li>
          </ol>
          <p style="margin-top:12px;color:#1a5f3f;font-weight:600;">
            追加したアイコンからアプリを開いてください
          </p>
        </div>
      `;
    }

    if (env.isIOSChrome || env.isIOSOther) {
      return `
        <div class="gl-gate__panel">
          <div class="gl-gate__icon">🧭</div>
          <h3>Safariで開いてください</h3>
          <p>G-LAND を iPhone にインストールするには、<b>Safariブラウザ</b>で開く必要があります。</p>
          <div class="gl-gate__url" id="gl-gate-url">${currentUrl}</div>
          <button class="gl-gate__btn" id="gl-gate-copy">📋 URLをコピー</button>
          <p style="margin-top:12px;font-size:13px;color:#666;">
            コピー後、Safariのアドレスバーに貼り付けて開いてください
          </p>
        </div>
      `;
    }

    // PC/その他
    return `
      <div class="gl-gate__panel">
        <div class="gl-gate__icon">📱</div>
        <h3>スマートフォンで開いてください</h3>
        <p>G-LAND はスマートフォン用のアプリです。<br>
        iPhone または Android でこのページを開いてください。</p>
        <div class="gl-gate__url">${currentUrl}</div>
      </div>
    `;
  }

  function _bindEvents(env) {
    const installBtn = document.getElementById('gl-gate-install');
    if (installBtn) {
      installBtn.addEventListener('click', async () => {
        if (deferredPrompt) {
          deferredPrompt.prompt();
          const { outcome } = await deferredPrompt.userChoice;
          if (outcome === 'accepted') {
            window.glToast.info('インストール中...');
          }
          deferredPrompt = null;
        } else {
          // v2.7.20: フォールバック案内を表示して導導
          const fallback = document.getElementById('gl-gate-fallback');
          if (fallback) fallback.style.display = 'block';
          window.glToast.warn('メニュー(⋮)から「アプリをインストール」を選択してください');
        }
      });
    }

    const copyBtn = document.getElementById('gl-gate-copy');
    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(location.href.split('?')[0]);
          window.glToast.success('URLをコピーしました');
        } catch (e) {
          const urlEl = document.getElementById('gl-gate-url');
          if (urlEl) {
            const range = document.createRange();
            range.selectNode(urlEl);
            window.getSelection().removeAllRanges();
            window.getSelection().addRange(range);
            window.glToast.info('長押しでコピーしてください');
          }
        }
      });
    }
  }

  const glGate = {
    /**
     * gateを表示（起動時判定）
     */
    show() {
      if (_isPWA()) {
        this.hide();
        return false;
      }
        // ★ v2.7.29: iOS のみゲートスキップ（Android は PWA 案内を維持）
    // iOS PWA で ?join= が失われる問題を回避するため、Safari のまま合流させる
    // Android は正しく ?join= が引き継がれるため、通常通り PWA インストール案内を表示
    try {
      const env = _detectEnv();
      if (env.isIOS) {
        const urlJoin = new URLSearchParams(location.search).get('join');
        const storedJoin = localStorage.getItem('gl_pending_join_v1');
        if (urlJoin || storedJoin) {
          console.log('[gate] Skipped for iOS: join parameter detected', { urlJoin, storedJoin });
          return false;
        }
              // 【v2.7.33】ログイン済みなら Safari のまま使わせる
      const isLoggedIn = window.glAuth && window.glAuth.isLoggedIn && window.glAuth.isLoggedIn();
      if (isLoggedIn) {
        console.log('[gate] Skipped for iOS: user already logged in');
        return false;
      }
      }
    } catch (e) { /* ignore */ }


      _injectStyles();
      gateEl = document.getElementById('install-gate');
      if (!gateEl) {
        gateEl = document.createElement('div');
        gateEl.id = 'install-gate';
        document.body.appendChild(gateEl);
      }

      const env = _detectEnv();
      gateEl.innerHTML = `
        <div class="gl-gate__inner">
          <div class="gl-gate__logo">G-LAND</div>
          <div class="gl-gate__sub">ゴルフスコア共有アプリ</div>
          ${_renderPanel(env)}
        </div>
      `;
      gateEl.classList.add('show');
      document.body.classList.add('gl-gate-active');
      window.__glGateActive = true;

      _bindEvents(env);
      window.glEvents.emit('gate:shown', env);

      // v2.7.20: 5秒経っても beforeinstallprompt が来ない場合、フォールバック案内を表示（Androidのみ）
      if (env.isAndroid) {
        setTimeout(() => {
          if (!deferredPrompt) {
            const fallback = document.getElementById('gl-gate-fallback');
            if (fallback) fallback.style.display = 'block';
          }
        }, 5000);
      }

      return true;
    },

    hide() {
      if (gateEl) {
        gateEl.classList.remove('show');
      }
      document.body.classList.remove('gl-gate-active');
      window.__glGateActive = false;
      window.glEvents.emit('gate:hidden', {});
    },

    isActive() {
      return !!window.__glGateActive;
    },

    /**
     * boot.js から一度だけ呼ぶ
     */
    _init() {
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        // v2.7.20: ボタンの状態を「準備完了」に更新
        const btn = document.getElementById('gl-gate-install');
        if (btn) btn.setAttribute('data-install-status', 'ready');
      });

      window.addEventListener('appinstalled', () => {
        this.hide();
        window.glToast.success('インストールが完了しました。ホーム画面から起動してください');
      });
    },
  };

  window.glGate = glGate;
})();
