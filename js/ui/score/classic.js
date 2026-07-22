/**
 * G-LAND v2.7.27 - Score Theme: Classic (3モード入力パネル統合版)
 * ============================================================
 * v2.7.26 の全機能を維持したまま、入力パネルに3モード切替を追加
 *
 * ▼ 3つの入力モード:
 *   - Classic:  10ボタングリッド (1〜10)
 *   - Simple:   5パステルボタン (−/par-1/par/par+1/+)
 *   - Counter:  +/−カウント式
 *
 * ▼ v2.7.27 変更点:
 *   - 入力方式タブを画面上部に追加（[Classic][Simple][Counter]）
 *   - 選択した入力方式は localStorage に保存（次回起動時も維持）
 *   - スコアカード表示は変わらず、入力パネルの中身だけ切替
 *
 * ▼ 過去の主要機能（v2.7.26 から継承）:
 *   - 22列レイアウト、3表示モード、代理入力、共有スキップ
 *   - 横画面ダッシュボード、LINE共有、保存前確認
 */
(function () {
  'use strict';

  // ==== 定数 ====
  const HOLES = 18;
  const DEFAULT_PAR = 4;
  const MODES = { STROKE: 'stroke', SIGN: 'sign', SYMBOL: 'symbol' };
  // v2.7.27: 入力方式
  const INPUT_MODES = { CLASSIC: 'classic', SIMPLE: 'simple', COUNTER: 'counter' };
  const STORAGE_KEYS = {
    afternoon: 'gl_afternoon_start_v1',
    locker: 'gl_locker_number_v1',
    inputMode: 'gl_input_mode_v1', // v2.7.27: 入力方式の永続化
  };

  // 状態
  let currentMode = MODES.STROKE;
  let currentInputMode = INPUT_MODES.CLASSIC; // v2.7.27: 入力方式
  let unsubScores = null;
  let unsubPlayers = null;
  let unsubProxies = null;
  let orientationMedia = null;
  let clockTimer = null;
  let isFirstRender = true;
  let userHasScrolled = false; // v2.8.8: ユーザー操作後は自動スクロール禁止

  // 入力パネル関連
  let inputSession = null;
  let pollTimer = null;

  // ==== ヘルパー ====

    function _getPars() {
  // v2.8.15: コースデータから pars を読み込む
  // v2.8.25: holesJson 文字列パースに対応
  const course = window.glState.get('currentCourse')
                 || window.glStorage.readLocal('gl_current_course_v1');

  if (course) {
    // types が直接ある場合(旧形式)と、holesJson の中にある場合(新形式)に対応
    let types = course.types;
    if (!types && course.holesJson) {
      try {
        const parsed = typeof course.holesJson === 'string'
                       ? JSON.parse(course.holesJson)
                       : course.holesJson;
        types = parsed.types;
      } catch (e) {
        types = null;
      }
    }

    if (types && types.length > 0) {
      // 全タイプのパーを結合 (東9H + 西9H = 18H など)
      const pars = types.flatMap(type => type.pars || []);
      // 18ホール分に調整 (足りなければ PAR4 で埋める)
      while (pars.length < HOLES) pars.push(DEFAULT_PAR);
      return pars.slice(0, HOLES);
    }
  }

  // コース未選択時は従来通り全PAR4
  return new Array(HOLES).fill(DEFAULT_PAR);
}

  function _parSum(pars, from, to) {
    let s = 0;
    for (let i = from; i <= to; i++) s += pars[i - 1];
    return s;
  }

  function _parSumForPlayed(pars, playerId, from, to) {
    let s = 0;
    for (let i = from; i <= to; i++) {
      const v = _getStrokes(playerId, i);
      if (v !== null && v !== undefined) {
        s += pars[i - 1];
      }
    }
    return s;
  }

  function _getStrokes(playerId, hole) {
    const scores = window.glState.get('scores') || {};
    return scores?.[playerId]?.['hole' + hole] ?? null;
  }

  function _getPutts(playerId, hole) {
    const scores = window.glState.get('scores') || {};
    return scores?.[playerId]?.['putt' + hole] ?? null;
  }

  function _sumStrokes(playerId, from, to) {
    let s = 0, has = false;
    for (let h = from; h <= to; h++) {
      const v = _getStrokes(playerId, h);
      if (v !== null && v !== undefined) { s += Number(v); has = true; }
    }
    return has ? s : null;
  }

  function _sumPutts(playerId, from, to) {
    let s = 0, has = false;
    for (let h = from; h <= to; h++) {
      const v = _getPutts(playerId, h);
      if (v !== null && v !== undefined) { s += Number(v); has = true; }
    }
    return has ? s : null;
  }

  function _colorForScore(strokes, par) {
    if (strokes === null || strokes === undefined) return '#222';
    const diff = strokes - par;
    if (diff < 0) return '#d32f2f';
    if (diff === 0) return '#222';
    return '#1565c0';
  }

  function _symbolFor(strokes, par) {
    if (strokes === null || strokes === undefined) return '';
    const diff = strokes - par;
    if (diff <= -3) return '⭐';
    if (diff === -2) return '◎';
    if (diff === -1) return '○';
    if (diff === 0) return '─';
    if (diff === 1) return '△';
    if (diff === 2) return '□';
    return '+' + diff;
  }

  function _signFor(strokes, par) {
    if (strokes === null || strokes === undefined) return '';
    const diff = strokes - par;
    if (diff === 0) return 'E';
    if (diff > 0) return '+' + diff;
    return String(diff);
  }

  function _cellDisplay(strokes, par) {
    if (strokes === null || strokes === undefined) return '';
    if (currentMode === MODES.STROKE) return String(strokes);
    if (currentMode === MODES.SIGN) return _signFor(strokes, par);
    if (currentMode === MODES.SYMBOL) return _symbolFor(strokes, par);
    return String(strokes);
  }

  // v2.7.27: スコアからパーラベル生成（Simple モード用）
  function _labelForDiff(diff) {
    if (diff <= -3) return 'アルバ';
    if (diff === -2) return 'イーグル';
    if (diff === -1) return 'バーディ';
    if (diff === 0) return 'パー';
    if (diff === 1) return 'ボギー';
    if (diff === 2) return 'Dボギー';
    if (diff >= 3) return '+' + diff;
    return '';
  }

  function _getPlayerType(player) {
    const myUserId = window.glProfile.getUserId();
    if (player.userId === myUserId) return 'self';
    const myProxies = window.glState.get('proxyPlayers') || [];
    const isMyProxy = myProxies.some(p => p.userId === player.userId);
    if (isMyProxy) return 'proxy';
    return 'shared';
  }

  function _isEditableByMe(player) {
    if (!player) return false;
    const myUserId = window.glProfile.getUserId();
    if (player.userId === myUserId) return true;
    const myProxies = window.glState.get('proxyPlayers') || [];
    const isMyProxy = myProxies.some(p => p.userId === player.userId);
    const isServerProxy = player.role === 'proxy' || player.isProxy === true;
    if (isMyProxy || isServerProxy) return true;
    return false;
  }

  function _getPlayers() {
    const players = window.glState.get('players') || [];
    const proxies = window.glState.get('proxyPlayers') || [];
    const myUserId = window.glProfile.getUserId();
    const myProfile = window.glProfile.getStored();

    let self = players.find((p) => p.userId === myUserId);
    if (!self && myUserId) {
      self = {
        userId: myUserId,
        displayName: myProfile.name || myProfile.familyName || 'あなた',
        familyName: myProfile.familyName || '',
        familyKana: myProfile.familyKana || '',
        role: 'host',
      };
    }
    const shared = players.filter((p) => p.userId !== myUserId);
    const proxyList = proxies.map((p) => ({ ...p, isProxy: true, role: 'proxy' }));
    return [self, ...shared, ...proxyList].filter(Boolean);
  }

  function _computeCurrentHole() {
    const players = _getPlayers().filter((p) => _isEditableByMe(p));
    if (players.length === 0) return 1;
    for (let h = 1; h <= HOLES; h++) {
      const allDone = players.every((p) => _getStrokes(p.userId, h) !== null && _getStrokes(p.userId, h) !== undefined);
      if (!allDone) return h;
    }
    return HOLES;
  }

  // ==== スタイル注入 ====

  function _injectStyles() {
    // v3.0.0: CSS は css/*.css に完全移管済み。互換のため関数は残置（no-op）。
    return;
  }

  // ==== 上部情報バー描画 ====

  function _renderInfoBar() {
    const afternoon = window.glState.get('afternoonStart') || window.glStorage.readLocal(STORAGE_KEYS.afternoon);
    const locker = window.glState.get('lockerNumber') || window.glStorage.readLocal(STORAGE_KEYS.locker);

    let afternoonDisplay = '';
    let afternoonCount = '';
    let countOverClass = '';

    const now = new Date();
    const currentTime = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');

    if (afternoon) {
      const [h, m] = afternoon.split(':').map(Number);
      const target = new Date();
      target.setHours(h, m, 0, 0);
      const diffMs = target.getTime() - now.getTime();
      const diffMin = Math.floor(diffMs / 60000);

      if (diffMin > 0) {
        afternoonDisplay = '午後 ' + afternoon;
        afternoonCount = `(あと ${diffMin}分)`;
      } else {
        afternoonDisplay = currentTime;
        afternoonCount = '(現在)';
      }
    } else {
      afternoonDisplay = currentTime;
      afternoonCount = '(現在)';
    }

    const lockerDisplay = locker
      ? `<span class="gl-cls-info-item__value">${locker}</span>`
      : `<span class="gl-cls-info-item__value gl-cls-info-item__value--empty">未設定</span>`;

    return `
      <div class="gl-cls-info-bar">
        <div class="gl-cls-info-item" data-info="afternoon">
          <span class="gl-cls-info-item__icon">⏰</span>
          <span class="gl-cls-info-item__value">${afternoonDisplay}</span>
          <span class="gl-cls-info-item__count ${countOverClass}">${afternoonCount}</span>
        </div>
        <div class="gl-cls-info-item" data-info="locker">
          <span class="gl-cls-info-item__icon">🔑</span>
          <span class="gl-u-81">ロッカー:</span>
          ${lockerDisplay}
        </div>
      </div>
    `;
  }

  function _startClockTimer() {
    if (clockTimer) return;
    clockTimer = setInterval(() => {
      const bar = document.querySelector('.gl-cls-info-bar');
      if (!bar) return;
      const newBar = document.createElement('div');
      newBar.innerHTML = _renderInfoBar();
      bar.replaceWith(newBar.firstElementChild);
      _bindInfoBarEvents();
    }, 30000);
  }

  function _stopClockTimer() {
    if (clockTimer) { clearInterval(clockTimer); clockTimer = null; }
  }

  function _bindInfoBarEvents() {
    document.querySelectorAll('.gl-cls-info-item').forEach((el) => {
      el.addEventListener('click', () => {
        const type = el.dataset.info;
        if (type === 'afternoon') _showAfternoonPicker();
        if (type === 'locker') _showLockerModal();
      });
    });
  }

  // ==== v2.7.30 NEW: モード切替アコーディオン ====

  function _inputModeShortLabel(mode) {
    if (mode === INPUT_MODES.SIMPLE) return 'シンプル';
    if (mode === INPUT_MODES.COUNTER) return 'カウンター';
    return 'クラシック';
  }

  function _viewModeShortLabel(mode) {
    if (mode === MODES.SIGN) return '-E+';
    if (mode === MODES.SYMBOL) return '○─△';
    return 'ストローク';
  }

  function _renderSettingsAccordion() {
    const current = `${_inputModeShortLabel(currentInputMode)} / ${_viewModeShortLabel(currentMode)}`;
    return `
      <div class="gl-cls-settings">
        <button class="gl-cls-settings-toggle" data-settings-toggle>
          <span>🎯 モード切替 <span class="gl-cls-settings-current">[${current}]</span></span>
          <span class="gl-cls-settings-arrow">▶</span>
        </button>
        <div class="gl-cls-settings-body">
          <div class="gl-cls-settings-section">
            <div class="gl-cls-settings-label">入力モード</div>
            ${_renderInputModeButtons()}
          </div>
          <div class="gl-cls-settings-section">
            <div class="gl-cls-settings-label">表示モード</div>
            ${_renderModeButtons()}
          </div>
        </div>
      </div>
    `;
  }

  // ==== v2.7.27: 入力方式タブ ====

  function _renderInputModeButtons() {
    const btn = (id, label, icon, active) => `
      <button class="gl-cls-inputmode-btn ${active ? 'active' : ''}" data-inputmode="${id}">
        <span class="gl-cls-inputmode-btn__icon">${icon}</span>${label}
      </button>
    `;
    return `
      <div class="gl-cls-inputmodes">
        ${btn(INPUT_MODES.CLASSIC, 'クラシック', '📋', currentInputMode === INPUT_MODES.CLASSIC)}
        ${btn(INPUT_MODES.SIMPLE, 'シンプル', '🎯', currentInputMode === INPUT_MODES.SIMPLE)}
        ${btn(INPUT_MODES.COUNTER, 'カウンター', '🔢', currentInputMode === INPUT_MODES.COUNTER)}
      </div>
    `;
  }

  // ==== モードタブ ====

  function _renderModeButtons() {
    const btn = (id, label, active) => `
      <button class="gl-cls-mode-btn ${active ? 'active' : ''}" data-mode="${id}">${label}</button>
    `;
    return `
      <div class="gl-cls-modes">
        ${btn(MODES.STROKE, 'ストローク', currentMode === MODES.STROKE)}
        ${btn(MODES.SIGN, '<span class="gl-cls-mode-btn__symbols"><span>-</span><span>E</span><span>+</span></span>', currentMode === MODES.SIGN)}
        ${btn(MODES.SYMBOL, '<span class="gl-cls-mode-btn__symbols"><span>○</span><span>─</span><span>△</span></span>', currentMode === MODES.SYMBOL)}
      </div>
    `;
  }

  // ==== ヘッダー行 ====

  function _renderHeaderRows(pars, currentHole) {
    const leftHead = `
      <div class="gl-cls-col-fixed-left">
        <div class="gl-cls-cell gl-cls-cell--head">Player</div>
        <div class="gl-cls-cell gl-cls-cell--par">Par</div>
      </div>
    `;

    let holeCells = '', parCells = '';
    for (let h = 1; h <= 9; h++) {
      const cur = h === currentHole ? ' gl-cls-cell--current' : '';
      holeCells += `<div class="gl-cls-cell gl-cls-cell--head${cur}">${h}</div>`;
      parCells += `<div class="gl-cls-cell gl-cls-cell--par${cur}">${pars[h - 1]}</div>`;
    }
    holeCells += `<div class="gl-cls-cell gl-cls-cell--head">OUT</div>`;
    parCells += `<div class="gl-cls-cell gl-cls-cell--par">${_parSum(pars, 1, 9)}</div>`;

    for (let h = 10; h <= 18; h++) {
      const cur = h === currentHole ? ' gl-cls-cell--current' : '';
      holeCells += `<div class="gl-cls-cell gl-cls-cell--head${cur}">${h}</div>`;
      parCells += `<div class="gl-cls-cell gl-cls-cell--par${cur}">${pars[h - 1]}</div>`;
    }
    holeCells += `<div class="gl-cls-cell gl-cls-cell--head">IN</div>`;
    parCells += `<div class="gl-cls-cell gl-cls-cell--par">${_parSum(pars, 10, 18)}</div>`;

    const rightHead = `
      <div class="gl-cls-col-fixed-right">
        <div class="gl-cls-cell gl-cls-cell--head">TOTAL</div>
        <div class="gl-cls-cell gl-cls-cell--par">${_parSum(pars, 1, 18)}</div>
      </div>
    `;

    return { leftHead, holeCells, parCells, rightHead };
  }

  // ==== プレイヤー行 ====

  function _renderPlayerRow(player, pars, currentHole) {
    const type = _getPlayerType(player);
    const isSelf = type === 'self';
    const editable = _isEditableByMe(player);
    const displayName = window.glProfile.getDisplayName(player);
    const badge = isSelf
      ? '<span class="gl-cls-player-badge gl-cls-player-badge--self">自分</span>'
      : type === 'shared'
      ? '<span class="gl-cls-player-badge gl-cls-player-badge--shared">共有</span>'
      : '<span class="gl-cls-player-badge gl-cls-player-badge--proxy">代理</span>';

    const nameCellHeight = isSelf ? '84px' : '54px';
    const left = `
      <div class="gl-cls-cell gl-cls-cell--player"
           style="height: ${nameCellHeight};"
           data-player-name="${player.userId}"
           data-player-type="${type}">
        <div>${displayName}</div>
        <small>${badge}</small>
      </div>
    `;

    let scoreRow = '', puttRow = '';

    for (let h = 1; h <= 9; h++) {
      const strokes = _getStrokes(player.userId, h);
      const par = pars[h - 1];
      const cur = h === currentHole ? ' gl-cls-cell--current' : '';
      const readonlyCls = editable ? '' : ' gl-cls-cell--score--readonly';
      const emptyCls = strokes === null ? ' gl-cls-cell--score--empty' : '';
      const display = _cellDisplay(strokes, par);
      const color = currentMode === MODES.STROKE ? _colorForScore(strokes, par) : '#222';

      scoreRow += `
        <div class="gl-cls-cell gl-cls-cell--score${cur}${readonlyCls}${emptyCls}"
             data-player="${player.userId}" data-hole="${h}"
             data-editable="${editable ? '1' : '0'}"
             style="color: ${color};">${display || '·'}</div>
      `;

      if (isSelf) {
        const putts = _getPutts(player.userId, h);
        puttRow += `
          <div class="gl-cls-cell gl-cls-cell--putt${cur}"
               data-player="${player.userId}" data-hole="${h}"
               data-input-type="putt" data-editable="1">
            <span class="gl-cls-cell--putt-label">Pt</span>${putts !== null ? putts : ''}
          </div>
        `;
      }
    }

    const outStrokes = _sumStrokes(player.userId, 1, 9);
    const outParSum = _parSumForPlayed(pars, player.userId, 1, 9);
    scoreRow += `
      <div class="gl-cls-cell gl-cls-cell--sum">
        <div>${outStrokes !== null ? outStrokes : '·'}</div>
        ${outStrokes !== null ? `<div class="gl-cls-cell--sum-diff" style="color: ${_colorForScore(outStrokes, outParSum)};">${_signFor(outStrokes, outParSum)}</div>` : ''}
      </div>
    `;
    if (isSelf) {
      const op = _sumPutts(player.userId, 1, 9);
      puttRow += `<div class="gl-cls-cell gl-cls-cell--sum-putt">${op !== null ? 'Pt' + op : ''}</div>`;
    }

    for (let h = 10; h <= 18; h++) {
      const strokes = _getStrokes(player.userId, h);
      const par = pars[h - 1];
      const cur = h === currentHole ? ' gl-cls-cell--current' : '';
      const readonlyCls = editable ? '' : ' gl-cls-cell--score--readonly';
      const emptyCls = strokes === null ? ' gl-cls-cell--score--empty' : '';
      const display = _cellDisplay(strokes, par);
      const color = currentMode === MODES.STROKE ? _colorForScore(strokes, par) : '#222';

      scoreRow += `
        <div class="gl-cls-cell gl-cls-cell--score${cur}${readonlyCls}${emptyCls}"
             data-player="${player.userId}" data-hole="${h}"
             data-editable="${editable ? '1' : '0'}"
             style="color: ${color};">${display || '·'}</div>
      `;

      if (isSelf) {
        const putts = _getPutts(player.userId, h);
        puttRow += `
          <div class="gl-cls-cell gl-cls-cell--putt${cur}"
               data-player="${player.userId}" data-hole="${h}"
               data-input-type="putt" data-editable="1">
            <span class="gl-cls-cell--putt-label">Pt</span>${putts !== null ? putts : ''}
          </div>
        `;
      }
    }

    const inStrokes = _sumStrokes(player.userId, 10, 18);
    const inParSum = _parSumForPlayed(pars, player.userId, 10, 18);
    scoreRow += `
      <div class="gl-cls-cell gl-cls-cell--sum">
        <div>${inStrokes !== null ? inStrokes : '·'}</div>
        ${inStrokes !== null ? `<div class="gl-cls-cell--sum-diff" style="color: ${_colorForScore(inStrokes, inParSum)};">${_signFor(inStrokes, inParSum)}</div>` : ''}
      </div>
    `;
    if (isSelf) {
      const ip = _sumPutts(player.userId, 10, 18);
      puttRow += `<div class="gl-cls-cell gl-cls-cell--sum-putt">${ip !== null ? 'Pt' + ip : ''}</div>`;
    }

    const totalStrokes = _sumStrokes(player.userId, 1, 18);
    const totalParSum = _parSumForPlayed(pars, player.userId, 1, 18);
    let right = `
      <div class="gl-cls-cell gl-cls-cell--sum">
        <div>${totalStrokes !== null ? totalStrokes : '·'}</div>
        ${totalStrokes !== null ? `<div class="gl-cls-cell--sum-diff" style="color: ${_colorForScore(totalStrokes, totalParSum)};">${_signFor(totalStrokes, totalParSum)}</div>` : ''}
      </div>
    `;
    if (isSelf) {
      const tp = _sumPutts(player.userId, 1, 18);
      right += `<div class="gl-cls-cell gl-cls-cell--sum-putt">${tp !== null ? 'Pt' + tp : ''}</div>`;
    }

    return { left, scoreRow, puttRow, right, isSelf };
  }

  // ==== メイン描画 ====

  function _render() {
    _injectStyles();
    const view = document.getElementById('view-score');
    if (!view) return;

    view.classList.add('gl-classic');

    const pars = _getPars();
    const currentHole = _computeCurrentHole();
    if (window.glState.get('currentHole') !== currentHole) {
      window.glState.set('currentHole', currentHole);
    }

    const players = _getPlayers();
    const groupCode = window.glState.get('groupCode') || '- - - -';
    const { leftHead, holeCells, parCells, rightHead } = _renderHeaderRows(pars, currentHole);

    let leftCol = '', centerCol = '', rightCol = '';
    players.forEach((p) => {
      const row = _renderPlayerRow(p, pars, currentHole);
      leftCol += row.left;
      centerCol += row.scoreRow;
      if (row.isSelf) centerCol += row.puttRow;
      rightCol += row.right;
    });

    view.innerHTML = `
      <div class="gl-cls-header">
        <button class="gl-cls-back" data-back>← 戻る</button>
        <div class="gl-cls-logo">G-LAND <small>Classic</small></div>
        <div class="gl-cls-code">コード: <b>${groupCode}</b></div>
      </div>

      ${_renderInfoBar()}

      ${_renderSettingsAccordion()}

      <div class="gl-cls-table-wrap">
        <div class="gl-cls-table">
          <div class="gl-cls-col-fixed-left">${leftHead}${leftCol}</div>
          <div class="gl-cls-col-scroll" id="gl-cls-scroll">
            <div class="gl-cls-scroll-inner">${holeCells}${parCells}${centerCol}</div>
          </div>
          <div class="gl-cls-col-fixed-right">${rightHead}${rightCol}</div>
        </div>
      </div>

      <div class="gl-cls-actions">
       <button class="gl-cls-btn-refresh" data-refresh>🔄 最新取得</button>
       <button class="gl-cls-btn-line" data-line>💚 LINE共有</button>
       <button class="gl-cls-btn-finish" data-finish>🏁 終了・保存</button>
      </div>

      <button class="gl-cls-focus-btn" data-focus-current title="現在ホールへ">🎯</button>
    `;

    _bindEvents();
    _bindInfoBarEvents();

        // v2.8.11: 常に現在ホールへ戻る（15秒ポーリング後も維持）
    _scrollToCurrentHole(currentHole, { force: true });
    if (isFirstRender) {
      isFirstRender = false;
    }
  }

  function _scrollToCurrentHole(currentHole, opts) {
  // v2.8.8: ユーザーがスクロール済みなら、force指定がない限り自動スクロールを禁止
  if (userHasScrolled && !(opts && opts.force)) return;
    setTimeout(() => {
      const scroller = document.getElementById('gl-cls-scroll');
      if (!scroller) return;
      const inner = scroller.querySelector('.gl-cls-scroll-inner');
      if (!inner) return;
      const colIdx = currentHole <= 9 ? currentHole - 1 : currentHole;
      const totalCols = 20;
      const innerWidth = inner.scrollWidth;
      const cellWidth = innerWidth / totalCols;
      const scrollerWidth = scroller.clientWidth;
      const targetScroll = colIdx * cellWidth - scrollerWidth / 2 + cellWidth / 2;
      scroller.scrollTo({ left: Math.max(0, targetScroll), behavior: 'smooth' });
    }, 50);
  }

    function _renderKeepScroll() {
    const oldScroller = document.getElementById('gl-cls-scroll');
    const savedScrollLeft = oldScroller ? oldScroller.scrollLeft : 0;
    _render();
    // v2.8.6: requestAnimationFrame を待たず、同期的に即座に戻す（揺れ防止）
    const newScroller = document.getElementById('gl-cls-scroll');
    if (newScroller && savedScrollLeft > 0) {
      newScroller.scrollLeft = savedScrollLeft;
    }
  }

  // ==== イベントバインド ====

  function _bindEvents() {
    const view = document.getElementById('view-score');
    if (!view) return;

    view.querySelector('[data-back]')?.addEventListener('click', () => {
      if (confirm('スコア入力を中断してホームに戻りますか？（入力済みスコアは保持されます）')) {
        window.glEvents.emit('ui:navigate', { view: 'home' });
      }
    });

    // v2.7.30: アコーディオン開閉
    view.querySelector('[data-settings-toggle]')?.addEventListener('click', () => {
      const body = view.querySelector('.gl-cls-settings-body');
      const arrow = view.querySelector('.gl-cls-settings-arrow');
      if (!body || !arrow) return;
      const isOpen = body.classList.contains('gl-cls-settings-body--open');
      if (isOpen) {
        body.classList.remove('gl-cls-settings-body--open');
        arrow.classList.remove('gl-cls-settings-arrow--open');
        arrow.textContent = '▶';
      } else {
        body.classList.add('gl-cls-settings-body--open');
        arrow.classList.add('gl-cls-settings-arrow--open');
        arrow.textContent = '▼';
      }
    });

    // v2.7.27: 入力方式切替
    // ★ v2.7.28 修正: 画面全体を再描画すると入力パネルが壊れるため、
    //   タブのアクティブ表示だけ更新する軽量な処理に変更
    view.querySelectorAll('[data-inputmode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const newMode = btn.dataset.inputmode;
        if (newMode === currentInputMode) return;
        currentInputMode = newMode;
        window.glStorage.writeLocal(STORAGE_KEYS.inputMode, currentInputMode);
        window.glToast && window.glToast.info(`入力方式: ${_inputModeLabel(currentInputMode)}`);

        // タブのアクティブ表示だけ更新（全体再描画しない）
        view.querySelectorAll('[data-inputmode]').forEach((b) => {
          b.classList.toggle('active', b.dataset.inputmode === currentInputMode);
        });

        // v2.7.30: アコーディオンの現在表示も更新
        const currentSpan = view.querySelector('.gl-cls-settings-current');
        if (currentSpan) {
          currentSpan.textContent = `[${_inputModeShortLabel(currentInputMode)} / ${_viewModeShortLabel(currentMode)}]`;
        }

        // 入力パネルが開いていたら、その中身だけ更新
        if (inputSession && window.glScorePanel && window.glScorePanel.isOpen && window.glScorePanel.isOpen()) {
          _renderInputPanel();
        }
      });
    });

    // 表示モード切替
    view.querySelectorAll('[data-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        currentMode = btn.dataset.mode;
        _render();
      });
    });

    // スコアセルタップ
    window.glDebug && glDebug.log('[classic] cell listener attached');
    view.addEventListener('click', (e) => {
      const cell = e.target.closest('[data-player][data-hole]');
      if (!cell) return;
      if (cell.dataset.editable !== '1') {
        if (window.glToast) {
          window.glToast.info('このプレイヤーのスコアは本人のスマホで入力してください');
        }
        return;
      }
      const playerId = cell.dataset.player;
      const hole = parseInt(cell.dataset.hole, 10);
      _startInputSession(hole, playerId);
    });

    view.querySelectorAll('[data-player-name]').forEach((cell) => {
      cell.addEventListener('click', () => {
        const playerId = cell.dataset.playerName;
        const type = cell.dataset.playerType;
        _handlePlayerNameTap(playerId, type);
      });
    });

    view.querySelector('[data-invite]')?.addEventListener('click', () => {
      window.glEvents.emit('ui:navigate', { view: 'golf' });
    });
    view.querySelector('[data-line]')?.addEventListener('click', _showLineShareModal);
    view.querySelector('[data-finish]')?.addEventListener('click', _finishRound);

        // v2.8.22: 🔄最新取得ボタン(視覚フィードバック + メンバー更新)
    view.querySelector('[data-refresh]')?.addEventListener('click', async (e) => {
      const target = e.currentTarget;
      const originalHTML = target.innerHTML;
      
      target.disabled = true;
      target.innerHTML = '<span class="spinner">⟳</span> 更新中...';
      
      try {
        if (window.glScore?.fetchPeers) {
          await window.glScore.fetchPeers();
        }
        if (window.glRound?.refreshMembers) {
          await window.glRound.refreshMembers();
        }
        window.glToast?.info?.('✅ 最新データを取得しました');
      } catch (err) {
        console.error('[refresh] error:', err);
        window.glToast?.info?.('❌ 更新に失敗しました');
      } finally {
        target.disabled = false;
        target.innerHTML = originalHTML;
      }
    });

    view.querySelector('[data-focus-current]')?.addEventListener('click', () => {
  const currentHole = _computeCurrentHole();
  _scrollToCurrentHole(currentHole, { force: true }); // v2.8.8: センターボタンは強制発火
});

    // v2.8.8: ユーザーがスクロールしたことを検知するフラグ
    const scroller = document.getElementById('gl-cls-scroll');
    if (scroller) {
      scroller.addEventListener('scroll', () => {
        userHasScrolled = true;
      }, { passive: true });
      scroller.addEventListener('touchstart', () => {
        userHasScrolled = true;
      }, { passive: true });
    }
  }

  function _inputModeLabel(mode) {
    if (mode === INPUT_MODES.SIMPLE) return 'シンプル';
    if (mode === INPUT_MODES.COUNTER) return 'カウンター';
    return 'クラシック';
  }

  // ==== 入力セッション ====

  function _startInputSession(hole, tappedPlayerId) {
    const currentHole = _computeCurrentHole();
    const isEditingPast = hole < currentHole;

    const players = _getPlayers();
    const editablePlayers = players.filter((p) => _isEditableByMe(p));

    let queue;
    if (isEditingPast) {
      const p = editablePlayers.find((x) => x.userId === tappedPlayerId);
      if (!p) return;
      queue = [p];
    } else {
      const idxTapped = editablePlayers.findIndex((p) => p.userId === tappedPlayerId);
      const startIdx = idxTapped >= 0 ? idxTapped : 0;
      queue = [
        ...editablePlayers.slice(startIdx),
        ...editablePlayers.slice(0, startIdx),
      ];
    }

    inputSession = {
      hole,
      queue,
      currentIdx: 0,
      isEditingPast,
      selectedStrokes: null,
      selectedPutts: null,
    };

    _loadCurrentPlayerToPanel();
    _showInputPanel();
  }

  function _loCurrentPlayer() {
    if (!inputSession) return null;
    return inputSession.queue[inputSession.currentIdx];
  }

  function _loadCurrentPlayerToPanel() {
    const p = _loCurrentPlayer();
    if (!p) return;
    inputSession.selectedStrokes = _getStrokes(p.userId, inputSession.hole);
    inputSession.selectedPutts = _getPutts(p.userId, inputSession.hole);
  }

  // ==== 入力パネル ====

  function _showInputPanel() {
    if (!window.glScorePanel) {
      window.glDebug && glDebug.err('[showPanel] glScorePanel is UNDEFINED');
      return;
    }
    window.glScorePanel.open({
      content: _buildPanelHTML(),
      onBind: _bindPanelEvents,
      onClose: () => { inputSession = null; },
    });
  }

  function _renderInputPanel() {
    window.glScorePanel.rerender(_buildPanelHTML(), _bindPanelEvents);
  }

  // v2.7.27: 入力方式に応じてパネル HTML を切り替え
  function _buildPanelHTML() {
    if (!inputSession) return '';
    const p = _loCurrentPlayer();
    if (!p) return '';

    const isSelf = _getPlayerType(p) === 'self';
    const total = inputSession.queue.length;
    const idx = inputSession.currentIdx + 1;
    const displayName = window.glProfile.getDisplayName(p);
    const typeLabel = isSelf ? '自分' : '代理';
    const badgeColor = isSelf ? '#1a5f3f' : '#ff9800';

    // ヘッダー（共通）
    const header = `
      <div class="gl-cls-panel-header">
        <div class="gl-cls-panel-hole">HOLE ${inputSession.hole}${inputSession.isEditingPast ? ' <span class="gl-u-82">修正</span>' : ''}</div>
        ${!inputSession.isEditingPast ? `<div class="gl-cls-panel-progress">${idx} / ${total} 人目</div>` : ''}
      </div>
      <div class="gl-cls-panel-player">
        <span style="display:inline-block;padding:2px 8px;background:${badgeColor};color:#fff;border-radius:4px;font-size:11px;">${typeLabel}</span>
        ${displayName}
      </div>
    `;

    // 入力方式に応じてストローク UI を生成
    let strokeSection = '';
    if (currentInputMode === INPUT_MODES.SIMPLE) {
      strokeSection = _buildStrokeUI_simple();
    } else if (currentInputMode === INPUT_MODES.COUNTER) {
      strokeSection = _buildStrokeUI_counter();
    } else {
      strokeSection = _buildStrokeUI_classic();
    }

    // パット（自分のみ）
    let puttSection = '';
    if (isSelf) {
      puttSection = _buildPuttUI();
    }

    // 保存ボタン
    const saveLabel = inputSession.isEditingPast
      ? '✓ 保存'
      : (inputSession.currentIdx < total - 1 ? '✓ 保存 → 次の人' : '✓ 保存 → 次ホール');
    const actions = `
      <div class="gl-cls-panel-actions">
        <button class="gl-cls-panel-btn-cancel" data-panel-cancel>キャンセル</button>
        <button class="gl-cls-panel-btn-save" data-panel-save ${inputSession.selectedStrokes === null ? 'disabled' : ''}>${saveLabel}</button>
      </div>
    `;

    return header + strokeSection + puttSection + actions;
  }

  // v2.7.27: Classic 入力 UI (10ボタン)
  function _buildStrokeUI_classic() {
  const pars = _getPars();
  const par = pars[inputSession.hole - 1];
  const strokeKeys = [];
  for (let i = 1; i <= 10; i++) {
    const sel = inputSession.selectedStrokes === i ? ' selected' : '';
    strokeKeys.push(`<button class="gl-cls-panel-key${sel}" data-stroke="${i}">${i}</button>`);
  }
  return `
    <div class="gl-cls-panel-section-label">ストローク数 (Par ${par})</div>
    <div class="gl-cls-panel-keys">${strokeKeys.join('')}</div>
  `;
}

  // v2.7.27: Simple 入力 UI (5パステルボタン)
  function _buildStrokeUI_simple() {
    const pars = _getPars();
    const par = pars[inputSession.hole - 1];
    const cur = inputSession.selectedStrokes;

    const buttons = [
      { key: 'minus',   cls: 'gl-cls-simple__btn--minus',  num: '−',       lbl: '' },
      { key: par - 1,   cls: 'gl-cls-simple__btn--birdie', num: par - 1,   lbl: _labelForDiff(-1) },
      { key: par,       cls: 'gl-cls-simple__btn--par',    num: par,       lbl: _labelForDiff(0) },
      { key: par + 1,   cls: 'gl-cls-simple__btn--bogey',  num: par + 1,   lbl: _labelForDiff(1) },
      { key: 'plus',    cls: 'gl-cls-simple__btn--plus',   num: '+',       lbl: '' },
    ];

    const btns = buttons.map(b => {
      const isActive = (typeof b.key === 'number' && cur === b.key) ? ' gl-cls-simple__btn--active' : '';
      const dataKey = (typeof b.key === 'number') ? `data-simple-num="${b.key}"` : `data-simple-adj="${b.key}"`;
      return `<button class="gl-cls-simple__btn ${b.cls}${isActive}" ${dataKey}>
        <span class="num">${b.num}</span>
        ${b.lbl ? `<span class="lbl">${b.lbl}</span>` : ''}
      </button>`;
    }).join('');

    // 現在の選択値表示（外れ値の場合）
    let outOfRange = '';
    if (cur !== null && cur !== par - 1 && cur !== par && cur !== par + 1) {
      outOfRange = `<div class="gl-u-83">
        現在の入力: <span class="gl-u-08">${cur}</span> (${_labelForDiff(cur - par)})
      </div>`;
    }

    return `
      <div class="gl-cls-panel-section-label">ストローク数（Par ${par}）</div>
      <div class="gl-cls-simple">${btns}</div>
      ${outOfRange}
    `;
  }

  // v2.7.27: Counter 入力 UI (+/− カウント)
  function _buildStrokeUI_counter() {
    const pars = _getPars();
    const par = pars[inputSession.hole - 1];
    const cur = inputSession.selectedStrokes;
    const shown = (cur == null) ? 0 : cur;
    let diffText = '';
    if (cur != null && cur > 0) {
      const diff = cur - par;
      diffText = (diff === 0) ? 'パー' : (diff > 0 ? `+${diff}` : `${diff}`);
    } else {
      diffText = 'タップでカウント';
    }

    return `
      <div class="gl-cls-panel-section-label">ストローク数（Par ${par}）</div>
      <div class="gl-cls-counter">
        <button class="gl-cls-counter__btn gl-cls-counter__btn--minus" data-counter-adj="minus">−</button>
        <div class="gl-cls-counter__display">
          <span class="num">${shown}</span>
          <span class="lbl">${diffText}</span>
        </div>
        <button class="gl-cls-counter__btn gl-cls-counter__btn--plus" data-counter-adj="plus">＋</button>
      </div>
    `;
  }

  // v2.7.27: パット UI（Simple/Counter は行UI、Classic は6ボタングリッド）
  function _buildPuttUI() {
    if (currentInputMode === INPUT_MODES.CLASSIC) {
      const puttKeys = [];
      for (let i = 0; i <= 5; i++) {
        const sel = inputSession.selectedPutts === i ? ' selected' : '';
        puttKeys.push(`<button class="gl-cls-panel-key gl-cls-panel-key--putt${sel}" data-putt="${i}">${i}</button>`);
      }
      return `
        <div class="gl-cls-panel-section-label">パット数（任意）</div>
        <div class="gl-cls-panel-keys gl-u-84">
          ${puttKeys.join('')}
        </div>
      `;
    }

    // Simple / Counter は行UI
    const cur = inputSession.selectedPutts;
    const puttNums = [0, 1, 2, 3].map(n => {
      const active = cur === n ? ' gl-cls-putt-btn--active' : '';
      return `<button class="gl-cls-putt-btn${active}" data-putt="${n}">${n}</button>`;
    }).join('');
    const plusActive = cur != null && cur >= 4 ? ' gl-cls-putt-btn--active' : '';
    const plusLabel = cur != null && cur >= 4 ? String(cur) : '+';

    return `
      <div class="gl-cls-panel-section-label">パット数（任意）</div>
      <div class="gl-cls-putt-row">
        <div class="gl-cls-putt-label">パット</div>
        ${puttNums}
        <button class="gl-cls-putt-btn gl-cls-putt-btn--plus${plusActive}" data-putt-plus>${plusLabel}</button>
      </div>
    `;
  }

  function _bindPanelEvents(panelEl) {
    if (!panelEl) return;

    // Classic: 10ボタン
    panelEl.querySelectorAll('[data-stroke]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!inputSession) return;
        inputSession.selectedStrokes = parseInt(btn.dataset.stroke, 10);
        _renderInputPanel();
      });
    });

    // v2.7.27 Simple: 数字ボタン
    panelEl.querySelectorAll('[data-simple-num]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!inputSession) return;
        inputSession.selectedStrokes = parseInt(btn.dataset.simpleNum, 10);
        _renderInputPanel();
      });
    });

    // v2.7.27 Simple: −/+ ボタン
    panelEl.querySelectorAll('[data-simple-adj]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!inputSession) return;
        const pars = _getPars();
        const par = pars[inputSession.hole - 1];
        const cur = inputSession.selectedStrokes;
        const base = (cur == null) ? par : cur;
        const adj = btn.dataset.simpleAdj;
        if (adj === 'minus') {
          inputSession.selectedStrokes = Math.max(1, base - 1);
        } else if (adj === 'plus') {
          inputSession.selectedStrokes = Math.min(15, base + 1);
        }
        _renderInputPanel();
      });
    });

    // v2.7.27 Counter: −/+ ボタン
    panelEl.querySelectorAll('[data-counter-adj]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!inputSession) return;
        const cur = inputSession.selectedStrokes;
        const base = (cur == null) ? 0 : cur;
        const adj = btn.dataset.counterAdj;
        if (adj === 'minus') {
          inputSession.selectedStrokes = Math.max(0, base - 1);
          if (inputSession.selectedStrokes === 0) inputSession.selectedStrokes = null;
        } else if (adj === 'plus') {
          inputSession.selectedStrokes = Math.min(20, base + 1);
        }
        _renderInputPanel();
      });
    });

    // Classic: パットボタン
    panelEl.querySelectorAll('[data-putt]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!inputSession) return;
        inputSession.selectedPutts = parseInt(btn.dataset.putt, 10);
        _renderInputPanel();
      });
    });

    // v2.7.27 Simple/Counter: パット + ボタン
    panelEl.querySelector('[data-putt-plus]')?.addEventListener('click', () => {
      if (!inputSession) return;
      const cur = inputSession.selectedPutts;
      const base = (cur == null) ? 3 : cur;
      inputSession.selectedPutts = Math.min(20, base + 1);
      _renderInputPanel();
    });

    panelEl.querySelector('[data-panel-cancel]')?.addEventListener('click', _cancelInputPanel);
    panelEl.querySelector('[data-panel-save]')?.addEventListener('click', _saveAndProceed);
  }

  function _saveAndProceed() {
    if (!inputSession) return;
    const p = _loCurrentPlayer();
    if (!p || inputSession.selectedStrokes === null) return;

    window.glScore.save(p.userId, inputSession.hole, inputSession.selectedStrokes);
    if (_getPlayerType(p) === 'self' && inputSession.selectedPutts !== null) {
      const scores = window.glState.get('scores') || {};
      if (!scores[p.userId]) scores[p.userId] = {};
      scores[p.userId]['putt' + inputSession.hole] = inputSession.selectedPutts;
      window.glState.set('scores', { ...scores });
    }

    window._lastSaveTime = Date.now();

    if (inputSession.isEditingPast || inputSession.currentIdx >= inputSession.queue.length - 1) {
      _closeInputPanel();
      // v2.8.9: 保存後は必ず現在ホールに戻る（スマートさん提案）
      setTimeout(() => {
        const currentHole = _computeCurrentHole();
        _scrollToCurrentHole(currentHole, { force: true });
      }, 100);
      return;
    }
    inputSession.currentIdx++;
    _loadCurrentPlayerToPanel();
    _renderInputPanel();
  }

  function _cancelInputPanel() {
    _closeInputPanel();
  }

  function _closeInputPanel() {
    if (window.glScorePanel && window.glScorePanel.isOpen && window.glScorePanel.isOpen()) {
      window.glScorePanel.close();
    } else {
      inputSession = null;
    }
  }

  // ==== プレイヤー名タップハンドラ ====

  function _handlePlayerNameTap(playerId, type) {
    if (type === 'self') return;
    const players = _getPlayers();
    const player = players.find((p) => p.userId === playerId);
    if (!player) return;

    if (type === 'shared') _showKanaViewModal(player);
    else if (type === 'proxy') _showProxyEditModal(player);
  }

  /**
   * v3.0.0: ふりがな表示モーダル（glModal.open ベース）
   * 文言、レイアウト、閉じる挙動（[data-close] + 背景クリック）は 100% 現行維持
   */
  function _showKanaViewModal(player) {
    var kana = player.familyKana || '（ふりがな未登録）';
    var body = ''
      + '<div class="gl-cls-modal__name-big">' + window.glProfile.getDisplayName(player) + '</div>'
      + '<div class="gl-cls-modal__kana">' + kana + '</div>'
      + '<div class="gl-cls-modal__actions">'
      +   '<button class="gl-cls-modal__btn-ok" data-close>閉じる</button>'
      + '</div>';
    var handle = window.glModal.open({
      title: 'プレイヤー情報',
      body: body,
      modalType: 'kana-view',
      variant: 'cls',
      dismissible: true,   // 背景クリックで閉じる（従来仕様）
      showClose: false,
      onBind: function (root) {
        var closeBtn = root.querySelector('[data-close]');
        if (closeBtn) closeBtn.addEventListener('click', function () { handle.close(); });
      },
    });
  }

  /**
   * v3.0.0: 代理入力プレイヤー編集モーダル（glModal.open ベース）
   * 文言、初期値、バリデーション（名前必須）、保存処理、toast「保存しました」、
   * キャンセル/背景クリックで閉じる挙動は 100% 現行維持
   */
  function _showProxyEditModal(player) {
    var body = ''
      + '<label class="gl-u-02">名前 <span class="gl-u-01">*</span></label>'
      + '<input type="text" id="proxy-name" value="' + (player.familyName || player.displayName || '') + '" placeholder="例: 田中">'
      + '<label class="gl-u-02">ふりがな（任意）</label>'
      + '<input type="text" id="proxy-kana" value="' + (player.familyKana || '') + '" placeholder="例: たなか">'
      + '<div class="gl-cls-modal__actions">'
      +   '<button class="gl-cls-modal__btn-cancel" data-cancel>キャンセル</button>'
      +   '<button class="gl-cls-modal__btn-ok" data-save>保存</button>'
      + '</div>';
    var handle = window.glModal.open({
      title: '代理入力プレイヤー',
      body: body,
      modalType: 'proxy-edit',
      variant: 'cls',
      dismissible: true,   // 背景クリックで閉じる（従来仕様）
      showClose: false,
      onBind: function (root) {
        var cancelBtn = root.querySelector('[data-cancel]');
        if (cancelBtn) cancelBtn.addEventListener('click', function () { handle.close(); });
        var saveBtn = root.querySelector('[data-save]');
        if (saveBtn) saveBtn.addEventListener('click', function () {
          var name = document.getElementById('proxy-name').value.trim();
          var kana = document.getElementById('proxy-kana').value.trim();
          if (!name) { window.glToast.warn('名前は必須です'); return; }
          if (window.glRound.updateProxyPlayer) {
            window.glRound.updateProxyPlayer(player.userId, { familyName: name, familyKana: kana });
          }
          window.glToast.success('保存しました');
          handle.close();
        });
      },
    });
  }

  // ==== 午後スタート・ロッカーモーダル ====

  /**
   * v3.0.0: 午後スタート時刻ピッカー（glModal.open ベース）
   * - インライン CSS 注入（旧 gl-cls-wheel-styles）は撤去。CSS は css/modal.css に移管済み。
   * - wheel picker ロジック、default 値計算（未設定時: 現在 +45分）、
   *   スクロール吸着、クリア/閉じる/保存の各挙動は 100% 現行維持
   */
  function _showAfternoonPicker() {
    var current = window.glState.get('afternoonStart') || '';
    var defaultH, defaultM;
    if (current) {
      var parts = current.split(':').map(Number);
      defaultH = parts[0]; defaultM = parts[1];
    } else {
      var now = new Date();
      now.setMinutes(now.getMinutes() + 45);
      defaultH = now.getHours();
      defaultM = now.getMinutes();
    }

    var body = ''
      + '<p class="gl-u-02">上下にスワイプして選択</p>'
      + '<div class="gl-wheel-wrap">'
      +   '<div class="gl-wheel-col">'
      +     '<div class="gl-wheel-label">時</div>'
      +     '<div class="gl-wheel" id="wheel-hour">'
      +       '<div class="gl-wheel-scroller" id="wheel-hour-scroller"></div>'
      +     '</div>'
      +   '</div>'
      +   '<div class="gl-wheel-col">'
      +     '<div class="gl-wheel-label">分</div>'
      +     '<div class="gl-wheel" id="wheel-min">'
      +       '<div class="gl-wheel-scroller" id="wheel-min-scroller"></div>'
      +     '</div>'
      +   '</div>'
      + '</div>'
      + '<div class="gl-cls-modal__actions">'
      +   (current ? '<button class="gl-cls-modal__btn-cancel" data-clear>クリア</button>' : '')
      +   '<button class="gl-cls-modal__btn-cancel" data-cancel>閉じる</button>'
      +   '<button class="gl-cls-modal__btn-ok" data-save>保存</button>'
      + '</div>';

    var handle = window.glModal.open({
      title: '⏰ 午後スタート時刻',
      body: body,
      modalType: 'afternoon-picker',
      variant: 'cls',
      dismissible: true,
      showClose: false,
      onBind: function (root) {
        var ITEM_H = 44;
        var hourScroller = root.querySelector('#wheel-hour-scroller');
        var minScroller  = root.querySelector('#wheel-min-scroller');

        function buildWheel(scroller, max) {
          var items = [];
          for (var i = 0; i < 2; i++) items.push('<div class="gl-wheel-item">&nbsp;</div>');
          for (var i = 0; i <= max; i++) {
            items.push('<div class="gl-wheel-item" data-val="' + i + '">' + String(i).padStart(2, '0') + '</div>');
          }
          for (var i = 0; i < 2; i++) items.push('<div class="gl-wheel-item">&nbsp;</div>');
          scroller.innerHTML = items.join('');
        }

        buildWheel(hourScroller, 23);
        buildWheel(minScroller, 59);

        setTimeout(function () {
          hourScroller.scrollTop = defaultH * ITEM_H;
          minScroller.scrollTop  = defaultM * ITEM_H;
          updateActive(hourScroller);
          updateActive(minScroller);
        }, 30);

        function updateActive(scroller) {
          var centerIdx = Math.round(scroller.scrollTop / ITEM_H);
          scroller.querySelectorAll('.gl-wheel-item').forEach(function (el, i) {
            el.classList.toggle('gl-wheel-item--active', i - 2 === centerIdx);
          });
        }

        var hScrollTO, mScrollTO;
        hourScroller.addEventListener('scroll', function () {
          clearTimeout(hScrollTO);
          hScrollTO = setTimeout(function () {
            var idx = Math.round(hourScroller.scrollTop / ITEM_H);
            hourScroller.scrollTo({ top: idx * ITEM_H, behavior: 'smooth' });
            updateActive(hourScroller);
          }, 100);
        });
        minScroller.addEventListener('scroll', function () {
          clearTimeout(mScrollTO);
          mScrollTO = setTimeout(function () {
            var idx = Math.round(minScroller.scrollTop / ITEM_H);
            minScroller.scrollTo({ top: idx * ITEM_H, behavior: 'smooth' });
            updateActive(minScroller);
          }, 100);
        });

        var cancelBtn = root.querySelector('[data-cancel]');
        if (cancelBtn) cancelBtn.addEventListener('click', function () { handle.close(); });

        var clearBtn = root.querySelector('[data-clear]');
        if (clearBtn) clearBtn.addEventListener('click', function () {
          window.glState.set('afternoonStart', null);
          window.glStorage.writeLocal(STORAGE_KEYS.afternoon, null);
          window.glToast.info('午後スタート時刻をクリアしました');
          handle.close();
          _render();
        });

        var saveBtn = root.querySelector('[data-save]');
        if (saveBtn) saveBtn.addEventListener('click', function () {
          var h = Math.max(0, Math.min(23, Math.round(hourScroller.scrollTop / ITEM_H)));
          var m = Math.max(0, Math.min(59, Math.round(minScroller.scrollTop  / ITEM_H)));
          var timeStr = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
          window.glState.set('afternoonStart', timeStr);
          window.glStorage.writeLocal(STORAGE_KEYS.afternoon, timeStr);
          window.glToast.success('午後スタート: ' + timeStr);
          handle.close();
          _render();
        });
      },
    });
  }

  /**
   * v3.0.0: ロッカー番号モーダル（glModal.open ベース）
   * 文言、初期値、tel/numeric input、バリデーション（未入力警告）、
   * クリア/閉じる/保存、100ms 後 focus は 100% 現行維持
   */
  function _showLockerModal() {
    var current = window.glState.get('lockerNumber') || '';
    var body = ''
      + '<p class="gl-u-02">ラウンド後に戻る貴重品ロッカーの番号</p>'
      + '<input type="tel" inputmode="numeric" pattern="[0-9]*" maxlength="6" id="locker-input" value="' + current + '" placeholder="例: 127" class="gl-u-85">'
      + '<div class="gl-cls-modal__actions">'
      +   (current ? '<button class="gl-cls-modal__btn-cancel" data-clear>クリア</button>' : '')
      +   '<button class="gl-cls-modal__btn-cancel" data-cancel>閉じる</button>'
      +   '<button class="gl-cls-modal__btn-ok" data-save>保存</button>'
      + '</div>';
    var handle = window.glModal.open({
      title: '🔑 貴重品ロッカー番号',
      body: body,
      modalType: 'locker',
      variant: 'cls',
      dismissible: true,
      showClose: false,
      onBind: function (root) {
        var cancelBtn = root.querySelector('[data-cancel]');
        if (cancelBtn) cancelBtn.addEventListener('click', function () { handle.close(); });

        var clearBtn = root.querySelector('[data-clear]');
        if (clearBtn) clearBtn.addEventListener('click', function () {
          window.glState.set('lockerNumber', null);
          window.glStorage.writeLocal(STORAGE_KEYS.locker, null);
          window.glToast.info('ロッカー番号をクリアしました');
          handle.close();
          _render();
        });

        var saveBtn = root.querySelector('[data-save]');
        if (saveBtn) saveBtn.addEventListener('click', function () {
          var val = document.getElementById('locker-input').value.trim();
          if (!val) { window.glToast.warn('番号を入力してください'); return; }
          window.glState.set('lockerNumber', val);
          window.glStorage.writeLocal(STORAGE_KEYS.locker, val);
          window.glToast.success('ロッカー: ' + val);
          handle.close();
          _render();
        });

        setTimeout(function () {
          var el = document.getElementById('locker-input');
          if (el) el.focus();
        }, 100);
      },
    });
  }

  // ==== LINE 共有 ====

  /**
   * v3.0.0: LINE 共有モーダル（glModal.open ベース）
   * 文言、ラジオ選択の active クラス切替、キャンセル/送信、
   * window.open による LINE 起動、閉じる挙動は 100% 現行維持
   */
  function _showLineShareModal() {
    var selectedType = 'detailed';
    var body = ''
      + '<p class="gl-u-86">どちらの形式で共有しますか？</p>'
      + '<label class="gl-cls-line-option" data-line-type="simple">'
      +   '<input type="radio" name="lineType" value="simple">'
      +   '<div class="gl-cls-line-option-body">'
      +     '<div class="gl-cls-line-option-title">シンプル</div>'
      +     '<div class="gl-cls-line-option-desc">スコアだけ簡潔に</div>'
      +   '</div>'
      + '</label>'
      + '<label class="gl-cls-line-option active" data-line-type="detailed">'
      +   '<input type="radio" name="lineType" value="detailed" checked>'
      +   '<div class="gl-cls-line-option-body">'
      +     '<div class="gl-cls-line-option-title">詳細</div>'
      +     '<div class="gl-cls-line-option-desc">ハイライト・パット付き</div>'
      +   '</div>'
      + '</label>'
      + '<div class="gl-cls-modal__actions">'
      +   '<button class="gl-cls-modal__btn-cancel" data-cancel>キャンセル</button>'
      +   '<button class="gl-cls-modal__btn-ok gl-u-87" data-send>💚 LINEを開く</button>'
      + '</div>';

    var handle = window.glModal.open({
      title: '💚 LINE で途中経過を共有',
      body: body,
      modalType: 'line-share',
      variant: 'cls',
      dismissible: true,
      showClose: false,
      onBind: function (root) {
        root.querySelectorAll('input[name="lineType"]').forEach(function (radio) {
          radio.addEventListener('change', function () {
            selectedType = radio.value;
            root.querySelectorAll('.gl-cls-line-option').forEach(function (el) {
              el.classList.toggle('active', el.dataset.lineType === selectedType);
            });
          });
        });
        var cancelBtn = root.querySelector('[data-cancel]');
        if (cancelBtn) cancelBtn.addEventListener('click', function () { handle.close(); });
        var sendBtn = root.querySelector('[data-send]');
        if (sendBtn) sendBtn.addEventListener('click', function () {
          var msg = _buildLineMessage(selectedType);
          var url = 'https://line.me/R/msg/text/?' + encodeURIComponent(msg);
          window.open(url, '_blank');
          handle.close();
        });
      },
    });
  }

  function _buildLineMessage(type) {
    const myUserId = window.glProfile.getUserId();
    const myProfile = window.glProfile.getStored();
    const myName = myProfile.name || myProfile.familyName || 'プレイヤー';
    const pars = _getPars();

    const currentHole = _computeCurrentHole();
    const lastCompletedHole = currentHole > 1 ? currentHole - 1 : 0;
    const totalStrokes = _sumStrokes(myUserId, 1, lastCompletedHole);
    const totalPar = _parSum(pars, 1, lastCompletedHole);
    const diff = totalStrokes !== null ? totalStrokes - totalPar : 0;
    const diffStr = diff === 0 ? 'E' : (diff > 0 ? '+' + diff : String(diff));

    if (type === 'simple') {
      return `G-LAND 途中経過\n${myName}: ${totalStrokes ?? '-'} (${diffStr})\nHOLE ${lastCompletedHole} 終了時点`;
    }

    const totalPutts = _sumPutts(myUserId, 1, lastCompletedHole);
    const highlights = [];
    for (let h = 1; h <= lastCompletedHole; h++) {
      const s = _getStrokes(myUserId, h);
      if (s === null) continue;
      const par = pars[h - 1];
      const d = s - par;
      if (d <= -2) highlights.push(`🦅 HOLE ${h}: イーグル`);
      else if (d === -1) highlights.push(`🐤 HOLE ${h}: バーディー`);
    }

    let msg = '🏌️ G-LAND ラウンド途中経過\n\n';
    msg += `👤 ${myName}\n\n`;
    msg += `📊 HOLE ${lastCompletedHole} 終了時点\n`;
    msg += `スコア: ${totalStrokes ?? '-'} (${diffStr})\n`;
    if (totalPutts !== null) msg += `パット合計: ${totalPutts}\n`;
    if (highlights.length > 0) {
      msg += '\n【ハイライト】\n' + highlights.join('\n');
    }
    return msg;
  }

  // ==== ラウンド終了 ====

  function _computeInputStatus() {
    const players = _getPlayers();
    const scores = window.glState.get('scores') || {};
    return players.map((p) => {
      const s = scores[p.userId] || {};
      let filled = 0;
      for (let h = 1; h <= 18; h++) {
        if (s['hole' + h]) filled++;
      }
      return {
        userId: p.userId,
        displayName: p.displayName || p.familyName || '?',
        type: _getPlayerType(p),
        filled,
        complete: filled === 18,
      };
    });
  }

  /**
   * v3.0.0: 保存前確認モーダル（glModal.open ベース、Promise 返却維持）
   *
   * 【従来仕様の完全維持】
   *   - Promise 返却で resolve(true/false)（onOk / onCancel の結果）
   *   - 「🏁 保存前の確認」タイトル、状況テーブル、状態別警告メッセージ、
   *     「🔄 最新取得」「キャンセル」「保存する / それでも保存する」ボタン
   *   - 開いた直後 100ms 後に safeSync() → 部分再描画
   *   - 🔄 最新取得ボタン押下時: 「同期中...」表示 → safeSync → 部分再描画
   *   - 背景クリック / キャンセル: resolve(false)
   *   - 保存: resolve(true)
   *
   * 【glModal による位置ズレ根本解決】
   *   - 従来は独自 .gl-modal で backdrop / body を直書きしていたが、
   *     glModal.open() の共通基盤 + data-modal-type="finish-confirm" に統一
   */
  async function _showFinishConfirm() {
    var roundId = window.glState.get('roundId');

    return new Promise(function (resolve) {
      var handle = null;
      var resolved = false;

      var renderContent = function (status) {
        var rows = status.map(function (s) {
          var icon = s.complete ? '✅' : '⚠️';
          var typeLabel = s.type === 'proxy' ? '代理' : s.type === 'shared' ? '共有' : '自分';
          return '<tr>'
            + '<td class="gl-u-09">' + _escapeHtml(s.displayName) + '<span class="gl-u-88">' + typeLabel + '</span></td>'
            + '<td class="gl-u-89">' + s.filled + '/18</td>'
            + '<td class="gl-u-09">' + icon + '</td>'
            + '</tr>';
        }).join('');

        var allComplete = status.every(function (s) { return s.complete; });

        return ''
          + '<p class="gl-u-90">各プレイヤーの入力状況です</p>'
          + '<table class="gl-u-91">'
          +   '<tbody>' + rows + '</tbody>'
          + '</table>'
          + (allComplete
              ? '<p class="gl-u-92">✅ 全員のスコアが揃いました</p>'
              : '<p class="gl-u-93">⚠️ 未入力のホールがあります。全員のスコアが揃ってから保存することを推奨します</p>')
          + '<div class="gl-u-94">'
          +   '<button data-refresh class="gl-u-95">🔄 最新取得</button>'
          +   '<button data-cancel class="gl-u-96">キャンセル</button>'
          + '</div>'
          + '<button data-save-anyway style="width:100%;padding:12px;margin-top:8px;background:' + (allComplete ? '#1a5f3f' : '#c9a959') + ';color:#fff;border:none;border-radius:6px;font-weight:800;font-size:15px;cursor:pointer;">'
          +   (allComplete ? '保存する' : 'それでも保存する')
          + '</button>';
      };

      var safeSync = async function () {
        var backupScores = JSON.parse(JSON.stringify(window.glState.get('scores') || {}));
        await window.glHistory.syncScoresBeforeSave(roundId, 5000);
        var syncedScores = window.glState.get('scores') || {};
        var players = _getPlayers();
        players.forEach(function (p) {
          if (_isEditableByMe(p)) {
            syncedScores[p.userId] = Object.assign({}, syncedScores[p.userId] || {}, backupScores[p.userId] || {});
          }
        });
        window.glState.set('scores', syncedScores);
      };

      var closeWithResult = function (result) {
        if (resolved) return;
        resolved = true;
        if (handle) { try { handle.close(); } catch (e) { /* ignore */ } }
        resolve(result);
      };

      var bindEvents = function (root) {
        var cancelBtn = root.querySelector('[data-cancel]');
        if (cancelBtn) cancelBtn.addEventListener('click', function () { closeWithResult(false); });

        var saveBtn = root.querySelector('[data-save-anyway]');
        if (saveBtn) saveBtn.addEventListener('click', function () { closeWithResult(true); });

        var refreshBtn = root.querySelector('[data-refresh]');
        if (refreshBtn) refreshBtn.addEventListener('click', async function () {
          refreshBtn.disabled = true;
          refreshBtn.textContent = '同期中...';
          await safeSync();
          var newStatus = _computeInputStatus();
          handle.rerender(renderContent(newStatus));
          bindEvents(handle.root);
        });
      };

      var currentStatus = _computeInputStatus();

      handle = window.glModal.open({
        title: '🏁 保存前の確認',
        body: renderContent(currentStatus),
        modalType: 'finish-confirm',
        dismissible: true,  // 背景クリックで閉じる（従来仕様: close(false)）
        showClose: false,
        onBind: function (root) { bindEvents(root); },
        onClose: function () {
          // 背景クリック / Esc など glModal 側からの閉じる経路も
          // 未 resolved なら false 扱いで resolve する（従来仕様維持）
          if (!resolved) { resolved = true; resolve(false); }
        },
      });

      setTimeout(async function () {
        await safeSync();
        var newStatus = _computeInputStatus();
        if (!resolved && handle && handle.root && document.body.contains(handle.root)) {
          handle.rerender(renderContent(newStatus));
          bindEvents(handle.root);
        }
      }, 100);
    });
  }

  function _escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  async function _finishRound() {
    const proceed = await _showFinishConfirm();
    if (!proceed) return;

    const finishBtn = document.querySelector('[data-finish]');
    if (finishBtn) {
      finishBtn.disabled = true;
      finishBtn.textContent = '💾 保存中...';
    }

    try {
      const roundId = window.glState.get('roundId');
      const players = _getPlayers().map(p => ({
        ...p,
        type: _getPlayerType(p)
      }));

      const snapshot = await window.glHistory.finishAndSave({
        roundId,
        players,
        theme: 'classic',
        lockerNumber: window.glState.get('lockerNumber') || '',
        courseName: window.glState.get('courseName') || '',
        courseId: window.glState.get('courseId') || '',
        startedAt: window.glState.get('startedAt') || null,
      });

      window.glState.set('afternoonStart', null);
      window.glStorage.writeLocal(STORAGE_KEYS.afternoon, null);

      try { window.glRound.leave(); } catch (e) { /* ignore */ }

      window.glToast.success('あなたのスコアを保存しました');

      if (snapshot && snapshot.isBest && window.glHistoryUI && window.glHistoryUI.celebrateBest) {
        setTimeout(() => window.glHistoryUI.celebrateBest(snapshot), 400);
      }

      window.glEvents.emit('ui:navigate', { view: 'history' });

      if (!window.glProfile.isFull()) {
        setTimeout(() => window.glToast.info('プロフィールを完成させると詳細分析が使えます'), 1200);
      }
    } catch (err) {
      window.glErrors && window.glErrors.handle(err, { context: 'classic._finishRound' });
      window.glToast.error('保存に失敗しました。もう一度お試しください');
      if (finishBtn) {
        finishBtn.disabled = false;
        finishBtn.textContent = '🏁 終了・保存';
      }
    }
  }

  // ==== ライフサイクル ====

  const classicTheme = {
    id: 'classic',
    name: 'クラシック',
    description: '本物のスコアカード風。18ホール横スクロール表示（3モード入力対応）',

    show() {
      isFirstRender = true;
      userHasScrolled = false; // v2.8.8: 画面再表示時にフラグをリセット
      // v2.7.27: 保存済み入力方式を復元
      const savedMode = window.glStorage.readLocal(STORAGE_KEYS.inputMode);
      if (savedMode && Object.values(INPUT_MODES).includes(savedMode)) {
        currentInputMode = savedMode;
      }

      _render();
      document.getElementById('view-score')?.classList.add('show');
      window.glState.set('phase', 'S6');

      let _renderTimer = null;
      const _debouncedRender = () => {
      if (_renderTimer) clearTimeout(_renderTimer);
      _renderTimer = setTimeout(() => _renderKeepScroll(), 300);
     };
      unsubScores = window.glState.subscribe('scores', _debouncedRender);
      unsubPlayers = window.glState.subscribe('players', _debouncedRender);
      unsubProxies = window.glState.subscribe('proxyPlayers', _debouncedRender);

      orientationMedia = window.matchMedia('(orientation: landscape)');
      this._orientationHandler = () => {
        isFirstRender = true;
        _render();
      };
      orientationMedia.addEventListener('change', this._orientationHandler);

      _startClockTimer();
    },

    hide() {
      const view = document.getElementById('view-score');
      if (view) {
        view.classList.remove('show');
        view.classList.remove('gl-classic');
      }
      _closeInputPanel();
      _stopClockTimer();
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
      if (unsubScores) { unsubScores(); unsubScores = null; }
      if (unsubPlayers) { unsubPlayers(); unsubPlayers = null; }
      if (unsubProxies) { unsubProxies(); unsubProxies = null; }
      if (orientationMedia && this._orientationHandler) {
        orientationMedia.removeEventListener('change', this._orientationHandler);
      }
    },
  };

  window.glScoreThemes = window.glScoreThemes || {};
  window.glScoreThemes.classic = classicTheme;
})();
