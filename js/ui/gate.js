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
    // v3.0.0: CSS は css/*.css に完全移管済み。互換のため関数は残置（no-op）。
    return;
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
          <div id="gl-gate-fallback" class="gl-u-46">
            <p class="gl-u-47">自動インストールができない場合：</p>
            <ol class="gl-u-48">
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
            <li>下の <b>共有ボタン</b> <span class="gl-u-08">⬆️</span> をタップ</li>
            <li>メニューを下にスクロール</li>
            <li>「<b>ホーム画面に追加</b>」をタップ</li>
            <li>右上の「追加」をタップ</li>
          </ol>
          <p class="gl-u-49">
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
          <p class="gl-u-50">
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
