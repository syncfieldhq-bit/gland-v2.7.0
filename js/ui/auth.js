/**
 * G-LAND v2.8.0 - Auth UI
 * =======================
 * Google ログイン画面の描画。
 * 起動時 window.glAuth が未ログインならこの画面を出す。
 * ログイン成功後は Onboarding 画面 or ホーム画面へ遷移。
 */
(function () {
  'use strict';

  let containerEl = null;
  let isVisible = false;

  function _injectStyles() {
    // v3.0.0: CSS は css/*.css に完全移管済み。互換のため関数は残置（no-op）。
    return;
  }

  function _render() {
    _injectStyles();
    if (!containerEl) {
      containerEl = document.getElementById('gl-auth-screen');
      if (!containerEl) {
        containerEl = document.createElement('div');
        containerEl.id = 'gl-auth-screen';
        document.body.appendChild(containerEl);
      }
    }

    // 【v2.8.0】iOS PWA (Standalone) では Google ログイン不可
    // Safari で開くよう案内する
    const isIOSPWA = window.glFirebase && window.glFirebase.isIOSStandalone && window.glFirebase.isIOSStandalone();
    const isLoggedIn = window.glAuth && window.glAuth.isLoggedIn && window.glAuth.isLoggedIn();

        if (isIOSPWA && !isLoggedIn) {
      containerEl.innerHTML = `
        <div class="gl-auth-card">
          <div class="gl-auth-logo">G-LAND</div>
          <div class="gl-auth-tag">ゴルフスコア共有アプリ</div>

          <h2 class="gl-auth-title">Google でログイン</h2>

          <p class="gl-auth-desc">
            ホーム画面のアプリからもログインできます。<br>
            下のボタンから Google 認証を進めてください。<br><br>
            <span class="gl-u-19">
              認証後は自動的に G-LAND へ戻ります。
            </span>
          </p>

          <button class="gl-auth-btn-google" id="gl-auth-google-signin">
            Google でログイン
          </button>

          <p class="gl-u-20">
            うまく戻れない場合の予備手段です。<br>
            下のボタンでURLをコピーしてSafariで開けます。
          </p>

          <button class="gl-auth-btn-google gl-u-21" id="gl-auth-copy-url">
            URLをコピーして Safari で開く
          </button>
        </div>
      `;

      const googleSignInBtn = document.getElementById('gl-auth-google-signin');

      if (googleSignInBtn) {
        googleSignInBtn.addEventListener('click', async () => {
          googleSignInBtn.disabled = true;
          googleSignInBtn.textContent = 'Google ログイン画面へ移動中...';

          try {
            await window.glAuth.signIn();

            // Redirect認証では、この後にGoogle画面へ移動する。
            // 認証完了後はG-LANDへ戻り、Firebase側がログイン状態を処理する。
          } catch (err) {
            console.error('[glAuthUI] iOS PWA login failed:', err);

            googleSignInBtn.disabled = false;
            googleSignInBtn.textContent = 'Google でログイン';

            alert(
              'ログインを開始できませんでした。\\n' +
              '通信環境を確認して、もう一度お試しください。'
            );
          }
        });
      }

      const copyBtn = document.getElementById('gl-auth-copy-url');

      if (copyBtn) {
        copyBtn.addEventListener('click', async () => {
          const url = location.href;

          try {
            if (navigator.clipboard) {
              await navigator.clipboard.writeText(url);
              copyBtn.textContent = '✅ コピーしました。Safariで貼り付けてください';
            } else {
              copyBtn.textContent = 'URL：' + url;
            }
          } catch (e) {
            copyBtn.textContent = 'URL：' + url;
          }
        });
      }

      return;
    }


    // 通常のログイン画面
    containerEl.innerHTML = `
      <div class="gl-auth-card">
        <div class="gl-auth-logo">G-LAND</div>
        <div class="gl-auth-tag">ゴルフスコア共有アプリ</div>
        <h2 class="gl-auth-title">はじめに Google でログイン</h2>
        <p class="gl-auth-desc">
          スコアや履歴を安全に保存するため、<br>
          Google アカウントでログインしてください。<br>
          <span class="gl-u-22">
            （どのGoogleアカウントでも、あなた専用のデータが保護されます）
          </span>
        </p>
        <button class="gl-auth-btn-google" id="gl-auth-login-btn">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
            <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
            <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
            <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
          </svg>
          Google でログイン
        </button>
        <div class="gl-auth-loading" id="gl-auth-loading">ログイン中...</div>
        <div class="gl-auth-error" id="gl-auth-error"></div>
        <div class="gl-auth-note">
          ログインすると、G-LAND の利用規約に同意したものとみなされます。<br>
          あなたのメールアドレスは他ユーザーには公開されません。
        </div>
      </div>
    `;

    const btn = document.getElementById('gl-auth-login-btn');
    btn.addEventListener('click', _handleLogin);
  }

  async function _handleLogin() {
    const btn = document.getElementById('gl-auth-login-btn');
    const loading = document.getElementById('gl-auth-loading');
    const errBox = document.getElementById('gl-auth-error');

    errBox.classList.remove('show');
    errBox.textContent = '';
    btn.disabled = true;
    loading.classList.add('show');

    try {
      const user = await window.glAuth.signIn();
      // Redirect 方式の場合 user === null で、リダイレクトによりページ遷移
      if (user) {
        // Popup 方式で即成功 → 画面を閉じて次のステップへ
        hide();
        // Onboarding チェック → 未登録なら Onboarding、登録済みならホーム
        setTimeout(() => {
          if (window.glOnboarding) {
            const shown = window.glOnboarding.check();
            if (!shown) {
              window.glEvents.emit('ui:navigate', { view: 'home' });
            }
          } else {
            window.glEvents.emit('ui:navigate', { view: 'home' });
          }
        }, 100);
      }
    } catch (err) {
      console.error('[glAuthUI] login failed:', err);
      btn.disabled = false;
      loading.classList.remove('show');

      let msg = 'ログインに失敗しました。';
      if (err.code === 'auth/ios-standalone-unsupported') {
        // iOS PWA の場合は _render() でガイダンス画面を再レンダリング
        _render();
        return;
      } else if (err.code === 'auth/unauthorized-domain') {
        msg = 'このドメインは Firebase に登録されていません。管理者にお問い合わせください。';
      } else if (err.code === 'auth/popup-blocked') {
        msg = 'ポップアップがブロックされました。ブラウザ設定を確認してください。';
      } else if (err.code === 'auth/popup-closed-by-user') {
        msg = 'ログインがキャンセルされました。';
      } else if (err.code === 'auth/network-request-failed') {
        msg = 'ネットワークエラーが発生しました。接続を確認してください。';
      } else if (err.message) {
        msg += '\n（詳細: ' + err.message + '）';
      }
      errBox.textContent = msg;
      errBox.classList.add('show');
    }
  }

  function show() {
    if (isVisible) return;
    _render();
    containerEl.classList.add('show');
    isVisible = true;
  }

  function hide() {
    if (!containerEl) return;
    containerEl.classList.remove('show');
    isVisible = false;
  }

  const glAuthUI = {
    show,
    hide,
    isVisible() { return isVisible; },
  };

  window.glAuthUI = glAuthUI;
})();
