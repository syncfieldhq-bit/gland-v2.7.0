/**
 * G-LAND v2.8.0 - Auth Domain
 * ===========================
 * Firebase 認証の状態を G-LAND アプリ内で使いやすい形にラップする層。
 * window.glFirebase (Firebase SDK) と、既存の glProfile / glState を橋渡しする。
 *
 * 提供API (window.glAuth):
 *   - ready(): Promise  ← 初期化完了を待つ
 *   - isLoggedIn(): boolean
 *   - getUser(): { uid, email, displayName, photoURL } | null
 *   - signIn(): Promise<user>
 *   - signOut(): Promise<void>
 *   - onChange(cb): unsubscribe
 */
(function () {
  'use strict';

  const KEYS = {
    firebaseUid: 'gl_firebase_uid_v1',
    firebaseEmail: 'gl_firebase_email_v1',
    firebaseDisplayName: 'gl_firebase_displayname_v1',
    firebasePhotoUrl: 'gl_firebase_photourl_v1',
  };

  let cachedUser = null;
  let readyResolved = false;
  let readyPromise = null;

  function _extractUserInfo(fbUser) {
    if (!fbUser) return null;
    return {
      uid: fbUser.uid,
      email: fbUser.email || '',
      displayName: fbUser.displayName || '',
      photoURL: fbUser.photoURL || '',
    };
  }

  function _persist(user) {
    const s = window.glStorage;
    if (!s) return;
    if (user) {
      s.writeTriple(KEYS.firebaseUid, user.uid);
      s.writeTriple(KEYS.firebaseEmail, user.email);
      s.writeTriple(KEYS.firebaseDisplayName, user.displayName);
      s.writeTriple(KEYS.firebasePhotoUrl, user.photoURL);
    } else {
      s.writeTriple(KEYS.firebaseUid, '');
      s.writeTriple(KEYS.firebaseEmail, '');
      s.writeTriple(KEYS.firebaseDisplayName, '');
      s.writeTriple(KEYS.firebasePhotoUrl, '');
    }
  }

  function _restoreFromStorage() {
    const s = window.glStorage;
    if (!s) return null;
    const uid = s.readTriple(KEYS.firebaseUid);
    if (!uid) return null;
    return {
      uid,
      email: s.readTriple(KEYS.firebaseEmail) || '',
      displayName: s.readTriple(KEYS.firebaseDisplayName) || '',
      photoURL: s.readTriple(KEYS.firebasePhotoUrl) || '',
    };
  }

  const glAuth = {
    /**
     * Firebase SDK 初期化完了を待つ（起動時に一度だけ呼ぶ）
     */
    ready() {
      if (readyPromise) return readyPromise;

      readyPromise = (async () => {
        // localStorage から仮復元（オフライン時 UX 改善）
        cachedUser = _restoreFromStorage();

        if (!window.glFirebase) {
          // Firebase SDK 未読込（ネットワーク障害など）
          console.warn('[glAuth] glFirebase not loaded, using cached user only');
          readyResolved = true;
          return cachedUser;
        }

        try {
          await window.glFirebase.ready;
          const fbUser = window.glFirebase.getCurrentUser();
          cachedUser = _extractUserInfo(fbUser);
          _persist(cachedUser);

          // 状態変化を購読
          window.glFirebase.onAuthStateChanged((user) => {
            const info = _extractUserInfo(user);
            cachedUser = info;
            _persist(info);
            if (window.glEvents) {
              window.glEvents.emit('auth:changed', info);
            }
          });
        } catch (err) {
          console.error('[glAuth] init failed:', err);
        }

        readyResolved = true;
        return cachedUser;
      })();

      return readyPromise;
    },

    isReady() {
      return readyResolved;
    },

    isLoggedIn() {
      return !!(cachedUser && cachedUser.uid);
    },

    getUser() {
      return cachedUser;
    },

    getUid() {
      return cachedUser?.uid || null;
    },

    async signIn() {
      if (!window.glFirebase) {
        throw new Error('Firebase SDK が読み込まれていません。ネットワーク接続を確認してください。');
      }
      const fbUser = await window.glFirebase.signInWithGoogle();
      if (fbUser) {
        cachedUser = _extractUserInfo(fbUser);
        _persist(cachedUser);
      }
      return cachedUser;
    },

    async signOut() {
      if (!window.glFirebase) return;
      await window.glFirebase.signOut();
      cachedUser = null;
      _persist(null);
    },

    onChange(callback) {
      if (!window.glEvents) return () => {};
      return window.glEvents.on('auth:changed', callback);
    },
  };

  window.glAuth = glAuth;
})();
