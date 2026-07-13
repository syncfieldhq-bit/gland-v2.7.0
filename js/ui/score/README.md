# Score Panel Architecture (v2.7.10~)

## 📐 設計思想

**入力パネルの表示制御を共通モジュール `_panel.js` に一元化**し、
各テーマ（Classic / Simple / Counter 等）は「中身の HTML」と「イベントハンドラ」だけを担当する。

これにより：
- ✅ 表示/非表示の挙動がテーマごとにブレない
- ✅ iOS/Android の CSS 差異バグが1箇所で解決できる
- ✅ 新テーマ追加時に「パネルの動きを実装する」必要がない
- ✅ アニメーション競合による「途中で止まる」バグを根絶

## 📂 ファイル構成

```
js/ui/score/
├── _panel.js       ← 共通パネルモジュール（glScorePanel）
├── classic.js      ← Classic テーマ（本モジュールを利用）
├── simple.js       ← Simple テーマ（今後 _panel.js に移行予定）
└── counter.js      ← 未実装（今後追加時は必ず _panel.js を利用）
```

## 🎯 共通モジュール API

### `glScorePanel.open({ content, onBind, onClose })`
パネルを開く。
- `content` (string): パネル内部の HTML
- `onBind` (function): レンダ後に呼ばれる (panelEl を受け取る)
- `onClose` (function): 閉じられたときに呼ばれる（背景タップ or close()）

### `glScorePanel.rerender(content, onBind)`
パネルを開いたまま中身だけ差し替える（プレイヤー切替時など）。

### `glScorePanel.close()`
パネルを閉じる。`onClose` コールバックが実行される。

### `glScorePanel.isOpen()`
現在開いているかを返す。

## 📋 各テーマの責務

| 責務 | 共通モジュール | テーマ側 |
|------|:-------------:|:-------:|
| DOM 生成/破棄 | ✅ | |
| 表示/非表示 | ✅ | |
| 背景オーバーレイ | ✅ | |
| 内部 HTML | | ✅ |
| ボタンイベント | | ✅ |
| セッション管理 | | ✅ |
| データ保存 | | ✅ |

## 🚫 やってはいけないこと

- ❌ 各テーマで独自の `position: fixed` パネルを作らない
- ❌ 各テーマで `transform: translateY(...)` を使ったスライドアニメを実装しない
- ❌ 共通モジュール内に「テーマ固有のロジック」を書かない

## ✅ 新テーマ追加時のチェックリスト

1. `js/ui/score/{theme_name}.js` を新規作成
2. パネル表示は必ず `window.glScorePanel.open({...})` を使う
3. 内部 HTML は独自クラス名（例: `.gl-{theme}-panel-key`）でスタイリング
4. `index.html` に `<script src="js/ui/score/{theme_name}.js">` を追加
5. `sw.js` の CACHE_ASSETS にファイルパスを追加
6. `score.js`（テーマローダー）で切替可能にする
