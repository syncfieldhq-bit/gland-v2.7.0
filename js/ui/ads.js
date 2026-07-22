/**
 * G-LAND v2.7.0 - Ads Carousel UI
 * ===============================
 * 5秒自動送り・4枚ローテーション
 * スワイプ手動送り対応、シニア配慮の大きめ画像
 * home / score-landscape / mypage の3スロット
 */
(function () {
  'use strict';

  const AUTO_INTERVAL_MS = 5000;
  const carousels = new Map(); // slotId => {timer, index, ads, root}

  function _injectStyles() {
    // v3.0.0: CSS は css/*.css に完全移管済み。互換のため関数は残置（no-op）。
    return;
  }

  function _render(container, slot, ads) {
    _injectStyles();

    if (!ads || ads.length === 0) {
      container.innerHTML = `<div class="gl-ads-carousel gl-ads-carousel--empty gl-ads-carousel--${slot}">広告枠</div>`;
      return null;
    }

    const slides = ads.map((a, i) => {
      const label =
        a.category === 'local' ? '地元' :
        a.category === 'national' ? '全国' :
        a.category === 'recruit' ? '求人' : '';
      return `
        <div class="gl-ads-carousel__slide" data-index="${i}" data-ad-id="${a.adId || ''}" data-link="${a.linkUrl || ''}">
          <img src="${a.imageUrl || ''}" alt="${a.name || ''}" loading="lazy">
          ${label ? `<div class="gl-ads-carousel__badge">${label}</div>` : ''}
        </div>
      `;
    }).join('');

    const dots = ads.map((_, i) => `<div class="gl-ads-carousel__dot ${i === 0 ? 'active' : ''}"></div>`).join('');

    container.innerHTML = `
      <div class="gl-ads-carousel gl-ads-carousel--${slot}">
        <div class="gl-ads-carousel__track">${slides}</div>
        <div class="gl-ads-carousel__dots">${dots}</div>
      </div>
    `;

    const root = container.querySelector('.gl-ads-carousel');
    const track = container.querySelector('.gl-ads-carousel__track');
    const dotEls = container.querySelectorAll('.gl-ads-carousel__dot');
    const slideEls = container.querySelectorAll('.gl-ads-carousel__slide');

    // 各スライドクリック → リンク遷移
    slideEls.forEach((el) => {
      el.addEventListener('click', () => {
        const adId = el.dataset.adId;
        const link = el.dataset.link;
        if (adId) window.glAds.trackClick(adId);
        if (link) window.open(link, '_blank', 'noopener');
      });
    });

    // スワイプ対応
    let startX = null;
    root.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
    }, { passive: true });
    root.addEventListener('touchend', (e) => {
      if (startX === null) return;
      const dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 50) {
        const state = carousels.get(slot);
        if (state) {
          if (dx < 0) _next(slot);
          else _prev(slot);
        }
      }
      startX = null;
    }, { passive: true });

    return { root, track, dotEls, ads };
  }

  function _updateIndex(slot, newIndex) {
    const state = carousels.get(slot);
    if (!state) return;
    state.index = ((newIndex % state.ads.length) + state.ads.length) % state.ads.length;
    state.track.style.transform = `translateX(-${state.index * 100}%)`;
    state.dotEls.forEach((d, i) => d.classList.toggle('active', i === state.index));

    // インプレッション追跡
    const ad = state.ads[state.index];
    if (ad?.adId) window.glAds.trackImpression(ad.adId);
    window.glEvents.emit('ads:rotated', { slot, index: state.index, adId: ad?.adId });
  }

  function _next(slot) {
    const state = carousels.get(slot);
    if (state) _updateIndex(slot, state.index + 1);
  }

  function _prev(slot) {
    const state = carousels.get(slot);
    if (state) _updateIndex(slot, state.index - 1);
  }

  function _startAuto(slot) {
    const state = carousels.get(slot);
    if (!state || state.ads.length < 2) return;
    if (state.timer) clearInterval(state.timer);
    state.timer = setInterval(() => _next(slot), AUTO_INTERVAL_MS);
  }

  function _stopAuto(slot) {
    const state = carousels.get(slot);
    if (state && state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }
  }

  const glAdsUI = {
    /**
     * カルーセルをマウント
     * @param {HTMLElement} container
     * @param {string} slot
     */
    async mount(container, slot) {
      if (!container) return;
      this.destroy(container, slot);

      const ads = await window.glAds.fetchForContext({ slot });
      const rendered = _render(container, slot, ads);
      if (!rendered) return;

      carousels.set(slot, {
        timer: null,
        index: 0,
        ads,
        root: rendered.root,
        track: rendered.track,
        dotEls: rendered.dotEls,
      });

      // 初回インプレッション
      if (ads[0]?.adId) window.glAds.trackImpression(ads[0].adId);

      _startAuto(slot);
    },

    destroy(container, slot) {
      _stopAuto(slot);
      carousels.delete(slot);
      if (container) container.innerHTML = '';
    },

    rotate(slot) {
      _next(slot);
    },
  };

  window.glAdsUI = glAdsUI;
})();
