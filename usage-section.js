'use strict';
/* 사용법·검사 규칙 메뉴 — 탭 두 개(사용법 / 검사 규칙)와 한 단계씩 보여 주는 화면.
 * 검사 규칙 탭의 글자 수 한도·사전·형식 목록은 rules.js 에서 읽어 그린다.
 * 그래서 규칙을 고치면 이 화면의 설명도 따라 바뀐다(손으로 옮겨 적지 않는다). */
(function () {

const host = document.getElementById('usage-body');
if (!host) return;
const R = window.SRRules;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Number(n).toLocaleString('ko-KR');

/* ── 사용법: 실제 화면 순서대로 ── */
const MOCK_TOP = '<div class="mock-top"><div class="mock-title">학교생활기록부 점검 도우미</div><div class="mock-badge">🔒 외부 전송 없음</div></div>';

const USE = [
  { short: '메뉴에서 시작', title: '1. 메뉴에서 시작하기', sub: '소개 화면에서 [시작하기]를 누르면 메뉴가 나옵니다.',
    mock: `<div class="mock">${MOCK_TOP}<div class="mock-content"><div style="font-size:13px;font-weight:700;margin-bottom:10px">무엇을 확인하시겠어요?</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div class="mock-row" style="margin:0;border-color:#ff385c">📝 생기부 점검하기</div><div class="mock-row" style="margin:0">📘 사용법 · 검사 규칙</div><div class="mock-row" style="margin:0">📖 기재요령 검색</div><div class="mock-row" style="margin:0">✍️ AI 프롬프트</div></div></div></div>`,
    notes: [['첫 화면', '서비스 소개가 나옵니다. [시작하기]를 누르거나 마우스 휠을 한 번 내리면 메뉴 화면으로 넘어갑니다.'],
            ['메뉴 선택', '[생기부 점검하기]를 누르면 같은 페이지 아래 화면에서 바로 열립니다. 다른 페이지로 이동하지 않습니다.'],
            ['위쪽 탭', '내용 화면 위쪽의 탭으로 다른 메뉴로 옮기고, [↑ 메뉴]로 메뉴 화면에 돌아갑니다.']] },
  { short: '파일 열기', title: '2. 파일 열기', sub: '점검할 파일을 올립니다.',
    mock: `<div class="mock">${MOCK_TOP}<div class="mock-content"><div style="font-size:12px;font-weight:700;margin-bottom:10px">① 파일 열기</div><div class="mock-drop"><div class="dm">엑셀 또는 PDF 파일을 여기에 끌어다 놓거나 클릭해서 선택하세요</div><div class="ds">.xlsx · .xls · .csv · .pdf — 여러 개를 한 번에</div></div></div></div>`,
    notes: [['담임 전체점검', '학교생활기록부 → 학생부 조회 및 출력 → PDF로 저장한 뒤 올립니다.'],
            ['교과·동아리 등 개별점검', '해당 항목을 엑셀 파일로 저장한 뒤 올립니다. 과목별 파일을 한꺼번에 올리면 과목을 가로지르는 복사·붙여넣기도 잡아 줍니다.'],
            ['여러 개를 한 번에', '끌어다 놓거나 클릭해서 고릅니다. 파일 형식은 .xlsx .xls .csv .pdf 입니다.'],
            ['엑셀에서 복사해 붙여넣기', '파일 없이도 됩니다. 엑셀에서 제목 줄까지 칸을 복사(Ctrl+C)해 붙여넣기 칸에 붙여넣거나(Ctrl+V), 이 화면 어디서든 Ctrl+V 하면 바로 읽습니다.'],
            ['개인정보', '파일은 이 브라우저 안에서만 처리되며 외부로 전송되지 않습니다.']] },
  { short: '검사할 항목 확인', title: '3. 검사할 항목 확인', sub: '무엇을 검사할지 자동으로 맞춰집니다.',
    mock: `<div class="mock">${MOCK_TOP}<div class="mock-content"><div style="font-size:12px;font-weight:700;margin-bottom:10px">② 검사할 항목 확인</div><div class="mock-run">검사 실행</div><div style="margin-top:12px"><div class="mock-row"><span>세부능력 및 특기사항</span><span style="margin-left:auto;color:#999">검사함</span></div><div class="mock-row"><span>행동특성 및 종합의견</span><span style="margin-left:auto;color:#999">검사함</span></div><div class="mock-row"><span>번호 / 이름 열</span><span style="margin-left:auto;color:#999">검사 안 함</span></div></div></div></div>`,
    notes: [['자동 인식', '엑셀은 열 이름으로, PDF는 학생·영역별 구간으로 검사 대상을 자동으로 맞춥니다.'],
            ['틀리면 고치기', '잘못 인식된 열이나 구간은 직접 바꿀 수 있습니다.'],
            ['검사 실행', '확인이 끝나면 [검사 실행]을 눌러 검사를 시작합니다.']] },
  { short: '검사 결과 보기', title: '4. 검사 결과 보기', sub: '결과가 네 개의 탭으로 정리됩니다.',
    mock: `<div class="mock">${MOCK_TOP}<div class="mock-content"><div class="mock-tabs"><div class="mock-tab on">지적 사항</div><div class="mock-tab">학생별</div><div class="mock-tab">유형별</div><div class="mock-tab">중복 문장</div></div><div class="mock-filter"><div class="mock-sel">심각도 ▾</div><div class="mock-sel">영역 ▾</div><div class="mock-sel" style="flex:1;text-align:left">🔎 검색</div><div class="mock-sel" style="background:var(--soft)">결과 엑셀로 저장</div></div><div class="mock-row"><span class="dot v"></span><span>부모 직업 암시 표현</span></div><div class="mock-row"><span class="dot w"></span><span>맥락 확인이 필요한 표현</span></div><div class="mock-row"><span class="dot i"></span><span>표기·형식 점검</span></div></div></div>`,
    notes: [['네 개의 탭', '지적 사항 / 학생별 / 유형별 / 중복 문장으로 나눠 봅니다.'],
            ['걸러 보기', '심각도·영역·유형을 고르거나 낱말·학생을 검색해 좁힙니다.'],
            ['확인함 표시', '살펴본 지적은 ‘확인함’으로 넘기고, [남은 것만]으로 아직 안 본 것만 모아 봅니다.'],
            ['엑셀로 저장', '[결과 엑셀로 저장]으로 지적 목록을 내려받습니다.']] },
  { short: '규칙 설정 (선택)', title: '5. 규칙 설정 (선택)', sub: '처음에는 건드리지 않아도 됩니다.',
    mock: `<div class="mock">${MOCK_TOP.replace('</div></div>', '</div><div class="mock-ghost">규칙 설정</div></div>')}<div class="mock-content"><div class="mock-caution" style="border-color:#f3d3cc">⚠️ 처음엔 건드리지 않아도 됩니다. 기본값 그대로 쓰세요.</div><div class="mock-row"><span>금지어·허용 표현 직접 넣기</span></div><div class="mock-row"><span>기본값: 2026학년도 기재요령 기준</span></div></div></div>`,
    notes: [['여는 곳', '화면 위쪽의 [규칙 설정]을 누릅니다.'],
            ['처음엔 그대로', '기본값이 2026학년도 기재요령 기준으로 맞춰져 있습니다.'],
            ['직접 추가', '학교만의 금지어와 허용 표현을 더할 수 있습니다. 고친 내용은 이 브라우저에만 저장됩니다.'],
            ['규칙 파일', '고친 규칙을 파일로 내보내 동료 교사와 나눌 수 있습니다. 규칙만 담기고 생기부 내용은 담기지 않습니다.']] },
];

/* ── 검사 규칙: rules.js 에서 읽어 그린다 ── */
const DICT_GROUPS = [
  ['성적·시험',          ['exam-lang', 'mock-exam', 'exam-cert', 'license']],
  ['대회·수상',          ['award-contest', 'award-external', 'award-banned-kind', 'olympiad-name', 'night-study']],
  ['논문·출판·지식재산', ['paper', 'citation-index', 'report', 'book', 'ip']],
  ['학교·기관·상호명',   ['school-id', 'univ-name', 'org-name', 'private-academy', 'research-inst', 'org-public', 'media-name', 'brand-software', 'brand-company', 'indirect-ref', 'youth-org']],
  ['가정·개인정보',      ['family', 'scholarship', 'privacy-word', 'donation']],
  ['활동 제한',          ['overseas', 'afterschool', 'mooc', 'gifted']],
];

function ruleWays() {
  return `<div class="way">
    <div class="way-item"><b>1. 분량 초과</b><span>영역별 글자 수 한도를 넘는지 확인합니다. NEIS 기준 Byte로 계산합니다.</span></div>
    <div class="way-item"><b>2. 금지 표현</b><span>기재요령상 적으면 안 되는 낱말·표현이 있는지 사전으로 찾습니다.</span></div>
    <div class="way-item"><b>3. 형식·표기</b><span>개인정보 형식, 특수기호, 이모지, 공백 같은 표기 문제를 찾습니다.</span></div>
    <div class="way-item"><b>4. 문맥 규칙</b><span>‘부모 직업’처럼 두 조건이 한 문장에 함께 있을 때만 잡습니다.</span></div>
    <div class="way-item"><b>5. 문장 종결</b><span>서술형 영역에서 ‘-함/-임’ 명사형 종결을 지키는지 봅니다. (참고용)</span></div>
    <div class="way-item"><b>6. 중복 문장</b><span>같은 문장이 여러 칸·여러 학생에 반복되는지 찾습니다. 판정 최소 길이는 규칙 설정에서 바꿉니다.</span></div>
  </div>`;
}

function ruleLimits() {
  const per = R.BYTES_PER_CHAR;
  const rows = R.AREAS.filter((a) => a.limit).map((a) =>
    `<div class="lim"><span>${esc(a.label)}</span><b>${fmt(a.limit)}자 <small>${fmt(a.limit * per)} Byte</small></b></div>`).join('');
  return `<div class="lim-grid">${rows}</div>
    <p class="us-note">한글 1자는 ${per}Byte, 영문·숫자·줄바꿈은 1Byte로 셉니다. 그래서 영문·숫자가 섞이면 글자 수가 한도를 넘어도 Byte로는 들어갈 수 있습니다.</p>`;
}

function ruleDictionary() {
  const byId = new Map(R.DICTIONARY.map((d) => [d.id, d]));
  const used = new Set();
  const clause = (d) => esc(d.clause ? String(d.clause).replace('작성 시 유의사항 ', '유의사항 ') : '개인정보 보호');
  const item = (d) => {
    used.add(d.id);
    const terms = d.terms || [];
    const eg = terms.slice(0, 3).map(esc).join(', ');
    return `<div class="grow-item"><div class="gi-top"><b>${esc(d.category)}</b><span class="clause">${clause(d)}</span></div>` +
      `<span class="gi-desc">낱말 ${fmt(terms.length)}개${eg ? ' · 예: ' + eg : ''}</span></div>`;
  };
  let html = '';
  DICT_GROUPS.forEach(([name, ids]) => {
    const items = ids.map((id) => byId.get(id)).filter(Boolean);
    if (items.length) html += `<h4 class="us-h">${esc(name)}</h4>${items.map(item).join('')}`;
  });
  const rest = R.DICTIONARY.filter((d) => !used.has(d.id));
  if (rest.length) html += `<h4 class="us-h">기타</h4>${rest.map(item).join('')}`;
  return `<p class="us-note" style="margin-top:0">모두 「${esc(R.SOURCE.year)} ${esc(R.SOURCE.title)}」를 근거로 합니다. 항목마다 근거 조항을 함께 보여 줍니다.</p>${html}`;
}

function ruleFormats() {
  const cats = [];
  R.PATTERNS.forEach((p) => { if (!cats.includes(p.category)) cats.push(p.category); });
  const prox = R.PROXIMITY.map((p) => {
    const why = String(p.basis || '').split('—').slice(1).join('—').trim();
    return `<div class="grow-item"><div class="gi-top"><b>${esc(p.category)}</b><span class="clause">${esc(String(p.clause || '').replace('작성 시 유의사항 ', '유의사항 '))}</span></div>` +
      (why ? `<span class="gi-desc">${esc(why.length > 90 ? why.slice(0, 90) + '…' : why)}</span>` : '') + '</div>';
  }).join('');
  return `<h4 class="us-h">형식 검사 — 글자 모양만 보고 잡습니다</h4>
    <div class="us-chips">${cats.map((c) => `<span>${esc(c)}</span>`).join('')}</div>
    <h4 class="us-h">문맥 검사 — 두 조건이 한 문장에 함께 있을 때만 잡습니다</h4>${prox}`;
}

function ruleSeverity() {
  const L = R.SEVERITY_LABEL;
  return `<div class="sev-row"><span class="sev-badge sev-v">${esc(L.violation)}</span><span class="d"><b>기재요령에 어긋날 가능성이 큼</b><span> — 꼭 확인하고 수정하세요. (예: 부모 직업, 교외 수상)</span></span></div>
    <div class="sev-row"><span class="sev-badge sev-w">${esc(L.warning)}</span><span class="d"><b>맥락에 따라 문제될 수 있음</b><span> — 문장을 보고 판단하세요.</span></span></div>
    <div class="sev-row"><span class="sev-badge sev-i">${esc(L.info)}</span><span class="d"><b>표기·형식 관련</b><span> — 가볍게 확인하세요. (예: 띄어쓰기, 기호)</span></span></div>
    <p class="us-note">애매한 경우 놓치지 않도록 ‘위반’으로 넉넉히 표시합니다. 최종 판단은 반드시 선생님이 하세요.</p>`;
}

/* ── 점검 요소: 지금 적용 중인 기준을 글로 옮긴다 ──
 * 코드박스에 보여 주고, 복사하거나 텍스트·HTML 로 내려받는다. AI 에게 붙여 넣거나 문서로 보관하는 용도다.
 * 이 브라우저의 '규칙 설정'에서 고친 내용(끈 항목·바꾼 한도·직접 넣은 금지어)이 있으면 그것까지 반영한다. */
const CUSTOM_BAN_ID = 'custom-ban';
let criteriaAll = false;   // 금지 표현 낱말을 모두 넣을지(기본은 예시만)

function currentSettings() {
  try { return (window.SRApp && window.SRApp.settings && window.SRApp.settings()) || null; } catch (e) { return null; }
}
const shortClause = (c) => String(c || '').replace('작성 시 유의사항 ', '유의사항 ');

function criteria(allTerms) {
  const S = currentSettings();
  const L = R.SEVERITY_LABEL;
  const per = R.BYTES_PER_CHAR;
  const sections = [];

  // 1. 글자 수 한도
  const limitOn = !S || S.checkLength !== false;
  const limits = R.AREAS.map((a) => ({ a, v: S && S.limits ? S.limits[a.key] : a.limit }))
    .filter((x) => x.v != null && x.v !== '' && Number(x.v) > 0);
  sections.push({
    title: '영역별 글자 수 한도',
    note: limitOn ? `NEIS는 Byte로 셉니다. 한글 1자 = ${per}Byte, 영문·숫자·줄바꿈 = 1Byte 입니다.` : '글자 수(분량) 검사가 꺼져 있습니다.',
    groups: limitOn ? [{ items: limits.map(({ a, v }) => ({ main: a.label, detail: `${fmt(v)}자 (${fmt(v * per)}Byte)` })) }] : [],
  });

  // 2. 금지 표현 사전
  const dict = (S && S.dictionary ? S.dictionary : R.DICTIONARY).filter((d) => d.enabled !== false && (d.terms || []).length);
  const byId = new Map(dict.map((d) => [d.id, d]));
  const used = new Set();
  const dictItem = (d) => {
    used.add(d.id);
    const terms = d.terms || [];
    const shown = allTerms ? terms : terms.slice(0, 5);
    const more = terms.length - shown.length;
    const where = d.id === CUSTOM_BAN_ID ? '직접 넣은 기준' : shortClause(d.clause) || '개인정보 보호';
    return { main: d.category, tag: `${L[d.severity] || d.severity} · ${where}`,
             detail: shown.join(', ') + (more > 0 ? ` … 외 ${fmt(more)}개` : '') };
  };
  const dictGroups = [];
  DICT_GROUPS.forEach(([name, ids]) => {
    const items = ids.map((id) => byId.get(id)).filter(Boolean).map(dictItem);
    if (items.length) dictGroups.push({ name, items });
  });
  const mine = byId.get(CUSTOM_BAN_ID);
  if (mine && !used.has(mine.id)) dictGroups.push({ name: '직접 넣은 금지어', items: [dictItem(mine)] });
  const rest = dict.filter((d) => !used.has(d.id)).map(dictItem);
  if (rest.length) dictGroups.push({ name: '기타', items: rest });
  sections.push({
    title: '기재하면 안 되는 표현 (금지 표현 사전)',
    note: `각 항목의 낱말이 본문에 있으면 지적합니다. ${allTerms ? '낱말을 모두 적었습니다.' : '낱말은 예시만 적었습니다(앞 5개).'}`,
    groups: dictGroups,
  });

  // 3. 형식·표기
  const offP = new Set((S && S.disabledPatterns) || []);
  const pats = R.PATTERNS.filter((p) => !offP.has(p.id));
  sections.push({
    title: '형식·표기 검사',
    note: '글자 모양만 보고 찾습니다.',
    groups: [{ items: pats.map((p) => ({ main: p.category, tag: L[p.severity], detail: String(p.basis).replace(/^.*? — /, '') })) }],
  });

  // 4. 문맥
  const offR = new Set((S && S.disabledRules) || []);
  const prox = R.PROXIMITY.filter((p) => !offR.has(p.id));
  sections.push({
    title: '문맥 검사',
    note: '한 문장 안에 두 조건이 함께 있을 때만 지적합니다.',
    groups: [{ items: prox.map((p) => ({ main: p.category, tag: `${L[p.severity]} · ${shortClause(String(p.basis).split(' — ')[0])}`,
      detail: String(p.basis).split(' — ').slice(1).join(' — ') })) }],
  });

  // 5. 문장 종결·중복
  const narrative = R.AREAS.filter((a) => R.NARRATIVE_AREAS.has(a.key)).map((a) => a.label).join(', ');
  const tail = [];
  if (!S || S.checkEnding !== false) tail.push({ main: '문장 종결', detail: `서술형 영역(${narrative})은 명사형 종결(‘-함’, ‘-임’)을 쓰는 것이 원칙입니다. (참고용)` });
  tail.push({ main: '중복 문장', detail: `같은 문장이 여러 칸·여러 학생에 ${S && S.dupMinLen ? S.dupMinLen : 20}자 이상 반복되면 찾아 줍니다.` });
  sections.push({ title: '문장 종결·중복 문장', groups: [{ items: tail }] });

  // 6. 허용 표현
  const allow = (S && S.allowlist) || [];
  if (allow.length) sections.push({ title: '허용 표현 (지적에서 제외)', groups: [{ items: [{ main: allow.join(', ') }] }] });

  const d = new Date();
  return {
    title: '학교생활기록부 점검 요소',
    basis: `${R.SOURCE.year} ${R.SOURCE.title} 기준 · ${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()} 내려받음`,
    caution: '※ 참고용 자료입니다. 내용의 오류나 누락이 있을 수 있으므로 최종 판단은 반드시 교사가 직접 확인해 주세요. 이 브라우저의 [규칙 설정]에서 고친 내용이 있으면 그것까지 반영된 목록입니다.',
    sections,
  };
}

function criteriaText(c) {
  const out = [c.title, c.basis, c.caution, ''];
  c.sections.forEach((sec, i) => {
    out.push(`${i + 1}. ${sec.title}`);
    if (sec.note) out.push(`   ${sec.note}`);
    sec.groups.forEach((g) => {
      if (g.name) out.push(`  ■ ${g.name}`);
      g.items.forEach((it) => out.push(`   - ${it.main}${it.tag ? ` [${it.tag}]` : ''}${it.detail ? (it.tag ? ' — ' : ': ') + it.detail : ''}`));
    });
    out.push('');
  });
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

function criteriaHtml(c) {
  const secs = c.sections.map((sec, i) =>
    `<section><h2>${i + 1}. ${esc(sec.title)}</h2>${sec.note ? `<p class="note">${esc(sec.note)}</p>` : ''}` +
    sec.groups.map((g) => `${g.name ? `<h3>${esc(g.name)}</h3>` : ''}<ul>${g.items.map((it) =>
      `<li><b>${esc(it.main)}</b>${it.tag ? ` <span class="tag">${esc(it.tag)}</span>` : ''}${it.detail ? `<div class="d">${esc(it.detail)}</div>` : ''}</li>`).join('')}</ul>`).join('') +
    '</section>').join('');
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(c.title)}</title>
<style>
  body{margin:0;background:#faf9f5;color:#1f1e1d;font:15px/1.7 -apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic",sans-serif}
  main{max-width:860px;margin:0 auto;padding:40px 24px 64px}
  h1{margin:0 0 4px;font-size:26px}
  .basis{margin:0 0 12px;color:#6f6d66;font-size:14px}
  .caution{margin:0 0 28px;padding:12px 16px;border:1px solid #f3d3cc;border-radius:10px;background:#fff5f3;color:#c13515;font-size:13px}
  section{margin:0 0 28px;padding:20px 22px;border:1px solid #e6e3d8;border-radius:14px;background:#fff}
  h2{margin:0 0 6px;font-size:18px}
  h3{margin:18px 0 6px;font-size:14px;color:#6f6d66}
  .note{margin:0 0 8px;color:#6f6d66;font-size:13px}
  ul{margin:0;padding-left:20px}
  li{margin:6px 0}
  .tag{display:inline-block;padding:1px 9px;border-radius:99px;background:#efede4;color:#3d3c38;font-size:12px}
  .d{color:#3d3c38;font-size:13px}
  @media print{body{background:#fff}section{break-inside:avoid;border-color:#ccc}}
</style></head><body><main>
<h1>${esc(c.title)}</h1><p class="basis">${esc(c.basis)}</p><p class="caution">${esc(c.caution)}</p>
${secs}
</main></body></html>`;
}

function ruleCriteria() {
  const text = criteriaText(criteria(criteriaAll));
  return `<p class="us-note" style="margin-top:0">지금 적용 중인 점검 기준을 글로 옮긴 것입니다. 복사해서 AI에 붙여 넣거나, 파일로 내려받아 보관하세요.</p>
    <div class="us-code">
      <div class="us-code-bar">
        <span>점검 요소 · 글 ${fmt(text.length)}자</span>
        <span class="us-code-btns">
          <button type="button" data-act="copy">복사</button>
          <button type="button" data-act="dl-txt">텍스트(.txt)로 받기</button>
          <button type="button" data-act="dl-html">HTML(.html)로 받기</button>
        </span>
      </div>
      <pre><code id="us-code">${esc(text)}</code></pre>
    </div>
    <label class="us-opt"><input type="checkbox" id="us-all"${criteriaAll ? ' checked' : ''}> 금지 표현 낱말을 모두 포함 <small>(끄면 항목마다 예시 5개만)</small></label>`;
}

function saveFile(name, mime, content) {
  const blob = new Blob(['﻿', content], { type: mime + ';charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* 아래 대체 방법 */ }
  }
  const ta = document.createElement('textarea');
  ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-9999px;top:0';
  document.body.appendChild(ta); ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
  ta.remove();
  return ok;
}

async function criteriaAction(act, btn) {
  const c = criteria(criteriaAll);
  if (act === 'dl-txt') return saveFile('학교생활기록부_점검요소.txt', 'text/plain', criteriaText(c));
  if (act === 'dl-html') return saveFile('학교생활기록부_점검요소.html', 'text/html', criteriaHtml(c));
  if (act === 'copy') {
    const ok = await copyText(criteriaText(c));
    const old = btn.textContent;
    btn.textContent = ok ? '복사됨 ✓' : '복사 실패 — 상자를 눌러 직접 선택하세요';
    setTimeout(() => { if (btn.isConnected) btn.textContent = old; }, 1800);
  }
}

const RULE = [
  { short: '이렇게 검사합니다', title: '검사 방식 6가지', sub: '한 칸씩 이 여섯 가지 방식으로 살펴봅니다.', html: ruleWays },
  { short: '글자 수 한도',     title: '영역별 글자 수 한도', sub: 'NEIS 실제 한도에 맞춰 계산합니다.', html: ruleLimits },
  { short: '금지 표현 사전',   title: '주로 잡아내는 금지 표현', sub: '낱말 목록은 규칙 설정에서 보고 고칠 수 있습니다.', html: ruleDictionary },
  { short: '형식·문맥 검사',   title: '형식 검사와 문맥 검사', sub: '낱말 사전으로는 못 잡는 것을 따로 살핍니다.', html: ruleFormats },
  { short: '심각도 3단계',     title: '심각도 3단계', sub: '색깔로 구분해 표시합니다.', html: ruleSeverity },
  { short: '점검 요소 받기',   title: '점검 요소 복사·내려받기', sub: '검사하는 기준 전체를 글로 가져갑니다.', html: ruleCriteria },
];

/* ── 화면: 탭 두 개 + 한 단계씩 ── */
const SETS = { use: { label: '사용법', steps: USE }, rule: { label: '검사 규칙', steps: RULE } };
let tab = 'use';
let idx = 0;

function stageHtml(s) {
  const head = `<h3 class="slide-title">${esc(s.title)}</h3><p class="slide-sub">${esc(s.sub)}</p>`;
  if (s.html) return head + s.html();
  return head + `<div class="slide-grid"><div class="mock-wrap">${s.mock}</div>` +
    `<ol class="notes">${s.notes.map((n, i) => `<li><span class="n">${i + 1}</span><span class="tx"><b>${esc(n[0])}</b><span>${esc(n[1])}</span></span></li>`).join('')}</ol></div>`;
}

function render() {
  const steps = SETS[tab].steps;
  const last = idx === steps.length - 1;
  const nextLabel = last ? (tab === 'use' ? '검사 규칙 보기 →' : '처음으로') : '다음 →';
  host.innerHTML =
    `<div class="us-top"><div class="us-seg" role="tablist">${Object.entries(SETS).map(([k, v]) =>
      `<button role="tab" data-tab="${k}" class="${k === tab ? 'on' : ''}" aria-selected="${k === tab}">${v.label}</button>`).join('')}</div></div>` +
    `<div class="us-body"><ol class="us-steps">${steps.map((s, i) =>
      `<li><button data-step="${i}" class="${i === idx ? 'on' : ''}"${i === idx ? ' aria-current="step"' : ''}><span class="n">${i + 1}</span>${esc(s.short)}</button></li>`).join('')}</ol>` +
    `<div class="us-stage" id="us-stage">${stageHtml(steps[idx])}` +
    `<div class="us-nav"><button data-go="prev"${idx === 0 ? ' disabled' : ''}>← 이전</button><span class="us-count">${idx + 1} / ${steps.length}</span><button data-go="next" class="primary">${nextLabel}</button></div></div></div>`;
}

host.addEventListener('click', (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  if (t.dataset.act) { criteriaAction(t.dataset.act, t); return; }
  const steps = SETS[tab].steps;
  if (t.dataset.tab) { tab = t.dataset.tab; idx = 0; }
  else if (t.dataset.step) { idx = Number(t.dataset.step); }
  else if (t.dataset.go === 'prev') { if (idx > 0) idx--; }
  else if (t.dataset.go === 'next') {
    if (idx < steps.length - 1) idx++;
    else if (tab === 'use') { tab = 'rule'; idx = 0; }
    else { idx = 0; }
  } else return;
  render();
  // 화면이 바뀌면 단계 카드 머리가 보이게 맞춘다(탭 막대에 가리지 않도록 css 의 scroll-margin 사용)
  const st = document.getElementById('us-stage');
  if (st && st.getBoundingClientRect().top < 0) st.scrollIntoView({ block: 'start' });
});

host.addEventListener('change', (e) => {
  if (e.target.id === 'us-all') { criteriaAll = e.target.checked; render(); }
});

render();
})();
