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
        <button class="gl-modal__close" data-modal-close aria-label="閉じる">×</button>
          <h2 class="gl-modal__title">⛳ コース選択</h2>
          <div>${items}</div>
          <button class="gl-btn-primary" data-search style="margin-top:12px;">🔍 全国コースから探す</button>
          <button class="gl-btn-primary" data-create style="margin-top:8px;background:#2d7a56;">➕ 自分でコースを作る</button>

        </div>
      `;
      const modalRoot = document.getElementById('modal-root') || document.body;
      modalRoot.querySelectorAll('.gl-modal').forEach(m => m.remove());
      modalRoot.appendChild(wrap);

      const close = () => wrap.remove();
      wrap.querySelectorAll('[data-modal-close]').forEach(el => el.addEventListener('click', close));
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
      wrap.querySelector('[data-create]').addEventListener('click', () => {
        close();
        this.showCreateForm(onSelect);
      });
    },

    /**
     * v2.8.14: 新規コース登録モーダル（ローカル作成）
     * ユーザーが自分でコースを作成 → 即マイコースに追加
     */
    showCreateForm(onSelect) {
      const wrap = document.createElement('div');
      wrap.className = 'gl-modal show';

      const prefectures = ['北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県','茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県','新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県','静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県','鳥取県','島根県','岡山県','広島県','山口県','徳島県','香川県','愛媛県','高知県','福岡県','佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県'];
      const prefOptions = prefectures.map((p) => `<option value="${p}">${p}</option>`).join('');

      wrap.innerHTML = `
        <div class="gl-modal__backdrop"></div>
        <div class="gl-modal__body" style="max-height:88vh;overflow-y:auto;">
        <button class="gl-modal__close" data-modal-close aria-label="閉じる">×</button>
          <h2 class="gl-modal__title">📝 新しいコースを作る</h2>
          <p style="color:#666;font-size:12px;margin:0 0 12px;">自分専用のコースを登録します</p>

          <div class="gl-form__group">
            <label class="gl-form__label">コース名 <span style="color:#f44336;">*</span></label>
            <input class="gl-form__input" id="cc-name" placeholder="例: 六甲国際パブリック">
          </div>

          <div class="gl-form__group">
            <label class="gl-form__label">都道府県 <span style="color:#f44336;">*</span></label>
            <select class="gl-form__input" id="cc-pref">
              <option value="">選択してください</option>
              ${prefOptions}
            </select>
          </div>

          <div class="gl-form__group">
            <label class="gl-form__label">ホール数 <span style="color:#f44336;">*</span></label>
            <div style="display:flex;gap:8px;flex-wrap:wrap;" id="cc-holes-group">
              <label style="flex:1;min-width:60px;padding:8px;border:1px solid #ddd;border-radius:6px;text-align:center;cursor:pointer;background:#fafafa;">
                <input type="radio" name="cc-holes" value="9" style="margin-right:4px;">9H
              </label>
              <label style="flex:1;min-width:60px;padding:8px;border:1px solid #1a5f3f;border-radius:6px;text-align:center;cursor:pointer;background:#e8f5e9;">
                <input type="radio" name="cc-holes" value="18" checked style="margin-right:4px;">18H
              </label>
              <label style="flex:1;min-width:60px;padding:8px;border:1px solid #ddd;border-radius:6px;text-align:center;cursor:pointer;background:#fafafa;">
                <input type="radio" name="cc-holes" value="27" style="margin-right:4px;">27H
              </label>
              <label style="flex:1;min-width:60px;padding:8px;border:1px solid #ddd;border-radius:6px;text-align:center;cursor:pointer;background:#fafafa;">
                <input type="radio" name="cc-holes" value="36" style="margin-right:4px;">36H
              </label>
            </div>
          </div>

          <div class="gl-form__group">
            <label class="gl-form__label">コースタイプ <span style="color:#f44336;">*</span></label>
            <p style="color:#888;font-size:11px;margin:0 0 8px;">例: 東/西、IN/OUT、赤/青 など</p>
            <div id="cc-types-container"></div>
            <button type="button" id="cc-add-type" style="width:100%;padding:8px;background:#fff;border:1px dashed #1a5f3f;border-radius:6px;color:#1a5f3f;cursor:pointer;font-size:13px;margin-top:6px;">➕ タイプを追加</button>
          </div>

          <button class="gl-btn-primary" data-save style="margin-top:16px;">💾 保存する</button>
          <button style="width:100%;padding:12px;margin-top:8px;background:none;border:1px solid #ccc;border-radius:6px;color:#666;cursor:pointer;" data-cancel>キャンセル</button>
        </div>
      `;
      const modalRoot = document.getElementById('modal-root') || document.body;
      modalRoot.querySelectorAll('.gl-modal').forEach(m => m.remove());
      modalRoot.appendChild(wrap);

      const close = () => wrap.remove();
      wrap.querySelector('.gl-modal__backdrop').addEventListener('click', close);
      wrap.querySelectorAll('[data-modal-close]').forEach(el => el.addEventListener('click', close));
      wrap.querySelector('[data-cancel]').addEventListener('click', close);

      // ホール数選択のビジュアル切り替え
      const holesGroup = wrap.querySelector('#cc-holes-group');
      holesGroup.addEventListener('change', () => {
        holesGroup.querySelectorAll('label').forEach((label) => {
          const input = label.querySelector('input');
          if (input.checked) {
            label.style.border = '1px solid #1a5f3f';
            label.style.background = '#e8f5e9';
          } else {
            label.style.border = '1px solid #ddd';
            label.style.background = '#fafafa';
          }
        });
        _renderTypes();
      });

      // コースタイプ管理
      const typesContainer = wrap.querySelector('#cc-types-container');
      let typeCount = 0;

      const _getHolesPerType = () => {
        const totalHoles = parseInt(wrap.querySelector('input[name="cc-holes"]:checked').value, 10);
        return totalHoles >= 18 ? 9 : totalHoles;  // 18H以上は9H単位、9Hはそのまま
      };

      const _addType = () => {
        typeCount++;
        const holesPerType = _getHolesPerType();
        const typeDiv = document.createElement('div');
        typeDiv.className = 'cc-type-item';
        typeDiv.style.cssText = 'background:#faf6ec;padding:10px;border-radius:6px;margin-bottom:8px;';
        typeDiv.dataset.typeIndex = typeCount;

        const parsInputs = Array.from({ length: holesPerType }, (_, i) => `
          <div style="display:flex;align-items:center;gap:4px;">
            <span style="font-size:11px;color:#666;min-width:24px;">${i + 1}番</span>
            <input type="number" class="cc-par" data-hole="${i + 1}" min="3" max="6" value="4"
              style="width:100%;padding:4px;text-align:center;border:1px solid #ccc;border-radius:4px;font-size:13px;">
          </div>
        `).join('');

        typeDiv.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <input type="text" class="cc-type-name" placeholder="例: 東 or IN or 赤"
              style="flex:1;padding:6px;border:1px solid #ccc;border-radius:4px;font-size:13px;font-weight:700;">
            <button type="button" class="cc-remove-type" style="margin-left:8px;background:#f44336;color:#fff;border:none;padding:4px 8px;border-radius:4px;font-size:11px;cursor:pointer;">削除</button>
          </div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-top:6px;">
            ${parsInputs}
          </div>
        `;

        typeDiv.querySelector('.cc-remove-type').addEventListener('click', () => {
          typeDiv.remove();
        });

        typesContainer.appendChild(typeDiv);
      };

      const _renderTypes = () => {
        // ホール数変更時は全タイプをリセット
        typesContainer.innerHTML = '';
        typeCount = 0;
        _addType();
      };

      wrap.querySelector('#cc-add-type').addEventListener('click', _addType);

      // 初期タイプを1つ追加
      _addType();

      // 保存処理
      wrap.querySelector('[data-save]').addEventListener('click', async () => {
        const name = wrap.querySelector('#cc-name').value.trim();
        const prefecture = wrap.querySelector('#cc-pref').value;
        const totalHoles = parseInt(wrap.querySelector('input[name="cc-holes"]:checked').value, 10);

        if (!name) {
          window.glToast.warn('コース名を入力してください');
          return;
        }
        if (!prefecture) {
          window.glToast.warn('都道府県を選択してください');
          return;
        }

        const typeItems = wrap.querySelectorAll('.cc-type-item');
        if (typeItems.length === 0) {
          window.glToast.warn('コースタイプを1つ以上追加してください');
          return;
        }

        const types = [];
        for (const item of typeItems) {
          const typeName = item.querySelector('.cc-type-name').value.trim();
          if (!typeName) {
            window.glToast.warn('コースタイプ名を入力してください');
            return;
          }
          const pars = Array.from(item.querySelectorAll('.cc-par')).map((el) => parseInt(el.value, 10) || 4);
          types.push({ name: typeName, pars });
        }

        const result = await window.glCourse.createLocalCourse({ name, prefecture, totalHoles, types });
        if (result.ok) {
          window.glToast.success(`「${name}」を追加しました`);
          close();
          if (onSelect) onSelect(result.course);
        } else {
          window.glToast.warn(result.error || '保存に失敗しました');
        }
      });
    },

    async showSearch(onSelect) {
      const wrap = document.createElement('div');
      wrap.className = 'gl-modal show';
      wrap.innerHTML = `
        <div class="gl-modal__backdrop"></div>
        <div class="gl-modal__body">
        <button class="gl-modal__close" data-modal-close aria-label="閉じる">×</button>
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
          <button style="width:100%;margin-top:12px;padding:12px;background:#fff;border:2px solid #1a5f3f;color:#1a5f3f;border-radius:8px;font-weight:600;" data-create-new>
            ➕ 新規コース追加登録
          </button>
        </div>
      `;
      const modalRoot = document.getElementById('modal-root') || document.body;
      modalRoot.querySelectorAll('.gl-modal').forEach(m => m.remove());
      modalRoot.appendChild(wrap);

      const close = () => wrap.remove();
      wrap.querySelector('.gl-modal__backdrop').addEventListener('click', close);
      wrap.querySelectorAll('[data-modal-close]').forEach(el => el.addEventListener('click', close));
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

      wrap.querySelector('[data-create-new]').addEventListener('click', () => {
       close();
       this.showCreateForm(onSelect);
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
      (document.getElementById('modal-root') || document.body).appendChild(wrap);

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
