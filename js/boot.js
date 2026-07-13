/**
 * G-LAND v2.8.0 - Bootstrap
 * =========================
 * 【新起動フロー】
 *   1. Firebase Auth 初期化を待つ
 *   2. Firebase 未ログイン → glAuthUI (Google ログイン画面) を表示
 *   3. Firebase ログイン済み → PWA Gate 判定 → Onboarding 判定 → ホーム
 *
 * 起動時のエラーはフォールバックUIを表示する。
 */
(function () {
  'use strict';

  // ===== GAS URL 設定 =====
  window.GLAND_GAS_URL = window.GLAND_GAS_URL || '';

  function _showFallbackUI(errorMsg) {
    document.body.innerHTML = `
      <div style="
        position:fixed;inset:0;display:flex;flex-direction:column;
        align-items:center;justify-content:center;
        background:linear-gradient(135deg,#1a5f3f 0%,#2d7a56 100%);
        color:#fff;padding:20px;text-align:center;font-family:sans-serif;
      ">
        <div style="font-size:48px;font-weight:800;letter-spacing:3px;margin-bottom:12px;">G-LAND</div>
        <div style="font-size:14px;opacity:.9;margin-bottom:32px;">ゴルフスコア共有アプリ</div>
        <div style="background:rgba(255,255,255,.15);padding:20px;border-radius:12px;max-width:340px;margin-bottom:24px;">
          <div style="font-size:15px;line-height:1.6;">
            起動時にエラーが発生しました。<br>
            再読み込みしてください。
          </div>
          ${errorMsg ? `<div style="font-size:11px;opacity:.7;margin-top:12px;font-family:monospace;">${errorMsg}</div>` : ''}
        </div>
        <button onclick="location.reload()" style="
          padding:16px 40px;background:#fff;color:#1a5f3f;
          border:none;border-radius:10px;font-size:17px;font-weight:700;
          box-shadow:0 4px 12px rgba(0,0,0,.2);cursor:pointer;
        ">🔄 再読み込み</button>
      </div>
    `;
  }

  function _navigate(view) {
    ['home', 'golf', 'score', 'history', 'mypage'].forEach((v) => {
      const el = document.getElementById('view-' + v);
      if (el) el.classList.remove('show');
    });

    switch (view) {
      case 'home': return window.glHome.show();
      case 'golf': return window.glRoundUI.show();
      case 'score': return window.glScoreUI.show();
      case 'history': return window.glHistoryUI.show();
      case 'mypage': return window.glMyPageUI.show();
      default: return window.glHome.show();
    }
  }

  /**
   * Firebase ログイン後の起動処理
   *
   * 【v2.8.0 変更】旧 PWA Install Gate は廃止（ログインに到達できない問題を回避）
   * → PWA インストール案内は将来ホーム画面に小さなバナーで表示予定
   */
  function _postAuthBoot() {
    try {
      // Onboarding 判定（プロフィール未登録なら表示）
      const onboardingShown = window.glOnboarding.check();
      if (onboardingShown) return;

      // 3. 履歴同期（バックグラウンド）
      if (window.glProfile.getUserId() && navigator.onLine) {
        window.glHistory.syncFromServer();
      }

      // 4. 初期画面表示
      _navigate('home');

      // 5. ?join= からの自動合流
      const pending = window.glRound.getPendingJoin && window.glRound.getPendingJoin();
      if (pending && window.glProfile.getUserId()) {
        const currentRound = window.glState.get('roundId');
        if (!currentRound) {
          setTimeout(async () => {
            try {
              console.log('[boot] auto-joining with code:', pending);
              await window.glRound.join(pending);
              window.glToast?.success('ラウンドに合流しました');
            } catch (err) {
              console.error('[boot] auto-join failed:', err);
              const msg = (err && err.message) ? err.message : '不明なエラー';
              window.glToast?.error('合流に失敗しました: ' + msg);
              window.glRound.clearPendingJoin && window.glRound.clearPendingJoin();
            } finally {
              if (window.history && window.history.replaceState) {
                window.history.replaceState({}, '', location.pathname);
              }
            }
          }, 500);
        } else {
          window.glRound.clearPendingJoin && window.glRound.clearPendingJoin();
          if (window.history && window.history.replaceState) {
            window.history.replaceState({}, '', location.pathname);
          }
        }
      }
    } catch (err) {
      console.error('[boot] postAuth error:', err);
    }
  }

  /**
   * Firebase 未ログイン時: ログイン画面を表示
   * ログイン成功 → auth:changed イベント → _postAuthBoot() 実行
   */
  function _showLoginScreen() {
    // 既存の Gate を完全非表示（v2.8.0: PWA ゲートは廃止）
    if (window.glGate && window.glGate.hide) window.glGate.hide();
    const gateEl = document.getElementById('install-gate');
    if (gateEl) gateEl.style.display = 'none';

    // Login 画面表示
    if (window.glAuthUI && window.glAuthUI.show) {
      window.glAuthUI.show();
    } else {
      console.error('[boot] glAuthUI not available');
    }
  }

  async function _boot() {
    try {
      // 1. Service Worker 登録
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch((err) => {
          console.warn('[boot] SW register failed:', err);
        });
      }

      // 2. 基盤初期化
      window.glToast._init();
      window.glNet._init();
      // v2.8.0: glGate._init() は beforeinstallprompt のリスナー登録のみなので保持
      window.glGate._init();

      // 【v2.8.0】旧 PWA Install Gate は表示しない
      // (将来ホームに PWA インストールバナーを小さく表示予定)
      const gateEl = document.getElementById('install-gate');
      if (gateEl) {
        gateEl.style.display = 'none';
        gateEl.classList.remove('show');
      }

      // 3. Storage → State 復元
      window.glState.hydrate();

      // 3.5. ナビゲーション購読
      window.glEvents.on('ui:navigate', (data) => {
        _navigate(data?.view || 'home');
      });

      // 4. GAS URL 設定
      if (window.GLAND_GAS_URL) {
        window.glandApi._setUrl(window.GLAND_GAS_URL);
      }

      // 5. Queue 自動flush開始
      window.glQueue._startAutoFlush();

      // 6. ?join= 検出
      const params = new URLSearchParams(location.search);
      const joinCode = params.get('join');
      if (joinCode) {
        window.glRound.setPendingJoin(joinCode.trim().toUpperCase());
      }

      // 7. Firebase Auth 初期化を待つ（最大 8 秒でタイムアウト）
      const authReady = window.glAuth
        ? Promise.race([
            window.glAuth.ready(),
            new Promise((_, rej) => setTimeout(() => rej(new Error('auth timeout')), 8000)),
          ]).catch((err) => {
            console.warn('[boot] auth ready failed:', err.message);
            return null;
          })
        : Promise.resolve(null);

      await authReady;

      // 8. Firebase ログイン状態で分岐
      if (!window.glAuth || !window.glAuth.isLoggedIn()) {
        _showLoginScreen();
        // ログイン成功時に post-auth ブートを走らせる
        if (window.glAuth) {
          const unsub = window.glAuth.onChange((user) => {
            if (user && user.uid) {
              unsub();
              if (window.glAuthUI && window.glAuthUI.hide) window.glAuthUI.hide();
              _postAuthBoot();
            }
          });
        }
        return; // ここで一旦停止
      }

      // 9. ログイン済み → 通常起動
      _postAuthBoot();

      // 10. Keep-alive
      if (window.GLAND_GAS_URL) {
        setInterval(() => {
          if (navigator.onLine) {
            window.glandApi.ping().catch(() => {});
          }
        }, 180000);
      }

      console.log('[boot] G-LAND v2.8.0 ready');
    } catch (err) {
      console.error('[boot] fatal error:', err);
      _showFallbackUI(err.message || String(err));
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _boot);
  } else {
    _boot();
  }

  window.addEventListener('error', (e) => {
    console.error('[global error]', e.error);
  });
  window.addEventListener('unhandledrejection', (e) => {
    console.error('[unhandled promise]', e.reason);
  });
})();
