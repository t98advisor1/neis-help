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
  $$('#op-tabs button, #op-top-step-tabs button').forEach((b) => {
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

/* ── 상단 ⚙️ 설정 · 계정 드롭다운 제어 ── */
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
    title: '1단계: 학급담임용 / 교과담임용 관계형 표준시트 사본 만들기',
    desc: '상단의 <strong>[📘 학급담임용 표준시트 사본 만들기]</strong> 또는 <strong>[📗 교과담임용 표준시트 사본 만들기]</strong> 버튼을 클릭해 선생님 개인 구글 드라이브로 복사합니다. (교과담임용은 불필요한 대입상담 탭을 제외하고 수업관찰·AI세특에 집중되어 있습니다.)'
  },
  {
    img: '/api/r2-image?type=carousel&name=gas-step2',
    title: '2단계: 구글 시트 상단 메뉴 [확장 프로그램] ➔ [Apps Script] 클릭',
    desc: '복사한 구글 시트 상단 메뉴에서 <strong>[확장 프로그램] ➔ [Apps Script]</strong>를 누르면 스크립트 에디터 창이 열립니다.'
  },
  {
    img: '/api/r2-image?type=carousel&name=gas-step3',
    title: '3단계: 통합 Apps Script 코드 붙여넣기 & 💾 저장(Ctrl+S)',
    desc: '아래 <strong>[📋 통합 Apps Script 코드 1초 복사]</strong> 버튼을 눌러 복사한 코드를 에디터에 붙여넣고 저장합니다. 시트의 <code>_스킬지침</code> 탭에 내장된 앱의 5대 기재요령 지침을 자동으로 참조합니다.'
  },
  {
    img: '/api/r2-image?type=carousel&name=gas-step4',
    title: '4단계: 우측 상단 [배포] ➔ [새 배포] ➔ [웹 앱 (모든 사용자)] 선택',
    desc: '우측 상단 <strong>[배포] ➔ [새 배포]</strong>에서 유형을 <strong>웹 앱(Web App)</strong>으로 선택하고, 액세스 권한을 <strong>모든 사용자(Anyone)</strong>로 지정한 뒤 배포를 클릭합니다.'
  },
  {
    img: '/api/r2-image?type=carousel&name=gas-step5',
    title: '5단계: 최초 1회 권한 승인 ([고급] ➔ [안전하지 않은 페이지로 이동] ➔ [허용])',
    desc: '구글 보안 안내창이 뜨면 <strong>[고급(Advanced)]</strong>을 누른 뒤 하단의 <strong>[안전하지 않은 페이지로 이동] ➔ [허용]</strong>을 순서대로 클릭합니다.'
  },
  {
    img: '/api/r2-image?type=carousel&name=gas-step6',
    title: '6단계: 생성된 [웹 앱 URL]을 복사하여 본 앱 [시트 연동]에 등록!',
    desc: '발급된 <code>https://script.google.com/macros/s/.../exec</code> 주소를 복사해 앱의 <strong>[시트 연동 설정]</strong>에 붙여넣으면 명렬표·세특·대입상담·모바일 교무수첩이 실시간 양방향 동기화됩니다!'
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
    alert('✅ 모바일 교무수첩(t-ong)의 자리배치·출결·상담·세특 관찰 데이터가 30명 관계형 데이터와 실시간 동기화되었습니다.');
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
      badge.textContent = `🟢 교무수첩 실시간 동기화됨 (${new Date().toLocaleTimeString('ko-KR')})`;
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

const top = $('#op-top');
if (top) top.classList.add('on-dark');

})();
