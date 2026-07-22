/**
 * G-LAND v2.7.1 - Score Theme: Simple (1ホール1画面)
 * ===================================================
 * 1ホールずつ、1プレイヤーずつ表示する超シンプルな入力UI。
 * 初心者・老眼配慮ユーザー向け。
 *
 * テーマローダー (js/ui/score.js) から呼び出される。
 * window.glScoreThemes.simple として登録される。
 */
(function () {
  'use strict';

  const HOLES = 18;
  let orientationMedia = null;

  function _injectStyles() {
    // v3.0.0: CSS は css/*.css に完全移管済み。互換のため関数は残置（no-op）。
    return;
  }

  function _renderTable() {
    const players = window.glState.get('players') || [];
    const scores = window.glState.get('scores') || {};
    const myUserId = window.glProfile.getUserId();
    const currentHole = window.glState.get('currentHole') || 1;

    const rows = players.map((p) => {
      const isMe = p.userId === myUserId;
      const strokes = scores?.[p.userId]?.['hole' + currentHole] ?? '';
      const cellClass = isMe ? 'gl-score__cell gl-score__cell--mine' : 'gl-score__cell gl-score__cell--peer';
      const disabledAttr = isMe ? '' : 'readonly';

      return `
        <tr>
          <td class="gl-name">${p.displayName || p.familyName || 'プレイヤー'}${isMe ? ' (あなた)' : ''}</td>
          <td>
            <input type="number" min="1" max="20" inputmode="numeric"
              class="${cellClass}" data-player-id="${p.userId}"
              value="${strokes}" ${disabledAttr}>
          </td>
        </tr>
      `;
    }).join('');

    return `
      <div class="gl-score__table-wrap">
        <table class="gl-score__table">
          <thead>
            <tr><th class="gl-u-97">プレイヤー</th><th>スコア</th></tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="2" class="gl-u-98">メンバーを読み込み中...</td></tr>'}</tbody>
        </table>
      </div>
    `;
  }

  function _render() {
    _injectStyles();
    const view = document.getElementById('view-score');
    if (!view) return;

    const groupCode = window.glState.get('groupCode') || '- - - -';
    const currentHole = window.glState.get('currentHole') || 1;

    view.innerHTML = `
      <div class="gl-score__topbar">
        <button class="gl-score__back" data-back>← 戻る</button>
        <div class="gl-score__code">コード: <b>${groupCode}</b></div>
      </div>

      ${_renderTable()}

      <div class="gl-score__hole-nav">
        <button data-hole-prev ${currentHole <= 1 ? 'disabled' : ''}>← 前</button>
        <div class="gl-score__hole-current">HOLE ${currentHole}</div>
        <button data-hole-next ${currentHole >= HOLES ? 'disabled' : ''}>次 →</button>
      </div>

      <div class="gl-score__bottom-actions">
        <button class="gl-score__btn-invite" data-invite>📤 招待</button>
        <button class="gl-score__btn-finish" data-finish>🏁 終了・保存</button>
      </div>

      <div id="ad-slot-score-landscape"></div>
    `;

    _bindEvents();
    _mountLandscapeAds();
  }

  function _bindEvents() {
    const view = document.getElementById('view-score');
    if (!view) return;

    view.querySelector('[data-back]').addEventListener('click', () => {
      // S6 離脱確認
      if (confirm('スコア入力を中断してホームに戻りますか？（入力済みスコアは保持されます）')) {
        window.glEvents.emit('ui:navigate', { view: 'home' });
      }
    });

    view.querySelector('[data-hole-prev]')?.addEventListener('click', () => {
      const h = window.glState.get('currentHole') || 1;
      if (h > 1) {
        window.glState.set('currentHole', h - 1);
        _render();
      }
    });

    view.querySelector('[data-hole-next]')?.addEventListener('click', () => {
      const h = window.glState.get('currentHole') || 1;
      if (h < HOLES) {
        window.glState.set('currentHole', h + 1);
        _render();
      }
    });

    view.querySelectorAll('input[data-player-id]').forEach((input) => {
      input.addEventListener('change', () => {
        const playerId = input.dataset.playerId;
        const hole = window.glState.get('currentHole') || 1;
        const val = parseInt(input.value, 10);
        if (isNaN(val) || val < 1) {
          input.value = '';
          return;
        }
        window.glScore.save(playerId, hole, val);
      });
    });

    view.querySelector('[data-invite]')?.addEventListener('click', () => {
      window.glEvents.emit('ui:navigate', { view: 'golf' });
      setTimeout(() => {
        window.glEvents.emit('round:show-invite', {});
      }, 100);
    });

    view.querySelector('[data-finish]').addEventListener('click', () => _finishRound());
  }

  function _mountLandscapeAds() {
    if (!orientationMedia) {
      orientationMedia = window.matchMedia('(orientation: landscape) and (min-height: 500px)');
      orientationMedia.addEventListener('change', () => _mountLandscapeAds());
    }

    const slot = document.getElementById('ad-slot-score-landscape');
    if (!slot) return;

    if (orientationMedia.matches) {
      window.glAdsUI.mount(slot, 'score-landscape');
    } else {
      window.glAdsUI.destroy(slot, 'score-landscape');
    }
  }

  function _finishRound() {
    if (!confirm('このラウンドを終了・保存しますか？')) return;

    const roundId = window.glState.get('roundId');
    const players = window.glState.get('players') || [];
    const scores = window.glState.get('scores') || {};

    const roundData = {
      roundId,
      endedAt: new Date().toISOString(),
      players,
      scores,
    };
    window.glHistory.saveRound(roundData);

    // プロフィール未完全なら S7b（次フェーズで拡張）
    if (!window.glProfile.isFull()) {
      window.glToast.info('プロフィールを完成させると詳細分析が使えます');
    }

    window.glRound.leave();
    window.glToast.success('ラウンドを保存しました');
    window.glEvents.emit('ui:navigate', { view: 'history' });
  }

  const glScoreUI = {
    show() {
      _render();
      document.getElementById('view-score')?.classList.add('show');
      window.glState.set('phase', 'S6');

      // スコア変更に応じてUI更新
      this._unsubState = window.glState.subscribe('scores', () => {
        // フォーカス中の要素は書き換えない
        if (document.activeElement?.tagName === 'INPUT') return;
        _render();
      });
      this._unsubPlayers = window.glState.subscribe('players', () => _render());
    },
    hide() {
      document.getElementById('view-score')?.classList.remove('show');
      const slot = document.getElementById('ad-slot-score-landscape');
      if (slot) window.glAdsUI.destroy(slot, 'score-landscape');
      if (this._unsubState) this._unsubState();
      if (this._unsubPlayers) this._unsubPlayers();
    },
  };

  // ⭐ テーマとして登録（テーマローダー経由で呼び出される）
  window.glScoreThemes = window.glScoreThemes || {};
  window.glScoreThemes.simple = {
    id: 'simple',
    name: 'シンプル',
    description: '1ホールずつ大きく表示。初心者向け',
    show: glScoreUI.show.bind(glScoreUI),
    hide: glScoreUI.hide.bind(glScoreUI),
  };

  // 後方互換のため window.glScoreUI も残す（simpleが選ばれた時のフォールバック）
  if (!window.glScoreUI) window.glScoreUI = glScoreUI;
})();
