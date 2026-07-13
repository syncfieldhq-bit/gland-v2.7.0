/**
 * G-LAND v2.8.0 - Firebase Core Module
 * ====================================
 * Firebase SDK (v12.16.0) の初期化を行う ES Module。
 * type="module" で読み込まれ、window.glFirebase を公開する。
 *
 * 提供API (window.glFirebase):
 *   - ready: Promise<{ app, auth }>  ← SDK 初期化完了を待つ
 *   - signInWithGoogle(): Promise<user>
 *   - signOut(): Promise<void>
 *   - onAuthStateChanged(callback): unsubscribe
 *   - getCurrentUser(): user|null
 */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import {
  getAuth,
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

// ==== 初期化 ====
let app = null;
let auth = null;
let currentUser = null;
const authStateCallbacks = new Set();

const readyPromise = (async () => {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    auth.languageCode = 'ja';

    // 初期認証状態を確定させる
    await new Promise((resolve) => {
      const unsub = fbOnAuthStateChanged(auth, (user) => {
        currentUser = user;
        unsub();
        resolve();
      });
    });

    // Redirect フローの結果を回収（iPhone Safari など Popup 不可端末対策）
    try {
      const result = await getRedirectResult(auth);
      if (result && result.user) {
        currentUser = result.user;
      }
    } catch (err) {
      console.warn('[firebase] getRedirectResult error:', err);
    }

    // 認証状態変化を購読
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

    // iOS Safari (standalone PWA) は Popup が動かないため Redirect
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    if (isStandalone && isIOS) {
      // Redirect フロー（戻ってきた時に getRedirectResult で受け取る）
      await signInWithRedirect(auth, provider);
      return null; // ページ遷移するので実質ここには戻らない
    }

    try {
      const result = await signInWithPopup(auth, provider);
      return result.user;
    } catch (err) {
      // Popup が失敗したら Redirect にフォールバック
      if (
        err.code === 'auth/popup-blocked' ||
        err.code === 'auth/popup-closed-by-user' ||
        err.code === 'auth/cancelled-popup-request' ||
        err.code === 'auth/operation-not-supported-in-this-environment'
      ) {
        console.warn('[firebase] popup failed, fallback to redirect:', err.code);
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
