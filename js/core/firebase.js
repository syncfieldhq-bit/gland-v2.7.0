/**
 * G-LAND v2.8.0 - Firebase Core Module
 * ====================================
 * Firebase SDK (v12.16.0) の初期化を行う ES Module。
 * type="module" で読み込まれ、window.glFirebase を公開する。
 *
 * 【iOS Safari 対応】
 * - Redirect 結果取得は initializeApp 直後に必ず実行（順序重要）
 * - Popup 優先だが、失敗時に Redirect フォールバック
 * - Standalone PWA は最初から Redirect
 */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import {
  getAuth,
  browserLocalPersistence,
  setPersistence,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as fbSignOut,
  onAuthStateChanged as fbOnAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';

// ==== Firebase 設定 ====
const firebaseConfig = {
  apiKey: 'AIzaSyBC31Nhc_QWi7PKqSfxT6U1in3F-9Vf95w',
  authDomain: 'gland-golf.firebaseapp.com',
  projectId: 'gland-golf',
  storageBucket: 'gland-golf.firebasestorage.app',
  messagingSenderId: '328605356763',
  appId: '1:328605356763:web:a7f929f0153b3466d772fe',
};

// ==== 状態 ====
let app = null;
let auth = null;
let currentUser = null;
const authStateCallbacks = new Set();

// ==== 初期化 ====
const readyPromise = (async () => {
  try {
    // 1. Firebase App / Auth 初期化
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    auth.languageCode = 'ja';

    // 2. 永続化を明示的に指定（iOS Safari で重要）
    //    browserLocalPersistence: localStorage に保存 → リロード後も保持
    try {
      await setPersistence(auth, browserLocalPersistence);
      console.log('[firebase] persistence set to browserLocal');
    } catch (persistErr) {
      console.warn('[firebase] setPersistence failed:', persistErr);
    }

    // 3. 【最重要】Redirect 結果を最優先で取得
    //    iOS Safari の Redirect フローでは、
    //    initializeApp 直後に getRedirectResult を呼ばないと結果が消える
    let redirectUser = null;
    try {
      const result = await getRedirectResult(auth);
      if (result && result.user) {
        redirectUser = result.user;
        console.log('[firebase] redirect login result received:', result.user.uid);
      } else {
        console.log('[firebase] no redirect result');
      }
    } catch (err) {
      console.error('[firebase] getRedirectResult error:', err.code, err.message);
    }

    // 4. 現在の認証状態を確定
    //    (redirect result があれば、それが currentUser にも入っているはず)
    await new Promise((resolve) => {
      const unsub = fbOnAuthStateChanged(auth, (user) => {
        currentUser = user || redirectUser;
        unsub();
        resolve();
      });
    });

    // 5. 継続的な認証状態変化を購読
    fbOnAuthStateChanged(auth, (user) => {
      currentUser = user;
      authStateCallbacks.forEach((cb) => {
        try { cb(user); } catch (e) { console.error(e); }
      });
    });

    console.log('[firebase] initialized. currentUser =', currentUser?.uid || '(none)');
    return { app, auth };
  } catch (err) {
    console.error('[firebase] initialization failed:', err);
    throw err;
  }
})();

// ==== 環境判定ヘルパー ====
function _isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function _isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

// ==== 公開 API ====
const glFirebase = {
  ready: readyPromise,

  getCurrentUser() {
    return currentUser;
  },

  async signInWithGoogle() {
    await readyPromise;
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    // Standalone PWA (iOS) は Popup が動かないため必ず Redirect
    if (_isStandalone() && _isIOS()) {
      console.log('[firebase] using redirect (iOS standalone)');
      await signInWithRedirect(auth, provider);
      return null;
    }

    // それ以外は Popup を試す
    try {
      console.log('[firebase] trying popup');
      const result = await signInWithPopup(auth, provider);
      return result.user;
    } catch (err) {
      console.warn('[firebase] popup failed:', err.code, err.message);

      // Popup が動かない環境では Redirect にフォールバック
      const fallbackCodes = [
        'auth/popup-blocked',
        'auth/popup-closed-by-user',
        'auth/cancelled-popup-request',
        'auth/operation-not-supported-in-this-environment',
        'auth/web-storage-unsupported',
      ];

      if (fallbackCodes.indexOf(err.code) !== -1) {
        console.log('[firebase] falling back to redirect');
        await signInWithRedirect(auth, provider);
        return null;
      }

      throw err;
    }
  },

  async signOut() {
    await readyPromise;
    await fbSignOut(auth);
  },

  onAuthStateChanged(callback) {
    authStateCallbacks.add(callback);
    // 現在の状態を即座に通知
    try { callback(currentUser); } catch (e) { console.error(e); }
    return () => authStateCallbacks.delete(callback);
  },
};

window.glFirebase = glFirebase;

// レガシー同期コード向けに ready イベントも発火
readyPromise
  .then(() => {
    window.dispatchEvent(new CustomEvent('gl-firebase-ready', {
      detail: { user: currentUser },
    }));
  })
  .catch((err) => {
    window.dispatchEvent(new CustomEvent('gl-firebase-error', {
      detail: { error: err },
    }));
  });
