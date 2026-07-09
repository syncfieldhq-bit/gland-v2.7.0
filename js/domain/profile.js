/**
 * G-LAND v2.7.0 - Profile Domain (修正版: name 互換フィールド追加)
 * ==============================================================
 * 修正点:
 *   - getStored() に name (= familyName) を自動付与
 *   - buildDisplayName() ヘルパーを追加して他モジュールから利用可能に
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

  /**
   * ⭐【新規】表示名を統一的に構築するヘルパー
   * 優先順: displayName > familyName+firstName > familyName > name > 'プレイヤー'
   * この関数を全モジュールで共通利用することで名前解決の食い違いを根絶
   */
  function _buildDisplayName(obj) {
    if (!obj) return 'プレイヤー';
    if (obj.displayName && String(obj.displayName).trim()) return String(obj.displayName).trim();

    const fn = (obj.familyName || '').trim();
    const gn = (obj.firstName || '').trim();
    if (fn && gn) return `${fn} ${gn}`;
    if (fn) return fn;

    if (obj.name && String(obj.name).trim()) return String(obj.name).trim();
    return 'プレイヤー';
  }

  function _getStored() {
    const s = window.glStorage;
    const familyName = s.readTriple(KEYS.familyName);
    const familyKana = s.readTriple(KEYS.familyKana);
    const firstName = s.readTriple(KEYS.firstName);
    const firstKana = s.readTriple(KEYS.firstKana);

    const stored = {
      userId: s.readTriple(KEYS.userId),
      familyName: familyName,
      familyKana: familyKana,
      firstName: firstName,
      firstKana: firstKana,
      courseAdjust: s.readTriple(KEYS.courseAdjust),
    };
    // ⭐【修正】name 互換フィールドを自動付与
    stored.name = _buildDisplayName(stored);
    stored.displayName = stored.name;
    return stored;
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
    async register({ familyName, familyKana }, opts = {}) {
      const fn = (familyName || '').trim();
      const fk = (familyKana || '').trim();

      if (!fn || !fk) {
        const e = new Error('familyName and familyKana required');
        e.code = 'U5';
        throw e;
      }

      _saveToStorage({ familyName: fn, familyKana: fk });

      // ⭐【修正】state.profile にも name/displayName を含めて保存（下位互換）
      const profileForState = {
        familyName: fn,
        familyKana: fk,
        name: fn,
        displayName: fn,
      };
      window.glState.set('profile', profileForState);
      window.glEvents.emit('profile:updated', profileForState);

      const existingUserId = window.glStorage.readTriple(KEYS.userId);

      if (opts.syncWait) {
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
          window.glErrors.handle(err, { silent: true, context: 'register.bg' });
          window.glQueue.enqueue('updateUser', { familyName: fn, familyKana: fk });
        }
      })();

      return { userId: existingUserId, optimistic: true };
    },

    async update(profile) {
      const stored = _getStored();
      const merged = { ...stored, ...profile };

      _saveToStorage(profile);
      // ⭐ name フィールド再構築
      merged.name = _buildDisplayName(merged);
      merged.displayName = merged.name;

      window.glState.set('profile', merged);
      window.glEvents.emit('profile:updated', merged);

      const userId = stored.userId;
      if (!userId) {
        return this.register({ familyName: merged.familyName, familyKana: merged.familyKana });
      }

      try {
        await window.glandApi.updateUser({ userId, ...profile });
        return { ok: true };
      } catch (err) {
        window.glErrors.handle(err, { silent: true, context: 'update.bg' });
        window.glQueue.enqueue('updateUser', { userId, ...profile });
        return { ok: true, queued: true };
      }
    },

    isMinimum() {
      const s = _getStored();
      return !!(s.familyName && s.familyKana);
    },

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
     * ⭐【新規公開API】表示名を統一的に取得
     * 他モジュールから window.glProfile.getDisplayName(playerObj) で使う
     */
    getDisplayName(obj) {
      return _buildDisplayName(obj);
    },
  };

  window.glProfile = glProfile;
})();
