/**
 * G-LAND GAS v2.7.0 - API Handlers
 * ================================
 * doPost からディスパッチされる全アクション実装。
 * DB操作は必ず db.gs 経由（列名は _colIdx() で解決）。
 */

const _API_HANDLERS = {
  ping: _apiPing,
  registerUser: _apiRegisterUser,
  updateUser: _apiUpdateUser,
  startRound: _apiStartRound,
  joinRound: _apiJoinRound,
  getRound: _apiGetRound,
  listRoundMembers: _apiListRoundMembers,
  leaveRound: _apiLeaveRound,
  saveScore: _apiSaveScore,
  listScores: _apiListScores,
  syncHistory: _apiSyncHistory,
  saveHistory: _apiSaveHistory,
  searchCourses: _apiSearchCourses,
  listMyCourses: _apiListMyCourses,
  addMyCourse: _apiAddMyCourse,
  requestCourseAdd: _apiRequestCourseAdd,
  listAds: _apiListAds,
};

function _apiPing() {
  return _ok({ pong: true, version: VERSION, ts: new Date().toISOString() });
}

// ==== Users ====

function _apiRegisterUser(p) {
  const familyName = String(p.familyName || '').trim();
  const familyKana = String(p.familyKana || '').trim();
  if (!familyName || !familyKana) return _ng('familyName and familyKana required');

  return _withWriteLock(function () {
    // 既存ユーザーの検索
    const existing = dbFindUserByProfile(familyName, familyKana);
    if (existing) return _ok({ userId: existing.userId, reused: true });

    const userId = dbCreateUser({ familyName, familyKana });
    return _ok({ userId });
  });
}

function _apiUpdateUser(p) {
  const userId = String(p.userId || '').trim();
  if (!userId) return _ng('userId required');
  dbUpdateUser(userId, p);
  return _ok({ userId, updated: true });
}

// ==== Round ====

function _apiStartRound(p) {
  const userId = String(p.userId || '').trim();
  if (!userId) return _ng('userId required');

  return _withWriteLock(function () {
    const existingRoundId = String(p.existingRoundId || '').trim();
    if (existingRoundId) {
      const r = dbGetRound(existingRoundId);
      if (r && r.status !== 'finished') {
        return _ok({ roundId: r.roundId, groupCode: r.groupCode, reused: true });
      }
    }

    const hostName = String(p.hostName || '').trim() || 'ホスト';
    const result = dbCreateRoundForOwner(userId, hostName);
    return _ok(result);
  });
}

function _apiJoinRound(p) {
  const userId = String(p.userId || '').trim();
  const groupCode = String(p.groupCode || '').trim().toUpperCase();
  const guestName = String(p.guestName || 'ゲスト');
  if (!userId) return _ng('userId required');
  if (!groupCode) return _ng('groupCode required');

  return _withWriteLock(function () {
    const round = dbGetRoundByGroupCode(groupCode);
    if (!round) return _ng('round not found');
    if (round.status === 'finished') return _ng('round finished');

    // 既に合流済みならそのまま返す（冪等）
    const members = dbListRoundMembers(round.roundId);
    const already = members.find((m) => m.userId === userId && !m.leftAt);
    if (already) {
      return _ok({ roundId: round.roundId, groupCode: round.groupCode, alreadyMember: true });
    }

    if (members.filter((m) => !m.leftAt).length >= 4) {
      return _ng('ROUND_FULL');
    }

    dbUpsertRoundMember(round.roundId, userId, guestName, 'guest');
    return _ok({ roundId: round.roundId, groupCode: round.groupCode });
  });
}

function _apiGetRound(p) {
  const roundId = String(p.roundId || '').trim();
  if (!roundId) return _ng('roundId required');
  const r = dbGetRound(roundId);
  if (!r) return _ng('round not found');
  return _ok(r);
}

function _apiListRoundMembers(p) {
  const roundId = String(p.roundId || '').trim();
  if (!roundId) return _ng('roundId required');
  const members = dbListRoundMembers(roundId).filter((m) => !m.leftAt);
  return _ok({ members });
}

function _apiLeaveRound(p) {
  const userId = String(p.userId || '').trim();
  const roundId = String(p.roundId || '').trim();
  if (!userId || !roundId) return _ng('userId and roundId required');

  return _withWriteLock(function () {
    dbLeaveRound(roundId, userId);
    return _ok({ left: true });
  });
}

// ==== Score ====

function _apiSaveScore(p) {
  const userId = String(p.userId || '').trim();
  const roundId = String(p.roundId || '').trim();
  const playerId = String(p.playerId || userId).trim();
  const hole = parseInt(p.hole, 10);
  const strokes = parseInt(p.strokes, 10);

  if (!userId || !roundId || !hole || isNaN(strokes)) return _ng('invalid params');

  return _withWriteLock(function () {
    dbUpsertScore(roundId, playerId, hole, strokes);
    return _ok({ saved: true });
  });
}

function _apiListScores(p) {
  const roundId = String(p.roundId || '').trim();
  if (!roundId) return _ng('roundId required');
  const playerScores = dbListScores(roundId);
  return _ok({ playerScores });
}

// ==== History ====

function _apiSyncHistory(p) {
  const userId = String(p.userId || '').trim();
  if (!userId) return _ng('userId required');
  const rounds = dbListHistoryForUser(userId);
  return _ok({ rounds });
}

/**
 * v2.7.17: ラウンド終了時の自分のスコアを個別保存（Y案）
 */
function _apiSaveHistory(p) {
  const userId = String(p.userId || '').trim();
  const roundId = String(p.roundId || '').trim();
  if (!userId) return _ng('userId required');
  if (!roundId) return _ng('roundId required');

  return _withWriteLock(function () {
    const historyId = dbSaveHistory({
      historyId: p.historyId,
      userId: userId,
      roundId: roundId,
      courseId: p.courseId || '',
      courseName: p.courseName || '',
      startedAt: p.startedAt || '',
      endedAt: p.endedAt || new Date().toISOString(),
      totalStrokes: p.totalStrokes,
      totalPar: p.totalPar,
      totalDiff: p.totalDiff,
      outStrokes: p.outStrokes,
      inStrokes: p.inStrokes,
      totalPutts: p.totalPutts,
      holesJson: p.holesJson || '',
      companionsJson: p.companionsJson || '',
      lockerNumber: p.lockerNumber || '',
      theme: p.theme || 'classic',
      notes: p.notes || '',
    });
    return _ok({ historyId, saved: true });
  });
}

// ==== Course ====

function _apiSearchCourses(p) {
  const prefecture = String(p.prefecture || '').trim();
  const kana = String(p.kana || '').trim();
  const courses = dbSearchCourses(prefecture, kana);
  return _ok({ courses });
}

function _apiListMyCourses(p) {
  const userId = String(p.userId || '').trim();
  if (!userId) return _ng('userId required');
  const courses = dbListMyCourses(userId);
  return _ok({ courses });
}

function _apiAddMyCourse(p) {
  const userId = String(p.userId || '').trim();
  const courseId = String(p.courseId || '').trim();
  if (!userId || !courseId) return _ng('userId and courseId required');

  return _withWriteLock(function () {
    dbAddMyCourse(userId, courseId);
    return _ok({ added: true });
  });
}

function _apiRequestCourseAdd(p) {
  const userId = String(p.userId || '').trim();
  const name = String(p.name || '').trim();
  const prefecture = String(p.prefecture || '').trim();
  const note = String(p.note || '').trim();
  if (!userId || !name) return _ng('userId and name required');

  return _withWriteLock(function () {
    const requestId = dbCreateCourseRequest(userId, name, prefecture, note);
    _notifyAdmin(name, prefecture, note);
    return _ok({ requestId });
  });
}

/**
 * 管理者通知（GASトリガー）
 */
function _notifyAdmin(name, prefecture, note) {
  try {
    const adminEmail = PropertiesService.getScriptProperties().getProperty('ADMIN_EMAIL');
    if (!adminEmail) return;
    const subject = '[G-LAND] コース追加依頼';
    const body =
      'コース追加依頼が届きました。\n\n' +
      '名称: ' + name + '\n' +
      '都道府県: ' + prefecture + '\n' +
      '備考: ' + note + '\n\n' +
      'スプレッドシート → CourseRequests シートを確認してください。';
    MailApp.sendEmail(adminEmail, subject, body);
  } catch (err) {
    Logger.log('notifyAdmin failed: ' + err.message);
  }
}

// ==== Ads ====

function _apiListAds(p) {
  const slot = String(p.slot || 'home').trim();
  const region = String(p.region || '').trim();
  const ads = dbListActiveAds(slot, region);
  return _ok({ ads });
}
