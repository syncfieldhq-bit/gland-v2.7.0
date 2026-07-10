/**
 * G-LAND v2.7.0 - Central State Management
 * ========================================
 * アプリケーション全体の状態を集約管理。
 * 変更時は 'state:changed' + 'state:<key>:changed' イベントを発火。
 *
 * 主要キー:
 *   userId, roundId, groupCode, hostUserId
 *   players[], currentHole, scores{}
 *   course, phase (S0-S9), online
 *   pendingJoinRoundId, adsRotation
 */
(function () {
  'use strict';

  const state = {
    // Identity
    userId: null,
    hostUserId: null,

    // Round
    roundId: null,
    groupCode: null,
    players: [], // [{userId, familyName, familyKana, ...}]
    currentHole: 1,
    scores: {}, // { userId: { hole1: strokes, ... } }

    // Course
    course: null, // {courseId, name, holes:[{par, distance}]}

    // Profile
    profile: null, // {familyName, familyKana, firstName?, firstKana?, courseAdjust?}

    // App phase (S0-S9)
    phase: 'S0',

    // Network
    online: navigator.onLine,

    // Guest join flow
    pendingJoinRoundId: null,
    pendingJoinGroupCode: null,

    // Ads
    adsRotation: { home: [], score: [], mypage: [] },

    // Proxy players (代理入力プレイヤー)
    proxyPlayers: [],
  };

  const glState = {
    get(key) {
      return state[key];
    },

    set(key, val) {
      const oldVal = state[key];
      if (oldVal === val) return;
      state[key] = val;
      if (window.glEvents) {
        window.glEvents.emit('state:changed', { key, oldVal, newVal: val });
        window.glEvents.emit(`state:${key}:changed`, { oldVal, newVal: val });
      }
    },

    /**
     * 複数キーを一括更新
     */
    patch(obj) {
      if (!obj || typeof obj !== 'object') return;
      const changes = [];
      Object.keys(obj).forEach((key) => {
        const oldVal = state[key];
        if (oldVal !== obj[key]) {
          state[key] = obj[key];
          changes.push({ key, oldVal, newVal: obj[key] });
        }
      });
      if (window.glEvents && changes.length > 0) {
        changes.forEach((c) => window.glEvents.emit(`state:${c.key}:changed`, c));
        window.glEvents.emit('state:patched', changes);
      }
    },

    /**
     * 特定キーの変更を購読
     */
    subscribe(key, cb) {
      if (!window.glEvents) return () => {};
      return window.glEvents.on(`state:${key}:changed`, cb);
    },

    /**
     * 全状態のスナップショット（読み取り専用コピー）
     */
    snapshot() {
      return JSON.parse(JSON.stringify(state));
    },

    /**
     * 起動時: ストレージから状態を復元
     * boot.js から呼び出す
     */
    hydrate() {
      if (!window.glStorage) return;
      const s = window.glStorage;

      const userId = s.readTriple('gl_user_id_v1');
      if (userId) state.userId = userId;

      const roundId = s.readTriple('gl_round_id_v1');
      if (roundId) state.roundId = roundId;

      const groupCode = s.readTriple('gl_group_code_v1');
      if (groupCode) state.groupCode = groupCode;

      const profile = {
        familyName: s.readTriple('gl_profile_lastName'),
        familyKana: s.readTriple('gl_profile_lastNameKana'),
        firstName: s.readTriple('gl_profile_firstName'),
        firstKana: s.readTriple('gl_profile_firstNameKana'),
      };
      if (profile.familyName || profile.familyKana) {
        state.profile = profile;
      }

      const pendingJoin = s.readLocal('gl_pending_join_v1');
      if (pendingJoin) state.pendingJoinRoundId = pendingJoin;

      // 代理入力プレイヤー復元
      const proxies = s.readLocalJSON('gl_proxy_players_v1');
      if (Array.isArray(proxies)) state.proxyPlayers = proxies;

      state.online = navigator.onLine;

      console.log('[glState] hydrated:', {
        userId: state.userId,
        roundId: state.roundId,
        groupCode: state.groupCode,
        hasProfile: !!state.profile,
      });
    },

    /**
     * デバッグ用: 全状態を出力
     */
    _debug() {
      return state;
    },
  };

  window.glState = glState;
})();
