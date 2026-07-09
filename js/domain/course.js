/**
 * G-LAND v2.7.0 - Course Domain
 * =============================
 * マイコースは localStorage優先（体感速度）
 * 検索は都度サーバー問合せ
 * 該当なし時は運営に依頼（CourseRequestsシートへ追加）
 */
(function () {
  'use strict';

  const MY_COURSES_KEY = 'gl_my_courses_v1';

  function _readMyCourses() {
    const arr = window.glStorage.readLocalJSON(MY_COURSES_KEY);
    return Array.isArray(arr) ? arr : [];
  }

  function _writeMyCourses(arr) {
    window.glStorage.writeLocal(MY_COURSES_KEY, arr);
  }

  const glCourse = {
    /**
     * マイコース一覧（localStorage優先、バックグラウンドで同期）
     */
    async listMyCourses() {
      const cached = _readMyCourses();

      const userId = window.glProfile.getUserId();
      if (userId && navigator.onLine) {
        // バックグラウンド同期
        (async () => {
          try {
            const result = await window.glandApi.listMyCourses({ userId });
            const courses = result?.courses || result || [];
            if (Array.isArray(courses)) {
              _writeMyCourses(courses);
              window.glEvents.emit('course:mycourse-updated', { courses });
            }
          } catch (err) {
            window.glErrors.handle(err, { silent: true, context: 'course.listMy' });
          }
        })();
      }

      return cached;
    },

    /**
     * 全国コース検索
     */
    async search({ prefecture, kana }) {
      try {
        const result = await window.glandApi.searchCourses({ prefecture, kana });
        return result?.courses || result || [];
      } catch (err) {
        window.glErrors.handle(err, { context: 'course.search' });
        return [];
      }
    },

    /**
     * マイコースに追加
     */
    async addMyCourse(course) {
      if (!course || !course.courseId) return;

      // 即localStorage反映
      const arr = _readMyCourses();
      if (!arr.find((c) => c.courseId === course.courseId)) {
        arr.push(course);
        _writeMyCourses(arr);
        window.glEvents.emit('course:mycourse-updated', { courses: arr });
      }

      const userId = window.glProfile.getUserId();
      if (!userId) return { ok: true, offline: true };

      try {
        await window.glandApi.addMyCourse({ userId, courseId: course.courseId });
        return { ok: true };
      } catch (err) {
        window.glErrors.handle(err, { silent: true, context: 'course.addMy' });
        return { ok: true, deferred: true };
      }
    },

    /**
     * 運営にコース追加を依頼
     */
    async requestNewCourse({ name, prefecture, note }) {
      const userId = window.glProfile.getUserId();
      if (!userId) {
        window.glErrors.handle({ code: 'A1' });
        return { ok: false };
      }

      try {
        await window.glandApi.requestCourseAdd({ userId, name, prefecture, note });
        window.glToast.success('運営に追加を依頼しました');
        window.glEvents.emit('course:requested', { name, prefecture });
        return { ok: true };
      } catch (err) {
        window.glErrors.handle(err, { context: 'course.request' });
        return { ok: false };
      }
    },
  };

  window.glCourse = glCourse;
})();
