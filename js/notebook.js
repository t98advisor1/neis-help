// js/notebook.js — 통합 모바일 교무수첩 & 교과담임 관찰노트 (구글 시트 실시간 양방향 동기화)
(function() {
  'use strict';

  const STORAGE_KEY = 'swk_mobile_notebook_data';
  const GAS_URL_KEY = 'swk_gsheet_subject_url';

  // 기본 학급 및 샘플 학생 데이터 (1반~4반)
  const DEFAULT_CLASSES = ['1', '2', '3', '4'];
  const DEFAULT_SUBJECTS = ['경제수학', '공통수학', '통합사회', '통합과학', '과학탐구실험', '경제', '정치와법', '한국사', '영어'];

  const SAMPLE_STUDENTS_BY_CLASS = {
    '1': [
      { id: '20101', no: '1', name: '김민수', hope: '컴퓨터공학과', memo: '삼투압 농도 변화에 따른 세포막 투과율 비교 실험 설계 및 정량적 데이터 측정에 주도적 참여.', tags: '가설검증실험, 정량데이터분석', draft: '' },
      { id: '20102', no: '2', name: '이서연', hope: '경영학과', memo: '한계효용 체감의 법칙과 가격 결정 메커니즘을 수학적 미분 개념과 연결하여 질문하고 토의함.', tags: '탐구질문, 모둠토의리더십', draft: '' },
      { id: '20103', no: '3', name: '박준혁', hope: '기계공학과', memo: '에너지 보존 법칙 기반의 롤러코스터 역학 모델링에서 마찰 손실 계수 오차 원인을 논리적으로 규명함.', tags: '문제해결우수, 가설검증실험', draft: '' },
      { id: '20104', no: '4', name: '정유진', hope: '의예과 / 생명과학', memo: '효소 활성도와 pH 농도의 상관관계를 분광광도계 측정 데이터로 그래프화하여 시각적으로 발표함.', tags: '정량데이터분석, 발표우수', draft: '' },
      { id: '20105', no: '5', name: '최현우', hope: '데이터사이언스학과', memo: '정규분포와 표준편차를 활용한 교내 급식 잔반량 통계 분석 프로젝트를 주도적으로 수행함.', tags: '문제해결우수, 정량데이터분석', draft: '' }
    ],
    '2': [
      { id: '20201', no: '1', name: '강동원', hope: '전자공학과', memo: '옴의 법칙과 키르히호프 법칙을 회로 시뮬레이션(Tinkercad)으로 직접 구현하여 저항 오차를 보정함.', tags: '가설검증실험, 문제해결우수', draft: '' },
      { id: '20202', no: '2', name: '윤하은', hope: '미디어커뮤니케이션', memo: '알고리즘 추천 시스템의 필터 버블 현상을 정보 비대칭 관점에서 비판적으로 고찰하고 대안 제시.', tags: '비판적사고, 발표우수', draft: '' },
      { id: '20203', no: '3', name: '조민재', hope: '건축학과', memo: '트러스 구조의 하중 분산 원리를 기하학적 벡터 연산과 결합하여 모형 안정성 테스트 수행.', tags: '가설검증실험, 정량데이터분석', draft: '' }
    ],
    '3': [
      { id: '20301', no: '1', name: '한예린', hope: '환경공학과', memo: '미세플라스틱 흡착 필터 제작 실험에서 활성탄과 제올라이트의 흡착 효율을 비교 분석함.', tags: '가설검증실험, 문제해결우수', draft: '' },
      { id: '20302', no: '2', name: '송지호', hope: '생명공학과', memo: 'CRISPR 유전자 가위의 작동 기전과 윤리적 쟁점을 다룬 원서 논문을 요약 정리하여 학급에 발표.', tags: '교과연계독서, 발표우수', draft: '' }
    ],
    '4': [
      { id: '20401', no: '1', name: '오세훈', hope: '경제학과', memo: '게임이론의 내시 균형을 죄수의 딜레마 사례에 적용하여 기업 간 가격 경쟁 시뮬레이션을 도출함.', tags: '탐구질문, 문제해결우수', draft: '' }
    ]
  };

  const Notebook = {
    currentSubject: '경제수학',
    currentClass: '1',
    data: {},
    activeStudentId: null,

    getGasUrl() {
      if (window.GoogleSheet && typeof window.GoogleSheet.getMasterUrl === 'function') {
        const mUrl = window.GoogleSheet.getMasterUrl();
        if (mUrl && mUrl.trim()) return mUrl.trim();
      }
      const subUrl = localStorage.getItem(GAS_URL_KEY)
        || localStorage.getItem('SR_GAS_MASTER_URL')
        || localStorage.getItem('swk_gsheet_url')
        || localStorage.getItem('swk_gsheet_homeroom_url')
        || localStorage.getItem('swk_gsheet_web_app_url')
        || localStorage.getItem('tong_gsheet_url');
      return (subUrl && subUrl.trim()) || '';
    },

    setGasUrl(url) {
      const u = (url || '').trim();
      if (window.GoogleSheet && typeof window.GoogleSheet.setMasterUrl === 'function') {
        window.GoogleSheet.setMasterUrl(u);
      } else if (u) {
        localStorage.setItem(GAS_URL_KEY, u);
        localStorage.setItem('SR_GAS_MASTER_URL', u);
        localStorage.setItem('swk_gsheet_url', u);
        localStorage.setItem('tong_gsheet_url', u);
      } else {
        localStorage.removeItem(GAS_URL_KEY);
      }
      this.updateSyncBadge();
    },

    loadLocalData() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          this.data = JSON.parse(raw);
        } else {
          this.data = JSON.parse(JSON.stringify(SAMPLE_STUDENTS_BY_CLASS));
          if (window.MOCK_CLASS_30_SUBJECT && Array.isArray(window.MOCK_CLASS_30_SUBJECT)) {
            this.data['1'] = JSON.parse(JSON.stringify(window.MOCK_CLASS_30_SUBJECT));
          }
        }
      } catch (e) {
        this.data = JSON.parse(JSON.stringify(SAMPLE_STUDENTS_BY_CLASS));
        if (window.MOCK_CLASS_30_SUBJECT && Array.isArray(window.MOCK_CLASS_30_SUBJECT)) {
          this.data['1'] = JSON.parse(JSON.stringify(window.MOCK_CLASS_30_SUBJECT));
        }
      }
    },

    saveLocalData() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    },

    getStudentsForCurrentClass() {
      if (!this.data[this.currentClass]) {
        this.data[this.currentClass] = [];
      }
      return this.data[this.currentClass];
    },

    updateSyncBadge() {
      const badge = document.getElementById('nbSyncBadge');
      const gasUrl = this.getGasUrl();
      if (!badge) return;

      if (gasUrl) {
        badge.className = 'privacy-badge';
        badge.style.background = '#dcfce7';
        badge.style.color = '#15803d';
        badge.style.border = '1px solid #86efac';
        badge.textContent = '🟢 교과시트 실시간 연동 준비완료';
        badge.title = `연동 대상: ${gasUrl}`;
      } else {
        badge.className = 'privacy-badge';
        badge.style.background = '#fef3c7';
        badge.style.color = '#b45309';
        badge.style.border = '1px solid #fde68a';
        badge.textContent = '🟡 로컬 브라우저 저장 모드';
        badge.title = '시트 URL을 등록하시면 구글 시트로 실시간 저장됩니다.';
      }
    },

    // 1. 단일 학생 메모 구글 시트 실시간 저장 (로컬 저장이 아닌 시트 동기화)
    async saveStudentToSheet(studentId) {
      const list = this.getStudentsForCurrentClass();
      const student = list.find(s => s.id === studentId);
      if (!student) return;

      // 1) 로컬 저장
      this.saveLocalData();

      // 2) 구글 시트 전송
      const gasUrl = this.getGasUrl();
      if (!gasUrl) {
        alert('로컬에 저장되었습니다.\n\n구글 시트로 동기화하시려면 상단의 [⚙️ 교과시트 연동]에 Google Apps Script 웹앱 URL을 입력해 주세요.');
        return;
      }

      const saveBtn = document.getElementById(`nbBtnSave_${studentId}`);
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = '시트 동기화 중...';
      }

      try {
        const payload = {
          action: 'save_subject_memo',
          subject: this.currentSubject,
          classNo: this.currentClass,
          studentId: student.id,
          studentName: student.name,
          memo: student.memo || '',
          tags: student.tags || '',
          draft: student.draft || ''
        };

        const res = await fetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.textContent = '✅ 시트 동기화 완료!';
          saveBtn.style.background = '#059669';
          setTimeout(() => {
            saveBtn.textContent = '💾 시트 저장';
            saveBtn.style.background = '';
          }, 2500);
        }
      } catch (err) {
        console.warn('교과시트 저장 실패:', err);
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.textContent = '⚠️ 로컬만 저장됨';
          setTimeout(() => {
            saveBtn.textContent = '💾 시트 저장';
          }, 2500);
        }
        alert(`구글 시트 통신 오류 (${err.message}).\n현재 내용은 로컬 브라우저에 안전하게 보관되어 있습니다.`);
      }
    },

    // 2. 구글 시트에서 전체 관찰 메모 불러오기
    async pullFromSheet() {
      const gasUrl = this.getGasUrl();
      if (!gasUrl) {
        alert('먼저 상단의 [⚙️ 교과시트 연동]에 Apps Script 웹앱 URL을 입력해 주세요.');
        return;
      }

      const btn = document.getElementById('nbBtnPullSheet');
      if (btn) {
        btn.disabled = true;
        btn.textContent = '시트에서 불러오는 중...';
      }

      try {
        const fetchUrl = `${gasUrl}?action=get_subject_memos&_t=${Date.now()}`;
        const res = await fetch(fetchUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        if (data && Array.isArray(data.list) && data.list.length > 0) {
          let updatedCount = 0;
          data.list.forEach(item => {
            const sId = String(item.studentId || '').trim();
            if (!sId) return;

            // 학번에서 반 추정 (예: 20105 -> 1반, 20203 -> 2반)
            let cNo = '1';
            if (sId.length >= 4) {
              cNo = sId.charAt(2);
            }
            if (!this.data[cNo]) this.data[cNo] = [];

            let found = this.data[cNo].find(s => s.id === sId);
            if (found) {
              if (item.memo) found.memo = item.memo;
              if (item.tags) found.tags = item.tags;
              if (item.draft) found.draft = item.draft;
            } else {
              this.data[cNo].push({
                id: sId,
                no: sId.slice(-2).replace(/^0+/, ''),
                name: item.name || '',
                hope: '일반진로',
                memo: item.memo || '',
                tags: item.tags || '',
                draft: item.draft || ''
              });
            }
            updatedCount++;
          });

          this.saveLocalData();
          this.renderStudentList();
          alert(`✓ 구글 시트 [6_수업관찰_기록 · 7_AI세특_작성] 탭에서 총 ${updatedCount}건의 관찰기록을 성공적으로 동기화했습니다!`);
        } else {
          alert('구글 시트에 저장된 교과 관찰기록이 없습니다. 먼저 스마트폰에서 작성 후 [저장]해 보세요!');
        }
      } catch (err) {
        alert(`시트 불러오기 오류: ${err.message}`);
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = '📥 시트에서 불러오기';
        }
      }
    },

    // 3. 학생별 나이스 1,500 Byte 3단 세특 초안 즉시 생성
    async generateSetukDraft(studentId) {
      const list = this.getStudentsForCurrentClass();
      const student = list.find(s => s.id === studentId);
      if (!student) return;

      if (!student.memo || !student.memo.trim()) {
        alert('먼저 수업 중 관찰 메모를 한 문장 이상 입력해 주세요.');
        return;
      }

      const apiKey = localStorage.getItem('sr_apikey') || (document.getElementById('apiKeyInline') ? document.getElementById('apiKeyInline').value.trim() : '');
      if (!apiKey) {
        alert('Gemini API 키가 필요합니다. 상단 [API 키] 칸에 키를 등록해 주세요.');
        return;
      }

      const btnGen = document.getElementById(`nbBtnGen_${studentId}`);
      if (btnGen) {
        btnGen.disabled = true;
        btnGen.textContent = 'AI 세특 윤문 중...';
      }

      try {
        const prompt = `당신은 대한민국 고등학교 학교생활기록부 교과 세특(과목별 세부능력및특기사항) 작성 전문가입니다.
교과목: ${this.currentSubject}
학생 성명: ${student.name}
희망 진로: ${student.hope || '진로탐색'}
핵심 역량 키워드: ${student.tags || '탐구력, 문제해결력'}
교사 수업 관찰 메모:
${student.memo}

[작성 원칙]
1. [탐구동기 - 구체적 탐구과정 및 분석 - 배우고 느낀 점(성장)] 3단계 구조로 완성도 높은 한 문단으로 작성할 것.
2. 나이스 기준 공백 포함 400~500자 내외(1,200~1,500 Byte)로 작성할 것.
3. 명사형 종결어미(~함, ~임, ~을 규명함)를 사용하고, 교육부 기재금지 표현(외부 수상, 공인어학성적, 외부기관명 등)은 100% 배제할 것.
결과 세특 문단만 바로 출력하세요.`;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey.trim()}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 600 }
          })
        });

        if (!res.ok) throw new Error(`API 오류 (${res.status})`);
        const json = await res.json();
        const draftText = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

        student.draft = draftText;
        this.saveLocalData();

        const draftEl = document.getElementById(`nbDraft_${studentId}`);
        const byteEl = document.getElementById(`nbByte_${studentId}`);
        if (draftEl) draftEl.value = draftText;
        if (byteEl && typeof window.NEIS_BYTE === 'function') {
          const b = window.NEIS_BYTE(draftText);
          byteEl.textContent = `${b} / 1,500 Byte`;
        }

        // 구글 시트에 자동 백업 전송
        this.saveStudentToSheet(studentId);
      } catch (err) {
        alert(`세특 초안 생성 오류: ${err.message}`);
      } finally {
        if (btnGen) {
          btnGen.disabled = false;
          btnGen.textContent = '✨ 1,500B 세특 초안 생성';
        }
      }
    },

    // 4. 전교생 엑셀(.xlsx) 일괄 내보내기
    exportExcel() {
      if (typeof XLSX === 'undefined') {
        alert('엑셀 라이브러리(XLSX)를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.');
        return;
      }

      const rows = [
        ['학번', '반', '번호', '성명', '교과목', '희망진로', '수업관찰메모', '역량태그', '나이스 세특 초안(1,500 Byte)']
      ];

      Object.keys(this.data).forEach(cNo => {
        const students = this.data[cNo] || [];
        students.forEach(s => {
          rows.push([
            s.id,
            cNo + '반',
            s.no,
            s.name,
            this.currentSubject,
            s.hope || '',
            s.memo || '',
            s.tags || '',
            s.draft || ''
          ]);
        });
      });

      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = [
        { wch: 10 }, { wch: 6 }, { wch: 6 }, { wch: 10 }, { wch: 12 }, { wch: 16 }, { wch: 40 }, { wch: 20 }, { wch: 60 }
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '교과담임_세특기록');

      const dateStr = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `모바일교무수첩_${this.currentSubject}_세특기록_${dateStr}.xlsx`);
    },

    renderClassChips() {
      const container = document.getElementById('nbClassChips');
      if (!container) return;

      container.innerHTML = '';
      DEFAULT_CLASSES.forEach(cNo => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `chip ${this.currentClass === cNo ? 'on' : ''}`;
        btn.style.fontSize = '13px';
        btn.style.fontWeight = '800';
        btn.style.padding = '6px 14px';
        btn.textContent = `${cNo}반`;
        btn.onclick = () => {
          this.currentClass = cNo;
          this.renderClassChips();
          this.renderStudentList();
        };
        container.appendChild(btn);
      });
    },

    renderStudentList() {
      const container = document.getElementById('nbStudentList');
      if (!container) return;

      const students = this.getStudentsForCurrentClass();
      if (students.length === 0) {
        container.innerHTML = `
          <div style="text-align:center; padding:30px; background:#f8fafc; border-radius:12px; border:1px dashed #cbd5e1; color:#64748b;">
            현재 ${this.currentClass}반에 등록된 학생이 없습니다. 상단의 [학생 추가] 버튼을 눌러주세요.
          </div>
        `;
        return;
      }

      container.innerHTML = students.map(s => {
        const byteCount = (typeof window.NEIS_BYTE === 'function' && s.draft) ? window.NEIS_BYTE(s.draft) : 0;
        return `
          <div class="nb-student-card" id="nbCard_${s.id}" style="background:#ffffff; border:1.5px solid #e2e8f0; border-radius:14px; padding:16px 20px; box-shadow:0 3px 10px rgba(0,0,0,0.03); transition:all 0.2s;">
            <!-- 학생 헤더 -->
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
              <div style="display:flex; align-items:center; gap:10px;">
                <span style="font-size:12px; font-weight:800; background:#f1f5f9; color:#475569; padding:3px 8px; border-radius:6px;">${s.id}</span>
                <strong style="font-size:16px; color:#0f172a;">${s.name}</strong>
                <span style="font-size:12px; color:#64748b;">(${s.hope || '진로탐색'})</span>
              </div>
              <div style="display:flex; gap:6px;">
                <button type="button" class="btn small" style="background:#f1f5f9; color:#2563eb; font-weight:700; border:1px solid #cbd5e1;" onclick="window.Notebook.sendToMainDraft('${s.id}')">
                  ✍️ 메인 작성기로
                </button>
                <button type="button" id="nbBtnSave_${s.id}" class="btn primary small" style="background:#2563eb; color:#fff; font-weight:700; border:none;" onclick="window.Notebook.saveStudentToSheet('${s.id}')">
                  💾 시트 저장
                </button>
              </div>
            </div>

            <!-- 빠른 태그 선택 -->
            <div style="margin-bottom:8px;">
              <span style="font-size:11.5px; font-weight:700; color:#64748b;">역량 태그:</span>
              <input type="text" id="nbTags_${s.id}" value="${escapeHtml(s.tags || '')}" class="form-input" style="display:inline-block; width:calc(100% - 70px); font-size:12px; padding:4px 8px; margin-left:6px;" placeholder="예: 탐구력, 가설검증, 문제해결력" onchange="window.Notebook.updateStudentField('${s.id}', 'tags', this.value)">
            </div>

            <!-- 관찰 메모 입력창 -->
            <div style="margin-bottom:10px;">
              <label style="display:block; font-size:12px; font-weight:700; color:#334155; margin-bottom:4px;">
                ✏️ 수업 관찰 메모 (수업 중 스마트폰으로 편하게 작성):
              </label>
              <textarea id="nbMemo_${s.id}" rows="3" class="form-input" style="width:100%; border:1.5px solid #cbd5e1; border-radius:8px; padding:8px 12px; font-size:13px; line-height:1.5;" placeholder="오늘 수업 중 학생이 던진 질문, 탐구 태도, 실험 결과를 간략히 적어주세요..." oninput="window.Notebook.onMemoInput('${s.id}', this.value)">${escapeHtml(s.memo || '')}</textarea>
            </div>

            <!-- 세특 초안 생성 & 결과 영역 -->
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px; margin-top:10px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <button type="button" id="nbBtnGen_${s.id}" class="btn small" style="background:#ff385c; color:#fff; font-weight:800; border:none; padding:4px 12px; border-radius:6px; cursor:pointer;" onclick="window.Notebook.generateSetukDraft('${s.id}')">
                  ✨ 1,500B 세특 초안 생성
                </button>
                <span id="nbByte_${s.id}" style="font-size:11.5px; font-weight:800; color:#2563eb;">${byteCount} / 1,500 Byte</span>
              </div>
              <textarea id="nbDraft_${s.id}" rows="3" class="form-input" style="width:100%; border:1px solid #cbd5e1; border-radius:6px; padding:8px; font-size:12.5px; line-height:1.5; background:#fff;" placeholder="초안 생성 버튼을 누르면 나이스 기재요령 3단계(동기-과정-성장) 문단이 자동 완성됩니다..." onchange="window.Notebook.updateStudentField('${s.id}', 'draft', this.value)">${escapeHtml(s.draft || '')}</textarea>
            </div>
          </div>
        `;
      }).join('');
    },

    onMemoInput(studentId, val) {
      const list = this.getStudentsForCurrentClass();
      const s = list.find(item => item.id === studentId);
      if (s) {
        s.memo = val;
        this.saveLocalData();
      }
    },

    updateStudentField(studentId, field, val) {
      const list = this.getStudentsForCurrentClass();
      const s = list.find(item => item.id === studentId);
      if (s) {
        s[field] = val;
        this.saveLocalData();
      }
    },

    // 퀵 태그 삽입
    insertQuickTag(tag) {
      // 가장 최근 또는 첫 번째 학생 카드 메모창에 삽입
      const students = this.getStudentsForCurrentClass();
      if (students.length === 0) return;
      const target = students[0];
      const memoEl = document.getElementById(`nbMemo_${target.id}`);
      if (memoEl) {
        memoEl.value = (memoEl.value ? memoEl.value + ' ' : '') + `[${tag}]`;
        this.onMemoInput(target.id, memoEl.value);
        memoEl.focus();
      }
    },

    // 메인 초안 작성기로 보내기
    sendToMainDraft(studentId) {
      const list = this.getStudentsForCurrentClass();
      const s = list.find(item => item.id === studentId);
      if (!s) return;

      const memoInput = document.getElementById('memo');
      const subInput = document.getElementById('subject');
      if (memoInput) {
        memoInput.value = s.memo || s.draft || '';
      }
      if (subInput) {
        subInput.value = this.currentSubject;
      }

      // 탭 전환
      const makeTab = document.querySelector('#op-tabs [data-open="make"]');
      if (makeTab) makeTab.click();
      alert(`✓ ${s.name} 학생의 관찰 메모가 [생기부 초안 작성] 창으로 전송되었습니다!`);
    },

    init() {
      this.loadLocalData();
      this.updateSyncBadge();
      this.renderClassChips();
      this.renderStudentList();
      this.bindEvents();
    },

    bindEvents() {
      const subSelect = document.getElementById('nbSubjectSelect');
      if (subSelect) {
        subSelect.addEventListener('change', (e) => {
          this.currentSubject = e.target.value;
          this.renderStudentList();
        });
      }

      const btnPull = document.getElementById('nbBtnPullSheet');
      if (btnPull) {
        btnPull.addEventListener('click', () => this.pullFromSheet());
      }

      const btnExport = document.getElementById('nbBtnExportExcel');
      if (btnExport) {
        btnExport.addEventListener('click', () => this.exportExcel());
      }

      const btnConfig = document.getElementById('nbBtnConfigGas');
      if (btnConfig) {
        btnConfig.addEventListener('click', () => {
          const currentUrl = this.getGasUrl();
          const newUrl = prompt('교과담임용 구글 시트 Apps Script 웹앱 URL을 입력하세요:', currentUrl);
          if (newUrl !== null) {
            this.setGasUrl(newUrl);
            alert('교과담임 구글 시트 연동 URL이 저장되었습니다!');
          }
        });
      }
    }
  };

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  window.Notebook = Notebook;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Notebook.init());
  } else {
    Notebook.init();
  }
})();
