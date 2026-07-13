/**
 * G-LAND v2.7.0 - Ads Domain (マネタイズ基盤)
 * ===========================================
 * MVP: 管理者手動運用（GAS Adsシート）
 * 将来: bidAmount順ソート + Stripe決済連携（ads-bidding.js を後付け）
 *
 * カルーセル4枚: Local(2枚) / National(1枚) / Recruit(1枚) の推奨配分
 * 5秒自動スライド、タップでリンク遷移
 */
(function () {
  'use strict';

  const CACHE_KEY_PREFIX = 'gl_ads_cache_';
  const CACHE_TTL_MS = 10 * 60 * 1000; // 10分
  const ROTATION_SIZE = 4;

  function _cacheKey(slot) {
    return CACHE_KEY_PREFIX + slot;
  }

  function _readCache(slot) {
    const raw = window.glStorage.readLocalJSON(_cacheKey(slot));
    if (!raw || !raw.ts || !raw.ads) return null;
    if (Date.now() - raw.ts > CACHE_TTL_MS) return null;
    return raw.ads;
  }

  function _writeCache(slot, ads) {
    window.glStorage.writeLocal(_cacheKey(slot), { ts: Date.now(), ads });
  }

  /**
   * ローテーション用に4枚を選出
   * bidAmount 降順 → priority 降順 → 表示配分（Local:National:Recruit = 2:1:1）
   */
  function _selectRotation(ads) {
    if (!Array.isArray(ads) || ads.length === 0) return [];

    const active = ads.filter((a) => a.active !== false);
    const sorted = active.slice().sort((a, b) => {
      const bidDiff = (b.bidAmount || 0) - (a.bidAmount || 0);
      if (bidDiff !== 0) return bidDiff;
      return (b.priority || 0) - (a.priority || 0);
    });

    const local = sorted.filter((a) => a.category === 'local');
    const national = sorted.filter((a) => a.category === 'national');
    const recruit = sorted.filter((a) => a.category === 'recruit');

    const rotation = [];
    // Local 2枠
    if (local[0]) rotation.push(local[0]);
    if (local[1]) rotation.push(local[1]);
    // National 1枠
    if (national[0]) rotation.push(national[0]);
    // Recruit 1枠
    if (recruit[0]) rotation.push(recruit[0]);

    // 4枠未満なら残りから補充
    if (rotation.length < ROTATION_SIZE) {
      for (const a of sorted) {
        if (rotation.length >= ROTATION_SIZE) break;
        if (!rotation.includes(a)) rotation.push(a);
      }
    }

    return rotation.slice(0, ROTATION_SIZE);
  }

  const glAds = {
    /**
     * コンテキストに応じた広告を取得
     * @param {Object} context - {slot, region, courseId}
     */
    async fetchForContext(context = {}) {
      const slot = context.slot || 'home';
      const region = context.region || '';

      // キャッシュ優先
      const cached = _readCache(slot);
      if (cached) {
        const rotation = _selectRotation(cached);
        window.glState.set('adsRotation', {
          ...(window.glState.get('adsRotation') || {}),
          [slot]: rotation,
        });
        return rotation;
      }

      try {
        const result = await window.glandApi.listAds({ slot, region });
        const ads = result?.ads || result || [];
        _writeCache(slot, ads);

        const rotation = _selectRotation(ads);
        window.glState.set('adsRotation', {
          ...(window.glState.get('adsRotation') || {}),
          [slot]: rotation,
        });
        window.glEvents.emit('ads:loaded', { slot, count: rotation.length });
        return rotation;
      } catch (err) {
        window.glErrors.handle(err, { silent: true, context: 'ads.fetch' });
        return [];
      }
    },

    /**
     * 現在のローテーション取得
     */
    getRotation(slot) {
      const all = window.glState.get('adsRotation') || {};
      return all[slot] || [];
    },

    /**
     * インプレッション追跡（表示時）
     * ネットワーク送信は失敗しても無視（UXに影響させない）
     */
    trackImpression(adId) {
      if (!adId) return;
      // 将来: 別途 apiTrackImpression() 実装可
      window.glEvents.emit('ads:impression', { adId });
    },

    /**
     * クリック追跡
     */
    trackClick(adId) {
      if (!adId) return;
      window.glEvents.emit('ads:click', { adId });
    },
  };

  window.glAds = glAds;
})();
