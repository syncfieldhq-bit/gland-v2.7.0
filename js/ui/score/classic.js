/**
 * G-LAND v2.7.1 - Score Theme: Classic (昔ながらの紙スコアカード)
 * ============================================================
 * 横スクロールの本格スコアカード。縦に同伴者、横に18ホール。
 * セル直接タップ入力、代理入力、共有プレイヤー対応。
 *
 * レイアウト: 22列（Player + H1〜H9 + OUT + H10〜H18 + IN + TOTAL）
 * 左固定=プレイヤー名列 / 右固定=TOTAL / 中央スクロール
 * 縦画面=3ホール表示 / 横画面=9ホールずつ横スクロール（閲覧専用）
 *
 * モード: ストローク / -E+ / ○─△
 * 色分け: バーディー以下=赤 / Par=黒 / ボギー以上=青
 */
(function () {
  'use strict';

  // ==== 定数 ====
  const HOLES = 18;
  const DEFAULT_PAR = 4; // 暫定：全ホール Par 4 固定
  const MODES = { STROKE: 'stroke', SIGN: 'sign', SYMBOL: 'symbol' };

  // 状態
  let currentMode = MODES.STROKE;
  let unsubScores = null;
  let unsubPlayers = null;
  let orientationMedia = null;

  // ==== ヘルパー ====

  function _getPars() {
    // 将来はコース選択から取得。現状は全 Par 4 固定
    const arr = new Array(HOLES).fill(DEFAULT_PAR);
    return arr;
  }

  function _parSum(pars, from, to) {
    let s = 0;
    for (let i = from; i <= to; i++) s += pars[i - 1];
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
    let s = 0;
    let has = false;
    for (let h = from; h <= to; h++) {
      const v = _getStrokes(playerId, h);
      if (v !== null && v !== undefined) {
        s += Number(v);
        has = true;
      }
    }
    return has ? s : null;
  }

  function _sumPutts(playerId, from, to) {
    let s = 0;
    let has = false;
    for (let h = from; h <= to; h++) {
      const v = _getPutts(playerId, h);
      if (v !== null && v !== undefined) {
        s += Number(v);
        has = true;
      }
    }
    return has ? s : null;
  }

  /**
   * ストローク数の色分け（vs Par）
   * バーディー以下=赤 / Par=黒 / ボギー以上=青
   */
  function _colorForScore(strokes, par) {
    if (strokes === null || strokes === undefined) return '#222';
    const diff = strokes - par;
    if (diff < 0) return '#d32f2f';  // 赤
    if (diff === 0) return '#222';   // 黒
    return '#1565c0';                // 青
  }

  /**
   * 記号モードでの表示文字
   */
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

  /**
   * ±Par 表示（-3 / -1 / E / +1 / +3）
   */
  function _signFor(strokes, par) {
    if (strokes === null || strokes === undefined) return '';
    const diff = strokes - par;
    if (diff === 0) return 'E';
    if (diff > 0) return '+' + diff;
    return String(diff);
  }

  /**
   * 現在のモードに応じたセル表示
   */
  function _cellDisplay(strokes, par) {
    if (strokes === null || strokes === undefined) return '';
    if (currentMode === MODES.STROKE) return String(strokes);
    if (currentMode === MODES.SIGN) return _signFor(strokes, par);
    if (currentMode === MODES.SYMBOL) return _symbolFor(strokes, par);
    return String(strokes);
  }

  /**
   * プレイヤーの種別判定
   */
  function _getPlayerType(player) {
    const myUserId = window.glProfile.getUserId();
    if (player.userId === myUserId) return 'self';
    if (player.isProxy || player.role === 'proxy') return 'proxy';
    return 'shared';
  }

  // ==== スタイル注入 ====

  function _injectStyles() {
    if (document.getElementById('gl-classic-styles')) return;
    const style = document.createElement('style');
    style.id = 'gl-classic-styles';
    style.textContent = `
      /* ===== 全体レイアウト ===== */
      #view-score.gl-classic {
        min-height: 100vh; padding: 8px; box-sizing: border-box;
        background: #f5f2ea; /* 紙風の温かみのある背景 */
        display: none; flex-direction: column;
      }
      #view-score.gl-classic.show { display: flex; }

      /* ===== ヘッダー ===== */
      .gl-cls-header {
        display: flex; justify-content: space-between; align-items: center;
        padding: 4px 8px; margin-bottom: 6px;
      }
      .gl-cls-back {
        background: none; border: none; color: #1a5f3f;
        font-size: 15px; cursor: pointer; padding: 4px 0;
      }
      .gl-cls-logo {
        font-size: 15px; font-weight: 700; color: #1a5f3f;
        letter-spacing: 1px;
      }
      .gl-cls-logo small { font-size: 11px; opacity: .7; margin-left: 6px; }
      .gl-cls-code { font-size: 12px; color: #666; }
      .gl-cls-code b { color: #1a5f3f; font-family: monospace; font-size: 14px; }

      /* ===== モード切替タブ ===== */
      .gl-cls-modes {
        display: grid; grid-template-columns: 1fr 1fr 1fr;
        gap: 4px; margin-bottom: 8px;
        background: #e8e0d0; padding: 4px; border-radius: 8px;
      }
      .gl-cls-mode-btn {
        padding: 8px 4px; border: none; border-radius: 6px;
        background: transparent; cursor: pointer;
        font-family: inherit; font-size: 13px; font-weight: 600;
        color: #5a4a30; transition: background .15s;
      }
      .gl-cls-mode-btn.active {
        background: #1a5f3f; color: #fff;
        box-shadow: 0 2px 4px rgba(0,0,0,.15);
      }
      .gl-cls-mode-btn__symbols {
        display: inline-flex; gap: 6px; font-size: 14px;
      }

      /* ===== スコアカード表 ===== */
      .gl-cls-table-wrap {
        flex: 1; overflow: hidden; border-radius: 8px;
        background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,.08);
        border: 1px solid #d4c8a8;
      }
      .gl-cls-table {
        display: grid; width: 100%; height: 100%;
        /* 22列: Player固定 + 中央スクロール + TOTAL固定 */
        grid-template-columns: 92px 1fr 88px;
        grid-template-rows: auto;
      }
      .gl-cls-col-fixed-left,
      .gl-cls-col-fixed-right,
      .gl-cls-col-scroll {
        display: flex; flex-direction: column;
      }
      .gl-cls-col-scroll {
        overflow-x: auto; overflow-y: hidden;
        scroll-behavior: smooth;
        -webkit-overflow-scrolling: touch;
      }
      .gl-cls-scroll-inner {
        display: grid;
        /* H1..H9, OUT, H10..H18, IN = 20列 */
        grid-template-columns: repeat(9, 52px) 62px repeat(9, 52px) 62px;
        min-width: min-content;
      }

      /* ===== セル共通 ===== */
      .gl-cls-cell {
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        border-right: 1px solid #e8dfc7;
        border-bottom: 1px solid #e8dfc7;
        text-align: center; box-sizing: border-box;
        padding: 2px;
        position: relative;
      }
      .gl-cls-cell--head {
        background: #1a5f3f; color: #fff;
        font-weight: 700; font-size: 13px;
        height: 32px;
      }
      .gl-cls-cell--par {
        background: #f0e8d0; color: #5a4a30;
        font-weight: 700; font-size: 15px;
        height: 32px;
      }
      .gl-cls-cell--player {
        background: #faf6ec; color: #333;
        font-weight: 700; font-size: 15px;
        padding: 4px 6px;
        justify-content: center; align-items: flex-start;
        text-align: left;
        cursor: pointer;
      }
      .gl-cls-cell--player small {
        display: block; font-size: 10px; font-weight: 500;
        margin-top: 2px;
      }
      .gl-cls-player-badge {
        display: inline-block; padding: 1px 5px;
        border-radius: 3px; font-size: 9px;
        font-weight: 600;
      }
      .gl-cls-player-badge--self { background: #1a5f3f; color: #fff; }
      .gl-cls-player-badge--shared { background: #999; color: #fff; }
      .gl-cls-player-badge--proxy { background: #ff9800; color: #fff; }

      /* ===== スコア入力セル ===== */
      .gl-cls-cell--score {
        height: 54px;
        background: #fff;
        cursor: pointer;
        font-size: 22px; font-weight: 700;
        transition: background .15s;
      }
      .gl-cls-cell--score:active {
        background: #e8f5e9;
      }
      .gl-cls-cell--putt {
        height: 30px;
        background: #fafafa;
        cursor: pointer;
        font-size: 13px; color: #666;
      }
      .gl-cls-cell--score--readonly,
      .gl-cls-cell--putt--readonly {
        cursor: default;
        background: #f5f5f5;
      }
      .gl-cls-cell--score--empty { color: #ccc; font-size: 16px; }
      .gl-cls-cell--putt-label {
        font-size: 9px; color: #999; margin-right: 3px;
      }

      /* ===== 集計セル ===== */
      .gl-cls-cell--sum {
        height: 54px;
        background: #ede4c7;
        color: #333;
        font-weight: 800; font-size: 20px;
        border-left: 2px solid #b8a878;
      }
      .gl-cls-cell--sum-putt {
        height: 30px;
        background: #e8dfbf;
        font-size: 12px; color: #5a4a30;
        border-left: 2px solid #b8a878;
      }
      .gl-cls-cell--sum-diff {
        font-size: 11px; font-weight: 600;
        margin-top: -2px;
      }

      /* ===== 現在ホールハイライト ===== */
      .gl-cls-cell--current {
        background: #fff9c4 !important;
        box-shadow: inset 0 0 0 2px #f9a825;
      }
      .gl-cls-cell--current.gl-cls-cell--score {
        transform: scale(1.02);
      }

      /* ===== ホール移動ナビ ===== */
      .gl-cls-nav {
        display: flex; justify-content: space-between; align-items: center;
        padding: 8px; margin-top: 8px;
        background: #fff; border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,.05);
      }
      .gl-cls-nav button {
        padding: 8px 16px; background: #1a5f3f; color: #fff;
        border: none; border-radius: 6px; font-size: 14px; font-weight: 600;
        cursor: pointer;
      }
      .gl-cls-nav button:disabled { background: #ccc; }
      .gl-cls-nav-hole {
        font-size: 16px; font-weight: 800; color: #1a5f3f;
      }

      /* ===== 下部アクション ===== */
      .gl-cls-actions {
        display: flex; gap: 6px; margin-top: 8px;
      }
      .gl-cls-actions button {
        flex: 1; padding: 10px; border-radius: 6px; border: none;
        font-size: 13px; font-weight: 600; cursor: pointer;
      }
      .gl-cls-btn-invite { background: #fff; color: #1a5f3f; border: 2px solid #1a5f3f; }
      .gl-cls-btn-finish { background: #1a5f3f; color: #fff; }

      /* ===== 入力パネル ===== */
      .gl-cls-input-panel {
        position: fixed; left: 0; right: 0; bottom: 0;
        background: #fff; padding: 16px;
        box-shadow: 0 -4px 16px rgba(0,0,0,.15);
        z-index: 9000; transform: translateY(100%);
        transition: transform .25s ease-out;
        border-radius: 16px 16px 0 0;
      }
      .gl-cls-input-panel.show { transform: translateY(0); }
      .gl-cls-input-panel__title {
        font-size: 15px; font-weight: 700; color: #1a5f3f; margin-bottom: 8px;
      }
      .gl-cls-input-panel__grid {
        display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px;
      }
      .gl-cls-input-panel__key {
        padding: 16px 0; background: #f0f0f0; border: none;
        border-radius: 8px; font-size: 20px; font-weight: 700;
        cursor: pointer;
      }
      .gl-cls-input-panel__key--big {
        grid-column: span 2; background: #1a5f3f; color: #fff;
      }
      .gl-cls-input-panel__key--clear {
        background: #f44336; color: #fff;
      }
      .gl-cls-input-panel__close {
        margin-top: 10px; width: 100%; padding: 10px;
        background: none; border: 1px solid #ccc; border-radius: 6px;
        font-size: 13px; color: #666; cursor: pointer;
      }

      /* ===== 横画面: 閲覧専用ダッシュボード ===== */
      @media (orientation: landscape) and (min-height: 400px) {
        #view-score.gl-classic {
          padding: 4px;
        }
        .gl-cls-modes,
        .gl-cls-nav,
        .gl-cls-actions {
          display: none;
        }
        .gl-cls-landscape-hint {
          display: block !important;
        }
        .gl-cls-table {
          grid-template-columns: 100px 1fr 92px;
        }
        .gl-cls-scroll-inner {
          /* 横画面: 9ホール + 集計 = 10列 単位で見やすく */
          grid-template-columns: repeat(9, minmax(58px, 1fr)) 72px;
          min-width: 100%;
        }
        .gl-cls-cell--score {
          height: 44px; font-size: 20px;
          cursor: default;
        }
        .gl-cls-cell--putt { display: none; }
        .gl-cls-cell--sum-putt { display: none; }
        .gl-cls-cell--sum { height: 44px; font-size: 18px; }
        .gl-cls-cell--player { font-size: 14px; }
        .gl-cls-in-cols {
          display: none;
        }
      }
      .gl-cls-landscape-hint {
        display: none;
        text-align: center; padding: 4px;
        font-size: 11px; color: #888;
        background: #fff8e1; border-radius: 4px;
        margin-bottom: 4px;
      }

      /* ===== モーダル汎用 ===== */
      .gl-cls-modal {
        position: fixed; inset: 0; z-index: 9800;
        display: flex; align-items: center; justify-content: center;
        background: rgba(0,0,0,.5); padding: 20px;
      }
      .gl-cls-modal__body {
        background: #fff; padding: 24px; border-radius: 12px;
        max-width: 400px; width: 100%;
        box-shadow: 0 12px 40px rgba(0,0,0,.3);
      }
      .gl-cls-modal__title {
        font-size: 18px; font-weight: 700; color: #1a5f3f;
        margin: 0 0 12px;
      }
      .gl-cls-modal__kana {
        font-size: 32px; font-weight: 700; text-align: center;
        color: #1a5f3f; padding: 20px 0;
        letter-spacing: 4px;
      }
      .gl-cls-modal__name-big {
        font-size: 22px; font-weight: 700; text-align: center;
        margin-bottom: 4px;
      }
      .gl-cls-modal input {
        width: 100%; padding: 12px; font-size: 16px;
        border: 2px solid #ddd; border-radius: 6px;
        box-sizing: border-box; margin-bottom: 10px;
      }
      .gl-cls-modal input:focus { border-color: #1a5f3f; outline: none; }
      .gl-cls-modal__actions {
        display: flex; gap: 8px; margin-top: 12px;
      }
      .gl-cls-modal__actions button {
        flex: 1; padding: 12px; border-radius: 6px; border: none;
        font-size: 14px; font-weight: 600; cursor: pointer;
      }
      .gl-cls-modal__btn-ok { background: #1a5f3f; color: #fff; }
      .gl-cls-modal__btn-cancel { background: #f0f0f0; color: #333; }
    `;
    document.head.appendChild(style);
  }

  // ==== 描画 ====

  /**
   * プレイヤー配列を取得（自分を先頭、代理入力プレイヤー含む）
   */
  function _getPlayers() {
    const players = window.glState.get('players') || [];
    const proxies = window.glState.get('proxyPlayers') || [];
    const myUserId = window.glProfile.getUserId();
    const myProfile = window.glProfile.getStored();

    // 自分がplayersに居ない場合はフォールバック追加
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

  function _renderModeButtons() {
    const btn = (id, label, active) => `
      <button class="gl-cls-mode-btn ${active ? 'active' : ''}" data-mode="${id}">
        ${label}
      </button>
    `;
    return `
      <div class="gl-cls-modes">
        ${btn(MODES.STROKE, 'ストローク', currentMode === MODES.STROKE)}
        ${btn(MODES.SIGN, '<span class="gl-cls-mode-btn__symbols"><span>-</span><span>E</span><span>+</span></span>', currentMode === MODES.SIGN)}
        ${btn(MODES.SYMBOL, '<span class="gl-cls-mode-btn__symbols"><span>○</span><span>─</span><span>△</span></span>', currentMode === MODES.SYMBOL)}
      </div>
    `;
  }

  /**
   * ホール番号行 + Par行（左固定=空、中央=各ホール、右固定=TOTAL）
   */
  function _renderHeaderRows(pars) {
    const currentHole = window.glState.get('currentHole') || 1;

    // 左固定列: ヘッダー（Player + Par）
    const leftHead = `
      <div class="gl-cls-col-fixed-left">
        <div class="gl-cls-cell gl-cls-cell--head">Player</div>
        <div class="gl-cls-cell gl-cls-cell--par">Par</div>
      </div>
    `;

    // 中央スクロール: ホール番号行 + Par行
    let holeCells = '';
    let parCells = '';
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

    // 右固定列: TOTAL
    const rightHead = `
      <div class="gl-cls-col-fixed-right">
        <div class="gl-cls-cell gl-cls-cell--head">TOTAL</div>
        <div class="gl-cls-cell gl-cls-cell--par">${_parSum(pars, 1, 18)}</div>
      </div>
    `;

    return { leftHead, holeCells, parCells, rightHead };
  }

  /**
   * プレイヤー1名の行を描画
   * @returns {{left, center, right}} 3列分のHTML
   */
  function _renderPlayerRow(player, pars) {
    const type = _getPlayerType(player);
    const isSelf = type === 'self';
    const currentHole = window.glState.get('currentHole') || 1;

    // 表示名
    const displayName = window.glProfile.getDisplayName(player);
    const badge = isSelf
      ? '<span class="gl-cls-player-badge gl-cls-player-badge--self">自分</span>'
      : type === 'shared'
      ? '<span class="gl-cls-player-badge gl-cls-player-badge--shared">共有</span>'
      : '<span class="gl-cls-player-badge gl-cls-player-badge--proxy">代理</span>';

    // ===== 左固定: プレイヤー名 =====
    // 自分は2行分の高さ(score+putt)、同伴者は1行分(score のみ)
    const nameRowSpan = isSelf ? 2 : 1;
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

    // ===== 中央スクロール: 各ホール + 集計 =====
    let scoreRow = '';
    let puttRow = '';

    // 前半 1〜9
    for (let h = 1; h <= 9; h++) {
      const strokes = _getStrokes(player.userId, h);
      const par = pars[h - 1];
      const cur = h === currentHole ? ' gl-cls-cell--current' : '';
      const editable = isSelf || type === 'proxy';
      const readonlyCls = editable ? '' : ' gl-cls-cell--score--readonly';
      const emptyCls = strokes === null ? ' gl-cls-cell--score--empty' : '';
      const display = _cellDisplay(strokes, par);
      const color = currentMode === MODES.STROKE ? _colorForScore(strokes, par) : '#222';

      scoreRow += `
        <div class="gl-cls-cell gl-cls-cell--score${cur}${readonlyCls}${emptyCls}"
             data-player="${player.userId}"
             data-hole="${h}"
             data-editable="${editable ? '1' : '0'}"
             style="color: ${color};">
          ${display || '·'}
        </div>
      `;

      if (isSelf) {
        const putts = _getPutts(player.userId, h);
        puttRow += `
          <div class="gl-cls-cell gl-cls-cell--putt${cur}"
               data-player="${player.userId}"
               data-hole="${h}"
               data-input-type="putt"
               data-editable="1">
            <span class="gl-cls-cell--putt-label">Pt</span>${putts !== null ? putts : ''}
          </div>
        `;
      }
    }

    // OUT 集計
    const outStrokes = _sumStrokes(player.userId, 1, 9);
    const outParSum = _parSum(pars, 1, 9);
    const outDiff = outStrokes !== null ? _signFor(outStrokes, outParSum) : '';
    scoreRow += `
      <div class="gl-cls-cell gl-cls-cell--sum">
        <div>${outStrokes !== null ? outStrokes : '·'}</div>
        ${outStrokes !== null ? `<div class="gl-cls-cell--sum-diff" style="color: ${_colorForScore(outStrokes, outParSum)};">${outDiff}</div>` : ''}
      </div>
    `;
    if (isSelf) {
      const outPutts = _sumPutts(player.userId, 1, 9);
      puttRow += `<div class="gl-cls-cell gl-cls-cell--sum-putt">${outPutts !== null ? 'Pt' + outPutts : ''}</div>`;
    }

    // 後半 10〜18
    for (let h = 10; h <= 18; h++) {
      const strokes = _getStrokes(player.userId, h);
      const par = pars[h - 1];
      const cur = h === currentHole ? ' gl-cls-cell--current' : '';
      const editable = isSelf || type === 'proxy';
      const readonlyCls = editable ? '' : ' gl-cls-cell--score--readonly';
      const emptyCls = strokes === null ? ' gl-cls-cell--score--empty' : '';
      const display = _cellDisplay(strokes, par);
      const color = currentMode === MODES.STROKE ? _colorForScore(strokes, par) : '#222';

      scoreRow += `
        <div class="gl-cls-cell gl-cls-cell--score${cur}${readonlyCls}${emptyCls}"
             data-player="${player.userId}"
             data-hole="${h}"
             data-editable="${editable ? '1' : '0'}"
             style="color: ${color};">
          ${display || '·'}
        </div>
      `;

      if (isSelf) {
        const putts = _getPutts(player.userId, h);
        puttRow += `
          <div class="gl-cls-cell gl-cls-cell--putt${cur}"
               data-player="${player.userId}"
               data-hole="${h}"
               data-input-type="putt"
               data-editable="1">
            <span class="gl-cls-cell--putt-label">Pt</span>${putts !== null ? putts : ''}
          </div>
        `;
      }
    }

    // IN 集計
    const inStrokes = _sumStrokes(player.userId, 10, 18);
    const inParSum = _parSum(pars, 10, 18);
    const inDiff = inStrokes !== null ? _signFor(inStrokes, inParSum) : '';
    scoreRow += `
      <div class="gl-cls-cell gl-cls-cell--sum">
        <div>${inStrokes !== null ? inStrokes : '·'}</div>
        ${inStrokes !== null ? `<div class="gl-cls-cell--sum-diff" style="color: ${_colorForScore(inStrokes, inParSum)};">${inDiff}</div>` : ''}
      </div>
    `;
    if (isSelf) {
      const inPutts = _sumPutts(player.userId, 10, 18);
      puttRow += `<div class="gl-cls-cell gl-cls-cell--sum-putt">${inPutts !== null ? 'Pt' + inPutts : ''}</div>`;
    }

    // ===== 右固定: TOTAL =====
    const totalStrokes = _sumStrokes(player.userId, 1, 18);
    const totalParSum = _parSum(pars, 1, 18);
    const totalDiff = totalStrokes !== null ? _signFor(totalStrokes, totalParSum) : '';
    let right = `
      <div class="gl-cls-cell gl-cls-cell--sum">
        <div>${totalStrokes !== null ? totalStrokes : '·'}</div>
        ${totalStrokes !== null ? `<div class="gl-cls-cell--sum-diff" style="color: ${_colorForScore(totalStrokes, totalParSum)};">${totalDiff}</div>` : ''}
      </div>
    `;
    if (isSelf) {
      const totPutts = _sumPutts(player.userId, 1, 18);
      right += `<div class="gl-cls-cell gl-cls-cell--sum-putt">${totPutts !== null ? 'Pt' + totPutts : ''}</div>`;
    }

    return { left, scoreRow, puttRow, right, isSelf };
  }

  /**
   * メイン描画
   */
  function _render() {
    _injectStyles();
    const view = document.getElementById('view-score');
    if (!view) return;

    view.classList.add('gl-classic');

    const pars = _getPars();
    const players = _getPlayers();
    const currentHole = window.glState.get('currentHole') || 1;
    const groupCode = window.glState.get('groupCode') || '- - - -';

    const { leftHead, holeCells, parCells, rightHead } = _renderHeaderRows(pars);

    // プレイヤー行の左固定・中央・右固定を組み立て
    let leftCol = '';
    let centerCol = '';
    let rightCol = '';
    players.forEach((p) => {
      const row = _renderPlayerRow(p, pars);
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

      ${_renderModeButtons()}

      <div class="gl-cls-landscape-hint">📱 横画面：閲覧モード（編集は縦画面で）</div>

      <div class="gl-cls-table-wrap">
        <div class="gl-cls-table">
          <div class="gl-cls-col-fixed-left">
            ${leftHead}
            ${leftCol}
          </div>
          <div class="gl-cls-col-scroll" id="gl-cls-scroll">
            <div class="gl-cls-scroll-inner">
              ${holeCells}
              ${parCells}
              ${centerCol}
            </div>
          </div>
          <div class="gl-cls-col-fixed-right">
            ${rightHead}
            ${rightCol}
          </div>
        </div>
      </div>

      <div class="gl-cls-nav">
        <button data-hole-prev ${currentHole <= 1 ? 'disabled' : ''}>← 前</button>
        <div class="gl-cls-nav-hole">HOLE ${currentHole}</div>
        <button data-hole-next ${currentHole >= HOLES ? 'disabled' : ''}>次 →</button>
      </div>

      <div class="gl-cls-actions">
        <button class="gl-cls-btn-invite" data-invite>📤 招待</button>
        <button class="gl-cls-btn-finish" data-finish>🏁 終了・保存</button>
      </div>
    `;

    _bindEvents();
    _scrollToCurrentHole();
  }

  /**
   * 現在ホールを中央にスクロール
   */
  function _scrollToCurrentHole() {
    setTimeout(() => {
      const scroller = document.getElementById('gl-cls-scroll');
      if (!scroller) return;
      const inner = scroller.querySelector('.gl-cls-scroll-inner');
      if (!inner) return;
      const currentHole = window.glState.get('currentHole') || 1;

      // ホール1〜9はそのままの位置、10以降はOUT列を挟むので +1
      // 各列のインデックス(0-based)を計算
      const colIdx = currentHole <= 9 ? currentHole - 1 : currentHole; // OUT列を挟むぶん+1
      // 各セルの幅を推定
      const totalCols = 20; // 9 + OUT + 9 + IN
      const innerWidth = inner.scrollWidth;
      const cellWidth = innerWidth / totalCols;
      const scrollerWidth = scroller.clientWidth;
      const targetScroll = colIdx * cellWidth - scrollerWidth / 2 + cellWidth / 2;
      scroller.scrollLeft = Math.max(0, targetScroll);
    }, 50);
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

    // モード切替
    view.querySelectorAll('[data-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        currentMode = btn.dataset.mode;
        _render();
      });
    });

    // スコアセル・パットセルタップ → 入力パネル
    view.querySelectorAll('[data-player][data-hole]').forEach((cell) => {
      cell.addEventListener('click', () => {
        if (cell.dataset.editable !== '1') return;
        const playerId = cell.dataset.player;
        const hole = parseInt(cell.dataset.hole, 10);
        const inputType = cell.dataset.inputType === 'putt' ? 'putt' : 'strokes';
        _showInputPanel(playerId, hole, inputType);
      });
    });

    // プレイヤー名タップ
    view.querySelectorAll('[data-player-name]').forEach((cell) => {
      cell.addEventListener('click', () => {
        const playerId = cell.dataset.playerName;
        const type = cell.dataset.playerType;
        _handlePlayerNameTap(playerId, type);
      });
    });

    // 招待・終了
    view.querySelector('[data-invite]')?.addEventListener('click', () => {
      window.glEvents.emit('ui:navigate', { view: 'golf' });
    });

    view.querySelector('[data-finish]')?.addEventListener('click', () => _finishRound());
  }

  // ==== 入力パネル ====

  function _showInputPanel(playerId, hole, inputType) {
    // 既存パネル除去
    document.getElementById('gl-cls-input-panel')?.remove();

    const label = inputType === 'putt' ? 'パット数' : 'ストローク数';
    const currentVal = inputType === 'putt' ? _getPutts(playerId, hole) : _getStrokes(playerId, hole);

    const panel = document.createElement('div');
    panel.id = 'gl-cls-input-panel';
    panel.className = 'gl-cls-input-panel';

    const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const keyBtns = keys.map((k) => `
      <button class="gl-cls-input-panel__key" data-key="${k}">${k}</button>
    `).join('');

    panel.innerHTML = `
      <div class="gl-cls-input-panel__title">HOLE ${hole} — ${label}${currentVal !== null ? ` (現在: ${currentVal})` : ''}</div>
      <div class="gl-cls-input-panel__grid">
        ${keyBtns}
      </div>
      <button class="gl-cls-input-panel__close" data-close>キャンセル</button>
    `;
    document.body.appendChild(panel);

    // 表示アニメ
    requestAnimationFrame(() => panel.classList.add('show'));

    panel.querySelectorAll('[data-key]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = parseInt(btn.dataset.key, 10);
        _saveInput(playerId, hole, inputType, val);
        _closeInputPanel();
      });
    });

    panel.querySelector('[data-close]').addEventListener('click', _closeInputPanel);
  }

  function _closeInputPanel() {
    const panel = document.getElementById('gl-cls-input-panel');
    if (!panel) return;
    panel.classList.remove('show');
    setTimeout(() => panel.remove(), 250);
  }

  /**
   * 入力保存（ストロークは既存 glScore.save、パットは独自保存）
   */
  function _saveInput(playerId, hole, inputType, value) {
    if (inputType === 'strokes') {
      // 既存の楽観的UIフロー
      window.glScore.save(playerId, hole, value);

      // 次ホール自動移動（自分の入力時のみ、現在ホール = 入力ホールの場合）
      const myUserId = window.glProfile.getUserId();
      const currentHole = window.glState.get('currentHole') || 1;
      if (playerId === myUserId && hole === currentHole && currentHole < HOLES) {
        window.glState.set('currentHole', currentHole + 1);
      }
    } else {
      // パット数保存（state直接、キューはstrokesと同じキーで別フィールド）
      const scores = window.glState.get('scores') || {};
      if (!scores[playerId]) scores[playerId] = {};
      scores[playerId]['putt' + hole] = value;
      window.glState.set('scores', { ...scores });
      // TODO: パット数の永続化は将来 saveScore に統合予定（現状はstateとキャッシュのみ）
    }
    // 再描画は state 変更経由で自動発火
  }

  // ==== プレイヤー名タップハンドラ ====

  function _handlePlayerNameTap(playerId, type) {
    if (type === 'self') return; // 自分の名前は変更不可

    const players = _getPlayers();
    const player = players.find((p) => p.userId === playerId);
    if (!player) return;

    if (type === 'shared') {
      // 共有: ふりがな表示モーダル
      _showKanaViewModal(player);
    } else if (type === 'proxy') {
      // 代理: 名前入力モーダル
      _showProxyEditModal(player);
    }
  }

  function _showKanaViewModal(player) {
    const kana = player.familyKana || '（ふりがな未登録）';
    const modal = document.createElement('div');
    modal.className = 'gl-cls-modal';
    modal.innerHTML = `
      <div class="gl-cls-modal__body">
        <h2 class="gl-cls-modal__title">プレイヤー情報</h2>
        <div class="gl-cls-modal__name-big">${window.glProfile.getDisplayName(player)}</div>
        <div class="gl-cls-modal__kana">${kana}</div>
        <div class="gl-cls-modal__actions">
          <button class="gl-cls-modal__btn-ok" data-close>閉じる</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('[data-close]').addEventListener('click', close);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) close();
    });
  }

  function _showProxyEditModal(player) {
    const modal = document.createElement('div');
    modal.className = 'gl-cls-modal';
    modal.innerHTML = `
      <div class="gl-cls-modal__body">
        <h2 class="gl-cls-modal__title">代理入力プレイヤー</h2>
        <label style="font-size:13px;color:#666;">名前 <span style="color:#f44336;">*</span></label>
        <input type="text" id="proxy-name" value="${player.familyName || player.displayName || ''}" placeholder="例: 田中">
        <label style="font-size:13px;color:#666;">ふりがな（任意）</label>
        <input type="text" id="proxy-kana" value="${player.familyKana || ''}" placeholder="例: たなか">
        <div class="gl-cls-modal__actions">
          <button class="gl-cls-modal__btn-cancel" data-cancel>キャンセル</button>
          <button class="gl-cls-modal__btn-ok" data-save>保存</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('[data-cancel]').addEventListener('click', close);
    modal.querySelector('[data-save]').addEventListener('click', () => {
      const name = document.getElementById('proxy-name').value.trim();
      const kana = document.getElementById('proxy-kana').value.trim();
      if (!name) {
        window.glToast.warn('名前は必須です');
        return;
      }
      // proxyPlayers を更新
      const proxies = window.glState.get('proxyPlayers') || [];
      const idx = proxies.findIndex((p) => p.userId === player.userId);
      if (idx >= 0) {
        proxies[idx] = { ...proxies[idx], familyName: name, familyKana: kana, displayName: name };
        window.glState.set('proxyPlayers', [...proxies]);
      }
      window.glToast.success('保存しました');
      close();
    });
    modal.addEventListener('click', (e) => {
      if (e.target === modal) close();
    });
  }

  // ==== ラウンド終了 ====

  function _finishRound() {
    if (!confirm('このラウンドを終了・保存しますか？')) return;

    const roundId = window.glState.get('roundId');
    const players = _getPlayers();
    const scores = window.glState.get('scores') || {};

    window.glHistory.saveRound({
      roundId,
      endedAt: new Date().toISOString(),
      players,
      scores,
      theme: 'classic',
    });

    if (!window.glProfile.isFull()) {
      window.glToast.info('プロフィールを完成させると詳細分析が使えます');
    }

    window.glRound.leave();
    window.glToast.success('ラウンドを保存しました');
    window.glEvents.emit('ui:navigate', { view: 'history' });
  }

  // ==== ライフサイクル ====

  const classicTheme = {
    id: 'classic',
    name: 'クラシック',
    description: '本物のスコアカード風。18ホール横スクロール表示',

    show() {
      _render();
      document.getElementById('view-score')?.classList.add('show');
      window.glState.set('phase', 'S6');

      // 状態変更で再描画（フォーカス中は書き換えない配慮は不要 - パネル式なので）
      unsubScores = window.glState.subscribe('scores', () => _render());
      unsubPlayers = window.glState.subscribe('players', () => _render());

      // 画面回転で再描画
      orientationMedia = window.matchMedia('(orientation: landscape)');
      const rerender = () => _render();
      orientationMedia.addEventListener('change', rerender);
      this._orientationHandler = rerender;
    },

    hide() {
      const view = document.getElementById('view-score');
      if (view) {
        view.classList.remove('show');
        view.classList.remove('gl-classic');
      }
      _closeInputPanel();
      if (unsubScores) { unsubScores(); unsubScores = null; }
      if (unsubPlayers) { unsubPlayers(); unsubPlayers = null; }
      if (orientationMedia && this._orientationHandler) {
        orientationMedia.removeEventListener('change', this._orientationHandler);
      }
    },
  };

  // ⭐ テーマとして登録
  window.glScoreThemes = window.glScoreThemes || {};
  window.glScoreThemes.classic = classicTheme;
})();
