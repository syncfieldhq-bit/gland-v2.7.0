/**
 * G-LAND v2.7.0 - Onboarding UI (修正版: 真っ白化バグ解消)
 * =======================================================
 * 修正点:
 *   - 登録完了後の遷移を「emit + 直接呼出」の二重化で確実化
 *   - モーダル要素を完全に DOM から除去（残留による重なり防止）
 *   - 履歴同期を裏で実行（次画面表示を止めない）
 */
(function () {
  'use strict';

  let modalEl = null;

  function _injectStyles() {
    if (document.getElementById('gl-onboarding-styles')) return;
    const style = document.createElement('style');
    style.id = 'gl-onboarding-styles';
    style.textContent = `
      .gl-modal { position: fixed; inset: 0; z-index: 9500; display: none; }
      .gl-modal.show { display: block; }
      .gl-modal__backdrop { position: absolute; inset: 0; background: rgba(0,0,0,.55); }
      .gl-modal__body {
        position: relative; margin: 10vh auto 0; max-width: 460px;
        background: #fff; border-radius: 16px; padding: 24px 22px;
        box-shadow: 0 12px 40px rgba(0,0,0,.3);
        max-height: 85vh; overflow-y: auto;
      }
      .gl-modal__title { font-size: 20px; font-weight: 700; color: #1a5f3f; margin: 0 0 6px; }
      .gl-modal__sub { font-size: 14px; color: #666; margin: 0 0 18px; }
      .gl-form__group { margin-bottom: 14px; }
      .gl-form__label { display: block; font-size: 14px; font-weight: 600; color: #333; margin-bottom: 6px; }
      .gl-form__input {
        width: 100%; padding: 12px 14px; font-size: 16px;
        border: 2px solid #ddd; border-radius: 8px; box-sizing: border-box;
      }
      .gl-form__input:focus { border-color: #1a5f3f; outline: none; }
      .gl-form__hint { font-size: 12px; color: #999; margin-top: 4px; }
      .gl-btn-primary {
        width: 100%; padding: 14px; margin-top: 8px;
        background: #1a5f3f; color: #fff; border: none;
        border-radius: 10px; font-size: 16px; font-weight: 700; cursor: pointer;
      }
      .gl-btn-primary:disabled { background: #999; }
    `;
    document.head.appendChild(style);
  }

  function _render(isJoinFlow) {
    _injectStyles();
    modalEl = document.getElementById('first-name-modal');
    if (!modalEl) {
      modalEl = document.createElement('div');
      modalEl.id = 'first-name-modal';
      modalEl.className = 'gl-modal';
      document.body.appendChild(modalEl);
    }

    const title = isJoinFlow ? '合流には登録が必要です' : 'ようこそ G-LAND へ';
    const sub = isJoinFlow
      ? 'お名前を登録してからスコアカードに参加します'
      : 'まずはお名前を教えてください（変更は後からできます）';

    modalEl.innerHTML = `
      <div class="gl-modal__backdrop"></div>
      <div class="gl-modal__body">
        <h2 class="gl-modal__title">${title}</h2>
        <p class="gl-modal__sub">${sub}</p>
        <div class="gl-form__group">
          <label class="gl-form__label">苗字（漢字）<span style="color:#f44336;">*</span></label>
          <input type="text" class="gl-form__input" id="ob-family-name" placeholder="例: 田中" autocomplete="family-name">
        </div>
        <div class="gl-form__group">
          <label class="gl-form__label">苗字（ひらがな）<span style="color:#f44336;">*</span></label>
          <input type="text" class="gl-form__input" id="ob-family-kana" placeholder="例: たなか">
          <div class="gl-form__hint">ひらがなでご入力ください</div>
        </div>
        <button class="gl-btn-primary" id="ob-submit">登録して${isJoinFlow ? '合流' : '始める'}</button>
      </div>
    `;

    modalEl.classList.add('show');

    const submitBtn = document.getElementById('ob-submit');
    submitBtn.addEventListener('click', () => _handleSubmit(isJoinFlow));
  }

  /**
   * ⭐【修正】モーダルを完全に DOM から除去
   * classList.remove だけだと z-index が残って次画面を覆う恐れがある
   */
  function _destroyModal() {
    if (modalEl) {
      modalEl.classList.remove('show');
      // 次の描画サイクルで DOM から完全除去
      setTimeout(() => {
        if (modalEl && modalEl.parentNode) {
          modalEl.parentNode.removeChild(modalEl);
        }
        modalEl = null;
      }, 50);
    }
  }

  /**
   * ⭐【修正】ビュー遷移を「emit + 直接呼出」で二重化
   * emit で通常フローを走らせ、購読者がいなかった場合は直接 __glNavigate を呼ぶ
   */
  function _safeNavigate(view) {
    try {
      window.glEvents.emit('ui:navigate', { view });
    } catch (e) {
      console.warn('[onboarding] emit failed, direct fallback:', e);
    }

    // フォールバック: 少し待ってからビューが表示されているか検査、なければ強制表示
    setTimeout(() => {
      const el = document.getElementById('view-' + view);
      if (!el || !el.classList.contains('show')) {
        console.warn('[onboarding] view not shown after emit, forcing direct call');
        if (typeof window.__glNavigate === 'function') {
          window.__glNavigate(view);
        } else {
          // 最終フォールバック: 個別に呼出
          const map = {
            home: window.glHome,
            golf: window.glRoundUI,
            score: window.glScoreUI,
            history: window.glHistoryUI,
            mypage: window.glMyPageUI,
          };
          if (map[view]?.show) map[view].show();
        }
      }
    }, 100);
  }

  async function _handleSubmit(isJoinFlow) {
    const familyName = (document.getElementById('ob-family-name').value || '').trim();
    const familyKana = (document.getElementById('ob-family-kana').value || '').trim();

    if (!familyName || !familyKana) {
      window.glToast.warn('苗字と ひらがな を入力してください');
      return;
    }

    const btn = document.getElementById('ob-submit');
    btn.disabled = true;
    btn.textContent = '登録中...';

    try {
      await window.glProfile.register(
        { familyName, familyKana },
        { syncWait: isJoinFlow }
      );

      // ⭐ モーダル完全除去
      _destroyModal();

      if (isJoinFlow) {
        const pendingCode = window.glRound.getPendingJoin();
        if (pendingCode) {
          window.glToast.info('スコアカードに合流中...');
          try {
            await window.glRound.join(pendingCode);
            window.glToast.success('合流しました');
            _safeNavigate('golf');
          } catch (err) {
            window.glErrors.handle(err, { context: 'onboarding.autoJoin' });
            // 合流失敗時も home へフォールバック
            _safeNavigate('home');
          }
        } else {
          _safeNavigate('home');
        }
      } else {
        // ⭐ 通常フロー: 履歴同期は裏で（画面表示を止めない）
        if (window.glProfile.getUserId() && navigator.onLine) {
          window.glHistory.syncFromServer().catch(() => {});
        }
        _safeNavigate('home');
      }
    } catch (err) {
      btn.disabled = false;
      btn.textContent = isJoinFlow ? '登録して合流' : '登録して始める';
      window.glErrors.handle(err, { context: 'onboarding.submit' });
    }
  }

  const glOnboarding = {
    check() {
      if (window.glGate.isActive()) return;

      const isRegistered = window.glProfile.isMinimum();
      const pendingJoin = window.glRound.getPendingJoin();

      if (!isRegistered) {
        _render(!!pendingJoin);
        return true;
      }

      if (pendingJoin) {
        (async () => {
          try {
            window.glToast.info('スコアカードに合流中...');
            await window.glRound.join(pendingJoin);
            window.glToast.success('合流しました');
            _safeNavigate('golf');
          } catch (err) {
            window.glErrors.handle(err, { context: 'onboarding.autoJoinDirect' });
          }
        })();
      }

      return false;
    },

    showRegistration(isJoinFlow) {
      _render(isJoinFlow || false);
    },
  };

  window.glOnboarding = glOnboarding;
})();
