/**
 * G-LAND v2.7.0 - Error Handling
 * ==============================
 * 全エラーをコード分類し、toast + 振動 + キュー投入で処理する。
 * alert() は絶対に使用しない。
 *
 * エラーコード:
 *   Layer 1 通信: N1(ネットワーク), N2(タイムアウト), N3(オフライン), N4(CORS), N5(不明), N6(SSL)
 *   Layer 2 API: A1(userId未発行), A2(roundId不明), A3(ROUND_FULL), A4(LOCK_FAILED),
 *                A5(ownerUserId required), A6(GAS未応答), A7(データ不整合), A8(認証失敗),
 *                A9(サーバー内部エラー), A10(未定義エンドポイント)
 *   Layer 3 UX: U1(プロフィール未登録), U2(重複合流), U3(ゲストuserIdタイムアウト),
 *               U4(コース未選択), U5(バリデーション)
 */
(function () {
  'use strict';

  const MESSAGES = {
    N1: '通信エラーが発生しました。電波状況をご確認ください',
    N2: 'サーバーの応答が遅れています。もう一度お試しください',
    N3: 'オフラインです。復帰後に自動で送信されます',
    N4: '通信設定エラーが発生しました',
    N5: '通信に問題が発生しました',
    N6: 'セキュリティ通信に問題があります',
    A1: 'ユーザー登録が完了していません。もう一度登録してください',
    A2: 'ラウンド情報が見つかりません',
    A3: 'このラウンドは満員です（最大4名）',
    A4: 'サーバー処理が混雑しています。数秒後にお試しください',
    A5: 'ユーザーIDが未発行です。再度お試しください',
    A6: 'サーバーに接続できません',
    A7: 'データに不整合があります',
    A8: '認証に失敗しました',
    A9: 'サーバー内部でエラーが発生しました',
    A10: 'この機能は現在利用できません',
    U1: 'プロフィール登録が必要です',
    U2: 'すでに合流済みです',
    U3: '登録処理がタイムアウトしました。もう一度お試しください',
    U4: 'コースを選択してください',
    U5: '入力内容をご確認ください',
  };

  // 通信系はリトライ可能・UX系は即座にユーザー通知
  const RETRIABLE = new Set(['N1', 'N2', 'N3', 'A4', 'A6', 'A9']);

  const glErrors = {
    codes: Object.keys(MESSAGES).reduce((acc, k) => {
      acc[k] = k;
      return acc;
    }, {}),

    /**
     * エラーを処理（toast表示 + 振動 + イベント発火）
     * @param {Error|string} err
     * @param {object} context - {retriable, queueOnFail, silent}
     */
    handle(err, context = {}) {
      const code = this._resolveCode(err);
      const msg = MESSAGES[code] || (typeof err === 'string' ? err : (err?.message || 'エラーが発生しました'));

      console.warn(`[glErrors] ${code}:`, err, context);

      // イベント発火（他モジュールが購読可能）
      if (window.glEvents) {
        window.glEvents.emit('error:occurred', { code, msg, retriable: RETRIABLE.has(code), context });
      }

      // silent モードでなければ toast 表示
      if (!context.silent && window.glToast) {
        if (RETRIABLE.has(code)) {
          window.glToast.warn(msg);
        } else {
          window.glToast.error(msg);
        }
      }

      return { code, msg, retriable: RETRIABLE.has(code) };
    },

    /**
     * エラーからコードを解決
     */
    _resolveCode(err) {
      if (!err) return 'N5';
      if (typeof err === 'string' && MESSAGES[err]) return err;
      if (err.code && MESSAGES[err.code]) return err.code;

      const msg = (err.message || String(err)).toLowerCase();
      if (msg.includes('timeout') || msg.includes('aborted')) return 'N2';
      if (msg.includes('network') || msg.includes('failed to fetch')) return 'N1';
      if (msg.includes('offline')) return 'N3';
      if (msg.includes('owneruserid')) return 'A5';
      if (msg.includes('userid')) return 'A1';
      if (msg.includes('roundid')) return 'A2';
      if (msg.includes('full')) return 'A3';
      if (msg.includes('lock')) return 'A4';
      return 'N5';
    },

    isRetriable(code) {
      return RETRIABLE.has(code);
    },

    getMessage(code) {
      return MESSAGES[code] || null;
    },
  };

  window.glErrors = glErrors;
})();
