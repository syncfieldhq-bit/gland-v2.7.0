/**
 * G-LAND v2.7.2 - Score Theme: Classic (完全版・全18機能統合)
 * ============================================================
 * 本物の紙スコアカード風UI。18ホール横スクロール、セル直接タップ入力。
 *
 * ▼ 主要機能:
 *   - 22列レイアウト（Player + H1〜H9 + OUT + H10〜H18 + IN + TOTAL）
 *   - 3表示モード（ストローク / -E+ / ○─△）
 *   - 左右固定列 + 中央横スクロール
 *   - 現在ホールのハイライト（黄背景+深緑文字の白抜き逆転）
 *   - 入力パネル: 自動プレイヤー切替（保存→次の人→全員完了で次ホール自動移動）
 *   - 過去ホール修正フロー（単独パネル、元位置に戻る）
 *   - 代理入力プレイヤー最大3名対応
 *   - 共有プレイヤーはスキップ（本人が入力）
 *   - 横画面: 閲覧専用ダッシュボード（9ホールずつ横スクロール）
 *   - 上部情報バー: ⏰ 午後スタート時刻 + 🔑 ロッカー番号
 *   - 💚 LINE 途中経過共有ボタン
 *   - iPhone ノッチ対応の safe-area padding
 */
(function () {
  'use strict';

  // ==== 定数 ====
  const HOLES = 18;
  const DEFAULT_PAR = 4;
  const MODES = { STROKE: 'stroke', SIGN: 'sign', SYMBOL: 'symbol' };
  const STORAGE_KEYS = {
    afternoon: 'gl_afternoon_start_v1',
    locker: 'gl_locker_number_v1',
  };

  // 状態
  let currentMode = MODES.STROKE;
  let unsubScores = null;
  let unsubPlayers = null;
  let unsubProxies = null;
  let orientationMedia = null;
  let clockTimer = null;

  // 入力パネル関連
  let inputSession = null; // { hole, playerQueue, currentIdx, isEditingPast }

  // ==== ヘルパー ====

  function _getPars() {
    return new Array(HOLES).fill(DEFAULT_PAR);
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

  function _getPlayerType(player) {
    const myUserId = window.glProfile.getUserId();
    if (player.userId === myUserId) return 'self';
    if (player.isProxy || player.role === 'proxy') return 'proxy';
    return 'shared';
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

  /**
   * 現在ホール = 「まだ入力が完了していない最小ホール」
   * 自分と全ての代理プレイヤーがストローク入力済み → その次
   */
  function _computeCurrentHole() {
    const players = _getPlayers().filter((p) => {
      const t = _getPlayerType(p);
      return t === 'self' || t === 'proxy';
    });
    if (players.length === 0) return 1;

    for (let h = 1; h <= HOLES; h++) {
      const allDone = players.every((p) => _getStrokes(p.userId, h) !== null && _getStrokes(p.userId, h) !== undefined);
      if (!allDone) return h;
    }
    return HOLES; // 全ホール入力済みなら最終ホール
  }

  // ==== スタイル注入 ====

  function _injectStyles() {
    if (document.getElementById('gl-classic-styles')) return;
    const style = document.createElement('style');
    style.id = 'gl-classic-styles';
    style.textContent = `
      /* ===== 全体レイアウト ===== */
      #view-score.gl-classic {
        min-height: 100vh; box-sizing: border-box;
        padding: calc(env(safe-area-inset-top, 0px) + 8px) 8px 8px 8px;
        background: #f5f2ea;
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
        font-size: 15px; font-weight: 700; color: #1a5f3f; letter-spacing: 1px;
      }
      .gl-cls-logo small { font-size: 11px; opacity: .7; margin-left: 6px; }
      .gl-cls-code { font-size: 12px; color: #666; }
      .gl-cls-code b { color: #1a5f3f; font-family: monospace; font-size: 14px; }

      /* ===== 情報バー (v2.7.2 NEW) ===== */
      .gl-cls-info-bar {
        display: flex; justify-content: space-between; align-items: center;
        padding: 8px 12px; margin-bottom: 8px;
        background: #f0e8d0; border-radius: 8px;
        border: 1px solid #d4c8a8;
      }
      .gl-cls-info-item {
        display: flex; align-items: center; gap: 6px;
        cursor: pointer; padding: 4px 8px;
        border-radius: 6px; transition: background .15s;
        font-size: 13px; color: #5a4a30;
      }
      .gl-cls-info-item:active { background: rgba(0,0,0,.06); }
      .gl-cls-info-item__icon { font-size: 16px; }
      .gl-cls-info-item__value {
        font-weight: 700; color: #1a5f3f;
      }
      .gl-cls-info-item__value--empty {
        color: #999; font-weight: 500;
      }
      .gl-cls-info-item__count {
        font-size: 11px; color: #666; margin-left: 4px;
      }
      .gl-cls-info-item__count--over {
        color: #d32f2f; font-weight: 700;
      }

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
        grid-template-columns: 92px 1fr 88px;
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
        padding: 2px; position: relative;
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
        text-align: left; cursor: pointer;
      }
      .gl-cls-cell--player small {
        display: block; font-size: 10px; font-weight: 500;
        margin-top: 2px;
      }
      .gl-cls-player-badge {
        display: inline-block; padding: 1px 5px;
        border-radius: 3px; font-size: 9px; font-weight: 600;
      }
      .gl-cls-player-badge--self { background: #1a5f3f; color: #fff; }
      .gl-cls-player-badge--shared { background: #999; color: #fff; }
      .gl-cls-player-badge--proxy { background: #ff9800; color: #fff; }

      /* ===== スコア入力セル ===== */
      .gl-cls-cell--score {
        height: 54px; background: #fff; cursor: pointer;
        font-size: 22px; font-weight: 700;
        transition: background .15s;
      }
      .gl-cls-cell--score:active { background: #e8f5e9; }
      .gl-cls-cell--putt {
        height: 30px; background: #fafafa; cursor: pointer;
        font-size: 13px; color: #666;
      }
      .gl-cls-cell--score--readonly,
      .gl-cls-cell--putt--readonly {
        cursor: default; background: #f5f5f5;
      }
      .gl-cls-cell--score--empty { color: #ccc; font-size: 16px; }
      .gl-cls-cell--putt-label {
        font-size: 9px; color: #999; margin-right: 3px;
      }

      /* ===== 集計セル ===== */
      .gl-cls-cell--sum {
        height: 54px; background: #ede4c7; color: #333;
        font-weight: 800; font-size: 20px;
        border-left: 2px solid #b8a878;
      }
      .gl-cls-cell--sum-putt {
        height: 30px; background: #e8dfbf;
        font-size: 12px; color: #5a4a30;
        border-left: 2px solid #b8a878;
      }
      .gl-cls-cell--sum-diff {
        font-size: 11px; font-weight: 600; margin-top: -2px;
      }

      /* ===== 現在ホールハイライト (v2.7.2 白抜き逆転) ===== */
      .gl-cls-cell--head.gl-cls-cell--current {
        background: #fff59d !important;
        color: #1a5f3f !important;
        font-weight: 800;
      }
      .gl-cls-cell--par.gl-cls-cell--current {
        background: #fff59d !important;
        color: #1a5f3f !important;
        font-weight: 800;
        box-shadow: inset 0 -2px 0 #f9a825;
      }
      .gl-cls-cell--score.gl-cls-cell--current {
        background: #fffde7 !important;
        box-shadow: inset 0 0 0 2px #f9a825;
      }
      .gl-cls-cell--putt.gl-cls-cell--current {
        background: #fff8e1 !important;
      }

      /* ===== 下部アクション ===== */
      .gl-cls-actions {
        display: grid; grid-template-columns: 1fr 1fr 1fr;
        gap: 6px; margin-top: 8px;
      }
      .gl-cls-actions button {
        padding: 10px 6px; border-radius: 6px; border: none;
        font-size: 13px; font-weight: 600; cursor: pointer;
      }
      .gl-cls-btn-invite { background: #fff; color: #1a5f3f; border: 2px solid #1a5f3f; }
      .gl-cls-btn-line { background: #06c755; color: #fff; }
      .gl-cls-btn-finish { background: #1a5f3f; color: #fff; }

      /* ===== 入力パネル ===== */
      .gl-cls-panel-overlay {
        position: fixed; inset: 0; z-index: 8999;
        background: rgba(0,0,0,.35);
        opacity: 0; transition: opacity .2s;
      }
      .gl-cls-panel-overlay.show { opacity: 1; }
      .gl-cls-input-panel {
        position: fixed; left: 0; right: 0; bottom: 0;
        background: #fff; padding: 16px;
        box-shadow: 0 -4px 16px rgba(0,0,0,.15);
        z-index: 9000; transform: translateY(100%);
        transition: transform .25s ease-out;
        border-radius: 16px 16px 0 0;
        max-height: 85vh; overflow-y: auto;
        padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 16px);
      }
      .gl-cls-input-panel.show { transform: translateY(0); }
      .gl-cls-panel-header {
        display: flex; justify-content: space-between; align-items: center;
        margin-bottom: 12px; padding-bottom: 8px;
        border-bottom: 2px solid #f0e8d0;
      }
      .gl-cls-panel-hole {
        font-size: 20px; font-weight: 800; color: #1a5f3f;
      }
      .gl-cls-panel-progress {
        font-size: 12px; color: #888;
        background: #f0e8d0; padding: 3px 8px;
        border-radius: 12px;
      }
      .gl-cls-panel-player {
        font-size: 16px; font-weight: 700; color: #333;
        margin-bottom: 10px;
        display: flex; align-items: center; gap: 6px;
      }
      .gl-cls-panel-section-label {
        font-size: 13px; font-weight: 600; color: #5a4a30;
        margin: 10px 0 6px;
      }
      .gl-cls-panel-keys {
        display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px;
        margin-bottom: 4px;
      }
      .gl-cls-panel-key {
        padding: 14px 0; background: #f0f0f0; border: 2px solid transparent;
        border-radius: 8px; font-size: 18px; font-weight: 700;
        cursor: pointer; transition: all .1s;
      }
      .gl-cls-panel-key:active { transform: scale(.95); }
      .gl-cls-panel-key.selected {
        background: #1a5f3f; color: #fff;
        border-color: #0f4028;
      }
      .gl-cls-panel-key--putt.selected {
        background: #f9a825; color: #fff;
        border-color: #c17900;
      }
      .gl-cls-panel-actions {
        display: grid; grid-template-columns: 1fr 2fr; gap: 8px;
        margin-top: 14px;
      }
      .gl-cls-panel-btn-cancel {
        padding: 14px; background: #f5f5f5; border: none;
        border-radius: 8px; font-size: 14px; color: #666;
        cursor: pointer;
      }
      .gl-cls-panel-btn-save {
        padding: 14px; background: #1a5f3f; color: #fff;
        border: none; border-radius: 8px;
        font-size: 15px; font-weight: 700; cursor: pointer;
      }
      .gl-cls-panel-btn-save:disabled {
        background: #ccc; cursor: default;
      }

      /* ===== 横画面: 閲覧専用ダッシュボード ===== */
      @media (orientation: landscape) and (min-height: 400px) {
        #view-score.gl-classic {
          padding: 4px;
        }
        .gl-cls-header,
        .gl-cls-info-bar,
        .gl-cls-actions {
          display: none;
        }
        .gl-cls-table {
          grid-template-columns: 100px 1fr 92px;
        }
        .gl-cls-scroll-inner {
          grid-template-columns: repeat(9, minmax(58px, 1fr)) 72px;
          min-width: 100%;
        }
        .gl-cls-cell--score {
          height: 44px; font-size: 20px; cursor: default;
        }
        .gl-cls-cell--putt,
        .gl-cls-cell--sum-putt { display: none; }
        .gl-cls-cell--sum { height: 44px; font-size: 18px; }
        .gl-cls-cell--player { font-size: 14px; }
      }

      /* ===== モーダル共通 ===== */
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
        color: #1a5f3f; padding: 20px 0; letter-spacing: 4px;
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

      /* ===== 時刻ホイールピッカー ===== */
      .gl-cls-timepicker {
        display: flex; justify-content: center; gap: 8px;
        margin: 16px 0;
      }
      .gl-cls-timepicker-col {
        flex: 1; max-width: 90px;
        border: 2px solid #ddd; border-radius: 8px;
        overflow: hidden; background: #fafafa;
      }
      .gl-cls-timepicker-label {
        text-align: center; padding: 4px;
        background: #1a5f3f; color: #fff;
        font-size: 12px; font-weight: 600;
      }
      .gl-cls-timepicker-input {
        width: 100% !important;
        text-align: center;
        font-size: 32px !important;
        font-weight: 700 !important;
        padding: 12px 4px !important;
        border: none !important;
        margin: 0 !important;
        background: transparent !important;
        color: #1a5f3f !important;
        -moz-appearance: textfield;
      }
      .gl-cls-timepicker-input::-webkit-outer-spin-button,
      .gl-cls-timepicker-input::-webkit-inner-spin-button {
        -webkit-appearance: none; margin: 0;
      }

      /* ===== LINE 共有モーダル ===== */
      .gl-cls-line-option {
        display: flex; align-items: flex-start; gap: 10px;
        padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px;
        margin-bottom: 8px; cursor: pointer;
      }
      .gl-cls-line-option.active {
        border-color: #06c755; background: #f0fdf4;
      }
      .gl-cls-line-option input { width: auto !important; margin: 4px 0 0 !important; accent-color: #06c755; }
      .gl-cls-line-option-body { flex: 1; }
      .gl-cls-line-option-title { font-weight: 700; margin-bottom: 4px; }
      .gl-cls-line-option-desc { font-size: 12px; color: #666; }
    `;
    document.head.appendChild(style);
  }

  // ==== 上部情報バー描画 ====

  function _renderInfoBar() {
    const afternoon = window.glState.get('afternoonStart') || window.glStorage.readLocal(STORAGE_KEYS.afternoon);
    const locker = window.glState.get('lockerNumber') || window.glStorage.readLocal(STORAGE_KEYS.locker);

    // 午後スタート時刻の表示
    let afternoonDisplay = '';
    let afternoonCount = '';
    let countOverClass = '';

    const now = new Date();
    const currentTime = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');

    if (afternoon) {
      // 設定済み: 残り時間をカウントダウン
      const [h, m] = afternoon.split(':').map(Number);
      const target = new Date();
      target.setHours(h, m, 0, 0);
      const diffMs = target.getTime() - now.getTime();
      const diffMin = Math.floor(diffMs / 60000);

      if (diffMin > 0) {
        afternoonDisplay = '午後 ' + afternoon;
        afternoonCount = `(あと ${diffMin}分)`;
      } else {
        // 過ぎたら現在時刻に戻る表示
        afternoonDisplay = currentTime;
        afternoonCount = '(現在)';
      }
    } else {
      // 未設定: 現在時刻
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
          <span style="font-size:12px;">ロッカー:</span>
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
      // 情報バーだけを部分再描画
      const newBar = document.createElement('div');
      newBar.innerHTML = _renderInfoBar();
      bar.replaceWith(newBar.firstElementChild);
      _bindInfoBarEvents();
    }, 30000); // 30秒ごと
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

  function _showAfternoonPicker() {
    const current = window.glState.get('afternoonStart') || '';
    let defaultH, defaultM;
    if (current) {
      [defaultH, defaultM] = current.split(':').map(Number);
    } else {
      // 現在時刻 + 45分をデフォルトに
      const now = new Date();
      now.setMinutes(now.getMinutes() + 45);
      defaultH = now.getHours();
      defaultM = now.getMinutes();
    }

    const modal = document.createElement('div');
    modal.className = 'gl-cls-modal';
    modal.innerHTML = `
      <div class="gl-cls-modal__body">
        <h2 class="gl-cls-modal__title">⏰ 午後スタート時刻</h2>
        <p style="font-size:13px;color:#666;">マスター室で言われた時刻を設定します</p>
        <div class="gl-cls-timepicker">
          <div class="gl-cls-timepicker-col">
            <div class="gl-cls-timepicker-label">時</div>
            <input type="number" class="gl-cls-timepicker-input" id="tp-hour" min="0" max="23" value="${defaultH}">
          </div>
          <div class="gl-cls-timepicker-col">
            <div class="gl-cls-timepicker-label">分</div>
            <input type="number" class="gl-cls-timepicker-input" id="tp-min" min="0" max="59" value="${defaultM}">
          </div>
        </div>
        <div class="gl-cls-modal__actions">
          ${current ? '<button class="gl-cls-modal__btn-cancel" data-clear>クリア</button>' : ''}
          <button class="gl-cls-modal__btn-cancel" data-cancel>閉じる</button>
          <button class="gl-cls-modal__btn-ok" data-save>保存</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('[data-cancel]')?.addEventListener('click', close);
    modal.querySelector('[data-clear]')?.addEventListener('click', () => {
      window.glState.set('afternoonStart', null);
      window.glStorage.writeLocal(STORAGE_KEYS.afternoon, null);
      window.glToast.info('午後スタート時刻をクリアしました');
      close();
      _render();
    });
    modal.querySelector('[data-save]').addEventListener('click', () => {
      const h = Math.max(0, Math.min(23, parseInt(document.getElementById('tp-hour').value, 10) || 0));
      const m = Math.max(0, Math.min(59, parseInt(document.getElementById('tp-min').value, 10) || 0));
      const timeStr = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
      window.glState.set('afternoonStart', timeStr);
      window.glStorage.writeLocal(STORAGE_KEYS.afternoon, timeStr);
      window.glToast.success('午後スタート: ' + timeStr);
      close();
      _render();
    });
  }

  function _showLockerModal() {
    const current = window.glState.get('lockerNumber') || '';
    const modal = document.createElement('div');
    modal.className = 'gl-cls-modal';
    modal.innerHTML = `
      <div class="gl-cls-modal__body">
        <h2 class="gl-cls-modal__title">🔑 貴重品ロッカー番号</h2>
        <p style="font-size:13px;color:#666;">ラウンド後に戻る貴重品ロッカーの番号</p>
        <input type="text" id="locker-input" value="${current}" placeholder="例: 127" style="text-align:center;font-size:24px;font-weight:700;">
        <div class="gl-cls-modal__actions">
          ${current ? '<button class="gl-cls-modal__btn-cancel" data-clear>クリア</button>' : ''}
          <button class="gl-cls-modal__btn-cancel" data-cancel>閉じる</button>
          <button class="gl-cls-modal__btn-ok" data-save>保存</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('[data-cancel]')?.addEventListener('click', close);
    modal.querySelector('[data-clear]')?.addEventListener('click', () => {
      window.glState.set('lockerNumber', null);
      window.glStorage.writeLocal(STORAGE_KEYS.locker, null);
      window.glToast.info('ロッカー番号をクリアしました');
      close();
      _render();
    });
    modal.querySelector('[data-save]').addEventListener('click', () => {
      const val = document.getElementById('locker-input').value.trim();
      if (!val) { window.glToast.warn('番号を入力してください'); return; }
      window.glState.set('lockerNumber', val);
      window.glStorage.writeLocal(STORAGE_KEYS.locker, val);
      window.glToast.success('ロッカー: ' + val);
      close();
      _render();
    });
    // 自動フォーカス
    setTimeout(() => document.getElementById('locker-input')?.focus(), 100);
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

  // ==== ヘッダー行（ホール番号 + Par行）====

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

    // OUT
    const outStrokes = _sumStrokes(player.userId, 1, 9);
    const outParSum = _parSum(pars, 1, 9);
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

    // IN
    const inStrokes = _sumStrokes(player.userId, 10, 18);
    const inParSum = _parSum(pars, 10, 18);
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

    // TOTAL
    const totalStrokes = _sumStrokes(player.userId, 1, 18);
    const totalParSum = _parSum(pars, 1, 18);
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
    // state.currentHole も同期
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

      ${_renderModeButtons()}

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
        <button class="gl-cls-btn-invite" data-invite>📤 招待</button>
        <button class="gl-cls-btn-line" data-line>💚 LINE共有</button>
        <button class="gl-cls-btn-finish" data-finish>🏁 終了・保存</button>
      </div>
    `;

    _bindEvents();
    _bindInfoBarEvents();
    _scrollToCurrentHole(currentHole);
  }

  function _scrollToCurrentHole(currentHole) {
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

    // モード切替
    view.querySelectorAll('[data-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        currentMode = btn.dataset.mode;
        _render();
      });
    });

    // スコアセルタップ
    view.querySelectorAll('[data-player][data-hole]').forEach((cell) => {
      cell.addEventListener('click', () => {
        if (cell.dataset.editable !== '1') return;
        const playerId = cell.dataset.player;
        const hole = parseInt(cell.dataset.hole, 10);
        _startInputSession(hole, playerId);
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

    // ボタン
    view.querySelector('[data-invite]')?.addEventListener('click', () => {
      window.glEvents.emit('ui:navigate', { view: 'golf' });
    });
    view.querySelector('[data-line]')?.addEventListener('click', _showLineShareModal);
    view.querySelector('[data-finish]')?.addEventListener('click', _finishRound);
  }

  // ==== 入力セッション（自動プレイヤー切替の核心） ====

  /**
   * 入力セッション開始
   * @param {number} hole - タップされたホール
   * @param {string} tappedPlayerId - タップしたプレイヤー(初期表示用)
   */
  function _startInputSession(hole, tappedPlayerId) {
    // 現在ホール判定
    const currentHole = _computeCurrentHole();
    const isEditingPast = hole < currentHole;

    const players = _getPlayers();
    const editablePlayers = players.filter((p) => {
      const t = _getPlayerType(p);
      return t === 'self' || t === 'proxy';
    });

    let queue;
    if (isEditingPast) {
      // 過去修正: タップしたプレイヤーだけの単独セッション
      const p = editablePlayers.find((x) => x.userId === tappedPlayerId);
      if (!p) return;
      queue = [p];
    } else {
      // 現在ホール: タップした人から始めて、未入力の人を順番に
      const idxTapped = editablePlayers.findIndex((p) => p.userId === tappedPlayerId);
      const startIdx = idxTapped >= 0 ? idxTapped : 0;

      // タップした人から順に全員（既入力済みでも含める、確認・修正できるように）
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

  function _showInputPanel() {
    _closeInputPanel(); // 既存を除去

    const overlay = document.createElement('div');
    overlay.id = 'gl-cls-panel-overlay';
    overlay.className = 'gl-cls-panel-overlay';
    document.body.appendChild(overlay);

    const panel = document.createElement('div');
    panel.id = 'gl-cls-input-panel';
    panel.className = 'gl-cls-input-panel';
    document.body.appendChild(panel);

    _renderInputPanel();

    requestAnimationFrame(() => {
      overlay.classList.add('show');
      panel.classList.add('show');
    });

    overlay.addEventListener('click', _cancelInputPanel);
  }

  function _renderInputPanel() {
    const panel = document.getElementById('gl-cls-input-panel');
    if (!panel || !inputSession) return;

    const p = _loCurrentPlayer();
    if (!p) return;

    const isSelf = _getPlayerType(p) === 'self';
    const total = inputSession.queue.length;
    const idx = inputSession.currentIdx + 1;
    const displayName = window.glProfile.getDisplayName(p);
    const typeLabel = isSelf ? '自分' : '代理';
    const badgeColor = isSelf ? '#1a5f3f' : '#ff9800';

    // ストロークキー
    const strokeKeys = [];
    for (let i = 1; i <= 10; i++) {
      const sel = inputSession.selectedStrokes === i ? ' selected' : '';
      strokeKeys.push(`<button class="gl-cls-panel-key${sel}" data-stroke="${i}">${i}</button>`);
    }

    // パットキー（自分のみ）
    let puttSection = '';
    if (isSelf) {
      const puttKeys = [];
      for (let i = 0; i <= 5; i++) {
        const sel = inputSession.selectedPutts === i ? ' selected' : '';
        puttKeys.push(`<button class="gl-cls-panel-key gl-cls-panel-key--putt${sel}" data-putt="${i}">${i}</button>`);
      }
      puttSection = `
        <div class="gl-cls-panel-section-label">パット数（任意）</div>
        <div class="gl-cls-panel-keys" style="grid-template-columns: repeat(6, 1fr);">
          ${puttKeys.join('')}
        </div>
      `;
    }

    const saveLabel = inputSession.isEditingPast
      ? '✓ 保存'
      : (inputSession.currentIdx < total - 1 ? '✓ 保存 → 次の人' : '✓ 保存 → 次ホール');

    panel.innerHTML = `
      <div class="gl-cls-panel-header">
        <div class="gl-cls-panel-hole">HOLE ${inputSession.hole}${inputSession.isEditingPast ? ' <span style="font-size:12px;color:#ff9800;">修正</span>' : ''}</div>
        ${!inputSession.isEditingPast ? `<div class="gl-cls-panel-progress">${idx} / ${total} 人目</div>` : ''}
      </div>
      <div class="gl-cls-panel-player">
        <span style="display:inline-block;padding:2px 8px;background:${badgeColor};color:#fff;border-radius:4px;font-size:11px;">${typeLabel}</span>
        ${displayName}
      </div>
      <div class="gl-cls-panel-section-label">ストローク数</div>
      <div class="gl-cls-panel-keys">${strokeKeys.join('')}</div>
      ${puttSection}
      <div class="gl-cls-panel-actions">
        <button class="gl-cls-panel-btn-cancel" data-panel-cancel>キャンセル</button>
        <button class="gl-cls-panel-btn-save" data-panel-save ${inputSession.selectedStrokes === null ? 'disabled' : ''}>${saveLabel}</button>
      </div>
    `;

    _bindPanelEvents();
  }

  function _bindPanelEvents() {
    const panel = document.getElementById('gl-cls-input-panel');
    if (!panel) return;

    panel.querySelectorAll('[data-stroke]').forEach((btn) => {
      btn.addEventListener('click', () => {
        inputSession.selectedStrokes = parseInt(btn.dataset.stroke, 10);
        _renderInputPanel();
      });
    });

    panel.querySelectorAll('[data-putt]').forEach((btn) => {
      btn.addEventListener('click', () => {
        inputSession.selectedPutts = parseInt(btn.dataset.putt, 10);
        _renderInputPanel();
      });
    });

    panel.querySelector('[data-panel-cancel]')?.addEventListener('click', _cancelInputPanel);
    panel.querySelector('[data-panel-save]')?.addEventListener('click', _saveAndProceed);
  }

  function _saveAndProceed() {
    if (!inputSession) return;
    const p = _loCurrentPlayer();
    if (!p || inputSession.selectedStrokes === null) return;

    // 保存
    window.glScore.save(p.userId, inputSession.hole, inputSession.selectedStrokes);
    if (_getPlayerType(p) === 'self' && inputSession.selectedPutts !== null) {
      // パット数を state に反映（scoresマップに直接）
      const scores = window.glState.get('scores') || {};
      if (!scores[p.userId]) scores[p.userId] = {};
      scores[p.userId]['putt' + inputSession.hole] = inputSession.selectedPutts;
      window.glState.set('scores', { ...scores });
    }

    // 過去修正 or 最後の人 → セッション終了
    if (inputSession.isEditingPast || inputSession.currentIdx >= inputSession.queue.length - 1) {
      _closeInputPanel();
      return;
    }

    // 次の人へ
    inputSession.currentIdx++;
    _loadCurrentPlayerToPanel();
    _renderInputPanel();
  }

  function _cancelInputPanel() {
    _closeInputPanel();
  }

  function _closeInputPanel() {
    const panel = document.getElementById('gl-cls-input-panel');
    const overlay = document.getElementById('gl-cls-panel-overlay');
    if (panel) {
      panel.classList.remove('show');
      setTimeout(() => panel.remove(), 250);
    }
    if (overlay) {
      overlay.classList.remove('show');
      setTimeout(() => overlay.remove(), 250);
    }
    inputSession = null;
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
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
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
      if (!name) { window.glToast.warn('名前は必須です'); return; }
      if (window.glRound.updateProxyPlayer) {
        window.glRound.updateProxyPlayer(player.userId, { familyName: name, familyKana: kana });
      }
      window.glToast.success('保存しました');
      close();
    });
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  }

  // ==== LINE 共有 ====

  function _showLineShareModal() {
    let selectedType = 'detailed';
    const modal = document.createElement('div');
    modal.className = 'gl-cls-modal';
    modal.innerHTML = `
      <div class="gl-cls-modal__body">
        <h2 class="gl-cls-modal__title">💚 LINE で途中経過を共有</h2>
        <p style="font-size:13px;color:#666;margin-bottom:12px;">どちらの形式で共有しますか？</p>

        <label class="gl-cls-line-option" data-line-type="simple">
          <input type="radio" name="lineType" value="simple">
          <div class="gl-cls-line-option-body">
            <div class="gl-cls-line-option-title">シンプル</div>
            <div class="gl-cls-line-option-desc">スコアだけ簡潔に</div>
          </div>
        </label>

        <label class="gl-cls-line-option active" data-line-type="detailed">
          <input type="radio" name="lineType" value="detailed" checked>
          <div class="gl-cls-line-option-body">
            <div class="gl-cls-line-option-title">詳細</div>
            <div class="gl-cls-line-option-desc">ハイライト・パット付き</div>
          </div>
        </label>

        <div class="gl-cls-modal__actions">
          <button class="gl-cls-modal__btn-cancel" data-cancel>キャンセル</button>
          <button class="gl-cls-modal__btn-ok" data-send style="background:#06c755;">💚 LINEを開く</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    const close = () => modal.remove();

    modal.querySelectorAll('input[name="lineType"]').forEach((radio) => {
      radio.addEventListener('change', () => {
        selectedType = radio.value;
        modal.querySelectorAll('.gl-cls-line-option').forEach((el) => {
          el.classList.toggle('active', el.dataset.lineType === selectedType);
        });
      });
    });
    modal.querySelector('[data-cancel]').addEventListener('click', close);
    modal.querySelector('[data-send]').addEventListener('click', () => {
      const msg = _buildLineMessage(selectedType);
      const url = 'https://line.me/R/msg/text/?' + encodeURIComponent(msg);
      window.open(url, '_blank');
      close();
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

    // 詳細版
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
      lockerNumber: window.glState.get('lockerNumber') || null,
    });

    if (!window.glProfile.isFull()) {
      window.glToast.info('プロフィールを完成させると詳細分析が使えます');
    }

    // クリア
    window.glState.set('afternoonStart', null);
    window.glStorage.writeLocal(STORAGE_KEYS.afternoon, null);

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

      unsubScores = window.glState.subscribe('scores', () => _render());
      unsubPlayers = window.glState.subscribe('players', () => _render());
      unsubProxies = window.glState.subscribe('proxyPlayers', () => _render());

      orientationMedia = window.matchMedia('(orientation: landscape)');
      this._orientationHandler = () => _render();
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
