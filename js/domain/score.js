/**
 * G-LAND v2.7.0 - Score Domain (楽観的UIの核心)
 * =============================================
 * フロー:
 *   1. state更新（即UI反映） ← 現場のサクサク感
 *   2. queue.enqueue（localStorage永続化）
 *   3. api.saveScore（非同期・失敗時はキューが引き継ぎ）
 *   4. events.emit
 *
 * 15秒ごとに fetchPeers() でメンバーのスコアを取得
 * メンバーリスト refresh は 10回に1回のみ（150秒間隔）
 */
(function () {
  'use strict';

  const PEER_POLL_MS = 15000;
  const MEMBER_REFRESH_EVERY = 10;

  let pollTimer = null;
  let pollCount = 0;

  function _getScoresMap() {
    return window.glState.get('scores') || {};
  }

  const glScore = {
    /**
     * スコア保存（楽観的UI）
     * @param {string} playerId
     * @param {number} hole
     * @param {number} strokes
     */
    save(playerId, hole, strokes) {
      const roundId = window.glState.get('roundId');
      const userId = window.glProfile.getUserId();

      if (!roundId || !userId) {
        window.glErrors.handle({ code: 'A2' });
        return;
      }

      const numStrokes = parseInt(strokes, 10);
      if (isNaN(numStrokes) || numStrokes < 1) {
        window.glErrors.handle({ code: 'U5' });
        return;
      }

      // 1. state即更新（UI瞬時反映）
      const scores = _getScoresMap();
      if (!scores[playerId]) scores[playerId] = {};
      scores[playerId][`hole${hole}`] = numStrokes;
      window.glState.set('scores', { ...scores });

      // 2. キュー永続化（オフライン耐性）
      window.glQueue.enqueue('saveScore', {
        userId,
        roundId,
        playerId,
        hole,
        strokes: numStrokes,
      });

      // 3. イベント発火（UI側で他画面連動可）
      window.glEvents.emit('score:saved', { playerId, hole, strokes: numStrokes, optimistic: true });

      return { ok: true, optimistic: true };
    },

    /**
     * ローカルのスコア取得
     */
    getLocal(playerId, hole) {
      const scores = _getScoresMap();
      return scores?.[playerId]?.[`hole${hole}`] ?? null;
    },

    /**
     * メンバー全員のスコアをサーバから取得
     */
    async fetchPeers() {
      const roundId = window.glState.get('roundId');
      if (!roundId) return;

      try {
        const result = await window.glandApi.listScores({ roundId });
        const playerScores =
          result?.playerScores ||
          result?.scores ||
          result?.data?.playerScores ||
          result?.data?.scores ||
          {};

        // ★修正：自分の管理下（自分と自分の代理）だけローカル優先、他人はサーバー優先
        const local = _getScoresMap();
        const merged = { ...playerScores };
        const myUserId = window.glProfile.getUserId();
        const myProxies = window.glState.get('proxyPlayers') || [];
        const myProxyIds = myProxies.map(p => p.userId);

        Object.keys(local).forEach((pid) => {
          if (pid === myUserId || myProxyIds.includes(pid)) {
            // 自分・自分の代理：スマホの記憶（手入力）を優先して上書き
            merged[pid] = { ...(playerScores[pid] || {}), ...local[pid] };
          } else {
            // 共有メンバー：サーバーの最新データを優先！（これで4が5に変わる）
            merged[pid] = { ...(local[pid] || {}), ...(playerScores[pid] || {}) };
          }
        });

        window.glState.set('scores', merged);
        window.glEvents.emit('score:fetched', { scores: merged });
        return merged;
      } catch (err) {
        window.glErrors.handle(err, { silent: true, context: 'score.fetchPeers' });
        return _getScoresMap();
      }
    },

    /**
     * ポーリング開始（ラウンド開始時）
     */
    startPolling() {
      if (pollTimer) return;
      pollCount = 0;

      pollTimer = setInterval(async () => {
        if (!window.glState.get('roundId')) return;
        if (!navigator.onLine) return;

        pollCount++;
        // 10回に1回だけメンバーリスト更新
        if (pollCount % MEMBER_REFRESH_EVERY === 0 && window.glRound) {
          window.glRound.refreshMembers();
        }
        await this.fetchPeers();
      }, PEER_POLL_MS);

      // 初回即実行
      this.fetchPeers();
    },

    stopPolling() {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
        pollCount = 0;
      }
    },
  };

  window.glScore = glScore;

  // ラウンド開始/終了に合わせてポーリング制御
  if (window.glEvents) {
    window.glEvents.on('round:started', () => glScore.startPolling());
    window.glEvents.on('round:joined', () => glScore.startPolling());
    window.glEvents.on('round:left', () => glScore.stopPolling());
  }
})();
