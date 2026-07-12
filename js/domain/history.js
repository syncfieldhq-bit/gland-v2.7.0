/**
 * G-LAND v2.7.17 - History Domain
 * ==============================
 * サーバー(History シート)がマスター、localStorage はキャッシュ。
 *
 * v2.7.17 変更点（Y案採用）:
 *   - finishAndSave(): 各プレイヤーが自端末で自分のスコアを確定→GAS 送信
 *   - 保存前にスコアから TOTAL/OUT/IN/±Par を計算しスナップショット化
 *   - ローカルキャッシュに即反映（オフライン時はキューへ）
 *   - BEST 判定（コース別 / 通算）を提供
 *   - KPI（総ラウンド数・平均スコア・ベストスコア）を提供
 */
(function () {
  'use strict';

  const CACHE_KEY = 'gl_history_v1';
  const LAST_SYNC_KEY = 'gl_history_last_sync_v1';

  function _readCache() {
    const arr = window.glStorage.readLocalJSON(CACHE_KEY);
    return Array.isArray(arr) ? arr : [];
  }

  function _writeCache(arr) {
    window.glStorage.writeLocal(CACHE_KEY, arr);
  }

  function _num(v) {
    const n = parseInt(v, 10);
    return isNaN(n) ? 0 : n;
  }

  /**
   * v2.7.18: ラウンド状態から自分（userId）のスナップショットを構築
   *
   * データ構造の実態（classic.js が保存している形式）:
   *   scores[playerId]['hole1']..['hole18']   = 打数
   *   scores[playerId]['putt1']..['putt18']   = パット数（★ 同じ scores 内！）
   *
   * 修正点:
   *   - パット数は scores[userId]['puttN'] から読み取る
   *   - Par は state.pars → なければ デフォルト全ホール 4（A案）
   */
  const DEFAULT_PAR = 4; // A案: コースDB未整備のため全ホール仮 Par 4

  function _getPar(pars, hole) {
    // state.pars の可能な形式を全部試す
    const v = _num(
      (pars && (pars['hole' + hole] || pars[hole] || pars['h' + hole])) || 0
    );
    return v > 0 ? v : DEFAULT_PAR;
  }

  function _buildSnapshotForSelf(args) {
    const userId = window.glProfile.getUserId();
    const roundId = args.roundId || window.glState.get('roundId') || '';
    const scores = args.scores || window.glState.get('scores') || {};
    const pars = args.pars || window.glState.get('pars') || {};
    const players = args.players || [];

    // 自分のスコアデータ（打数もパット数も同じオブジェクトの中）
    const myData = scores[userId] || {};

    // 入力済みホールのみで計算
    let totalStrokes = 0;
    let totalPar = 0;
    let outStrokes = 0;
    let inStrokes = 0;
    let totalPutts = 0;
    const holes = {};

    for (let h = 1; h <= 18; h++) {
      const s = _num(myData['hole' + h]);
      const pt = _num(myData['putt' + h]);
      const p = _getPar(pars, h);

      if (s > 0) {
        totalStrokes += s;
        totalPar += p;
        if (h <= 9) outStrokes += s;
        else inStrokes += s;
      }
      if (pt > 0) totalPutts += pt;

      // Par は常に保存（表示用）、打数・パットは入力があれば保存
      if (s > 0 || pt > 0) {
        holes['h' + h] = {
          strokes: s || null,
          putts: pt || null,
          par: p,
        };
      } else {
        // 未入力ホールでも Par だけは表示できるように残す
        holes['h' + h] = { strokes: null, putts: null, par: p };
      }
    }

    const totalDiff = totalStrokes - totalPar;

    // v2.7.19: 同伴者のスナップショット（A案改良版 + パターン1）
    //   - 全同伴者を必ず保存（スコアなしでも名前だけは残す）
    //   - スコアあり: totalStrokes / totalDiff あり
    //   - スコアなし: totalStrokes = 0（UI側で「参加のみ」表示）
    const companions = players
      .filter((p) => p.userId !== userId)
      .map((p) => {
        const cd = scores[p.userId] || {};
        let cTotal = 0;
        let cPar = 0;
        for (let h = 1; h <= 18; h++) {
          const cs = _num(cd['hole' + h]);
          if (cs > 0) {
            cTotal += cs;
            cPar += _getPar(pars, h);
          }
        }
        return {
          userId: p.userId,
          displayName: p.displayName || p.familyName || '?',
          type: p.type || 'self',
          totalStrokes: cTotal,
          totalDiff: cTotal > 0 ? cTotal - cPar : 0,
        };
      });

    return {
      userId,
      roundId,
      courseId: args.courseId || window.glState.get('courseId') || '',
      courseName: args.courseName || window.glState.get('courseName') || 'コース未設定',
      startedAt: args.startedAt || window.glState.get('startedAt') || new Date().toISOString(),
      endedAt: new Date().toISOString(),
      totalStrokes,
      totalPar,
      totalDiff,
      outStrokes,
      inStrokes,
      totalPutts,
      holesJson: JSON.stringify(holes),
      companionsJson: JSON.stringify(companions),
      lockerNumber: args.lockerNumber || window.glState.get('lockerNumber') || '',
      theme: args.theme || 'classic',
      notes: args.notes || '',
    };
  }

  const glHistory = {
    /**
     * 起動時にサーバから同期（一度きり）
     */
    async syncFromServer() {
      const userId = window.glProfile.getUserId();
      if (!userId) return [];

      try {
        const result = await window.glandApi.syncHistory({ userId });
        const rounds = result?.rounds || result || [];
        if (Array.isArray(rounds)) {
          _writeCache(rounds);
          window.glStorage.writeLocal(LAST_SYNC_KEY, String(Date.now()));
          window.glEvents.emit('history:synced', { count: rounds.length });
        }
        return rounds;
      } catch (err) {
        window.glErrors.handle(err, { silent: true, context: 'history.sync' });
        return _readCache();
      }
    },

    /**
     * v2.7.20: 保存前にサーバから最新スコアを取得（同伴者のスコアを万全にする）
     * @param {string} roundId
     * @param {number} timeoutMs - タイムアウト（デフォルト5秒）
     * @returns {Promise<Object|null>} 最新スコア or null（失敗時）
     */
    async syncScoresBeforeSave(roundId, timeoutMs = 5000) {
      if (!roundId || !navigator.onLine) return null;
      try {
        const result = await Promise.race([
          window.glandApi.listScores({ roundId }),
          new Promise((_, rej) => setTimeout(() => rej(new Error('sync timeout')), timeoutMs)),
        ]);
        if (result && result.playerScores) {
          const myUserId = window.glProfile.getUserId();
          const currentScores = window.glState.get('scores') || {};
          const merged = { ...result.playerScores };
          // 自分の未送信分は保持（自分のスコアはソースオブトルース）
          if (currentScores[myUserId]) {
            merged[myUserId] = { ...merged[myUserId], ...currentScores[myUserId] };
          }
          window.glState.set('scores', merged);
          return merged;
        }
      } catch (err) {
        console.warn('[history] pre-save sync failed:', err.message);
      }
      return null;
    },

    /**
     * v2.7.17/v2.7.20: ラウンド終了時に自分のスコアを確定・保存（Y案）
     * @param {Object} args - roundId/players 等
     * @returns {Promise<Object>} 保存されたスナップショット + isBest
     */
    async finishAndSave(args) {
      args = args || {};

      // ★ v2.7.20: 保存直前に同期（同伴者の最新スコアを取得）
      const roundId = args.roundId || window.glState.get('roundId');
      const synced = await this.syncScoresBeforeSave(roundId);
      if (synced) {
        args.scores = synced;
      }

      const snapshot = _buildSnapshotForSelf(args);

      // BEST 判定（保存前の履歴と比較）
      const isBest = this.isBestScore(snapshot);
      snapshot.isBest = isBest;

      // 1. ローカルキャッシュに即反映（オフラインでも履歴に出す）
      const arr = _readCache();
      const idx = arr.findIndex((r) => r.roundId === snapshot.roundId && r.userId === snapshot.userId);
      if (idx >= 0) arr[idx] = { ...arr[idx], ...snapshot };
      else arr.unshift(snapshot);
      _writeCache(arr);
      window.glEvents.emit('history:updated', snapshot);

      // 2. GAS 送信（失敗してもローカルには残る）
      try {
        const res = await window.glandApi.saveHistory(snapshot);
        if (res && res.historyId) snapshot.historyId = res.historyId;
        // historyId を反映
        const arr2 = _readCache();
        const idx2 = arr2.findIndex((r) => r.roundId === snapshot.roundId && r.userId === snapshot.userId);
        if (idx2 >= 0) {
          arr2[idx2] = { ...arr2[idx2], historyId: snapshot.historyId };
          _writeCache(arr2);
        }
      } catch (err) {
        // オフライン等 → キューに投入（あれば）
        if (window.glQueue && typeof window.glQueue.enqueue === 'function') {
          window.glQueue.enqueue({ action: 'saveHistory', params: snapshot });
        }
        window.glErrors.handle(err, { silent: true, context: 'history.finishAndSave' });
      }

      return snapshot;
    },

    /**
     * v2.7.17: 現在のスコアがベスト更新かを判定
     * コース別ベスト（同一 courseName 内で最少 totalStrokes）
     */
    isBestScore(snapshot) {
      if (!snapshot || !snapshot.totalStrokes) return false;
      const userId = snapshot.userId;
      const courseName = snapshot.courseName;
      const cur = snapshot.totalStrokes;

      const past = _readCache().filter(
        (r) => r.userId === userId && r.courseName === courseName && r.roundId !== snapshot.roundId
      );
      if (past.length === 0) return false; // 初回はBEST扱いしない（演出過剰防止）
      const min = past.reduce((m, r) => Math.min(m, _num(r.totalStrokes) || 999), 999);
      return cur > 0 && cur < min;
    },

    /**
     * v2.7.17: KPI サマリー（総ラウンド数・平均・ベスト）
     */
    kpi(filter) {
      filter = filter || {};
      const userId = window.glProfile.getUserId();
      let rounds = _readCache().filter((r) => r.userId === userId && _num(r.totalStrokes) > 0);
      if (filter.courseName) rounds = rounds.filter((r) => r.courseName === filter.courseName);

      if (rounds.length === 0) {
        return { count: 0, avgStrokes: 0, avgDiff: 0, bestStrokes: null, bestDiff: null };
      }
      const totalS = rounds.reduce((a, r) => a + _num(r.totalStrokes), 0);
      const totalD = rounds.reduce((a, r) => a + _num(r.totalDiff), 0);
      const bestS = rounds.reduce((m, r) => Math.min(m, _num(r.totalStrokes)), 999);
      const bestRound = rounds.find((r) => _num(r.totalStrokes) === bestS);
      return {
        count: rounds.length,
        avgStrokes: Math.round((totalS / rounds.length) * 10) / 10,
        avgDiff: Math.round((totalD / rounds.length) * 10) / 10,
        bestStrokes: bestS,
        bestDiff: bestRound ? _num(bestRound.totalDiff) : null,
      };
    },

    /**
     * v2.7.17: ユニークなコース名一覧（フィルタ用）
     */
    listCourses() {
      const userId = window.glProfile.getUserId();
      const set = new Set();
      _readCache().forEach((r) => {
        if (r.userId === userId && r.courseName) set.add(r.courseName);
      });
      return Array.from(set).sort();
    },

    /**
     * 旧API互換: シンプル追加
     */
    saveRound(roundData) {
      if (!roundData || !roundData.roundId) return;
      const arr = _readCache();
      const idx = arr.findIndex((r) => r.roundId === roundData.roundId);
      if (idx >= 0) {
        arr[idx] = { ...arr[idx], ...roundData };
      } else {
        arr.unshift(roundData);
      }
      _writeCache(arr);
      window.glEvents.emit('history:updated', roundData);
    },

    list() {
      const userId = window.glProfile.getUserId();
      return _readCache().filter((r) => !userId || r.userId === userId || r.userId === undefined);
    },

    get(roundId) {
      return _readCache().find((r) => r.roundId === roundId) || null;
    },

    delete(roundId) {
      const arr = _readCache().filter((r) => r.roundId !== roundId);
      _writeCache(arr);
      window.glEvents.emit('history:deleted', { roundId });
    },

    lastSyncAt() {
      const ts = window.glStorage.readLocal(LAST_SYNC_KEY);
      return ts ? parseInt(ts, 10) : 0;
    },
  };

  window.glHistory = glHistory;
})();
