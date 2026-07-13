/**
 * G-LAND GAS v2.7.0 - Entry Point
 * ===============================
 * doPost/doGet ハンドラと初回セットアップ関数。
 * 初回運用時は GAS エディタから initSetup() を1回実行するだけで
 * 必要な全シート・全列が自動生成される。
 */

const VERSION = 'v2.8.0';

/**
 * 初回セットアップ（冪等）
 * - 未作成のシートを作成
 * - 既存シートで不足している列のみ末尾に追加
 * - 既存データは絶対に破壊しない
 */
function initSetup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const report = { created: [], updated: [], ok: [], errors: [] };

  Object.keys(SCHEMA).forEach((sheetName) => {
    try {
      const expectedCols = SCHEMA[sheetName];
      let sheet = ss.getSheetByName(sheetName);

      if (!sheet) {
        sheet = ss.insertSheet(sheetName);
        sheet.getRange(1, 1, 1, expectedCols.length).setValues([expectedCols]);
        sheet.getRange(1, 1, 1, expectedCols.length)
          .setFontWeight('bold').setBackground('#e0e0e0');
        sheet.setFrozenRows(1);
        sheet.autoResizeColumns(1, expectedCols.length);
        report.created.push(sheetName);
        return;
      }

      // 既存シート: 不足列のみ追加
      const lastCol = sheet.getLastColumn();
      const existingHeaders = lastCol > 0
        ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String)
        : [];

      const missing = expectedCols.filter((c) => !existingHeaders.includes(c));
      if (missing.length > 0) {
        const startCol = lastCol + 1;
        sheet.getRange(1, startCol, 1, missing.length).setValues([missing]);
        sheet.getRange(1, 1, 1, startCol + missing.length - 1)
          .setFontWeight('bold').setBackground('#e0e0e0');
        sheet.setFrozenRows(1);
        report.updated.push({ sheet: sheetName, added: missing });
      } else {
        report.ok.push(sheetName);
      }
    } catch (err) {
      report.errors.push({ sheet: sheetName, error: err.message });
    }
  });

  Logger.log('=== G-LAND initSetup Report ===');
  Logger.log(JSON.stringify(report, null, 2));
  return report;
}

/**
 * POST エントリ
 */
function doPost(e) {
  return _safe(function () {
    let params = {};
    try {
      params = JSON.parse(e.postData.contents);
    } catch (err) {
      return _ng('INVALID_JSON');
    }

    const action = params.action;
    if (!action) return _ng('action required');

    // アクションディスパッチ
    const handler = _API_HANDLERS[action];
    if (!handler) return _ng('unknown action: ' + action);

    return handler(params);
  });
}

/**
 * GET エントリ（ping専用）
 */
function doGet(e) {
  return _json({ ok: true, version: VERSION, ts: new Date().toISOString() });
}

/**
 * 統一レスポンスラッパー
 */
function _safe(fn) {
  try {
    const result = fn();
    if (result && typeof result === 'object' && 'ok' in result) {
      return _json(result);
    }
    return _json({ ok: true, data: result });
  } catch (err) {
    Logger.log('ERROR: ' + err.stack);
    return _json({ ok: false, error: err.message || 'INTERNAL_ERROR' });
  }
}

function _ok(data) {
  return { ok: true, data: data };
}

function _ng(msg) {
  return { ok: false, error: msg };
}

function _json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * LockService でクリティカルセクション保護（合流競合など）
 * 最大待機3秒、リトライ2回
 */
function _withWriteLock(fn) {
  const lock = LockService.getScriptLock();
  const MAX_RETRY = 2;
  const WAIT_MS = 3000;

  for (let i = 0; i <= MAX_RETRY; i++) {
    try {
      lock.waitLock(WAIT_MS);
      try {
        return fn();
      } finally {
        try { lock.releaseLock(); } catch (e) { /* ignore */ }
      }
    } catch (err) {
      if (i === MAX_RETRY) {
        throw new Error('LOCK_FAILED');
      }
      Utilities.sleep(200);
    }
  }
}
