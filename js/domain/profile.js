/**
 * G-LAND v2.8.0 - Profile Domain
 * ==============================
 * Firebase UID を主キーとしたユーザープロフィール管理。
 *
 * 【2段階入力設計】
 *   初回登録（必須2項目）: familyName, familyKana
 *     → スコア入力・同伴プレイヤー表示に必要
 *   履歴閲覧時（追加3項目）: firstName, firstKana, nickname
 *     → 履歴詳細を見る時までに揃える
 *
 * 【表示ルール】
 *   スコアカード / 履歴: familyName（姓）
 *   ホーム / マイページ: nickname（未入力時は familyName でフォールバック）
 */
(function () {
  'use strict';

  const KEYS = {
    userId: 'gl_user_id_v1',
    familyName: 'gl_profile_lastName',
    familyKana: 'gl_profile_lastNameKana',
    firstName: 'gl_profile_firstName',
    firstKana: 'gl_profile_firstNameKana',
    nickname: 'gl_profile_nickname',
    // 旧: courseAdjust は廃止（v2.7 まで互換）
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
      nickname: s.readTriple(KEYS.nickname),
    };
  }

  function _saveToStorage(profile) {
    const s = window.glStorage;
    if (profile.familyName !== undefined) s.writeTriple(KEYS.familyName, profile.familyName || '');
    if (profile.familyKana !== undefined) s.writeTriple(KEYS.familyKana, profile.familyKana || '');
    if (profile.firstName !== undefined) s.writeTriple(KEYS.firstName, profile.firstName || '');
    if (profile.firstKana !== undefined) s.writeTriple(KEYS.firstKana, profile.firstKana || '');
    if (profile.nickname !== undefined) s.writeTriple(KEYS.nickname, profile.nickname || '');
  }

  function _firebaseUid() {
    return window.glAuth && window.glAuth.getUid ? window.glAuth.getUid() : null;
  }

  function _firebaseEmail() {
    const u = window.glAuth && window.glAuth.getUser ? window.glAuth.getUser() : null;
    return u ? u.email : '';
  }

  const glProfile = {
    /**
     * 初回登録（必須2項目: familyName, familyKana）
     * Firebase UID を GAS に送り、userId を紐付ける
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
      const firebaseUid = _firebaseUid();
      const email = _firebaseEmail();

      const registerPayload = {
        familyName: fn,
        familyKana: fk,
        firebaseUid,
        email,
      };

      if (opts.syncWait) {
        // ゲスト合流フロー: userId 発行を同期待ち
        try {
          const result = await window.glandApi.registerUser(registerPayload);
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
          const result = await window.glandApi.registerUser(registerPayload);
          const userId = result?.userId;
          if (userId) {
            window.glStorage.writeTriple(KEYS.userId, userId);
            window.glState.set('userId', userId);
            window.glEvents.emit('profile:registered', { userId });
          }
        } catch (err) {
          // バックグラウンド失敗時はキューへ
          window.glErrors.handle(err, { silent: true, context: 'register.bg' });
          window.glQueue.enqueue('updateUser', registerPayload);
        }
      })();

      return { userId: existingUserId, optimistic: true };
    },

    /**
     * プロフィール更新（既存ユーザー）
     * 5項目のうち任意項目をマージ更新
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
        await window.glandApi.updateUser({
          userId,
          firebaseUid: _firebaseUid(),
          email: _firebaseEmail(),
          ...profile,
        });
        return { ok: true };
      } catch (err) {
        window.glErrors.handle(err, { silent: true, context: 'update.bg' });
        window.glQueue.enqueue('updateUser', { userId, ...profile });
        return { ok: true, queued: true };
      }
    },

    /**
     * 最低限の必須項目が揃っているか（合流可否・スコア入力可否）
     * = 姓 + 姓のよみがな
     */
    isMinimum() {
      const s = _getStored();
      return !!(s.familyName && s.familyKana);
    },

    /**
     * 履歴閲覧に必要な全項目が揃っているか
     * = 姓 + 姓よみ + 名 + 名よみ + ニックネーム
     */
    isFull() {
      const s = _getStored();
      return !!(s.familyName && s.familyKana && s.firstName && s.firstKana && s.nickname);
    },

    /**
     * 履歴閲覧時に不足している項目のキーを返す（プロンプトUI用）
     */
    getMissingForHistory() {
      const s = _getStored();
      const missing = [];
      if (!s.firstName) missing.push('firstName');
      if (!s.firstKana) missing.push('firstKana');
      if (!s.nickname) missing.push('nickname');
      return missing;
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
