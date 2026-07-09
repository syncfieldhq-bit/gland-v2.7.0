# G-LAND v2.7.0 — 完全実装パッケージ

ゴルフスコア共有 PWA アプリ（モジュール化リアーキテクチャ完成版）

---

## 📁 ディレクトリ構成

```
gland-v2.7.0/
├── README.md                 (本ファイル)
├── index.html                (DOM骨格 + script読込)
├── sw.js                     (Service Worker / CACHE_VERSION='gland-v2.7.0')
│
├── gas/                      (Google Apps Script 用)
│   ├── main.gs               (doPost + initSetup + LockService)
│   ├── schema.gs             (SCHEMA定義 + _colIdx ヘルパー)
│   ├── api.gs                (全16アクションハンドラ)
│   └── db.gs                 (シートI/O層)
│
└── js/                       (フロントエンド JS モジュール)
    ├── api.js                (GAS通信の唯一の窓口)
    ├── boot.js               (起動シーケンス + フォールバックUI)
    │
    ├── core/                 (Layer 2: 基盤層)
    │   ├── events.js         (PubSub基盤)
    │   ├── storage.js        (三重ストレージ / iOS Safari対策)
    │   ├── state.js          (中央状態管理)
    │   ├── net.js            (タイムアウトfetch + オンライン監視)
    │   ├── errors.js         (N1-N6 / A1-A10 / U1-U5)
    │   └── queue.js          (永続化リトライキュー / 指数バックオフ)
    │
    ├── domain/               (Layer 3: ビジネスロジック)
    │   ├── profile.js        (楽観的UI プロフィール)
    │   ├── round.js          (ラウンド開始/合流/離脱)
    │   ├── score.js          (楽観的UIスコア入力 / 15秒ポーリング)
    │   ├── history.js        (起動時同期 + キャッシュ)
    │   ├── course.js         (マイコース + 検索 + 依頼)
    │   └── ads.js            (広告MVP + Stripe拡張基盤)
    │
    └── ui/                   (Layer 4: 表示・コントローラー)
        ├── toast.js          (alert代替 / オフラインバッジ)
        ├── gate.js           (install-gate / 端末別UX)
        ├── onboarding.js     (2項目登録 / ?join= 強制表示)
        ├── ads.js            (5秒自動カルーセル / 4枚ローテ)
        ├── home.js           (2x2メニュー + 広告特等席)
        ├── round.js          (ラウンド開始/合流/招待QR+A123)
        ├── score.js          (スコア入力 / 横向き広告マージン)
        ├── history.js        (履歴一覧)
        ├── mypage.js         (プロフィール編集 + バージョン表示)
        └── course.js         (マイコース/検索/運営依頼)
```

**総ファイル数**: 26（フロント22 + GAS 4）

---

## 🚀 デプロイ手順

### 1️⃣ GAS バックエンド

1. Google スプレッドシートを新規作成
2. 拡張機能 → Apps Script
3. `gas/` 配下の 4ファイルをそれぞれコピペで作成:
   - `schema.gs`
   - `main.gs`
   - `api.gs`
   - `db.gs`
4. **プロジェクトの設定 → スクリプトプロパティ**
   - `ADMIN_EMAIL` = 管理者メールアドレス（コース追加依頼の通知先）
5. **`initSetup()` を1回実行** ← 10シートが自動生成される
6. デプロイ → 新しいデプロイ → ウェブアプリ
   - 実行するユーザー: 自分
   - アクセス権限: 全員
7. デプロイ URL をコピー（`https://script.google.com/macros/s/xxxxx/exec`）

### 2️⃣ フロントエンド

1. GitHub リポジトリにファイル一式を配置
2. **`index.html` の `window.GLAND_GAS_URL = '';` に GAS URL を貼付**
   ```javascript
   window.GLAND_GAS_URL = 'https://script.google.com/macros/s/xxxxx/exec';
   ```
3. `manifest.json` と `icons/icon-192.png` を配置（PWA用）
4. GitHub Pages で公開
5. iPhone/Android で PWA インストール

---

## ✅ 動作確認チェックリスト

- [ ] `initSetup()` 実行後、10シート (Users/Rounds/RoundMembers/PlayerScores/Courses/MyCourses/CourseRequests/Ads/AdImpressions/AdClicks) が生成される
- [ ] ホーム画面: 2x2 メニュー + 下半分に広告カルーセル
- [ ] 広告が5秒毎に自動スライド
- [ ] ラウンド開始 → 招待 QR + A123形式コード表示
- [ ] 別端末で ?join= リンクを開く → 苗字2項目登録 → 自動合流
- [ ] スコア入力 → 即UI反映（楽観的UI）
- [ ] オフライン → キューに積まれる（gl_score_queue_v1）
- [ ] オンライン復帰 → 自動送信
- [ ] 横向き回転 → スコア表下部に広告バナー
- [ ] マイページ最下部: `v2.7.0 (build: 20260709)` 表示
- [ ] エラー時: トースト + 振動（音なし）

---

## 🎯 アーキテクチャ原則

1. **5層レイヤー構造** — External / Infrastructure / Domain / UI / Bootstrap
2. **PubSub 疎結合** — 全モジュール間通信は `glEvents` 経由（循環依存禁止）
3. **楽観的UI** — スコア入力は state 即反映 → キュー永続化 → 非同期API
4. **三重ストレージ** — localStorage + Cookie + sessionStorage（iOS Safari対策）
5. **alert 完全撲滅** — toast + 振動で代替、音は絶対に鳴らさない
6. **スキーマ自動生成** — GAS 側 `initSetup()` で全シート・全列を冪等生成
7. **DOM 骨格のみ** — index.html は script 読込のみ、機能は全て JS モジュール

---

## 🔮 将来の拡張ポイント

- **S7b 完全実装** — ラウンド保存モーダル内アコーディオン式プロフィール補完
- **AdImpressions/AdClicks GAS 記録** — 広告効果測定
- **Stripe 連携** — `ads-bidding.js` を後付けで bidAmount 有料化
- **Firebase 移行** — 15秒ポーリングから数百msリアルタイム同期へ
- **G シリーズ連携** — G Town / G Pro で userId・profile 共有

---

**Version**: v2.7.0 (build: 20260709)  
**Status**: FIX — 実機テストフェーズ  
**Repository**: https://github.com/syncfieldhq-bit/gland-v1.0.0
