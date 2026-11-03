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

  
        // 2026 최신 기준 종합 대시보드 & 듀얼 관계형 엑셀 (.xlsx) 즉시 생성 및 다운로드
        // 2026 최신 기재요령 규격 & 1·2학기 통합 대시보드 & 탭 수 최소화 관계형 엑셀 (.xlsx) 생성
    GoogleSheet.downloadRelationalExcel = function() {
      if (typeof XLSX === 'undefined') {
        alert('엑셀 생성 라이브러리를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.');
        return;
      }

      const wb = XLSX.utils.book_new();

      // 탭 1: 0_공지사항_사용안내
      const noticeData = [
        ["2026학년도 학교생활기록부 & 대입진학상담 관계형 마스터 서식 (학급담임용)"],
        ["저작권: math-tong | 2026 교육부 기재요령 바이트(Byte) 및 훈령 표준 완전 적용"],
        [],
        ["[탭 바로가기 및 구조 안내 - 탭 수 최소화 5대 탭 체계]"],
        ["1. '0_공지사항_사용안내': 본 서식 사용법, 나이스 바이트 기준, 탭 바로가기 링크"],
        ["2. '1_학급_종합대시보드': [핵심] 학생 명렬표 등록 ➔ 1학기·2학기 세특 및 창체, 대입상담 현황 한눈에 파악"],
        ["3. '2_교과세특_1·2학기통합': 과세특(1,500 Byte) 1·2학기 기록, 나이스 3단논법, 실시간 바이트 자동계산"],
        ["4. '3_창의적체험활동_통합': 자율(1,500 Byte), 동아리(1,500 Byte), 진로(2,100 Byte) 다부서 자동 취합"],
        ["5. '4_대입상담_진학기록': 1~6지망 목표대학, 9등급 내신, 2028 개편 5등급제 환산, Google Docs 일지 연계"],
        [],
        ["[2026 나이스 기재요령 공식 바이트 기준]"],
        ["• 과목별 세특: 과목당 1,500 Byte (한글 500자) | • 개인별 세특: 1,500 Byte (한글 500자)"],
        ["• 자율활동: 1,500 Byte (한글 500자) | • 동아리활동: 1,500 Byte (한글 500자) | • 진로활동: 2,100 Byte (한글 700자)"],
        ["• 행동특성 및 종합의견: 1,500 Byte (한글 500자) | 종결어미: '~함', '~임' 개조식 준수, 금지어 자동 배제"]
      ];
      const wsNotice = XLSX.utils.aoa_to_sheet(noticeData);
      wsNotice['!cols'] = [{ wch: 85 }];
      XLSX.utils.book_append_sheet(wb, wsNotice, "0_공지사항_사용안내");

      // 탭 2: 1_학급_종합대시보드 (1학기·2학기 한눈에 보는 대시보드 + 탭 바로가기 링크)
      const dashData = [
        ["2026학년도 학급 종합 대시보드 (1학기·2학기 통합 컨트롤타워)"],
        ["* [사용법] B열과 C열에 학생 명렬표(학번, 성명)를 넣으면 1학기·2학기 세특과 창체, 목표대학이 실시간 자동 집계됩니다."],
        [],
        [
          "번호", "학번(ID)", "성명", "희망학과·진로",
          "1학기 세특(바이트)", "2학기 세특(바이트)", "세특 바로가기",
          "자율(1500B)", "동아리(1500B)", "진로(2100B)",
          "1지망 목표대학", "2028 5등급환산", "상담 바로가기", "종합 진행률"
        ],
        [
          1, "20101", "김태형", "생명공학과 (바이오신약)",
          { f: "IFERROR(VLOOKUP(B4, '2_교과세특_1·2학기통합'!A:G, 7, FALSE), 0)" },
          { f: "IFERROR(VLOOKUP(B4, '2_교과세특_1·2학기통합'!A:H, 8, FALSE), 0)" },
          { f: 'HYPERLINK("#\'2_교과세특_1·2학기통합\'!A2", "[✏️ 세특 기록]")' },
          { f: "COUNTIFS('3_창의적체험활동_통합'!A:A, B4, '3_창의적체험활동_통합'!C:C, \"자율활동\")" },
          { f: "COUNTIFS('3_창의적체험활동_통합'!A:A, B4, '3_창의적체험활동_통합'!C:C, \"동아리활동\")" },
          { f: "COUNTIFS('3_창의적체험활동_통합'!A:A, B4, '3_창의적체험활동_통합'!C:C, \"진로활동\")" },
          { f: "IFERROR(VLOOKUP(B4, '4_대입상담_진학기록'!A:C, 3, FALSE), \"미상담\")" },
          { f: "IFERROR(VLOOKUP(B4, '4_대입상담_진학기록'!A:J, 10, FALSE), \"-\")" },
          { f: 'HYPERLINK("#\'4_대입상담_진학기록\'!A2", "[📋 상담 일지]")' },
          "100%"
        ],
        [
          2, "20102", "박서준", "컴퓨터공학과 (인공지능·빅데이터)",
          { f: "IFERROR(VLOOKUP(B5, '2_교과세특_1·2학기통합'!A:G, 7, FALSE), 0)" },
          { f: "IFERROR(VLOOKUP(B5, '2_교과세특_1·2학기통합'!A:H, 8, FALSE), 0)" },
          { f: 'HYPERLINK("#\'2_교과세특_1·2학기통합\'!A3", "[✏️ 세특 기록]")' },
          { f: "COUNTIFS('3_창의적체험활동_통합'!A:A, B5, '3_창의적체험활동_통합'!C:C, \"자율활동\")" },
          { f: "COUNTIFS('3_창의적체험활동_통합'!A:A, B5, '3_창의적체험활동_통합'!C:C, \"동아리활동\")" },
          { f: "COUNTIFS('3_창의적체험활동_통합'!A:A, B5, '3_창의적체험활동_통합'!C:C, \"진로활동\")" },
          { f: "IFERROR(VLOOKUP(B5, '4_대입상담_진학기록'!A:C, 3, FALSE), \"미상담\")" },
          { f: "IFERROR(VLOOKUP(B5, '4_대입상담_진학기록'!A:J, 10, FALSE), \"-\")" },
          { f: 'HYPERLINK("#\'4_대입상담_진학기록\'!A3", "[📋 상담 일지]")' },
          "50%"
        ],
        [
          3, "20103", "이지은", "경영학과 (빅데이터 마케팅)",
          { f: "IFERROR(VLOOKUP(B6, '2_교과세특_1·2학기통합'!A:G, 7, FALSE), 0)" },
          { f: "IFERROR(VLOOKUP(B6, '2_교과세특_1·2학기통합'!A:H, 8, FALSE), 0)" },
          { f: 'HYPERLINK("#\'2_교과세특_1·2학기통합\'!A4", "[✏️ 세특 기록]")' },
          { f: "COUNTIFS('3_창의적체험활동_통합'!A:A, B6, '3_창의적체험활동_통합'!C:C, \"자율활동\")" },
          { f: "COUNTIFS('3_창의적체험활동_통합'!A:A, B6, '3_창의적체험활동_통합'!C:C, \"동아리활동\")" },
          { f: "COUNTIFS('3_창의적체험활동_통합'!A:A, B6, '3_창의적체험활동_통합'!C:C, \"진로활동\")" },
          { f: "IFERROR(VLOOKUP(B6, '4_대입상담_진학기록'!A:C, 3, FALSE), \"미상담\")" },
          { f: "IFERROR(VLOOKUP(B6, '4_대입상담_진학기록'!A:J, 10, FALSE), \"-\")" },
          { f: 'HYPERLINK("#\'4_대입상담_진학기록\'!A4", "[📋 상담 일지]")' },
          "0%"
        ]
      ];
      const wsDash = XLSX.utils.aoa_to_sheet(dashData);
      wsDash['!cols'] = [
        { wch: 6 }, { wch: 11 }, { wch: 12 }, { wch: 28 },
        { wch: 18 }, { wch: 18 }, { wch: 15 },
        { wch: 14 }, { wch: 14 }, { wch: 14 },
        { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 12 }
      ];
      XLSX.utils.book_append_sheet(wb, wsDash, "1_학급_종합대시보드");

      // 탭 3: 2_교과세특_1·2학기통합 (1·2학기 분리 탭을 하나로 통합하여 탭 최소화)
      const setukData = [
        [
          "학번", "성명(자동연계)", "학기선택", "교과목명",
          "수행활동·탐구주제", "학생개별역량",
          "나이스 3단 세특 초안 (과목당 1500 Byte 이내, ~함)", "실시간 글자수(Byte, 자동계산)", "기준한도(Byte)"
        ],
        [
          "20101",
          { f: "IF(A2=\"\",\"\",IFERROR(VLOOKUP(A2,'1_학급_종합대시보드'!B:C,2,FALSE),\"미등록\"))" },
          "1학기", "생명과학Ⅰ",
          "삼투현상과 세포막 선택적 투과성", "현미경 정밀 관찰 및 가설 검증력",
          "농도 차이에 따른 삼투압 원리를 탐구하고자 가설을 설정하고 양파 표피세포 원형질 분리 현상을 현미경으로 정밀 관찰함. 선택적 투과성 원리를 세포막 인지질 이중층 구조와 연결하여 논리적으로 규명하고 결론을 도출함.",
          { f: "IF(G2=\"\",0,LENB(G2))" },
          1500
        ],
        [
          "20101",
          { f: "IF(A3=\"\",\"\",IFERROR(VLOOKUP(A3,'1_학급_종합대시보드'!B:C,2,FALSE),\"미등록\"))" },
          "2학기", "생명과학Ⅰ",
          "유전체 분석과 CRISPR 유전자 가위 기술", "최신 바이오 기술 원리 분석 및 생명윤리 고찰",
          "유전자 교정 기술의 메커니즘을 조사하고 난치성 유전 질환 치료 적용 사례를 탐색함. 유전자 편집의 과학적 유용성과 생명윤리적 쟁점을 다각도로 분석하여 균형 잡힌 시각을 정립함.",
          { f: "IF(G3=\"\",0,LENB(G3))" },
          1500
        ],
        [
          "20102",
          { f: "IF(A4=\"\",\"\",IFERROR(VLOOKUP(A4,'1_학급_종합대시보드'!B:C,2,FALSE),\"미등록\"))" },
          "1학기", "정보",
          "정렬 알고리즘의 시간복잡도 비교 분석", "파이썬 구현 및 성능 빅데이터 분석력",
          "버블 정렬과 퀵 정렬의 시간복잡도를 파이썬 코드로 직접 구현하고 데이터 규모에 따른 실행 시간을 정량 비교함. 알고리즘 최적화의 중요성을 깊이 이해하고 실생활 문제 해결에 컴퓨팅 사고력을 발휘함.",
          { f: "IF(G4=\"\",0,LENB(G4))" },
          1500
        ]
      ];
      const wsSetuk = XLSX.utils.aoa_to_sheet(setukData);
      wsSetuk['!cols'] = [
        { wch: 11 }, { wch: 13 }, { wch: 10 }, { wch: 14 },
        { wch: 32 }, { wch: 30 }, { wch: 65 }, { wch: 18 }, { wch: 14 }
      ];
      XLSX.utils.book_append_sheet(wb, wsSetuk, "2_교과세특_1·2학기통합");

      // 탭 4: 3_창의적체험활동_통합 (자율 1500B / 동아리 1500B / 진로 2100B 1개 탭 통합)
      const clubData = [
        [
          "학번", "성명(자동연계)", "활동영역", "부서명(활동명)", "활동일자",
          "수행활동 및 성장기록 (나이스 규격)", "글자수(Byte, 자동계산)", "영역별 한도(Byte)"
        ],
        [
          "20101",
          { f: "IF(A2=\"\",\"\",IFERROR(VLOOKUP(A2,'1_학급_종합대시보드'!B:C,2,FALSE),\"미등록\"))" },
          "동아리활동", "생명과학탐구반", "2026-05-12",
          "교내 학술제에서 바이오 플라스틱 생분해 실험을 주도적으로 진행하고 결과를 전교생 대상 발표로 성공적으로 공유함.",
          { f: "IF(F2=\"\",0,LENB(F2))" },
          1500
        ],
        [
          "20101",
          { f: "IF(A3=\"\",\"\",IFERROR(VLOOKUP(A3,'1_학급_종합대시보드'!B:C,2,FALSE),\"미등록\"))" },
          "진로활동", "바이오신약 진로비전캠프", "2026-06-20",
          "바이오의약 분야 진로 멘토링에 참여하여 신약 합성 프로세스를 학습하고 학업 진로 로드맵을 체계적으로 수립함.",
          { f: "IF(F3=\"\",0,LENB(F3))" },
          2100
        ],
        [
          "20101",
          { f: "IF(A4=\"\",\"\",IFERROR(VLOOKUP(A4,'1_학급_종합대시보드'!B:C,2,FALSE),\"미등록\"))" },
          "자율활동", "학급자치 및 과학도서 토론", "2026-04-18",
          "학급 도서 토론회를 기획하여 생명과학 윤리 도서를 급우들과 함께 읽고 활발한 상호 토의를 주도함.",
          { f: "IF(F4=\"\",0,LENB(F4))" },
          1500
        ]
      ];
      const wsClub = XLSX.utils.aoa_to_sheet(clubData);
      wsClub['!cols'] = [
        { wch: 11 }, { wch: 13 }, { wch: 14 }, { wch: 22 }, { wch: 13 },
        { wch: 65 }, { wch: 18 }, { wch: 16 }
      ];
      XLSX.utils.book_append_sheet(wb, wsClub, "3_창의적체험활동_통합");

      // 탭 5: 4_대입상담_진학기록 (목표대학 1~6지망 & 2028 5등급제 환산 & Google Docs)
      const counselData = [
        [
          "학번", "성명(자동연계)", "1지망", "2지망", "3지망", "4지망", "5지망", "6지망",
          "내신(9등급)", "2028환산(5등급)", "상담기록 핵심메모", "Google Docs 일지링크"
        ],
        [
          "20101",
          { f: "IF(A2=\"\",\"\",IFERROR(VLOOKUP(A2,'1_학급_종합대시보드'!B:C,2,FALSE),\"미등록\"))" },
          "고려대(학우)", "성균관대(융합)", "한양대(추천)", "중앙대(CAU)", "경희대(네오)", "건국대(KU)",
          1.85, 1.48, "수능최저 충족 가능성 높음. 탐구실험 역량을 세특에 집중 부각하도록 지도함.",
          { f: 'HYPERLINK("https://docs.google.com", "[📄 구글독스 상담일지]")' }
        ]
      ];
      const wsCounsel = XLSX.utils.aoa_to_sheet(counselData);
      wsCounsel['!cols'] = [
        { wch: 11 }, { wch: 13 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 },
        { wch: 12 }, { wch: 15 }, { wch: 45 }, { wch: 20 }
      ];
      XLSX.utils.book_append_sheet(wb, wsCounsel, "4_대입상담_진학기록");

      // 파일 다운로드 실행
      const fileName = `2026_관계형_학교생활기록부_마스터서식_${new Date().toISOString().slice(0,10)}.xlsx`;
      XLSX.writeFile(wb, fileName);
    };

  window.GoogleSheet = GoogleSheet;

  document.addEventListener('DOMContentLoaded', () => {
    GoogleSheet.updateStatusBadge();
  });
})();
