/**
 * G-LAND v3.0.0 - Modal Common Foundation (glModal)
 * ==================================================
 * 全モーダルの生成・表示・閉じる・overlay・スクロール制御・z-index・配置を
 * 一元管理する共通基盤。
 *
 * 【設計原則】
 *   - CSS は css/modal.css に完全集約。ここでは注入しない。
 *   - iOS Safari PWA の位置ズレは css/modal.css 側で解決。
 *   - 各モーダル固有の内容（HTML／ボタン／イベント／保存処理）は
 *     呼出側から options として受け取り、そのまま維持する。
 *   - 既存モーダルとの互換性のため、CSS クラスは `.gl-modal` 系を継続使用。
 *
 * 【使い方】
 *   const handle = window.glModal.open({
 *     title:       '📤 招待',              // 省略可
 *     body:        '<div>...</div>',        // 文字列 or HTMLElement
 *     modalType:   'invite',                // data-modal-type 属性へ（互換用）
 *     variant:     '',                      // 'best' / 'pwa-guide' 等（.gl-modal--variant を付与）
 *     showClose:   true,                    // ×ボタン表示
 *     dismissible: true,                    // 背景クリック / Esc で閉じられるか
 *     actions: [                            // ボタン配列（省略時は表示しない）
 *       { label: '閉じる', kind: 'primary', onClick: (h) => h.close() }
 *     ],
 *     onBind:  (root) => {...},             // レンダ完了後に呼ばれる
 *     onClose: () => {...},                 // 閉じられた後に呼ばれる
 *   });
 *
 *   handle.close();          // プログラムから閉じる
 *   handle.rerender(body);   // 中身を差し替え
 *   handle.root;             // モーダル要素（内部の querySelector 用）
 *
 * 【対象外】
 *   toast、offline badge、install-gate、auth 全画面、glScorePanel（bottom-sheet）、
 *   pwa-guide の独自 fixed 案内、debugbar は対象外。
 */
(function () {
  'use strict';

  var stack = []; // [{root, options}] 開いているモーダルの LIFO

  function _ensureRoot() {
    var root = document.getElementById('modal-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'modal-root';
      document.body.appendChild(root);
    }
    return root;
  }

  function _lockBodyScroll(lock) {
    // スタックが 0 になったら解除。1 以上なら常にロック。
    if (lock) {
      document.documentElement.classList.add('gl-modal-open');
    } else if (stack.length === 0) {
      document.documentElement.classList.remove('gl-modal-open');
    }
  }

  function _renderBody(container, body) {
    if (body === undefined || body === null) return;
    if (typeof body === 'string') {
      container.innerHTML = body;
    } else if (body instanceof HTMLElement) {
      container.innerHTML = '';
      container.appendChild(body);
    } else {
      container.innerHTML = String(body);
    }
  }

  function _buildActionsHTML(actions) {
    if (!Array.isArray(actions) || actions.length === 0) return '';
    var html = '<div class="gl-modal__actions">';
    actions.forEach(function (a, i) {
      var kind = a.kind || 'primary';
      var cls = 'gl-modal__btn gl-modal__btn--' + kind;
      // 後方互換: primary は既存クラス `.gl-btn-primary` も付与
      if (kind === 'primary') cls += ' gl-btn-primary';
      html += '<button type="button" class="' + cls + '" data-gl-action-idx="' + i + '">' +
        (a.label || 'OK') + '</button>';
    });
    html += '</div>';
    return html;
  }

  function _handleEsc(e) {
    if (e.key !== 'Escape') return;
    var top = stack[stack.length - 1];
    if (top && top.options.dismissible !== false) {
      _closeHandle(top);
    }
  }

  function _closeHandle(entry) {
    if (!entry || !entry.root || entry._closed) return;
    entry._closed = true;
    entry.root.classList.remove('show');
    // アニメーション不要（既存互換で即座に remove）
    if (entry.root.parentNode) entry.root.parentNode.removeChild(entry.root);
    // スタックから除去
    var idx = stack.indexOf(entry);
    if (idx >= 0) stack.splice(idx, 1);
    // 全部閉じたら Esc ハンドラ解除・スクロール解放
    if (stack.length === 0) {
      document.removeEventListener('keydown', _handleEsc, true);
      _lockBodyScroll(false);
    }
    try {
      if (typeof entry.options.onClose === 'function') {
        entry.options.onClose();
      }
    } catch (err) {
      console.error('[glModal] onClose error:', err);
    }
  }

  var glModal = {
    /**
     * モーダルを開く
     */
    open: function (options) {
      options = options || {};
      var root = _ensureRoot();

      var wrap = document.createElement('div');
      wrap.className = 'gl-modal';
      if (options.variant) wrap.classList.add('gl-modal--' + options.variant);
      if (options.modalType) wrap.setAttribute('data-modal-type', options.modalType);

      var backdrop = document.createElement('div');
      backdrop.className = 'gl-modal__backdrop';

      var body = document.createElement('div');
      body.className = 'gl-modal__body';
      if (options.bodyClass) body.classList.add(options.bodyClass);
      if (options.width === 'wide') body.classList.add('gl-modal__body--wide');

      // タイトル
      if (options.title) {
        var titleEl = document.createElement('h2');
        titleEl.className = 'gl-modal__title';
        titleEl.innerHTML = options.title;
        body.appendChild(titleEl);
      }

      // × ボタン
      if (options.showClose) {
        var closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'gl-modal__close';
        closeBtn.setAttribute('aria-label', '閉じる');
        closeBtn.innerHTML = '×';
        body.appendChild(closeBtn);
      }

      // 本文
      var content = document.createElement('div');
      content.className = 'gl-modal__content';
      _renderBody(content, options.body);
      body.appendChild(content);

      // アクション（フッターボタン）
      if (Array.isArray(options.actions) && options.actions.length > 0) {
        var actionsWrap = document.createElement('div');
        actionsWrap.innerHTML = _buildActionsHTML(options.actions);
        body.appendChild(actionsWrap.firstChild);
      }

      wrap.appendChild(backdrop);
      wrap.appendChild(body);
      root.appendChild(wrap);

      // ハンドル
      var entry = {
        root: wrap,
        content: content,
        options: options,
        _closed: false,
        close: function () { _closeHandle(entry); },
        rerender: function (newBody) { _renderBody(content, newBody); },
        setActions: function (newActions) {
          var existing = body.querySelector('.gl-modal__actions');
          if (existing) existing.parentNode.removeChild(existing);
          if (Array.isArray(newActions) && newActions.length > 0) {
            entry.options.actions = newActions;
            var w = document.createElement('div');
            w.innerHTML = _buildActionsHTML(newActions);
            body.appendChild(w.firstChild);
            _bindActions();
          }
        },
      };

      function _bindActions() {
        var btns = wrap.querySelectorAll('[data-gl-action-idx]');
        btns.forEach(function (btn) {
          btn.addEventListener('click', function (e) {
            var i = parseInt(btn.getAttribute('data-gl-action-idx'), 10);
            var act = entry.options.actions && entry.options.actions[i];
            if (!act) return;
            try {
              var r = act.onClick ? act.onClick(entry, e) : null;
              if (r && typeof r.then === 'function') {
                btn.disabled = true;
                r.then(function (v) {
                  btn.disabled = false;
                  if (act.autoClose !== false && v !== false) entry.close();
                }).catch(function () { btn.disabled = false; });
              } else {
                if (act.autoClose !== false && r !== false) entry.close();
              }
            } catch (err) {
              console.error('[glModal] action error:', err);
            }
          });
        });
      }

      _bindActions();

      // × / 背景 / Esc
      if (options.showClose) {
        wrap.querySelector('.gl-modal__close').addEventListener('click', entry.close);
      }
      if (options.dismissible !== false) {
        backdrop.addEventListener('click', entry.close);
      }

      // Esc ハンドラは1つだけ
      if (stack.length === 0) {
        document.addEventListener('keydown', _handleEsc, true);
      }

      stack.push(entry);
      _lockBodyScroll(true);

      // 即座に表示
      wrap.classList.add('show');

      // onBind
      try {
        if (typeof options.onBind === 'function') {
          options.onBind(wrap, entry);
        }
      } catch (err) {
        console.error('[glModal] onBind error:', err);
      }

      return entry;
    },

    /**
     * 特定 modalType / variant の全モーダルを閉じる
     */
    closeByType: function (type) {
      stack.slice().forEach(function (e) {
        if (e.root.getAttribute('data-modal-type') === type) _closeHandle(e);
      });
    },

    /**
     * 全モーダルを閉じる
     */
    closeAll: function () {
      stack.slice().forEach(function (e) { _closeHandle(e); });
    },

    /**
     * 現在開いているモーダル数
     */
    count: function () { return stack.length; },
  };

  window.glModal = glModal;
})();
