// PWA未起動時に「ホーム画面に追加」を強制するモーダル
// v2.8.21.1: iOS Safari のみ表示、Android等は対象外
(function() {
  // ★ iOS判定: iPhone / iPad / iPod のみ対象
  const isIOS = 
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPad Pro等、iPadOS 13+ ではMacと同じUA になるので追加判定
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  
  if (!isIOS) return; // iOS以外は何もしない (Android/PC/etc.)

  // PWA起動判定
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  if (isStandalone) return; // PWA起動時は表示しない

  // モーダルHTMLを既存の .gl-modal 構造で生成
  const modalRoot = document.getElementById('modal-root') || document.body;
  const wrapper = document.createElement('div');
  wrapper.className = 'gl-modal gl-modal--pwa-guide gl-modal-show';

  // ★ 既存CSSに依存せず、確実に全画面表示させる
  Object.assign(wrapper.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100vw',
    height: '100vh',
    zIndex: '99999',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0, 0, 0, 0.6)'
  });

  wrapper.innerHTML = `
    <div class="gl-modal__body gl-u-59">
      <h2 class="gl-u-60">
        📱 ホーム画面に追加してください
      </h2>
      <p class="gl-u-61">
        G-LAND は<strong>ホーム画面アイコンから</strong>起動する必要があります。
      </p>
      <h3 class="gl-u-62">手順</h3>
      <p class="gl-u-63">
        1️⃣ Safari下部の <strong>共有ボタン(⬆️)</strong> をタップ<br>
        2️⃣ 「<strong>ホーム画面に追加</strong>」を選択<br>
        3️⃣ ホーム画面の <strong>G-LANDアイコン</strong> から起動
      </p>
      <p class="gl-u-64">
        ※ ホーム画面から起動しないと、登録が2回必要になります。<br>
        ※ この画面は閉じられません。
      </p>
    </div>
  `;

  // #modal-root に追加(なければ body に)
  if (modalRoot.id === 'modal-root') {
    modalRoot.appendChild(wrapper);
  } else {
    document.body.appendChild(wrapper);
  }
})();
