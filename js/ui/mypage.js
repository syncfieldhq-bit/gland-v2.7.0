/**
 * G-LAND v2.8.11 - MyPage View UI
 * ===============================
 * プロフィール表示・編集モーダル・バージョン表示（最下部）
 * v2.8.11: マイページ大改造
 *   - スコアカード デザイン欄を削除
 *   - コース調整値 → HC（ハンディキャップ）に改名
 *   - ニックネーム項目を追加（ライブリーダーボード用）
 *   - ユーザーIDをタイトル直下に移動
 *   - 広告枠 ad-slot-mypage を空いたスペースに配置
 */
(function () {
  'use strict';

  const VERSION_LABEL = 'v2.8.11 (build: 20260717)';

  function _injectStyles() {
    if (document.getElementById('gl-mypage-styles')) return;
    const style = document.createElement('style');
    style.id = 'gl-mypage-styles';
    style.textContent = `
      #view-mypage {
        min-height: 100vh; padding: 16px; box-sizing: border-box;
        background: #f8f9fa; display: none; flex-direction: column;
      }
      #view-mypage.show { display: flex; }
      .gl-mypage__title { font-size: 22px; font-weight: 700; color: #1a5f3f; margin: 0 0 8px; }
      .gl-mypage__userid-card {
        background: #fff; padding: 10px 14px; border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0,0,0,.05); margin-bottom: 14px;
        font-size: 12px; color: #888;
      }
      .gl-mypage__userid-card span { font-family: monospace; color: #333; }
      .gl-mypage__card {
        background: #fff; padding: 18px; border-radius: 12px;
        box-shadow: 0 4px 12px rgba(0,0,0,.08); margin-bottom: 12px;
      }
      .gl-mypage__row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f0f0; }
      .gl-mypage__row:last-child { border-bottom: none; }
      .gl-mypage__label { color: #666; font-size: 14px; }
      .gl-mypage__value { color: #333; font-weight: 600; font-size: 14px; }
      .gl-mypage__value--empty { color: #ccc; font-weight: 400; }
      .gl-mypage__version {
        margin-top: auto; padding: 20px 0 8px;
        text-align: center; color: #999; font-size: 11px;
      }
      #ad-slot-mypage { margin-top: 18px; }
    `;
    document.head.appendChild(style);
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

      <div class="gl-mypage__card" style="margin-top:14px;">
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

  function _showEditModal() {
    const p = window.glProfile.getStored();
    // v2.8.11: 互換維持 - courseAdjust があれば hc として初期表示
    const hcValue = p.hc || p.courseAdjust || '';

    const wrap = document.createElement('div');
    wrap.className = 'gl-modal show';
    wrap.innerHTML = `
      <div class="gl-modal__backdrop"></div>
      <div class="gl-modal__body">
        <h2 class="gl-modal__title">プロフィール編集</h2>
        <div class="gl-form__group">
          <label class="gl-form__label">苗字（漢字）</label>
          <input class="gl-form__input" id="ed-family-name" value="${p.familyName || ''}">
        </div>
        <div class="gl-form__group">
          <label class="gl-form__label">苗字（ひらがな）</label>
          <input class="gl-form__input" id="ed-family-kana" value="${p.familyKana || ''}">
        </div>
        <div class="gl-form__group">
          <label class="gl-form__label">名前（漢字）</label>
          <input class="gl-form__input" id="ed-first-name" value="${p.firstName || ''}">
        </div>
        <div class="gl-form__group">
          <label class="gl-form__label">名前（ひらがな）</label>
          <input class="gl-form__input" id="ed-first-kana" value="${p.firstKana || ''}">
        </div>
        <div class="gl-form__group">
          <label class="gl-form__label">ニックネーム（ライブリーダーボード用）</label>
          <input class="gl-form__input" id="ed-nickname" value="${p.nickname || ''}" placeholder="例: たろちゃん">
        </div>
        <div class="gl-form__group">
          <label class="gl-form__label">HC（ハンディキャップ・任意）</label>
          <input class="gl-form__input" id="ed-hc" value="${hcValue}" placeholder="例: -2">
        </div>
        <button class="gl-btn-primary" data-save>保存</button>
        <button style="width:100%;padding:12px;margin-top:8px;background:none;border:none;color:#666;" data-cancel>キャンセル</button>
      </div>
    `;
    document.body.appendChild(wrap);

    const close = () => wrap.remove();

    wrap.querySelector('.gl-modal__backdrop').addEventListener('click', close);
    wrap.querySelector('[data-cancel]').addEventListener('click', close);
    wrap.querySelector('[data-save]').addEventListener('click', async () => {
      const patch = {
        familyName: document.getElementById('ed-family-name').value.trim(),
        familyKana: document.getElementById('ed-family-kana').value.trim(),
        firstName: document.getElementById('ed-first-name').value.trim(),
        firstKana: document.getElementById('ed-first-kana').value.trim(),
        nickname: document.getElementById('ed-nickname').value.trim(),
        hc: document.getElementById('ed-hc').value.trim(),
      };
      if (!patch.familyName || !patch.familyKana) {
        window.glToast.warn('苗字は必須です');
        return;
      }
      await window.glProfile.update(patch);
      window.glToast.success('保存しました');
      close();
      _render();
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
