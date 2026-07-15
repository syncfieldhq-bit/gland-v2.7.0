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
    if (document.getElementById('gl-auth-styles')) return;
    const style = document.createElement('style');
    style.id = 'gl-auth-styles';
    style.textContent = `
      #gl-auth-screen {
        position: fixed; inset: 0; z-index: 9800;
        background: linear-gradient(135deg, #1a5f3f 0%, #2d8f5f 100%);
        display: none; align-items: center; justify-content: center;
        padding: 20px; overflow-y: auto;
      }
      #gl-auth-screen.show { display: flex; }
      .gl-auth-card {
        background: #fff;
        border-radius: 20px;
        padding: 32px 24px;
        max-width: 400px;
        width: 100%;
        box-shadow: 0 12px 40px rgba(0,0,0,0.2);
        text-align: center;
      }
      .gl-auth-logo {
        font-size: 40px;
        font-weight: 800;
        color: #1a5f3f;
        letter-spacing: 4px;
        margin-bottom: 4px;
      }
      .gl-auth-tag {
        font-size: 12px;
        color: #999;
        margin-bottom: 24px;
      }
      .gl-auth-title {
        font-size: 18px;
        font-weight: 700;
        color: #333;
        margin: 0 0 12px;
      }
      .gl-auth-desc {
        font-size: 13px;
        color: #666;
        line-height: 1.6;
        margin-bottom: 24px;
      }
      .gl-auth-btn-google {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        width: 100%;
        padding: 14px 20px;
        background: #fff;
        color: #333;
        border: 1px solid #ddd;
        border-radius: 12px;
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
        transition: box-shadow .15s, transform .1s;
      }
      .gl-auth-btn-google:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.12); }
      .gl-auth-btn-google:active { transform: scale(.98); }
      .gl-auth-btn-google:disabled {
        opacity: .6; cursor: not-allowed;
      }
      .gl-auth-btn-google svg { width: 20px; height: 20px; }
      .gl-auth-note {
        margin-top: 20px;
        font-size: 11px;
        color: #999;
        line-height: 1.5;
      }
      .gl-auth-error {
        background: #fff3f3;
        border: 1px solid #f8bcbc;
        color: #c62828;
        padding: 10px 12px;
        border-radius: 8px;
        font-size: 12px;
        margin-top: 12px;
        text-align: left;
        display: none;
      }
      .gl-auth-error.show { display: block; }
      .gl-auth-loading {
        color: #666;
        font-size: 13px;
        margin-top: 16px;
        display: none;
      }
      .gl-auth-loading.show { display: block; }
    `;
    document.head.appendChild(style);
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

    if (isIOSPWA) {
      containerEl.innerHTML = `
        <div class="gl-auth-card">
          <div class="gl-auth-logo">G-LAND</div>
          <div class="gl-auth-tag">ゴルフスコア共有アプリ</div>
          <h2 class="gl-auth-title" style="color:#d32f2f;">⚠️ Safari で開いてください</h2>
          <p class="gl-auth-desc">
            ホーム画面のアイコンからの起動では<br>
            Google ログインができません。<br><br>
            以下の手順で Safari で開いてください：
          </p>
          <ol style="text-align:left; font-size:13px; line-height:1.8; color:#333; padding-left:20px; margin:16px 0;">
            <li>このアイコンを閉じる</li>
            <li>Safari を開く</li>
            <li>ブックマークまたはURLから G-LAND へ</li>
            <li>Google ログインして登録</li>
          </ol>
          <p style="font-size:11px; color:#999; line-height:1.5; margin-top:12px;">
            登録後はこのアイコンからも使えるようになります。<br>
            （iOS の仕様上、PWA初回利用時は Safari での認証が必要です）
          </p>
          <button class="gl-auth-btn-google" id="gl-auth-copy-url" style="margin-top:16px; background:#1a5f3f; color:#fff; border:none;">
            📋 URLをコピーして Safari で開く
          </button>
        </div>
      `;
      const copyBtn = document.getElementById('gl-auth-copy-url');
      if (copyBtn) {
        copyBtn.addEventListener('click', async () => {
          const url = location.href;
          try {
            if (navigator.clipboard) {
              await navigator.clipboard.writeText(url);
              copyBtn.textContent = '✅ コピーしました！Safariで貼り付けてください';
            } else {
              copyBtn.textContent = 'URL: ' + url;
            }
          } catch (e) {
            copyBtn.textContent = 'URL: ' + url;
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
          <span style="color:#999; font-size:11px;">
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
