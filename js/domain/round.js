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
    proxyPlayers: 'gl_proxy_players_v1',
  };

  const MAX_PROXY = 3; // 代理入力プレイヤーの上限（ホスト + 代理最大3人 = 最大4人）

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
         course: window.glState.get('currentCourse') || undefined,
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

       
      // // v2.8.18.2: コース情報から state.pars / state.totalHoles をセット
      // try {
      //   const currentCourse = window.glStorage.readLocalJSON('gl_current_course_v1');
      //   if (currentCourse) {
      //     let totalHoles = currentCourse.totalHoles || 18;
      //     let types = currentCourse.types;
      //     let startType = currentCourse.startType;

      //     // holesJson があればパース（新形式対応）
      //     if (currentCourse.holesJson) {
      //       try {
      //         const holesData = JSON.parse(currentCourse.holesJson);
      //         totalHoles = holesData.totalHoles || totalHoles;
      //         types = types || holesData.types;
      //         startType = startType || holesData.startType;
      //       } catch (e) {
      //         console.warn('[round.start] holesJson parse error', e);
      //       }
      //     }

      //     // state.totalHoles をセット
      //     window.glState.set('totalHoles', totalHoles);

      //     // state.pars をセット
      //     if (Array.isArray(types) && types.length > 0) {
      //       const selectedType = types.find(function(t) { return t.name === startType; }) || types[0];
      //       if (selectedType && Array.isArray(selectedType.pars)) {
      //         const pars = {};
      //         // 前半9ホール
      //         selectedType.pars.forEach(function(p, i) {
      //           pars['hole' + (i + 1)] = p;
      //         });
      //         // 後半9ホール（18ホール & pars9個の場合、同じ配列を再利用）
      //         if (totalHoles === 18 && selectedType.pars.length === 9) {
      //           selectedType.pars.forEach(function(p, i) {
      //             pars['hole' + (i + 10)] = p;
      //           });
      //         }
      //         window.glState.set('pars', pars);
      //       }
      //     }
      //   }
      // } catch (e) {
      //   console.warn('[round.start] course info setup error', e);
      // }
 
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
      // ★ v2.7.20: 招待失敗の原因特定用詳細ログ
      console.log('[round.join] START', {
        code: groupCode,
        ua: navigator.userAgent.substring(0, 60),
        platform: navigator.platform,
        onLine: navigator.onLine,
        time: new Date().toISOString(),
        existingRoundId: window.glState.get('roundId'),
        pendingJoin: window.glStorage.readLocal(KEYS.pendingJoin),
      });

      if (_joinInProgress) {
        console.warn('[round.join] BLOCKED - already in progress');
        const e = new Error('Join already in progress');
        e.code = 'U2';
        throw e;
      }

      const userId = window.glProfile.getUserId();
      if (!userId) {
        console.error('[round.join] userId not issued');
        const e = new Error('userId not issued');
        e.code = 'A1';
        window.glErrors.handle(e);
        throw e;
      }

      const code = (groupCode || '').trim().toUpperCase();
      if (!code) {
        console.error('[round.join] groupCode required, got:', groupCode);
        const e = new Error('groupCode required');
        e.code = 'U5';
        throw e;
      }

      const stored = window.glProfile.getStored();
      const guestName = stored.familyName || 'ゲスト';

      _joinInProgress = true;
      try {
        console.log('[round.join] calling GAS joinRound...', { userId, code, guestName });
        const result = await window.glandApi.joinRound({ userId, groupCode: code, guestName });
        console.log('[round.join] GAS response:', result);

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

        console.log('[round.join] SUCCESS - roundId:', roundId);
        window.glEvents.emit('round:joined', { roundId, groupCode: code });
        return { roundId, groupCode: code };
      } catch (err) {
        console.error('[round.join] FAILED:', err.message, 'code:', err.code, 'stack:', err.stack);
        window.glErrors.handle(err, { context: 'round.join' });
        throw err;
      } finally {
        _joinInProgress = false;
      }
    },

    /**
     * 現在のメンバー一覧を再取得
     */
    async refreshMembers() {
    const roundId = window.glState.get('roundId');
    if (!roundId) return [];

    try {
      const result = await window.glandApi.listRoundMembers({ roundId });
      let members = result.members || result || [];

      // ★ここからID統一ロジック（神の手）
      const localPlayers = window.glState.get('players') || [];
      members = members.map(remoteMember => {
        const localMatch = localPlayers.find(lp => lp.name === remoteMember.name);
        // 同じ名前の代理人がいたら、サーバー側のIDに自分のIDを合わせる（合体！）
        if (localMatch && localMatch.type === 'proxy') {
            return { ...remoteMember, userId: localMatch.userId };
        }
        return remoteMember;
      });
      // ★ここまで

      window.glState.set('players', members);
      return members;
    } catch (err) {
      console.error('Failed to refresh members:', err);
      return [];
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
      window.glStorage.writeLocal(KEYS.proxyPlayers, null);
      // ★ v2.7.20: pendingJoin もクリア（ラウンド終了時のゾンビ化防止）
      window.glStorage.writeLocal(KEYS.pendingJoin, null);
      window.glState.patch({
        roundId: null,
        groupCode: null,
        players: [],
        proxyPlayers: [],
        currentHole: 1,
        scores: {},
        hostUserId: null,
        pendingJoinRoundId: null,
      });
    },

    // ==== 代理入力プレイヤー管理 ====

    /**
     * 代理入力プレイヤーを追加
     * @param {Object} p - {familyName, familyKana}
     * @returns {Object|null} 追加されたプレイヤー情報 or null
     */
    addProxyPlayer({ familyName, familyKana }) {
      const name = (familyName || '').trim();
      if (!name) {
        window.glErrors?.handle({ code: 'U5' });
        return null;
      }

      const proxies = window.glState.get('proxyPlayers') || [];
      if (proxies.length >= MAX_PROXY) {
        window.glToast?.warn(`代理入力は最大${MAX_PROXY}名までです`);
        return null;
      }

      const player = {
        userId: 'PROXY-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6),
        familyName: name,
        familyKana: (familyKana || '').trim(),
        displayName: name,
        role: 'proxy',
        isProxy: true,
        addedAt: new Date().toISOString(),
      };

      const updated = [...proxies, player];
      window.glState.set('proxyPlayers', updated);
      window.glStorage.writeLocal(KEYS.proxyPlayers, updated);
      window.glEvents?.emit('round:proxy-added', player);
      return player;
    },

    /**
     * 代理プレイヤーを削除
     */
    removeProxyPlayer(proxyUserId) {
      const proxies = window.glState.get('proxyPlayers') || [];
      const filtered = proxies.filter((p) => p.userId !== proxyUserId);
      window.glState.set('proxyPlayers', filtered);
      window.glStorage.writeLocal(KEYS.proxyPlayers, filtered);
      window.glEvents?.emit('round:proxy-removed', { proxyUserId });
    },

    /**
     * 代理プレイヤーの情報を更新
     */
    updateProxyPlayer(proxyUserId, patch) {
      const proxies = window.glState.get('proxyPlayers') || [];
      const idx = proxies.findIndex((p) => p.userId === proxyUserId);
      if (idx < 0) return false;
      const updated = proxies.map((p, i) =>
        i === idx ? { ...p, ...patch, displayName: patch.familyName || p.displayName } : p
      );
      window.glState.set('proxyPlayers', updated);
      window.glStorage.writeLocal(KEYS.proxyPlayers, updated);
      window.glEvents?.emit('round:proxy-updated', { proxyUserId });
      return true;
    },

    /**
     * 代理プレイヤー一覧取得
     */
    listProxyPlayers() {
      return window.glState.get('proxyPlayers') || [];
    },

    /**
     * 代理プレイヤーの上限値
     */
    getMaxProxy() {
      return MAX_PROXY;
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
