/**
 * G-LAND v2.7.0 - API Layer (GAS通信の唯一の窓口)
 * ==============================================
 * 純粋な通信層。DOM/state/localStorage を直接触らない。
 * エラーは throw し、呼び出し側 (domain層) で glErrors.handle() する。
 *
 * URL設定はハイブリッド方式:
 *   優先度1: glandApi._setUrl(url) で明示設定
 *   優先度2: window.GLAND_GAS_URL (毎リクエスト時に再評価)
 */
(function () {
  'use strict';

  // ==== モジュール内可変状態 ====
  let targetUrl = ''; // _setUrl() または _resolveUrl() 経由で更新
  const API_TIMEOUT = 12000;

  /**
   * URLを解決する（ハイブリッド方式）
   * 1. _setUrl で設定された targetUrl があれば優先
   * 2. なければ window.GLAND_GAS_URL を都度参照
   */
  function _resolveUrl() {
    if (targetUrl && typeof targetUrl === 'string' && targetUrl.length > 0) {
      return targetUrl;
    }
    if (typeof window !== 'undefined' && window.GLAND_GAS_URL) {
      return window.GLAND_GAS_URL;
    }
    return '';
  }

  function _assertConfig() {
    const url = _resolveUrl();
    if (!url) {
      const e = new Error('GAS_URL not configured');
      e.code = 'A10';
      throw e;
    }
    return url;
  }

  /**
   * レスポンス構造の正規化
   * GAS側が {ok:true, data:{...}} でラップする場合と直返しの両方に対応
   */
  function _unwrap(json) {
    if (json && typeof json === 'object') {
      if (json.ok === false) {
        const e = new Error(json.error || 'API_ERROR');
        e.code = json.errorCode || 'A9';
        e.raw = json;
        throw e;
      }
      if (json.data !== undefined) return json.data;
      return json;
    }
    return json;
  }

  /**
   * 共通POST
   */
  async function _post(action, params = {}) {
    const url = _assertConfig();
    if (!window.glNet) {
      throw new Error('glNet not ready');
    }

    const body = JSON.stringify({ action, ...params });
    let res;
    try {
      res = await window.glNet.fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // GAS は text/plain 推奨（CORSプリフライト回避）
          body,
        },
        API_TIMEOUT
      );
    } catch (err) {
      throw err; // N1 / N2 コード付き
    }

    if (!res.ok) {
      const e = new Error(`HTTP ${res.status}`);
      e.code = res.status >= 500 ? 'A9' : 'A6';
      throw e;
    }

    let json;
    try {
      json = await res.json();
    } catch (err) {
      const e = new Error('INVALID_JSON');
      e.code = 'A7';
      throw e;
    }
    return _unwrap(json);
  }

  const glandApi = {
    // ==== User ====
    async registerUser({ familyName, familyKana }) {
      return _post('registerUser', { familyName, familyKana });
    },
    async updateUser({ userId, ...profile }) {
      return _post('updateUser', { userId, ...profile });
    },

    // ==== Round ====
    async startRound({ userId, hostName, existingRoundId }) {
      return _post('startRound', { userId, hostName, existingRoundId });
    },
    async joinRound({ userId, groupCode, guestName }) {
      return _post('joinRound', { userId, groupCode, guestName });
    },
    async getRound({ roundId }) {
      return _post('getRound', { roundId });
    },
    async listRoundMembers({ roundId }) {
      return _post('listRoundMembers', { roundId });
    },
    async leaveRound({ userId, roundId }) {
      return _post('leaveRound', { userId, roundId });
    },

    // ==== Score ====
    async saveScore({ userId, roundId, playerId, hole, strokes }) {
      return _post('saveScore', { userId, roundId, playerId, hole, strokes });
    },
    async listScores({ roundId }) {
      return _post('listScores', { roundId });
    },

    // ==== History ====
    async syncHistory({ userId }) {
      return _post('syncHistory', { userId });
    },

    // ==== Course ====
    async searchCourses({ prefecture, kana }) {
      return _post('searchCourses', { prefecture, kana });
    },
    async listMyCourses({ userId }) {
      return _post('listMyCourses', { userId });
    },
    async addMyCourse({ userId, courseId }) {
      return _post('addMyCourse', { userId, courseId });
    },
    async requestCourseAdd({ userId, name, prefecture, note }) {
      return _post('requestCourseAdd', { userId, name, prefecture, note });
    },

    // ==== Ads ====
    async listAds({ slot, region }) {
      return _post('listAds', { slot, region });
    },

    // ==== Keep-alive ====
    async ping() {
      return _post('ping', {});
    },

    // ==== 動的設定 ====
    /**
     * GAS デプロイURLを明示的に設定する
     * @param {string} url
     */
    _setUrl(url) {
      targetUrl = url || window.GLAND_GAS_URL || '';
      console.log('[glandApi] URL updated:', targetUrl ? targetUrl.substring(0, 60) + '...' : '(empty)');
    },

    /**
     * 現在解決されるURLを取得（デバッグ用）
     */
    _getUrl() {
      return _resolveUrl();
    },
  };

  // 後方互換
  window.glandApi = glandApi;
  window.gwApi = glandApi;
})();
