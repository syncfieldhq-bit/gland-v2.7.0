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
        min-height: 100vh; padding: 16px; box-sizing: border-box;
        background: #f8f9fa; display: none;
      }
      #view-golf.show { display: block; }
      .gl-round__back { background: none; border: none; color: #1a5f3f; font-size: 16px; cursor: pointer; padding: 8px 0; margin-bottom: 12px; }
      .gl-round__title { font-size: 22px; font-weight: 700; color: #1a5f3f; margin: 0 0 16px; }
      .gl-round__actions { display: flex; flex-direction: column; gap: 12px; }
      .gl-round__card {
        background: #fff; padding: 20px 18px; border-radius: 12px;
        box-shadow: 0 4px 12px rgba(0,0,0,.08); cursor: pointer;
      }
      .gl-round__card h3 { margin: 0 0 6px; color: #1a5f3f; font-size: 17px; }
      .gl-round__card p { margin: 0; color: #666; font-size: 13px; }
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

    view.querySelector('[data-back]').addEventListener('click', () => {
      window.glEvents.emit('ui:navigate', { view: 'home' });
    });

    view.querySelectorAll('[data-action]').forEach((el) => {
      el.addEventListener('click', () => _handleAction(el.dataset.action));
    });
  }

  async function _handleAction(action) {
    if (action === 'start') return _showStartConfirm();
    if (action === 'join') return _showJoinModal();
    if (action === 'invite') return _showInviteModal();
    if (action === 'score') return window.glEvents.emit('ui:navigate', { view: 'score' });
    if (action === 'leave') return _confirmLeave();
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

  function _showInviteModal() {
    const groupCode = window.glState.get('groupCode');
    const roundId = window.glState.get('roundId');
    const joinUrl = location.origin + location.pathname + '?join=' + (roundId || '');

    _modalPrompt({
      title: '📤 招待',
      body: `
        <div class="gl-invite-box">
          <div style="font-size:14px;opacity:.9;">招待コード</div>
          <div class="gl-invite-box__code">${groupCode || '- - - -'}</div>
          <div id="invite-qr-container" class="gl-invite-box__qr">
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

    // QR生成（非同期）
    setTimeout(() => _generateQR(joinUrl), 100);
  }

  function _generateQR(url) {
    const container = document.getElementById('invite-qr-container');
    if (!container) return;

    // QRCode.js (window.QRCode) が読み込まれている想定
    if (window.QRCode) {
      container.innerHTML = '';
      try {
        new window.QRCode(container, { text: url, width: 180, height: 180, correctLevel: window.QRCode.CorrectLevel.M });
      } catch (e) {
        container.innerHTML = '<div style="color:#f44336;">QR生成失敗</div>';
      }
    } else {
      // フォールバック: Google Chart API
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
  function _modalPrompt({ title, body, okLabel, onOk, allowClose = true }) {
    const wrap = document.createElement('div');
    wrap.className = 'gl-modal show';
    wrap.innerHTML = `
      <div class="gl-modal__backdrop"></div>
      <div class="gl-modal__body">
        <h2 class="gl-modal__title">${title}</h2>
        <div>${body}</div>
        <button class="gl-btn-primary" data-ok>${okLabel || 'OK'}</button>
      </div>
    `;
    document.body.appendChild(wrap);

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
