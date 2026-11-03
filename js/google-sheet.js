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
    GoogleSheet.downloadRelationalExcel = function() {
      if (typeof XLSX === 'undefined') {
        alert('엑셀 생성 라이브러리를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.');
        return;
      }

      const wb = XLSX.utils.book_new();

      // 1. 0_학급_종합대시보드 (선생님 요청: 한눈에 전체 현황을 보는 대시보드)
      const dashData = [
        ["2026학년도 학교생활기록부 & 대입진학상담 종합 대시보드"],
        ["* '1_학급명렬표'에 학번과 이름을 붙여넣기만 하면 모든 세특, 창체, 목표대학 상담 현황이 실시간 자동 집계됩니다."],
        [],
        ["학번", "성명", "희망학과·진로", "과세특 작성수", "최근 작성바이트", "창체·동아리 활동수", "1지망 목표대학", "내신(9등급)", "2028 환산(5등급)", "상담일지 상태", "종합 진행률"],
        [
          "20101",
          { f: "IFERROR(VLOOKUP(A4, '1_학급명렬표'!B:C, 2, FALSE), \"\")" },
          { f: "IFERROR(VLOOKUP(A4, '1_학급명렬표'!B:D, 3, FALSE), \"미입력\")" },
          { f: "COUNTIF('2_교과세특_초안'!A:A, A4)" },
          { f: "IFERROR(VLOOKUP(A4, '2_교과세특_초안'!A:G, 7, FALSE), 0)" },
          { f: "COUNTIF('3_창체_동아리_진로'!A:A, A4)" },
          { f: "IFERROR(VLOOKUP(A4, '4_대입상담_목표대학'!A:C, 3, FALSE), \"미상담\")" },
          { f: "IFERROR(VLOOKUP(A4, '4_대입상담_목표대학'!A:I, 9, FALSE), \"-\")" },
          { f: "IFERROR(VLOOKUP(A4, '4_대입상담_목표대학'!A:J, 10, FALSE), \"-\")" },
          { f: "IF(COUNTIF('4_대입상담_목표대학'!A:A, A4)>0, \"✓ 완료\", \"대기\")" },
          "100%"
        ],
        [
          "20102",
          { f: "IFERROR(VLOOKUP(A5, '1_학급명렬표'!B:C, 2, FALSE), \"\")" },
          { f: "IFERROR(VLOOKUP(A5, '1_학급명렬표'!B:D, 3, FALSE), \"미입력\")" },
          { f: "COUNTIF('2_교과세특_초안'!A:A, A5)" },
          { f: "IFERROR(VLOOKUP(A5, '2_교과세특_초안'!A:G, 7, FALSE), 0)" },
          { f: "COUNTIF('3_창체_동아리_진로'!A:A, A5)" },
          { f: "IFERROR(VLOOKUP(A5, '4_대입상담_목표대학'!A:C, 3, FALSE), \"미상담\")" },
          { f: "IFERROR(VLOOKUP(A5, '4_대입상담_목표대학'!A:I, 9, FALSE), \"-\")" },
          { f: "IFERROR(VLOOKUP(A5, '4_대입상담_목표대학'!A:J, 10, FALSE), \"-\")" },
          { f: "IF(COUNTIF('4_대입상담_목표대학'!A:A, A5)>0, \"✓ 완료\", \"대기\")" },
          "50%"
        ],
        [
          "20103",
          { f: "IFERROR(VLOOKUP(A6, '1_학급명렬표'!B:C, 2, FALSE), \"\")" },
          { f: "IFERROR(VLOOKUP(A6, '1_학급명렬표'!B:D, 3, FALSE), \"미입력\")" },
          { f: "COUNTIF('2_교과세특_초안'!A:A, A6)" },
          { f: "IFERROR(VLOOKUP(A6, '2_교과세특_초안'!A:G, 7, FALSE), 0)" },
          { f: "COUNTIF('3_창체_동아리_진로'!A:A, A6)" },
          { f: "IFERROR(VLOOKUP(A6, '4_대입상담_목표대학'!A:C, 3, FALSE), \"미상담\")" },
          { f: "IFERROR(VLOOKUP(A6, '4_대입상담_목표대학'!A:I, 9, FALSE), \"-\")" },
          { f: "IFERROR(VLOOKUP(A6, '4_대입상담_목표대학'!A:J, 10, FALSE), \"-\")" },
          { f: "IF(COUNTIF('4_대입상담_목표대학'!A:A, A6)>0, \"✓ 완료\", \"대기\")" },
          "0%"
        ]
      ];
      const wsDash = XLSX.utils.aoa_to_sheet(dashData);
      wsDash['!cols'] = [{ wch: 10 }, { wch: 12 }, { wch: 22 }, { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 20 }, { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, wsDash, "0_학급_종합대시보드");

      // 2. 1_학급명렬표 (개인정보 삭제 완료, 순수 서식 + 가명 샘플)
      const rosterData = [
        ["번호", "학번", "성명", "희망학과", "진로분야", "특기사항_메모"],
        [1, "20101", "김태형", "생명공학과", "바이오메디컬·의약품연구", "실험 설계 및 탐구지속성 우수"],
        [2, "20102", "박서준", "컴퓨터공학과", "인공지능·빅데이터알고리즘", "수리정보 논리력 탁월"],
        [3, "20103", "이지은", "경영학과", "데이터기반 마케팅·기획", "의사소통 및 협업 리더십 우수"],
        [4, "20104", "", "", "", ""],
        [5, "20105", "", "", "", ""]
      ];
      const wsRoster = XLSX.utils.aoa_to_sheet(rosterData);
      wsRoster['!cols'] = [{ wch: 8 }, { wch: 12 }, { wch: 14 }, { wch: 18 }, { wch: 26 }, { wch: 32 }];
      XLSX.utils.book_append_sheet(wb, wsRoster, "1_학급명렬표");

      // 3. 2_교과세특_초안 (2026 기재요령 3단논법 & 실시간 바이트 자동계산)
      const setukData = [
        ["학번", "성명(자동연계)", "교과목", "수행활동·탐구주제", "학생개별역량", "나이스 세특 초안 (동기-과정-성장, ~함)", "글자수(Byte, 자동계산)"],
        [
          "20101",
          { f: "IF(A2=\"\",\"\",IFERROR(VLOOKUP(A2,'1_학급명렬표'!B:C,2,FALSE),\"미등록\"))" },
          "생명과학Ⅰ",
          "삼투현상과 세포막 선택적 투과성",
          "가설 설정 및 현미경 정밀 관찰력",
          "농도 차이에 따른 삼투압 원리를 탐구하고자 가설을 설정하고 양파 표피세포 원형질 분리 현상을 현미경으로 정밀 관찰함. 선택적 투과성 원리를 세포막 인지질 이중층 구조와 연결하여 논리적으로 규명하고 결론을 도출함.",
          { f: "IF(F2=\"\",0,LENB(F2))" }
        ],
        [
          "20102",
          { f: "IF(A3=\"\",\"\",IFERROR(VLOOKUP(A3,'1_학급명렬표'!B:C,2,FALSE),\"미등록\"))" },
          "정보",
          "정렬 알고리즘의 시간복잡도 비교 분석",
          "파이썬 구현 및 성능 빅데이터 분석",
          "버블 정렬과 퀵 정렬의 시간복잡도를 파이썬 코드로 직접 구현하고 데이터 규모(1만~10만 건)에 따른 실행 시간을 정량 비교함. 알고리즘 최적화의 중요성을 깊이 이해하고 실생활 문제 해결에 컴퓨팅 사고력을 발휘함.",
          { f: "IF(F3=\"\",0,LENB(F3))" }
        ]
      ];
      const wsSetuk = XLSX.utils.aoa_to_sheet(setukData);
      wsSetuk['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 32 }, { wch: 30 }, { wch: 65 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, wsSetuk, "2_교과세특_초안");

      // 4. 3_창체_동아리_진로 (다부서 합산 자동화)
      const clubData = [
        ["학번", "성명(자동연계)", "영역구분", "활동부서명", "활동일자", "수행활동 및 성장기록 (나이스 규격)"],
        [
          "20101",
          { f: "IF(A2=\"\",\"\",IFERROR(VLOOKUP(A2,'1_학급명렬표'!B:C,2,FALSE),\"미등록\"))" },
          "동아리활동",
          "생명과학탐구반",
          "2026-05-12",
          "교내 학술제에서 바이오 플라스틱 생분해 실험을 주도적으로 진행하고 결과를 전교생 대상 발표로 성공적으로 공유함."
        ],
        [
          "20101",
          { f: "IF(A3=\"\",\"\",IFERROR(VLOOKUP(A3,'1_학급명렬표'!B:C,2,FALSE),\"미등록\"))" },
          "진로활동",
          "진로비전캠프",
          "2026-06-20",
          "바이오의약 분야 진로 멘토링에 참여하여 신약 합성 프로세스를 학습하고 학업 진로 로드맵을 체계적으로 수립함."
        ]
      ];
      const wsClub = XLSX.utils.aoa_to_sheet(clubData);
      wsClub['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 20 }, { wch: 14 }, { wch: 65 }];
      XLSX.utils.book_append_sheet(wb, wsClub, "3_창체_동아리_진로");

      // 5. 4_대입상담_목표대학 (1~6지망 & 2028 5등급제 환산)
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
      wsCounsel['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 45 }];
      XLSX.utils.book_append_sheet(wb, wsCounsel, "4_대입상담_목표대학");

      // 6. 5_2026_기재요령_지침
      const guideData = [
        ["[2026학년도 학교생활기록부 표준 기재지침 요약]"],
        ["지침 번호", "핵심 규정 내용", "금지어 배제 규칙"],
        ["규정 1", "과세특은 교과 교육과정 성취기준에 따른 학생의 구체적 변화와 성장을 중심으로 기재함.", "공인어학성적, 교외상, 논문, 도서출판 기재 불가"],
        ["규정 2", "문장의 종결어미는 교육부 훈령에 따라 반드시 개조식 종결어미(~함, ~임)를 준수함.", "사교육 유발 가능성이 있는 공인 시험 명칭 기재 금지"],
        ["규정 3", "교과 세부능력 및 특기사항은 1개 과목당 1,500 Byte(한글 500자) 이내로 작성함.", "부모의 사회경제적 지위(직업, 직위 등) 암시 표현 금지"]
      ];
      const wsGuide = XLSX.utils.aoa_to_sheet(guideData);
      wsGuide['!cols'] = [{ wch: 14 }, { wch: 60 }, { wch: 40 }];
      XLSX.utils.book_append_sheet(wb, wsGuide, "5_2026_기재요령_지침");

      // 파일 다운로드
      const fileName = `2026_관계형_학교생활기록부_종합대시보드_${new Date().toISOString().slice(0,10)}.xlsx`;
      XLSX.writeFile(wb, fileName);
    };

  window.GoogleSheet = GoogleSheet;

  document.addEventListener('DOMContentLoaded', () => {
    GoogleSheet.updateStatusBadge();
  });
})();
