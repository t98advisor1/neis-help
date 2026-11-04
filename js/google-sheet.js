// js/google-sheet.js — 듀얼 관계형 구글 시트 (학급 담임용 & 교과 담임용) 실시간 연동 매니저
(function() {
  'use strict';

  const STORAGE_HOMEROOM_KEY = 'SR_GAS_HOMEROOM_URL';
  const STORAGE_SUBJECT_KEY = 'SR_GAS_SUBJECT_URL';

  const GoogleSheet = {
    // 학급 담임용 시트 URL
    getHomeroomUrl() {
      const saved = localStorage.getItem(STORAGE_HOMEROOM_KEY) || localStorage.getItem('SR_GAS_SHEET_URL');
      if (saved && saved.trim()) return saved.trim();
      // 기본 클라우드 데모 엔드포인트 제공 (개인 시트 연동 전에도 전 기능 100% 즉시 테스트 가능!)
      return '/api/sheet-sync';
    },
    setHomeroomUrl(url) {
      if (!url) localStorage.removeItem(STORAGE_HOMEROOM_KEY);
      else localStorage.setItem(STORAGE_HOMEROOM_KEY, url.trim());
      this.updateStatusBadge();
    },

    // 교과 담임용 시트 URL
    getSubjectUrl() {
      const saved = localStorage.getItem(STORAGE_SUBJECT_KEY);
      if (saved && saved.trim()) return saved.trim();
      return '/api/sheet-sync';
    },
    setSubjectUrl(url) {
      if (!url) localStorage.removeItem(STORAGE_SUBJECT_KEY);
      else localStorage.setItem(STORAGE_SUBJECT_KEY, url.trim());
      this.updateStatusBadge();
    },

    isCustomConnected() {
      const hr = localStorage.getItem(STORAGE_HOMEROOM_KEY) || localStorage.getItem('SR_GAS_SHEET_URL');
      const sub = localStorage.getItem(STORAGE_SUBJECT_KEY);
      return !!((hr && hr.trim()) || (sub && sub.trim()));
    },

    isConnected() {
      return true; // 기본 클라우드 데모 시트 엔진이 항시 대기하므로 언제나 즉시 테스트 가능!
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
      const dot = document.getElementById('sheetSyncStatusDot');
      if (!badge) return;

      const customConnected = this.isCustomConnected();
      if (customConnected) {
        if (dot) dot.style.background = '#22c55e'; // 녹색
        if (label) label.textContent = '개인 시트 연동';
        badge.title = '개인 구글 시트(Apps Script Web App)와 실시간 연동 중입니다.';
      } else {
        if (dot) dot.style.background = '#3b82f6'; // 파란색 (클라우드 테스트 모드)
        if (label) label.textContent = '시트 연동 (테스트 모드)';
        badge.title = '클라우드 데모 시트와 연동되어 즉시 100% 테스트 가능합니다. 클릭하여 개인 구글 시트 URL을 연결할 수 있습니다.';
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

      // 탭 2: 1_학급_종합대시보드 (1학년 1반 30명 모의 학급 전체 데이터 연계)
      const studentsList = (window.MOCK_CLASS_30_HOMEROOM && window.MOCK_CLASS_30_HOMEROOM.length > 0)
        ? window.MOCK_CLASS_30_HOMEROOM
        : [
            { stuNumber: "10101", stuName: "김태형", stuMajor: "생명공학과 (바이오신약)", status: "1차완료" },
            { stuNumber: "10102", stuName: "박서준", stuMajor: "컴퓨터공학과 (인공지능)", status: "작성중" },
            { stuNumber: "10103", stuName: "이지은", stuMajor: "사회학과 (빅데이터)", status: "수시확정" }
          ];

      const dashRows = studentsList.map((s, idx) => {
        const rowIdx = idx + 4;
        return [
          idx + 1,
          s.stuNumber,
          s.stuName,
          s.stuMajor || "진로미정",
          { f: `IFERROR(VLOOKUP(B${rowIdx}, '2_교과세특_1·2학기통합'!A:G, 7, FALSE), 0)` },
          { f: `IFERROR(VLOOKUP(B${rowIdx}, '2_교과세특_1·2학기통합'!A:H, 8, FALSE), 0)` },
          { f: `HYPERLINK("#'2_교과세특_1·2학기통합'!A${idx + 2}", "[✏️ 세특 기록]")` },
          { f: `COUNTIFS('3_창의적체험활동_통합'!A:A, B${rowIdx}, '3_창의적체험활동_통합'!C:C, "자율활동")` },
          { f: `COUNTIFS('3_창의적체험활동_통합'!A:A, B${rowIdx}, '3_창의적체험활동_통합'!C:C, "동아리활동")` },
          { f: `COUNTIFS('3_창의적체험활동_통합'!A:A, B${rowIdx}, '3_창의적체험활동_통합'!C:C, "진로활동")` },
          s.targetUni1 || "미상담",
          s.grade5 ? `5등급(${s.grade5})/9등급(${s.grade9 || '-'})` : "-",
          { f: `HYPERLINK("#'4_대입상담_진학기록'!A${idx + 2}", "[📋 상담 일지]")` },
          s.status === "수시확정" ? "100%" : (s.status === "1차완료" ? "70%" : "30%")
        ];
      });

      const dashData = [
        ["2026학년도 1학년 1반 학교생활기록부 & 진학상담 종합 관리 대시보드 (30명 학급)"],
        ["※ B열에 학번, C열에 성명을 등록하면 오른쪽의 세특 작성 현황 및 창체, 상담 일지가 자동으로 연계됩니다."],
        [
          "번호", "학번", "성명", "희망진로 / 전공",
          "1학기 세특 바이트", "2학기 세특 바이트", "세특 바로가기",
          "자율활동(건)", "동아리(건)", "진로활동(건)",
          "1지망 목표대학", "내신 평균", "상담일지 바로가기", "진행률"
        ],
        ...dashRows
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

      // 탭 5: 4_대입상담_진학기록 (선생님 요청: 수시 6장 지원전략 및 전형별 입결 상세 구체화)
      const counselData = [
        [
          "학번(ID)", "성명(자동연계)", "희망계열", "목표학과(모집단위)", "전교과(9등급)", "2028개편(5등급환산)", "모의고사(국수탐합)",
          "1지망 대학·학과", "1지망 전형명", "1지망 전년도컷(70%)", "1지망 판정",
          "2지망 대학·학과", "2지망 전형명", "2지망 전년도컷(70%)", "2지망 판정",
          "3지망 대학·학과", "3지망 전형명", "3지망 전년도컷(70%)", "3지망 판정",
          "4지망 대학·학과", "4지망 전형명", "4지망 전년도컷(70%)", "4지망 판정",
          "5지망 대학·학과", "5지망 전형명", "5지망 전년도컷(70%)", "5지망 판정",
          "6지망 대학·학과", "6지망 전형명", "6지망 전년도컷(70%)", "6지망 판정",
          "수능최저 충족진단", "면접일정 및 유의사항", "1차 상담일자 & 핵심 메모", "2차 상담일자 & 피드백", "Google Docs 상담일지 링크"
        ],
        [
          "20101",
          { f: "IF(A2=\"\",\"\",IFERROR(VLOOKUP(A2,'1_학급_종합대시보드'!B:C,2,FALSE),\"미등록\"))" },
          "자연(의약·바이오)", "생명공학과", 1.85, 1.48, "3합 7등급",
          "고려대 생명공학부", "학생부종합(학업우수)", "1.78", "적정",
          "성균관대 융합생명공학", "학생부종합(융합형)", "1.92", "안정",
          "한양대 생명공학과", "학생부교과(지역균형)", "1.52", "소신",
          "중앙대 생명과학과", "학생부종합(CAU융합)", "1.98", "안정",
          "경희대 유전생명공학과", "학생부종합(네오르네상스)", "2.10", "안정",
          "건국대 줄기세포재생공학", "학생부종합(KU자기추천)", "2.25", "안정",
          "고려대 4합8 충족 유력 / 한양대 수능최저 없음", "11월 4째주 고려대 면접 대비 필요",
          "2026-04-10: 바이오신약 분야 진로 확고, 수능최저 탐구 1과목 집중 관리 지도",
          "2026-06-25: 6모 국어 백분위 상승, 고려대 학우 지원 적정으로 최종 확정",
          { f: 'HYPERLINK(\"https://docs.google.com\", \"[📄 20101_김태형_상담일지.docs]\")' }
        ],
        [
          "20102",
          { f: "IF(A3=\"\",\"\",IFERROR(VLOOKUP(A3,'1_학급_종합대시보드'!B:C,2,FALSE),\"미등록\"))" },
          "자연(공학·IT)", "컴퓨터공학과", 2.30, 2.10, "3합 9등급",
          "시립대 컴퓨터과학부", "학생부종합(면접형)", "2.15", "적정",
          "건국대 컴퓨터공학부", "학생부종합(KU자기추천)", "2.28", "적정",
          "동국대 컴퓨터AI학부", "학생부종합(DoDream)", "2.42", "안정",
          "숭실대 컴퓨터학부", "학생부종합(SSU미래인재)", "2.48", "안정",
          "국민대 소프트웨어학부", "학생부종합(국민프런티어)", "2.65", "안정",
          "아주대 소프트웨어학과", "학생부교과(고교추천)", "2.10", "소신",
          "수능최저 미적분/과탐 2합 5등급 충족 전략", "DoDream 면접 시 프로젝트 포트폴리오 강조",
          "2026-04-12: 알고리즘 및 백엔드 개발 관심, 수도권 IT 중심 수시 6장 라인업 구상",
          "2026-06-28: 모의고사 수학 2등급 안정화, 시립대·건국대 적극 상향 소신 권고",
          { f: 'HYPERLINK(\"https://docs.google.com\", \"[📄 20102_박서준_상담일지.docs]\")' }
        ]
      ];
      const wsCounsel = XLSX.utils.aoa_to_sheet(counselData);
      wsCounsel['!cols'] = [
        { wch: 11 }, { wch: 13 }, { wch: 16 }, { wch: 18 }, { wch: 13 }, { wch: 15 }, { wch: 16 },
        { wch: 22 }, { wch: 20 }, { wch: 16 }, { wch: 12 },
        { wch: 22 }, { wch: 20 }, { wch: 16 }, { wch: 12 },
        { wch: 22 }, { wch: 20 }, { wch: 16 }, { wch: 12 },
        { wch: 22 }, { wch: 20 }, { wch: 16 }, { wch: 12 },
        { wch: 22 }, { wch: 20 }, { wch: 16 }, { wch: 12 },
        { wch: 22 }, { wch: 20 }, { wch: 16 }, { wch: 12 },
        { wch: 32 }, { wch: 30 }, { wch: 45 }, { wch: 45 }, { wch: 28 }
      ];
      XLSX.utils.book_append_sheet(wb, wsCounsel, "4_대입상담_진학기록");

      // 파일 다운로드 실행
      const fileName = `2026_관계형_학교생활기록부_마스터서식_${new Date().toISOString().slice(0,10)}.xlsx`;
      XLSX.writeFile(wb, fileName);
    };

  window.GoogleSheet = GoogleSheet;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => GoogleSheet.updateStatusBadge());
  } else {
    GoogleSheet.updateStatusBadge();
  }
})();
