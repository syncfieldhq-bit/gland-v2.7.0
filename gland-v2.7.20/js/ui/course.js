/**
 * G-LAND v2.7.0 - Course Selection UI
 * ===================================
 * マイコース選択・全国コース検索・運営追加依頼の3画面
 */
(function () {
  'use strict';

  const glCourseUI = {
    /**
     * マイコース選択モーダル（呼出元: round.js の開始フロー等）
     */
    async showMyCourses(onSelect) {
      const courses = await window.glCourse.listMyCourses();
      const wrap = document.createElement('div');
      wrap.className = 'gl-modal show';

      const items = courses.length === 0
        ? '<div style="padding:20px;text-align:center;color:#999;">マイコースがありません</div>'
        : courses.map((c) => `
            <div class="gl-round__card" data-course-id="${c.courseId}" style="cursor:pointer;margin-bottom:8px;">
              <h3 style="margin:0;font-size:15px;">${c.name}</h3>
              <p style="margin:2px 0 0;font-size:12px;color:#888;">${c.prefecture || ''}</p>
            </div>`).join('');

      wrap.innerHTML = `
        <div class="gl-modal__backdrop"></div>
        <div class="gl-modal__body">
          <h2 class="gl-modal__title">⛳ コース選択</h2>
          <div>${items}</div>
          <button class="gl-btn-primary" data-search style="margin-top:12px;">🔍 全国コースから探す</button>
        </div>
      `;
      document.body.appendChild(wrap);

      const close = () => wrap.remove();
      wrap.querySelector('.gl-modal__backdrop').addEventListener('click', close);

      wrap.querySelectorAll('[data-course-id]').forEach((el) => {
        el.addEventListener('click', () => {
          const cid = el.dataset.courseId;
          const course = courses.find((c) => c.courseId === cid);
          close();
          if (onSelect) onSelect(course);
        });
      });

      wrap.querySelector('[data-search]').addEventListener('click', () => {
        close();
        this.showSearch(onSelect);
      });
    },

    async showSearch(onSelect) {
      const wrap = document.createElement('div');
      wrap.className = 'gl-modal show';
      wrap.innerHTML = `
        <div class="gl-modal__backdrop"></div>
        <div class="gl-modal__body">
          <h2 class="gl-modal__title">🔍 コース検索</h2>
          <div class="gl-form__group">
            <label class="gl-form__label">都道府県</label>
            <input class="gl-form__input" id="cs-pref" placeholder="例: 東京都">
          </div>
          <div class="gl-form__group">
            <label class="gl-form__label">コース名（ひらがな/カタカナ）</label>
            <input class="gl-form__input" id="cs-kana" placeholder="例: たまがわ">
          </div>
          <button class="gl-btn-primary" data-do-search>検索</button>
          <div id="cs-results" style="margin-top:12px;"></div>
          <button style="width:100%;margin-top:12px;padding:12px;background:#fff;border:2px solid #ff9800;color:#ff9800;border-radius:8px;font-weight:600;" data-request>
            ✉️ 運営にコース追加を依頼
          </button>
        </div>
      `;
      document.body.appendChild(wrap);

      const close = () => wrap.remove();
      wrap.querySelector('.gl-modal__backdrop').addEventListener('click', close);

      wrap.querySelector('[data-do-search]').addEventListener('click', async () => {
        const pref = document.getElementById('cs-pref').value.trim();
        const kana = document.getElementById('cs-kana').value.trim();
        const results = await window.glCourse.search({ prefecture: pref, kana });
        const resultsEl = document.getElementById('cs-results');
        if (results.length === 0) {
          resultsEl.innerHTML = '<div style="text-align:center;color:#999;padding:12px;">該当なし</div>';
          return;
        }
        resultsEl.innerHTML = results.map((c) => `
          <div class="gl-round__card" data-course-id="${c.courseId}" style="margin-bottom:6px;cursor:pointer;">
            <h3 style="margin:0;font-size:14px;">${c.name}</h3>
            <p style="margin:2px 0 0;font-size:11px;color:#888;">${c.prefecture || ''}</p>
          </div>
        `).join('');

        resultsEl.querySelectorAll('[data-course-id]').forEach((el) => {
          el.addEventListener('click', async () => {
            const c = results.find((x) => x.courseId === el.dataset.courseId);
            await window.glCourse.addMyCourse(c);
            window.glToast.success('マイコースに追加しました');
            close();
            if (onSelect) onSelect(c);
          });
        });
      });

      wrap.querySelector('[data-request]').addEventListener('click', () => {
        close();
        this.showRequestForm();
      });
    },

    showRequestForm() {
      const wrap = document.createElement('div');
      wrap.className = 'gl-modal show';
      wrap.innerHTML = `
        <div class="gl-modal__backdrop"></div>
        <div class="gl-modal__body">
          <h2 class="gl-modal__title">✉️ コース追加を依頼</h2>
          <p style="color:#666;font-size:13px;">運営に追加をリクエストします</p>
          <div class="gl-form__group">
            <label class="gl-form__label">コース名 *</label>
            <input class="gl-form__input" id="cr-name">
          </div>
          <div class="gl-form__group">
            <label class="gl-form__label">都道府県</label>
            <input class="gl-form__input" id="cr-pref">
          </div>
          <div class="gl-form__group">
            <label class="gl-form__label">備考</label>
            <input class="gl-form__input" id="cr-note">
          </div>
          <button class="gl-btn-primary" data-submit>依頼を送信</button>
        </div>
      `;
      document.body.appendChild(wrap);

      const close = () => wrap.remove();
      wrap.querySelector('.gl-modal__backdrop').addEventListener('click', close);
      wrap.querySelector('[data-submit]').addEventListener('click', async () => {
        const name = document.getElementById('cr-name').value.trim();
        if (!name) {
          window.glToast.warn('コース名を入力してください');
          return;
        }
        const result = await window.glCourse.requestNewCourse({
          name,
          prefecture: document.getElementById('cr-pref').value.trim(),
          note: document.getElementById('cr-note').value.trim(),
        });
        if (result.ok) close();
      });
    },
  };

  window.glCourseUI = glCourseUI;
})();
