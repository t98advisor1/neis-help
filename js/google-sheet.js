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

  
    // 관계형 엑셀 (.xlsx) 즉시 생성 및 다운로드 (자동 바이트 계산 & 학번-이름 VLOOKUP 연계)
    GoogleSheet.downloadRelationalExcel = function() {
      if (typeof XLSX === 'undefined') {
        alert('엑셀 생성 라이브러리를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.');
        return;
      }

      const wb = XLSX.utils.book_new();

      // 1. 0_사용안내_공지
      const noticeData = [
        ["학교생활기록부 올인원: 상담부터 기록까지 — 관계형 엑셀 표준 서식"],
        ["저작권: math-tong | 본 서식은 학교 현장의 담임·교과 교사를 위해 무료로 배포됩니다."],
        [],
        ["[주요 기능 및 사용법 안내]"],
        ["1. '1_학급명렬표' 탭에 학번과 학생 성명을 붙여넣으면, 나머지 모든 탭에서 학번만 입력해도 이름이 자동 연계(VLOOKUP)됩니다."],
        ["2. '2_교과세특_초안' 탭에서는 세특 문장을 입력하거나 붙여넣는 즉시 바이트(Byte)가 자동 계산됩니다."],
        ["3. '3_창체_동아리_진로' 탭은 여러 동아리나 진로 활동을 부서별로 입력하면 학번별로 취합할 수 있습니다."],
        ["4. '4_대입상담_목표대학' 탭에서는 학생별 1~6지망 목표대학과 상담 메모가 나이스 세특과 1:1로 연계됩니다."],
        ["5. 작성한 내용은 https://neis-help-one.vercel.app [생기부 점검하기]에 올려 나이스 1,500 Byte 초과 및 금지어를 1초 만에 검증하세요!"]
      ];
      const wsNotice = XLSX.utils.aoa_to_sheet(noticeData);
      wsNotice['!cols'] = [{ wch: 80 }];
      XLSX.utils.book_append_sheet(wb, wsNotice, "0_사용안내_공지");

      // 2. 1_학급명렬표
      const rosterData = [
        ["번호", "학번", "성명", "희망학과", "진로분야", "특기사항_메모"],
        [1, "20101", "김태형", "생명공학과", "바이오메디컬", "생명과학 실험 관심 높음"],
        [2, "20102", "박서준", "컴퓨터공학과", "인공지능·빅데이터", "프로그래밍 논리력 우수"],
        [3, "20103", "이지은", "경영학과", "마케팅·기획", "의사소통 및 프로젝트 조율 탁월"],
        [4, "20104", "정호석", "기계공학과", "로봇·미래모빌리티", "물리 역학 탐구 열정적"],
        [5, "20105", "최우식", "의예과", "뇌신경과학", "학업역량 및 탐구 지속성 우수"]
      ];
      const wsRoster = XLSX.utils.aoa_to_sheet(rosterData);
      wsRoster['!cols'] = [{ wch: 8 }, { wch: 12 }, { wch: 14 }, { wch: 18 }, { wch: 22 }, { wch: 30 }];
      XLSX.utils.book_append_sheet(wb, wsRoster, "1_학급명렬표");

      // 3. 2_교과세특_초안
      const setukData = [
        ["학번", "성명(자동연계)", "교과목", "수행활동·탐구주제", "학생개별역량", "나이스 세특 초안 (동기-과정-성장)", "글자수(Byte, 자동계산)"],
        [
          "20101",
          { f: "IF(A2=\"\",\"\",IFERROR(VLOOKUP(A2,'1_학급명렬표'!B:C,2,FALSE),\"미등록\"))" },
          "생명과학Ⅰ",
          "삼투현상과 세포막 선택적 투과성",
          "현미경 실험 정밀 관찰 및 가설 검증",
          "농도 차이에 따른 삼투압 원리를 탐구하고자 가설을 설정하고 양파 표피세포 원형질 분리 현상을 현미경으로 정밀 관찰함. 선택적 투과성 원리를 세포 수준에서 논리적으로 규명하고 결론을 도출함.",
          { f: "IF(F2=\"\",0,LENB(F2))" }
        ],
        [
          "20102",
          { f: "IF(A3=\"\",\"\",IFERROR(VLOOKUP(A3,'1_학급명렬표'!B:C,2,FALSE),\"미등록\"))" },
          "정보",
          "정렬 알고리즘의 시간복잡도 비교",
          "파이썬 구현 및 성능 빅데이터 분석",
          "버블 정렬과 퀵 정렬의 시간복잡도를 파이썬 코드로 구현하고 데이터 규모에 따른 실행 시간을 정량 비교함. 알고리즘 최적화의 중요성을 깊이 이해하고 컴퓨팅 사고력을 발휘함.",
          { f: "IF(F3=\"\",0,LENB(F3))" }
        ]
      ];
      const wsSetuk = XLSX.utils.aoa_to_sheet(setukData);
      wsSetuk['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 30 }, { wch: 30 }, { wch: 60 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, wsSetuk, "2_교과세특_초안");

      // 4. 3_창체_동아리_진로
      const clubData = [
        ["학번", "성명(자동연계)", "영역구분", "활동부서명", "활동일자", "수행활동 및 성장기록"],
        [
          "20101",
          { f: "IF(A2=\"\",\"\",IFERROR(VLOOKUP(A2,'1_학급명렬표'!B:C,2,FALSE),\"미등록\"))" },
          "동아리활동",
          "생명과학탐구반",
          "2026-05-12",
          "교내 학술제에서 바이오 플라스틱 분해 실험을 주도적으로 진행하여 전교생 대상 발표를 성공적으로 마침."
        ],
        [
          "20101",
          { f: "IF(A3=\"\",\"\",IFERROR(VLOOKUP(A3,'1_학급명렬표'!B:C,2,FALSE),\"미등록\"))" },
          "진로활동",
          "진로비전캠프",
          "2026-06-20",
          "바이오의약 분야 진로 멘토링에 참여하여 의약품 합성 프로세스를 학습하고 진로 로드맵을 체계화함."
        ]
      ];
      const wsClub = XLSX.utils.aoa_to_sheet(clubData);
      wsClub['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 20 }, { wch: 14 }, { wch: 60 }];
      XLSX.utils.book_append_sheet(wb, wsClub, "3_창체_동아리_진로");

      // 5. 4_대입상담_목표대학
      const counselData = [
        ["학번", "성명(자동연계)", "1지망", "2지망", "3지망", "4지망", "5지망", "6지망", "내신(9등급)", "환산(5등급)", "상담기록_핵심메모"],
        [
          "20101",
          { f: "IF(A2=\"\",\"\",IFERROR(VLOOKUP(A2,'1_학급명렬표'!B:C,2,FALSE),\"미등록\"))" },
          "고려대(학우)", "성균관대(융합)", "한양대(추천)", "중앙대(CAU)", "경희대(네오)", "건국대(KU)",
          1.85, 1.48, "수능최저 충족 가능성 높음. 탐구실험 역량을 세특에 집중 부각하도록 지도함."
        ]
      ];
      const wsCounsel = XLSX.utils.aoa_to_sheet(counselData);
      wsCounsel['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 45 }];
      XLSX.utils.book_append_sheet(wb, wsCounsel, "4_대입상담_목표대학");

      // 파일 다운로드
      const fileName = `2026_관계형_학교생활기록부_올인원서식_${new Date().toISOString().slice(0,10)}.xlsx`;
      XLSX.writeFile(wb, fileName);
    };

  window.GoogleSheet = GoogleSheet;

  document.addEventListener('DOMContentLoaded', () => {
    GoogleSheet.updateStatusBadge();
  });
})();
