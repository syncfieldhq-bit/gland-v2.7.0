/**
 * G-LAND v2.7.18 - History View UI
 * ================================
 * Phase 2A: 履歴一覧（KPI・コース/期間フィルタ・BESTバッジ）
 * Phase 2B: 履歴詳細（18Hスコアカード、Par行、Score行、Putt行、OUT/IN合計）
 * Phase 2C: ベスト更新演出（🏆モーダル）
 *
 * v2.7.18 変更点:
 *   - パット数の読み取り修正（scores[userId]['puttN']）
 *   - Par デフォルト値 4（A案）
 *   - 表示切替: ストローク ↔ ±Par
 *   - 期間フィルタ: 全期間 / 過去5R / 過去10R
 *   - 同伴者カードに±Par追加
 */
(function () {
  'use strict';

  const COLOR_DARK = '#1a5f3f';
  const COLOR_CREAM = '#faf6ec';
  const COLOR_ACCENT = '#c9a959';

  const currentFilter = { courseName: '', period: 'all' }; // period: all|5|10
  let displayMode = 'strokes'; // 'strokes' | 'diff'
  let currentDetailId = null;

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
    if (n < 0) return '#c0392b';
    if (n === 0) return '#333';
    return '#333';
  }

  function _escape(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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
        justify-content: space-between;
      }
      .glh-toggle {
        display: inline-flex; background: #fff;
        border: 1px solid #d5c98c; border-radius: 18px;
        overflow: hidden; font-size: 12px;
      }
      .glh-toggle__btn {
        background: transparent; border: none;
        padding: 6px 12px; cursor: pointer;
        color: ${COLOR_DARK}; font-weight: 700;
      }
      .glh-toggle__btn.active {
        background: ${COLOR_DARK}; color: #fff;
      }

      .glh-kpi {
        display: grid; grid-template-columns: repeat(3, 1fr);
        gap: 8px; margin-bottom: 12px;
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
      .glh-kpi__sub { font-size: 11px; color: #999; margin-top: 3px; }

      .glh-filter {
        display: flex; gap: 6px; margin-bottom: 10px; align-items: center;
        overflow-x: auto; white-space: nowrap; padding-bottom: 4px;
      }
      .glh-filter__label { font-size: 11px; color: #666; flex-shrink: 0; }
      .glh-filter__chip {
        background: #fff; border: 1px solid #d5c98c;
        padding: 4px 11px; border-radius: 14px;
        font-size: 12px; color: ${COLOR_DARK};
        cursor: pointer; flex-shrink: 0;
      }
      .glh-filter__chip.active {
        background: ${COLOR_DARK}; color: #fff; border-color: ${COLOR_DARK};
      }

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

      /* ==== 詳細 ==== */
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
      .glh-scorecard .glh-sc-par-row td { background: #f8f4e0; color: #666; font-size: 11px; }
      .glh-scorecard .glh-under { color: #c0392b; font-weight: 800; }
      .glh-scorecard .glh-birdie { color: #c0392b; font-weight: 800; }
      .glh-scorecard .glh-bogey { color: #444; }

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
      .glh-comp__diff { font-size: 13px; font-weight: 700; margin-left: 4px; }
      .glh-comp__type { font-size: 10px; color: #999; margin-top: 2px; }

      /* BEST モーダル */
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

  // ==== 期間フィルタ ====
  function _applyPeriodFilter(rounds) {
    if (currentFilter.period === 'all') return rounds;
    const n = parseInt(currentFilter.period, 10);
    if (isNaN(n) || n <= 0) return rounds;
    return rounds.slice(0, n); // 既に endedAt 降順
  }

  // ==== KPI 計算（フィルタ後の rounds で再計算） ====
  function _calcKPI(rounds) {
    const valid = rounds.filter((r) => _num(r.totalStrokes) > 0);
    if (valid.length === 0) {
      return { count: 0, avgStrokes: 0, avgDiff: 0, bestStrokes: null, bestDiff: null };
    }
    const totalS = valid.reduce((a, r) => a + _num(r.totalStrokes), 0);
    const totalD = valid.reduce((a, r) => a + _num(r.totalDiff), 0);
    const bestS = valid.reduce((m, r) => Math.min(m, _num(r.totalStrokes)), 999);
    const bestRound = valid.find((r) => _num(r.totalStrokes) === bestS);
    return {
      count: valid.length,
      avgStrokes: Math.round((totalS / valid.length) * 10) / 10,
      avgDiff: Math.round((totalD / valid.length) * 10) / 10,
      bestStrokes: bestS,
      bestDiff: bestRound ? _num(bestRound.totalDiff) : null,
    };
  }

  // ==== 一覧描画 ====

  function _renderList(view) {
    let rounds = window.glHistory.list();

    // コースフィルタ
    if (currentFilter.courseName) {
      rounds = rounds.filter((r) => r.courseName === currentFilter.courseName);
    }
    // 期間フィルタ
    rounds = _applyPeriodFilter(rounds);

    const kpi = _calcKPI(rounds);
    const courses = window.glHistory.listCourses();

    // KPI 表示（displayMode で切替）
    const avgDisplay = displayMode === 'diff'
      ? (kpi.avgDiff !== 0 ? _diffStr(kpi.avgDiff) : (kpi.count > 0 ? 'E' : '-'))
      : (kpi.avgStrokes || '-');
    const bestDisplay = displayMode === 'diff'
      ? (kpi.bestDiff !== null ? _diffStr(kpi.bestDiff) : '-')
      : (kpi.bestStrokes || '-');

    const kpiHTML = `
      <div class="glh-kpi">
        <div class="glh-kpi__card">
          <div class="glh-kpi__label">ROUNDS</div>
          <div class="glh-kpi__value">${kpi.count}<span class="glh-kpi__unit">回</span></div>
        </div>
        <div class="glh-kpi__card">
          <div class="glh-kpi__label">AVERAGE</div>
          <div class="glh-kpi__value">${avgDisplay}</div>
          ${displayMode === 'strokes' && kpi.avgDiff !== 0 ? `<div class="glh-kpi__sub">${_diffStr(kpi.avgDiff)}</div>` : ''}
        </div>
        <div class="glh-kpi__card">
          <div class="glh-kpi__label">BEST</div>
          <div class="glh-kpi__value">${bestDisplay}</div>
          ${displayMode === 'strokes' && kpi.bestDiff !== null ? `<div class="glh-kpi__sub">${_diffStr(kpi.bestDiff)}</div>` : ''}
        </div>
      </div>
    `;

    // コースフィルタチップ
    const courseChipsHTML = courses.length === 0 ? '' : `
      <div class="glh-filter">
        <span class="glh-filter__label">コース：</span>
        <button class="glh-filter__chip ${!currentFilter.courseName ? 'active' : ''}" data-course="">すべて</button>
        ${courses.map((c) => `
          <button class="glh-filter__chip ${currentFilter.courseName === c ? 'active' : ''}" data-course="${_escape(c)}">${_escape(c)}</button>
        `).join('')}
      </div>
    `;

    // 期間フィルタチップ
    const periodChipsHTML = `
      <div class="glh-filter">
        <span class="glh-filter__label">期間：</span>
        <button class="glh-filter__chip ${currentFilter.period === 'all' ? 'active' : ''}" data-period="all">全期間</button>
        <button class="glh-filter__chip ${currentFilter.period === '5' ? 'active' : ''}" data-period="5">過去5R</button>
        <button class="glh-filter__chip ${currentFilter.period === '10' ? 'active' : ''}" data-period="10">過去10R</button>
      </div>
    `;

    // 一覧アイテム
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
          const main = displayMode === 'diff' ? (total > 0 ? _diffStr(diff) : '-') : (total || '-');
          const sub = displayMode === 'diff' ? (total ? `(${total})` : '') : (total ? _diffStr(diff) : '');
          return `
            <div class="glh-item ${r.isBest ? 'is-best' : ''}" data-round-id="${_escape(r.roundId)}">
              <div class="glh-item__row1">
                <span class="glh-item__date">${_fmtDate(r.endedAt || r.startedAt)}</span>
                ${r.isBest ? '<span class="glh-item__best">🏆 BEST</span>' : ''}
              </div>
              <div class="glh-item__course">${_escape(r.courseName || 'コース未設定')}</div>
              <div class="glh-item__row3">
                <div>
                  <span class="glh-item__score">${main}</span>
                  <span class="glh-item__diff" style="color:${_diffColor(diff)}">${sub}</span>
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
      <div class="glh-title">
        <span>📖 履歴</span>
        <div class="glh-toggle">
          <button class="glh-toggle__btn ${displayMode === 'strokes' ? 'active' : ''}" data-mode="strokes">打数</button>
          <button class="glh-toggle__btn ${displayMode === 'diff' ? 'active' : ''}" data-mode="diff">±Par</button>
        </div>
      </div>
      ${kpiHTML}
      ${periodChipsHTML}
      ${courseChipsHTML}
      <div class="glh-list">${itemsHTML}</div>
    `;

    // イベントバインド
    view.querySelector('[data-back]')?.addEventListener('click', () => {
      window.glEvents.emit('ui:navigate', { view: 'home' });
    });
    view.querySelectorAll('[data-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        displayMode = btn.getAttribute('data-mode');
        _renderList(view);
      });
    });
    view.querySelectorAll('[data-course]').forEach((btn) => {
      btn.addEventListener('click', () => {
        currentFilter.courseName = btn.getAttribute('data-course') || '';
        _renderList(view);
      });
    });
    view.querySelectorAll('[data-period]').forEach((btn) => {
      btn.addEventListener('click', () => {
        currentFilter.period = btn.getAttribute('data-period') || 'all';
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

    // 各行生成: Par / Score / Putt
    const buildTable = (from, to, label) => {
      // ヘッダ
      let head = `<th class="glh-sc-label">H</th>`;
      for (let h = from; h <= to; h++) head += `<th>${h}</th>`;
      head += `<th class="glh-sc-${from === 1 ? 'out' : 'in'}">${label}</th>`;

      // Par 行
      let parCells = `<td class="glh-sc-label">Par</td>`;
      let parSum = 0;
      for (let h = from; h <= to; h++) {
        const p = _num(holes['h' + h]?.par) || 4;
        parSum += p;
        parCells += `<td>${p}</td>`;
      }
      parCells += `<td class="glh-sc-${from === 1 ? 'out' : 'in'}">${parSum}</td>`;

      // Score 行
      let scoreCells = `<td class="glh-sc-label">Score</td>`;
      let scoreSum = 0;
      for (let h = from; h <= to; h++) {
        const s = _num(holes['h' + h]?.strokes);
        const p = _num(holes['h' + h]?.par) || 4;
        scoreSum += s;
        let cls = '';
        if (s > 0 && s < p) cls = 'glh-birdie';
        else if (s > p) cls = 'glh-bogey';
        scoreCells += `<td class="${cls}">${s || '-'}</td>`;
      }
      scoreCells += `<td class="glh-sc-${from === 1 ? 'out' : 'in'}">${scoreSum || '-'}</td>`;

      // Putt 行
      let puttCells = `<td class="glh-sc-label">Putt</td>`;
      let puttSum = 0;
      for (let h = from; h <= to; h++) {
        const pt = _num(holes['h' + h]?.putts);
        puttSum += pt;
        puttCells += `<td>${pt || '-'}</td>`;
      }
      puttCells += `<td class="glh-sc-${from === 1 ? 'out' : 'in'}">${puttSum || '-'}</td>`;

      return `
        <table class="glh-scorecard">
          <thead><tr>${head}</tr></thead>
          <tbody>
            <tr class="glh-sc-par-row">${parCells}</tr>
            <tr>${scoreCells}</tr>
            <tr>${puttCells}</tr>
          </tbody>
        </table>
      `;
    };

    const outTable = buildTable(1, 9, 'OUT');
    const inTable = buildTable(10, 18, 'IN');

    const compHTML = companions.length === 0 ? '' : `
      <div class="glh-card__title">同伴者</div>
      <div class="glh-comp">
        ${companions.map((c) => {
          const cs = _num(c.totalStrokes);
          const cd = _num(c.totalDiff);
          return `
            <div class="glh-comp__item">
              <div class="glh-comp__name">${_escape(c.displayName)}</div>
              <div>
                <span class="glh-comp__score">${cs || '-'}</span>
                ${cs ? `<span class="glh-comp__diff" style="color:${_diffColor(cd)}">${_diffStr(cd)}</span>` : ''}
              </div>
              <div class="glh-comp__type">${c.type === 'proxy' ? '代理' : c.type === 'shared' ? '共有' : '自分'}</div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    const diff = _num(r.totalDiff);
    const totalPar = _num(r.totalPar);

    view.innerHTML = `
      <button class="glh-back" data-back-list>← 履歴一覧へ</button>
      <div class="glh-detail">
        <div class="glh-detail__header ${r.isBest ? 'is-best' : ''}">
          <div class="glh-detail__date">${_fmtDate(r.endedAt || r.startedAt)}</div>
          <div class="glh-detail__course">${_escape(r.courseName || 'コース未設定')}</div>
          <div class="glh-detail__stats">
            <div>
              <div class="glh-detail__total">${_num(r.totalStrokes) || '-'}</div>
              <div style="font-size:10px;opacity:.8;">TOTAL${totalPar ? ` (Par ${totalPar})` : ''}</div>
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

  // ===== v2.8.0: 履歴閉覧前の必須項目チェック =====
  function _ensureFullProfile() {
    if (!window.glProfile || !window.glProfile.getMissingForHistory) return true;
    const missing = window.glProfile.getMissingForHistory();
    if (missing.length === 0) return true;
    _showProfileCompletionModal(missing);
    return false;
  }

  function _showProfileCompletionModal(missing) {
    const stored = window.glProfile.getStored();
    const existing = document.getElementById('gl-history-profile-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'gl-history-profile-modal';
    modal.className = 'gl-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:9700;display:block;';
    modal.innerHTML = `
      <div style="position:absolute;inset:0;background:rgba(0,0,0,.55);"></div>
      <div style="position:relative;margin:8vh auto 0;max-width:460px;background:#fff;border-radius:16px;padding:24px 22px;box-shadow:0 12px 40px rgba(0,0,0,.3);max-height:85vh;overflow-y:auto;">
        <h2 style="font-size:18px;font-weight:700;color:#1a5f3f;margin:0 0 6px;">履歴を見るには追加情報が必要です</h2>
        <p style="font-size:13px;color:#666;margin:0 0 16px;">
          以下の項目を入力して保存してください。<br>
          <span style="font-size:11px;color:#999;">（マイページからいつでも変更できます）</span>
        </p>
        ${missing.includes('firstName') ? `
          <div style="margin-bottom:12px;">
            <label style="display:block;font-size:14px;font-weight:600;margin-bottom:4px;">名（漢字）<span style="color:#f44336;">*</span></label>
            <input type="text" id="hp-firstName" value="${_esc(stored.firstName || '')}" placeholder="例: 新一" style="width:100%;padding:12px 14px;font-size:16px;border:2px solid #ddd;border-radius:8px;box-sizing:border-box;" autocomplete="given-name">
          </div>` : ''}
        ${missing.includes('firstKana') ? `
          <div style="margin-bottom:12px;">
            <label style="display:block;font-size:14px;font-weight:600;margin-bottom:4px;">名（ひらがな）<span style="color:#f44336;">*</span></label>
            <input type="text" id="hp-firstKana" value="${_esc(stored.firstKana || '')}" placeholder="例: しんいち" style="width:100%;padding:12px 14px;font-size:16px;border:2px solid #ddd;border-radius:8px;box-sizing:border-box;">
            <div style="font-size:11px;color:#999;margin-top:4px;">ひらがなで入力してください</div>
          </div>` : ''}
        ${missing.includes('nickname') ? `
          <div style="margin-bottom:12px;">
            <label style="display:block;font-size:14px;font-weight:600;margin-bottom:4px;">ニックネーム<span style="color:#f44336;">*</span></label>
            <input type="text" id="hp-nickname" value="${_esc(stored.nickname || '')}" placeholder="例: しんちゃん" style="width:100%;padding:12px 14px;font-size:16px;border:2px solid #ddd;border-radius:8px;box-sizing:border-box;">
            <div style="font-size:11px;color:#999;margin-top:4px;">ホーム画面やマイページで使用します</div>
          </div>` : ''}
        <button id="hp-save" style="width:100%;padding:14px;margin-top:8px;background:#1a5f3f;color:#fff;border:none;border-radius:10px;font-size:16px;font-weight:700;cursor:pointer;">保存して履歴を見る</button>
        <button id="hp-cancel" style="width:100%;padding:10px;margin-top:8px;background:transparent;color:#666;border:none;font-size:13px;cursor:pointer;">キャンセル（ホームへ戻る）</button>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('hp-cancel').addEventListener('click', () => {
      modal.remove();
      window.glEvents.emit('ui:navigate', { view: 'home' });
    });

    document.getElementById('hp-save').addEventListener('click', async () => {
      const patch = {};
      if (missing.includes('firstName')) {
        const v = (document.getElementById('hp-firstName').value || '').trim();
        if (!v) { window.glToast.warn('名（漢字）を入力してください'); return; }
        patch.firstName = v;
      }
      if (missing.includes('firstKana')) {
        const v = (document.getElementById('hp-firstKana').value || '').trim();
        if (!v) { window.glToast.warn('名（ひらがな）を入力してください'); return; }
        patch.firstKana = v;
      }
      if (missing.includes('nickname')) {
        const v = (document.getElementById('hp-nickname').value || '').trim();
        if (!v) { window.glToast.warn('ニックネームを入力してください'); return; }
        patch.nickname = v;
      }

      const btn = document.getElementById('hp-save');
      btn.disabled = true;
      btn.textContent = '保存中...';

      try {
        await window.glProfile.update(patch);
        window.glToast.success('プロフィールを更新しました');
        modal.remove();
        // 再度履歴画面を開く
        glHistoryUI.show();
      } catch (err) {
        btn.disabled = false;
        btn.textContent = '保存して履歴を見る';
        window.glErrors.handle(err, { context: 'historyProfile.update' });
      }
    });
  }

  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  const glHistoryUI = {
    show() {
      // v2.8.0: 履歴閉覧には 5項目全て必須
      if (!_ensureFullProfile()) return;

      _injectStyles();
      const view = document.getElementById('view-history');
      if (!view) return;
      view.classList.add('show');
      window.glState && window.glState.set && window.glState.set('phase', 'S8');

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
    showDetail(roundId) {
      if (!_ensureFullProfile()) return;
      _injectStyles();
      currentDetailId = roundId;
      const view = document.getElementById('view-history');
      if (!view) return;
      view.classList.add('show');
      _renderDetail(view, roundId);
    },
    celebrateBest(snapshot) {
      _injectStyles();
      _showBestCelebration(snapshot);
    },
  };

  window.glHistoryUI = glHistoryUI;

  if (window.glEvents) {
    window.glEvents.on('history:updated', () => {
      const view = document.getElementById('view-history');
      if (view && view.classList.contains('show') && !currentDetailId) {
        _renderList(view);
      }
    });
  }
})();
