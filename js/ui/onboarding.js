/**
 * G-LAND v2.8.0 - Onboarding UI
 * =============================
 * Firebase Google ログイン後の初回プロフィール登録画面。
 * 必須 2項目：姓（漢字）、姓（ひらがな）
 *   → この2項目でスコア入力・同伴プレイヤーとしての展开が可能
 * ?join= 経由の未登録ゲストは強制表示 → 登録後に自動合流
 *
 * 残り3項目（名、名よみ、ニックネーム）は履歴閉覧時に history.js が入力を促す。
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

    const authUser = window.glAuth && window.glAuth.getUser ? window.glAuth.getUser() : null;
    const greetingLine = authUser && authUser.displayName
      ? `<div style="font-size:12px;color:#666;margin-bottom:12px;">ログイン中: ${_esc(authUser.displayName)}${authUser.email ? ' （' + _esc(authUser.email) + '）' : ''}</div>`
      : '';
    const title = isJoinFlow ? '合流には名前の登録が必要です' : 'ようこそ G-LAND へ';
    const sub = isJoinFlow
      ? 'お名前を登録してからスコアカードに参加します'
      : 'スコアカードに表示するお名前を教えてください（変更は後からできます）';

    modalEl.innerHTML = `
      <div class="gl-modal__backdrop"></div>
      <div class="gl-modal__body">
        <h2 class="gl-modal__title">${title}</h2>
        <p class="gl-modal__sub">${sub}</p>
        ${greetingLine}
        <div class="gl-form__group">
          <label class="gl-form__label">姓（漢字）<span style="color:#f44336;">*</span></label>
          <input type="text" class="gl-form__input" id="ob-family-name" placeholder="例: 佐藤" autocomplete="family-name">
        </div>
        <div class="gl-form__group">
          <label class="gl-form__label">姓（ひらがな）<span style="color:#f44336;">*</span></label>
          <input type="text" class="gl-form__input" id="ob-family-kana" placeholder="例: さとう">
          <div class="gl-form__hint">ひらがなでご入力ください</div>
        </div>
        <div style="font-size:11px;color:#999;margin:8px 0 12px;line-height:1.5;">
          （名やニックネームは、あとで履歴を見る時に入力します）
        </div>
        <button class="gl-btn-primary" id="ob-submit">登録して${isJoinFlow ? '合流' : '始める'}</button>
      </div>
    `;

    modalEl.classList.add('show');
    // 背景クリック禁止（データ欠損防止）

    const submitBtn = document.getElementById('ob-submit');
    submitBtn.addEventListener('click', () => _handleSubmit(isJoinFlow));
  }

  async function _handleSubmit(isJoinFlow) {
    const familyName = (document.getElementById('ob-family-name').value || '').trim();
    const familyKana = (document.getElementById('ob-family-kana').value || '').trim();

    if (!familyName || !familyKana) {
      window.glToast.warn('姓と ひらがな を入力してください');
      return;
    }

    const btn = document.getElementById('ob-submit');
    btn.disabled = true;
    btn.textContent = '登録中...';

    // 全画面ローディング表示
    if (window.glLoading) {
      window.glLoading.show(
        isJoinFlow ? '合流を準備しています...' : '登録中...',
        { showCancelAfter: 8000 }
      );
    }

    try {
      const result = await window.glProfile.register(
        { familyName, familyKana },
        { syncWait: isJoinFlow } // 合流フローのみ userId 発行を待つ
      );

      // モーダルを静かに閉じる（アラート出さず）
      modalEl.classList.remove('show');

      if (isJoinFlow) {
        // pendingJoin があれば自動合流
        const pendingCode = window.glRound.getPendingJoin();
        if (pendingCode) {
          if (window.glLoading) window.glLoading.update('スコアカードに合流中...');
          try {
            await window.glRound.join(pendingCode);
            window.glToast.success('合流しました');
            window.glEvents.emit('ui:navigate', { view: 'golf' });
          } catch (err) {
            window.glErrors.handle(err, { context: 'onboarding.autoJoin' });
          }
        }
      } else {
        window.glEvents.emit('ui:navigate', { view: 'home' });
      }
    } catch (err) {
      btn.disabled = false;
      btn.textContent = '登録して始める';
      window.glErrors.handle(err, { context: 'onboarding.submit' });
    } finally {
      if (window.glLoading) window.glLoading.hide();
    }
  }

  const glOnboarding = {
    /**
     * 起動時判定 → 必要なら表示
     */
    check() {
      // v2.8.0-rev5: iOS は Firebase を使わないのでログインチェック不要
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (!isIOS && window.glAuth && !window.glAuth.isLoggedIn()) return false;
      if (window.glGate && window.glGate.isActive && window.glGate.isActive()) return false;

      const isRegistered = window.glProfile.isMinimum();
      const pendingJoin = window.glRound.getPendingJoin();

      if (!isRegistered) {
        // 未登録 → 必ず表示（?join= 有無問わず）
        _render(!!pendingJoin);
        return true;
      }

      if (pendingJoin) {
        // 登録済み + pendingJoin → 自動合流
        (async () => {
          try {
            window.glToast.info('スコアカードに合流中...');
            await window.glRound.join(pendingJoin);
            window.glToast.success('合流しました');
            window.glEvents.emit('ui:navigate', { view: 'golf' });
          } catch (err) {
            window.glErrors.handle(err, { context: 'onboarding.autoJoinDirect' });
          }
        })();
      }

      return false;
    },

    /**
     * 手動表示（gate.js 完了後などから）
     */
    showRegistration(isJoinFlow) {
      _render(isJoinFlow || false);
    },
  };

  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  window.glOnboarding = glOnboarding;
})();
