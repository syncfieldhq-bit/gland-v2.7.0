/**
 * G-LAND v3.0.0 - Service Worker
 * ==============================
 * Cache-first with network fallback.
 * v3.0.0: CSS 4 レイヤー分離 + モーダル共通基盤 (glModal) 導入。
 *
 * 【v3.0.0 での sw.js 変更点】
 * 1. CACHE_VERSION を 'gland-v3.0.0-css-modal-split' に更新
 *    → 旧キャッシュ ('gland-v2.8.35-modal-safe-area' 等) を activate 時に自動削除
 *    → 旧 SW が古い index.html + JS の _injectStyles() を返し続けて
 *      v3.0.0 の CSS 分離結果と競合するのを防ぐため
 * 2. CORE_ASSETS に v3.0.0 で新規追加される静的ファイルを個別列挙で追加:
 *      './css/base.css'
 *      './css/components.css'
 *      './css/modal.css'
 *      './css/screens.css'
 *      './js/core/modal.js'
 *    → 追加のみ。既存エントリの削除・順序変更は一切しない。
 *    → ワイルドカード表記は使用しない（既存記法完全踏襲）。
 * 3. その他（fetch 分岐、install/activate 挙動、GAS 除外、GET 限定など）は
 *    一切変更なし。既存の潜在的な事情（js/ui/course.js を CORE_ASSETS に含めない等）は
 *    現状維持（機能後退防止のため触らない）。
 */
const CACHE_VERSION = 'gland-v3.0.0-css-modal-split';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  // ---- v3.0.0 追加: CSS 4 レイヤー -------------------------------------
  './css/base.css',
  './css/components.css',
  './css/modal.css',
  './css/screens.css',
  './css/utilities.css',
  // ---- 既存 JS（順序完全維持） ---------------------------------------
  './js/api.js',
  './js/boot.js',
  './js/core/events.js',
  './js/core/storage.js',
  './js/core/state.js',
  './js/core/net.js',
  './js/core/errors.js',
  './js/core/queue.js',
  './js/core/firebase.js',
  // ---- v3.0.0 追加: モーダル共通基盤 ----------------------------------
  './js/core/modal.js',
  // ---- 既存 domain/ui（順序完全維持） --------------------------------
  './js/domain/profile.js',
  './js/domain/round.js',
  './js/domain/score.js',
  './js/domain/history.js',
  './js/domain/course.js',
  './js/domain/ads.js',
  './js/domain/auth.js',
  './js/ui/_debugbar.js',
  './js/ui/toast.js',
  './js/ui/gate.js',
  './js/ui/auth.js',
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
        // 個別追加でエラー耐性確保
        // icon-512.png が未配置の環境でも他のアセットは正しくキャッシュされる
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

  // GAS通信はキャッシュしない
  if (url.hostname.includes('script.google.com')) return;

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
