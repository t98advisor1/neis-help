// /tong/sync-bridge.js — 모바일 교무수첩(자리·출결·일정·상담·관찰세특) ↔ 관계형 시트·메인 앱 실시간 양방향 브릿지
(function() {
  'use strict';

  const TONG_KEY = 'seatArrangement_v3';
  const NB_KEY = 'swk_mobile_notebook_data';

  const DEFAULT_30_STUDENTS = [
    { no: '20101', name: '김태형', gender: '남', major: '생명공학과', memo: '학급 환경개선 부장 / 바이오신약 분야 진로 확고', obs: '미분방정식을 이용한 약물 체내 흡수 및 배출 속도 모델링을 발표하여 수학과 생명과학의 융합 역량을 드러냄', duty: '환경개선부장', praise: 5 },
    { no: '20102', name: '박서준', gender: '남', major: '컴퓨터공학과', memo: '학급 IT 도우미 / 알고리즘 및 인공지능 심화 탐구', obs: '행렬의 고윳값과 고유벡터를 학습하고 인공지능 주성분 분석(PCA) 알고리즘의 수학적 원리를 완벽히 증명함', duty: 'IT도우미', praise: 6 },
    { no: '20103', name: '이지은', gender: '여', major: '응용통계학과', memo: '학급 부반장 / 학습 멘토링 기획 및 통계 데이터 분석', obs: '조건부 확률과 베이즈 정리를 바탕으로 공공 보건 데이터의 위양성/위음성 판정 오류를 통계적으로 규명함', duty: '학급부반장', praise: 8 },
    { no: '20104', name: '정해인', gender: '남', major: '기계로봇공학과', memo: '실험실 안전부장 / 다관절 로봇 팔 제어 회로 설계', obs: '삼각함수의 주기성과 벡터의 외적을 활용해 다관절 매니퓰레이터의 기구학적 작업 공간을 수학적으로 계산함', duty: '안전부장', praise: 4 },
    { no: '20105', name: '최수영', gender: '여', major: '화학공학과', memo: '학급 게시판 관리 / 친환경 이차전지 고체 전해질 실험', obs: '화학반응 속도론의 아레니우스 식을 미적분학의 로그 함수 미분법과 결합하여 활성화 에너지를 정밀하게 도출함', duty: '게시판담당', praise: 5 },
    { no: '20106', name: '강민우', gender: '남', major: '의예과', memo: '아침 독서 활동 모범 / 의학 통계 및 생명윤리 탐구', obs: '수업 중 핵심 원리를 의예과 진로와 결합하여 심화 탐구 보고서를 충실히 작성함', duty: '독서도우미', praise: 3 },
    { no: '20107', name: '윤아인', gender: '여', major: '전자공학과', memo: '교과 멘토 활동 / 반도체 소자 물성 탐구', obs: '수업 중 핵심 원리를 전자공학과 진로와 결합하여 심화 탐구 보고서를 충실히 작성함', duty: '교과멘토', praise: 4 },
    { no: '20108', name: '송중기', gender: '남', major: '경영학과', memo: '학급 총무 / 계량경제 및 의사결정 모델 탐구', obs: '수업 중 핵심 원리를 경영학과 진로와 결합하여 심화 탐구 보고서를 충실히 작성함', duty: '학급총무', praise: 3 },
    { no: '20109', name: '한효주', gender: '여', major: '생명과학과', memo: '과학실험실 도우미 / 유전자 발현 데이터 분석', obs: '수업 중 핵심 원리를 생명과학과 진로와 결합하여 심화 탐구 보고서를 충실히 작성함', duty: '실험도우미', praise: 5 },
    { no: '20110', name: '임시완', gender: '남', major: '미디어커뮤니케이션', memo: '학급 기록 홍보 담당 / 미디어 리터러시 통계 분석', obs: '수업 중 핵심 원리를 미디어커뮤니케이션 진로와 결합하여 심화 탐구 보고서를 충실히 작성함', duty: '홍보담당', praise: 2 },
    { no: '20111', name: '김지원', gender: '여', major: '반도체공학과', memo: '모둠 학습 리더 / 웨이퍼 공정 수율 확률 모델링', obs: '수업 중 핵심 원리를 반도체공학과 진로와 결합하여 심화 탐구 보고서를 충실히 작성함', duty: '모둠리더', praise: 6 },
    { no: '20112', name: '박보검', gender: '남', major: '인공지능학과', memo: '또래 상담 도우미 / 경사하강법 최적화 수식 탐구', obs: '수업 중 핵심 원리를 인공지능학과 진로와 결합하여 심화 탐구 보고서를 충실히 작성함', duty: '또래상담', praise: 7 },
    { no: '20113', name: '배수지', gender: '여', major: '국제통상학과', memo: '외국어 멘토 / 환율 변동성과 무역수지 함수 분석', obs: '수업 중 핵심 원리를 국제통상학과 진로와 결합하여 심화 탐구 보고서를 충실히 작성함', duty: '어학멘토', praise: 4 },
    { no: '20114', name: '이도현', gender: '남', major: '의예과', memo: '보건 도우미 / 감염병 확산 SIR 미분모델 분석', obs: '수업 중 핵심 원리를 의예과 진로와 결합하여 심화 탐구 보고서를 충실히 작성함', duty: '보건도우미', praise: 5 },
    { no: '20115', name: '김고은', gender: '여', major: '전자공학과', memo: '기자재 담당 / 푸리에 변환과 신호처리 원리 탐구', obs: '수업 중 핵심 원리를 전자공학과 진로와 결합하여 심화 탐구 보고서를 충실히 작성함', duty: '기자재담당', praise: 3 },
    { no: '20116', name: '안효섭', gender: '남', major: '경영학과', memo: '학급 체육부장 / 포트폴리오 분산 최적화 계산', obs: '수업 중 핵심 원리를 경영학과 진로와 결합하여 심화 탐구 보고서를 충실히 작성함', duty: '체육부장', praise: 4 },
    { no: '20117', name: '김유정', gender: '여', major: '생명과학과', memo: '생태환경 담당 / 개체군 생장 로지스틱 함수 탐구', obs: '수업 중 핵심 원리를 생명과학과 진로와 결합하여 심화 탐구 보고서를 충실히 작성함', duty: '생태담당', praise: 5 },
    { no: '20118', name: '송강', gender: '남', major: '미디어커뮤니케이션', memo: '영상 편집 담당 / 추천 알고리즘 협업필터링 탐구', obs: '수업 중 핵심 원리를 미디어커뮤니케이션 진로와 결합하여 심화 탐구 보고서를 충실히 작성함', duty: '영상담당', praise: 2 },
    { no: '20119', name: '조보아', gender: '여', major: '반도체공학과', memo: '도서 관리 담당 / 양자터널링 현상과 지수함수 분석', obs: '수업 중 핵심 원리를 반도체공학과 진로와 결합하여 심화 탐구 보고서를 충실히 작성함', duty: '도서담당', praise: 4 },
    { no: '20120', name: '변우석', gender: '남', major: '인공지능학과', memo: '학급 반장 / 트랜스포머 어텐션 행렬 연산 탐구', obs: '수업 중 핵심 원리를 인공지능학과 진로와 결합하여 심화 탐구 보고서를 충실히 작성함', duty: '학급반장', praise: 9 },
    { no: '20121', name: '김혜윤', gender: '여', major: '국제통상학과', memo: '학급 서기 / 비교우위론과 선형계획법 최적화 탐구', obs: '수업 중 핵심 원리를 국제통상학과 진로와 결합하여 심화 탐구 보고서를 충실히 작성함', duty: '학급서기', praise: 6 },
    { no: '20122', name: '채종협', gender: '남', major: '의예과', memo: '봉사활동 담당 / 의료 영상 CT 복원 역행렬 원리 탐구', obs: '수업 중 핵심 원리를 의예과 진로와 결합하여 심화 탐구 보고서를 충실히 작성함', duty: '봉사담당', praise: 4 },
    { no: '20123', name: '박은빈', gender: '여', major: '전자공학과', memo: '학습부 차장 / 교류회로 임피던스와 복소평면 탐구', obs: '수업 중 핵심 원리를 전자공학과 진로와 결합하여 심화 탐구 보고서를 충실히 작성함', duty: '학습차장', praise: 7 },
    { no: '20124', name: '이준호', gender: '남', major: '경영학과', memo: '진로 정보 담당 / 한계비용·한계수입 미분 최적화 분석', obs: '수업 중 핵심 원리를 경영학과 진로와 결합하여 심화 탐구 보고서를 충실히 작성함', duty: '진로담당', praise: 3 },
    { no: '20125', name: '임윤아', gender: '여', major: '생명과학과', memo: '급식 배식 도우미 / 효소 반응속도 미카엘리스-멘텐 식 분석', obs: '수업 중 핵심 원리를 생명과학과 진로와 결합하여 심화 탐구 보고서를 충실히 작성함', duty: '배식도우미', praise: 5 },
    { no: '20126', name: '서인국', gender: '남', major: '미디어커뮤니케이션', memo: '음향 방송 도우미 / 음파 간섭과 삼각함수 합성 탐구', obs: '', duty: '방송도우미', praise: 2 },
    { no: '20127', name: '박민영', gender: '여', major: '반도체공학과', memo: '에너지 절약 담당 / 열전달 방정식과 방열판 설계 탐구', obs: '', duty: '에너지담당', praise: 3 },
    { no: '20128', name: '이종석', gender: '남', major: '인공지능학과', memo: '칠판 관리 담당 / 베이지안 추론과 스팸 필터링 실습', obs: '', duty: '칠판담당', praise: 2 },
    { no: '20129', name: '문가영', gender: '여', major: '국제통상학과', memo: '학급 문집 편집 / 글로벌 공급망 네트워크 그래프 분석', obs: '', duty: '문집편집', praise: 4 },
    { no: '20130', name: '남주혁', gender: '남', major: '의예과', memo: '체육 기구 관리 / 심박수 시계열 데이터 주기성 분석', obs: '', duty: '체육기구담당', praise: 3 }
  ];

  // 1. 초기 30명 관계형 데이터 시딩 (기본 '학생1' 상태이거나 비어있을 때)
  function ensureRelationalSeed() {
    try {
      const raw = localStorage.getItem(TONG_KEY);
      let state = raw ? JSON.parse(raw) : null;
      const c0 = state && state.allClassData && state.allClassData['0'];
      const needsSeed = !c0 || !Array.isArray(c0.students) || c0.students.length === 0 ||
        (c0.students[0] && /^학생\d+$/.test(c0.students[0].name));

      if (!needsSeed) return;

      const today = new Date().toISOString().slice(0, 10);
      const students = [];
      const currentSeats = {};
      const studentMemos = {};
      const specialNotes = [];
      const duties = {};
      const praise = {};

      DEFAULT_30_STUDENTS.forEach((s, idx) => {
        const id = String(idx + 1);
        students.push({ id, name: `${s.no} ${s.name}`, gender: s.gender, studentNo: s.no, major: s.major });
        const r = Math.floor(idx / 5), c = idx % 5;
        currentSeats[`${r}-${c}`] = { id, name: `${s.no} ${s.name}`, gender: s.gender };
        studentMemos[id] = `[희망진로: ${s.major}] ${s.memo}`;
        duties[id] = s.duty;
        praise[id] = s.praise;
        if (s.obs) {
          specialNotes.push({
            id: 'seed_obs_' + s.no,
            studentId: id,
            studentNo: s.no,
            studentName: s.name,
            date: today,
            subject: '공통수학1',
            category: '탐구 활동',
            content: s.obs,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }
      });

      const baseClass = {
        className: '2학년 1반 (관계형 연동)',
        students,
        currentSeats,
        lockedSeats: {},
        config: { totalDesks: 30, columns: 5, seatType: 'pair', layoutIndex: 0, rows: 6 },
        relations: { close: {}, far: {} },
        studentMemos,
        specialNotes,
        savedRecords: [],
        notice: '· 금요일 6교시 창의적 체험활동 진로 탐구 발표\n· 수학 수행평가(미분과 실생활 모델링 보고서) 제출 마감 안내\n· 대입 수시 6지망 기초 상담 주간',
        noticeAt: today,
        praise,
        attendance: {},
        duties,
        dutyRoles: DEFAULT_30_STUDENTS.map(s => s.duty).join('\n'),
        attendReasons: {},
        attendMemos: {}
      };

      const nextState = {
        settings: { periodStart: today, periodEnd: '2026-12-31' },
        allClassData: {
          '0': baseClass,
          '1': { ...baseClass, className: '2학년 2반', students: [], currentSeats: {}, studentMemos: {}, specialNotes: [] },
          '2': { ...baseClass, className: '2학년 3반', students: [], currentSeats: {}, studentMemos: {}, specialNotes: [] }
        },
        currentClassIndex: 0
      };

      localStorage.setItem(TONG_KEY, JSON.stringify(nextState));
    } catch (e) {
      console.warn('[TongBridge] seed error:', e);
    }
  }

  ensureRelationalSeed();

  // 2. 교무수첩 데이터 변경 시 ➔ 메인 앱 모바일 교무수첩(swk_mobile_notebook_data) 및 실시간 서버 API로 자동 동기화
  let syncTimer = null;
  function syncTongToMainApp(jsonStr) {
    try {
      const state = JSON.parse(jsonStr);
      const cls = state && state.allClassData && state.allClassData[String(state.currentClassIndex || 0)];
      if (!cls || !Array.isArray(cls.students)) return;

      const nbRaw = localStorage.getItem(NB_KEY);
      const nbData = nbRaw ? JSON.parse(nbRaw) : {};
      const notes = Array.isArray(cls.specialNotes) ? cls.specialNotes : [];

      cls.students.forEach((stu, idx) => {
        const rawName = String(stu.name || '');
        const m = rawName.match(/^(\d{5})\s+(.+)$/);
        const stuNo = stu.studentNo || (m ? m[1] : String(20101 + idx));
        const stuName = m ? m[2] : rawName;
        const stuNotes = notes.filter(n => String(n.studentId) === String(stu.id));
        const mergedObs = stuNotes.map(n => `[${n.subject || '교과'}·${n.category || '관찰'}] ${n.content}`).join(' / ');
        const memoTxt = (cls.studentMemos && cls.studentMemos[stu.id]) || '';
        const dutyTxt = (cls.duties && cls.duties[stu.id]) || '';
        const praiseCnt = (cls.praise && cls.praise[stu.id]) || 0;

        const key = `1_${stuNo}`;
        const prev = nbData[key] || {};
        nbData[key] = {
          ...prev,
          studentId: stuNo,
          studentName: stuName,
          memo: mergedObs || prev.memo || '',
          homeroomMemo: memoTxt,
          duty: dutyTxt,
          praise: praiseCnt,
          updatedAt: new Date().toISOString()
        };
      });

      localStorage.setItem(NB_KEY, JSON.stringify(nbData));

      // 부모 창(메인 앱)에 실시간 알림 및 백그라운드 시트 동기화
      if (window.parent && window.parent !== window) {
        try {
          window.parent.dispatchEvent(new CustomEvent('tong-notebook-synced', {
            detail: { studentCount: cls.students.length, noteCount: notes.length, updatedAt: new Date().toLocaleTimeString('ko-KR') }
          }));
        } catch (_) {}
      }

      const badge = document.getElementById('tongBridgeSyncStatus');
      if (badge) {
        badge.textContent = `✅ 관계형 데이터 실시간 연동됨 (${notes.length}건 관찰 · ${new Date().toLocaleTimeString('ko-KR')})`;
      }
    } catch (e) {
      console.warn('[TongBridge] sync error:', e);
    }
  }

  // localStorage.setItem 후킹으로 실시간 감지
  const origSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function(key, val) {
    const res = origSetItem.call(this, key, val);
    if (key === TONG_KEY) {
      clearTimeout(syncTimer);
      syncTimer = setTimeout(() => syncTongToMainApp(val), 200);
    }
    return res;
  };

  // 3. 첫 로드 시 위저드 건너뛰고 바로 30명 좌석배치 화면 진입 + 상단 실시간 시트 전송 바 추가
  window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      try {
        const desksInput = document.getElementById('totalDesks');
        if (desksInput) desksInput.value = '30';
        const applyBtn = document.getElementById('applyConfigBtn');
        const wizard = document.getElementById('setupWizard');
        if (applyBtn && wizard && wizard.style.display !== 'none') {
          wizard.style.display = 'none';
          const mainContainer = document.getElementById('mainContainer');
          if (mainContainer) mainContainer.style.display = 'flex';
        }
      } catch (_) {}

      // 상단 헤더에 실시간 구글시트 동기화 상태 칩 삽입
      const headerRight = document.querySelector('.header-right');
      if (headerRight && !document.getElementById('tongBridgeSyncBtn')) {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'display:inline-flex; align-items:center; gap:6px; margin-right:6px;';
        wrap.innerHTML = `
          <span id="tongBridgeSyncStatus" style="font-size:11.5px; font-weight:700; color:#166534; background:#dcfce7; padding:5px 10px; border-radius:999px; border:1px solid #86efac;">
            ✅ 관계형 30명 연동됨
          </span>
          <button type="button" id="tongBridgeSyncBtn" style="font-size:12px; font-weight:800; color:#fff; background:#2563eb; border:none; padding:6px 12px; border-radius:8px; cursor:pointer; box-shadow:0 2px 6px rgba(37,99,235,0.25);">
            📤 구글시트로 즉시 전송
          </button>
        `;
        headerRight.prepend(wrap);

        document.getElementById('tongBridgeSyncBtn').addEventListener('click', async () => {
          const btn = document.getElementById('tongBridgeSyncBtn');
          btn.disabled = true;
          btn.textContent = '⏳ 전송 중...';
          try {
            const raw = localStorage.getItem(TONG_KEY);
            if (raw) syncTongToMainApp(raw);
            const state = JSON.parse(raw || '{}');
            const cls = state.allClassData && state.allClassData[String(state.currentClassIndex || 0)];
            const notes = (cls && cls.specialNotes) || [];
            // 가장 최근 관찰기록을 시트 동기화 엔드포인트로 전송
            for (const n of notes.slice(-5)) {
              await fetch('/api/sheet-sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'save_subject_memo',
                  studentId: n.studentNo || String(20100 + Number(n.studentId || 1)),
                  studentName: n.studentName || '',
                  subject: n.subject || '공통수학1',
                  memo: `[${n.category || '관찰'}] ${n.content || ''}`
                })
              });
            }
            btn.textContent = '✅ 시트 전송 완료!';
            setTimeout(() => { btn.textContent = '📤 구글시트로 즉시 전송'; btn.disabled = false; }, 2000);
          } catch (e) {
            btn.textContent = '⚠️ 전송 재시도';
            btn.disabled = false;
          }
        });
      }
    }, 300);
  });
})();
