/**
 * G-LAND v2.7.0 - Round Domain
 * ============================
 * ラウンド開始/合流/離脱の業務ロジック。
 * GAS呼出結果を glState へ反映し、イベント発火。
 */
(function () {
  'use strict';

  const KEYS = {
    roundId: 'gl_round_id_v1',
    groupCode: 'gl_group_code_v1',
    pendingJoin: 'gl_pending_join_v1',
  };

  let _startInProgress = false;
  let _joinInProgress = false;

  /**
   * レスポンスから4パターンでgroupCodeを抽出（v2.5.0互換）
   */
  function _extractGroupCode(result) {
    if (!result) return null;
    return (
      result.groupCode ||
      result.group_code ||
      result?.round?.groupCode ||
      result?.data?.groupCode ||
      null
    );
  }

  function _extractRoundId(result) {
    if (!result) return null;
    return result.roundId || result.round_id || result?.round?.roundId || result?.data?.roundId || null;
  }

  const glRound = {
    /**
     * ラウンド開始
     * @param {string} hostName
     * @returns {Promise<{roundId, groupCode}>}
     */
    async start(hostName) {
      if (_startInProgress) {
        const e = new Error('Round start already in progress');
        e.code = 'A4';
        throw e;
      }

      const userId = window.glProfile.getUserId();
      if (!userId) {
        const e = new Error('userId not issued');
        e.code = 'A1';
        window.glErrors.handle(e);
        throw e;
      }

      // 既にラウンド中ならそのまま返す（重複作成防止）
      const existingRoundId = window.glStorage.readTriple(KEYS.roundId);
      const existingGroupCode = window.glStorage.readTriple(KEYS.groupCode);
      if (existingRoundId && existingGroupCode) {
        window.glState.patch({ roundId: existingRoundId, groupCode: existingGroupCode });
        return { roundId: existingRoundId, groupCode: existingGroupCode, reused: true };
      }

      _startInProgress = true;
      try {
        const result = await window.glandApi.startRound({
          userId,
          hostName,
          existingRoundId: existingRoundId || undefined,
        });

        const roundId = _extractRoundId(result);
        const groupCode = _extractGroupCode(result);

        if (!roundId) {
          const e = new Error('roundId not returned');
          e.code = 'A7';
          throw e;
        }

        // 三重ストレージ + state
        window.glStorage.writeTriple(KEYS.roundId, roundId);
        if (groupCode) window.glStorage.writeTriple(KEYS.groupCode, groupCode);
        window.glState.patch({
          roundId,
          groupCode: groupCode || null,
          hostUserId: userId,
        });

        window.glEvents.emit('round:started', { roundId, groupCode });
        return { roundId, groupCode };
      } catch (err) {
        window.glErrors.handle(err, { context: 'round.start' });
        throw err;
      } finally {
        _startInProgress = false;
      }
    },

    /**
     * 合流（4桁コード or QR経由）
     * @param {string} groupCode
     */
    async join(groupCode) {
      if (_joinInProgress) {
        const e = new Error('Join already in progress');
        e.code = 'U2';
        throw e;
      }

      const userId = window.glProfile.getUserId();
      if (!userId) {
        const e = new Error('userId not issued');
        e.code = 'A1';
        window.glErrors.handle(e);
        throw e;
      }

      const code = (groupCode || '').trim().toUpperCase();
      if (!code) {
        const e = new Error('groupCode required');
        e.code = 'U5';
        throw e;
      }

      const stored = window.glProfile.getStored();
      const guestName = stored.familyName || 'ゲスト';

      _joinInProgress = true;
      try {
        const result = await window.glandApi.joinRound({ userId, groupCode: code, guestName });

        const roundId = _extractRoundId(result);
        if (!roundId) {
          const e = new Error('roundId not returned from joinRound');
          e.code = 'A7';
          throw e;
        }

        window.glStorage.writeTriple(KEYS.roundId, roundId);
        window.glStorage.writeTriple(KEYS.groupCode, code);
        window.glState.patch({ roundId, groupCode: code });

        // pendingJoin をクリア
        window.glStorage.writeLocal(KEYS.pendingJoin, null);
        window.glState.set('pendingJoinRoundId', null);

        window.glEvents.emit('round:joined', { roundId, groupCode: code });
        return { roundId, groupCode: code };
      } catch (err) {
        window.glErrors.handle(err, { context: 'round.join' });
        throw err;
      } finally {
        _joinInProgress = false;
      }
    },

        /**
     * 現在のメンバー一覧を再取得（修正版: 名前フィールド正規化）
     */
    async refreshMembers() {
      const roundId = window.glState.get('roundId');
      if (!roundId) return [];

      try {
        const result = await window.glandApi.listRoundMembers({ roundId });
        const members = result?.members || result || [];

        // ⭐【修正】各メンバーの名前フィールドを正規化
        //    displayName / familyName / name のどれかが必ず入るように補正
        const normalized = members.map((m) => {
          const displayName = window.glProfile.getDisplayName(m);
          return {
            ...m,
            displayName: displayName,
            name: displayName, // 下位互換
            familyName: m.familyName || displayName,
          };
        });

        // 自分を先頭にソート
        const myUserId = window.glProfile.getUserId();
        const sorted = [...normalized].sort((a, b) => {
          if (a.userId === myUserId) return -1;
          if (b.userId === myUserId) return 1;
          return 0;
        });

        window.glState.set('players', sorted);
        window.glEvents.emit('round:member-updated', { members: sorted });
        return sorted;
      } catch (err) {
        window.glErrors.handle(err, { silent: true, context: 'round.refreshMembers' });
        return window.glState.get('players') || [];
      }
    },


    /**
     * ラウンド離脱
     */
    async leave() {
      const roundId = window.glState.get('roundId');
      const userId = window.glProfile.getUserId();
      if (!roundId || !userId) {
        this._clearLocal();
        return;
      }

      try {
        await window.glandApi.leaveRound({ userId, roundId });
      } catch (err) {
        window.glErrors.handle(err, { silent: true, context: 'round.leave' });
      }
      this._clearLocal();
      window.glEvents.emit('round:left', { roundId });
    },

    /**
     * ラウンド完了時のローカル状態クリア
     */
    _clearLocal() {
      window.glStorage.removeAll(KEYS.roundId);
      window.glStorage.removeAll(KEYS.groupCode);
      window.glState.patch({
        roundId: null,
        groupCode: null,
        players: [],
        currentHole: 1,
        scores: {},
        hostUserId: null,
      });
    },

    getCurrent() {
      return {
        roundId: window.glState.get('roundId'),
        groupCode: window.glState.get('groupCode'),
        players: window.glState.get('players') || [],
      };
    },

    /**
     * ?join= 検出時に pending として保存（プロフィール登録待ち用）
     */
    setPendingJoin(roundIdOrCode) {
      if (!roundIdOrCode) return;
      window.glStorage.writeLocal(KEYS.pendingJoin, roundIdOrCode);
      window.glState.set('pendingJoinRoundId', roundIdOrCode);
    },

    getPendingJoin() {
      return window.glStorage.readLocal(KEYS.pendingJoin);
    },

    clearPendingJoin() {
      window.glStorage.writeLocal(KEYS.pendingJoin, null);
      window.glState.set('pendingJoinRoundId', null);
    },
  };

  window.glRound = glRound;
})();
