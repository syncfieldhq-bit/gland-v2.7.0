/**
 * G-LAND v2.8.0 - Service Worker
 * ==============================
 * v2.8.0: Firebase Authentication (Google Sign-In) 導入
 *  - Firebase SDK モジュール (gstatic.com) は非キャッシュ
 *  - Google OAuth 通信 (googleapis.com, firebaseapp.com) は非キャッシュ
 *  - v2.8.0 新規ファイル: js/core/firebase.js, js/domain/auth.js, js/ui/auth.js
 */
const CACHE_VERSION = 'gland-v2.8.0-rev5';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './js/api.js',
  './js/boot.js',
  './js/core/events.js',
  './js/core/storage.js',
  './js/core/state.js',
  './js/core/net.js',
  './js/core/errors.js',
  './js/core/queue.js',
  './js/core/firebase.js',
  './js/domain/auth.js',
  './js/domain/profile.js',
  './js/domain/round.js',
  './js/domain/score.js',
  './js/domain/history.js',
  './js/domain/course.js',
  './js/domain/ads.js',
  './js/ui/_debugbar.js',
  './js/ui/toast.js',
  './js/ui/loading.js',
  './js/ui/auth.js',
  './js/ui/gate.js',
  './js/ui/onboarding.js',
  './js/ui/ads.js',
  './js/ui/home.js',
  './js/ui/round.js',
  './js/ui/score.js',
  './js/ui/score/_panel.js',
  './js/ui/score/simple.js',
  './js/ui/score/classic.js',
  './js/ui/history.js',
  './js/ui/mypage.js',
  './js/ui/course.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => {
        return Promise.all(
          CORE_ASSETS.map((url) =>
            cache.add(url).catch((err) => {
              console.warn('[SW] cache add failed:', url, err.message);
            })
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // GAS 通信は非キャッシュ
  if (url.hostname.includes('script.google.com')) return;

  // Firebase SDK (gstatic) は非キャッシュ（常に最新取得）
  if (url.hostname.includes('gstatic.com')) return;

  // Firebase Auth / API 通信は非キャッシュ
  if (url.hostname.includes('firebaseapp.com')) return;
  if (url.hostname.includes('googleapis.com')) return;
  if (url.hostname.includes('identitytoolkit')) return;

  // GET のみキャッシュ対象
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
