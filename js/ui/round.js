/**
 * G-LAND v3.0.0 - Round View UI
 * =============================
 * ラウンド開始・合流・招待QR/A123コード・コース選択
 *
 * v3.0.0 変更点:
 *   - _injectStyles() を no-op 化（CSS は css/screens.css / css/modal.css / css/components.css へ移管）
 *   - モーダル生成を全て window.glModal.open() へ移行:
 *       * _modalPrompt (汎用) → glModal.open()
 *       * _showProxyManagerModal (代理管理・部分再描画対応)
 *       * _showStartTypeSelector (スタート選択)
 *       * _showFinalConfirm (開始最終確認、_modalPrompt 経由)
 *       * _showJoinModal (合流入力、_modalPrompt 経由)
 *       * _showInviteModal (招待、_modalPrompt 経由)
 *       * _confirmLeave (離脱確認、_modalPrompt 経由)
 *   - 文言・イベント・保存処理・onOk return false でのクローズ抑止・
 *     モーダル多層化防止・QR生成タイミングは 100% 現行維持
 *   - browser 標準 confirm() (代理削除確認) は現行仕様維持
 */
(function () {
  'use strict';

  function _injectStyles() {
    // v3.0.0: CSS は css/*.css に完全移管済み。互換のため関数は残置（no-op）。
    return;
  }

  function _renderIndex() {
    _injectStyles();
    const view = document.getElementById('view-golf');
    if (!view) return;

    const inRound = !!window.glState.get('roundId');
    const proxies = window.glRound.listProxyPlayers ? window.glRound.listProxyPlayers() : [];
    const maxProxy = window.glRound.getMaxProxy ? window.glRound.getMaxProxy() : 3;

    view.innerHTML = `
      <button class="gl-round__back" data-back>← ホームへ戻る</button>
      <h1 class="gl-round__title">🏌️ ラウンド</h1>
      <div class="gl-round__actions">
        ${inRound ? `
          <div class="gl-round__card" data-action="score">
            <h3>▶ スコア入力へ戻る</h3>
            <p>現在ラウンド進行中</p>
          </div>
          <div class="gl-round__card" data-action="invite">
            <h3>📤 招待</h3>
            <p>QRコード・4桁コードで仲間を呼ぶ</p>
          </div>
          <div class="gl-round__card" data-action="proxy">
            <h3>🧍 代理入力プレイヤー (${proxies.length}/${maxProxy})</h3>
            <p>スマホを使わない人の分を代打で入力</p>
          </div>
          <div class="gl-round__card" data-action="leave">
            <h3>🚪 ラウンドを終了</h3>
            <p>スコアカードから抜ける</p>
          </div>
        ` : `
          <div class="gl-round__card" data-action="start">
            <h3>🏌️ 新しいラウンドを開始</h3>
            <p>あなたがホストとなり、仲間を呼びます</p>
          </div>
          <div class="gl-round__card" data-action="join">
            <h3>👥 招待コードで合流</h3>
            <p>ホストから受け取った4桁コードを入力</p>
          </div>
          <div class="gl-round__card" data-action="course-add">
           <h3>⛳ ゴルフ場を追加登録</h3>
           <p>マイコースに追加(検索/新規追加登録)</p>
          </div>
        `}
      </div>
    `;

    // シンプルなクリック委任（子要素 pointer-events:none で target=カード保証）
    view.addEventListener('click', (e) => {
      const backBtn = e.target.closest('[data-back]');
      if (backBtn) {
        window.glEvents.emit('ui:navigate', { view: 'home' });
        return;
      }
      const card = e.target.closest('[data-action]');
      if (card) {
        _handleAction(card.dataset.action);
      }
    });
  }

  async function _handleAction(action) {
    console.log('[round] action:', action);
    if (action === 'start') return _showStartConfirm();
    if (action === 'join') return _showJoinModal();
    if (action === 'invite') return _showInviteModal();
    if (action === 'score') return window.glEvents.emit('ui:navigate', { view: 'score' });
    if (action === 'leave') return _confirmLeave();
    if (action === 'proxy') return _showProxyManagerModal();
    if (action === 'course-add') return _showCourseAdd();
  }

  /**
   * v3.0.0: 代理入力プレイヤー管理モーダル（glModal.open ベース）
   * - 既存の proxy-manager type モーダルを先に閉じる（多層化防止）
   * - 閉じずに連続追加可能（handle.rerender で部分更新）
   * - browser 標準 confirm() は現行仕様維持
   */
  function _showProxyManagerModal() {
    // 既存モーダル全閉じ（多層化防止・従来仕様）
    window.glModal.closeAll();
    // 旧仕様互換
    document.querySelectorAll('[data-modal-type="proxy-manager"]').forEach((m) => m.remove());

    var handle = window.glModal.open({
      title: '🧍 代理入力プレイヤー',
      modalType: 'proxy-manager',
      body: _renderProxyModalBody(),
      dismissible: true,       // 背景クリックで閉じる（従来仕様）
      showClose: false,        // 従来は本文内 [data-close] ボタンで閉じる
      onBind: function (root) {
        _bindProxyModalEvents(root, handle);
      },
    });
  }

  function _renderProxyModalBody() {
    const proxies = window.glRound.listProxyPlayers();
    const max = window.glRound.getMaxProxy();
    const canAdd = proxies.length < max;

    const list = proxies.length === 0
      ? '<p class="gl-u-65">まだ代理プレイヤーはいません</p>'
      : proxies.map((p) => `
          <div class="gl-u-66">
            <div>
              <div class="gl-u-67">${p.familyName || p.displayName}</div>
              ${p.familyKana ? `<div class="gl-u-68">${p.familyKana}</div>` : ''}
            </div>
            <button class="gl-u-69" data-remove="${p.userId}">削除</button>
          </div>
        `).join('');

    return `
        <p class="gl-u-02">スマホを使わない人のスコアを代わりに入力できます（最大${max}名）</p>
        <div class="gl-u-70" data-proxy-list>${list}</div>
        <div data-proxy-form>
          ${canAdd ? `
            <h3 class="gl-u-71">新規追加</h3>
            <div class="gl-form__group">
              <label class="gl-form__label">名前 <span class="gl-u-01">*</span></label>
              <input class="gl-form__input" data-proxy-name placeholder="例: 田中">
            </div>
            <div class="gl-form__group">
              <label class="gl-form__label">ふりがな（任意）</label>
              <input class="gl-form__input" data-proxy-kana placeholder="例: たなか">
            </div>
            <button class="gl-btn-primary" data-add>➕ 追加する</button>
          ` : `
            <p class="gl-u-72">上限に達しています</p>
          `}
        </div>
        <button class="gl-u-73" data-close>閉じる</button>
    `;
  }

  /**
   * v3.0.0: 部分更新（handle.rerender で glModal 内部の .gl-modal__content を差替）
   * イベントは差替後に再バインドする
   */
  function _refreshProxyModal(handle) {
    if (!handle || !handle.rerender) return;
    handle.rerender(_renderProxyModalBody());
    _bindProxyModalEvents(handle.root, handle);
  }

  function _bindProxyModalEvents(root, handle) {
    // 閉じるボタン
    var closeBtn = root.querySelector('[data-close]');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () { handle.close(); });
    }
    // 追加ボタン
    var addBtn = root.querySelector('[data-add]');
    if (addBtn) {
      addBtn.addEventListener('click', function () {
        var nameEl = root.querySelector('[data-proxy-name]');
        var kanaEl = root.querySelector('[data-proxy-kana]');
        var name = (nameEl && nameEl.value || '').trim();
        var kana = (kanaEl && kanaEl.value || '').trim();
        if (!name) {
          window.glToast.warn('名前は必須です');
          if (nameEl) nameEl.focus();
          return;
        }
        var player = window.glRound.addProxyPlayer({ familyName: name, familyKana: kana });
        if (player) {
          window.glToast.success(name + ' さんを追加しました');
          _refreshProxyModal(handle);
          _renderIndex();
        }
      });
    }
    // 削除ボタン
    root.querySelectorAll('[data-remove]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        // 現行仕様: browser 標準 confirm() を維持
        if (!confirm('この代理プレイヤーを削除しますか？')) return;
        window.glRound.removeProxyPlayer(btn.dataset.remove);
        window.glToast.info('削除しました');
        _refreshProxyModal(handle);
        _renderIndex();
      });
    });
  }

  /**
   * v2.8.14: ラウンド開始前にコース選択画面を表示
   */
  function _showStartConfirm() {
    // まずコース選択画面を出す
    window.glCourseUI.showMyCourses((selectedCourse) => {
      _confirmStartWithCourse(selectedCourse);
    });
  }

  /**
   * v2.8.15: コース選択後、複数タイプがあればスタートタイプ選択モーダルを出す
   */
  function _confirmStartWithCourse(course) {
    if (!course) {
      _showFinalConfirm(null, null);
      return;
    }
    // タイプが2つ以上ある場合はスタート選択
    if (course.types && course.types.length >= 2) {
      _showStartTypeSelector(course);
    } else {
      // タイプが1つだけならそのまま
      _showFinalConfirm(course, course.types ? course.types[0].name : null);
    }
  }

  /**
   * v3.0.0: スタートタイプ選択モーダル（東 or 西 など、glModal 化）
   */
  function _showStartTypeSelector(course) {
    var typeButtons = course.types.map(function (type, i) {
      return '<button class="gl-btn-primary" data-start-type="' + type.name + '"' +
        ' style="width:100%;margin-bottom:8px;background:' + (i === 0 ? '#1a5f3f' : '#2d7a56') + ';">' +
        '  🌅 ' + type.name + ' スタート' +
        '  <div class="gl-u-74">' +
             type.name + 'コース → ' +
             course.types.filter(function (_, j) { return j !== i; }).map(function (t) { return t.name; }).join(' → ') +
        '  </div>' +
        '</button>';
    }).join('');

    var body = ''
      + '<p class="gl-u-75">'
      +   '<strong>' + course.name + '</strong><br>'
      +   'どちらのコースからスタートしますか？'
      + '</p>'
      + typeButtons
      + '<button class="gl-u-06" data-cancel>キャンセル</button>';

    window.glModal.closeAll();

    var handle = window.glModal.open({
      title: '🏁 スタートを選択',
      modalType: 'start-type',
      body: body,
      dismissible: true,
      showClose: false,
      onBind: function (root) {
        var cancelBtn = root.querySelector('[data-cancel]');
        if (cancelBtn) cancelBtn.addEventListener('click', function () { handle.close(); });

        root.querySelectorAll('[data-start-type]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var startType = btn.dataset.startType;
            handle.close();
            _showFinalConfirm(course, startType);
          });
        });
      },
    });
  }

  /**
   * v2.8.15: 最終確認モーダル → ラウンド開始
   */
  function _showFinalConfirm(course, startType) {
    const stored = window.glProfile.getStored();
    const hostName = stored.familyName || 'ホスト';

    let courseInfo = '';
    if (course) {
      const orderInfo = startType && course.types && course.types.length >= 2
        ? `<br><span class="gl-u-76">🏁 ${startType} スタート</span>`
        : '';
      courseInfo = `<p class="gl-u-77">
        ⛳ <strong>${course.name}</strong><br>
        <span class="gl-u-78">${course.prefecture} | ${course.totalHoles}ホール</span>
        ${orderInfo}
      </p>`;
    }

    _modalPrompt({
      title: '新しいラウンドを開始',
      body: `
        ${courseInfo}
        <p>${hostName}さんがホストとして開始します。</p>
        <p class="gl-u-07">開始後、招待コードが発行されます。</p>
      `,
      okLabel: '開始する',
      onOk: async () => {
        window.glToast.info('ラウンドを開始中...');
        try {
          // v2.8.15: コース + スタートタイプを保存
          if (course) {
            const courseWithStart = { ...course, startType };
            // タイプの並び替え（選択したスタートを先頭に）
            if (startType && course.types && course.types.length >= 2) {
              const startIdx = course.types.findIndex(t => t.name === startType);
              if (startIdx > 0) {
                courseWithStart.types = [
                  course.types[startIdx],
                  ...course.types.filter((_, i) => i !== startIdx),
                ];
              }
            }
            window.glState.set('currentCourse', courseWithStart);
            window.glStorage.writeLocal('gl_current_course_v1', courseWithStart);
          }
          const result = await window.glRound.start(hostName);
          window.glToast.success('ラウンドを開始しました');
          _renderIndex();
          _showInviteModal();
        } catch (err) {
          // errors.handle 済み
        }
      },
    });
  }


  function _showJoinModal() {
    _modalPrompt({
      title: '招待コードで合流',
      body: `
        <p class="gl-u-79">ホストから受け取った4桁コードを入力してください</p>
        <input type="text" class="gl-input-code" id="join-code-input" maxlength="4" placeholder="A123">
      `,
      okLabel: '合流する',
      onOk: async () => {
        const code = (document.getElementById('join-code-input').value || '').trim().toUpperCase();
        if (!code) {
          window.glToast.warn('コードを入力してください');
          return false;
        }
        window.glToast.info('合流中...');
        try {
          await window.glRound.join(code);
          window.glToast.success('合流しました');
          _renderIndex();
          window.glEvents.emit('ui:navigate', { view: 'score' });
        } catch (err) {
          // handled
          return false;
        }
      },
    });
  }

  /**
   * v3.0.0: 招待モーダル（glModal 化、動作は 100% 現行維持）
   * - 既存の invite type モーダルを先に閉じる（多層化防止）
   * - QR生成は handle.root 内の要素に対して行う
   * - groupCode 未取得なら警告して開かない
   */
  function _showInviteModal() {
    // 既存の招待モーダルを全閉じ
    window.glModal.closeByType && window.glModal.closeByType('invite');

    const groupCode = window.glState.get('groupCode');
    if (!groupCode) {
      window.glToast.warn('招待コードが取得できません。ラウンドを開始してください');
      return;
    }

    const joinUrl = location.origin + location.pathname + '?join=' + encodeURIComponent(groupCode);

    var handle = _modalPrompt({
      title: '📤 招待',
      modalType: 'invite',
      body: `
        <div class="gl-invite-box">
          <div class="gl-u-80">招待コード</div>
          <div class="gl-invite-box__code">${groupCode}</div>
          <div class="gl-invite-box__qr" data-qr-container>
            <div class="gl-spinner"></div>
          </div>
          <div class="gl-invite-box__hint">
            QRを読み取るか、コードを入力して合流できます
          </div>
        </div>
      `,
      okLabel: '閉じる',
      onOk: () => true,
    });

    // handle.root（モーダル本体）内の要素に対してQR生成
    if (handle && handle.root) {
      setTimeout(() => {
        const container = handle.root.querySelector('[data-qr-container]');
        if (container) _generateQRInContainer(container, joinUrl);
      }, 50);
    }
  }

  /**
   * v2.7.20: 指定されたコンテナ内にQRを生成
   */
  function _generateQRInContainer(container, url) {
    if (!container) return;
    if (window.QRCode) {
      container.innerHTML = '';
      try {
        new window.QRCode(container, { text: url, width: 180, height: 180, correctLevel: window.QRCode.CorrectLevel.M });
      } catch (e) {
        container.innerHTML = '<div class="gl-u-01">QR生成失敗</div>';
      }
    } else {
      const src = 'https://chart.googleapis.com/chart?chs=180x180&cht=qr&chl=' + encodeURIComponent(url);
      container.innerHTML = `<img src="${src}" width="180" height="180" alt="QR">`;
    }
  }

  function _confirmLeave() {
    _modalPrompt({
      title: 'ラウンドを終了しますか？',
      body: '<p>スコアカードから抜けます。（進行中のスコアは保存されます）</p>',
      okLabel: '終了する',
      onOk: async () => {
        try {
          await window.glRound.leave();
          window.glToast.success('ラウンドを終了しました');
          _renderIndex();
        } catch (err) {}
      },
    });
  }

  // v2.8.23: ラウンド前のコース事前追加
  function _showCourseAdd() {
    if (!window.glCourseUI || !window.glCourseUI.showSearch) {
      window.glToast && window.glToast.warn && window.glToast.warn('コース追加機能が読み込まれていません');
      return;
    }
    window.glCourseUI.showSearch(function (c) {
      window.glToast && window.glToast.info && window.glToast.info('「' + c.name + '」をマイコースに追加しました');
    });
  }

  /**
   * v3.0.0: 汎用モーダル（round.js 内共用）
   *
   * 【後方互換】v2 の _modalPrompt は wrap 要素を返していたため、
   * 呼出側が wrap.querySelector(...) で内部要素にアクセスしていた。
   * v3.0.0 では glModal.open() の handle を返し、handle.root が同じ役割を担う。
   * `wrap` 互換シム: 返却値の .querySelector を handle.root.querySelector に移譲する。
   *
   * onOk が false を返した場合はモーダルを閉じない（現行仕様維持）。
   */
  function _modalPrompt(opts) {
    var title = opts.title;
    var body = opts.body;
    var okLabel = opts.okLabel || 'OK';
    var onOk = opts.onOk;
    var allowClose = (opts.allowClose === undefined) ? true : opts.allowClose;
    var modalType = opts.modalType || '';

    // 既存 .gl-modal を全閉じ（従来仕様: modalRoot.querySelectorAll('.gl-modal').forEach(m => m.remove())）
    window.glModal.closeAll();

    var handle = window.glModal.open({
      title: title,
      body: body + '<button class="gl-btn-primary" data-ok>' + okLabel + '</button>',
      modalType: modalType,
      dismissible: allowClose,
      showClose: false,
      onBind: function (root) {
        var okBtn = root.querySelector('[data-ok]');
        if (okBtn) {
          okBtn.addEventListener('click', async function () {
            var result = onOk ? await onOk() : true;
            if (result !== false) handle.close();
          });
        }
      },
    });

    // 呼出側が handle.root.querySelector で内部要素にアクセスするため、
    // handle 自体を返す（従来の wrap 相当）。既存呼出コードは wrap.querySelector を
    // handle.root.querySelector に読み替えている（invite モーダルのみ利用）。
    return handle;
  }

  const glRoundUI = {
    show() {
      _renderIndex();
      document.getElementById('view-golf')?.classList.add('show');
      window.glState.set('phase', 'S5');
    },
    hide() {
      document.getElementById('view-golf')?.classList.remove('show');
    },
  };

  window.glRoundUI = glRoundUI;
  window.glEvents?.on('round:started', () => _renderIndex());
  window.glEvents?.on('round:joined', () => _renderIndex());
  window.glEvents?.on('round:left', () => _renderIndex());
})();
