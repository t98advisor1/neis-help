// js/google-sheet.js — 나만의 구글 시트 1:1 양방향 실시간 동기화 매니저
(function() {
  'use strict';

  const STORAGE_KEY = 'SR_GAS_SHEET_URL';

  const GoogleSheet = {
    getUrl() {
      return localStorage.getItem(STORAGE_KEY) || '';
    },
    setUrl(url) {
      if (!url) {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, url.trim());
      }
      this.updateStatusBadge();
    },
    isConnected() {
      return !!this.getUrl();
    },
    async ping() {
      const url = this.getUrl();
      if (!url) return { ok: false, msg: '등록된 구글 시트 Web App URL이 없습니다.' };
      try {
        const res = await fetch(url + (url.includes('?') ? '&' : '?') + 'action=ping');
        const data = await res.json();
        if (data && data.success) {
          return { ok: true, data };
        }
        return { ok: false, msg: data.error || '응답 오류' };
      } catch (err) {
        return { ok: false, msg: '연결 실패: Web App 배포 설정(액세스 권한: 모든 사용자)을 확인하세요.' };
      }
    },
    async saveRecord(record) {
      const url = this.getUrl();
      if (!url) return null; // 미연동 시 로컬에만 저장

      try {
        const payload = {
          action: 'saveCounsel',
          studentName: record.student || '',
          targetUni: record.university || '',
          gradeLine: record.gradeLine || '',
          content: record.content || '',
          subject: record.subject || '대입상담',
          overallGrade: record.overallGrade || ''
        };

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        return data;
      } catch (err) {
        console.warn('Google Sheets autosave failed:', err);
        return null;
      }
    },
    updateStatusBadge() {
      const badge = document.getElementById('sheetSyncStatusBadge');
      const label = document.getElementById('sheetSyncStatusLabel');
      if (!badge || !label) return;

      if (this.isConnected()) {
        badge.style.background = '#dcfce7';
        badge.style.color = '#15803d';
        badge.style.borderColor = '#86efac';
        label.textContent = '구글 시트 연동 중';
      } else {
        badge.style.background = '#f1f5f9';
        badge.style.color = '#64748b';
        badge.style.borderColor = '#cbd5e1';
        label.textContent = '구글 시트 미연결';
      }
    }
  };

  window.GoogleSheet = GoogleSheet;

  // DOM 로드 시 뱃지 초기화
  document.addEventListener('DOMContentLoaded', () => {
    GoogleSheet.updateStatusBadge();
  });
})();
