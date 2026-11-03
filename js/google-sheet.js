// js/google-sheet.js — 듀얼 관계형 구글 시트 (학급 담임용 & 교과 담임용) 실시간 연동 매니저
(function() {
  'use strict';

  const STORAGE_HOMEROOM_KEY = 'SR_GAS_HOMEROOM_URL';
  const STORAGE_SUBJECT_KEY = 'SR_GAS_SUBJECT_URL';

  const GoogleSheet = {
    // 학급 담임용 시트 URL
    getHomeroomUrl() {
      return localStorage.getItem(STORAGE_HOMEROOM_KEY) || localStorage.getItem('SR_GAS_SHEET_URL') || '';
    },
    setHomeroomUrl(url) {
      if (!url) localStorage.removeItem(STORAGE_HOMEROOM_KEY);
      else localStorage.setItem(STORAGE_HOMEROOM_KEY, url.trim());
      this.updateStatusBadge();
    },

    // 교과 담임용 시트 URL
    getSubjectUrl() {
      return localStorage.getItem(STORAGE_SUBJECT_KEY) || '';
    },
    setSubjectUrl(url) {
      if (!url) localStorage.removeItem(STORAGE_SUBJECT_KEY);
      else localStorage.setItem(STORAGE_SUBJECT_KEY, url.trim());
      this.updateStatusBadge();
    },

    isConnected() {
      return !!(this.getHomeroomUrl() || this.getSubjectUrl());
    },

    // 연결 테스트
    async ping(type = 'homeroom') {
      const url = type === 'homeroom' ? this.getHomeroomUrl() : this.getSubjectUrl();
      if (!url) return { ok: false, msg: '등록된 구글 시트 Web App URL이 없습니다.' };
      try {
        const res = await fetch(url + (url.includes('?') ? '&' : '?') + 'action=ping');
        const data = await res.json();
        if (data && data.success) {
          return { ok: true, data };
        }
        return { ok: false, msg: data.error || '응답 오류' };
      } catch (err) {
        return { ok: false, msg: '연결 실패: 배포 설정(액세스 권한: 모든 사용자)을 확인하세요.' };
      }
    },

    // 특정 학생의 관계형 데이터 조회 (학번 ID 기반: 희망학과, 목표대학, 기존 상담기록)
    async getStudentRelational(studentId) {
      const url = this.getHomeroomUrl();
      if (!url || !studentId) return null;

      try {
        const res = await fetch(url + (url.includes('?') ? '&' : '?') + 'action=getRelationalData&studentId=' + encodeURIComponent(studentId));
        const data = await res.json();
        if (data && data.success) {
          return data.data;
        }
        return null;
      } catch (err) {
        console.warn('Relational fetch error:', err);
        return null;
      }
    },

    // 상담 기록 및 목표대학/희망학과 시트 실시간 저장
    async saveRecord(record) {
      const hrUrl = this.getHomeroomUrl();
      const subUrl = this.getSubjectUrl();
      const targetUrl = hrUrl || subUrl;
      if (!targetUrl) return null;

      try {
        const payload = {
          action: 'saveRecord',
          studentId: record.studentId || record.stuNumber || '',
          studentName: record.student || record.stuName || '',
          targetUni: record.university || record.targetUni1 || '',
          careerHope: record.careerHope || record.stuMajor || '',
          content: record.content || record.setukMemo || record.counselOpinion || '',
          subject: record.subject || '대입상담'
        };

        const res = await fetch(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        return data;
      } catch (err) {
        console.warn('Google Sheet dual save failed:', err);
        return null;
      }
    },

    updateStatusBadge() {
      const badge = document.getElementById('sheetSyncStatusBadge');
      const label = document.getElementById('sheetSyncStatusLabel');
      if (!badge || !label) return;

      const hasHr = !!this.getHomeroomUrl();
      const hasSub = !!this.getSubjectUrl();

      if (hasHr && hasSub) {
        badge.style.background = '#22c55e';
        label.textContent = '담임·교과 시트 연동';
      } else if (hasHr) {
        badge.style.background = '#3b82f6';
        label.textContent = '담임 시트 연동';
      } else if (hasSub) {
        badge.style.background = '#8b5cf6';
        label.textContent = '교과 시트 연동';
      } else {
        badge.style.background = '#94a3b8';
        label.textContent = '구글 시트 미연결';
      }
    }
  };

  window.GoogleSheet = GoogleSheet;

  document.addEventListener('DOMContentLoaded', () => {
    GoogleSheet.updateStatusBadge();
  });
})();
