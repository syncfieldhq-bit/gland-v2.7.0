/**
 * G-LAND v2.7.0 - MyPage View UI
 * ==============================
 * プロフィール表示・編集モーダル・バージョン表示（最下部）
 */
(function () {
  'use strict';

  const VERSION_LABEL = 'v2.7.0 (build: 20260709)';

  function _injectStyles() {
    if (document.getElementById('gl-mypage-styles')) return;
    const style = document.createElement('style');
    style.id = 'gl-mypage-styles';
    style.textContent = `
      /* テーマ切替セクション */
      .gl-mypage__theme-card { padding: 16px 18px; }
      .gl-mypage__theme-title {
        font-size: 15px; font-weight: 700; color: #1a5f3f; margin-bottom: 4px;
      }
      .gl-mypage__theme-hint {
        font-size: 12px; color: #888; margin-bottom: 12px;
      }
      .gl-mypage__theme-option {
        display: flex; align-items: flex-start; gap: 10px;
        padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px;
        margin-bottom: 8px; cursor: pointer; transition: all .15s;
      }
      .gl-mypage__theme-option:hover { background: #fafafa; }
      .gl-mypage__theme-option.active {
        border-color: #1a5f3f; background: #f0f7f2;
      }
      .gl-mypage__theme-option input[type="radio"] {
        margin-top: 2px; accent-color: #1a5f3f;
      }
      .gl-mypage__theme-option-body { flex: 1; }
      .gl-mypage__theme-option-name {
        font-size: 15px; font-weight: 700; color: #222; margin-bottom: 2px;
      }
      .gl-mypage__theme-option-desc {
        font-size: 12px; color: #666;
      }

      #view-mypage {
        min-height: 100vh; padding: 16px; box-sizing: border-box;
        background: #f8f9fa; display: none; flex-direction: column;
      }
      #view-mypage.show { display: flex; }
      .gl-mypage__title { font-size: 22px; font-weight: 700; color: #1a5f3f; margin: 0 0 16px; }
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
      #ad-slot-mypage { margin-top: 12px; }
    `;
    document.head.appendChild(style);
  }

  function _render() {
    _injectStyles();
    const view = document.getElementById('view-mypage');
    if (!view) return;

    const p = window.glProfile.getStored();
    const userId = p.userId || '未発行';

    const row = (label, value) =>
      `<div class="gl-mypage__row">
        <span class="gl-mypage__label">${label}</span>
        <span class="gl-mypage__value ${value ? '' : 'gl-mypage__value--empty'}">${value || '（未設定）'}</span>
      </div>`;

    view.innerHTML = `
      <button class="gl-round__back" data-back>← ホームへ戻る</button>
      <h1 class="gl-mypage__title">👤 マイページ</h1>

      <div class="gl-mypage__card">
        ${row('苗字（漢字）', p.familyName)}
        ${row('苗字（ひらがな）', p.familyKana)}
        ${row('名前（漢字）', p.firstName)}
        ${row('名前（ひらがな）', p.firstKana)}
        ${row('コース調整値', p.courseAdjust)}
      </div>

      <button class="gl-btn-primary" data-edit>✏️ プロフィールを編集</button>

      <div class="gl-mypage__card gl-mypage__theme-card" style="margin-top:18px;">
        <div class="gl-mypage__theme-title">🎨 スコアカード デザイン</div>
        <div class="gl-mypage__theme-hint">お好みのスコアカードを選べます（いつでも変更可能）</div>
        <div id="gl-theme-options"></div>
      </div>

      <div class="gl-mypage__card" style="margin-top:14px;font-size:12px;color:#888;">
        <div>ユーザーID: <span style="font-family:monospace;">${userId}</span></div>
      </div>

      <div id="ad-slot-mypage"></div>

      <div class="gl-mypage__version">${VERSION_LABEL}</div>
    `;

    view.querySelector('[data-back]').addEventListener('click', () => {
      window.glEvents.emit('ui:navigate', { view: 'home' });
    });
    view.querySelector('[data-edit]').addEventListener('click', () => _showEditModal());

    _renderThemeOptions();

    const adSlot = document.getElementById('ad-slot-mypage');
    if (adSlot) window.glAdsUI.mount(adSlot, 'mypage');
  }

  /**
   * ⭐ スコアカード テーマ切替 UI
   */
  function _renderThemeOptions() {
    const container = document.getElementById('gl-theme-options');
    if (!container || !window.glScoreUI) return;

    const themes = window.glScoreUI.listAvailable();
    const currentId = window.glScoreUI.getCurrentThemeId();

    container.innerHTML = themes.map((t) => `
      <label class="gl-mypage__theme-option ${t.id === currentId ? 'active' : ''}">
        <input type="radio" name="gl-theme" value="${t.id}" ${t.id === currentId ? 'checked' : ''}>
        <div class="gl-mypage__theme-option-body">
          <div class="gl-mypage__theme-option-name">${t.name}</div>
          <div class="gl-mypage__theme-option-desc">${t.description || ''}</div>
        </div>
      </label>
    `).join('');

    container.querySelectorAll('input[name="gl-theme"]').forEach((radio) => {
      radio.addEventListener('change', () => {
        const themeId = radio.value;
        if (window.glScoreUI.setTheme(themeId)) {
          window.glToast?.success(`テーマを「${themes.find(t => t.id === themeId)?.name}」に変更しました`);
          _renderThemeOptions(); // activeクラス更新
        }
      });
    });
  }

  function _showEditModal() {
    const p = window.glProfile.getStored();
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
          <label class="gl-form__label">コース調整値（任意）</label>
          <input class="gl-form__input" id="ed-adjust" value="${p.courseAdjust || ''}" placeholder="例: -2">
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
        courseAdjust: document.getElementById('ed-adjust').value.trim(),
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
