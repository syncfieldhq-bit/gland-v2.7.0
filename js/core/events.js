/**
 * G-LAND v2.7.0 - PubSub Event Bus
 * ================================
 * モジュール間通信の唯一の窓口。循環依存を回避するための疎結合基盤。
 *
 * 命名規則: 'カテゴリ:動作' (例: 'round:started', 'score:saved')
 *
 * 主要イベント一覧:
 *   'round:started'         - ラウンド開始成功
 *   'round:joined'          - 合流成功
 *   'round:member-updated'  - メンバー一覧更新
 *   'round:left'            - ラウンド離脱
 *   'score:saved'           - スコア保存成功
 *   'score:queued'          - スコアがキューに積まれた
 *   'score:flushed'         - キューが空になった
 *   'profile:updated'       - プロフィール更新
 *   'phase:changed'         - S0-S9 状態遷移
 *   'online:changed'        - オンライン/オフライン切替
 *   'ads:rotated'           - 広告スライド切替
 *   'gate:shown'            - install-gate 表示
 *   'gate:hidden'           - install-gate 非表示
 */
(function () {
  'use strict';

  const listeners = new Map(); // event => Set<callback>

  const glEvents = {
    /**
     * イベントを購読
     * @param {string} event
     * @param {Function} cb
     * @returns {Function} unsubscribe関数
     */
    on(event, cb) {
      if (typeof event !== 'string' || typeof cb !== 'function') return () => {};
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(cb);
      return () => this.off(event, cb);
    },

    /**
     * 一度だけ実行
     */
    once(event, cb) {
      const unsub = this.on(event, (data) => {
        unsub();
        cb(data);
      });
      return unsub;
    },

    /**
     * 購読解除
     */
    off(event, cb) {
      const set = listeners.get(event);
      if (set) set.delete(cb);
    },

    /**
     * イベント発火（同期）
     */
    emit(event, data) {
      const set = listeners.get(event);
      if (!set || set.size === 0) return;
      // Set のスナップショットを取ってから実行（コールバック内での購読変更に対応）
      Array.from(set).forEach((cb) => {
        try {
          cb(data);
        } catch (err) {
          console.error('[glEvents]', event, 'listener error:', err);
        }
      });
    },

    /**
     * 登録済みリスナー数（デバッグ用）
     */
    listenerCount(event) {
      const set = listeners.get(event);
      return set ? set.size : 0;
    },

    /**
     * 全リスナー削除（テスト用）
     */
    _clear() {
      listeners.clear();
    },
  };

  window.glEvents = glEvents;
})();
