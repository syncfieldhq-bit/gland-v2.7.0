/**
 * G-LAND v2.7.0 - Bootstrap (修正版: onboarding後の遷移バグ解消)
 * ==============================================================
 * 修正点:
 *   - ui:navigate 購読を最初期に設定（onboarding return前）
 *   - 全ビューの初期非表示化を保証
 *   - 起動失敗時はフォールバックUI
 */
(function () {
  'use strict';

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
            起動時にエラーが発生しました。<br>再読み込みしてください。
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

  /**
   * ビュー切替（グローバル公開: onboarding.js からもフォールバックで直呼び可能）
   */
  function _navigate(view) {
    ['home', 'golf', 'score', 'history', 'mypage'].forEach((v) => {
      const el = document.getElementById('view-' + v);
      if (el) el.classList.remove('show');
    });

    try {
      switch (view) {
        case 'home':    return window.glHome?.show();
        case 'golf':    return window.glRoundUI?.show();
        case 'score':   return window.glScoreUI?.show();
        case 'history': return window.glHistoryUI?.show();
        case 'mypage':  return window.glMyPageUI?.show();
        default:        return window.glHome?.show();
      }
    } catch (err) {
      console.error('[boot._navigate] view failed:', view, err);
      // フォールバック: home へ
      if (view !== 'home' && window.glHome) window.glHome.show();
    }
  }

  // ⭐ 直接呼出用にグローバル公開（onboarding.js の緊急フォールバック用）
  window.__glNavigate = _navigate;

  async function _boot() {
    try {
      // 1. Service Worker 登録
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch((err) => {
          console.warn('[boot] SW register failed:', err);
        });
      }

      // 2. Toast/Net/Gate 初期化
      window.glToast._init();
      window.glNet._init();
      window.glGate._init();

      // 3. Storage → State 復元
      window.glState.hydrate();

      // 4. GAS URL 設定
      if (window.GLAND_GAS_URL) {
        window.glandApi._setUrl(window.GLAND_GAS_URL);
      }

      // 5. Queue 自動flush開始
      window.glQueue._startAutoFlush();

      // ⭐【修正】ui:navigate 購読を「onboarding判定より前」に設定
      //    onboarding が完了して emit されたときに購読者がいる状態を保証する
      window.glEvents.on('ui:navigate', (data) => {
        _navigate(data?.view || 'home');
      });

      // 6. ?join= 検出
      const params = new URLSearchParams(location.search);
      const joinCode = params.get('join');
      if (joinCode) {
        window.glRound.setPendingJoin(joinCode.trim().toUpperCase());
      }

      // 7. Install Gate 判定
      const gateShown = window.glGate.show();
      if (gateShown) {
        return; // gate表示中は停止（後続処理はappinstalled後に）
      }

      // 8. Onboarding 判定
      const onboardingShown = window.glOnboarding.check();
      if (onboardingShown) {
        // ⭐【修正】return する前に、購読は既に設定済みなので安心
        //         onboarding 完了時の emit('ui:navigate') が確実に受信される
        return;
      }

      // 9. 履歴同期（起動時のみ・バックグラウンド）
      if (window.glProfile.getUserId() && navigator.onLine) {
        window.glHistory.syncFromServer();
      }

      // 10. Keep-alive（3分毎の ping）
      if (window.GLAND_GAS_URL) {
        setInterval(() => {
          if (navigator.onLine) {
            window.glandApi.ping().catch(() => {});
          }
        }, 180000);
      }

      // 11. 初期画面表示
      _navigate('home');

      console.log('[boot] G-LAND v2.7.0 ready');
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
