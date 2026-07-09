/**
 * G-LAND v2.7.0 - History View UI
 */
(function () {
  'use strict';

  function _injectStyles() {
    if (document.getElementById('gl-history-styles')) return;
    const style = document.createElement('style');
    style.id = 'gl-history-styles';
    style.textContent = `
      #view-history {
        min-height: 100vh; padding: 16px; box-sizing: border-box;
        background: #f8f9fa; display: none;
      }
      #view-history.show { display: block; }
      .gl-history__title { font-size: 22px; font-weight: 700; color: #1a5f3f; margin: 0 0 16px; }
      .gl-history__item {
        background: #fff; padding: 14px 16px; border-radius: 10px;
        box-shadow: 0 2px 8px rgba(0,0,0,.06); margin-bottom: 10px;
      }
      .gl-history__date { font-size: 13px; color: #888; }
      .gl-history__course { font-size: 16px; font-weight: 700; color: #333; margin: 4px 0; }
      .gl-history__players { font-size: 13px; color: #666; }
      .gl-history__empty { text-align: center; padding: 40px 20px; color: #999; }
    `;
    document.head.appendChild(style);
  }

  function _render() {
    _injectStyles();
    const view = document.getElementById('view-history');
    if (!view) return;

    const rounds = window.glHistory.list();

    const items = rounds.length === 0
      ? '<div class="gl-history__empty">まだ履歴がありません<br>ラウンドを始めましょう！</div>'
      : rounds.map((r) => {
          const date = r.startedAt ? new Date(r.startedAt).toLocaleDateString('ja-JP') : '';
          const course = r.courseName || 'コース未設定';
          const playerNames = (r.players || []).map((p) => p.displayName || p.familyName || '?').join('、');
          return `
            <div class="gl-history__item" data-round-id="${r.roundId}">
              <div class="gl-history__date">${date}</div>
              <div class="gl-history__course">${course}</div>
              <div class="gl-history__players">${playerNames}</div>
            </div>
          `;
        }).join('');

    view.innerHTML = `
      <button class="gl-round__back" data-back>← ホームへ戻る</button>
      <h1 class="gl-history__title">📖 履歴</h1>
      <div>${items}</div>
    `;

    view.querySelector('[data-back]').addEventListener('click', () => {
      window.glEvents.emit('ui:navigate', { view: 'home' });
    });
  }

  const glHistoryUI = {
    show() {
      _render();
      document.getElementById('view-history')?.classList.add('show');
      window.glState.set('phase', 'S8');
    },
    hide() {
      document.getElementById('view-history')?.classList.remove('show');
    },
  };

  window.glHistoryUI = glHistoryUI;
})();
