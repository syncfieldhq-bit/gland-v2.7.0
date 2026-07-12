/**
 * G-LAND v2.7.17 - History View UI
 * ================================
 * Phase 2A: 履歴一覧（KPI・フィルタ・BESTバッジ）
 * Phase 2B: 履歴詳細（18Hスコアカード・OUT/IN/TOTAL・同伴者）
 * Phase 2C: ベスト更新演出（絵文字＋トロフィー）
 *
 * デザイン方針: 深緑 (#1a5f3f) × クリーム (#faf6ec) の落ち着いたクラシック
 */
(function () {
  'use strict';

  const COLOR_DARK = '#1a5f3f';
  const COLOR_CREAM = '#faf6ec';
  const COLOR_ACCENT = '#c9a959';

  let currentFilter = { courseName: '' };
  let currentDetailId = null; // roundId

  function _num(v) {
    const n = parseInt(v, 10);
    return isNaN(n) ? 0 : n;
  }

  function _fmtDate(iso) {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const w = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
      return `${y}/${m}/${dd}(${w})`;
    } catch (e) {
      return String(iso).slice(0, 10);
    }
  }

  function _diffStr(diff) {
    const n = _num(diff);
    if (n === 0) return 'E';
    return n > 0 ? '+' + n : String(n);
  }

  function _diffColor(diff) {
    const n = _num(diff);
    if (n < 0) return '#c0392b';   // 赤（Under）
    if (n === 0) return '#333';    // 黒（E）
    if (n <= 9) return '#333';
    return '#666';
  }

  function _injectStyles() {
    if (document.getElementById('gl-history-styles')) return;
    const style = document.createElement('style');
    style.id = 'gl-history-styles';
    style.textContent = `
      #view-history {
        min-height: 100vh; padding: 12px 14px 60px;
        box-sizing: border-box;
        background: ${COLOR_CREAM};
        display: none; overflow-y: auto;
        font-family: -apple-system, BlinkMacSystemFont, 'Hiragino Sans', sans-serif;
      }
      #view-history.show { display: block; }

      .glh-back {
        background: transparent; border: none;
        color: ${COLOR_DARK}; font-size: 15px; font-weight: 700;
        padding: 8px 4px; cursor: pointer; margin-bottom: 4px;
      }
      .glh-title {
        font-size: 22px; font-weight: 800;
        color: ${COLOR_DARK}; margin: 4px 0 12px;
        display: flex; align-items: center; gap: 6px;
      }

      /* KPI カード */
      .glh-kpi {
        display: grid; grid-template-columns: repeat(3, 1fr);
        gap: 8px; margin-bottom: 14px;
      }
      .glh-kpi__card {
        background: #fff; border-radius: 10px; padding: 10px 8px;
        text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,0.06);
        border: 1px solid #e8e0cc;
      }
      .glh-kpi__label {
        font-size: 10px; color: #888; letter-spacing: .5px;
        margin-bottom: 4px;
      }
      .glh-kpi__value {
        font-size: 22px; font-weight: 800; color: ${COLOR_DARK};
        line-height: 1;
      }
      .glh-kpi__unit { font-size: 11px; color: #888; margin-left: 2px; font-weight: 500; }

      /* フィルタ */
      .glh-filter {
        display: flex; gap: 8px; margin-bottom: 12px; align-items: center;
        overflow-x: auto; white-space: nowrap; padding-bottom: 4px;
      }
      .glh-filter__label { font-size: 12px; color: #666; flex-shrink: 0; }
      .glh-filter__chip {
        background: #fff; border: 1px solid #d5c98c;
        padding: 5px 12px; border-radius: 16px;
        font-size: 13px; color: ${COLOR_DARK};
        cursor: pointer; flex-shrink: 0;
      }
      .glh-filter__chip.active {
        background: ${COLOR_DARK}; color: #fff; border-color: ${COLOR_DARK};
      }

      /* リストアイテム */
      .glh-item {
        background: #fff; border-radius: 10px;
        padding: 12px 14px; margin-bottom: 10px;
        box-shadow: 0 2px 8px rgba(0,0,0,.06);
        border-left: 4px solid transparent;
        cursor: pointer;
        transition: transform .1s;
      }
      .glh-item:active { transform: scale(.98); }
      .glh-item.is-best { border-left-color: ${COLOR_ACCENT}; background: linear-gradient(90deg, #fff9e6 0%, #fff 40%); }

      .glh-item__row1 {
        display: flex; justify-content: space-between; align-items: baseline;
        margin-bottom: 4px;
      }
      .glh-item__date { font-size: 12px; color: #888; }
      .glh-item__best {
        font-size: 11px; font-weight: 700; color: ${COLOR_ACCENT};
        background: #fff3d6; padding: 2px 8px; border-radius: 10px;
      }
      .glh-item__course {
        font-size: 15px; font-weight: 700; color: #222;
        margin-bottom: 6px; letter-spacing: .3px;
      }
      .glh-item__row3 {
        display: flex; justify-content: space-between; align-items: flex-end;
      }
      .glh-item__score {
        font-size: 28px; font-weight: 800; color: ${COLOR_DARK}; line-height: 1;
      }
      .glh-item__diff {
        font-size: 14px; font-weight: 700; margin-left: 6px;
      }
      .glh-item__meta {
        font-size: 11px; color: #999; text-align: right;
      }

      .glh-empty {
        text-align: center; padding: 60px 20px;
        color: #999; font-size: 14px;
      }
      .glh-empty__icon { font-size: 48px; margin-bottom: 12px; }

      /* ==== 詳細画面 ==== */
      .glh-detail { padding: 4px 2px; }
      .glh-detail__header {
        background: ${COLOR_DARK}; color: #fff;
        padding: 14px 16px; border-radius: 12px;
        margin-bottom: 14px; position: relative; overflow: hidden;
      }
      .glh-detail__header.is-best::before {
        content: '🏆'; position: absolute; right: 8px; top: 4px;
        font-size: 44px; opacity: .25;
      }
      .glh-detail__date { font-size: 11px; opacity: .8; }
      .glh-detail__course {
        font-size: 18px; font-weight: 700; margin: 4px 0 8px;
      }
      .glh-detail__stats {
        display: flex; gap: 14px; align-items: baseline;
      }
      .glh-detail__total {
        font-size: 34px; font-weight: 800; line-height: 1;
      }
      .glh-detail__diff { font-size: 18px; font-weight: 700; }

      .glh-card {
        background: #fff; border-radius: 10px; padding: 8px;
        margin-bottom: 12px; box-shadow: 0 2px 6px rgba(0,0,0,.06);
        overflow-x: auto;
      }
      .glh-card__title {
        font-size: 12px; color: #666; font-weight: 700;
        padding: 4px 6px 6px; letter-spacing: .5px;
      }
      table.glh-scorecard {
        width: 100%; border-collapse: collapse; font-size: 12px;
      }
      .glh-scorecard th, .glh-scorecard td {
        border: 1px solid #e6e0d0;
        padding: 5px 3px; text-align: center;
        min-width: 28px;
      }
      .glh-scorecard th {
        background: #f5efd8; color: ${COLOR_DARK}; font-weight: 700;
      }
      .glh-scorecard .glh-sc-out, .glh-scorecard .glh-sc-in, .glh-scorecard .glh-sc-tot {
        background: #ecf7ef; font-weight: 700; color: ${COLOR_DARK};
      }
      .glh-scorecard .glh-sc-label {
        text-align: left; padding-left: 8px; font-weight: 700; background: #fbf7e6;
      }
      .glh-under { color: #c0392b; font-weight: 800; }

      /* 同伴者 */
      .glh-comp {
        display: flex; gap: 8px; overflow-x: auto; padding: 6px 2px;
      }
      .glh-comp__item {
        min-width: 130px; flex-shrink: 0;
        background: #fff; border-radius: 8px; padding: 8px 10px;
        box-shadow: 0 1px 3px rgba(0,0,0,.06);
        border: 1px solid #e8e0cc;
      }
      .glh-comp__name { font-size: 13px; font-weight: 700; color: #333; }
      .glh-comp__score { font-size: 20px; font-weight: 800; color: ${COLOR_DARK}; margin-top: 2px; }
      .glh-comp__type { font-size: 10px; color: #999; }

      /* ベスト更新モーダル */
      .glh-best-modal {
        position: fixed; inset: 0; z-index: 9999;
        background: rgba(0,0,0,.65);
        display: flex; align-items: center; justify-content: center;
        opacity: 0; transition: opacity .3s;
      }
      .glh-best-modal.show { opacity: 1; }
      .glh-best-modal__box {
        background: linear-gradient(160deg, #faf6ec 0%, #fff9e6 100%);
        padding: 30px 28px 22px; border-radius: 16px;
        text-align: center; max-width: 320px; width: 84%;
        box-shadow: 0 8px 40px rgba(0,0,0,.4);
      }
      .glh-best-modal__icon { font-size: 68px; line-height: 1; }
      .glh-best-modal__title {
        font-size: 22px; font-weight: 800; color: ${COLOR_ACCENT};
        margin: 8px 0 4px;
      }
      .glh-best-modal__msg { font-size: 14px; color: #555; margin-bottom: 16px; }
      .glh-best-modal__btn {
        background: ${COLOR_DARK}; color: #fff; border: none;
        padding: 10px 32px; border-radius: 22px;
        font-size: 15px; font-weight: 700; cursor: pointer;
      }
    `;
    document.head.appendChild(style);
  }

  // ==== 一覧描画 ====

  function _renderList(view) {
    const allRounds = window.glHistory.list();
    const rounds = currentFilter.courseName
      ? allRounds.filter((r) => r.courseName === currentFilter.courseName)
      : allRounds;

    const kpi = window.glHistory.kpi(currentFilter);
    const courses = window.glHistory.listCourses();

    const kpiHTML = `
      <div class="glh-kpi">
        <div class="glh-kpi__card">
          <div class="glh-kpi__label">ROUNDS</div>
          <div class="glh-kpi__value">${kpi.count}<span class="glh-kpi__unit">回</span></div>
        </div>
        <div class="glh-kpi__card">
          <div class="glh-kpi__label">AVERAGE</div>
          <div class="glh-kpi__value">${kpi.avgStrokes || '-'}</div>
        </div>
        <div class="glh-kpi__card">
          <div class="glh-kpi__label">BEST</div>
          <div class="glh-kpi__value">${kpi.bestStrokes || '-'}</div>
        </div>
      </div>
    `;

    const chipsHTML = courses.length === 0 ? '' : `
      <div class="glh-filter">
        <span class="glh-filter__label">コース：</span>
        <button class="glh-filter__chip ${!currentFilter.courseName ? 'active' : ''}" data-course="">すべて</button>
        ${courses.map((c) => `
          <button class="glh-filter__chip ${currentFilter.courseName === c ? 'active' : ''}" data-course="${_escape(c)}">${_escape(c)}</button>
        `).join('')}
      </div>
    `;

    const itemsHTML = rounds.length === 0
      ? `
        <div class="glh-empty">
          <div class="glh-empty__icon">📖</div>
          <div>まだ履歴がありません</div>
          <div style="margin-top:6px;font-size:12px;color:#bbb;">ラウンドを終えると自動で保存されます</div>
        </div>
      `
      : rounds.map((r) => {
          const total = _num(r.totalStrokes);
          const diff = _num(r.totalDiff);
          const putts = _num(r.totalPutts);
          return `
            <div class="glh-item ${r.isBest ? 'is-best' : ''}" data-round-id="${_escape(r.roundId)}">
              <div class="glh-item__row1">
                <span class="glh-item__date">${_fmtDate(r.endedAt || r.startedAt)}</span>
                ${r.isBest ? '<span class="glh-item__best">🏆 BEST</span>' : ''}
              </div>
              <div class="glh-item__course">${_escape(r.courseName || 'コース未設定')}</div>
              <div class="glh-item__row3">
                <div>
                  <span class="glh-item__score">${total || '-'}</span>
                  <span class="glh-item__diff" style="color:${_diffColor(diff)}">${total ? _diffStr(diff) : ''}</span>
                </div>
                <div class="glh-item__meta">
                  ${putts ? `Putts ${putts}` : ''}
                  ${r.lockerNumber ? `<br>Locker ${_escape(r.lockerNumber)}` : ''}
                </div>
              </div>
            </div>
          `;
        }).join('');

    view.innerHTML = `
      <button class="glh-back" data-back>← ホームへ戻る</button>
      <h1 class="glh-title">📖 履歴</h1>
      ${kpiHTML}
      ${chipsHTML}
      <div class="glh-list">${itemsHTML}</div>
    `;

    view.querySelector('[data-back]')?.addEventListener('click', () => {
      window.glEvents.emit('ui:navigate', { view: 'home' });
    });
    view.querySelectorAll('.glh-filter__chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        currentFilter.courseName = btn.getAttribute('data-course') || '';
        _renderList(view);
      });
    });
    view.querySelectorAll('.glh-item').forEach((el) => {
      el.addEventListener('click', () => {
        const rid = el.getAttribute('data-round-id');
        if (rid) {
          currentDetailId = rid;
          _renderDetail(view, rid);
        }
      });
    });
  }

  // ==== 詳細描画 ====

  function _renderDetail(view, roundId) {
    const r = window.glHistory.get(roundId);
    if (!r) {
      _renderList(view);
      return;
    }

    let holes = {};
    try { holes = JSON.parse(r.holesJson || '{}'); } catch (e) { holes = {}; }
    let companions = [];
    try { companions = JSON.parse(r.companionsJson || '[]'); } catch (e) { companions = []; }

    // 1-9 (OUT) / 10-18 (IN) テーブル生成
    const buildRow = (label, key, from, to) => {
      let cells = `<td class="glh-sc-label">${label}</td>`;
      let sum = 0;
      for (let h = from; h <= to; h++) {
        const v = holes['h' + h] ? _num(holes['h' + h][key]) : 0;
        sum += v;
        cells += `<td>${v || '-'}</td>`;
      }
      cells += `<td class="glh-sc-${from === 1 ? 'out' : 'in'}">${sum || '-'}</td>`;
      return `<tr>${cells}</tr>`;
    };

    const headerRow = (from, to, label) => {
      let cells = `<th class="glh-sc-label">H</th>`;
      for (let h = from; h <= to; h++) cells += `<th>${h}</th>`;
      cells += `<th class="glh-sc-${from === 1 ? 'out' : 'in'}">${label}</th>`;
      return `<tr>${cells}</tr>`;
    };

    const outTable = `
      <table class="glh-scorecard">
        <thead>${headerRow(1, 9, 'OUT')}</thead>
        <tbody>
          ${buildRow('Par', 'par', 1, 9)}
          ${buildRow('Score', 'strokes', 1, 9)}
          ${buildRow('Putt', 'putts', 1, 9)}
        </tbody>
      </table>
    `;
    const inTable = `
      <table class="glh-scorecard">
        <thead>${headerRow(10, 18, 'IN')}</thead>
        <tbody>
          ${buildRow('Par', 'par', 10, 18)}
          ${buildRow('Score', 'strokes', 10, 18)}
          ${buildRow('Putt', 'putts', 10, 18)}
        </tbody>
      </table>
    `;

    const compHTML = companions.length === 0 ? '' : `
      <div class="glh-card__title">同伴者</div>
      <div class="glh-comp">
        ${companions.map((c) => `
          <div class="glh-comp__item">
            <div class="glh-comp__name">${_escape(c.displayName)}</div>
            <div class="glh-comp__score">${_num(c.totalStrokes) || '-'}</div>
            <div class="glh-comp__type">${c.type === 'proxy' ? '代理' : c.type === 'shared' ? '共有' : '自分'}</div>
          </div>
        `).join('')}
      </div>
    `;

    const diff = _num(r.totalDiff);

    view.innerHTML = `
      <button class="glh-back" data-back-list>← 履歴一覧へ</button>
      <div class="glh-detail">
        <div class="glh-detail__header ${r.isBest ? 'is-best' : ''}">
          <div class="glh-detail__date">${_fmtDate(r.endedAt || r.startedAt)}</div>
          <div class="glh-detail__course">${_escape(r.courseName || 'コース未設定')}</div>
          <div class="glh-detail__stats">
            <div>
              <div class="glh-detail__total">${_num(r.totalStrokes) || '-'}</div>
              <div style="font-size:10px;opacity:.8;">TOTAL</div>
            </div>
            <div class="glh-detail__diff">${_num(r.totalStrokes) ? _diffStr(diff) : ''}</div>
            <div style="margin-left:auto;text-align:right;font-size:11px;opacity:.9;">
              OUT ${_num(r.outStrokes) || '-'}<br>
              IN ${_num(r.inStrokes) || '-'}<br>
              Putts ${_num(r.totalPutts) || '-'}
            </div>
          </div>
          ${r.lockerNumber ? `<div style="margin-top:8px;font-size:11px;opacity:.85;">ロッカー ${_escape(r.lockerNumber)}</div>` : ''}
        </div>

        <div class="glh-card">
          <div class="glh-card__title">OUT (1-9)</div>
          ${outTable}
        </div>
        <div class="glh-card">
          <div class="glh-card__title">IN (10-18)</div>
          ${inTable}
        </div>

        ${compHTML ? `<div class="glh-card">${compHTML}</div>` : ''}
      </div>
    `;

    view.querySelector('[data-back-list]')?.addEventListener('click', () => {
      currentDetailId = null;
      _renderList(view);
    });
  }

  function _escape(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ==== 2C: BEST 更新演出 ====

  function _showBestCelebration(snapshot) {
    const modal = document.createElement('div');
    modal.className = 'glh-best-modal';
    modal.innerHTML = `
      <div class="glh-best-modal__box">
        <div class="glh-best-modal__icon">🏆✨</div>
        <div class="glh-best-modal__title">BEST 更新！</div>
        <div class="glh-best-modal__msg">
          ${_escape(snapshot.courseName || 'このコース')}<br>
          <b style="color:${COLOR_DARK};font-size:20px;">${_num(snapshot.totalStrokes)}</b>
          <span style="color:#c0392b;font-weight:700;">${_diffStr(_num(snapshot.totalDiff))}</span>
        </div>
        <button class="glh-best-modal__btn" data-close>やった！</button>
      </div>
    `;
    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('show'));
    const close = () => {
      modal.classList.remove('show');
      setTimeout(() => modal.remove(), 300);
    };
    modal.querySelector('[data-close]')?.addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  }

  const glHistoryUI = {
    show() {
      _injectStyles();
      const view = document.getElementById('view-history');
      if (!view) return;
      view.classList.add('show');
      window.glState && window.glState.set && window.glState.set('phase', 'S8');

      // 詳細を開いていた場合は詳細を再表示、それ以外は一覧
      if (currentDetailId && window.glHistory.get(currentDetailId)) {
        _renderDetail(view, currentDetailId);
      } else {
        currentDetailId = null;
        _renderList(view);
      }
    },
    hide() {
      document.getElementById('view-history')?.classList.remove('show');
    },
    /**
     * 詳細画面を指定 roundId で開く
     */
    showDetail(roundId) {
      _injectStyles();
      currentDetailId = roundId;
      const view = document.getElementById('view-history');
      if (!view) return;
      view.classList.add('show');
      _renderDetail(view, roundId);
    },
    /**
     * BEST 更新演出（classic.js から呼ばれる）
     */
    celebrateBest(snapshot) {
      _injectStyles();
      _showBestCelebration(snapshot);
    },
  };

  window.glHistoryUI = glHistoryUI;

  // history:updated イベントで再描画（表示中のみ）
  if (window.glEvents) {
    window.glEvents.on('history:updated', () => {
      const view = document.getElementById('view-history');
      if (view && view.classList.contains('show') && !currentDetailId) {
        _renderList(view);
      }
    });
  }
})();
