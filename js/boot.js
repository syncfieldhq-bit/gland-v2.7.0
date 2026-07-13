/**
 * G-LAND v2.8.0-rev5 - Bootstrap
 * ===============================
 * 【プラットフォーム別起動戦略】
 *
 *   Android/PC: Firebase Google ログイン方式
 *     起動 → Firebase Auth → 未ログインなら Google ログイン画面
 *          → ログイン後 → Onboarding → ホーム画面
 *
 *   iOS: 従来の自作 userId 方式（v2.7.18 と同じ）
 *     起動 → PWA Install Gate → Onboarding → ホーム画面
 *          → Firebase Auth はスキップ
 *
 * 【背景】
 *   iOS PWA では Firebase Google ログインが動作しないため、
 *   iOS では従来方式に戻して PWA フルスクリーン運用を優先する。
 *   Sign in with Apple は将来検討（年 12,900円のコストがかかるため）。
 */
(function () {
  'use strict';

  // ===== GAS URL 設定 =====
  window.GLAND_GAS_URL = window.GLAND_GAS_URL || '';

  // ===== プラットフォーム判定 =====
  function _isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  }

  function _shouldUseFirebase() {
    // iOS では Firebase を使わない
    return !_isIOS();
  }

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
   * 認証後（またはiOSで直接）の起動処理
   */
  function _postAuthBoot() {
    try {
      // iOS: PWA Install Gate 表示（Safari の場合のみ）
      if (_isIOS() && window.glGate && window.glGate.showManually) {
        // すでに PWA として起動していない かつ 姓入力もまだ完了していない場合
        const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                      window.navigator.standalone === true;
        const isRegistered = window.glProfile && window.glProfile.isMinimum();
        if (!isPWA && !isRegistered) {
          const gateShown = window.glGate.showManually();
          if (gateShown) return;
        }
      }

      // Onboarding 判定（プロフィール未登録なら表示）
      const onboardingShown = window.glOnboarding.check();
      if (onboardingShown) return;

      // 履歴同期（バックグラウンド）
      if (window.glProfile.getUserId() && navigator.onLine) {
        window.glHistory.syncFromServer();
      }

      // 初期画面表示
      _navigate('home');

      // ?join= からの自動合流
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
   * Firebase 未ログイン時: ログイン画面を表示（Android/PC のみ）
   */
  function _showLoginScreen() {
    if (window.glGate && window.glGate.hide) window.glGate.hide();
    const gateEl = document.getElementById('install-gate');
    if (gateEl) gateEl.style.display = 'none';

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
      window.glGate._init();

      // v2.8.0-rev5: iOS では Install Gate を強制表示可能に、Android では非表示
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
      } else {
        // ★ v2.7.20: 無料配布URL時、古い pendingJoin をクリア（ゾンビラウンド防止）
        //   ただし、現在進行中のラウンドがある場合は保持
        const currentRoundId = window.glState.get('roundId');
        if (!currentRoundId && window.glRound.clearPendingJoin) {
          window.glRound.clearPendingJoin();
          console.log('[boot] cleared stale pendingJoin (no ?join= param)');
        }
      }

      // 7. プラットフォーム別の起動フロー
      if (_shouldUseFirebase()) {
        // ============ Android / PC: Firebase Auth 方式 ============
        console.log('[boot] Firebase auth mode (Android/PC)');

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

        if (!window.glAuth || !window.glAuth.isLoggedIn()) {
          _showLoginScreen();
          if (window.glAuth) {
            const unsub = window.glAuth.onChange((user) => {
              if (user && user.uid) {
                unsub();
                if (window.glAuthUI && window.glAuthUI.hide) window.glAuthUI.hide();
                _postAuthBoot();
              }
            });
          }
          return;
        }

        _postAuthBoot();

      } else {
        // ============ iOS: 従来方式（Firebase Auth スキップ） ============
        console.log('[boot] Legacy auth mode (iOS)');

        // iOS では Firebase Auth を一切呼ばず、直接 post-auth boot に進む
        // Onboarding が姓入力を要求 → 従来の GAS 経由で userId 発行
        _postAuthBoot();
      }

      // 8. Keep-alive
      if (window.GLAND_GAS_URL) {
        setInterval(() => {
          if (navigator.onLine) {
            window.glandApi.ping().catch(() => {});
          }
        }, 180000);
      }

      console.log('[boot] G-LAND v2.8.0-rev5 ready');
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
