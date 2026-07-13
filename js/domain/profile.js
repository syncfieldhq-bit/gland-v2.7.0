/**
 * G-LAND v2.7.0 - Profile Domain
 * ==============================
 * 楽観的UI: 入力→即localStorage保存→UI遷移→バックグラウンドでGAS登録
 * ゲスト合流時 (?join=) のみ userId 発行を同期待ちする
 *
 * 必須項目: familyName（漢字）+ familyKana（ひらがな） 2項目のみ
 * 任意項目: firstName, firstKana, courseAdjust
 */
(function () {
  'use strict';

  const KEYS = {
    userId: 'gl_user_id_v1',
    familyName: 'gl_profile_lastName',
    familyKana: 'gl_profile_lastNameKana',
    firstName: 'gl_profile_firstName',
    firstKana: 'gl_profile_firstNameKana',
    courseAdjust: 'gl_profile_courseAdjust',
  };

  function _getStored() {
    const s = window.glStorage;
    return {
      userId: s.readTriple(KEYS.userId),
      familyName: s.readTriple(KEYS.familyName),
      familyKana: s.readTriple(KEYS.familyKana),
      firstName: s.readTriple(KEYS.firstName),
      firstKana: s.readTriple(KEYS.firstKana),
      courseAdjust: s.readTriple(KEYS.courseAdjust),
    };
  }

  function _saveToStorage(profile) {
    const s = window.glStorage;
    if (profile.familyName !== undefined) s.writeTriple(KEYS.familyName, profile.familyName || '');
    if (profile.familyKana !== undefined) s.writeTriple(KEYS.familyKana, profile.familyKana || '');
    if (profile.firstName !== undefined) s.writeTriple(KEYS.firstName, profile.firstName || '');
    if (profile.firstKana !== undefined) s.writeTriple(KEYS.firstKana, profile.firstKana || '');
    if (profile.courseAdjust !== undefined) s.writeTriple(KEYS.courseAdjust, String(profile.courseAdjust || ''));
  }

  const glProfile = {
    /**
     * 初回登録（楽観的UI）
     * @param {Object} data - {familyName, familyKana}
     * @param {Object} opts - {syncWait: boolean} ゲスト合流時はtrue
     * @returns {Promise<{userId, optimistic}>}
     */
    async register({ familyName, familyKana }, opts = {}) {
      const fn = (familyName || '').trim();
      const fk = (familyKana || '').trim();

      if (!fn || !fk) {
        const e = new Error('familyName and familyKana required');
        e.code = 'U5';
        throw e;
      }

      // 1. 即座にlocalStorageへ保存（楽観的UI）
      _saveToStorage({ familyName: fn, familyKana: fk });
      window.glState.set('profile', { familyName: fn, familyKana: fk });
      window.glEvents.emit('profile:updated', { familyName: fn, familyKana: fk });

      // 2. GAS登録
      const existingUserId = window.glStorage.readTriple(KEYS.userId);

      if (opts.syncWait) {
        // ゲスト合流フロー: userId 発行を同期待ち
        try {
          const result = await window.glandApi.registerUser({ familyName: fn, familyKana: fk });
          const userId = result?.userId || existingUserId;
          if (userId) {
            window.glStorage.writeTriple(KEYS.userId, userId);
            window.glState.set('userId', userId);
            window.glEvents.emit('profile:registered', { userId });
          }
          return { userId, optimistic: false };
        } catch (err) {
          window.glErrors.handle(err, { context: 'register.sync' });
          throw err;
        }
      }

      // 通常フロー: バックグラウンド登録
      (async () => {
        try {
          const result = await window.glandApi.registerUser({ familyName: fn, familyKana: fk });
          const userId = result?.userId;
          if (userId) {
            window.glStorage.writeTriple(KEYS.userId, userId);
            window.glState.set('userId', userId);
            window.glEvents.emit('profile:registered', { userId });
          }
        } catch (err) {
          // バックグラウンド失敗時はキューへ
          window.glErrors.handle(err, { silent: true, context: 'register.bg' });
          window.glQueue.enqueue('updateUser', { familyName: fn, familyKana: fk });
        }
      })();

      return { userId: existingUserId, optimistic: true };
    },

    /**
     * プロフィール更新（既存ユーザー）
     */
    async update(profile) {
      const stored = _getStored();
      const merged = { ...stored, ...profile };

      // 即localStorage反映
      _saveToStorage(profile);
      window.glState.set('profile', merged);
      window.glEvents.emit('profile:updated', merged);

      const userId = stored.userId;
      if (!userId) {
        // userId未発行なら登録扱いに切替
        return this.register({ familyName: merged.familyName, familyKana: merged.familyKana });
      }

      // バックグラウンド送信 or キュー
      try {
        await window.glandApi.updateUser({ userId, ...profile });
        return { ok: true };
      } catch (err) {
        window.glErrors.handle(err, { silent: true, context: 'update.bg' });
        window.glQueue.enqueue('updateUser', { userId, ...profile });
        return { ok: true, queued: true };
      }
    },

    /**
     * 最低限の必須項目が揃っているか（合流可否判定）
     */
    isMinimum() {
      const s = _getStored();
      return !!(s.familyName && s.familyKana);
    },

    /**
     * 5項目全て揃っているか（ラウンド保存時の判定）
     */
    isFull() {
      const s = _getStored();
      return !!(s.familyName && s.familyKana && s.firstName && s.firstKana && s.courseAdjust);
    },

    getStored() {
      return _getStored();
    },

    getUserId() {
      return window.glStorage.readTriple(KEYS.userId);
    },

    /**
     * 表示名を取得
     *
     * 呼び出しパターン1: getDisplayName('home')  → 自分のニックネームまたは姓
     * 呼び出しパターン2: getDisplayName(playerObject)  → プレイヤーの姓（同伴プレイヤー対応）
     *
     * 【重要】player オブジェクトが渡された場合は、自分ではなくそのプレイヤーの名前を返す
     */
    getDisplayName(arg) {
      // 引数なし or 文字列としての context
      if (arg == null || typeof arg === 'string') {
        const context = arg || 'score';
        const s = _getStored();
        if (context === 'home' || context === 'mypage') {
          return s.nickname || s.familyName || 'ゲスト';
        }
        return s.familyName || 'ゲスト';
      }

      // player オブジェクトが渡された場合
      const player = arg;
      // 自分のユーザーID と一致する場合 → 自分のプロフィールから取得
      const myUserId = window.glStorage.readTriple(KEYS.userId);
      if (myUserId && player.userId === myUserId) {
        const s = _getStored();
        return s.familyName || player.familyName || player.displayName || 'ゲスト';
      }

      // 同伴プレイヤー → そのプレイヤーの familyName / displayName を返す
      return player.familyName || player.displayName || player.name || 'ゲスト';
    },
  };

  window.glProfile = glProfile;
})();
