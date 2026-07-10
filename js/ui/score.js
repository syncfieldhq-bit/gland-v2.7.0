/**
 * G-LAND v2.7.1 - Score Theme Loader (テーマローダー)
 * ==================================================
 * localStorage の 'gl_score_theme_v1' を読み、該当テーマの show/hide を呼ぶ薄いラッパー。
 * テーマ本体は js/ui/score/*.js に配置。
 *
 * 使用可能テーマ:
 *   - simple  (js/ui/score/simple.js) 1ホール1画面のミニマル
 *   - classic (js/ui/score/classic.js) 本物のスコアカード風・横スクロール
 *
 * テーマは実行時に切替可能。マイページの「スコアカード テーマ切替」から選択。
 */
(function () {
  'use strict';

  const THEME_KEY = 'gl_score_theme_v1';
  const DEFAULT_THEME = 'classic'; // v2.7.1 デフォルトはクラシック
  const AVAILABLE_THEMES = ['simple', 'classic'];

  let currentThemeId = null;
  let currentTheme = null;

  function _getStoredTheme() {
    if (!window.glStorage) return DEFAULT_THEME;
    const t = window.glStorage.readTriple(THEME_KEY);
    if (t && AVAILABLE_THEMES.includes(t)) return t;
    return DEFAULT_THEME;
  }

  function _saveTheme(themeId) {
    if (!AVAILABLE_THEMES.includes(themeId)) return;
    window.glStorage.writeTriple(THEME_KEY, themeId);
  }

  function _resolveTheme(themeId) {
    const themes = window.glScoreThemes || {};
    if (themes[themeId]) return themes[themeId];
    // フォールバック
    if (themes[DEFAULT_THEME]) return themes[DEFAULT_THEME];
    return null;
  }

  const glScoreUI = {
    /**
     * 現在テーマの ID を取得
     */
    getCurrentThemeId() {
      return currentThemeId || _getStoredTheme();
    },

    /**
     * 利用可能なテーマ一覧を取得（マイページの選択肢用）
     */
    listAvailable() {
      const themes = window.glScoreThemes || {};
      return AVAILABLE_THEMES
        .filter((id) => themes[id])
        .map((id) => ({
          id,
          name: themes[id].name || id,
          description: themes[id].description || '',
        }));
    },

    /**
     * テーマ切替（次回 show() から反映）
     */
    setTheme(themeId) {
      if (!AVAILABLE_THEMES.includes(themeId)) {
        console.warn('[glScoreUI] unknown theme:', themeId);
        return false;
      }
      _saveTheme(themeId);
      window.glEvents?.emit('score:theme-changed', { themeId });

      // 現在スコア画面を表示中なら即再表示
      const view = document.getElementById('view-score');
      if (view && view.classList.contains('show')) {
        this.hide();
        this.show();
      }
      return true;
    },

    /**
     * スコア画面表示（現在テーマの show() を呼ぶ）
     */
    show() {
      const themeId = _getStoredTheme();
      const theme = _resolveTheme(themeId);
      if (!theme) {
        console.error('[glScoreUI] no theme available');
        return;
      }
      currentThemeId = themeId;
      currentTheme = theme;
      theme.show();
    },

    /**
     * スコア画面非表示（現在テーマの hide() を呼ぶ）
     */
    hide() {
      if (currentTheme) {
        currentTheme.hide();
      }
      currentTheme = null;
      currentThemeId = null;
    },
  };

  window.glScoreUI = glScoreUI;
})();
