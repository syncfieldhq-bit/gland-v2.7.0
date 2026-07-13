/**
 * G-LAND v2.8.0 - MyPage View UI
 * ==============================
 * プロフィール表示・編集モーダル・バージョン表示（最下部）
 * v2.8.0: Firebase アカウント情報 + ニックネーム項目を追加、ログアウトボタン
 */
(function () {
  'use strict';

  const VERSION_LABEL = 'v2.8.0-rev5 (build: 20260713)';

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

  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function _render() {
    _injectStyles();
    const view = document.getElementById('view-mypage');
    if (!view) return;

    const p = window.glProfile.getStored();
    const userId = p.userId || '未発行';
    const authUser = window.glAuth && window.glAuth.getUser ? window.glAuth.getUser() : null;

    const row = (label, value, isRequired) => {
      const requiredMark = isRequired && !value
        ? '<span style="color:#f44336;font-size:11px;margin-left:6px;">履歴閉覧に必須</span>'
        : '';
      return `<div class="gl-mypage__row">
        <span class="gl-mypage__label">${label}${requiredMark}</span>
        <span class="gl-mypage__value ${value ? '' : 'gl-mypage__value--empty'}">${_esc(value) || '（未設定）'}</span>
      </div>`;
    };

    const firebaseCard = authUser ? `
      <div class="gl-mypage__card">
        <div style="font-size:14px;font-weight:700;color:#1a5f3f;margin-bottom:8px;">🔥 Google アカウント</div>
        <div style="display:flex;align-items:center;gap:10px;padding:8px 0;">
          ${authUser.photoURL ? `<img src="${_esc(authUser.photoURL)}" style="width:40px;height:40px;border-radius:50%;" alt="">` : ''}
          <div style="flex:1;min-width:0;">
            <div style="font-size:14px;font-weight:600;">${_esc(authUser.displayName || '(名前なし)')}</div>
            <div style="font-size:11px;color:#999;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${_esc(authUser.email || '')}</div>
          </div>
        </div>
        <button data-logout style="width:100%;padding:10px;margin-top:8px;background:#fff;color:#d32f2f;border:1px solid #d32f2f;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">🚪 ログアウト</button>
      </div>
    ` : '';

    view.innerHTML = `
      <button class="gl-round__back" data-back>← ホームへ戻る</button>
      <h1 class="gl-mypage__title">👤 マイページ</h1>

      ${firebaseCard}

      <div class="gl-mypage__card">
        <div style="font-size:14px;font-weight:700;color:#1a5f3f;margin-bottom:8px;">プロフィール</div>
        ${row('姓（漢字）', p.familyName, false)}
        ${row('姓（ひらがな）', p.familyKana, false)}
        ${row('名（漢字）', p.firstName, true)}
        ${row('名（ひらがな）', p.firstKana, true)}
        ${row('ニックネーム', p.nickname, true)}
      </div>

      <button class="gl-btn-primary" data-edit>✏️ プロフィールを編集</button>

      <div class="gl-mypage__card gl-mypage__theme-card" style="margin-top:18px;">
        <div class="gl-mypage__theme-title">🎨 スコアカード デザイン</div>
        <div class="gl-mypage__theme-hint">お好みのスコアカードを選べます（いつでも変更可能）</div>
        <div id="gl-theme-options"></div>
      </div>

      <div class="gl-mypage__card" style="margin-top:14px;font-size:12px;color:#888;">
        <div>ユーザーID: <span style="font-family:monospace;">${_esc(userId)}</span></div>
        ${authUser ? `<div style="margin-top:4px;">Firebase UID: <span style="font-family:monospace;font-size:10px;">${_esc((authUser.uid || '').slice(0,16))}...</span></div>` : ''}
      </div>

      <div id="ad-slot-mypage"></div>

      <!-- 【v2.8.0-rev5】非常時の復旧ボタン -->
      <div class="gl-mypage__card" style="margin-top:14px;background:#fffbf0;border:1px solid #ffcc80;">
        <div style="font-size:13px;font-weight:700;color:#d84315;margin-bottom:6px;">⚠️ もしアプリの調子が悪い場合</div>
        <div style="font-size:11px;color:#666;line-height:1.5;margin-bottom:10px;">
          不具合が続く場合は、アプリをリセットして新規登録からやり直してください。<br>
          （クラウド保存された履歴データは消えません）
        </div>
        <button data-reset-app style="width:100%;padding:10px;background:#fff;color:#d84315;border:1px solid #d84315;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">🔄 アプリをリセットしてユーザー登録をやり直す</button>
      </div>

      <div class="gl-mypage__version">${VERSION_LABEL}</div>
    `;

    view.querySelector('[data-back]').addEventListener('click', () => {
      window.glEvents.emit('ui:navigate', { view: 'home' });
    });
    view.querySelector('[data-edit]').addEventListener('click', () => _showEditModal());

    const logoutBtn = view.querySelector('[data-logout]');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        if (!confirm('ログアウトしますか？\n\nもう一度ログインすればデータは復元されます。')) return;
        try {
          await window.glAuth.signOut();
          window.glToast.success('ログアウトしました。再読み込みします...');
          setTimeout(() => location.reload(), 800);
        } catch (err) {
          window.glToast.error('ログアウトに失敗しました');
        }
      });
    }

    _renderThemeOptions();

    // 【v2.8.0-rev5】アプリリセットボタン
    const resetBtn = view.querySelector('[data-reset-app]');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (!confirm('アプリをリセットしますか？\n\n・プロフィール入力やり直し\n・ローカルデータ全削除\n\n※クラウドの履歴データは残ります')) return;
        try {
          // localStorage 全削除
          try {
            const keys = [];
            for (let i = 0; i < localStorage.length; i++) {
              const k = localStorage.key(i);
              if (k && (k.startsWith('gl_') || k.startsWith('firebase:'))) keys.push(k);
            }
            keys.forEach(k => localStorage.removeItem(k));
          } catch (e) {}
          // sessionStorage もクリア
          try { sessionStorage.clear(); } catch (e) {}
          // Service Worker のキャッシュもクリア
          if ('caches' in window) {
            caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
          }
          if (window.glLoading) window.glLoading.show('リセット中...');
          setTimeout(() => location.reload(), 500);
        } catch (err) {
          alert('リセットに失敗しました: ' + (err.message || err));
        }
      });
    }

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
    wrap.style.zIndex = '9700';
    wrap.innerHTML = `
      <div class="gl-modal__backdrop"></div>
      <div class="gl-modal__body">
        <h2 class="gl-modal__title">プロフィール編集</h2>
        <p style="font-size:12px;color:#999;margin:0 0 12px;">スコア・履歴に表示される情報を編集できます。</p>
        <div class="gl-form__group">
          <label class="gl-form__label">姓（漢字）<span style="color:#f44336;">*</span></label>
          <input class="gl-form__input" id="ed-family-name" value="${_esc(p.familyName || '')}">
        </div>
        <div class="gl-form__group">
          <label class="gl-form__label">姓（ひらがな）<span style="color:#f44336;">*</span></label>
          <input class="gl-form__input" id="ed-family-kana" value="${_esc(p.familyKana || '')}">
        </div>
        <div class="gl-form__group">
          <label class="gl-form__label">名（漢字）<span style="color:#f44336;font-size:11px;">履歴閉覧時必須</span></label>
          <input class="gl-form__input" id="ed-first-name" value="${_esc(p.firstName || '')}">
        </div>
        <div class="gl-form__group">
          <label class="gl-form__label">名（ひらがな）<span style="color:#f44336;font-size:11px;">履歴閉覧時必須</span></label>
          <input class="gl-form__input" id="ed-first-kana" value="${_esc(p.firstKana || '')}">
        </div>
        <div class="gl-form__group">
          <label class="gl-form__label">ニックネーム<span style="color:#f44336;font-size:11px;">履歴閉覧時必須</span></label>
          <input class="gl-form__input" id="ed-nickname" value="${_esc(p.nickname || '')}" placeholder="例: しんちゃん">
          <div style="font-size:11px;color:#999;margin-top:4px;">ホーム画面やマイページで使用します</div>
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
      };
      if (!patch.familyName || !patch.familyKana) {
        window.glToast.warn('姓（漢字・ひらがな）は必須です');
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
