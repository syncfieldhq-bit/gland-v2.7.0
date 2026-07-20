// PWA未起動時に「ホーム画面に追加」を強制するモーダル
(function() {
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  if (isStandalone) return; // PWA起動時は表示しない

  // モーダルHTMLを既存の .gl-modal 構造で生成
  const modalRoot = document.getElementById('modal-root') || document.body;
  const wrapper = document.createElement('div');
  wrapper.className = 'gl-modal gl-modal--pwa-guide gl-modal-show';
  wrapper.style.zIndex = '99999'; // 最前面
  wrapper.innerHTML = `
    <div class="gl-modal__backdrop"></div>
    <div class="gl-modal__body">
      <h2 class="gl-modal__title">📱 ホーム画面に追加してください</h2>
      <p>G-LAND は<strong>ホーム画面アイコンから</strong>起動する必要があります。</p>
      <h3>手順</h3>
      <p>
        1️⃣ Safari下部の <strong>共有ボタン（⬆️）</strong> をタップ<br>
        2️⃣ 「<strong>ホーム画面に追加</strong>」を選択<br>
        3️⃣ ホーム画面に追加された <strong>G-LANDアイコン</strong> から起動
      </p>
      <p style="color:#d32f2f; font-size:13px; margin-top:12px;">
        ※ ホーム画面から起動しないと、登録が2回必要になります。<br>
        ※ この画面は閉じられません。
      </p>
    </div>
  `;

  // #modal-root に追加（なければ body に）
  if (modalRoot.id === 'modal-root') {
    modalRoot.appendChild(wrapper);
  } else {
    document.body.appendChild(wrapper);
  }
})();
