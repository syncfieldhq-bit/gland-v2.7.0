# G-LAND v3.0.0 — Patch Notes

**リリース日**: 2026-07-22
**種別**: リファクタリリース（機能追加ゼロ・機能削除ゼロ・仕様変更ゼロ）
**前バージョン**: v2.7.0 (実体は v2.8.35 相当の累積 patch を含む)

---

## 🎯 このリリースの目的

v2.7.0 で分散していた CSS と個別モーダル実装を、世界標準の構造にリファクタする。
既存の機能・動作・見た目・外部 API・データ構造は 100% 維持しつつ、
iOS Safari PWA で発生していた「モーダル・履歴・マイページの位置ズレ」を根本解決する。

## ✅ 変更点（構造リファクタのみ）

### 1. CSS の完全分離（5 レイヤー化）

- 従来: `index.html` 内 `<style>` (5,589 文字) + 各 `js/ui/*.js` の `_injectStyles()` (計 12 箇所)
- v3.0.0: `css/` 配下の 5 レイヤーに集約

| レイヤー | ファイル | 役割 |
|---|---|---|
| 1 | `css/base.css` | リセット / フォント / safe-area 変数 / view padding の単一権威定義 |
| 2 | `css/components.css` | toast / ads / gate / auth / form / spinner / pwa-guide |
| 3 | `css/modal.css` | glModal 基盤 + 全モーダル固有スタイル |
| 4 | `css/screens.css` | #view-home / view-golf / view-score / view-history / view-mypage / Classic テーマ |
| 5 | `css/utilities.css` | 固定インライン `style="..."` 属性 120 件を移管したユーティリティクラス（`.gl-u-01` 〜 `.gl-u-98`） |

`index.html` 内の `<style>` は完全撤去（実 `<style>` タグ 0 件）。
各 `js/ui/*.js` の `_injectStyles()` は互換維持のため関数シグネチャは残置しつつ、
本体を no-op 化した（呼出しても例外なし）。

### 2. モーダル共通基盤の導入

- 新規: `js/core/modal.js` (`window.glModal`)
- 既存 17 箇所のモーダル生成を `glModal.open()` に統一
  - 生成・overlay・スクロール制御・z-index・配置・Esc/背景クリック閉じる を一元管理
  - モーダル固有の内容・ボタン・イベント・保存処理・閉じる処理は 100% 現行維持
- 対象外（現行仕様維持）: toast / offline badge / install-gate / auth 全画面 / glScorePanel bottom-sheet / pwa-guide / debugbar / browser 標準 `confirm()`

### 3. iOS Safari PWA 位置ズレ根本解決

- 原因: `index.html` の `!important` 付き view padding と、各 JS の `_injectStyles()` が二重定義していた CSS ルールが衝突
- 対策:
  - `css/base.css` に `--gl-safe-top` / `--gl-safe-bottom` 変数を定義し、view padding を単一箇所で権威指定
  - `!important` を全廃
  - `.gl-modal` の高さ制御を `100vh` から `85dvh` に変更し、実表示エリア基準で中央配置
  - JS 側の `_injectStyles()` を全撤去したため優先度戦争が自然消滅

### 4. Service Worker キャッシュ更新

- `CACHE_VERSION` を `'gland-v3.0.0-css-modal-split'` に変更（旧キャッシュを activate 時に自動削除）
- CORE_ASSETS に以下の 6 ファイルを個別列挙で追加:
  - `./css/base.css`
  - `./css/components.css`
  - `./css/modal.css`
  - `./css/screens.css`
  - `./css/utilities.css`
  - `./js/core/modal.js`
- 既存エントリの順序・記法（`./` 相対）は完全踏襲、削除・変更なし

## 🚫 変更していないもの

- 全機能・全動作・全外部 API・全 GAS エンドポイント
- 全 GAS スクリプト (`gas/main.gs` / `api.gs` / `schema.gs` / `db.gs`)
- Firebase 設定 / 認証フロー / データ構造
- HTML 構造・DOM 階層・data 属性・イベント接続
- 既存 JS の関数シグネチャ（`_injectStyles()` すら残置）
- `manifest.json` / `firebase.json` / `.firebaserc` / `.gitignore` / `.nojekyll` / `404.html`
- icons / GAS ディレクトリ
- 見た目（色・フォント・サイズ・余白・レイアウト）※iOS Safari PWA 位置ズレのみ根本修正

## 📊 変更のサマリ（数値）

| 項目 | 変更前 | 変更後 |
|---|---|---|
| `_injectStyles()` 内 CSS ブロック | 12 箇所 | 0 箇所（全て no-op 化） |
| `index.html` `<style>` タグ | 1 個 | 0 個 |
| 固定インライン `style="..."` | 120 件 | 0 件（`.gl-u-NN` に移管） |
| 動的インライン `style="..."` | 13 件 | 13 件（削減不可・動的必須） |
| `style.textContent` | 12 箇所 | 0 箇所 |
| `document.head.appendChild(style)` | 12 箇所 | 0 箇所 |
| モーダル生成コードの重複 | 各 UI で個別実装 | `glModal.open()` に統一 (17 箇所) |
| CSS ファイル | 0 個 | 5 個（合計 80 KB） |
| 新規追加ファイル | — | 6 個のみ（CSS 5 + `js/core/modal.js`） |
| 削除された既存ファイル | — | 0 個 |
