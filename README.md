# G-LAND v3.0.0 — 世界標準構造リファクタ版

ゴルフスコア共有 PWA アプリ
**v3.0.0**: CSS 完全分離 + モーダル共通基盤化 + iOS Safari PWA 位置ズレ根本解決

本番URL: https://gland-golf.web.app

---

## 🎯 v3.0.0 でやったこと（1文）

v2.7.0 の全機能・全動作・全見た目を 100% 維持したまま、CSS を 5 レイヤーに分離し、
全モーダルを共通基盤 `glModal.open()` に統一し、iOS Safari PWA の位置ズレを根本解決した。

**機能追加ゼロ・機能削除ゼロ・仕様変更ゼロ・見た目維持（位置ズレのみ修正）**

---

## 📁 ディレクトリ構成

```
gland-v3.0.0/
├── README.md                        (このファイル)
├── PATCH_NOTES.md                   (v3.0.0 変更点詳細)
│
├── index.html                       (<style> 完全撤去、CSS を <link> で 5 本読込)
├── 404.html                         (無変更)
├── manifest.json                    (無変更)
├── firebase.json                    (無変更)
├── sw.js                            (CACHE_VERSION 更新 + 新規6ファイル追加のみ)
├── .firebaserc                      (無変更)
├── .gitignore                       (無変更)
├── .nojekyll                        (無変更)
│
├── css/                             ★ v3.0.0 新規
│   ├── base.css                     (リセット、safe-area 変数、view padding 権威定義)
│   ├── components.css               (toast, ads, gate, auth, form, spinner, pwa-guide)
│   ├── modal.css                    (glModal 基盤 + 全モーダル固有スタイル)
│   ├── screens.css                  (各 view と Classic テーマ画面)
│   └── utilities.css                (固定 style="..." 属性を移管した gl-u-NN クラス)
│
├── icons/                           (無変更)
│   ├── icon-192.png
│   └── icon-512.png
│
├── gas/                             (無変更・GAS スクリプト)
│   ├── main.gs                      (doPost/doGet エントリ + LockService)
│   ├── api.gs                       (アクションディスパッチテーブル)
│   ├── schema.gs                    (シート定義)
│   └── db.gs                        (シート I/O)
│
└── js/
    ├── api.js                       (無変更)
    ├── boot.js                      (無変更)
    │
    ├── core/
    │   ├── modal.js                 ★ v3.0.0 新規 (glModal 共通基盤)
    │   ├── events.js                (無変更)
    │   ├── storage.js               (無変更)
    │   ├── state.js                 (無変更)
    │   ├── net.js                   (無変更)
    │   ├── errors.js                (無変更)
    │   ├── queue.js                 (無変更)
    │   └── firebase.js              (無変更)
    │
    ├── domain/                      (全ファイル無変更)
    │   ├── profile.js / round.js / score.js / history.js
    │   ├── course.js / ads.js / auth.js
    │
    └── ui/                          (_injectStyles を no-op 化、モーダル生成を glModal.open へ)
        ├── toast.js                 (_injectStyles no-op 化のみ)
        ├── gate.js                  (_injectStyles no-op 化のみ)
        ├── auth.js                  (_injectStyles no-op 化のみ)
        ├── ads.js                   (_injectStyles no-op 化のみ)
        ├── onboarding.js            (glModal 移行: 初回プロフィール登録)
        ├── home.js                  (glModal 移行: 配布用QR)
        ├── round.js                 (glModal 移行: 汎用/招待/代理/スタート選択/離脱等)
        ├── mypage.js                (glModal 移行: プロフィール編集)
        ├── history.js               (glModal 移行: BEST 更新演出)
        ├── course.js                (glModal 移行: マイコース/検索/新規作成/依頼)
        ├── _debugbar.js             (対象外・現行仕様維持)
        ├── pwa-guide.js             (対象外・現行仕様維持)
        └── score/
            ├── _panel.js            (_injectStyles no-op 化のみ)
            ├── simple.js            (_injectStyles no-op 化のみ)
            ├── classic.js           (glModal 移行: ふりがな/代理編集/午後/ロッカー/LINE/保存前確認)
            ├── score.js は js/ui/ 直下
            └── README.md            (score テーマ設計思想・v2.7.10 のまま無変更)
```

---

## 🎨 CSS 5 レイヤー構成の設計思想

CSS 読込順は以下で固定（`index.html` で `<link>` の順序として反映済み）：

```
base.css        ← リセット・変数・safe-area・view padding 権威定義
  ↓
components.css  ← 共通コンポーネント（toast, form primitives, ボタン, spinner ...）
  ↓
modal.css       ← モーダル基盤 + 各モーダル固有クラス
  ↓
screens.css     ← 各 view の画面レイアウトと Classic テーマ全 CSS
  ↓
utilities.css   ← 固定インライン style を移管したユーティリティクラス群
```

この順序でセレクタ優先度と cascade が成立するため、旧 `!important` は全廃した。

---

## 🧩 モーダル共通基盤 (`glModal`) の使い方

```javascript
const handle = window.glModal.open({
  title: '📤 招待',                     // 省略可
  body: '<div>...</div>',                // 文字列 or HTMLElement
  modalType: 'invite',                   // data-modal-type 属性
  variant: '',                           // 'cls' / 'best' / 'distqr' 等
  showClose: false,                      // × ボタン表示
  dismissible: true,                     // 背景クリック / Esc で閉じるか
  onBind:  (root, handle) => {...},      // レンダ完了後
  onClose: () => {...},                  // 閉じた後
});

handle.close();                          // プログラムから閉じる
handle.rerender(newBody);                // 中身を差し替え（部分更新）
handle.root;                             // モーダル要素（内部の querySelector 用）
```

---

## 🚀 デプロイ手順（v2.7.0 → v3.0.0）

1. 既存の `gland-v2.7.0` ディレクトリはそのまま置いておく（rollback 用）
2. ZIP を展開: `~/Desktop/gland-v3.0.0/`
3. Firebase Hosting へデプロイ:
   ```bash
   cd ~/Desktop/gland-v3.0.0
   firebase deploy --only hosting
   ```
4. iPhone / Android で PWA を再起動（Service Worker が旧キャッシュを自動削除）

Service Worker の `CACHE_VERSION` が `'gland-v3.0.0-css-modal-split'` に上がっているため、
古い CSS/JS はブラウザキャッシュから自動的にパージされる。

もし手動でクリアしたい場合：
```javascript
caches.keys().then(k => Promise.all(k.map(x => caches.delete(x))));
navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()));
location.reload();
```

---

## ✅ 動作確認チェックリスト

### CSS 分離の健全性
- [ ] iPhone Safari PWA でホーム画面から起動 → 上マージンが適正（ノッチと重ならず、過剰余白なし）
- [ ] 履歴画面の上マージンが適正
- [ ] マイページの上マージンが適正
- [ ] Chrome (PC) / Android Chrome / iOS 通常 Safari で見た目が v2.7.0 と一致

### モーダル動作（17 箇所）
- [ ] オンボーディング（未登録初回起動）: 苗字・ひらがな 2 項目登録 → home 遷移
- [ ] ホーム: 「配布用QR」タップ → QR 表示 → URL コピー → 閉じる
- [ ] ラウンド: 「新しいラウンドを開始」→ コース選択 → スタート選択 → 最終確認 → 開始
- [ ] ラウンド: 「招待コードで合流」→ 4桁コード入力 → 合流
- [ ] ラウンド: 「招待」→ QR + 4桁コード表示 → 閉じる
- [ ] ラウンド: 「代理入力プレイヤー」→ 追加・削除（部分更新で閉じずに連続追加）
- [ ] ラウンド: 「ラウンドを終了」→ 終了確認
- [ ] マイページ: 「プロフィールを編集」→ 保存
- [ ] 履歴: BEST 更新時の 🏆 モーダル
- [ ] コース: マイコース / 検索 / 新規作成 / 運営依頼
- [ ] スコア (Classic): 共有プレイヤー名タップ → ふりがな表示
- [ ] スコア (Classic): 代理プレイヤー名タップ → 編集モーダル
- [ ] スコア (Classic): ⏰ アイコン → 午後スタート時刻 wheel picker
- [ ] スコア (Classic): 🔑 アイコン → ロッカー番号
- [ ] スコア (Classic): LINE 共有ボタン → シンプル/詳細選択
- [ ] スコア (Classic): 「保存する」→ 保存前確認モーダル → 保存

### 全モーダル共通確認
- [ ] 背景クリックで閉じる（onboarding のみ閉じない）
- [ ] Esc で閉じる（dismissible: true のもの）
- [ ] iOS Safari PWA でモーダルが実表示エリア基準で中央配置される
- [ ] モーダル open 中は body scroll がロックされる

### データ整合性
- [ ] GAS 通信が全アクションで成功（既存エンドポイントに一切変更なし）
- [ ] Firebase 認証（Google ログイン）
- [ ] ラウンド開始 → スコア入力 → 保存 → 履歴反映
- [ ] オフライン → オンライン復帰時のキュー自動 flush

---

## 🚫 v3.0.0 で "触っていない" もの

- `gas/*.gs` (4 ファイル)
- `firebase.json` / `.firebaserc` / `manifest.json` / `404.html`
- `js/api.js` / `js/boot.js`
- `js/core/*.js` の従来 7 ファイル（modal.js のみ新規）
- `js/domain/*.js` (7 ファイル全て)
- 見た目 (色・フォント・サイズ・余白・レイアウト — 位置ズレの根本修正だけ)

---

## 📞 サポート

問題が発生した場合は、この README と `PATCH_NOTES.md` を確認のうえ、
デプロイ前の `gland-v2.7.0` に rollback してください。
