/**
 * G-LAND GAS v2.7.0 - Schema Definition & Helper
 * ==============================================
 * 全シート・全列名の唯一の情報源。
 * 全DB操作は _colIdx() を経由し、マジック文字列を排除する。
 */

const SCHEMA = {
  Users: [
    'userId', 'familyName', 'familyKana', 'firstName', 'firstKana',
    'courseAdjust', 'createdAt', 'updatedAt'
  ],
  Rounds: [
    'roundId', 'ownerUserId', 'courseId', 'courseName',
    'status', 'startedAt', 'endedAt',
    'hole1Par', 'hole2Par', 'hole3Par', 'hole4Par',
    'notes', 'groupCode'
  ],
  RoundMembers: [
    'roundId', 'userId', 'displayName', 'joinedAt', 'leftAt', 'role'
  ],
  PlayerScores: [
    'roundId', 'userId', 'hole', 'strokes', 'updatedAt'
  ],
  Courses: [
    'courseId', 'name', 'nameKana', 'prefecture', 'city',
    'holesJson', 'createdAt', 'active'
  ],
  MyCourses: [
    'userId', 'courseId', 'addedAt', 'favoriteOrder'
  ],
  CourseRequests: [
    'requestId', 'userId', 'name', 'prefecture', 'note',
    'status', 'createdAt', 'processedAt'
  ],
  History: [
    'historyId', 'userId', 'roundId',
    'courseId', 'courseName',
    'startedAt', 'endedAt',
    'totalStrokes', 'totalPar', 'totalDiff',
    'outStrokes', 'inStrokes', 'totalPutts',
    'holesJson', 'companionsJson',
    'lockerNumber', 'theme', 'notes',
    'createdAt'
  ],
  Ads: [
    'adId', 'slot', 'category', 'imageUrl', 'linkUrl',
    'region', 'bidAmount', 'startAt', 'endAt', 'priority', 'active'
  ],
  AdImpressions: [
    'impressionId', 'adId', 'userId', 'context', 'ts'
  ],
  AdClicks: [
    'clickId', 'adId', 'userId', 'context', 'ts'
  ],
};

/**
 * 列名から1-basedインデックスを解決（タイポ即エラー化）
 */
function _colIdx(sheet, colName) {
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) {
    throw new Error(`Sheet "${sheet.getName()}" is empty. Run initSetup() first.`);
  }
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const idx = headers.indexOf(colName);
  if (idx === -1) {
    throw new Error(`Column "${colName}" not found in "${sheet.getName()}". Run initSetup() first.`);
  }
  return idx + 1;
}

/**
 * シート取得（存在保証）
 */
function _sheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(name);
  if (!sh) {
    throw new Error(`Sheet "${name}" not found. Run initSetup() first.`);
  }
  return sh;
}

/**
 * 行を連想配列に変換
 */
function _rowToObject(sheet, row) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const obj = {};
  headers.forEach((h, i) => {
    if (h) obj[h] = row[i];
  });
  return obj;
}

/**
 * 全行を連想配列配列で取得
 */
function _allRowsAsObjects(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const lastCol = sheet.getLastColumn();
  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  return values.map((row) => {
    const obj = {};
    headers.forEach((h, i) => {
      if (h) obj[h] = row[i];
    });
    return obj;
  });
}
