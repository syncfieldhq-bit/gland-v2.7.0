/**
 * G-LAND v2.7.0 - Round View UI
 * =============================
 * ラウンド開始・合流・招待QR/A123コード・コース選択
 */
(function () {
  'use strict';

  function _injectStyles() {
    if (document.getElementById('gl-round-styles')) return;
    const style = document.createElement('style');
    style.id = 'gl-round-styles';
    style.textContent = `
      #view-golf {
        min-height: 100vh;
        padding: calc(env(safe-area-inset-top, 0px) + 16px) 16px calc(env(safe-area-inset-bottom, 0px) + 16px);
        box-sizing: border-box;
        background: #f8f9fa; display: none;
      }
      #view-golf.show { display: block; }
      .gl-round__back {
        background: none; border: none; color: #1a5f3f; font-size: 16px;
        cursor: pointer; padding: 8px 4px; margin-bottom: 12px;
        -webkit-tap-highlight-color: rgba(0,0,0,.1);
        touch-action: manipulation;
      }
      .gl-round__title { font-size: 22px; font-weight: 700; color: #1a5f3f; margin: 0 0 16px; }
      .gl-round__actions { display: flex; flex-direction: column; gap: 12px; }
      .gl-round__card {
        background: #fff; padding: 20px 18px; border-radius: 12px;
        box-shadow: 0 4px 12px rgba(0,0,0,.08); cursor: pointer;
        -webkit-tap-highlight-color: rgba(26,95,63,.1);
        touch-action: manipulation;
        transition: transform .1s;
      }
      .gl-round__card:active { transform: scale(.98); }
      .gl-round__card h3 { margin: 0 0 6px; color: #1a5f3f; font-size: 17px; pointer-events: none; }
      .gl-round__card p { margin: 0; color: #666; font-size: 13px; pointer-events: none; }
      .gl-invite-box {
        background: linear-gradient(135deg, #1a5f3f, #2d7a56);
        color: #fff; padding: 24px 20px; border-radius: 14px; text-align: center;
      }
      .gl-invite-box__code {
        font-size: 48px; font-weight: 800; letter-spacing: 6px;
        margin: 12px 0; font-family: 'Courier New', monospace;
      }
      .gl-invite-box__qr { background: #fff; padding: 12px; border-radius: 10px; display: inline-block; margin: 8px 0; }
      .gl-invite-box__qr canvas, .gl-invite-box__qr img { display: block; }
      .gl-invite-box__hint { font-size: 13px; opacity: .9; }
      .gl-input-code {
        width: 100%; padding: 14px; font-size: 22px; text-align: center;
        letter-spacing: 6px; border: 2px solid #ddd; border-radius: 10px;
        box-sizing: border-box; text-transform: uppercase;
        font-family: 'Courier New', monospace;
      }
      .gl-spinner {
        display: inline-block; width: 32px; height: 32px;
        border: 3px solid rgba(255,255,255,.3); border-top-color: #fff;
        border-radius: 50%; animation: gl-spin 0.8s linear infinite;
      }
      @keyframes gl-spin { to { transform: rotate(360deg); } }
    `;
    document.head.appendChild(style);
  }

  function _renderIndex() {
    _injectStyles();
    const view = document.getElementById('view-golf');
    if (!view) return;

    const inRound = !!window.glState.get('roundId');
    const proxies = window.glRound.listProxyPlayers ? window.glRound.listProxyPlayers() : [];
    const maxProxy = window.glRound.getMaxProxy ? window.glRound.getMaxProxy() : 3;

    view.innerHTML = `
      <button class="gl-round__back" data-back>← ホームへ戻る</button>
      <h1 class="gl-round__title">🏌️ ラウンド</h1>
      <div class="gl-round__actions">
        ${inRound ? `
          <div class="gl-round__card" data-action="score">
            <h3>▶ スコア入力へ戻る</h3>
            <p>現在ラウンド進行中</p>
          </div>
          <div class="gl-round__card" data-action="invite">
            <h3>📤 招待</h3>
            <p>QRコード・4桁コードで仲間を呼ぶ</p>
          </div>
          <div class="gl-round__card" data-action="proxy">
            <h3>🧍 代理入力プレイヤー (${proxies.length}/${maxProxy})</h3>
            <p>スマホを使わない人の分を代打で入力</p>
          </div>
          <div class="gl-round__card" data-action="leave">
            <h3>🚪 ラウンドを終了</h3>
            <p>スコアカードから抜ける</p>
          </div>
        ` : `
          <div class="gl-round__card" data-action="start">
            <h3>🏌️ 新しいラウンドを開始</h3>
            <p>あなたがホストとなり、仲間を呼びます</p>
          </div>
          <div class="gl-round__card" data-action="join">
            <h3>👥 招待コードで合流</h3>
            <p>ホストから受け取った4桁コードを入力</p>
          </div>
        `}
      </div>
    `;

    // シンプルなクリック委任（子要素 pointer-events:none で target=カード保証）
    view.addEventListener('click', (e) => {
      const backBtn = e.target.closest('[data-back]');
      if (backBtn) {
        window.glEvents.emit('ui:navigate', { view: 'home' });
        return;
      }
      const card = e.target.closest('[data-action]');
      if (card) {
        _handleAction(card.dataset.action);
      }
    });
  }

  async function _handleAction(action) {
    console.log('[round] action:', action);
    if (action === 'start') return _showStartConfirm();
    if (action === 'join') return _showJoinModal();
    if (action === 'invite') return _showInviteModal();
    if (action === 'score') return window.glEvents.emit('ui:navigate', { view: 'score' });
    if (action === 'leave') return _confirmLeave();
    if (action === 'proxy') return _showProxyManagerModal();
  }

  /**
   * v2.7.20: 代理入力プレイヤー管理モーダル
   * - 既存モーダルがあれば先に全削除（多層化防止）
   * - 閉じずに連続追加可能（リスト・フォームだけ部分更新）
   */
  function _showProxyManagerModal() {
    // ★ 既存の同種モーダルを全削除
    document.querySelectorAll('[data-modal-type="proxy-manager"]').forEach((m) => m.remove());

    const wrap = document.createElement('div');
    wrap.className = 'gl-modal show';
    wrap.setAttribute('data-modal-type', 'proxy-manager');
    wrap.innerHTML = _renderProxyModalContent();
    (document.getElementById('modal-root') || document.body).appendChild(wrap);

    const close = () => wrap.remove();
    wrap.querySelector('.gl-modal__backdrop').addEventListener('click', close);

    _bindProxyModalEvents(wrap, close);
  }

  /**
   * 代理モーダルの内容を生成（部分更新でも使う）
   */
  function _renderProxyModalContent() {
    const proxies = window.glRound.listProxyPlayers();
    const max = window.glRound.getMaxProxy();
    const canAdd = proxies.length < max;

    const list = proxies.length === 0
      ? '<p style="color:#999;text-align:center;padding:16px 0;">まだ代理プレイヤーはいません</p>'
      : proxies.map((p) => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px;background:#faf6ec;border-radius:6px;margin-bottom:6px;">
            <div>
              <div style="font-weight:700;">${p.familyName || p.displayName}</div>
              ${p.familyKana ? `<div style="font-size:11px;color:#888;">${p.familyKana}</div>` : ''}
            </div>
            <button style="background:#f44336;color:#fff;border:none;padding:6px 10px;border-radius:4px;font-size:12px;cursor:pointer;" data-remove="${p.userId}">削除</button>
          </div>
        `).join('');

    return `
      <div class="gl-modal__backdrop"></div>
      <div class="gl-modal__body">
        <h2 class="gl-modal__title">🧍 代理入力プレイヤー</h2>
        <p style="font-size:13px;color:#666;">スマホを使わない人のスコアを代わりに入力できます（最大${max}名）</p>
        <div style="margin:12px 0;" data-proxy-list>${list}</div>
        <div data-proxy-form>
          ${canAdd ? `
            <h3 style="font-size:14px;color:#1a5f3f;margin:16px 0 8px;">新規追加</h3>
            <div class="gl-form__group">
              <label class="gl-form__label">名前 <span style="color:#f44336;">*</span></label>
              <input class="gl-form__input" data-proxy-name placeholder="例: 田中">
            </div>
            <div class="gl-form__group">
              <label class="gl-form__label">ふりがな（任意）</label>
              <input class="gl-form__input" data-proxy-kana placeholder="例: たなか">
            </div>
            <button class="gl-btn-primary" data-add>➕ 追加する</button>
          ` : `
            <p style="text-align:center;color:#ff9800;padding:12px;background:#fff8e1;border-radius:6px;font-size:13px;">上限に達しています</p>
          `}
        </div>
        <button style="width:100%;padding:12px;margin-top:10px;background:none;border:1px solid #ccc;border-radius:6px;color:#666;cursor:pointer;" data-close>閉じる</button>
      </div>
    `;
  }

  /**
   * v2.7.20: モーダル内のリスト・フォームだけを部分更新（モーダル自体は閉じない）
   */
  function _refreshProxyModalContent(wrap) {
    const body = wrap.querySelector('.gl-modal__body');
    if (!body) return;
    // リストとフォームだけ差し替え
    const newHTML = _renderProxyModalContent();
    // parse して必要部分のみ取り出す
    const temp = document.createElement('div');
    temp.innerHTML = newHTML;
    const newList = temp.querySelector('[data-proxy-list]');
    const newForm = temp.querySelector('[data-proxy-form]');
    const oldList = wrap.querySelector('[data-proxy-list]');
    const oldForm = wrap.querySelector('[data-proxy-form]');
    if (newList && oldList) oldList.innerHTML = newList.innerHTML;
    if (newForm && oldForm) oldForm.innerHTML = newForm.innerHTML;
    // 再バインド
    _bindProxyModalInner(wrap);
  }

  /**
   * モーダルの外側イベント（閉じるボタンなど）は一度だけバインド
   */
  function _bindProxyModalEvents(wrap, close) {
    wrap.querySelector('[data-close]')?.addEventListener('click', close);
    _bindProxyModalInner(wrap);
  }

  /**
   * モーダル内部のフォーム・削除ボタンをバインド（部分更新のたびに呼ぶ）
   */
  function _bindProxyModalInner(wrap) {
    // 追加ボタン
    const addBtn = wrap.querySelector('[data-add]');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        const nameEl = wrap.querySelector('[data-proxy-name]');
        const kanaEl = wrap.querySelector('[data-proxy-kana]');
        const name = (nameEl?.value || '').trim();
        const kana = (kanaEl?.value || '').trim();
        if (!name) {
          window.glToast.warn('名前は必須です');
          nameEl?.focus();
          return;
        }
        const player = window.glRound.addProxyPlayer({ familyName: name, familyKana: kana });
        if (player) {
          window.glToast.success(`${name} さんを追加しました`);
          // ★ モーダル閉じずに内容だけ更新
          _refreshProxyModalContent(wrap);
          _renderIndex();
        }
      });
    }

    // 削除ボタン
    wrap.querySelectorAll('[data-remove]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!confirm('この代理プレイヤーを削除しますか？')) return;
        window.glRound.removeProxyPlayer(btn.dataset.remove);
        window.glToast.info('削除しました');
        // ★ モーダル閉じずに内容だけ更新
        _refreshProxyModalContent(wrap);
        _renderIndex();
      });
    });
  }

  function _showStartConfirm() {
    const stored = window.glProfile.getStored();
    const hostName = stored.familyName || 'ホスト';
    _modalPrompt({
      title: '新しいラウンドを開始',
      body: `<p>${hostName}さんがホストとして開始します。</p><p style="color:#666;font-size:13px;">開始後、招待コードが発行されます。</p>`,
      okLabel: '開始する',
      onOk: async () => {
        window.glToast.info('ラウンドを開始中...');
        try {
          const result = await window.glRound.start(hostName);
          window.glToast.success('ラウンドを開始しました');
          _renderIndex();
          _showInviteModal(); // 開始直後に招待表示
        } catch (err) {
          // errors.handle 済み
        }
      },
    });
  }

  function _showJoinModal() {
    _modalPrompt({
      title: '招待コードで合流',
      body: `
        <p style="color:#666;font-size:14px;">ホストから受け取った4桁コードを入力してください</p>
        <input type="text" class="gl-input-code" id="join-code-input" maxlength="4" placeholder="A123">
      `,
      okLabel: '合流する',
      onOk: async () => {
        const code = (document.getElementById('join-code-input').value || '').trim().toUpperCase();
        if (!code) {
          window.glToast.warn('コードを入力してください');
          return false;
        }
        window.glToast.info('合流中...');
        try {
          await window.glRound.join(code);
          window.glToast.success('合流しました');
          _renderIndex();
          window.glEvents.emit('ui:navigate', { view: 'score' });
        } catch (err) {
          // handled
          return false;
        }
      },
    });
  }

  /**
   * v2.7.20: 招待モーダル
   * - 既存の招待モーダルを先に削除（多層化防止）
   * - QR生成は wrap 内の要素に対して行う（getElementById使わない）
   * - groupCode 未取得なら警告して開かない
   */
  function _showInviteModal() {
    // ★ 既存の招待モーダルを全削除
    document.querySelectorAll('[data-modal-type="invite"]').forEach((m) => m.remove());

    const groupCode = window.glState.get('groupCode');
    if (!groupCode) {
      window.glToast.warn('招待コードが取得できません。ラウンドを開始してください');
      return;
    }

    const joinUrl = location.origin + location.pathname + '?join=' + encodeURIComponent(groupCode);

    const wrap = _modalPrompt({
      title: '📤 招待',
      modalType: 'invite',
      body: `
        <div class="gl-invite-box">
          <div style="font-size:14px;opacity:.9;">招待コード</div>
          <div class="gl-invite-box__code">${groupCode}</div>
          <div class="gl-invite-box__qr" data-qr-container>
            <div class="gl-spinner"></div>
          </div>
          <div class="gl-invite-box__hint">
            QRを読み取るか、コードを入力して合流できます
          </div>
        </div>
      `,
      okLabel: '閉じる',
      onOk: () => true,
    });

    // ★ wrap（モーダル本体）内の要素に対してQR生成
    if (wrap) {
      setTimeout(() => {
        const container = wrap.querySelector('[data-qr-container]');
        if (container) _generateQRInContainer(container, joinUrl);
      }, 50);
    }
  }

  /**
   * v2.7.20: 指定されたコンテナ内にQRを生成
   */
  function _generateQRInContainer(container, url) {
    if (!container) return;
    if (window.QRCode) {
      container.innerHTML = '';
      try {
        new window.QRCode(container, { text: url, width: 180, height: 180, correctLevel: window.QRCode.CorrectLevel.M });
      } catch (e) {
        container.innerHTML = '<div style="color:#f44336;">QR生成失敗</div>';
      }
    } else {
      const src = 'https://chart.googleapis.com/chart?chs=180x180&cht=qr&chl=' + encodeURIComponent(url);
      container.innerHTML = `<img src="${src}" width="180" height="180" alt="QR">`;
    }
  }

  function _confirmLeave() {
    _modalPrompt({
      title: 'ラウンドを終了しますか？',
      body: '<p>スコアカードから抜けます。（進行中のスコアは保存されます）</p>',
      okLabel: '終了する',
      onOk: async () => {
        try {
          await window.glRound.leave();
          window.glToast.success('ラウンドを終了しました');
          _renderIndex();
        } catch (err) {}
      },
    });
  }

  /**
   * 汎用モーダル（round.js内共用）
   */
  /**
   * v2.7.20: modalType 対応 + wrap 返却（呼び出し側で内部要素を探せるように）
   */
  function _modalPrompt({ title, body, okLabel, onOk, allowClose = true, modalType = '' }) {
    const wrap = document.createElement('div');
    wrap.className = 'gl-modal show';
    if (modalType) wrap.setAttribute('data-modal-type', modalType);
    wrap.innerHTML = `
      <div class="gl-modal__backdrop"></div>
      <div class="gl-modal__body">
        <h2 class="gl-modal__title">${title}</h2>
        <div>${body}</div>
        <button class="gl-btn-primary" data-ok>${okLabel || 'OK'}</button>
      </div>
    `;
    const modalRoot = document.getElementById('modal-root') || document.body;
modalRoot.appendChild(wrap);

    const close = () => {
      wrap.classList.remove('show');
      setTimeout(() => wrap.remove(), 300);
    };

    wrap.querySelector('[data-ok]').addEventListener('click', async () => {
      const result = onOk ? await onOk() : true;
      if (result !== false) close();
    });

    if (allowClose) {
      wrap.querySelector('.gl-modal__backdrop').addEventListener('click', close);
    }

    return wrap;  // ★ v2.7.20: wrap を返して呼び出し側が内部要素へアクセスできるように
  }

  const glRoundUI = {
    show() {
      _renderIndex();
      document.getElementById('view-golf')?.classList.add('show');
      window.glState.set('phase', 'S5');
    },
    hide() {
      document.getElementById('view-golf')?.classList.remove('show');
    },
  };

  window.glRoundUI = glRoundUI;
  window.glEvents?.on('round:started', () => _renderIndex());
  window.glEvents?.on('round:joined', () => _renderIndex());
  window.glEvents?.on('round:left', () => _renderIndex());
})();
