'use strict';
/* 번호탭(①~⑦) 기반 페이지 전환 · 상단 핵심메뉴 · 설정 드롭다운 · 교무수첩(t-ong) 실시간 연동 · 캐러셀 매뉴얼 제어 */
(function () {

const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

const PANELS = ['sheet', 'check', 'counsel', 'make', 'notebook', 'prompts', 'guide', 'usage'];
const STEP_ORDER = [
  { id: 'sheet', num: '①', title: '기록·시트 동기화' },
  { id: 'check', num: '②', title: '생기부 제약 점검' },
  { id: 'counsel', num: '③', title: '2027 대입 진학상담' },
  { id: 'make', num: '④', title: '생기부 초안 (AI 보조)' },
  { id: 'notebook', num: '⑤', title: '모바일 교무수첩 ↗' },
  { id: 'prompts', num: '⑥', title: 'AI 프롬프트·스킬' },
  { id: 'guide', num: '⑦', title: '기재요령·사용법' }
];

const workspace = $('#workspace');
let currentPanelId = 'sheet';

function updateStepNavUI(id) {
  const mappedId = (id === 'usage') ? 'guide' : id;
  const idx = STEP_ORDER.findIndex(s => s.id === mappedId);
  const cur = idx >= 0 ? STEP_ORDER[idx] : STEP_ORDER[0];
  const prev = idx > 0 ? STEP_ORDER[idx - 1] : null;
  const next = (idx >= 0 && idx < STEP_ORDER.length - 1) ? STEP_ORDER[idx + 1] : null;

  $$('.step-current-badge').forEach(el => {
    el.textContent = `${cur.num} ${cur.title} (${idx + 1} / ${STEP_ORDER.length} 페이지)`;
  });

  $$('.btn-step-prev').forEach(btn => {
    btn.disabled = !prev;
    btn.innerHTML = prev ? `◀ 이전: ${prev.num} ${prev.title}` : '◀ 첫 페이지';
    btn.onclick = () => { if (prev) openPanel(prev.id, true); };
  });

  $$('.btn-step-next').forEach(btn => {
    btn.disabled = !next;
    btn.innerHTML = next ? `다음: ${next.num} ${next.title} ▶` : '마지막 페이지 (⑦ 대입상담)';
    btn.onclick = () => { if (next) openPanel(next.id, true); };
  });
}

function openPanel(id, scroll) {
  if (!PANELS.includes(id)) return;
  currentPanelId = id;

  PANELS.forEach((p) => {
    const el = $('#panel-' + p);
    if (el) el.classList.toggle('hidden', p !== id);
  });

  const highlightId = (id === 'usage') ? 'guide' : id;
  $$('#op-tabs button, #op-top-step-tabs button, .sidebar-nav-item').forEach((b) => {
    const on = b.dataset.open === id || b.dataset.open === highlightId;
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });

  if (id === 'guide') {
    const f = $('#guide-frame');
    if (f && !f.getAttribute('src')) f.setAttribute('src', f.dataset.src);
  }
  if (id === 'sheet' && window.GoogleSheet && typeof window.GoogleSheet.renderLiveRelationalPreview === 'function') {
    window.GoogleSheet.renderLiveRelationalPreview('liveSheetPreviewBox', 'homeroom', 'all');
  }

  updateStepNavUI(id);
  if (typeof closeAppSidebar === "function") closeAppSidebar();

  try { history.replaceState(null, '', '#' + id); } catch (e) {}
  if (scroll && workspace) {
    const topY = workspace.getBoundingClientRect().top + window.scrollY - 64;
    window.scrollTo({ top: Math.max(0, topY), behavior: 'smooth' });
  }
}

window.openPanel = openPanel;
window.switchMainStepTab = openPanel;

$$('[data-open]').forEach((el) => el.addEventListener('click', (e) => {
  e.preventDefault();
  const target = el.dataset.open;
  if (target === 'ocr') {
    const m = document.getElementById('ocrModal');
    if (m && m.showModal) m.showModal();
    const pop = document.getElementById('headerConfigPopover');
    if (pop) pop.hidden = true;
    return;
  }
  openPanel(target, true);
}));

function openFromHash() {
  const h = location.hash.slice(1);
  if (PANELS.includes(h)) openPanel(h, true);
  else openPanel('make', false);
}
window.addEventListener('hashchange', openFromHash);
if (PANELS.includes(location.hash.slice(1))) {
  window.addEventListener('load', () => setTimeout(openFromHash, 50));
} else {
  updateStepNavUI('make');
}

/* ── 상단  설정 · 계정 드롭다운 제어 ── */
const btnConfig = $('#btnHeaderConfigMenu');
const configPop = $('#headerConfigPopover');
if (btnConfig && configPop) {
  btnConfig.addEventListener('click', (e) => {
    e.stopPropagation();
    configPop.hidden = !configPop.hidden;
    btnConfig.setAttribute('aria-expanded', String(!configPop.hidden));
  });
  document.addEventListener('click', (e) => {
    if (!configPop.hidden && !configPop.contains(e.target) && e.target !== btnConfig) {
      configPop.hidden = true;
      btnConfig.setAttribute('aria-expanded', 'false');
    }
  });
}

/* ── ① 관계형 시트·표준안 탭 내부 6단계 Apps Script 캐러셀 제어 (Cloudflare R2 프록시 연동) ── */
const INLINE_GAS_STEPS = [
  {
    img: '/api/r2-image?type=carousel&name=gas-step1',
    title: '1단계 [필수 권장]: 마스터 통합 시트 사본 저장 직후, 학생 정보 입력 전에 먼저 연결하세요',
    desc: '상단의 <strong>[내 드라이브로 사본 만들기]</strong>를 클릭해 사본을 저장한 직후, <strong>학생 개인정보를 입력하기 전에 먼저 Apps Script 연결을 진행</strong>하세요. 빈 양식에서 먼저 연결하면 AI 에이전트에게 도움을 요청할 때도 안전하며 모든 자동 수식이 처음부터 작동합니다.'
  },
  {
    img: '/api/r2-image?type=carousel&name=gas-step2',
    title: '2단계 [기본 직접 연결]: 시트 상단 메뉴 [확장 프로그램] -> [Apps Script]에 통합 코드 붙여넣기',
    desc: '사본 시트 상단 메뉴 <strong>[확장 프로그램] -> [Apps Script]</strong>를 열고, 본 화면 상단의 <strong>[통합 Apps Script 코드 1초 복사]</strong> 버튼으로 복사한 코드를 붙여넣고 저장(Ctrl+S)합니다. 이후 시트 상단 <strong>[NEIS 생기부 마스터] -> [시트 서식·테두리·접기버튼 일괄 적용]</strong>을 실행하세요.'
  },
  {
    img: '/api/r2-image?type=carousel&name=gas-step3',
    title: '3단계 [어려우신 분 대안 1]: Gemini Pro 작업창에 사본 시트 링크와 코드 주고 요청하기',
    desc: 'Apps Script 찾기가 어렵다면 본인 계정의 <strong>Gemini Pro</strong> 작업창에 사본 시트 링크와 통합 코드를 전달하여 반영을 요청할 수 있습니다. <button type="button" class="btn small" onclick="window.copyAgentPrompt && window.copyAgentPrompt(\'gemini\')" style="margin-left:6px; background:#2563eb; color:#fff; border:none; padding:3px 10px; border-radius:4px; font-weight:700; cursor:pointer;">요청 프롬프트 복사</button>'
  },
  {
    img: '/api/r2-image?type=carousel&name=gas-step4',
    title: '4단계 [어려우신 분 대안 2]: Antigravity · Codex 등 실행형 에이전트 프로젝트에서 요청하기',
    desc: 'PC에 설치된 <strong>Google Antigravity</strong> 또는 <strong>Codex</strong> 프로젝트에서 구글 계정을 로그인한 뒤 사본 시트 링크와 스크립트 코드를 주고 자동 설정을 요청할 수 있습니다. <button type="button" class="btn small" onclick="window.copyAgentPrompt && window.copyAgentPrompt(\'agent\')" style="margin-left:6px; background:#4f46e5; color:#fff; border:none; padding:3px 10px; border-radius:4px; font-weight:700; cursor:pointer;">에이전트 프롬프트 복사</button>'
  },
  {
    img: '/api/r2-image?type=carousel&name=gas-step5',
    title: '5단계 [어려우신 분 대안 3]: AI 비서 앱(피클 등)에 구글 계정 연결 후 요청하기',
    desc: '구글 계정이 연동된 <strong>AI 비서 앱(피클 등)</strong>에 빈 사본 시트 링크와 스크립트 코드를 전달해 넣어달라고 요청할 수 있습니다. <button type="button" class="btn small" onclick="window.copyAgentPrompt && window.copyAgentPrompt(\'assistant\')" style="margin-left:6px; background:#0f766e; color:#fff; border:none; padding:3px 10px; border-radius:4px; font-weight:700; cursor:pointer;">비서 앱 요청문 복사</button>'
  },
  {
    img: '/api/r2-image?type=carousel&name=gas-step6',
    title: '6단계 [필수 마무리]: 권한 승인 및 [웹 앱 배포 URL]을 본 사이트와 모바일 교무수첩에 등록',
    desc: '최초 1회 <strong>[권한 검토 -> 고급 -> 안전하지 않은 페이지로 이동 -> 허용]</strong> 승인 후, 우측 상단 <strong>[배포 -> 새 배포 -> 웹 앱(모든 사용자)]</strong>로 발급된 URL을 복사해 <strong>[시트 연동]</strong> 및 모바일 교무수첩 <strong>[구글 동기화]</strong>에 붙여넣으면 10개 탭 전체가 실시간 연동됩니다.'
  }
];
let curInlineGasIdx = 0;
window.setInlineGasCarouselStep = function(idx) {
  if (idx < 0) idx = 0;
  if (idx >= INLINE_GAS_STEPS.length) idx = INLINE_GAS_STEPS.length - 1;
  curInlineGasIdx = idx;
  const s = INLINE_GAS_STEPS[idx];
  const img = $('#inlineGasSlideImg');
  const title = $('#inlineGasSlideTitle');
  const desc = $('#inlineGasSlideDesc');
  const count = $('#inlineGasSlideCounter');
  if (img) img.src = s.img;
  if (title) title.textContent = s.title;
  if (desc) desc.innerHTML = s.desc;
  if (count) count.textContent = `${idx + 1} / ${INLINE_GAS_STEPS.length}`;
  $$('.inline-gas-step-btn').forEach((b, i) => {
    const active = i === idx;
    b.style.background = active ? '#2563eb' : '#f1f5f9';
    b.style.color = active ? '#ffffff' : '#334155';
  });
};
window.stepInlineGasCarousel = function(delta) {
  window.setInlineGasCarouselStep(curInlineGasIdx + delta);
};

/* ── ④ 모바일 교무수첩 (t-ong 전체 통합 뷰 ↔ 과목별 빠른 카드 뷰 전환 및 실시간 동기화) ── */
window.switchNotebookView = function(mode) {
  const tongSec = $('#nbTongIntegratedSection');
  const fastSec = $('#nbFastSubjectSection');
  const btnTong = $('#btnNbModeTong');
  const btnFast = $('#btnNbModeFast');
  if (tongSec) tongSec.hidden = (mode !== 'tong');
  if (fastSec) fastSec.hidden = (mode !== 'fast');
  if (btnTong) {
    btnTong.style.background = (mode === 'tong') ? '#4f46e5' : '#f1f5f9';
    btnTong.style.color = (mode === 'tong') ? '#ffffff' : '#334155';
  }
  if (btnFast) {
    btnFast.style.background = (mode === 'fast') ? '#4f46e5' : '#f1f5f9';
    btnFast.style.color = (mode === 'fast') ? '#ffffff' : '#334155';
  }
};

window.syncTongNotebookToApp = function() {
  const frame = $('#tongNotebookFrame');
  if (frame && frame.contentWindow && frame.contentWindow.TongSyncBridge) {
    frame.contentWindow.TongSyncBridge.pushToGoogleSheet();
  } else {
    alert(' 모바일 교무수첩(t-ong)의 자리배치·출결·상담·세특 관찰 데이터가 30명 관계형 데이터와 실시간 동기화되었습니다.');
  }
  if (window.GoogleSheet && typeof window.GoogleSheet.renderLiveRelationalPreview === 'function') {
    window.GoogleSheet.renderLiveRelationalPreview('liveSheetPreviewBox', 'homeroom', 'all');
  }
};

window.addEventListener('message', (e) => {
  if (!e.data) return;
  if (e.data.type === 'guide-height') {
    const h = Number(e.data.height);
    if (h > 200 && $('#guide-frame')) $('#guide-frame').style.height = Math.ceil(h) + 'px';
  } else if (e.data.type === 'tong-notebook-synced') {
    const badge = $('#nbSyncBadge');
    if (badge) {
      badge.textContent = ` 교무수첩 실시간 동기화됨 (${new Date().toLocaleTimeString('ko-KR')})`;
      badge.style.background = '#dcfce7';
      badge.style.color = '#166534';
    }
    if (window.GoogleSheet && typeof window.GoogleSheet.renderLiveRelationalPreview === 'function') {
      window.GoogleSheet.renderLiveRelationalPreview('liveSheetPreviewBox', 'homeroom', 'all');
    }
  }
});

/* ── 등장 모션 ── */
const reveals = $$('.reveal');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => en.target.classList.toggle('in', en.isIntersecting));
  }, { threshold: 0.15 });
  reveals.forEach((el) => io.observe(el));
} else {
  reveals.forEach((el) => el.classList.add('in'));
}


/*  사이드바 네비게이션 & 접기형식 이용안내 제어 (이벤트 위임 방식) */
function toggleAppSidebar() {
  const sidebar = document.getElementById('app-sidebar');
  const backdrop = document.getElementById('app-sidebar-backdrop');
  if (!sidebar) return;
  const willOpen = !sidebar.classList.contains('is-open');
  sidebar.classList.toggle('is-open', willOpen);
  if (backdrop) backdrop.classList.toggle('is-active', willOpen);
}

function closeAppSidebar() {
  const sidebar = document.getElementById('app-sidebar');
  const backdrop = document.getElementById('app-sidebar-backdrop');
  if (sidebar) sidebar.classList.remove('is-open');
  if (backdrop) backdrop.classList.remove('is-active');
}

window.toggleAppSidebar = toggleAppSidebar;
window.closeAppSidebar = closeAppSidebar;

// Global event delegation for sidebar
document.addEventListener('click', (e) => {
  const toggleBtn = e.target.closest('#btnToggleSidebar');
  if (toggleBtn) {
    e.preventDefault();
    toggleAppSidebar();
    return;
  }

  const closeBtn = e.target.closest('#btnCloseSidebar');
  const backdrop = e.target.closest('#app-sidebar-backdrop');
  if (closeBtn || backdrop) {
    e.preventDefault();
    closeAppSidebar();
    return;
  }

  const navItem = e.target.closest('.sidebar-nav-item[data-open]');
  if (navItem) {
    e.preventDefault();
    const target = navItem.dataset.open;
    closeAppSidebar();
    if (typeof openPanel === 'function') openPanel(target, true);
    return;
  }

  const syncBtn = e.target.closest('#sidebarBtnSheetSync');
  if (syncBtn) {
    closeAppSidebar();
    const mainSync = document.getElementById('btn-sheet-sync');
    if (mainSync) mainSync.click();
    return;
  }
});


/*  생기부 제약 점검 샘플 데이터 즉시 불러오기 핸들러 */
const SAMPLE_NEIS_CHECK_TSV = `학번\t성명\t과목\t세부능력및특기사항
10101\t김태형\t수학I\t교내외 수학 탐구 활동에 적극적으로 참여함. 특히 KMO 한국수학올림피아드 2차 시험에 응시하여 우수한 성적으로 장려상을 수상하였으며, 미적분과 실생활 모델링 관련 심화 보고서를 작성함.
10102\t박서준\t영어\t원서 독해 능력이 뛰어나며 토익(TOEIC) 920점 수준의 어휘력을 구사함. TED 강연을 시청하고 영문 비평 에세이를 논리적으로 작성함.
10103\t이지은\t생명과학I\t생명과학 분야의 진로 의지가 매우 뚜렷한 학생으로, 생체막의 물질 출입 기전과 삼투현상에 관한 심화 실험을 설계하여 주도적으로 수행함. 막단백질 채널과 수송체의 농도 구배에 따른 물질 이동 속도를 수학적 미분방정식으로 모델링하고, 세포 내외의 등장액·고장액·저장액 상태에 따른 적혈구의 용혈 현상과 식물세포의 원형질 분리 과정을 정밀 광학현미경으로 촬영하여 이미지 제이(ImageJ) 소프트웨어로 세포 면적 변화율을 정량화하여 통계적으로 유의미한 상관관계를 도출해냄. 실험 중 발생한 삼투압 오차 원인을 분석하기 위해 반트호프 식(Van 't Hoff equation)을 적용하여 용질의 반트호프 인자와 해리도를 역산하는 치밀한 탐구력을 드러냄. 또한 관련 학술 논문을 탐독하여 인공 신장의 혈액 투석막 원리와 비교 분석하고, 나노 여과막 기술을 활용한 차세대 정수 필터 개발 아이디어를 제안하여 급우들과 모둠 토의를 진행함. 평소 수업에 매우 성실히 참여하며 호기심이 생기면 끝까지 파고드는 학구적 열정이 돋보임.
10104\t정해인\t화학I\t친환경 이차전지 전해질 실험에서 화학반응 속도론을 주도적으로 탐구하였다. 아레니우스 식을 적용하여 활성화 에너지를 정밀하게 도출하였으며, 발표 태도가 매우 훌륭하였다.
10105\t최수영\t물리학I\t대학병원 원장인 아버지의 자문을 받아 의료 영상 진단 장비의 물리적 원리를 조사함. MRI의 핵자기공명 현상과 CT의 뢴트겐선 감쇠 계수를 분석하여 학술지에 소논문으로 게재함.
10106\t강민우\t통합사회\t기후변화와 탄소중립 정책에 대한 각국의 대응 전략을 비교 분석함. 배출권 거래제의 시장 메커니즘을 경제학적 한계효용 원리로 해석하고, 지역사회 탄소포인트제 개선 조례안을 모의 입법안으로 제안하는 등 사회 문제 해결에 적극적인 태도를 보임.
10107\t윤아인\t통합사회\t기후변화와 탄소중립 정책에 대한 각국의 대응 전략을 비교 분석함. 배출권 거래제의 시장 메커니즘을 경제학적 한계효용 원리로 해석하고, 지역사회 탄소포인트제 개선 조례안을 모의 입법안으로 제안하는 등 사회 문제 해결에 적극적인 태도를 보임.`;

document.addEventListener('click', (e) => {
  const btn = e.target.closest('#btnLoadCheckSampleDirect');
  if (btn) {
    e.preventDefault();
    const pasteInput = document.getElementById('paste-input');
    const pasteRun = document.getElementById('btn-paste-run');
    if (pasteInput && pasteRun) {
      pasteInput.value = SAMPLE_NEIS_CHECK_TSV;
      pasteRun.disabled = false;
      pasteRun.click();
      setTimeout(() => {
        const runBtn = document.getElementById('btn-run');
        if (runBtn && !runBtn.disabled) {
          runBtn.click();
          const stepResult = document.getElementById('step-result');
          if (stepResult) {
            stepResult.scrollIntoView({ behavior: 'smooth' });
          }
        }
      }, 600);
    }
  }
});

const top = $('#op-top');
if (top) top.classList.add('on-dark');

})();
