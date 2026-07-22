/**
 * G-LAND v3.0.0 - Course Selection UI
 * ===================================
 * マイコース選択・全国コース検索・新規コース作成・運営追加依頼の4モーダル
 *
 * v3.0.0 変更点:
 *   - CSS 依存は css/modal.css / css/components.css / css/screens.css へ完全移管済み
 *     （このファイル自体は元々 _injectStyles() を持たない）
 *   - モーダル生成を全て window.glModal.open() へ移行:
 *       * showMyCourses         : マイコース選択
 *       * showCreateForm        : 新規コース作成（ホール数選択・動的タイプ追加）
 *       * showSearch            : 全国コース検索
 *       * showRequestForm       : 運営追加依頼
 *   - 文言・入力値・イベント・保存処理・onSelect コールバック・
 *     多層化防止・閉じる挙動は 100% 現行維持
 */
(function () {
  'use strict';

  const glCourseUI = {
    /**
     * マイコース選択モーダル（呼出元: round.js の開始フロー等）
     */
    async showMyCourses(onSelect) {
      const courses = await window.glCourse.listMyCourses();

      const items = courses.length === 0
        ? '<div class="gl-u-23">マイコースがありません</div>'
        : courses.map((c) => `
            <div class="gl-round__card gl-u-24" data-course-id="${c.courseId}">
              <h3 class="gl-u-25">${c.name}</h3>
              <p class="gl-u-26">${c.prefecture || ''}</p>
            </div>`).join('');

      const body = ''
        + '<div>' + items + '</div>'
        + '<button class="gl-btn-primary gl-u-05" data-search>🔍 全国コースから探す</button>'
        + '<button class="gl-btn-primary gl-u-27" data-create>➕ 自分でコースを作る</button>';

      // 多層化防止（従来仕様: modalRoot 内の既存 .gl-modal を全削除）
      window.glModal.closeAll();

      var self = this;
      var handle = window.glModal.open({
        title: '⛳ コース選択',
        body: body,
        modalType: 'course-select',
        dismissible: true,
        showClose: true,   // 従来仕様: [data-modal-close] × ボタンあり
        onBind: function (root) {
          root.querySelectorAll('[data-course-id]').forEach(function (el) {
            el.addEventListener('click', function () {
              var cid = el.dataset.courseId;
              var course = courses.find(function (c) { return c.courseId === cid; });
              handle.close();
              if (onSelect) onSelect(course);
            });
          });
          var searchBtn = root.querySelector('[data-search]');
          if (searchBtn) searchBtn.addEventListener('click', function () {
            handle.close();
            self.showSearch(onSelect);
          });
          var createBtn = root.querySelector('[data-create]');
          if (createBtn) createBtn.addEventListener('click', function () {
            handle.close();
            self.showCreateForm(onSelect);
          });
        },
      });
    },

    /**
     * v2.8.14: 新規コース登録モーダル（ローカル作成）
     * ユーザーが自分でコースを作成 → 即マイコースに追加
     *
     * v3.0.0: glModal.open ベース。以下は 100% 現行維持:
     *   - 47 都道府県プルダウン
     *   - ホール数選択（9/18/27/36）ビジュアル切替（緑ボーダー + #e8f5e9 背景）
     *   - コースタイプ動的追加/削除、9H単位のパー入力
     *   - 保存時バリデーション（コース名/都道府県/タイプ名 必須）
     *   - 保存成功時 toast + close + onSelect(course)
     */
    showCreateForm(onSelect) {
      const prefectures = ['北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県','茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県','新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県','静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県','鳥取県','島根県','岡山県','広島県','山口県','徳島県','香川県','愛媛県','高知県','福岡県','佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県'];
      const prefOptions = prefectures.map((p) => `<option value="${p}">${p}</option>`).join('');

      const body = `
          <p class="gl-u-28">自分専用のコースを登録します</p>

          <div class="gl-form__group">
            <label class="gl-form__label">コース名 <span class="gl-u-01">*</span></label>
            <input class="gl-form__input" id="cc-name" placeholder="例: 六甲国際パブリック">
          </div>

          <div class="gl-form__group">
            <label class="gl-form__label">都道府県 <span class="gl-u-01">*</span></label>
            <select class="gl-form__input" id="cc-pref">
              <option value="">選択してください</option>
              ${prefOptions}
            </select>
          </div>

          <div class="gl-form__group">
            <label class="gl-form__label">ホール数 <span class="gl-u-01">*</span></label>
            <div class="gl-u-29" id="cc-holes-group">
              <label class="gl-u-04">
                <input type="radio" name="cc-holes" value="9" class="gl-u-03">9H
              </label>
              <label class="gl-u-30">
                <input type="radio" name="cc-holes" value="18" checked class="gl-u-03">18H
              </label>
              <label class="gl-u-04">
                <input type="radio" name="cc-holes" value="27" class="gl-u-03">27H
              </label>
              <label class="gl-u-04">
                <input type="radio" name="cc-holes" value="36" class="gl-u-03">36H
              </label>
            </div>
          </div>

          <div class="gl-form__group">
            <label class="gl-form__label">コースタイプ <span class="gl-u-01">*</span></label>
            <p class="gl-u-31">例: 東/西、IN/OUT、赤/青 など</p>
            <div id="cc-types-container"></div>
            <button type="button" id="cc-add-type" class="gl-u-32">➕ タイプを追加</button>
          </div>

          <button class="gl-btn-primary gl-u-33" data-save>💾 保存する</button>
          <button class="gl-u-06" data-cancel>キャンセル</button>
      `;

      window.glModal.closeAll();

      var handle = window.glModal.open({
        title: '📝 新しいコースを作る',
        body: body,
        modalType: 'course-create',
        dismissible: true,
        showClose: true,
        onBind: function (root) {
          var cancelBtn = root.querySelector('[data-cancel]');
          if (cancelBtn) cancelBtn.addEventListener('click', function () { handle.close(); });

          // ホール数選択のビジュアル切り替え
          var holesGroup = root.querySelector('#cc-holes-group');
          holesGroup.addEventListener('change', function () {
            holesGroup.querySelectorAll('label').forEach(function (label) {
              var input = label.querySelector('input');
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
          var typesContainer = root.querySelector('#cc-types-container');
          var typeCount = 0;

          var _getHolesPerType = function () {
            var totalHoles = parseInt(root.querySelector('input[name="cc-holes"]:checked').value, 10);
            return totalHoles >= 18 ? 9 : totalHoles;  // 18H以上は9H単位、9Hはそのまま
          };

          var _addType = function () {
            typeCount++;
            var holesPerType = _getHolesPerType();
            var typeDiv = document.createElement('div');
            typeDiv.className = 'cc-type-item';
            typeDiv.style.cssText = 'background:#faf6ec;padding:10px;border-radius:6px;margin-bottom:8px;';
            typeDiv.dataset.typeIndex = typeCount;

            var parsInputs = Array.from({ length: holesPerType }, function (_, i) {
              return '<div class="gl-u-34">'
                + '<span class="gl-u-35">' + (i + 1) + '番</span>'
                + '<input type="number" class="cc-par gl-u-36" data-hole="' + (i + 1) + '" min="3" max="6" value="4"'
                + '>'
                + '</div>';
            }).join('');

            typeDiv.innerHTML = ''
              + '<div class="gl-u-37">'
              +   '<input type="text" class="cc-type-name gl-u-38" placeholder="例: 東 or IN or 赤"'
              +   '>'
              +   '<button type="button" class="cc-remove-type gl-u-39">削除</button>'
              + '</div>'
              + '<div class="gl-u-40">'
              +   parsInputs
              + '</div>';

            typeDiv.querySelector('.cc-remove-type').addEventListener('click', function () {
              typeDiv.remove();
            });

            typesContainer.appendChild(typeDiv);
          };

          var _renderTypes = function () {
            // ホール数変更時は全タイプをリセット
            typesContainer.innerHTML = '';
            typeCount = 0;
            _addType();
          };

          root.querySelector('#cc-add-type').addEventListener('click', _addType);

          // 初期タイプを1つ追加
          _addType();

          // 保存処理
          root.querySelector('[data-save]').addEventListener('click', async function () {
            var name = root.querySelector('#cc-name').value.trim();
            var prefecture = root.querySelector('#cc-pref').value;
            var totalHoles = parseInt(root.querySelector('input[name="cc-holes"]:checked').value, 10);

            if (!name) {
              window.glToast.warn('コース名を入力してください');
              return;
            }
            if (!prefecture) {
              window.glToast.warn('都道府県を選択してください');
              return;
            }

            var typeItems = root.querySelectorAll('.cc-type-item');
            if (typeItems.length === 0) {
              window.glToast.warn('コースタイプを1つ以上追加してください');
              return;
            }

            var types = [];
            for (var idx = 0; idx < typeItems.length; idx++) {
              var item = typeItems[idx];
              var typeName = item.querySelector('.cc-type-name').value.trim();
              if (!typeName) {
                window.glToast.warn('コースタイプ名を入力してください');
                return;
              }
              var pars = Array.from(item.querySelectorAll('.cc-par')).map(function (el) {
                return parseInt(el.value, 10) || 4;
              });
              types.push({ name: typeName, pars: pars });
            }

            var result = await window.glCourse.createLocalCourse({
              name: name, prefecture: prefecture, totalHoles: totalHoles, types: types
            });
            if (result.ok) {
              window.glToast.success('「' + name + '」を追加しました');
              handle.close();
              if (onSelect) onSelect(result.course);
            } else {
              window.glToast.warn(result.error || '保存に失敗しました');
            }
          });
        },
      });
    },

    async showSearch(onSelect) {
      const body = `
          <div class="gl-form__group">
            <label class="gl-form__label">都道府県</label>
            <input class="gl-form__input" id="cs-pref" placeholder="例: 東京都">
          </div>
          <div class="gl-form__group">
            <label class="gl-form__label">コース名（ひらがな/カタカナ）</label>
            <input class="gl-form__input" id="cs-kana" placeholder="例: たまがわ">
          </div>
          <button class="gl-btn-primary" data-do-search>検索</button>
          <div id="cs-results" class="gl-u-05"></div>
          <button class="gl-u-41" data-create-new>
            ➕ 新規コース追加登録
          </button>
      `;

      window.glModal.closeAll();

      var self = this;
      var handle = window.glModal.open({
        title: '🔍 コース検索',
        body: body,
        modalType: 'course-search',
        dismissible: true,
        showClose: true,
        onBind: function (root) {
          root.querySelector('[data-do-search]').addEventListener('click', async function () {
            var pref = document.getElementById('cs-pref').value.trim();
            var kana = document.getElementById('cs-kana').value.trim();
            var results = await window.glCourse.search({ prefecture: pref, kana: kana });
            var resultsEl = document.getElementById('cs-results');
            if (results.length === 0) {
              resultsEl.innerHTML = '<div class="gl-u-42">該当なし</div>';
              return;
            }
            resultsEl.innerHTML = results.map(function (c) {
              return '<div class="gl-round__card gl-u-43" data-course-id="' + c.courseId + '">'
                + '<h3 class="gl-u-44">' + c.name + '</h3>'
                + '<p class="gl-u-45">' + (c.prefecture || '') + '</p>'
                + '</div>';
            }).join('');

            resultsEl.querySelectorAll('[data-course-id]').forEach(function (el) {
              el.addEventListener('click', async function () {
                var c = results.find(function (x) { return x.courseId === el.dataset.courseId; });
                await window.glCourse.addMyCourse(c);
                window.glToast.success('マイコースに追加しました');
                handle.close();
                if (onSelect) onSelect(c);
              });
            });
          });

          root.querySelector('[data-create-new]').addEventListener('click', function () {
            handle.close();
            self.showCreateForm(onSelect);
          });
        },
      });
    },

    showRequestForm() {
      const body = `
          <p class="gl-u-07">運営に追加をリクエストします</p>
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
      `;

      var handle = window.glModal.open({
        title: '✉️ コース追加を依頼',
        body: body,
        modalType: 'course-request',
        dismissible: true,
        showClose: false, // 従来仕様: × なし、背景クリックのみで閉じる
        onBind: function (root) {
          root.querySelector('[data-submit]').addEventListener('click', async function () {
            var name = document.getElementById('cr-name').value.trim();
            if (!name) {
              window.glToast.warn('コース名を入力してください');
              return;
            }
            var result = await window.glCourse.requestNewCourse({
              name: name,
              prefecture: document.getElementById('cr-pref').value.trim(),
              note: document.getElementById('cr-note').value.trim(),
            });
            if (result.ok) handle.close();
          });
        },
      });
    },
  };

  window.glCourseUI = glCourseUI;
})();
