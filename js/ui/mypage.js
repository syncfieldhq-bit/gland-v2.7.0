/**
 * G-LAND v3.0.0 - MyPage View UI
 * ==============================
 * v3.0.0 変更点:
 *   - _injectStyles() を no-op 化（CSS は css/screens.css / css/modal.css / css/components.css へ移管）
 *   - プロフィール編集モーダルを window.glModal.open() へ移行
 *   - 文言・入力初期値・バリデーション・保存処理・閉じる挙動は 100% 現行維持
 *   - 「保存」→ toast「保存しました」→ close → _render の順序も維持
 *
 * v2.8.13 からの継承:
 *   - モーダル/ボタン/フォームの CSS を復元（→ v3.0.0 では CSS ファイル側へ集約済み）
 */
(function () {
  'use strict';

  const VERSION_LABEL = 'v2.8.13 (build: 20260717)';

  function _injectStyles() {
    // v3.0.0: CSS は css/*.css に完全移管済み。互換のため関数は残置（no-op）。
    return;
  }

  function _render() {
    _injectStyles();
    const view = document.getElementById('view-mypage');
    if (!view) return;

    const p = window.glProfile.getStored();
    const userId = p.userId || '未発行';

    // v2.8.11: 互換維持 - courseAdjust があれば hc として表示
    const hcValue = p.hc || p.courseAdjust || '';

    const row = (label, value) =>
      `<div class="gl-mypage__row">
        <span class="gl-mypage__label">${label}</span>
        <span class="gl-mypage__value ${value ? '' : 'gl-mypage__value--empty'}">${value || '（未設定）'}</span>
      </div>`;

    view.innerHTML = `
      <button class="gl-round__back" data-back>← ホームへ戻る</button>
      <h1 class="gl-mypage__title">👤 マイページ</h1>

      <div class="gl-mypage__userid-card">
        ユーザーID: <span>${userId}</span>
      </div>

      <button class="gl-btn-primary" data-edit>✏️ プロフィールを編集</button>

      <div class="gl-mypage__card gl-u-57">
        ${row('苗字（漢字）', p.familyName)}
        ${row('苗字（ひらがな）', p.familyKana)}
        ${row('名前（漢字）', p.firstName)}
        ${row('名前（ひらがな）', p.firstKana)}
        ${row('ニックネーム', p.nickname)}
        ${row('HC（ハンディキャップ）', hcValue)}
      </div>

      <div id="ad-slot-mypage"></div>

      <div class="gl-mypage__version">${VERSION_LABEL}</div>
    `;

    view.querySelector('[data-back]').addEventListener('click', () => {
      window.glEvents.emit('ui:navigate', { view: 'home' });
    });
    view.querySelector('[data-edit]').addEventListener('click', () => _showEditModal());

    const adSlot = document.getElementById('ad-slot-mypage');
    if (adSlot) window.glAdsUI.mount(adSlot, 'mypage');
  }

  /**
   * v3.0.0: プロフィール編集モーダル（glModal.open ベース）
   * - 文言、入力初期値、バリデーション（苗字必須）、保存処理、
   *   toast「保存しました」、close 後の _render 再描画は 100% 現行維持
   * - 背景クリック / [data-cancel] で閉じる
   */
  function _showEditModal() {
    const p = window.glProfile.getStored();
    // v2.8.11: 互換維持 - courseAdjust があれば hc として初期表示
    const hcValue = p.hc || p.courseAdjust || '';

    var body = ''
      + '<div class="gl-form__group">'
      +   '<label class="gl-form__label">苗字（漢字）</label>'
      +   '<input class="gl-form__input" id="ed-family-name" value="' + (p.familyName || '') + '">'
      + '</div>'
      + '<div class="gl-form__group">'
      +   '<label class="gl-form__label">苗字（ひらがな）</label>'
      +   '<input class="gl-form__input" id="ed-family-kana" value="' + (p.familyKana || '') + '">'
      + '</div>'
      + '<div class="gl-form__group">'
      +   '<label class="gl-form__label">名前（漢字）</label>'
      +   '<input class="gl-form__input" id="ed-first-name" value="' + (p.firstName || '') + '">'
      + '</div>'
      + '<div class="gl-form__group">'
      +   '<label class="gl-form__label">名前（ひらがな）</label>'
      +   '<input class="gl-form__input" id="ed-first-kana" value="' + (p.firstKana || '') + '">'
      + '</div>'
      + '<div class="gl-form__group">'
      +   '<label class="gl-form__label">ニックネーム（ライブリーダーボード用）</label>'
      +   '<input class="gl-form__input" id="ed-nickname" value="' + (p.nickname || '') + '" placeholder="例: たろちゃん">'
      + '</div>'
      + '<div class="gl-form__group">'
      +   '<label class="gl-form__label">HC（ハンディキャップ・任意）</label>'
      +   '<input class="gl-form__input" id="ed-hc" value="' + hcValue + '" placeholder="例: -2">'
      + '</div>'
      + '<button class="gl-btn-primary" data-save>保存</button>'
      + '<button class="gl-u-58" data-cancel>キャンセル</button>';

    var handle = window.glModal.open({
      title: 'プロフィール編集',
      body: body,
      modalType: 'profile-edit',
      dismissible: true, // 背景クリックで閉じる（従来仕様）
      showClose: false,  // 従来は本文内 [data-cancel] ボタンのみ
      onBind: function (root) {
        var cancelBtn = root.querySelector('[data-cancel]');
        if (cancelBtn) cancelBtn.addEventListener('click', function () { handle.close(); });

        var saveBtn = root.querySelector('[data-save]');
        if (saveBtn) {
          saveBtn.addEventListener('click', async function () {
            var patch = {
              familyName: document.getElementById('ed-family-name').value.trim(),
              familyKana: document.getElementById('ed-family-kana').value.trim(),
              firstName:  document.getElementById('ed-first-name').value.trim(),
              firstKana:  document.getElementById('ed-first-kana').value.trim(),
              nickname:   document.getElementById('ed-nickname').value.trim(),
              hc:         document.getElementById('ed-hc').value.trim(),
            };
            if (!patch.familyName || !patch.familyKana) {
              window.glToast.warn('苗字は必須です');
              return;
            }
            await window.glProfile.update(patch);
            window.glToast.success('保存しました');
            handle.close();
            _render();
          });
        }
      },
    });
  }

  const glMyPageUI = {
    show() {
      _render();
      document.getElementById('view-mypage')?.classList.add('show');
      window.glState.set('phase', 'S4');
    },
    hide() {
      document.getElementById('view-mypage')?.classList.remove('show');
      const slot = document.getElementById('ad-slot-mypage');
      if (slot) window.glAdsUI.destroy(slot, 'mypage');
    },
  };

  window.glMyPageUI = glMyPageUI;
})();
