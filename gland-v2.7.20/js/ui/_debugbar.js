/**
 * G-LAND v2.7.12 - Debug Bar
 * ==========================
 * 実機のブラウザで console.log が見られない時に、画面上に直接ログを表示する診断バー。
 *
 * 使い方:
 *   window.glDebug.log('メッセージ');
 *   window.glDebug.err('エラー');
 *
 * URL に ?debug=1 を付けるか、localStorage に gl_debug=1 を入れると自動表示される。
 * トグルボタンをタップすると開閉可能。
 */
(function () {
  'use strict';

  const ENABLED = (function () {
    try {
      const params = new URLSearchParams(location.search);
      if (params.get('debug') === '1') {
        localStorage.setItem('gl_debug', '1');
        return true;
      }
      if (params.get('debug') === '0') {
        localStorage.removeItem('gl_debug');
        return false;
      }
      return localStorage.getItem('gl_debug') === '1';
    } catch (e) { return false; }
  })();

  if (!ENABLED) {
    // 無効化時もダミーAPIだけ提供
    window.glDebug = {
      log: function () {}, err: function () {}, warn: function () {},
      clear: function () {}, toggle: function () {},
    };
    return;
  }

  const MAX_LINES = 40;
  const lines = [];
  let barEl = null;
  let logEl = null;
  let collapsed = false;

  function _ensureBar() {
    if (barEl) return;

    barEl = document.createElement('div');
    barEl.id = 'gl-debug-bar';
    barEl.style.cssText = [
      'position:fixed', 'left:0', 'right:0', 'bottom:0',
      'z-index:999999',
      'background:rgba(0,0,0,0.88)', 'color:#0f0',
      'font-family:monospace', 'font-size:11px', 'line-height:1.4',
      'max-height:40vh', 'overflow-y:auto',
      'padding:4px 8px', 'box-sizing:border-box',
      'border-top:2px solid #0f0',
    ].join(';');

    const header = document.createElement('div');
    header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:2px 0;border-bottom:1px dashed #0f0;margin-bottom:4px;';
    header.innerHTML = '<b style="color:#fff;">🔍 DEBUG</b>';

    const btnClear = document.createElement('button');
    btnClear.textContent = 'CLR';
    btnClear.style.cssText = 'background:#333;color:#fff;border:1px solid #0f0;padding:2px 6px;font-size:10px;margin-left:4px;';
    btnClear.addEventListener('click', function (e) { e.stopPropagation(); glDebug.clear(); });

    const btnHide = document.createElement('button');
    btnHide.textContent = 'HIDE';
    btnHide.style.cssText = 'background:#333;color:#fff;border:1px solid #0f0;padding:2px 6px;font-size:10px;margin-left:4px;';
    btnHide.addEventListener('click', function (e) { e.stopPropagation(); glDebug.disable(); });

    const btnToggle = document.createElement('button');
    btnToggle.textContent = '−';
    btnToggle.style.cssText = 'background:#333;color:#fff;border:1px solid #0f0;padding:2px 8px;font-size:10px;margin-left:4px;';
    btnToggle.addEventListener('click', function (e) { e.stopPropagation(); glDebug.toggle(); });

    const btnBox = document.createElement('div');
    btnBox.appendChild(btnClear);
    btnBox.appendChild(btnHide);
    btnBox.appendChild(btnToggle);
    header.appendChild(btnBox);

    logEl = document.createElement('div');
    logEl.id = 'gl-debug-log';

    barEl.appendChild(header);
    barEl.appendChild(logEl);
    document.body.appendChild(barEl);
  }

  function _push(msg, color) {
    if (!logEl) _ensureBar();
    const t = new Date();
    const hh = String(t.getHours()).padStart(2, '0');
    const mm = String(t.getMinutes()).padStart(2, '0');
    const ss = String(t.getSeconds()).padStart(2, '0');
    const timestamp = hh + ':' + mm + ':' + ss;

    lines.push({ time: timestamp, msg: String(msg), color: color || '#0f0' });
    if (lines.length > MAX_LINES) lines.shift();

    _rerender();
  }

  function _rerender() {
    if (!logEl) return;
    logEl.innerHTML = lines.map(function (line) {
      return '<div style="color:' + line.color + ';word-break:break-all;">[' + line.time + '] ' + _escape(line.msg) + '</div>';
    }).join('');
    // スクロールを最下部に
    barEl.scrollTop = barEl.scrollHeight;
  }

  function _escape(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  const glDebug = {
    log: function (msg) { _push(msg, '#0f0'); },
    warn: function (msg) { _push(msg, '#ff0'); },
    err: function (msg) { _push(msg, '#f66'); },
    clear: function () { lines.length = 0; _rerender(); },
    toggle: function () {
      collapsed = !collapsed;
      if (collapsed) {
        barEl.style.maxHeight = '28px';
        logEl.style.display = 'none';
      } else {
        barEl.style.maxHeight = '40vh';
        logEl.style.display = 'block';
      }
    },
    disable: function () {
      try { localStorage.removeItem('gl_debug'); } catch (e) {}
      if (barEl) barEl.remove();
      barEl = null;
      logEl = null;
    },
  };

  window.glDebug = glDebug;

  // 起動時に自動作成
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _ensureBar);
  } else {
    _ensureBar();
  }

  glDebug.log('debug bar started');
})();
