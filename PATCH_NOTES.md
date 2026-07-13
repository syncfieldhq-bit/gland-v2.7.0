# G-LAND v2.7.3 パッチノート

## 🐛 修正内容

### 1. 入力パネルが画面下からニョキっとしか出ない問題
**症状**: iPhone / Android 両方で、スコアセルをタップしても入力モーダルが下から少ししか覗かず、上に上がってこない。

**原因**: `requestAnimationFrame` 1回だけでは、iOS Safari で「初期状態 `translateY(100%)` のレンダリング」と「`.show` クラスによる `translateY(0)` への遷移」が同一フレーム内で処理されてしまい、CSSトランジションが発火しない。

**修正** (`js/ui/score/classic.js`):
- `requestAnimationFrame` を二重ネストして、初期状態レンダリング → 次フレームで `.show` を確実に付与
- `void panel.offsetHeight` で強制リフローを挟む
- 初期状態の `transform` をインラインスタイルで明示（CSS未適用対策）
- `will-change: transform` / `-webkit-transform` / `-webkit-transition` を追加（iOS対応）
- **フェイルセーフ**: 400ms経ってもパネルが画面外なら強制的に表示する

### 2. QRコードからの合流でサーバーエラー
**症状**: 招待コード（4桁）で合流は成功するが、QRコード読取で合流するとサーバーエラーモーダルが出る。

**原因**: QRコードのURLに `roundId`（R-xxxx形式）を埋め込んでいたが、`join()` メソッドは `groupCode`（4桁 A123形式）を要求していたため、パラメータ不整合でサーバー側が `groupCode required` エラーを返していた。

**修正**:
- `js/ui/round.js`: QRのURLを `?join=<groupCode>` に変更（4桁コードで統一）
- `js/boot.js`: `?join=` パラメータ検出時に、プロファイル登録済みなら **自動合流** を実行。完了後URLパラメータを除去して履歴を汚さない。失敗時はトースト表示。

## 📋 変更ファイル一覧

| ファイル | 変更内容 |
|---|---|
| `js/ui/score/classic.js` | 入力パネル表示ロジック修正 |
| `js/ui/round.js` | QR URLを groupCode 埋め込みに変更 |
| `js/boot.js` | ?join= 自動合流処理を追加 |
| `sw.js` | CACHE_VERSION → gland-v2.7.3 |

## 🚀 デプロイ手順

1. ZIPを展開してリポジトリに上書き
2. GitHub Pages 反映を待つ（1〜2分）
3. **必ずキャッシュクリア**（下記コマンドをPCの DevTools コンソールで実行、または Safari設定からキャッシュクリア）

```javascript
caches.keys().then(k => Promise.all(k.map(x => caches.delete(x))));
navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()));
localStorage.clear();
location.reload();
```

## ✅ 検証手順

### 入力パネル
1. ラウンド開始 → スコアカードを開く
2. 任意のセルをタップ
3. **入力パネルが下からスムーズに全表示される**ことを確認（画面下端で止まらない）

### QRコード合流
1. 端末Aでラウンド開始 → 招待モーダルを開く → QR表示
2. 端末BでQRを読み取る（カメラアプリ等）
3. ブラウザが開き、**自動的に合流成功のトーストが表示**される
4. URLから `?join=xxxx` が消えている
5. 端末Bのホーム画面でラウンドに参加した状態になっている
