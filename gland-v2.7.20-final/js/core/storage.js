/**
 * G-LAND v2.7.0 - Triple Storage Layer
 * ====================================
 * localStorage / Cookie / sessionStorage の三重同期を管理する唯一のI/O層。
 * 他モジュールは絶対に直接 localStorage を触らない。必ずこの層を経由すること。
 *
 * 優先度: localStorage > Cookie > sessionStorage
 * iOS/Safari の PWA ストレージ分離問題を回避するための冗長化設計。
 */
(function () {
  'use strict';

  const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1年

  // Cookie に保存する重要キー（それ以外は localStorage のみ）
  const CRITICAL_KEYS = new Set([
    'gl_user_id_v1',
    'gl_profile_lastName',
    'gl_profile_lastNameKana',
    'gl_profile_firstName',
    'gl_profile_firstNameKana',
    'gl_round_id_v1',
    'gl_group_code_v1',
    'gl_fn_dismissed_v1',
  ]);

  function _setCookie(key, val) {
    try {
      const encoded = encodeURIComponent(val);
      document.cookie = `${key}=${encoded}; max-age=${COOKIE_MAX_AGE}; path=/; SameSite=Lax`;
    } catch (e) {
      console.warn('[glStorage] cookie set failed:', e);
    }
  }

  function _getCookie(key) {
    try {
      const cookies = document.cookie.split(';').map((c) => c.trim());
      for (const c of cookies) {
        const eq = c.indexOf('=');
        if (eq === -1) continue;
        if (c.substring(0, eq) === key) {
          return decodeURIComponent(c.substring(eq + 1));
        }
      }
    } catch (e) {
      console.warn('[glStorage] cookie get failed:', e);
    }
    return null;
  }

  function _removeCookie(key) {
    try {
      document.cookie = `${key}=; max-age=0; path=/`;
    } catch (e) {
      /* ignore */
    }
  }

  const glStorage = {
    /**
     * 三重書き込み（重要キーのみCookie併用）
     */
    writeTriple(key, val) {
      if (val === null || val === undefined) {
        this.removeAll(key);
        return;
      }
      const str = typeof val === 'string' ? val : JSON.stringify(val);
      try {
        localStorage.setItem(key, str);
      } catch (e) {
        console.warn('[glStorage] localStorage write failed:', key, e);
      }
      try {
        sessionStorage.setItem(key, str);
      } catch (e) {
        /* ignore */
      }
      if (CRITICAL_KEYS.has(key)) {
        _setCookie(key, str);
      }
    },

    /**
     * 三重読み出し（優先度: local > cookie > session）
     * 復元時に他の層へ書き戻して同期を回復させる
     */
    readTriple(key) {
      let val = null;
      try {
        val = localStorage.getItem(key);
      } catch (e) {
        /* ignore */
      }
      if (val !== null && val !== undefined && val !== '') return val;

      if (CRITICAL_KEYS.has(key)) {
        val = _getCookie(key);
        if (val !== null && val !== undefined && val !== '') {
          // 他の層に書き戻し
          try {
            localStorage.setItem(key, val);
          } catch (e) {
            /* ignore */
          }
          try {
            sessionStorage.setItem(key, val);
          } catch (e) {
            /* ignore */
          }
          return val;
        }
      }

      try {
        val = sessionStorage.getItem(key);
      } catch (e) {
        /* ignore */
      }
      if (val !== null && val !== undefined && val !== '') {
        try {
          localStorage.setItem(key, val);
        } catch (e) {
          /* ignore */
        }
        if (CRITICAL_KEYS.has(key)) _setCookie(key, val);
        return val;
      }
      return null;
    },

    /**
     * JSONとして読み出し
     */
    readTripleJSON(key) {
      const raw = this.readTriple(key);
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch (e) {
        return raw; // 文字列のまま返す
      }
    },

    /**
     * localStorageのみ（非重要データ）
     */
    writeLocal(key, val) {
      if (val === null || val === undefined) {
        try {
          localStorage.removeItem(key);
        } catch (e) {
          /* ignore */
        }
        return;
      }
      const str = typeof val === 'string' ? val : JSON.stringify(val);
      try {
        localStorage.setItem(key, str);
      } catch (e) {
        console.warn('[glStorage] writeLocal failed:', key, e);
      }
    },

    readLocal(key) {
      try {
        return localStorage.getItem(key);
      } catch (e) {
        return null;
      }
    },

    readLocalJSON(key) {
      const raw = this.readLocal(key);
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch (e) {
        return raw;
      }
    },

    /**
     * 全層から削除
     */
    removeAll(key) {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        /* ignore */
      }
      try {
        sessionStorage.removeItem(key);
      } catch (e) {
        /* ignore */
      }
      if (CRITICAL_KEYS.has(key)) _removeCookie(key);
    },

    /**
     * ストレージ健全性チェック（デバッグ用）
     */
    healthCheck() {
      const report = { localStorage: false, sessionStorage: false, cookie: false };
      try {
        localStorage.setItem('__gl_health', '1');
        localStorage.removeItem('__gl_health');
        report.localStorage = true;
      } catch (e) {
        /* ignore */
      }
      try {
        sessionStorage.setItem('__gl_health', '1');
        sessionStorage.removeItem('__gl_health');
        report.sessionStorage = true;
      } catch (e) {
        /* ignore */
      }
      try {
        _setCookie('__gl_health', '1');
        report.cookie = _getCookie('__gl_health') === '1';
        _removeCookie('__gl_health');
      } catch (e) {
        /* ignore */
      }
      return report;
    },
  };

  window.glStorage = glStorage;
})();
