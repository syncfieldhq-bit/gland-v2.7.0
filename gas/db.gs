/**
 * G-LAND GAS v2.8.0 - Database Layer
 * ==================================
 * スプレッドシートへの全I/Oを集約。
 * 列参照は必ず _colIdx() 経由（タイポ即エラー化）。
 *
 * v2.8.0 Users スキーマ拡張:
 *   userId | firebaseUid | email | familyName | familyKana | firstName | firstKana | nickname | createdAt | updatedAt
 *   → courseAdjust は廃止（既存シートにあってもエラーにならない）
 *   → firebaseUid, email, nickname カラムを新規追加（自動で初回アクセス時に伸張）
 */

// ==== ID生成ヘルパー ====

function _genId(prefix) {
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).substring(2, 8);
  return prefix + '-' + ts + '-' + rnd;
}

/**
 * A123形式のgroupCode生成（英1字+数3字）
 */
function _genGroupCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // I,O除外
  const letter = letters.charAt(Math.floor(Math.random() * letters.length));
  const num = Math.floor(100 + Math.random() * 900);
  return letter + num;
}

// ==== Users ====

/**
 * Users シートのスキーマを自動拡張（v2.8.0 新カラムを必要なら追加）
 * 既存シートへの後方互換性を保つ
 */
function _ensureUsersSchema() {
  const sheet = _sheet('Users');
  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const needed = ['firebaseUid', 'email', 'nickname'];
  const toAdd = needed.filter(function (h) { return headers.indexOf(h) === -1; });
  if (toAdd.length === 0) return headers;
  for (var i = 0; i < toAdd.length; i++) {
    sheet.getRange(1, lastCol + 1 + i).setValue(toAdd[i]);
  }
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}

function dbCreateUser(params) {
  var familyName = params.familyName;
  var familyKana = params.familyKana;
  var firstName = params.firstName;
  var firstKana = params.firstKana;
  var nickname = params.nickname;
  var firebaseUid = params.firebaseUid;
  var email = params.email;

  var sheet = _sheet('Users');
  var headers = _ensureUsersSchema();
  var userId = _genId('U');
  var now = new Date().toISOString();

  var row = headers.map(function (h) {
    switch (h) {
      case 'userId': return userId;
      case 'firebaseUid': return firebaseUid || '';
      case 'email': return email || '';
      case 'familyName': return familyName || '';
      case 'familyKana': return familyKana || '';
      case 'firstName': return firstName || '';
      case 'firstKana': return firstKana || '';
      case 'nickname': return nickname || '';
      case 'courseAdjust': return ''; // 廃止（既存シート互換）
      case 'createdAt': return now;
      case 'updatedAt': return now;
      default: return '';
    }
  });
  sheet.appendRow(row);
  return userId;
}

/**
 * v2.8.0: Firebase UID で先に検索（主キー）、なければフォールバック
 */
function dbFindUserByFirebaseUid(firebaseUid) {
  if (!firebaseUid) return null;
  _ensureUsersSchema();
  var sheet = _sheet('Users');
  var rows = _allRowsAsObjects(sheet);
  return rows.find(function (r) { return r.firebaseUid === firebaseUid; }) || null;
}

function dbFindUserByProfile(familyName, familyKana) {
  var sheet = _sheet('Users');
  var rows = _allRowsAsObjects(sheet);
  return rows.find(function (r) { return r.familyName === familyName && r.familyKana === familyKana; }) || null;
}

function dbGetUser(userId) {
  var sheet = _sheet('Users');
  var rows = _allRowsAsObjects(sheet);
  return rows.find(function (r) { return r.userId === userId; }) || null;
}

function dbUpdateUser(userId, patch) {
  _ensureUsersSchema();
  var sheet = _sheet('Users');
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;

  var userIdCol = _colIdx(sheet, 'userId');
  var updatedAtCol = _colIdx(sheet, 'updatedAt');
  var ids = sheet.getRange(2, userIdCol, lastRow - 1, 1).getValues().map(function (r) { return r[0]; });
  var idx = ids.indexOf(userId);
  if (idx === -1) return false;

  var row = idx + 2;
  var updatableFields = ['firebaseUid', 'email', 'familyName', 'familyKana', 'firstName', 'firstKana', 'nickname'];
  updatableFields.forEach(function (field) {
    if (patch[field] !== undefined) {
      try {
        var colIdx = _colIdx(sheet, field);
        sheet.getRange(row, colIdx).setValue(patch[field]);
      } catch (e) {
        // カラム未存在ならスキップ
      }
    }
  });
  sheet.getRange(row, updatedAtCol).setValue(new Date().toISOString());
  return true;
}

// ==== Rounds ====

function dbCreateRoundForOwner(ownerUserId, hostName) {
  const sheet = _sheet('Rounds');
  const roundId = _genId('R');
  const groupCode = _genGroupCode();
  const now = new Date().toISOString();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  const row = headers.map((h) => {
    switch (h) {
      case 'roundId': return roundId;
      case 'ownerUserId': return ownerUserId;
      case 'status': return 'active';
      case 'startedAt': return now;
      case 'groupCode': return groupCode;
      default: return '';
    }
  });
  sheet.appendRow(row);

  // オーナーをメンバーとして登録
  dbUpsertRoundMember(roundId, ownerUserId, hostName, 'host');

  return { roundId: roundId, groupCode: groupCode, ownerUserId: ownerUserId };
}

function dbGetRound(roundId) {
  const sheet = _sheet('Rounds');
  const rows = _allRowsAsObjects(sheet);
  return rows.find((r) => r.roundId === roundId) || null;
}

function dbGetRoundByGroupCode(groupCode) {
  const sheet = _sheet('Rounds');
  const rows = _allRowsAsObjects(sheet);
  return rows.find((r) => r.groupCode === groupCode && r.status !== 'finished') || null;
}

function dbPatchRound(roundId, patch) {
  const sheet = _sheet('Rounds');
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;

  const roundIdCol = _colIdx(sheet, 'roundId');
  const ids = sheet.getRange(2, roundIdCol, lastRow - 1, 1).getValues().map((r) => r[0]);
  const idx = ids.indexOf(roundId);
  if (idx === -1) return false;

  const row = idx + 2;
  Object.keys(patch).forEach((field) => {
    try {
      sheet.getRange(row, _colIdx(sheet, field)).setValue(patch[field]);
    } catch (e) {
      /* skip unknown fields */
    }
  });
  return true;
}

// ==== RoundMembers ====

function dbUpsertRoundMember(roundId, userId, displayName, role) {
  const sheet = _sheet('RoundMembers');
  const rows = _allRowsAsObjects(sheet);
  const now = new Date().toISOString();

  const existing = rows.findIndex((r) => r.roundId === roundId && r.userId === userId);
  if (existing >= 0) {
    // leftAtクリア + displayName更新
    const rowNum = existing + 2;
    sheet.getRange(rowNum, _colIdx(sheet, 'displayName')).setValue(displayName);
    sheet.getRange(rowNum, _colIdx(sheet, 'leftAt')).setValue('');
    return;
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = headers.map((h) => {
    switch (h) {
      case 'roundId': return roundId;
      case 'userId': return userId;
      case 'displayName': return displayName || '';
      case 'joinedAt': return now;
      case 'role': return role || 'guest';
      default: return '';
    }
  });
  sheet.appendRow(row);
}

function dbListRoundMembers(roundId) {
  const sheet = _sheet('RoundMembers');
  const rows = _allRowsAsObjects(sheet);
  return rows.filter((r) => r.roundId === roundId);
}

function dbLeaveRound(roundId, userId) {
  const sheet = _sheet('RoundMembers');
  const rows = _allRowsAsObjects(sheet);
  const idx = rows.findIndex((r) => r.roundId === roundId && r.userId === userId);
  if (idx === -1) return;
  const rowNum = idx + 2;
  sheet.getRange(rowNum, _colIdx(sheet, 'leftAt')).setValue(new Date().toISOString());
}

// ==== PlayerScores ====

function dbUpsertScore(roundId, userId, hole, strokes) {
  const sheet = _sheet('PlayerScores');
  const rows = _allRowsAsObjects(sheet);
  const now = new Date().toISOString();

  const idx = rows.findIndex(
    (r) => r.roundId === roundId && r.userId === userId && String(r.hole) === String(hole)
  );

  if (idx >= 0) {
    const rowNum = idx + 2;
    sheet.getRange(rowNum, _colIdx(sheet, 'strokes')).setValue(strokes);
    sheet.getRange(rowNum, _colIdx(sheet, 'updatedAt')).setValue(now);
    return;
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = headers.map((h) => {
    switch (h) {
      case 'roundId': return roundId;
      case 'userId': return userId;
      case 'hole': return hole;
      case 'strokes': return strokes;
      case 'updatedAt': return now;
      default: return '';
    }
  });
  sheet.appendRow(row);
}

function dbListScores(roundId) {
  const sheet = _sheet('PlayerScores');
  const rows = _allRowsAsObjects(sheet);
  const filtered = rows.filter((r) => r.roundId === roundId);

  // { userId: { hole1: strokes, ... } } 形式に変換
  const result = {};
  filtered.forEach((r) => {
    if (!result[r.userId]) result[r.userId] = {};
    result[r.userId]['hole' + r.hole] = parseInt(r.strokes, 10);
  });
  return result;
}

// ==== History ====

/**
 * v2.7.17: History シートに個人スナップショットを保存（Y案）
 * @param {Object} params - historyId 未指定なら自動採番
 * @returns {string} historyId
 */
function dbSaveHistory(params) {
  const sheet = _sheet('History');
  const historyId = String(params.historyId || '').trim() || _genId('H');
  const now = new Date().toISOString();

  // 冪等性: 同一 roundId + userId は上書き
  const rows = _allRowsAsObjects(sheet);
  const existingIdx = rows.findIndex(
    (r) => r.roundId === params.roundId && r.userId === params.userId
  );

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = headers.map((h) => {
    switch (h) {
      case 'historyId': return existingIdx >= 0 ? rows[existingIdx].historyId : historyId;
      case 'userId': return params.userId || '';
      case 'roundId': return params.roundId || '';
      case 'courseId': return params.courseId || '';
      case 'courseName': return params.courseName || '';
      case 'startedAt': return params.startedAt || '';
      case 'endedAt': return params.endedAt || now;
      case 'totalStrokes': return params.totalStrokes != null ? params.totalStrokes : '';
      case 'totalPar': return params.totalPar != null ? params.totalPar : '';
      case 'totalDiff': return params.totalDiff != null ? params.totalDiff : '';
      case 'outStrokes': return params.outStrokes != null ? params.outStrokes : '';
      case 'inStrokes': return params.inStrokes != null ? params.inStrokes : '';
      case 'totalPutts': return params.totalPutts != null ? params.totalPutts : '';
      case 'holesJson': return params.holesJson || '';
      case 'companionsJson': return params.companionsJson || '';
      case 'lockerNumber': return params.lockerNumber || '';
      case 'theme': return params.theme || 'classic';
      case 'notes': return params.notes || '';
      case 'createdAt': return existingIdx >= 0 ? rows[existingIdx].createdAt : now;
      default: return '';
    }
  });

  if (existingIdx >= 0) {
    // 上書き (existingIdx は 0-based / シートは 2 行目からデータ)
    sheet.getRange(existingIdx + 2, 1, 1, row.length).setValues([row]);
    return rows[existingIdx].historyId;
  } else {
    sheet.appendRow(row);
    return historyId;
  }
}

function dbListHistoryForUser(userId) {
  const sheet = _sheet('History');
  const rows = _allRowsAsObjects(sheet);
  return rows
    .filter((r) => r.userId === userId)
    .sort((a, b) => String(b.endedAt).localeCompare(String(a.endedAt)));
}

// ==== Courses ====

function dbSearchCourses(prefecture, kana) {
  const sheet = _sheet('Courses');
  const rows = _allRowsAsObjects(sheet);
  return rows.filter((r) => {
    if (r.active === false) return false;
    if (prefecture && r.prefecture !== prefecture) return false;
    if (kana && String(r.nameKana || '').indexOf(kana) === -1) return false;
    return true;
  });
}

function dbListMyCourses(userId) {
  const myCourseSheet = _sheet('MyCourses');
  const myRows = _allRowsAsObjects(myCourseSheet).filter((r) => r.userId === userId);

  const courseSheet = _sheet('Courses');
  const allCourses = _allRowsAsObjects(courseSheet);
  const courseMap = {};
  allCourses.forEach((c) => { courseMap[c.courseId] = c; });

  return myRows.map((mc) => courseMap[mc.courseId]).filter(Boolean);
}

function dbAddMyCourse(userId, courseId) {
  const sheet = _sheet('MyCourses');
  const rows = _allRowsAsObjects(sheet);
  const exists = rows.find((r) => r.userId === userId && r.courseId === courseId);
  if (exists) return;

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const now = new Date().toISOString();
  const row = headers.map((h) => {
    switch (h) {
      case 'userId': return userId;
      case 'courseId': return courseId;
      case 'addedAt': return now;
      case 'favoriteOrder': return rows.filter((r) => r.userId === userId).length + 1;
      default: return '';
    }
  });
  sheet.appendRow(row);
}

// ==== CourseRequests ====

function dbCreateCourseRequest(userId, name, prefecture, note) {
  const sheet = _sheet('CourseRequests');
  const requestId = _genId('CR');
  const now = new Date().toISOString();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = headers.map((h) => {
    switch (h) {
      case 'requestId': return requestId;
      case 'userId': return userId;
      case 'name': return name;
      case 'prefecture': return prefecture;
      case 'note': return note;
      case 'status': return 'pending';
      case 'createdAt': return now;
      default: return '';
    }
  });
  sheet.appendRow(row);
  return requestId;
}

// ==== Ads ====

function dbListActiveAds(slot, region) {
  const sheet = _sheet('Ads');
  const rows = _allRowsAsObjects(sheet);
  const now = new Date();

  return rows
    .filter((a) => {
      if (a.active === false) return false;
      if (a.slot && a.slot !== slot && a.slot !== 'all') return false;
      if (region && a.region && a.region !== region && a.region !== 'all') return false;
      if (a.startAt && new Date(a.startAt) > now) return false;
      if (a.endAt && new Date(a.endAt) < now) return false;
      return true;
    })
    .sort((a, b) => {
      const bidDiff = (parseFloat(b.bidAmount) || 0) - (parseFloat(a.bidAmount) || 0);
      if (bidDiff !== 0) return bidDiff;
      return (parseFloat(b.priority) || 0) - (parseFloat(a.priority) || 0);
    });
}
