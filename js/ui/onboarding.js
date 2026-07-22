/**
 * G-LAND v3.0.0 - Onboarding UI
 * =============================
 * 初回起動時のプロフィール登録画面（苗字＋ひらがな 2項目のみ）
 * PWA起動時のみ表示（gate.js との重複防止）
 * ?join= 経由の未登録ゲストは強制表示 → 登録後に自動合流
 *
 * v3.0.0 変更点:
 *   - _injectStyles() を no-op 化（CSS は css/modal.css / css/components.css へ移管）
 *   - モーダル生成を window.glModal.open() へ移行
 *   - 背景クリック禁止（dismissible:false）で従来仕様を維持
 *   - 文言・入力欄・イベント・保存処理は 100% 現行維持
 */
(function () {
  'use strict';

  let modalHandle = null;

  function _injectStyles() {
    // v3.0.0: CSS は css/*.css に完全移管済み。互換のため関数は残置（no-op）。
    return;
  }

  function _render(isJoinFlow) {
    _injectStyles();

    // 既存 modal を閉じる（多層化防止）
    if (modalHandle) {
      try { modalHandle.close(); } catch (e) { /* ignore */ }
      modalHandle = null;
    }
    // 旧仕様互換: #first-name-modal が残っていたら除去
    var legacy = document.getElementById('first-name-modal');
    if (legacy && legacy.parentNode) legacy.parentNode.removeChild(legacy);

    var title = isJoinFlow ? '合流には登録が必要です' : 'ようこそ G-LAND へ';
    var sub = isJoinFlow
      ? 'お名前を登録してからスコアカードに参加します'
      : 'まずはお名前を教えてください（変更は後からできます）';

    var body = ''
      + '<p class="gl-modal__sub">' + sub + '</p>'
      + '<div class="gl-form__group">'
      +   '<label class="gl-form__label">苗字（漢字）<span class="gl-u-01">*</span></label>'
      +   '<input type="text" class="gl-form__input" id="ob-family-name" placeholder="例: 田中" autocomplete="family-name">'
      + '</div>'
      + '<div class="gl-form__group">'
      +   '<label class="gl-form__label">苗字（ひらがな）<span class="gl-u-01">*</span></label>'
      +   '<input type="text" class="gl-form__input" id="ob-family-kana" placeholder="例: たなか">'
      +   '<div class="gl-form__hint">ひらがなでご入力ください</div>'
      + '</div>'
      + '<button class="gl-btn-primary" id="ob-submit">登録して' + (isJoinFlow ? '合流' : '始める') + '</button>';

    modalHandle = window.glModal.open({
      title: title,
      body: body,
      modalType: 'onboarding',
      variant: 'onboarding',
      dismissible: false, // 背景クリック禁止（データ欠損防止）
      showClose: false,   // × も出さない（従来と同じ）
      // フッター actions は使わない（従来と同じく本文内 <button id="ob-submit"> を利用）
      onBind: function (root) {
        var submitBtn = root.querySelector('#ob-submit');
        if (submitBtn) {
          submitBtn.addEventListener('click', function () { _handleSubmit(isJoinFlow); });
        }
      },
      onClose: function () { modalHandle = null; },
    });
  }

  async function _handleSubmit(isJoinFlow) {
    var nameEl = document.getElementById('ob-family-name');
    var kanaEl = document.getElementById('ob-family-kana');
    var familyName = (nameEl && nameEl.value || '').trim();
    var familyKana = (kanaEl && kanaEl.value || '').trim();

    if (!familyName || !familyKana) {
      window.glToast.warn('苗字と ひらがな を入力してください');
      return;
    }

    var btn = document.getElementById('ob-submit');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '登録中...';
    }

    try {
      const result = await window.glProfile.register(
        { familyName: familyName, familyKana: familyKana },
        { syncWait: isJoinFlow } // 合流フローのみ userId 発行を待つ
      );

      // モーダルを静かに閉じる（アラート出さず）
      if (modalHandle) {
        try { modalHandle.close(); } catch (e) { /* ignore */ }
        modalHandle = null;
      }

      if (isJoinFlow) {
        // pendingJoin があれば自動合流
        const pendingCode = window.glRound.getPendingJoin();
        if (pendingCode) {
          window.glToast.info('スコアカードに合流中...');
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
      if (btn) {
        btn.disabled = false;
        btn.textContent = '登録して始める';
      }
      window.glErrors.handle(err, { context: 'onboarding.submit' });
    }
  }

  const glOnboarding = {
    /**
     * 起動時判定 → 必要なら表示
     */
    check() {
      if (window.glGate.isActive()) return; // gate優先

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

  window.glOnboarding = glOnboarding;
})();
