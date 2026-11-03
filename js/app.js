'use strict';
/* 화면 동작. 흐름: 항목·학년·메모 입력 → (방식 A) 앱에서 바로 완성 문단 / (방식 B) 프롬프트 복사 → 점검 → 복사·저장.
 * 재료: rules/2026.json, rules/prompt-base.json, patterns/web-cases.json, vendor/sr-rules.js(SRRules), js/extra-checks.js(SMChecks),
 *       js/prompt.js(SMPrompt), js/storage.js(SMStore), js/ai.js(SMAI), js/xlsx.js(SMXlsx) */
(function () {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const K = SMStore.KEYS;
  const RULES_VERSION = '2026-고'; // student-record 설정 파일의 rulesVersion 과 맞춰 본다
  const AREA_ORDER = ['setuk', 'jayul', 'dongari', 'jinro', 'haengteuk'];
  const AREA_ICON = { setuk: '📖', jayul: '🏫', dongari: '👥', jinro: '🔭', haengteuk: '💬' }; // 이 앱이 고른 아이콘(안드로이드 크롬에서 오래전부터 보이는 이모지만)
  const AREA_SHORT = { setuk: '교과세특', jayul: '자율·자치', dongari: '동아리', jinro: '진로', haengteuk: '행동특성' };
  // 짧은 항목 이름(학년 반영): 3학년은 '자율활동'이라 '자율' — 전에는 저장함·엑셀에 3학년도 '자율·자치'로 나왔음
  const shortName = (area, grade) => (area === 'jayul' && Number(grade) === 3 ? '자율' : AREA_SHORT[area]);

  // 빈 초안. 처음 열 때와 '새로 쓰기'가 같이 쓴다(칸을 더할 때 한 곳만 고치면 되게)
  const blankDraft = (keep) => ({ area: 'setuk', grade: 1, subject: '', club: '', clubHeaderCounts: true, memo: '', target: null, factMode: 'strict', copyFact: 'strict', comps: [], evalItems: [], exampleIds: [], exGroups: null, emph: {}, subjectGroup: '', kyogwa: '', kcomps: {}, tagClass: '', tagNum: '', obsTraits: [], obsChanges: [], participation: '', participationNote: '', stdCodes: [], ...keep });
  const S = {
    rules: null, ref: null, srUser: null, settings: {}, settingsSource: '기본 규칙',
    draft: blankDraft(),
    showAllExamples: false,
    conv: null,      // 방식 A 대화: { prompt, turns:[{role,text}], lastRaw }
    result: null,    // { text, area, source:'A'|'B', fixedFrom, servedBy, input(만든 때 입력), who(만든 때 메모·반·번호) }
    busy: false,
  };

  /* ── 공통 ─────────────────────────────── */
  let toastHideTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastHideTimer); toastHideTimer = setTimeout(() => t.classList.remove('show'), Math.min(7000, Math.max(2200, msg.length * 90))); // 할 일을 알려 주는 긴 알림은 다 읽을 수 있게
  }
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
      ta.remove(); return ok;
    }
  }
  // data: 글자 또는 바이트(Uint8Array — 엑셀 파일)
  function download(name, data, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([data], { type: type || 'text/plain;charset=utf-8' }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  // 날짜·시각 글자: 이 기기 시각(한국) 기준. toISOString 은 세계 표준시라 자정~오전 9시에 하루 전 날짜가 됨
  const p2 = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
  const hm = (d) => `${p2(d.getHours())}:${p2(d.getMinutes())}`;
  const today = () => ymd(new Date());
  /* 더블클릭판 사용 기한 (tools/build-offline.mjs --until 이 window.SM_EXPIRES 를 넣음 — 서버판에는 없음, 사용자 요청 2026-10-21).
   * 기한이 지나면 새 문단을 만드는 길(AI·다듬기·프롬프트 복사·지침·스킬 파일)은 막고, 저장함(복사·엑셀·백업 저장)은 열어 둔다 — 모아 둔 문단을 잃지 않게.
   * 컴퓨터 날짜로 판단하므로 잠금 장치가 아니라 새 판으로 바꾸라는 알림이다 */
  const EXPIRES = typeof window.SM_EXPIRES === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(window.SM_EXPIRES) ? window.SM_EXPIRES : '';
  const expired = () => !!EXPIRES && today() > EXPIRES;
  const EXPIRED_MSG = () => `이 판은 ${EXPIRES}까지 쓰도록 만들었어요. 새 문단 만들기는 막혔고, 📋 저장함의 복사·엑셀·백업 파일 저장은 그대로 돼요. 새 판을 받아 백업 파일을 불러와 주세요.`;
  const blockIfExpired = () => { if (!expired()) return false; toast(EXPIRED_MSG()); return true; };
  // 시각이 비었거나 읽을 수 없으면 빈 글자(백업에서 온 문단 등 — 전에는 저장함에 'NaN/NaN NaN:NaN', 엑셀에 'NaN-NaN-NaN NaN:NaN' 이 보였음)
  const toDate = (iso) => { const d = new Date(iso); return !iso || isNaN(d) ? null : d; };
  const fmtTime = (iso) => { const d = toDate(iso); return d ? `${d.getMonth() + 1}/${d.getDate()} ${hm(d)}` : ''; };   // 저장함
  const fmtStamp = (iso) => { const d = toDate(iso); return d ? `${ymd(d)} ${hm(d)}` : ''; };                           // 엑셀
  // 개인정보 검사 결과의 낱말 목록(겹치면 한 번만) — 메모 알림·전송 전 확인창에 쓴다
  const termsOf = (hits) => [...new Set(hits.map(h => h.term))].join(', ');

  const curriculumFor = (grade) => Number(grade) === 3 ? '2015 개정 교육과정' : '2022 개정 교육과정';
  const areaRule = (key) => S.rules.areas.find(a => a.key === key);
  function areaName(key, grade) {
    if (key === 'jayul') return Number(grade) === 3 ? '자율활동' : '자율·자치활동';
    if (key === 'setuk') return '과목별 세부능력 및 특기사항';
    return areaRule(key).name.replace(' 특기사항', '');
  }
  const dict = () => (S.settings && S.settings.dictionary) || SRRules.DICTIONARY;

  /* 자동 예시의 무작위 씨앗: 항목·과목·교과군이 그대로면 같은 값(프롬프트가 입력할 때마다 흔들리지 않게), 바뀌면 새 값 */
  let seedKey = '', seedVal = '';
  function exampleSeed() {
    const d = S.draft;
    const key = [d.area, d.area === 'setuk' ? d.subject.trim() : '', d.area === 'setuk' ? exGroupsChecked().join(',') : ''].join('|');
    if (key !== seedKey) { seedKey = key; seedVal = Math.random().toString(36).slice(2, 10); }
    return seedVal;
  }
  // B '덧붙인 내용' 목록: 실측(tools/measure-length.mjs --added-list)으로 덧붙임을 충분히 잡는 것을 확인한 뒤에만 켠다(사용자 결정 2026-10-23).
  // 2026-10-23 실측(reports/length-2026-10-23-added.md, 문단 3개): 메모와 대조해 찾은 덧붙임의 약 85~90%가 AI 목록에 있었음 → 켬.
  // 화면에는 목록을 거르지 않고 모두 보여 준다(처음에는 문단과 비교해 걸렀다가 대부분 숨었음 — renderResult)
  const ADDED_LIST = true;
  function collectInput() {
    const d = S.draft;
    return {
      area: d.area, grade: d.grade, curriculum: curriculumFor(d.grade),
      subject: d.area === 'setuk' ? d.subject.trim() : '',
      club: d.area === 'dongari' ? d.club.trim() : '',
      clubHeaderCounts: d.clubHeaderCounts,
      memo: d.memo, targetChars: d.target || undefined, factMode: d.factMode === 'loose' ? 'loose' : 'strict', addedList: ADDED_LIST && d.factMode === 'loose',
      obs: { traits: d.obsTraits, changes: d.obsChanges, participation: d.participation, participationNote: d.participationNote }, // 관찰 내용 고르기(사용자 요청 2026-10-24)
      standards: chosenStandards(), // 교과세특 성취기준(고른 것, 지금 과목에 있는 것만)
      competencies: d.comps, evalItems: d.evalItems, exampleIds: d.exampleIds, exampleGroups: d.area === 'setuk' ? exGroupsChecked() : null, exampleSeed: exampleSeed(),
      refCards: selectedRefCards(d.area),
      kyogwa: d.kyogwa, kyogwaComps: (d.kcomps || {})[kgKey()] || [],
      customEmphasis: customOf('emph'), customKyogwa: customOf('kg'), customComps: customOf('comp'),
      emphasis: (d.emph && d.emph[d.area]) || [], subjectGroup: d.area === 'setuk' ? d.subjectGroup : '',
    };
  }
  /* 올린 자료 카드 중 교사가 체크한 것 (이 항목 또는 공통 카드) */
  function selectedRefCards(area) {
    const on = SMStore.get(K.refOn, {});
    const out = [];
    for (const doc of S.uploads || []) for (const c of doc.cards) {
      if (on[c.id] && (!area || c.area === area || c.area === 'all')) out.push({ ...c, docTitle: doc.doc_title });
    }
    return out;
  }
  const promptOf = (input) => SMPrompt.buildPrompt(input, S.rules, S.ref, dict(), S.comp);
  const currentPrompt = () => promptOf(collectInput());
  // 문단을 만든(붙여 넣은) 때의 학생: 메모·항목·반·번호. 실패 때 앞 문단을 되살려도 되는지 가늠한다
  const whoNow = () => ({ memo: S.draft.memo.trim(), area: S.draft.area, cls: toNo(S.draft.tagClass), num: toNo(S.draft.tagNum) });
  const sameWho = (a, b) => !!a && !!b && a.memo === b.memo && a.area === b.area && a.cls === b.cls && a.num === b.num;
  /* 교사가 직접 추가한 칩. 묶음키: 관점 = 항목:교과구분, 교과 역량 = 연도:교과, 일반 역량 = 항목:교육과정 */
  function customKey(kind) {
    const d = S.draft;
    if (kind === 'kg') return kgKey();
    if (kind === 'comp') return `${d.area}:${curriculumFor(d.grade)}`;
    if (kind === 'trait' || kind === 'change') return `obs:${SMPrompt.OBS_GROUP(d.area)}`; // 관찰 특성·변화는 교과세특 / 창체 / 행특 묶음별
    const e = SMPrompt.emphasisFor(S.rules, { area: d.area, subject: d.subject, subjectGroup: d.area === 'setuk' ? d.subjectGroup : '' });
    return e ? `${d.area}:${e.key}` : '';
  }
  function customOf(kind) {
    const key = customKey(kind);
    const v = key ? ((SMStore.get(K.custom, {})[kind] || {})[key]) : null;
    return Array.isArray(v) ? v.filter(n => typeof n === 'string') : []; // 이름 목록이 아니면(손상된 값) 없는 것으로 — 전에는 만들기 화면이 멈췄음
  }
  const chipHtml = (attr, value, label, pressed, extraClass, title) =>
    `<button type="button" class="chip${extraClass || ''}" aria-pressed="${pressed}" ${attr}="${esc(value)}" title="${esc(title || label)}">${label}</button>`;
  const ADD_HINT = { trait: ['예: 자료 출처를 꼭 확인함', 30], change: ['예: 처음엔 ~, 나중엔 ~', 60] };
  function customChipsHtml(kind, attr, idOf, selected) {
    const [ph, max] = ADD_HINT[kind] || ['예: 비판적 읽기', 30];
    return customOf(kind).map(n => `<span class="chip-wrap">${chipHtml(attr, idOf(n), esc(n), selected.includes(idOf(n)), ' chip-custom', '직접 추가한 칩')}<button type="button" class="chip-x" data-del="${kind}" data-name="${esc(n)}" aria-label="${esc(n)} 지우기">×</button></span>`).join('') +
      `<button type="button" class="chip chip-add" data-add="${kind}">+ 직접 추가</button>
       <span class="add-row" data-add-row="${kind}" hidden><input type="text" maxlength="${max}" placeholder="${ph}" aria-label="추가할 이름"><button type="button" class="btn small" data-add-ok="${kind}">추가</button><button type="button" class="btn text" data-add-cancel="${kind}">취소</button></span>`;
  }
  const RERENDER = { emph: () => renderEmphasis(), kg: () => renderKyogwa(), comp: () => renderComps(), trait: () => { renderObs(); renderMemoNotes(); }, change: () => { renderObs(); renderMemoNotes(); } };
  function addCustom(kind, raw) {
    const name = String(raw || '').replace(/\s+/g, ' ').trim();
    const key = customKey(kind);
    if (!name || !key) return false;
    const maxLen = (ADD_HINT[kind] || [0, 30])[1];
    if (name.length > maxLen) { toast(`${maxLen}자 이내로 적어 주세요.`); return false; }
    const all = SMStore.get(K.custom, {});
    const list = customOf(kind); // 손상된 값이면 빈 목록에서 시작(글자에 이어 붙던 것을 막음)
    // 같은 칸에 같은 이름의 칩이 이미 있으면 막는다 (글자 일부가 겹치는 것은 괜찮음)
    const box = $(`[data-add="${kind}"]`).parentElement;
    const names = [...box.querySelectorAll('.chip:not(.chip-add)')].map(b => b.textContent.replace(/^목표 · /, '').trim());
    if (list.includes(name) || names.includes(name)) { toast('이미 있는 이름이에요.'); return false; }
    // 금지 표현(대학명·브랜드 등)이 섞이면 확인받는다 — 프롬프트에 그대로 들어가기 때문
    const bad = SMChecks.checkDraft(name, S.draft.area, { ...S.settings, checkLength: false, checkEnding: false }).filter(f => f.severity === 'violation');
    if (bad.length && !confirm(`‘${name}’에 기재 금지 표현이 있어요: ${[...new Set(bad.map(f => f.term || f.category))].join(', ')}\n그래도 추가할까요?`)) return false;
    all[kind] = { ...(all[kind] || {}), [key]: list.concat(name) };
    if (!SMStore.set(K.custom, all)) { toast('저장 공간이 모자라 추가하지 못했어요.'); return false; } // 전에는 실패해도 '추가했어요'라고 했음(QA 2026-10-24)
    // 추가한 칩은 바로 고른 상태로
    const d = S.draft, id = kind === 'kg' ? name : 'c:' + name;
    if (kind === 'emph') d.emph = { ...d.emph, [d.area]: ((d.emph || {})[d.area] || []).concat(id) };
    if (kind === 'kg') d.kcomps = { ...d.kcomps, [key]: ((d.kcomps || {})[key] || []).concat(id) };
    if (kind === 'comp') d.comps = d.comps.concat(id);
    if (kind === 'trait') d.obsTraits = d.obsTraits.concat(name);
    if (kind === 'change') d.obsChanges = d.obsChanges.concat(name);
    saveDraft(); RERENDER[kind](); toast(`‘${name}’을(를) 추가했어요.`);
    return true;
  }
  function removeCustom(kind, name) {
    const key = customKey(kind), all = SMStore.get(K.custom, {});
    if (!key || !all[kind] || !all[kind][key]) return;
    all[kind][key] = all[kind][key].filter(n => n !== name);
    SMStore.set(K.custom, all);
    RERENDER[kind](); saveDraft(); toast(`‘${name}’을(를) 지웠어요.`); // saveDraft: 지운 칩이 열린 프롬프트·저장된 초안에 남지 않게
  }
  /* 교과 역량 선택은 '교육과정 연도:교과' 별로 기억한다 */
  function kgKey() { const kg = SMPrompt.kyogwaFor(S.comp, { area: 'setuk', grade: S.draft.grade, subject: S.draft.subject, kyogwa: S.draft.kyogwa }); return kg && kg.kyogwa ? `${kg.year}:${kg.kyogwa}` : ''; }
  const persistDraft = debounce(() => SMStore.set(K.draft, S.draft), 300);
  /* 프롬프트 카드가 열려 있으면, 칩·과목·메모 등을 바꿀 때마다 보이는 프롬프트도 다시 만든다
   * (전에는 '프롬프트 복사해서 쓰기'를 다시 눌러야 바뀌어서, 고른 관점·역량이 안 들어간 것처럼 보였음) */
  const refreshPrompt = debounce(() => {
    if ($('#promptCard').hidden || !S.draft.memo.trim()) return;
    $('#promptOut').value = currentPrompt().combined;
  }, 250);
  const saveDraft = () => { persistDraft(); refreshPrompt(); };

  /* ── ✏️ 만들기: 입력 ─────────────────────── */
  /* 학년에 따라 다른 것(기재요령 77·208쪽, rules/2026.json grades·special_limits): 3학년은 '자율활동'(2015 개정),
   * 2022 개정 1~2학년 공통과목은 1·2 합산 500자. 한도 숫자 자체는 학년마다 같다 (사용자 요청 2026-10-21 — 화면에 표시) */
  const gradeKey = () => (Number(S.draft.grade) === 3 ? '3' : '1-2');
  function commonSubjectRule() {
    const r = areaRule('setuk');
    const sp = ((r && r.special_limits) || []).find(x => (x.grades || []).includes(gradeKey()));
    if (!sp) return null;
    const m = sp.text.match(/\(([^)]+)\)/); // 규칙 글의 괄호 속 과목 목록
    return { rule: sp, names: m ? m[1].split(/\s*,\s*/) : [] };
  }
  function renderSubjectHint() {
    const el = $('#subjectHint'); if (!el) return;
    const c = S.draft.area === 'setuk' ? commonSubjectRule() : null;
    const subj = S.draft.subject.replace(/\s+/g, '');
    const hit = c && c.names.find(n => subj.startsWith(n.replace(/\s+/g, '')));
    el.hidden = !hit;
    if (hit) el.textContent = `📏 ${hit}1·${hit}2는 공통과목이라 둘을 합쳐 한글 500자(1,500바이트) 이내로 써요 (기재요령 ${c.rule.source.page}쪽). 두 학기를 나눠 쓴다면 목표 분량을 줄여 주세요.`;
  }
  function renderAreas() {
    const g3 = gradeKey() === '3';
    const common = commonSubjectRule();
    $('#areaGrid').innerHTML = AREA_ORDER.map(k => {
      const r = areaRule(k);
      const name = shortName(k, g3 ? 3 : 1);
      const note = k === 'jayul' && g3 ? `<small class="area-note">3학년은 '${esc(S.rules.grades['3'].jachi_name)}'</small>`
        : k === 'setuk' && common ? '<small class="area-note">공통과목은 1·2 합산</small>' : '';
      return `<button type="button" class="area-btn" role="radio" aria-checked="${S.draft.area === k}" data-area="${k}">
        <b>${AREA_ICON[k]} ${esc(name)}</b>${note}<small class="area-limit"><span class="nw">${r.limit_bytes.toLocaleString()}바이트</span> <span class="nw muted-in">(한글 ${r.limit_chars}자)</span></small><small>${esc(r.writer)}</small></button>`;
    }).join('');
  }
  // 메모가 짧을 때의 방식(사용자 결정 2026-10-21): 기본은 '사실만'. '약간의 과장 허용'은 고를 때마다 경고를 보이고 결과에도 강한 경고를 붙인다
  function renderFactMode() {
    const loose = S.draft.factMode === 'loose';
    $$('#factModeSeg button').forEach(b => b.setAttribute('aria-checked', String(b.dataset.fact === S.draft.factMode)));
    $('#factModeHint').className = 'hint' + (loose ? ' fact-loose' : '');
    // 고정 문자열이라 innerHTML 로 첫 문장만 굵게(빨간 굵은 글씨 덩어리에 핵심이 묻혔음 — UX 점검 2026-10-22). 늘리기 버튼 설명은 결과 쪽 알림에
    $('#factModeHint').innerHTML = loose
      ? '<b>⚠ 메모에 없는 활동 세부·해석을 AI가 덧붙여 분량을 채워요</b>(수치·수상·도서명·인물은 빼고). 입력 전에 메모와 한 문장씩 대조해 사실이 아닌 부분을 고쳐 주세요. 사실과 다른 기재는 기재요령 위반이에요.'
      : '메모 속 사실만 풀어 써서 분량을 채워요. 메모가 짧으면 목표보다 짧게 나올 수 있어요.';
    // 과장 허용은 다음 학생·다음 날에도 켜져 있으므로 5번 만들기 버튼 위에도 알린다(UX 점검 2026-10-24)
    $('#looseNow').hidden = !loose;
  }
  function renderGrade() {
    $$('#gradeSeg button').forEach(b => b.setAttribute('aria-checked', String(Number(b.dataset.grade) === Number(S.draft.grade))));
    $('#curriculumHint').textContent = `${curriculumFor(S.draft.grade)} 기준으로 작성해요.` +
      (Number(S.draft.grade) === 3 ? ' (3학년은 2027년 3월부터 새 기재요령 적용)' : '');
  }
  function renderFields() {
    $('#subjectField').hidden = S.draft.area !== 'setuk';
    renderSubjectHint();
    $('#clubField').hidden = S.draft.area !== 'dongari';
  }
  function renderTargets() {
    const meta = SMPrompt.buildPrompt({ ...collectInput(), targetChars: undefined }, S.rules, S.ref, dict()).meta;
    const max = meta.target;
    const opts = [];
    for (let n = 150; n < max; n += 50) opts.push(n);
    if (S.draft.target && S.draft.target < max && !opts.includes(S.draft.target)) opts.push(S.draft.target);
    opts.sort((a, b) => a - b);
    if (S.draft.target && S.draft.target >= max) S.draft.target = null;
    $('#target').innerHTML = `<option value="">최대 (${max}자)</option>` +
      opts.reverse().map(n => `<option value="${n}"${S.draft.target === n ? ' selected' : ''}>${n}자</option>`).join('');
  }
  /* 기재요령 관점: 영역마다 다른 칩. 교과세특은 교과 구분(일반·체육예술·전공실무)에 따라 바뀐다 */
  function renderEmphasis() {
    const d = S.draft;
    const isSetuk = d.area === 'setuk';
    $('#subjectGroupRow').hidden = !isSetuk;
    const e = SMPrompt.emphasisFor(S.rules, collectInput());
    if (isSetuk) {
      const auto = SMPrompt.detectSubjectGroup(S.rules, d.subject);
      const cur = d.subjectGroup || auto;
      $$('#subjectGroupSeg button').forEach(b => b.setAttribute('aria-checked', String(b.dataset.sg === cur)));
      $('#sgHint').textContent = d.subjectGroup ? '직접 고른 구분이에요.' :
        (d.subject.trim() ? `과목 이름으로 '${e.label}'(으)로 추정했어요. 다르면 눌러 바꿔 주세요.` : '과목을 적으면 자동으로 골라요.');
    }
    if (!e) { $('#emphChips').innerHTML = ''; $('#emphHint').textContent = ''; return; }
    const customIds = customOf('emph').map(n => 'c:' + n);
    const lenses = SMPrompt.lensItems(S.ref, d.area); // 교과세특 '자주 쓰는 관점'(교사 요청, 기재요령 근거 아님) — 따로 묶어 보여 줌
    const sel = ((d.emph || {})[d.area] || []).filter(id => e.items.some(i => i.id === id) || lenses.some(i => i.id === id) || customIds.includes(id));
    d.emph = { ...(d.emph || {}), [d.area]: sel };
    const chip = (i) => `<button type="button" class="chip" aria-pressed="${sel.includes(i.id)}" data-emph="${esc(i.id)}" title="${esc(i.desc)}">${esc(i.name)}</button>`;
    $('#emphChips').innerHTML = e.items.map(chip).join('') +
      (lenses.length ? `<span class="chips-sub">자주 쓰는 관점 <span class="muted">(교사 선택 · 기재요령 근거 아님 · 고른 것만 반영)</span></span>` + lenses.map(chip).join('') : '') +
      customChipsHtml('emph', 'data-emph', n => 'c:' + n, sel);
    const pages = [...new Set((e.sources || []).map(x => x.page))].sort((x, y) => x - y).join('·');
    $('#emphHint').textContent = (sel.length ? `고른 ${sel.length}개를 중심으로 써요.` : '고르지 않으면 메모에 근거가 있는 관점을 AI가 골라 써요.') + ` 근거: 기재요령 ${pages}쪽`;
  }
  function renderKyogwa() {
    const d = S.draft;
    if (d.area !== 'setuk' || !S.comp) { $('#compField').hidden = false; return; }
    const year = SMPrompt.curriculumYear(d.grade);
    const auto = SMPrompt.detectKyogwa(S.comp, d.subject, year);
    if (d.kyogwa && !S.comp[year][d.kyogwa]) d.kyogwa = '';
    const kg = SMPrompt.kyogwaFor(S.comp, { area: 'setuk', grade: d.grade, subject: d.subject, kyogwa: d.kyogwa });
    $('#kyogwaSel').innerHTML = `<option value="">${auto ? `자동: ${esc(auto)}` : '자동(과목 이름으로 추정)'}</option>` +
      Object.keys(S.comp[year]).map(k => `<option value="${esc(k)}"${d.kyogwa === k ? ' selected' : ''}>${esc(k)}</option>`).join('');
    const e = kg && kg.entry;
    const items = SMPrompt.kyogwaItems(e);
    const key = kgKey();
    const customNames = key ? customOf('kg') : [];
    const sel = (((d.kcomps || {})[key]) || []).filter(n => items.some(i => i.name === n) || customNames.includes(n));
    if (key) d.kcomps = { ...(d.kcomps || {}), [key]: sel };
    $('#kgLabel').innerHTML = e ? `${e.competencies.length ? '교과 역량' : '교육과정이 강조한 능력'} <span class="muted">(${kg.year} 개정 · ${esc(kg.kyogwa)}과)</span>` : '';
    $('#kgChips').innerHTML = items.map(i => `<button type="button" class="chip${i.kind === 'goal' ? ' chip-goal' : ''}" aria-pressed="${sel.includes(i.name)}" data-kg="${esc(i.name)}" title="${esc(i.desc || i.name)}">${i.kind === 'goal' ? '목표 · ' : ''}${esc(i.name)}</button>`).join('') +
      (key ? customChipsHtml('kg', 'data-kg', n => n, sel) : '');
    $('#kgHint').textContent = !d.subject.trim() && !d.kyogwa ? '과목을 적으면 교과를 자동으로 골라 그 교과의 역량을 보여 줘요.'
      : !e ? '교과를 찾지 못했어요. 위에서 교과를 골라 주세요.'
      : (e.competencies.length ? (items.some(i => i.kind === 'goal') ? `'목표 ·' 칩은 ${e.emphasized_label}입니다. ` : '') : `${e.note || ''}. `) + (sel.length ? `고른 ${sel.length}개를 중심으로 써요.` : '고르지 않으면 메모에 근거가 있는 것만 AI가 골라 써요.') + ` 출처: ${e.source.doc}`;
    // 교과 역량이 있으면 4번(분량 & 예시)의 일반 역량 칩은 숨김 (프롬프트도 교과 역량을 씀)
    $('#compField').hidden = items.length > 0;
  }
  function renderComps() {
    const list = S.ref.core_competencies[curriculumFor(S.draft.grade)].items; // 총론 핵심역량 (rules/prompt-base.json)
    const customIds = customOf('comp').map(n => 'c:' + n);
    S.draft.comps = S.draft.comps.filter(id => list.some(c => c.id === id) || customIds.includes(id));
    $('#compChips').innerHTML = list.map(c =>
      `<button type="button" class="chip" aria-pressed="${S.draft.comps.includes(c.id)}" data-comp="${c.id}" title="${esc(c.desc)}">${esc(c.name)}</button>`).join('') +
      customChipsHtml('comp', 'data-comp', n => 'c:' + n, S.draft.comps);
  }
  /* 대학 평가요소 세부 역량 칩(학업·진로·공동체역량별). 성적·이수 과목으로 보는 항목은 보이되 고를 수 없게(문단에 성적을 쓰게 될 수 있어) */
  function renderEvalFactors() {
    const ef = S.ref.eval_factors; if (!ef) { $('#evalField').hidden = true; return; }
    const ok = new Set(SMPrompt.evalFactorItems(S.ref).filter(i => i.record).map(i => i.id));
    S.draft.evalItems = S.draft.evalItems.filter(id => ok.has(id));
    $('#evalChips').innerHTML = ef.groups.map(g => `<div class="eval-group"><span class="eval-group-name" title="${esc(g.def || g.name)}">${esc(g.name)}</span>` +
      g.items.map(i => i.record
        ? `<button type="button" class="chip" aria-pressed="${S.draft.evalItems.includes(i.id)}" data-eval="${esc(i.id)}" title="${esc(i.def || i.name)}">${esc(i.name)}</button>`
        : `<button type="button" class="chip" disabled title="${esc(i.why || '')} — 문단에 쓰지 않아요">${esc(i.name)}</button>`).join('') + '</div>').join('');
  }
  // 2년 기준(web-cases.json meta.cutoff)보다 오래된 자료: 빼지 않고 표시만 한다(사용자 결정, 판단은 교사)
  const isOld = (e) => !!(e.source && S.ref.webMeta && e.source.published < S.ref.webMeta.cutoff);
  /* 교과군 체크박스: 교과세특 예시를 교과군으로 걸러 본다. 여러 개 고를 수 있음(다른 교과군 예시도 참고 가능)
   * exGroups 가 null 이면 '과목에 맞춤' — 과목 이름으로 교과군을 추정해 그것만, 추정 못 하면 전체 */
  function groupChecksHtml(list, checked, attr, autoNote) {
    const counts = {};
    for (const e of list) counts[e.group] = (counts[e.group] || 0) + 1;
    const groups = SMPrompt.EXAMPLE_GROUPS.filter(g => counts[g]);
    return `<span class="label-sm">교과군 ${autoNote ? `<span class="muted">${esc(autoNote)}</span>` : ''}</span>
      <div class="chips">${groups.map(g => `<label class="chip-check"><input type="checkbox" ${attr}="${esc(g)}" ${checked.includes(g) ? 'checked' : ''}><span>${esc(g)} <span class="muted">${counts[g]}</span></span></label>`).join('')}</div>
      <div class="ex-group-actions"><button type="button" class="btn text" ${attr}-all="1">모두 선택</button><button type="button" class="btn text" ${attr}-none="1">모두 해제</button>${autoNote !== undefined ? `<button type="button" class="btn text" ${attr}-auto="1">과목에 맞춤</button>` : ''}</div>`;
  }
  function exGroupsChecked() {
    const d = S.draft;
    if (Array.isArray(d.exGroups)) return d.exGroups;
    const g = SMPrompt.exampleGroupOf(d.subject);
    return g ? [g] : SMPrompt.EXAMPLE_GROUPS.slice();
  }
  function renderExamples() {
    const d = S.draft;
    const areaPool = S.ref.examples.filter(e => e.areas.includes(d.area));
    d.exampleIds = d.exampleIds.filter(id => areaPool.some(e => e.id === id));
    let pool = areaPool;
    const gBox = $('#exGroups');
    if (d.area === 'setuk') {
      const checked = exGroupsChecked();
      const auto = !Array.isArray(d.exGroups);
      const g = SMPrompt.exampleGroupOf(d.subject);
      gBox.innerHTML = groupChecksHtml(areaPool, checked, 'data-exg', auto ? (g ? `(과목 '${d.subject.trim()}' → ${g})` : '(과목을 적으면 맞춰 골라요)') : '(직접 고름)');
      gBox.hidden = false;
      // 이미 고른 예시는 교과군을 해제해도 목록에 남긴다(고른 것을 잃지 않게)
      // 교과군을 알 수 없는 내 예시(과목을 비워 둔 것)는 늘 보이게
      pool = areaPool.filter(e => checked.includes(e.group) || d.exampleIds.includes(e.id) || (e.mine && !e.group));
    } else { gBox.hidden = true; gBox.innerHTML = ''; }
    const subj = d.area === 'setuk' ? d.subject.trim() : '';
    const score = (e) => (d.exampleIds.includes(e.id) ? 10 : 0) + SMPrompt.exampleScore(e, subj, S.ref.webMeta && S.ref.webMeta.cutoff);
    const sorted = pool.slice().sort((a, b) => score(b) - score(a));
    if (!sorted.length) { $('#exampleList').innerHTML = '<p class="hint">고른 교과군에 예시가 없어요. 교과군을 하나 이상 체크해 주세요.</p>'; return; }
    // 처음에는 3개만(4번 카드가 화면 세 장 길이라 줄임, 사용자 요청 2026-10-21) — 나머지는 '예시 N개 모두 보기'
    let shown = S.showAllExamples ? sorted : sorted.slice(0, 3);
    if (!S.showAllExamples && d.area === 'setuk') {
      // 교과군을 4개 이하로 체크했으면 교과군마다 1개씩은 바로 보이게 (다른 교과군을 체크했는데 안 보이면 헷갈리므로). 많이 체크하면 3개만
      const checked = exGroupsChecked();
      if (checked.length <= 4) {
        const extra = new Set(shown.map(e => e.id));
        for (const g of checked) sorted.filter(e => e.group === g).slice(0, 1).forEach(e => extra.add(e.id));
        shown = sorted.filter(e => extra.has(e.id));
      }
    }
    // 예시 id 도 esc — 백업 파일에서 온 내 예시 id 에 따옴표·꺾쇠가 있으면 화면에 코드가 끼어들 수 있음
    $('#exampleList').innerHTML = shown.map(e => `
      <div class="ex-item${d.exampleIds.includes(e.id) ? ' on' : ''}">
        <label class="ex-top"><input type="checkbox" data-ex="${esc(e.id)}" ${d.exampleIds.includes(e.id) ? 'checked' : ''}>
          <span><span class="ex-title">${esc(e.title)}</span>${e.mine ? '<span class="ex-mine">내 예시</span>' : ''}
          ${e.source ? `<br><span class="ex-src">${esc(e.source.name)} · ${esc(e.source.published)}${e.mine ? ' 추가' : ' 발행'}${isOld(e) ? ' <b class="ex-old">2년 지난 자료</b>' : ''}</span>` : ''}
          ${e.engine_flags.length ? `<br><span class="ex-flag">⚠ 금지 표현 포함(${esc(e.engine_flags.map(f => f.split(': ')[1] || f).join(', '))}) — 프롬프트에 넣지 않아요</span>` : ''}</span></label>
        <button type="button" class="ex-more" data-ex-more="${esc(e.id)}">내용 보기</button>${e.mine ? `<button type="button" class="ex-more ex-del" data-my-del="${esc(e.id)}">삭제</button>` : ''}
        <div class="ex-text" data-ex-text="${esc(e.id)}" hidden><p>${esc(e.text)}</p>${e.source && e.source.url ? `<span class="ex-url">출처(${esc(e.source.type)}): ${esc(e.source.url)}</span>` : ''}</div>
      </div>`).join('') +
      (pool.length > shown.length || S.showAllExamples ? `<button type="button" class="btn text" id="btnAllExamples">${S.showAllExamples ? '접기' : `예시 ${pool.length}개 모두 보기`}</button>` : '');
  }
  // 고른 관찰 내용(특성·변화·참여 모습 한 줄)이 있는지 — 분량 판단에 함께 세므로 알림 문구를 '메모·고른 관찰 내용'으로(사용자 결정 2026-10-26)
  const hasObs = () => SMPrompt.factText({ obs: { traits: S.draft.obsTraits, changes: S.draft.obsChanges, participationNote: S.draft.participationNote } }) !== '';
  function renderMemoNotes() {
    const memo = S.draft.memo;
    const out = [];
    const hits = memo.trim() ? SMChecks.checkMemo(memo) : [];
    const qEl = document.querySelector('#memoNotes .memo-questions'); if (qEl) S.memoQOpen = qEl.open; // 메모 질문을 접었는지(알림이 사라지기 전에 기억)
    if (hits.length) {
      out.push(`<div class="note warn">⚠ 개인정보로 보이는 표현: <b>${esc(termsOf(hits))}</b> — AI로 보내기 전에 지워 주세요.</div>`);
    }
    if (memo.trim()) {
      const meta = currentPrompt().meta;
      const sug = meta.targetSuggestion;
      // 문구는 앱의 말투(~요)로 여기서 만든다(prompt.js 의 reason 은 '~습니다'라 화면에서 말투가 섞였음). 버튼도 무엇을 하는지 끝까지
      // 메모 보충 질문(사용자 요청 2026-10-23): 메모가 짧을 때 무엇을 더 적으면 되는지 묻는다(AI 요청 없음).
      // '분량을 채우기 쉬워요'라고 하지 않는다 — 실측에서 사실만은 메모 40→145자에도 문단이 280→311자로 거의 그대로였음(reports/length-2026-10-23-lengths.md).
      // 메모·고른 관찰 내용×3 ≥ 목표 하한이면 사실만에도 문장 설계도가 들어가므로(js/prompt.js factBlueprint) 그 기준 글자 수를 알려 준다(실측 295→424자, 188→256자)
      const qs = SMPrompt.memoQuestions(S.draft.area);
      const qOpen = S.memoQOpen !== false; // 처음엔 펼쳐 두고(사용자 요청 2026-10-24), 알림이 사라졌다 다시 나와도 선생님이 접은·펼친 상태를 유지
      if (sug && !meta.factBlueprint) out.push(`<div class="note info">💡 메모${hasObs() ? '·고른 관찰 내용이' : '가'} 약 ${sug.memoChars}자예요. 목표 ${meta.target}자에 맞춰 쓰면서 메모에 없는 내용이 덧붙거나 과장될 수 있어요. 메모를 더 적으면 더 정확해지고, 짧게 써도 되면 목표를 줄여 주세요.
        <details class="memo-questions"${qOpen ? ' open' : ''}><summary>메모에 무엇을 더 적을까요? (질문 ${qs.length}개)</summary>
        <ul>${qs.map(([k, q]) => `<li><b>${esc(k)}</b> — ${esc(q)}</li>`).join('')}</ul>
        <p class="muted">사실을 더 적을수록 문단이 구체적이고 정확해져요. 메모가 약 ${Math.ceil(meta.lowChars / 3)}자 이상이면(아래에서 고른 관찰 내용도 함께 셈) '사실만'으로도 목표 분량에 맞춰 쓰도록 AI에 요청해요. 점수·등수·수상·대회는 적지 않아요.</p></details>
        <div class="note-actions"><button type="button" data-set-target="${sug.target}">목표를 ${sug.target}자로 줄이기</button></div></div>`);
    }
    $('#memoNotes').innerHTML = out.join('');
    $('#needMemo').textContent = memo.trim() ? '' : '관찰 메모를 먼저 적어 주세요.';
    syncMakeButtons();
  }
  // 메모가 있어야 만들기·프롬프트 버튼이 켜진다. 메모를 칠 때는 알림(느린 쪽)을 기다리지 않고 바로 부른다
  function syncMakeButtons() {
    const has = !!S.draft.memo.trim();
    $('#btnGenerate').disabled = !has || S.busy || expired();
    $('#btnPrompt').disabled = !has || expired();
  }
  function renderKeyRow() {
    const has = !!SMStore.get(K.apiKey, '');
    $('#keyRow').hidden = has || SMAI.isMock();
    $('#keySavedLine').hidden = !has || SMAI.isMock();
  }
  /* 만들기 탭의 키 칸: 저장 버튼·Enter 로 저장 (안내 탭에 가지 않아도 되게) */
  // 키를 복사할 때 딸려 오는 보이지 않는 글자(공백·U+200B 등)는 지운다. 한글 등이 섞이면 요청이 아예 나가지 않아 '인터넷 연결을 확인'으로 잘못 안내됐음
  const cleanKey = (v) => String(v || '').replace(/[\s\u200B-\u200D\u2060\uFEFF]/g, '');
  const badKeyChars = (k) => /[^\x21-\x7E]/.test(k);
  const BAD_KEY_MSG = 'API 키에 영문·숫자가 아닌 글자가 섞여 있어요. AI Studio에서 키를 다시 복사해 붙여 넣어 주세요.';
  function saveInlineKey() {
    const k = cleanKey($('#apiKeyInline').value);
    if (!k) { toast('API 키를 붙여 넣어 주세요.'); $('#apiKeyInline').focus(); return false; }
    if (badKeyChars(k)) { toast(BAD_KEY_MSG); $('#apiKeyInline').focus(); return false; }
    if (!SMStore.set(K.apiKey, k)) { toast('저장하지 못했어요. 브라우저 설정에서 사이트 데이터 저장을 허용해 주세요.'); return false; }
    $('#apiKeyInline').value = '';
    renderKeyRow(); renderGuideSettings();
    toast('API 키를 저장했어요.');
    return true;
  }
  /* 성취기준(교과세특, 사용자 요청 2026-10-24): 1·2학년은 2022 개정, 3학년은 2015 개정. 자료가 커서(각 약 0.7~1MB) 필요할 때 한 번만 읽는다.
   * 원문에 같은 코드가 두 번 나오는 과목이 있어(2015 고급 생명과학 등) 고르는 열쇠는 '코드|순번'. 원문 본문의 깨진 가운뎃점('？')은 보여 줄 때만 '⋅'로 */
  const STD_MAX = 6, STD_SCROLL = 20; // 고를 수 있는 수, 이보다 많으면 목록을 상자 안에서 스크롤
  const STD_FILE = { 2022: 'rules/achievement-standards-2022.json', 2015: 'rules/achievement-standards-2015.json' };
  const STD_NOTE = {
    2022: '출처: 국가교육과정정보센터 원문(2022.12 고시, 2024년 일부 개정 국가교육위원회 고시 제2024-3호 반영).',
    2015: '출처: 국가교육과정정보센터 원문(2015.09 고시 제2015-74호). 그 뒤 일부 개정(2018·2020·2024년 고시)은 아직 대조하지 못했어요.',
  };
  const stdYear = () => (Number(S.draft.grade) === 3 ? 2015 : 2022);
  S.std = {}; const stdLoading = {};
  function ensureStandards(y) {
    if (S.std[y] || stdLoading[y]) return;
    stdLoading[y] = fetch(STD_FILE[y], { cache: 'no-cache' }).then(r => (r.ok ? r.json() : null)).catch(() => null)
      .then(d => { S.std[y] = d && Array.isArray(d.subjects) ? d : { subjects: [], failed: true }; renderObs(); refreshPrompt(); });
  }
  const fixDots = (t) => String(t || '').replace(/？/g, '⋅');
  const stdSubject = () => (S.draft.area === 'setuk' && S.std[stdYear()] ? SMPrompt.findStandardsSubject(S.std[stdYear()], S.draft.subject) : null);
  // 과목의 성취기준을 순서대로 펴고 열쇠(코드|순번)를 단다
  // 열쇠에 교육과정 연도를 넣는다(QA 2026-10-24: 2학년에서 고른 뒤 3학년으로 바꾸면 2015 의 같은 코드·순번 문장이 체크되어 들어갔음)
  const stdList = (sub) => sub.areas.flatMap(a => a.standards).map((x, i) => ({ ...x, key: `${stdYear()}:${x.code}|${i}`, text: fixDots(x.text) }));
  // 고른 성취기준이 있는데 자료를 아직 못 읽었으면 보내기 전에 멈춘다. 읽지 못했으면 성취기준 없이 보낼지 묻는다
  function standardsReady() {
    const d = S.draft, y = stdYear();
    if (d.area !== 'setuk' || !d.stdCodes.length) return true;
    if (!S.std[y]) { ensureStandards(y); toast('성취기준 자료를 불러오는 중이에요. 잠시 뒤 다시 눌러 주세요.'); return false; }
    if (S.std[y].failed) return confirm('성취기준 자료를 불러오지 못했어요. 고른 성취기준 없이 보낼까요?');
    return true;
  }
  function chosenStandards() {
    const sub = stdSubject(); if (!sub) return [];
    const all = stdList(sub);
    // 예전 저장값(코드만)도 받는다
    return S.draft.stdCodes.map(k => all.find(x => x.key === k)).filter(Boolean).slice(0, STD_MAX); // 연도 없는 예전 열쇠는 어느 교육과정 것인지 몰라 버림
  }
  function renderStandards() {
    const d = S.draft, box = $('#stdBox');
    box.hidden = d.area !== 'setuk';
    if (box.hidden) return;
    const body = $('#stdBody'), y = stdYear(), data = S.std[y];
    // 자료(약 1MB)는 상자를 펼쳤고 과목을 적었을 때나 고른 성취기준이 있을 때만 읽는다(UX 점검 2026-10-24: 폰 데이터 — 상자는 처음부터 펼쳐 둠)
    if (!data && !d.stdCodes.length && (!$('#obsBox').open || !d.subject.trim())) { body.innerHTML = $('#obsBox').open ? '<p class="hint">2번에 과목을 적으면 그 과목의 성취기준이 나와요.</p>' : ''; return; }
    if (!data) { ensureStandards(y); body.innerHTML = '<p class="hint">성취기준을 불러오는 중…</p>'; return; }
    if (data.failed) { body.innerHTML = '<p class="hint">성취기준 자료를 불러오지 못했어요. 새로고침해 주세요.</p>'; return; }
    if (!d.subject.trim()) { body.innerHTML = '<p class="hint">2번에 과목을 적으면 그 과목의 성취기준이 나와요.</p>'; return; }
    const sub = stdSubject();
    const gone = !sub && (data.missing || []).find(m => SMPrompt.normSubject(m.subject) === SMPrompt.normSubject(d.subject));
    if (gone) { body.innerHTML = `<p class="hint">‘${esc(gone.subject)}’은(는) 국가교육과정정보센터 원문에서 성취기준을 가져오지 못한 과목이라 고를 수 없어요.</p>`; return; }
    // 비슷한 과목을 버튼으로(사용자 요청 2026-10-24 — 예: '통합사회' → [통합사회1] [통합사회2])
    const near = !sub ? SMPrompt.similarSubjects(data, d.subject, 8) : [];
    if (!sub) { body.innerHTML = `${near.length ? `<p class="hint">혹시 이 과목인가요?</p><div class="chips std-near">${near.map(nm => `<button type="button" class="chip" data-pick-subject="${esc(nm)}">${esc(nm)}</button>`).join('')}</div>` : ''}<p class="hint">‘${esc(d.subject.trim())}’ 과목의 ${y} 개정 성취기준을 찾지 못했어요. 교육과정 표기대로 적어 주세요${y === 2015 ? '(예: 영어 I, 통합사회, 확률과 통계).' : '. 1학년 공통과목은 끝에 1·2를 붙여요(공통국어1, 통합사회2, 한국사1). 2학년은 이름이 바뀐 과목이 있어요(수학 I → 대수, 미적분 → 미적분Ⅰ).'}</p>`; return; }
    const picked = new Set(chosenStandards().map(x => x.key)), all = stdList(sub);
    // 영역은 처음부터 펼쳐 두고(사용자 요청 2026-10-24), 다시 그려도 선생님이 접은 영역은 고른 것이 있어도 접힌 채로(다른 영역에서 고를 때 화면이 튀지 않게, QA 2026-10-26). 열쇠에 과목 이름 — 과목을 바꾸면 다시 모두 펼침
    const wasClosed = new Set([...body.querySelectorAll('details.std-area:not([open])')].map(x => x.dataset.area));
    let i = 0, ai = 0;
    // 20개 넘는 과목은 목록을 상자 안에서 스크롤(사용자 결정 2026-10-24 — 다 펼치면 5번까지 화면 10~20장). 다시 그려도 같은 과목이면 스크롤 위치 유지
    const long = all.length > STD_SCROLL, listKey = `${y}:${sub.subject}`, oldList = body.querySelector('.std-list');
    const keepTop = oldList && oldList.dataset.key === listKey ? oldList.scrollTop : 0;
    body.innerHTML = `<p class="hint">${esc(sub.subject)} · ${esc(sub.type || '')} (${y} 개정) — 이 활동이 어떤 성취기준과 이어지는지 ${STD_MAX}개까지 골라요. AI는 성취기준 문장을 옮기지 않고, 메모 속 활동에서 도달한 모습을 써요.</p>` +
      (long ? `<p class="hint std-scroll-hint">↕ 성취기준이 ${all.length}개라 아래 목록 안에서 위아래로 넘겨 봐요.</p>` : '') +
      `<div class="std-list${long ? ' std-scroll' : ''}" data-key="${esc(listKey)}">` + sub.areas.map(a => {
        const items = a.standards.map(() => all[i++]), k = `${y}:${sub.subject}|${ai++}`, got = items.filter(x => picked.has(x.key)).length;
        return `<details class="std-area" data-area="${esc(k)}"${!wasClosed.has(k) ? ' open' : ''}><summary>${esc([a.group, a.name].filter(Boolean).join(' · ') || '성취기준')} <span class="muted">(${items.length}개${got ? ` 중 ${got}개 고름` : ''})</span></summary>
        ${items.map(x => `<label class="std-item"><input type="checkbox" data-std="${esc(x.key)}"${picked.has(x.key) ? ' checked' : ''}><span><b>${esc(x.code)}</b> ${esc(x.text)}</span></label>`).join('')}</details>`;
      }).join('') + `</div><p class="hint std-src">${esc(STD_NOTE[y])}</p>`;
    if (keepTop) body.querySelector('.std-list').scrollTop = keepTop;
  }

  /* 관찰한 특성·변화·참여도 고르기(만들기 3번 아래, 사용자 요청 2026-10-24) — 고른 것은 메모와 같은 '관찰한 사실'로 프롬프트에 들어감 */
  function renderObs() {
    const d = S.draft, cfg = S.ref.observation || {}, g = (cfg.groups || {})[SMPrompt.OBS_GROUP(d.area)] || { traits: [], changes: [] };
    // 다른 항목 묶음으로 바꾸면 보이지 않는 칩이 몰래 들어가지 않게, 지금 묶음에 있는 것만 남긴다
    const keep = (sel, base, kind) => { const ok = new Set(base.concat(customOf(kind))); return sel.filter(x => ok.has(x)); };
    const t = keep(d.obsTraits, g.traits, 'trait'), c = keep(d.obsChanges, g.changes, 'change');
    if (t.length !== d.obsTraits.length || c.length !== d.obsChanges.length) { d.obsTraits = t; d.obsChanges = c; saveDraft(); }
    $('#traitChips').innerHTML = g.traits.map(n => chipHtml('data-obs-trait', n, esc(n), d.obsTraits.includes(n))).join('') + customChipsHtml('trait', 'data-obs-trait', n => n, d.obsTraits);
    $('#changeLabel').textContent = g.changeLabel || '변화';
    $('#changeChips').innerHTML = g.changes.map(n => chipHtml('data-obs-change', n, esc(n), d.obsChanges.includes(n))).join('') + customChipsHtml('change', 'data-obs-change', n => n, d.obsChanges);
    $('#partLabel').textContent = d.area === 'setuk' ? '학습활동 참여도' : '활동 참여도';
    $('#partSeg').innerHTML = [{ id: '', name: '고르지 않음' }].concat((cfg.participation || {}).levels || [])
      .map(l => `<button type="button" role="radio" aria-checked="${d.participation === l.id}" data-part="${esc(l.id)}">${esc(l.name)}</button>`).join('');
    $('#partHint').hidden = d.participation !== 'passive';
    renderStandards();
    $('#obsTitle').textContent = d.area === 'setuk' ? '성취기준·관찰한 모습 더하기' : '관찰한 특성·변화·참여도 더하기';
    // 접힌 채로도 무엇을 골랐는지 보이게 나눠 적는다(UX 점검 2026-10-24)
    const lv = ((cfg.participation || {}).levels || []).find(x => x.id === d.participation);
    const stdN = S.std[stdYear()] ? chosenStandards().length : (d.area === 'setuk' ? d.stdCodes.filter(k => String(k).startsWith(stdYear() + ':')).length : 0); // 읽는 중에도 지금 학년 열쇠만(QA 2026-10-26)
    const parts = [stdN && `성취기준 ${stdN}`, d.obsTraits.length && `특성 ${d.obsTraits.length}`, d.obsChanges.length && `변화 ${d.obsChanges.length}`,
      (lv || d.participationNote.trim()) && `참여도${lv ? ' ' + lv.name : ''}`].filter(Boolean);
    $('#obsCount').textContent = parts.join(' · ');
  }
  const renderObsDebounced = debounce(() => renderObs(), 300);
  function renderMake() {
    renderAreas(); renderObs(); renderGrade(); renderFactMode(); renderFields(); renderEmphasis(); renderKyogwa(); renderRefCardHint(); renderTargets(); renderComps(); renderEvalFactors(); renderExamples(); renderMemoNotes(); renderKeyRow();
  }

  function restoreInputs() {
    $('#subject').value = S.draft.subject;
    $('#club').value = S.draft.club;
    $('#clubHeaderCounts').checked = S.draft.clubHeaderCounts;
    $('#memo').value = S.draft.memo;
    $('#tagClass').value = S.draft.tagClass || '';
    $('#tagNum').value = S.draft.tagNum || '';
    $('#partNote').value = S.draft.participationNote || '';
  }

  /* ── 결과 그리기·점검 ─────────────────────── */
  function resultMeta() {
    // 한도는 문단을 만든 때의 항목·학년·과목(동아리 머리말) 기준으로 잰다 — 전에는 만든 뒤 항목을 바꾸면 세특 문단을 행특 한도로 쟀음.
    // 목표는 항목이 그대로면 지금 고른 값(목표를 바꾸면 같은 문단을 새 목표로 다시 잼), 항목을 바꿨으면 만든 때 값
    const inp = S.result && S.result.input;
    if (!inp) return currentPrompt().meta;
    return promptOf({ ...inp, targetChars: S.draft.area === inp.area ? (S.draft.target || undefined) : inp.targetChars }).meta;
  }
  // 결과 칸 높이를 문단 길이에 맞춘다(짧은 문단에 빈 칸이 크게 남거나 긴 문단이 칸 안에서 스크롤되던 것 — UX 제안)
  function fitResult() {
    const ta = $('#resultText'); if (!ta || ta.offsetParent === null) return;
    ta.style.height = '0px'; // 'auto' 는 rows=10 높이로 돌아가 짧은 문단에도 줄지 않았음 → 0 에서 재야 글 높이가 나옴
    ta.style.height = Math.max(140, Math.min(ta.scrollHeight + 4, 640)) + 'px';
  }
  function renderResult() {
    // 새 문단을 기다리는 동안 다른 칸을 바꿔도 앞 학생 문단을 결과 칸에 다시 채우지 않는다(에이전트 검증 2026-10-24)
    if (S.waitingNew) return;
    const r = S.result;
    // 저장 전 문단도 기기에 남긴다 — 새로고침하거나 안드로이드 크롬이 탭을 다시 불러오면 사라져 무료 사용량 1회가 그냥 없어졌음(QA 2026-10-21)
    if (r) SMStore.set(K.result, { text: r.text, area: r.area, source: r.source, fixedFrom: r.fixedFrom || null, grownFrom: r.grownFrom || null, grownAdded: r.grownAdded || null, addedList: r.addedList || null, servedBy: r.servedBy || '', input: r.input, who: r.who, pasted: r.pasted || '' });
    else SMStore.remove(K.result);
    if (!r) { $('#resultCard').hidden = true; return; }
    $('#resultCard').hidden = false;
    const ta = $('#resultText');
    if (ta.value !== r.text) {
      ta.value = r.text;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    }
    fitResult();
    const text = r.text;
    const meta = resultMeta();
    const bytes = SMChecks.countNeisBytes(text);
    const max = meta.target * 3, min = meta.lowChars * 3;
    // 나이스 한도(meta.limit)와 교사가 고른 목표(meta.target)를 나눈다
    const limitBytes = (meta.limit || meta.target) * 3;
    const lowered = meta.target < (meta.limit || meta.target);
    const tag = $('#countTag');
    // 나이스는 바이트로 센다 — 바이트를 앞에, 한글 글자 수는 참고로 (기재요령 208쪽)
    // 분모는 늘 나이스 한도. 전에는 목표를 낮추면 분모가 목표 바이트가 되어 "1,564 / 450바이트" 아래에 "한도(1500바이트)를 넘었어요"가 떠 숫자가 서로 안 맞았음
    tag.textContent = `${bytes.toLocaleString()} / ${limitBytes.toLocaleString()}바이트 · 한글 약 ${Math.round(bytes / 3).toLocaleString()}자`;
    tag.className = 'count' + (bytes > limitBytes ? ' over' : lowered && bytes > max ? ' warn' : bytes < min ? ' short' : '');
    tag.title = '나이스 한도 기준';
    // 목표를 낮췄거나(동아리) 머리말만큼 한도가 줄었을 때만 따로 한 줄
    const fullChars = (areaRule(meta.area) || {}).limit_chars; // meta 와 같은 항목 기준(한도 계산과 맞춤)
    const lines = [];
    if (r.input && r.input.area !== S.draft.area) lines.push(`${shortName(r.input.area, r.input.grade)} 문단 기준(만든 때 항목)`); // 만든 뒤 항목을 바꾸면 어느 기준인지 안 보였음
    if (lowered) lines.push(`고른 목표: 한글 약 ${meta.target}자(${max.toLocaleString()}바이트)`);
    if (fullChars && meta.limit < fullChars) lines.push(`나이스 한도 ${fullChars}자에서 "(동아리명)(시간)" 머리말 약 ${fullChars - meta.limit}자를 뺐어요${(r.input && r.input.club) ? '' : '(동아리명을 적으면 정확히 계산해요)'}`);
    $('#targetLine').hidden = !lines.length;
    $('#targetLine').textContent = lines.join(' · ');

    // 알림은 중요한 것부터 쌓는다(UX 점검 2026-10-24: 과장 허용 빨간 경고가 세 번째라 폰에서 [복사]가 화면 두 장 아래로 밀렸음).
    // 순서: 나이스 한도 넘침 → 과장 허용 → 늘린 문장 → AI가 밝힌 덧붙임 → 메모 대비 김·짧음 → 줄여 다시 씀·목표 넘음 → 시험 모드. 경고는 하나도 빼지 않는다
    const N = { limit: [], loose: [], grown: [], added: [], length: [], info: [], mock: [] };
    if (r.servedBy === 'mock') N.mock.push('<div class="note warn">시험 모드에서 만든 가짜 문단이에요.</div>');
    // 늘리기로 더한 문장(사용자 결정 2026-10-23 'A'): 앱이 끼워 넣은 문장을 정확히 알므로 그대로 보여 준다. 교사가 지우거나 고친 문장은 빠진다
    const squash = (t) => String(t || '').replace(/\s+/g, '');
    const grownLeft = (r.grownAdded || []).filter(x => squash(text).includes(squash(x)));
    if (grownLeft.length) N.grown.push(`<div class="note warn">늘리기로 더한 문장 ${grownLeft.length}개예요. 메모에 없는 내용이니 먼저 대조해 주세요.<ol class="added-list">${grownLeft.map(x => `<li>${esc(x)}</li>`).join('')}</ol></div>`);
    else if (r.grownFrom && Math.round(bytes / 3) > r.grownFrom) N.grown.push(`<div class="note info">약 ${r.grownFrom}자였던 문단에 문장을 더해 늘렸어요(과장 허용 — 더한 문장도 메모와 대조해 주세요).</div>`);
    if (r.fixedFrom) N.info.push(`<div class="note info">${r.grownFrom ? '늘린' : '처음'} 문단이 약 ${r.fixedFrom}자로 ${r.fixedFrom * 3 > limitBytes ? '나이스 한도' : `고른 목표(${meta.target}자)`}를 넘어 한 번 줄여 다시 썼어요.</div>`);
    // 전에는 목표를 낮춰 두면 한도 안의 문단에도 "나이스에 입력되지 않아요"라고 잘못 알렸음 — 한도 넘침과 목표 넘침을 나눠 알린다
    // "더 다듬기" 칸은 앱에서 바로 만든 문단에만 보이므로, 붙여 넣은 문단(방식 B)에는 직접 줄이라고만 안내
    const shorten = r.source === 'A' && S.conv ? '아래 "더 다듬기"에 "더 짧게"라고 요청하거나 직접 줄여 주세요.' : '문단을 직접 줄이거나 채팅에 "더 짧게"라고 다시 요청해 주세요.';
    if (bytes > limitBytes) N.limit.push(`<div class="note err">나이스 한도(${limitBytes.toLocaleString()}바이트)를 ${(bytes - limitBytes).toLocaleString()}바이트 넘었어요. 이대로는 나이스에 입력되지 않아요. ${shorten}</div>`);
    else if (bytes > max) N.info.push(`<div class="note info">고른 목표(한글 약 ${meta.target}자 · ${max.toLocaleString()}바이트)보다 ${(bytes - max).toLocaleString()}바이트 길어요. 나이스 한도(${limitBytes.toLocaleString()}바이트) 안이라 입력은 돼요.</div>`);
    // 메모 + 고른 관찰 내용 기준(사용자 결정 2026-10-26 — 관찰 내용도 분량을 채우는 사실)
    const factSrc = r.input ? SMPrompt.factText(r.input) : S.draft.memo, factName = r.input && SMPrompt.factText(r.input) !== String(r.input.memo || '').trim() ? '메모·관찰 내용' : '메모';
    const short = SMPrompt.shortNotice(bytes, meta, factSrc); // 만든 때 메모·관찰 내용 기준(다음 학생 메모로 바꾼 뒤 잘못 경고하던 것)
    // 메모가 짧아도 목표 분량에 맞춰 쓰게 했으므로(사용자 결정 2026-10-21), 메모·관찰 내용에 비해 문단이 길면 늘 경고한다.
    // 기준은 suggestTarget 과 같은 '메모 + 관찰 내용(공백 제외) × 3' — 첫 실행에서 이보다 길면 덧붙임이 나왔음(js/prompt.js)
    const memoChars = String(factSrc || '').replace(/\s+/g, '').length;
    const loose = !!(r.input && r.input.factMode === 'loose');
    const padded = !loose && memoChars && Math.round(bytes / 3) > memoChars * 3;
    // 지침·스킬로 채팅에서 받은 문단은 앱에 메모가 없을 수 있다 — 길이로 판단할 수 없으니 대조하지 못했다고 알린다
    if (!memoChars && !loose) N.length.push('<div class="note warn">이 앱에 메모가 없어 글자 수·금지 표현만 점검했어요. 문장이 실제 관찰과 맞는지는 메모와 직접 대조해 주세요.</div>');
    if (loose) {
      N.loose.push('<div class="note err">⚠ \'약간의 과장 허용\'으로 만든 문단이에요. 메모에 없는 활동 세부·해석이 들어 있어요. 문장마다 메모와 대조해 사실이 아닌 부분은 지우거나 고친 뒤 입력해 주세요(기재요령: 관찰한 사실만 기재).</div>');
      // AI가 밝힌 덧붙인 내용(사용자 결정 2026-10-23 'B', ADDED_LIST 가 켜졌을 때만 요청). AI 스스로 밝힌 것이라 빠질 수 있다고 함께 알린다
      if ((r.input.addedList && r.source === 'A') || (r.source === 'B' && Array.isArray(r.addedList))) {
        // 목록은 문단과 비교해 거르지 않고 모두 보여 준다(에이전트 검증 2026-10-23: AI가 목록을 줄여 써서 '앞 8글자가 문단에 있음'으로 거르면 22개 중 6개만 보였음)
        const list = r.addedList;
        if (list === null || list === undefined) N.added.push('<div class="note warn">AI가 덧붙인 내용 목록을 보내지 않았어요. 모든 문장을 메모와 대조해 주세요.</div>');
        else if (!list.length) N.added.push('<div class="note warn">AI는 메모에 없이 덧붙인 것이 없다고 했어요. 그래도 과장 허용 문단이니 모든 문장을 메모와 대조해 주세요.</div>');
        else N.added.push(`<div class="note warn">AI가 메모에 없이 덧붙였다고 밝힌 내용 ${list.length}개예요. 문단을 고쳤다면 이미 지운 것도 있을 수 있고, 여기에 없는 덧붙임도 있을 수 있어요.<ol class="added-list">${list.map(x => `<li>${esc(x)}</li>`).join('')}</ol></div>`);
      }
    } else if (padded && !short) {
      N.length.push(`<div class="note warn">⚠ ${factName}(약 ${memoChars}자)에 비해 문단(한글 약 ${Math.round(bytes / 3)}자)이 길어요. 목표 분량을 맞추면서 메모에 없는 내용이 덧붙거나 과장된 표현이 들어갔을 수 있어요. 문장마다 메모·고른 관찰 내용과 대조해 사실이 아닌 부분은 지우거나 고쳐 주세요.</div>`);
    }
    if (short) {
      // 문구는 앱 말투(~요)로 여기서 만든다(prompt.js 의 message 는 '~습니다')
      // 목표를 150자 아래로 낮추라고는 권하지 않는다 — 전에는 짧은 결과에 "목표를 30자로 낮추기" 같은 버튼이 나왔음 (QA·UX 제안, 2026-10-21)
      const canLower = short.lowerTo >= 150 && short.lowerTo < meta.target;
      const growA = loose && r.source === 'A' && S.conv, growB = loose && r.source === 'B';
      // 과장 허용이면 늘리기 버튼이 하는 일을 알림에서 설명(전에는 '메모를 더 적으라'는 글과 버튼이 어긋났음 — UX 점검 2026-10-22)
      // 사실만에서 '메모 대비 김'과 '목표보다 짧음'이 함께면 한 알림으로 합친다(UX 점검 2026-10-24: 둘이 함께 떠 헷갈렸음 — 덧붙임 경고는 빼지 않고 합침)
      const shortMsg = padded
        ? `⚠ 문단(한글 약 ${short.chars}자)은 목표 ${short.target}자보다 짧지만, ${factName}(약 ${memoChars}자)에 비해서는 이미 길어 메모에 없는 내용이 들어갔을 수 있어요. 문장마다 메모와 대조한 뒤, 메모를 보충해 다시 만들거나 목표를 낮춰 주세요.`
        : `문단이 목표보다 짧아요 (한글 약 ${short.chars}자 / 목표 ${short.target}자). ` +
        (!loose ? '메모에 활동 내용(무엇을, 어떻게, 결과는)을 더 적고 다시 만들어 주세요.'
          : growA ? '[목표 분량까지 늘리기]는 메모와 어울리는 내용을 덧붙여 한 번 더 써요(무료 사용량 1회, 한도를 넘으면 줄이느라 1회 더). 사실대로 늘리려면 메모를 보충해 다시 만들어 주세요.'
          : growB ? "[늘리기 요청 복사]를 눌러 같은 채팅에 붙여 넣고, 받은 문단을 위 '받은 문단 붙여 넣기' 칸에 다시 넣어 주세요."
          : '메모를 보충해 다시 만들어 주세요.') +
        (canLower ? ` 목표를 ${short.lowerTo}자로 낮추면 지금 문단을 그대로 쓸 수 있어요.` : '');
      N.length.push(`<div class="note warn">${esc(shortMsg)}
        <div class="note-actions">${growA ? `<button type="button" data-grow${S.busy ? ' disabled' : ''}>목표 분량까지 늘리기 (무료 1회 사용)</button>` : growB ? '<button type="button" data-grow-copy>늘리기 요청 복사 (채팅용)</button>' : ''}
        ${canLower ? `<button type="button" data-set-target="${short.lowerTo}">목표를 ${short.lowerTo}자로 낮추기</button>` : ''}
        <button type="button" data-goto-memo>메모 보충하기</button></div></div>`);
    }
    // 답에 문단이 여럿(버전 1·2 등)이면 첫 문단만 넣었다고 알린다(QA 2026-10-24: 전에는 이어 붙였음)
    const rawNow = r.source === 'B' ? r.pasted : (S.conv && S.conv.lastRaw);
    if (rawNow && SMPrompt.extractParagraphInfo(rawNow).extra) N.info.push('<div class="note warn">AI 답에 문단이 여러 개 있어 첫 문단만 넣었어요. 다른 문단을 쓰려면 채팅에서 그 문단만 복사해 붙여 넣어 주세요.</div>');
    const notes = [].concat(N.limit, N.loose, N.grown, N.added, N.length, N.info, N.mock);
    $('#resultNotes').innerHTML = notes.join('');

    const findings = text.trim() ? SMChecks.checkDraft(text, r.area, S.settings) : [];
    const shown = findings.filter(f => f.severity !== 'info' && f.ruleId !== 'len-over'); // 분량은 위 안내로 대신
    const infos = findings.filter(f => f.severity === 'info');
    const praise = SMPrompt.countPraise(text);
    let html = '';
    // severity 는 가져온 student-record 설정 파일·백업의 사전 값이 그대로 오므로 class 에 넣을 때도 esc (파일에 코드를 넣으면 화면에서 실행되던 것)
    if (shown.length) {
      // 같은 표현이 여러 번 걸리면 한 건으로 묶고 "N곳"으로 알린다 — 전에는 같은 안내가 여러 번 되풀이돼 목록이 길어졌음
      const groups = new Map();
      for (const f of shown) {
        const k = [f.severity, f.category, f.term || f.message].join('\u0001');
        if (groups.has(k)) groups.get(k).n++; else groups.set(k, { f, n: 1 });
      }
      html += `<p class="findings-title">점검 결과 ${groups.size}건 <span class="muted">(알림일 뿐, 복사는 막지 않아요)</span></p>` + [...groups.values()].map(({ f, n }) => `
        <div class="finding ${esc(f.severity)}"><b>${f.severity === 'violation' ? '위반' : '주의'} · ${esc(f.category)}</b> ${esc(f.message || '')}${n > 1 ? ` <span class="muted">(${n}곳)</span>` : ''}
          ${f.alt ? `<span class="f-alt">바꿔 쓰기: ${esc(f.alt)}</span>` : ''}${f.basis ? `<details class="f-basis"><summary>근거 보기</summary>${esc(f.basis)}</details>` : ''}</div>`).join(''); // 근거는 접음(UX 점검 2026-10-24: 폰에서 한 건이 6줄)
    } else if (text.trim()) {
      html += '<p class="ok-line">✓ 기재 금지 표현·학생 시점 표현이 보이지 않아요.</p>';
    }
    if (infos.length) html += `<details class="inline-details"><summary>표기 점검 ${infos.length}건</summary>${infos.map(f => `<div class="finding">${esc(f.message || f.category)}</div>`).join('')}</details>`;
    // 평가어는 한 번만 써도 알린다(사용자 요청 2026-10-23) — 전에는 반복될 때만 알려 '우수한 학생임'이 그냥 지나갔음. 알림일 뿐 고칠지는 교사가
    if (praise.total) html += `<div class="note info">평가어 ${praise.total}곳: ${esc(praise.words.join(', '))}${praise.repeated.length ? ` (반복: ${esc(praise.repeated.join(', '))})` : ''} — 무엇을 어떻게 했는지 관찰한 행동으로 바꾸면 더 구체적이에요.</div>`;
    $('#findings').innerHTML = html;
    $('#refineBox').hidden = !(S.conv && r.source === 'A');
    $('#btnRegenerate').hidden = r.source !== 'A';
  }
  function setStatus(msg, kind) {
    const el = $('#genStatus');
    if (!msg) { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;
    el.className = 'status' + (kind === 'err' ? ' err' : '');
    el.innerHTML = (kind === 'busy' ? '<span class="spin"></span>' : '') + esc(msg);
  }
  function setBusy(b) {
    S.busy = b;
    ['#btnGenerate', '#btnRegenerate', '#btnRefine'].forEach(s => { $(s).disabled = b; });
    $$('#resultNotes [data-grow]').forEach(x => { x.disabled = b; }); // 늘리는 중 다시 누르면 아무 반응이 없었음
    // AI를 기다리는 동안 결과 칸을 잠근다 — 늘리기·다듬기 답이 오면 기다리는 사이 고친 글이 사라졌음(QA 2026-10-23)
    $('#resultText').readOnly = b;
    if (!b) renderMemoNotes();
  }

  /* ── 방식 A: 앱에서 바로 ─────────────────────── */
  // 요청 차례 번호: '새로 쓰기'·'점검하기'를 누르면 올려서, 그 전에 보낸 요청의 늦은 응답이 화면·S.result 를 덮지 않게 한다
  // (전에는 기다리는 동안 새로 쓰기를 누르면 앞 학생 문단이 새 입력 화면에 다시 나타나 다른 반·번호로 저장될 수 있었음)
  let runSeq = 0, runCtrl = null;
  // 새 요청 차례를 연다. 앞 요청은 멈춘다(버린 요청이 무료 한도를 계속 쓰고, 끝날 때까지 '앱에서 바로 만들기'가 꺼져 있던 것)
  function startRun() {
    if (runCtrl) runCtrl.abort();
    runCtrl = new AbortController();
    return { seq: ++runSeq, signal: runCtrl.signal };
  }
  // 기다리는 요청을 버린다('새로 쓰기'·'점검하기'·'모두 지우기')
  function cancelRun() {
    runSeq++;
    S.waitingNew = false;
    if (runCtrl) { runCtrl.abort(); runCtrl = null; }
    if (S.busy) setBusy(false);
  }
  function apiOpts(onWait, signal) {
    return { key: SMStore.get(K.apiKey, ''), model: SMStore.get(K.model, ''), onWait, signal };
  }
  // run: startRun() 결과. 버린 요청은 진행 문구를 바꾸지 않는다(붙여 넣은 문단 위에 '줄여 다시 쓰는 중…'이 남던 것)
  async function runWithLengthFix(prompt, turns, run) {
    const status = (msg) => { if (run.seq === runSeq) setStatus(msg, 'busy'); };
    const waitMsg = (s) => status(`AI가 바빠요. ${s}초 뒤 다시 시도해요…`);
    let out = await SMAI.generate(prompt, turns, apiOpts(waitMsg, run.signal));
    const firstRaw = out.text; // 줄여 다시 쓴 답에는 '덧붙인 내용' 목록이 없을 수 있어 처음 답도 넘긴다
    let text = SMPrompt.extractParagraph(out.text);
    let fixedFrom = null;
    // 짧을 때 자동으로 늘리지 않는다 — 무료 사용량이 저절로 1회 더 쓰였음(사용자 요청 2026-10-21). 과장 허용이면 결과의 '목표 분량까지 늘리기' 버튼으로(growResult)
    const fix = SMPrompt.buildLengthFix(SMChecks.countNeisBytes(text), prompt.meta);
    if (fix) {
      // 한도를 넘었을 때만 한 번 더 고쳐 쓰게 한다 (짧을 때는 안내만 — 사용자 결정)
      fixedFrom = Math.round(SMChecks.countNeisBytes(text) / 3);
      status('한도를 넘어서 한 번 줄여 다시 쓰는 중…');
      const turns2 = turns.concat([{ role: 'assistant', text: out.text }, { role: 'user', text: fix }]);
      out = await SMAI.generate(prompt, turns2, apiOpts(waitMsg, run.signal));
      text = SMPrompt.extractParagraph(out.text);
      turns = turns2;
    }
    return { text, raw: out.text, firstRaw, servedBy: out.servedBy, turns, fixedFrom };
  }

  // again: '다시 만들기' 버튼으로 불렀을 때
  async function generate(again) {
    if (S.busy || blockIfExpired()) return;
    const memo = S.draft.memo.trim();
    if (!memo) { toast('관찰 메모를 먼저 적어 주세요.'); return; }
    const inlineKey = cleanKey($('#apiKeyInline').value);
    if (inlineKey && badKeyChars(inlineKey)) { toast(BAD_KEY_MSG); $('#apiKeyInline').focus(); return; }
    if (inlineKey) { SMStore.set(K.apiKey, inlineKey); $('#apiKeyInline').value = ''; renderKeyRow(); }
    if (!SMStore.get(K.apiKey, '') && !SMAI.isMock()) {
      renderKeyRow(); toast('API 키를 넣어 주세요.'); $('#apiKeyInline').focus(); return;
    }
    if (!standardsReady()) return;
    const input = collectInput(), who = whoNow();
    const hits = SMChecks.checkMemo(memo + '\n' + ownText(input));
    if (hits.length && !confirm(`메모·과목·칩에 개인정보로 보이는 표현이 있어요: ${termsOf(hits)}\n그래도 AI로 보낼까요?`)) return;

    const prompt = promptOf(input);
    const area = S.draft.area; // 기다리는 동안 항목을 바꿔도 이 문단은 보낸 때의 항목으로 점검한다
    $('#promptCard').hidden = true;
    $('#resultCard').hidden = false;
    $('#resultText').value = '';
    $('#resultNotes').innerHTML = ''; $('#findings').innerHTML = ''; $('#countTag').textContent = '';
    S.waitingNew = true;
    setStatus('AI가 문단을 쓰는 중… (10~30초)', 'busy');
    setBusy(true);
    $('#resultCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
    const run = startRun(), seq = run.seq;
    try {
      const r = await runWithLengthFix(prompt, [], run);
      if (seq !== runSeq) return; // 기다리는 동안 새로 쓰기·점검하기를 눌렀으면 이 응답은 버린다
      S.waitingNew = false;
      S.conv = { prompt, turns: r.turns, lastRaw: r.raw };
      const added = input.addedList ? (SMPrompt.extractAddedList(r.raw) || SMPrompt.extractAddedList(r.firstRaw)) : null;
      S.result = { text: r.text, area, source: 'A', fixedFrom: r.fixedFrom, servedBy: r.servedBy, input, who, addedList: added };
      setStatus('');
      renderResult();
    } catch (e) {
      if (seq !== runSeq) return;
      S.waitingNew = false;
      setStatus(e.message || String(e), 'err');
      // '다시 만들기'가 실패하면(무료 한도 등) 앞서 받은 문단을 다시 보여 준다 — 전에는 빈 칸으로 남아 저장 전 문단이 사라졌음.
      // 다만 메모·항목을 바꾼 뒤(다른 학생) 실패하면 앞 학생 문단을 되살리지 않는다 — 새 반·번호로 저장될 수 있었음.
      // 전에는 '다시 만들기'면 메모가 바뀌어도 되살렸음. 반·번호 차이는 '다시 만들기'일 때만 허용(만든 뒤 번호를 적고 다시 만드는 흐름)
      const w = S.result && S.result.who;
      if (w && w.memo === who.memo && w.area === who.area && (again === true || sameWho(w, who))) { renderResult(); return; }
      S.result = null; S.conv = null; SMStore.remove(K.result);
      $('#resultText').value = ''; $('#refineBox').hidden = true; $('#btnRegenerate').hidden = true;
    } finally { if (seq === runSeq) setBusy(false); } // 버린 요청은 cancelRun 이 이미 풀었다(새 요청이 진행 중일 수 있음)
  }

  // 과장 허용 문단이 목표보다 짧을 때 '목표 분량까지 늘리기' 요청 글(지금 문단 길이·만든 때 목표 기준).
  // addOnly: 앱 버튼(방식 A)은 '더할 새 문장만' 받는다. 채팅에 복사하는 글(방식 B)은 문단 전체를 받는다(붙여 넣기 점검 흐름 그대로)
  function growMessage(addOnly) {
    if (!S.result) return '';
    const text = $('#resultText').value.trim();
    const meta = { ...resultMeta(), factMode: 'loose' };
    return SMPrompt.buildLengthGrow(SMChecks.countNeisBytes(text), meta, { addOnly }) || '';
  }
  // 교사가 버튼을 누를 때만 1회 호출(자동으로 늘리면 무료 사용량이 저절로 더 쓰였음 — 사용자 요청 2026-10-21)
  // 다듬기·늘리기 때 한도 넘침을 잴 기준: 만든 때 프롬프트에 지금 고른 목표를 얹음(resultMeta 와 같은 기준 — 요청 글과 판단 기준을 맞춤)
  const convPromptNow = () => { const m = resultMeta(); return { ...S.conv.prompt, meta: { ...S.conv.prompt.meta, target: m.target, lowChars: m.lowChars } }; };
  // 늘리기(사용자 결정 2026-10-23 'A+B'): 실측에서 문단 전체를 다시 쓰게 하면 3번 중 2번은 오히려 짧아졌음(421→371자, reports/length-2026-10-23.md).
  // A: 더할 새 문장만 받아 지금 문단의 마지막 문장 앞에 끼워 넣는다(SMPrompt.insertGrown — 지금 문장·교사가 고친 문장은 그대로).
  //    합친 문단이 한도를 넘으면 앱의 다른 흐름처럼 한 번 줄여 다시 쓰게 한다.
  // B: 그래도 결과가 지금보다 길지 않으면 지금 문단을 그대로 두고 알린다(무료 1회를 쓰고 문단이 줄어드는 일이 없게)
  // 결과 칸 글도 AI로 다시 가므로(늘리기·다듬기) 교사가 고쳐 넣은 이름·연락처를 확인한다(에이전트 검증 2026-10-24)
  function okToSendText(t) {
    const hits = SMChecks.checkMemo(t);
    return !hits.length || confirm(`문단에 개인정보로 보이는 표현이 있어요: ${termsOf(hits)}\n그래도 AI로 보낼까요?`);
  }
  async function growResult() {
    const msg = growMessage(true);
    if (!msg || !S.conv || S.busy || blockIfExpired()) return;
    const current = $('#resultText').value.trim();
    if (!okToSendText(current)) return;
    const from = Math.round(SMChecks.countNeisBytes(current) / 3);
    let turns = S.conv.turns.concat([{ role: 'assistant', text: current || S.conv.lastRaw }, { role: 'user', text: msg }]);
    setStatus('목표 분량까지 늘릴 문장을 받는 중…', 'busy');
    setBusy(true);
    const run = startRun(), seq = run.seq;
    const waitMsg = (sec) => { if (run.seq === runSeq) setStatus(`AI가 바빠요. ${sec}초 뒤 다시 시도해요…`, 'busy'); };
    try {
      let out = await SMAI.generate(convPromptNow(), turns, apiOpts(waitMsg, run.signal));
      if (seq !== runSeq) return;
      // 결과 칸은 기다리는 동안 잠기지만(setBusy), 혹시 바뀌었으면 답이 온 때의 글에 끼워 넣는다
      const base = $('#resultText').value.trim() || current, baseBytes = SMChecks.countNeisBytes(base);
      const got = SMPrompt.extractParagraph(out.text);
      // 더할 문장만 달라고 했는데 문단 전체를 다시 보냈으면(받은 문장 절반 넘게가 지금 문단과 같은 문장) 끼워 넣지 않는다 — 같은 내용이 두 번 들어가는 것을 막음.
      // 문장 수로 판단하면 많이 짧은 문단에서 요청대로 4~7개를 보낸 답까지 버렸음(에이전트 검증 2026-10-24)
      const gotN = SMPrompt.splitSentences(got).length, freshN = SMPrompt.addedSentences(base, got).length;
      if (gotN >= 3 && freshN < gotN * 0.5) {
        setStatus('');
        toast('AI가 더할 문장 대신 문단 전체를 다시 보내서 지금 문단을 그대로 두었어요. 직접 덧붙이거나 메모를 보충해 주세요.');
        return;
      }
      const grownAdded = (S.result.grownAdded || []).concat(SMPrompt.addedSentences(base, got)); // 두 번 늘려도 앞서 더한 문장이 목록에 남게
      let text = SMPrompt.insertGrown(base, got);
      turns = turns.concat([{ role: 'assistant', text }]); // 다음 다듬기는 합친 문단을 기준으로
      let fixedFrom = null;
      const fix = SMPrompt.buildLengthFix(SMChecks.countNeisBytes(text), convPromptNow().meta);
      if (fix) {
        fixedFrom = Math.round(SMChecks.countNeisBytes(text) / 3);
        setStatus('한도를 넘어서 한 번 줄여 다시 쓰는 중…', 'busy');
        turns = turns.concat([{ role: 'user', text: fix }]);
        out = await SMAI.generate(convPromptNow(), turns, apiOpts(waitMsg, run.signal));
        if (seq !== runSeq) return;
        text = SMPrompt.extractParagraph(out.text);
        turns = turns.concat([{ role: 'assistant', text: out.text }]);
      }
      if (SMChecks.countNeisBytes(text) <= baseBytes) {
        setStatus('');
        toast(fixedFrom ? '늘린 문단이 한도를 넘어 줄였더니 지금보다 짧아져서 지금 문단을 그대로 두었어요.' : 'AI가 늘릴 문장을 주지 않아 지금 문단을 그대로 두었어요. 메모를 더 적거나 직접 덧붙여 주세요.');
        return;
      }
      S.conv = { prompt: S.conv.prompt, turns, lastRaw: text };
      S.result = { ...S.result, text, fixedFrom, grownFrom: from, grownAdded, servedBy: out.servedBy };
      setStatus('');
      renderResult();
    } catch (e) { if (seq === runSeq) setStatus(e.message || String(e), 'err'); }
    finally { if (seq === runSeq) setBusy(false); }
  }

  async function refine() {
    const req = $('#refineInput').value.trim();
    if (!req || !S.conv || S.busy || blockIfExpired()) return;
    // 다듬기 요청 글도 Gemini 로 가므로 메모처럼 이름·반·번호·연락처를 확인한다(전에는 점검 없이 보냈음)
    const hits = SMChecks.checkMemo(req);
    if (hits.length && !confirm(`요청에 개인정보로 보이는 표현이 있어요: ${termsOf(hits)}\n그래도 AI로 보낼까요?`)) return;
    const current = $('#resultText').value.trim();
    if (!okToSendText(current)) return;
    const turns = S.conv.turns.concat([
      { role: 'assistant', text: current || S.conv.lastRaw },
      { role: 'user', text: SMPrompt.buildRefine(req, S.result && S.result.input && S.result.input.factMode) }, // 요청 글은 js/prompt.js 한 곳에서
    ]);
    setStatus('요청대로 다듬는 중…', 'busy');
    setBusy(true);
    const run = startRun(), seq = run.seq;
    try {
      const r = await runWithLengthFix(convPromptNow(), turns, run);
      if (seq !== runSeq) return; // 기다리는 동안 새로 쓰기·점검하기를 눌렀으면 버린다
      S.conv = { prompt: S.conv.prompt, turns: r.turns, lastRaw: r.raw };
      // 다듬기 답에 새 '덧붙인 내용' 목록이 있으면 바꾸고, 없으면 앞 목록을 둔다. 늘린 문장 목록은 그대로 둔다 — 지운 문장은 화면에서 빠짐(에이전트 검증 2026-10-23)
      const newList = S.result.input && S.result.input.addedList ? (SMPrompt.extractAddedList(r.raw) || SMPrompt.extractAddedList(r.firstRaw)) : null;
      S.result = { ...S.result, text: r.text, fixedFrom: r.fixedFrom, grownFrom: null, addedList: newList || S.result.addedList, servedBy: r.servedBy };
      $('#refineInput').value = '';
      setStatus('');
      renderResult();
    } catch (e) { if (seq === runSeq) setStatus(e.message || String(e), 'err'); }
    finally { if (seq === runSeq) setBusy(false); }
  }

  /* ── 스킬 파일 받기: 지금 고른 항목·과목·칩·예시로 만든 지시문(교사 메모·반·번호는 빼고)을 SKILL.md 로.
   * ZIP 은 '이름/SKILL.md' 구조 — Claude 는 ZIP 만, Gemini 는 SKILL.md·ZIP 둘 다 받는다(2026-10-21 두 회사 공식 도움말) ── */
  // 메모 없는 지침(스킬 본문)을 만든다. 교사가 넣은 것에 학생 식별 표현이 있어 교사가 그만두면 null
  // 교사가 직접 넣은 것만 모은다(규칙 글의 '고등학교'까지 학교명으로 잡혀서) — 과목·동아리명·직접 추가한 칩·고른 내 예시·체크한 자료 카드.
  // 앱에서 바로 만들기·프롬프트도 이것까지 확인한다(전에는 메모만 봐서 칩 이름에 든 학생 이름은 확인 없이 갔음)
  function ownText(input) {
    // 체크한 예시뿐 아니라 자동으로 골라 실제로 들어가는 예시까지 본다(에이전트 검증 2026-10-24: 자동으로 고른 내 예시의 이름이 확인 없이 갔음)
    const used = new Set((input.exampleIds || []).concat(promptOf(input).meta.exampleIds || []));
    const mine = SMStore.get(K.myEx, []).filter(x => used.has(x.id));
    const o = input.obs || {};
    return [input.subject, input.club, o.participationNote || ''].concat(o.traits || [], o.changes || [], input.customEmphasis || [], input.customKyogwa || [], input.customComps || [],
      mine.map(x => [x.text, x.title, x.source && x.source.name].join('\n')), (input.refCards || []).map(c => JSON.stringify(c))).join('\n');
  }
  function checkedSkill(where) {
    const input = collectInput();
    const sk = SMPrompt.buildSkill(input, S.rules, S.ref, dict(), S.comp, today());
    const hits = SMChecks.checkMemo(ownText({ ...input, obs: null })); // 관찰 내용은 지침에 들어가지 않으므로 빼고 검사
    if (hits.length && !confirm(`${where}에 학생을 알아볼 수 있는 표현이 들어가요: ${termsOf(hits)}\n그래도 계속할까요? (지침은 ChatGPT·Gemini·Claude 계정에 저장돼요)`)) return null;
    return { input, sk };
  }
  // '지침만 복사': 메모를 적고 지우는 단계 없이 ChatGPT 프로젝트 지침·Gemini 빈 템플릿·Claude 채팅에 바로 붙여 넣게 (사용자 요청 2026-10-21)
  const rememberCopyFact = () => { S.draft.copyFact = S.draft.factMode === 'loose' ? 'loose' : 'strict'; persistDraft(); };
  async function copySkillBody() {
    if (blockIfExpired()) return;
    const r = checkedSkill('지침'); if (!r) return;
    rememberCopyFact();
    toast(await copyText(r.sk.body) ? '메모 없는 지침을 복사했어요. ChatGPT 프로젝트 지침이나 스킬 칸에 붙여 넣어 주세요.' : '복사하지 못했어요. 옆의 "SKILL.md"로 받아 열어 복사해 주세요.');
  }
  function downloadSkill(kind) {
    if (blockIfExpired()) return;
    const r = checkedSkill('스킬 파일'); if (!r) return;
    rememberCopyFact();
    const { input, sk } = r;
    const what = [AREA_SHORT[input.area], input.subject || input.club].filter(Boolean).join('-').replace(/[\\/:*?"<>|\s]+/g, '');
    if (kind === 'md') download('SKILL.md', sk.markdown, 'text/markdown;charset=utf-8');
    else download(`생기부스킬-${what}${input.factMode === 'loose' ? '-과장허용' : ''}.zip`, SMXlsx.zip([[sk.name + '/', ''], [sk.name + '/SKILL.md', sk.markdown]]), 'application/zip');
    toast(kind === 'md' ? 'SKILL.md 를 받았어요. Gemini 스킬 화면의 업로드로 올려 주세요.' : '스킬 파일(.zip)을 받았어요. Gemini·Claude 스킬 화면에서 올려 주세요.');
  }

  /* ── 방식 B: 프롬프트 복사 ─────────────────────── */
  function showPrompt() {
    if (blockIfExpired()) return;
    if (!S.draft.memo.trim()) { toast('관찰 메모를 먼저 적어 주세요.'); return; }
    if (!standardsReady()) return;
    const hits = SMChecks.checkMemo(S.draft.memo + '\n' + ownText(collectInput()));
    if (hits.length) toast('메모·과목·칩에 개인정보로 보이는 표현이 있어요. 붙여 넣기 전에 지워 주세요.');
    $('#promptOut').value = currentPrompt().combined;
    rememberCopyFact();
    $('#promptOnly').hidden = false;
    $('#promptCard').hidden = false;
    $('#promptCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  // 지침·스킬을 저장해 둔 교사는 메모를 채팅에만 보내므로, 메모 없이도 받은 문단 칸을 열 수 있게 한다(프롬프트는 숨김 — 복사한 방식을 바꾸지 않음)
  function openPaste() {
    if (blockIfExpired()) return;
    if ($('#promptCard').hidden) $('#promptOnly').hidden = true;
    $('#promptCard').hidden = false;
    $('#promptCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('#pasteBack').focus({ preventScroll: true });
  }
  function checkPasted() {
    if (blockIfExpired()) return;
    const raw = $('#pasteBack').value.trim();
    if (!raw) { toast('받은 문단을 붙여 넣어 주세요.'); return; }
    cancelRun(); // 앱에서 바로 만들기가 아직 기다리는 중이면 멈추고, 그 응답이 이 문단을 덮지 않게
    S.conv = null;
    const input = collectInput();
    if (S.draft.copyFact === 'loose') input.factMode = 'loose'; // 과장 허용으로 복사한 프롬프트·지침에서 받은 문단이면 경고·이름표를 붙임
    // '덧붙인 내용' 목록은 과장 허용 지시에만 있으므로, 목록이 있으면 며칠 전에 받아 둔 과장 허용 스킬의 답으로 본다(에이전트 검증 2026-10-24)
    if (SMPrompt.extractAddedList(raw) !== null) input.factMode = 'loose';
    // 채팅에서 받은 답에 '[덧붙인 내용]' 목록이 있으면 함께 보여 준다(없으면 보여 주지 않음 — 문단만 붙여 넣는 경우가 많아서)
    S.result = { text: SMPrompt.extractParagraph(raw), area: S.draft.area, source: 'B', input, who: whoNow(), pasted: raw, addedList: SMPrompt.extractAddedList(raw) };
    setStatus('');
    renderResult();
    $('#resultCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ── 📋 저장함 ─────────────────────── */
  function saveResult() {
    const text = $('#resultText').value.trim();
    if (!text) { toast('저장할 문단이 없어요.'); return; }
    // 받은 문단 칸에 새 글을 붙여 넣고 '점검하기'를 안 누른 채 저장하면 앞 학생 문단이 새 번호로 저장됐음(QA 2026-10-21)
    const pasted = $('#promptCard').hidden ? '' : $('#pasteBack').value.trim();
    if (pasted && pasted !== (S.result && S.result.pasted)) { toast('붙여 넣은 문단을 아직 점검하지 않았어요. "받은 문단 점검하기"를 먼저 눌러 주세요.'); $('#btnCheckPasted').focus(); return; }
    const list = SMStore.get(K.saved, []);
    const d = S.draft;
    const cls = toNo(d.tagClass), num = toNo(d.tagNum);
    // 항목·학년은 문단을 만든 때 기준(만든 뒤 항목을 바꾸면 다른 항목으로 저장되던 것). 과목·동아리명은 항목이 그대로면
    // 지금 칸의 값(만든 뒤 오타를 고칠 수 있게), 항목을 바꿨으면 만든 때 값
    const inp = (S.result && S.result.input) || collectInput();
    const area = inp.area, grade = inp.grade, same = area === d.area;
    const subject = area === 'setuk' ? (same ? d.subject.trim() : inp.subject) : '';
    const club = area === 'dongari' ? (same ? d.club.trim() : inp.club) : '';
    // 저장을 두 번 누르면 같은 문단이 두 개 쌓이던 것을 막는다(바로 앞 저장과 문단·항목·반·번호가 모두 같으면)
    const prev = list[0];
    if (prev && prev.text === text && prev.area === area && prev.cls === cls && prev.num === num) { toast('이미 저장한 문단이에요.'); return; }
    // 같은 문단이 이미 다른 반·번호로 저장돼 있으면 한 번 묻는다(사용자 결정 2026-10-24 — 메모를 그대로 두고 번호만 바꿔 저장하면
    // 앞 학생 문단이 다른 학생 것으로 한 번 더 들어갔음). 반·번호만 바뀐 평소 흐름(만든 뒤 번호를 적음)은 처음 저장이라 묻지 않음
    const dup = list.find(p => p.text === text && p.area === area && (p.cls || p.num) && (p.cls !== cls || p.num !== num));
    if (dup && !confirm(`같은 문단이 이미 ${studentOf(dup)}(으)로 저장돼 있어요.\n${studentOf({ cls, num }) || '반·번호 없이'} 문단으로 한 번 더 저장할까요?`)) return;
    // 만든 뒤(또는 기다리는 동안) 메모를 바꿨으면 다음 학생 칸일 수 있다 — 앞 학생 문단이 새 반·번호로 저장되던 것.
    // 반·번호만 바뀐 것은 묻지 않는다(만든 뒤 번호를 적는 평소 흐름)
    const w = S.result && S.result.who;
    if (w && (cls || num) && w.memo !== d.memo.trim() &&
      !confirm(`이 문단은 지금 칸과 다른 메모로 만든 것이에요.\n지금 반·번호(${studentOf({ cls, num })})로 저장할까요?`)) return;
    list.unshift({
      id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      area, areaName: areaName(area, grade), grade, subject, club,
      // 반·번호(선택): 저장함·엑셀용. AI 프롬프트(collectInput)에는 넣지 않는다 (사용자 결정 2026-10-21)
      cls, num,
      loose: !!(inp.factMode === 'loose'), // '약간의 과장 허용'으로 만든 문단 — 저장함 이름표에 표시
      text, bytes: SMChecks.countNeisBytes(text), createdAt: new Date().toISOString(),
    });
    if (!SMStore.set(K.saved, list)) { toast('저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.'); return; }
    // 알림은 실제 저장된 값으로 ('0'·'00'번은 저장되지 않는데 "00번으로 저장"이라고 나왔음)
    toast(num ? `${cls ? cls + '반 ' : ''}${num}번으로 저장했어요.` : '저장했어요. 📋 저장함에서 볼 수 있어요.');
    renderSaved();
  }
  // 반·번호: 1~99 의 숫자만. 아니면 빈 값
  const toNo = (v) => { const n = parseInt(String(v || '').replace(/\D/g, ''), 10); return n >= 1 && n <= 99 ? n : ''; };
  // 바이트: 백업 파일에서 온 항목에 값이 없거나 숫자가 아니면 문단으로 다시 잰다(저장함이 멈추거나 엑셀에 NaN 이 들어가던 것)
  const bytesOf = (p) => (typeof p.bytes === 'number' && isFinite(p.bytes) ? p.bytes : SMChecks.countNeisBytes(String(p.text || '')));
  const studentOf = (p) => [p.cls ? p.cls + '반' : '', p.num ? p.num + '번' : ''].filter(Boolean).join(' ');
  function labelOf(p, noLoose) {
    return [studentOf(p), shortName(p.area, p.grade) || p.areaName, p.subject, p.club, p.grade ? p.grade + '학년' : '', p.loose === true && !noLoose ? '⚠ 과장 허용' : ''].filter(Boolean).join(' · ');
  }
  // 저장함 위쪽(개수·백업 안내)과 엑셀 카드. 문단 하나를 지우거나 반·번호를 고칠 때는 목록을 다시 그리지 않고 이것과 그 카드만 고친다
  // — 화면 밖 카드는 어림 높이라(css .saved-card content-visibility) 목록을 통째로 다시 그리면 보던 자리가 다른 카드로 튀었음
  function renderSavedHead(list) {
    $('#savedTotal').textContent = list.length ? `${list.length}개` : '';
    const last = SMStore.get(K.lastBackup, null);
    $('#backupHint').textContent = list.length
      ? (last ? `마지막 백업: ${last}` : '아직 백업한 적이 없어요. 브라우저 기록을 지우면 저장함도 사라지니 가끔 "백업 파일 저장"을 눌러 두세요.')
      : '';
    renderExcel(list);
  }
  function renderSaved() {
    const list = SMStore.get(K.saved, []);
    $('#savedList').innerHTML = list.length ? list.map(p => `
      <div class="saved-card" data-id="${esc(p.id)}">
        <div class="saved-meta"><b>${esc(labelOf(p, true))}</b>${p.loose === true ? '<span class="badge-loose">⚠ 과장 허용</span>' : ''}<span>${fmtTime(p.createdAt)}</span><span>${bytesOf(p).toLocaleString()}바이트 · 한글 약 ${Math.round(bytesOf(p) / 3)}자</span></div>
        <p class="saved-text">${esc(p.text)}</p>
        <div class="btn-line"><button type="button" class="btn ghost" data-saved-copy="${esc(p.id)}">복사</button>
          <button type="button" class="btn ghost" data-saved-tag="${esc(p.id)}">반·번호 고치기</button>
          <button type="button" class="btn ghost danger" data-saved-del="${esc(p.id)}">삭제</button></div>
      </div>`).join('') : '<div class="empty">아직 저장한 문단이 없어요.<br>✏️ 만들기에서 문단을 만든 뒤 "저장함에 넣기"를 눌러 주세요.</div>';
    renderSavedHead(list);
  }

  /* 엑셀로 내려받기: 저장함에 쌓인 문단을 학년·반으로 골라 .xlsx 한 장으로. 반·번호 순서로 정렬 */
  const XL_NONE = 'none';
  function renderExcel(list) {
    // 카드는 늘 보인다. 저장한 문단이 없으면 고르기·버튼을 막고 안내만
    $('#btnExcel').disabled = !list.length;
    $('#xlGrade').disabled = $('#xlClass').disabled = $('#xlLatest').disabled = !list.length;
    if (!list.length) {
      $('#xlGrade').innerHTML = '<option>전체</option>'; $('#xlClass').innerHTML = '<option>전체</option>';
      $('#xlHint').textContent = ''; // 빈 저장함 안내는 목록 쪽 하나만(UX 점검 2026-10-24: 같은 말이 두 번, 폰에서는 탭바에 가렸음)
      return;
    }
    // value 도 esc — 백업 파일에서 온 학년·반 값이 그대로 들어가 코드가 끼어들 수 있었음
    const keep = (sel, opts) => { const v = sel.value; sel.innerHTML = opts.map(([k, l]) => `<option value="${esc(k)}">${esc(l)}</option>`).join(''); if (opts.some(([k]) => k === v)) sel.value = v; };
    const grades = [...new Set(list.map(p => p.grade).filter(Boolean))].sort();
    keep($('#xlGrade'), [['all', '전체']].concat(grades.map(g => [String(g), g + '학년'])));
    const g = $('#xlGrade').value;
    const inGrade = list.filter(p => g === 'all' || String(p.grade) === g);
    const classes = [...new Set(inGrade.map(p => p.cls).filter(Boolean))].sort((a, b) => a - b);
    keep($('#xlClass'), [['all', '전체']].concat(classes.map(c => [String(c), c + '반']), inGrade.some(p => !p.cls) ? [[XL_NONE, '반 없음']] : []));
    const rows = excelRows(list);
    $('#xlHint').textContent = `${rows.length}개 문단이 들어가요. 파일은 이 기기에 내려받아져요. 학생 정보가 들어 있으니 학교 밖으로 보내지 마세요.`;
  }
  function excelRows(list) {
    const g = $('#xlGrade').value, c = $('#xlClass').value, latest = $('#xlLatest').checked;
    let rows = list.filter(p => (g === 'all' || String(p.grade) === g) && (c === 'all' || (c === XL_NONE ? !p.cls : String(p.cls) === c)));
    // 시각은 글자로 맞춰 비교한다(숫자 시각이 든 옛·손상된 문단이 있으면 엑셀 카드가 멈췄음)
    rows = rows.slice().sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    if (latest) {
      // 반·번호가 있는 것만 '같은 학생'으로 묶는다. 반·번호가 없으면 모두 남긴다
      const seen = new Set();
      rows = rows.filter(p => {
        if (!p.num || !p.cls) return true; // 반 없이 번호만 같으면 다른 반 학생일 수 있어 빼지 않는다(주석의 원래 뜻대로)
        const k = [p.grade, p.cls, p.num, p.area, p.subject, p.club].join('|');
        if (seen.has(k)) return false; seen.add(k); return true;
      });
    }
    const big = (v) => (v === '' || v == null ? 999 : v);
    return rows.sort((a, b) => big(a.grade) - big(b.grade) || big(a.cls) - big(b.cls) || big(a.num) - big(b.num)
      || AREA_ORDER.indexOf(a.area) - AREA_ORDER.indexOf(b.area) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  }
  function downloadExcel() {
    const rows = excelRows(SMStore.get(K.saved, []));
    if (!rows.length) { toast('고른 학년·반에 저장한 문단이 없어요.'); return; }
    const g = $('#xlGrade').value, c = $('#xlClass').value;
    const scope = [g === 'all' ? '' : g + '학년', c === 'all' ? '' : c === XL_NONE ? '반없음' : c + '반'].filter(Boolean).join(' ') || '전체';
    const data = SMXlsx.build({
      name: scope,
      columns: [{ header: '학년', width: 6 }, { header: '반', width: 6 }, { header: '번호', width: 6 }, { header: '항목', width: 10 },
        { header: '과목·동아리', width: 14 }, { header: '문단', width: 80, wrap: true }, { header: '바이트', width: 8 }, { header: '한글 약(자)', width: 10 }, { header: '저장 시각', width: 17 }, { header: '확인', width: 14 }],
      rows: rows.map(p => [p.grade || '', p.cls || '', p.num || '', shortName(p.area, p.grade) || p.areaName || '', p.subject || p.club || '', p.text, bytesOf(p), Math.round(bytesOf(p) / 3), fmtStamp(p.createdAt), p.loose === true ? '⚠ 과장 허용' : '']),
    });
    download(`생기부-초안-${scope.replace(/\s+/g, '')}-${today()}.xlsx`, data, SMXlsx.MIME);
    toast(`${rows.length}개 문단을 엑셀로 내려받았어요.`);
  }

  /* ── 📚 자료 ─────────────────────── */
  const AREA_LABEL = { ...AREA_SHORT, all: '공통' }; // 올린 자료 카드는 '공통'(모든 항목) 카드도 있음
  function renderUploads() {
    const docs = S.uploads || [];
    const on = SMStore.get(K.refOn, {});
    const nOn = docs.reduce((n, d) => n + d.cards.filter(c => on[c.id]).length, 0);
    $('#uploadCount').textContent = docs.length ? `${docs.length}개 자료 · 반영 ${nOn}개` : '';
    $('#uploadList').innerHTML = docs.length ? docs.map(doc => `
      <details class="inline-details upload-doc"><summary>📄 ${esc(doc.doc_title)} <span class="muted">(${esc(doc.doc_kind)} · 카드 ${doc.cards.length}개)</span></summary>
        <p class="hint">${esc(doc.summary)}<br>파일: ${esc(doc.file)} · 정리: ${esc((doc.imported_at || '').slice(0, 10))}${doc.model === 'mock' ? ' · <b>시험 모드 가짜 카드</b>' : ''}</p>
        <div class="btn-line"><button type="button" class="btn ghost small-ghost" data-doc-all="${esc(doc.id)}">이 자료 모두 체크</button><button type="button" class="btn ghost small-ghost" data-doc-none="${esc(doc.id)}">모두 해제</button></div>
        ${doc.cards.map(c => `
          <label class="ref-card${on[c.id] ? ' on' : ''}"><input type="checkbox" data-ref="${esc(c.id)}" ${on[c.id] ? 'checked' : ''}>
            <span><b>[${esc(AREA_LABEL[c.area] || c.area)} · ${esc(c.kind)}] ${esc(c.title)}</b>${c.page ? ` <span class="page-ref">${esc(c.page)}쪽</span>` : ''}
            <span class="ref-text">${esc(c.text)}</span>
            ${c.example ? `<span class="ref-ex">예시: ${esc(c.example)}</span>` : ''}
            ${c.engine_flags && c.engine_flags.length ? `<span class="ex-flag">⚠ 예시에 금지 표현: ${esc(c.engine_flags.join(', '))}</span>` : ''}</span></label>`).join('')}
      </details>`).join('')
      : '<p class="hint">아직 올린 자료가 없어요. 위 "자료 올리는 방법"을 따라 넣어 주세요.</p>';
  }
  // 올린 자료 카드 체크를 저장하고, 자료 목록·만들기 안내·열린 프롬프트에 바로 반영
  function saveRefOn(on) { SMStore.set(K.refOn, on); renderUploads(); renderRefCardHint(); refreshPrompt(); }
  function renderRefCardHint() {
    const n = selectedRefCards(S.draft.area).length;
    $('#refCardHint').innerHTML = n ? `📚 올린 자료에서 고른 카드 <b>${n}개</b>가 이 항목 초안에 반영돼요. <a href="#library">바꾸기</a>` : '';
  }
  // 미리 넣어 둔 student-record 규칙 파일 안내(언제 받았는지, 기본 규칙에서 바뀐 것)
  function preloadNote() {
    const m = S.srMeta;
    if (!m || !S.srUser) return '';
    const c = m.changes || {};
    const changed = (c.addedTerms || 0) + (c.removedTerms || 0) + (c.customTerms || 0) + (c.allowlist || 0) + (c.disabledRules || 0) + (c.offCategories || 0) + (c.limits || 0);
    const detail = changed
      ? `기본 규칙에서 바뀐 것: 직접 넣은 금지어 ${c.customTerms || 0} · 허용 ${c.allowlist || 0} · 끈 규칙 ${(c.disabledRules || 0) + (c.offCategories || 0)} · 낱말 +${c.addedTerms || 0}/−${c.removedTerms || 0} · 글자수 ${c.limits || 0}`
      : '학교에서 따로 고친 규칙은 없어 기본 규칙과 같아요';
    const inUse = !SMStore.isCheckerSettings(SMStore.get(K.checker, null)); // 형식이 틀려 쓰지 않는 가져온 파일은 '먼저 적용 중'이 아님
    return `<div class="note ${inUse ? 'ok' : ''} preload-note">✅ <b>student-record 규칙 파일을 미리 넣어 두었어요</b> (${esc(m.madeAt)} 받음${m.savedAt ? ` · student-record 저장 ${esc(m.savedAt)}` : ''})<br>
      <span class="muted">${esc(m.engine)} · ${m.categories}분류 ${m.terms}낱말 · ${esc(detail)}${inUse ? '' : ' · 지금은 직접 가져온 파일이 먼저 적용 중'}</span></div>`;
  }

  function renderLibrary() {
    const R = S.rules;
    const pg = (s) => s ? `<span class="page-ref">${s.page}쪽</span>` : '';
    $('#rulesView').innerHTML = `
      <p class="hint">${esc(R.meta.title)} · ${esc(R.meta.publisher)} · 원문 대조 완료${R.meta.verified_by_user ? ' · 선생님 확인 완료' : ''}</p>
      <table class="table"><thead><tr><th>항목</th><th>최대</th><th>입력</th></tr></thead><tbody>
      ${R.areas.map(a => `<tr><td>${esc(a.name)}${a.in_app_scope === false ? ' <span class="muted">(이 앱에서 안 씀)</span>' : ''}</td><td>${a.limit_bytes.toLocaleString()}바이트<br><span class="page-ref">한글 ${a.limit_chars}자</span></td><td>${esc(a.writer)}</td></tr>`).join('')}
      </tbody></table>
      <p class="hint">${esc(R.byte_rule.note)} ${pg(R.byte_rule.source)}</p>
      <details class="inline-details"><summary>기재 금지 사항 ${R.prohibited.length}가지</summary>
        <ul class="list-plain">${R.prohibited.map(p => `<li>${esc(p.text)} ${pg(p.source)}</li>`).join('')}</ul></details>
      <details class="inline-details"><summary>생성형 AI 활용 조항</summary>
        <p class="hint">${esc(R.ai_policy.rule)}. ${esc(R.ai_policy.allowed)} <span class="page-ref">19쪽</span></p></details>
      ${(R.open_questions || []).map(q => `<div class="note warn">확인 필요: ${esc(q.question)}<br><span class="muted">${esc(q.app_default)}</span></div>`).join('')}`;

    const n = (dict() || []).reduce((x, d) => x + ((d.terms || []).length), 0);
    $('#checkerView').innerHTML = `
      <p class="hint">문단을 만들면 기재 금지 표현 ${n}개와 학생 시점 표현·이름을 자동으로 찾아요.</p>
      ${SMStore.get(K.checker, null) && !SMStore.isCheckerSettings(SMStore.get(K.checker, null)) ? '<div class="note warn">⚠ 가져온 설정 파일은 형식이 맞지 않아 쓰지 않아요(' + (S.srUser ? '미리 넣어 둔 규칙' : '기본 규칙') + '으로 점검 중). 지우고 다시 가져와 주세요.</div>' : ''}
      <details class="inline-details"><summary>자세히 (점검 규칙의 출처)</summary>
        <p class="hint">점검 엔진: 생기부 금지어 탐색기(student-record) · ${esc(SRRules.SOURCE.label)} · 사전 ${dict().length}분류 ${n}낱말 + 이 앱 추가 검사(학생 시점·이름)</p>
        <p class="hint">적용 중인 규칙: <b>${esc(S.settingsSource)}</b></p>
        ${preloadNote()}</details>
      ${SMStore.get(K.checker, null) ? '<button type="button" class="btn text" id="btnClearChecker">가져온 설정 파일 지우기</button>' : ''}`;
    if (SMStore.get(K.checker, null) && !S.checkerMoreShown) { $('#checkerMore').open = true; S.checkerMoreShown = true; } // 가져온 파일을 쓰는 중이면 처음 한 번 펼쳐 둠
    renderMyRules();

    const filter = S.libFilter || 'all';
    $('#libraryFilter').innerHTML = [['all', '전체']].concat(AREA_ORDER.map(k => [k, AREA_SHORT[k]]))
      .map(([k, l]) => `<button type="button" class="chip" aria-pressed="${filter === k}" data-lib-filter="${k}">${esc(l)}</button>`).join('');
    let ex = S.ref.examples.filter(e => filter === 'all' || e.areas.includes(filter));
    const lg = $('#libraryGroups');
    if (filter === 'setuk') {
      const checked = S.libGroups || SMPrompt.EXAMPLE_GROUPS.slice();
      lg.innerHTML = groupChecksHtml(ex, checked, 'data-libg');
      lg.hidden = false;
      ex = ex.filter(e => checked.includes(e.group));
    } else { lg.hidden = true; lg.innerHTML = ''; }
    renderUploads();
    $('#exampleCount').textContent = `${S.ref.examples.length}개 · 공개 사례 · 예시마다 출처·발행일 표시`;
    $('#libraryExamples').innerHTML = (ex.length ? '' : '<p class="hint">고른 묶음이 없어 보여 줄 예시가 없어요. 위에서 묶음을 골라 주세요.</p>') + ex.map(e => `
      <details class="inline-details"><summary>${esc(e.title)}${e.source ? ` <span class="muted">· ${esc(String(e.source.name || '').split(/\s/)[0])} ${esc(String(e.source.published || '').slice(0, 4))}</span>` : ''}${e.engine_flags.length ? ' ⚠' : ''}${isOld(e) ? ' <span class="ex-old">2년 지난 자료</span>' : ''}</summary>
        ${e.engine_flags.length ? `<span class="ex-flag">금지 표현 포함: ${esc(e.engine_flags.join(', '))}</span>` : ''}
        <p class="ex-text">${esc(e.text)}</p>
        ${e.source ? `<span class="ex-url">${esc(e.source.name)} · ${esc(e.source.published)} · ${esc(e.source.type)}<br>${esc(e.source.url)}</span>` : ''}</details>`).join('');
  }

  /* ── ❓ 안내 ─────────────────────── */
  const guideCache = {};
  async function loadGuide(el) {
    const id = el.dataset.guideSrc;
    if (el.dataset.loaded) return;
    el.dataset.loaded = '1';
    try {
      if (!guideCache[id]) guideCache[id] = await (await fetch(`guides/${id}.html`, { cache: 'no-cache' })).text();
      el.innerHTML = guideCache[id];
    } catch (e) { el.textContent = '안내를 불러오지 못했어요.'; delete el.dataset.loaded; }
  }
  function renderGuideSettings() {
    $('#apiKey').value = SMStore.get(K.apiKey, '');
    $('#modelName').value = SMStore.get(K.model, '');
    $('#modelName').placeholder = SMAI.DEFAULT_MODEL;
  }

  /* ── 탭 이동 ─────────────────────── */
  function route(tabOverride) {
    const known = ['make', 'saved', 'library', 'guide'];
    const t = known.includes(tabOverride) ? tabOverride : (S.activeSubTab || 'make');
    S.activeSubTab = t;
    $$('section.tab').forEach(s => { s.hidden = s.dataset.tab !== t; });
    $$('[data-tab-link]').forEach(a => {
      const on = a.dataset.tabLink === t;
      a.classList.toggle('is-active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    if (t === 'make') { renderRefCardHint(); refreshPrompt(); fitResult(); } // 자료 탭에서 점검 규칙 파일을 가져오거나 지우고 돌아오면(프롬프트의 '바꿔 쓰기' 기준이 바뀜) 열린 프롬프트도 새로
    if (t === 'saved') renderSaved();
    if (t === 'library') renderLibrary();
    if (t === 'guide') renderGuideSettings();
  }

  /* ── 이벤트 ─────────────────────── */
  // 칸에서 Enter 를 누르면 fn 실행. 한글을 조합하는 중(isComposing)의 Enter 는 글자 확정이라 건너뛴다
  const onEnter = (sel, fn) => $(sel).addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) fn(); });
  // 컴퓨터 화면 폭 고르기(사용자 요청 2026-10-22): 넓게(기본, 모니터 폭에 맞춤) / 좁게(폰과 비슷한 폭). 위 띠 오른쪽, 900px 이상에서만 보임
  function renderViewWidth() {
    const w = document.documentElement.dataset.width === 'narrow' ? 'narrow' : 'wide';
    $$('#viewWidthSeg button').forEach(b => b.setAttribute('aria-checked', String(b.dataset.width === w)));
  }
  function bindViewWidth() {
    renderViewWidth();
    $('#viewWidthSeg').addEventListener('click', (e) => {
      const b = e.target.closest('[data-width]'); if (!b) return;
      if (b.dataset.width === 'narrow') document.documentElement.dataset.width = 'narrow'; else delete document.documentElement.dataset.width;
      SMStore.set(K.viewWidth, b.dataset.width);
      renderViewWidth(); fitResult();
    });
  }
  function bind() {
    bindViewWidth();
    document.addEventListener('click', (e) => {
      const link = e.target.closest('[data-tab-link]');
      if (link) {
        e.preventDefault();
        route(link.dataset.tabLink);
        const panel = $('#panel-make');
        if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });

    $('#areaGrid').addEventListener('click', (e) => {
      const b = e.target.closest('[data-area]'); if (!b) return;
      S.draft.area = b.dataset.area; S.draft.target = null; S.showAllExamples = false;
      saveDraft(); renderMake();
      if (S.result) renderResult(); // 만든 뒤 항목을 바꾸면 결과 카드에 '만든 때 항목 기준'을 보여 줌
    });
    $('#gradeSeg').addEventListener('click', (e) => {
      const b = e.target.closest('[data-grade]'); if (!b) return;
      S.draft.grade = Number(b.dataset.grade); saveDraft(); renderGrade(); renderAreas(); renderSubjectHint(); renderKyogwa(); renderComps(); renderObs(); renderMemoNotes();
    });
    $('#subject').addEventListener('input', (e) => { S.draft.subject = e.target.value; saveDraft(); renderSubjectHint(); renderExamplesDebounced(); renderEmphasisDebounced(); renderKyogwaDebounced(); renderObsDebounced(); });
    $('#subjectGroupSeg').addEventListener('click', (e) => {
      const b = e.target.closest('[data-sg]'); if (!b) return;
      S.draft.subjectGroup = b.dataset.sg === SMPrompt.detectSubjectGroup(S.rules, S.draft.subject) ? '' : b.dataset.sg;
      saveDraft(); renderEmphasis();
    });
    $('#kyogwaSel').addEventListener('change', (e) => { S.draft.kyogwa = e.target.value; saveDraft(); renderKyogwa(); });
    $('#kgChips').addEventListener('click', (e) => {
      const b = e.target.closest('[data-kg]'); if (!b) return;
      const key = kgKey(); if (!key) return;
      const cur = (S.draft.kcomps[key] || []), n = b.dataset.kg;
      S.draft.kcomps = { ...S.draft.kcomps, [key]: cur.includes(n) ? cur.filter(x => x !== n) : cur.concat(n) };
      saveDraft(); renderKyogwa();
    });
    $('#emphChips').addEventListener('click', (e) => {
      const b = e.target.closest('[data-emph]'); if (!b) return;
      const cur = (S.draft.emph[S.draft.area] || []), id = b.dataset.emph;
      S.draft.emph = { ...S.draft.emph, [S.draft.area]: cur.includes(id) ? cur.filter(x => x !== id) : cur.concat(id) };
      saveDraft(); renderEmphasis();
    });
    $('#club').addEventListener('input', (e) => { S.draft.club = e.target.value; saveDraft(); renderTargetsDebounced(); });
    $('#clubHeaderCounts').addEventListener('change', (e) => { S.draft.clubHeaderCounts = e.target.checked; saveDraft(); renderTargets(); renderMemoNotes(); });
    $('#memo').addEventListener('input', (e) => { S.draft.memo = e.target.value; saveDraft(); renderMemoNotesDebounced(); syncMakeButtons(); });
    $('#factModeSeg').addEventListener('click', (e) => {
      const b = e.target.closest('[data-fact]'); if (!b) return;
      S.draft.factMode = b.dataset.fact === 'loose' ? 'loose' : 'strict';
      // 프롬프트 카드가 열려 있으면 칸 글이 바로 바뀌어 손으로 복사할 수 있으므로 과장 허용을 기억한다(QA 2026-10-24: 길게 눌러 복사하면 경고가 빠졌음)
      if (!$('#promptCard').hidden && S.draft.factMode === 'loose') S.draft.copyFact = 'loose';
      saveDraft(); renderFactMode();
    });
    $('#target').addEventListener('change', (e) => { S.draft.target = e.target.value ? Number(e.target.value) : null; saveDraft(); renderMemoNotes(); if (S.result) renderResult(); });
    $('#compChips').addEventListener('click', (e) => {
      const b = e.target.closest('[data-comp]'); if (!b) return;
      const id = b.dataset.comp, on = S.draft.comps.includes(id);
      S.draft.comps = on ? S.draft.comps.filter(x => x !== id) : S.draft.comps.concat(id);
      saveDraft(); renderComps();
    });
    $('#evalChips').addEventListener('click', (e) => {
      const b = e.target.closest('[data-eval]'); if (!b) return;
      const id = b.dataset.eval, on = S.draft.evalItems.includes(id);
      S.draft.evalItems = on ? S.draft.evalItems.filter(x => x !== id) : S.draft.evalItems.concat(id);
      saveDraft(); renderEvalFactors();
    });
    $('#exampleList').addEventListener('click', (e) => {
      const more = e.target.closest('[data-ex-more]');
      if (more) { const p = $(`[data-ex-text="${CSS.escape(more.dataset.exMore)}"]`); p.hidden = !p.hidden; more.textContent = p.hidden ? '내용 보기' : '접기'; return; }
      if (e.target.id === 'btnAllExamples') { S.showAllExamples = !S.showAllExamples; renderExamples(); }
      const del = e.target.closest('[data-my-del]');
      if (del && confirm('이 내 예시를 지울까요? 지우면 되돌릴 수 없어요.')) {
        SMStore.set(K.myEx, SMStore.get(K.myEx, []).filter(x => x.id !== del.dataset.myDel));
        S.draft.exampleIds = S.draft.exampleIds.filter(id => id !== del.dataset.myDel);
        refreshExamples(); saveDraft(); renderExamples(); toast('내 예시를 지웠어요.');
      }
    });
    bindMyExamples();
    $('#exGroups').addEventListener('change', (e) => {
      const c = e.target.closest('[data-exg]'); if (!c) return;
      const cur = exGroupsChecked();
      S.draft.exGroups = c.checked ? [...new Set(cur.concat(c.dataset.exg))] : cur.filter(g => g !== c.dataset.exg);
      S.showAllExamples = false; saveDraft(); renderExamples();
    });
    $('#exGroups').addEventListener('click', (e) => {
      const b = e.target.closest('[data-exg-all],[data-exg-none],[data-exg-auto]'); if (!b) return;
      S.draft.exGroups = b.hasAttribute('data-exg-all') ? SMPrompt.EXAMPLE_GROUPS.slice() : b.hasAttribute('data-exg-none') ? [] : null;
      S.showAllExamples = false; saveDraft(); renderExamples();
    });
    $('#libraryGroups').addEventListener('change', (e) => {
      const c = e.target.closest('[data-libg]'); if (!c) return;
      const cur = S.libGroups || SMPrompt.EXAMPLE_GROUPS.slice();
      S.libGroups = c.checked ? [...new Set(cur.concat(c.dataset.libg))] : cur.filter(g => g !== c.dataset.libg);
      renderLibrary();
    });
    $('#libraryGroups').addEventListener('click', (e) => {
      const b = e.target.closest('[data-libg-all],[data-libg-none]'); if (!b) return;
      S.libGroups = b.hasAttribute('data-libg-all') ? SMPrompt.EXAMPLE_GROUPS.slice() : [];
      renderLibrary();
    });
    $('#exampleList').addEventListener('change', (e) => {
      const c = e.target.closest('[data-ex]'); if (!c) return;
      const id = c.dataset.ex;
      if (c.checked && S.draft.exampleIds.length >= 2) { c.checked = false; toast('참고 예시는 2개까지 고를 수 있어요.'); return; }
      S.draft.exampleIds = c.checked ? S.draft.exampleIds.concat(id) : S.draft.exampleIds.filter(x => x !== id);
      saveDraft(); renderExamples();
    });

    // 관찰한 특성·변화·참여도
    document.addEventListener('click', (e) => {
      const tb = e.target.closest('[data-obs-trait]'), cb = e.target.closest('[data-obs-change]'), pb = e.target.closest('[data-part]');
      const d = S.draft, flip = (arr, v) => (arr.includes(v) ? arr.filter(x => x !== v) : arr.concat(v));
      if (tb) { d.obsTraits = flip(d.obsTraits, tb.dataset.obsTrait); saveDraft(); renderObs(); renderMemoNotes(); }
      if (cb) { d.obsChanges = flip(d.obsChanges, cb.dataset.obsChange); saveDraft(); renderObs(); renderMemoNotes(); }
      if (pb) { d.participation = pb.dataset.part; saveDraft(); renderObs(); renderMemoNotes(); }
    });
    $('#stdBody').addEventListener('change', (e) => {
      const c = e.target.closest('[data-std]'); if (!c) return;
      const d = S.draft, code = c.dataset.std, valid = new Set(chosenStandards().map(x => x.key));
      if (c.checked && valid.size >= STD_MAX) { c.checked = false; toast(`성취기준은 ${STD_MAX}개까지 고를 수 있어요.`); return; }
      d.stdCodes = c.checked ? [...valid, code] : [...valid].filter(x => x !== code); // 다른 과목·학년 때 고른 것은 정리, 예전 값(코드만)은 열쇠로 바꿈
      saveDraft(); renderObs(); renderMemoNotes();
    });
    $('#obsBox').addEventListener('toggle', () => { if ($('#obsBox').open) renderStandards(); }); // 펼칠 때 성취기준 자료를 읽음
    $('#stdBody').addEventListener('click', (e) => {
      const b = e.target.closest('[data-pick-subject]'); if (!b) return;
      const el = $('#subject'); el.value = b.dataset.pickSubject; el.dispatchEvent(new Event('input', { bubbles: true })); // 과목 칸 입력과 같은 길로
      renderObs(); toast(`과목을 '${b.dataset.pickSubject}'(으)로 바꿨어요.`);
    });
    // 다 고른 뒤 위로 돌아가 제목을 누르지 않아도 접게(사용자 요청 2026-10-24 — 폰에서 칸이 길어서)
    $('#btnObsSkip').addEventListener('click', () => { $('#obsBox').open = false; $('#moreCard').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    $('#btnObsClose').addEventListener('click', () => { $('#obsBox').open = false; $('#obsBox').scrollIntoView({ behavior: 'smooth', block: 'center' }); });
    $('#partNote').addEventListener('input', (e) => { S.draft.participationNote = e.target.value.slice(0, 60); saveDraft(); renderObs(); renderMemoNotes(); });

    // 직접 추가 칩: 열기·추가·취소·지우기 (세 칸 공통)
    document.addEventListener('click', (e) => {
      const open = e.target.closest('[data-add]'), ok = e.target.closest('[data-add-ok]'), cancel = e.target.closest('[data-add-cancel]'), del = e.target.closest('[data-del]');
      if (open) { const row = $(`[data-add-row="${open.dataset.add}"]`); row.hidden = false; open.hidden = true; row.querySelector('input').focus(); return; }
      if (ok) { const row = ok.closest('.add-row'); addCustom(ok.dataset.addOk, row.querySelector('input').value); return; }
      if (cancel) { RERENDER[cancel.dataset.addCancel](); return; }
      if (del) { removeCustom(del.dataset.del, del.dataset.name); }
    });
    document.addEventListener('keydown', (e) => {
      const row = e.target.closest && e.target.closest('.add-row');
      if (!row || e.isComposing) return;
      if (e.key === 'Enter') { e.preventDefault(); addCustom(row.dataset.addRow, e.target.value); }
      if (e.key === 'Escape') RERENDER[row.dataset.addRow]();
    });

    // 안내 문구 속 버튼 (목표 낮추기 / 메모로 이동)
    document.addEventListener('click', (e) => {
      const t = e.target.closest('[data-set-target]');
      if (t) { S.draft.target = Number(t.dataset.setTarget); saveDraft(); renderTargets(); renderMemoNotes(); if (S.result) renderResult(); toast(`목표 분량을 ${t.dataset.setTarget}자로 바꿨어요.`); return; }
      if (e.target.closest('[data-goto-memo]')) { $('#memo').focus(); $('#memo').scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      if (e.target.closest('[data-goto-fact]')) $('#factModeSeg').scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (e.target.closest('[data-grow]')) growResult();
      if (e.target.closest('[data-grow-copy]')) {
        if (blockIfExpired()) return;
        const msg = growMessage(false);
        if (msg) copyText(msg).then(ok => toast(ok ? '늘리기 요청을 복사했어요. 같은 채팅에 붙여 넣고, 받은 문단을 다시 붙여 넣어 점검해 주세요.' : '복사하지 못했어요.'));
      }
    });

    $('#btnGenerate').addEventListener('click', () => generate(false));
    // 결과 칸을 직접 고쳤으면 다시 만들기 전에 묻는다(QA 2026-10-24: 고친 글이 확인 없이 사라졌음)
    $('#btnRegenerate').addEventListener('click', () => {
      const now = $('#resultText').value.trim(), made = S.conv ? SMPrompt.extractParagraph(S.conv.lastRaw) : now;
      if (now && made && now !== made && !confirm('결과 칸에서 직접 고친 글이 있어요. 다시 만들면 고친 글은 사라져요. 다시 만들까요?')) return;
      generate(true);
    });
    $('#btnRefine').addEventListener('click', refine);
    onEnter('#refineInput', refine);
    $('#btnPrompt').addEventListener('click', showPrompt);
    // 카드를 연 뒤 메모를 고쳐도 복사·내려받기 때 다시 확인(에이전트 검증 2026-10-24: 처음 열 때만 확인했음)
    const promptPrivacyOk = () => { if (!standardsReady()) return false; const hits = SMChecks.checkMemo(S.draft.memo + '\n' + ownText(collectInput())); return !hits.length || confirm(`메모·과목·칩에 개인정보로 보이는 표현이 있어요: ${termsOf(hits)}\n그래도 복사할까요?`); };
    $('#btnCopyPrompt').addEventListener('click', async () => { if (blockIfExpired() || !promptPrivacyOk()) return; rememberCopyFact(); toast(await copyText($('#promptOut').value) ? '프롬프트를 복사했어요.' : '복사하지 못했어요. 길게 눌러 직접 복사해 주세요.'); });
    $('#btnSkillCopy').addEventListener('click', copySkillBody);
    $('#btnSkillZip').addEventListener('click', () => downloadSkill('zip'));
    $('#btnSkillMd').addEventListener('click', () => downloadSkill('md'));
    $('#btnDownloadPrompt').addEventListener('click', () => blockIfExpired() || !promptPrivacyOk() || (rememberCopyFact(), download(`프롬프트-${AREA_SHORT[S.draft.area]}-${today()}.txt`, $('#promptOut').value)));
    $('#btnCheckPasted').addEventListener('click', checkPasted);
    $('#btnOpenPaste').addEventListener('click', openPaste);
    $('#resultText').addEventListener('input', fitResult);
    $('#resultText').addEventListener('input', debounce(() => { if (S.result) { S.result.text = $('#resultText').value; renderResult(); } }, 400));
    // 다른 앱으로 넘어가거나 탭을 닫을 때 기다리지 않고 바로 저장한다(QA 2026-10-24: 입력 뒤 0.3~0.4초 안에 닫히면 마지막 글자가 사라졌음 — 안드로이드 크롬이 탭을 버리는 경우)
    const flushNow = () => { SMStore.set(K.draft, S.draft); if (S.result && !S.waitingNew && !$('#resultCard').hidden) { S.result.text = $('#resultText').value; renderResult(); } };
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushNow(); });
    window.addEventListener('pagehide', flushNow);
    $('#btnCopyResult').addEventListener('click', async () => {
      const t = $('#resultText').value.trim(); if (!t) return;
      toast(await copyText(t) ? '복사했어요. 초안이니 선생님이 읽고 다듬어 최종 문장을 완성해 주세요.' : '복사하지 못했어요. 길게 눌러 직접 복사해 주세요.');
    });
    $('#btnSave').addEventListener('click', saveResult);
    for (const [id, key] of [['#tagClass', 'tagClass'], ['#tagNum', 'tagNum']]) {
      $(id).addEventListener('input', (e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 2); if (v !== e.target.value) e.target.value = v; S.draft[key] = v; saveDraft(); });
    }
    $('#btnReset').addEventListener('click', () => {
      // 저장하지 않은 완성 문단도 함께 사라지므로, 있으면 미리 알린다(전에는 '저장함은 그대로'만 말해 저장 전 문단이 사라지는 줄 몰랐음)
      const curText = $('#resultText').value.trim();
      const unsaved = S.result && curText && !SMStore.get(K.saved, []).some(p => p.text === curText);
      if (!confirm('다음 학생을 쓸까요? 메모·과목·고른 칩을 지우고, 반은 그대로 두고 번호만 비워요.' +
        (unsaved ? '\n⚠ 아직 저장하지 않은 완성 문단도 함께 지워져요. 필요하면 먼저 "저장함에 넣기"를 눌러 주세요.' : '') +
        '\n(저장함은 그대로예요)')) return;
      // 반은 다음 학생도 같으니 남기고, 번호만 비운다
      S.draft = blankDraft({ area: S.draft.area, grade: S.draft.grade, tagClass: S.draft.tagClass || '', factMode: S.draft.factMode, copyFact: S.draft.copyFact });
      cancelRun(); // 기다리는 중인 AI 요청은 멈추고 버린다(앞 학생 문단이 새 화면에 나타나지 않게)
      S.result = null; S.conv = null;
      SMStore.set(K.draft, S.draft); restoreInputs(); renderMake(); renderResult();
      $('#promptCard').hidden = true; $('#pasteBack').value = ''; setStatus('');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // 저장함
    $('#savedList').addEventListener('click', async (e) => {
      const c = e.target.closest('[data-saved-copy]'), d = e.target.closest('[data-saved-del]'), t = e.target.closest('[data-saved-tag]');
      const list = SMStore.get(K.saved, []);
      if (t) {
        const p = list.find(x => x.id === t.dataset.savedTag); if (!p) return;
        const cls = prompt('반 (비우면 없음)', p.cls || ''); if (cls === null) return;
        const num = prompt('번호 (비우면 없음)', p.num || ''); if (num === null) return;
        if ([cls, num].some(v => String(v).trim() && toNo(v) === '')) { toast('반·번호는 1~99 사이 숫자로 적어 주세요. 고치지 않았어요.'); return; } // QA 2026-10-26: 'abc'가 조용히 지워졌음
        p.cls = toNo(cls); p.num = toNo(num);
        SMStore.set(K.saved, list);
        t.closest('.saved-card').querySelector('.saved-meta b').textContent = labelOf(p, true); renderSavedHead(list); // 목록 전체 대신 이 카드 이름만
        toast('반·번호를 고쳤어요.'); return;
      }
      if (c) { const p = list.find(x => x.id === c.dataset.savedCopy); if (p) toast(await copyText(p.text) ? '복사했어요.' : '복사하지 못했어요.'); }
      // 무엇이 지워지는지·되돌릴 수 없음을 함께 묻는다
      const dp = d && list.find(x => x.id === d.dataset.savedDel);
      if (d && confirm(`${dp ? `‘${labelOf(dp)}’ ` : ''}문단을 저장함에서 지울까요?\n지우면 되돌릴 수 없어요.`)) {
        const rest = list.filter(x => x.id !== d.dataset.savedDel);
        SMStore.set(K.saved, rest);
        // 목록 전체 대신 그 카드만 뺀다(보던 자리 그대로). 마지막 하나였으면 빈 안내를 그린다
        if (rest.length) { d.closest('.saved-card').remove(); renderSavedHead(rest); } else renderSaved();
      }
    });
    ['#xlGrade', '#xlClass', '#xlLatest'].forEach(s => $(s).addEventListener('change', () => renderExcel(SMStore.get(K.saved, []))));
    $('#btnExcel').addEventListener('click', downloadExcel);
    $('#btnExport').addEventListener('click', () => {
      download(`생기부-도우미-백업-${today()}.json`, JSON.stringify(SMStore.exportAll(), null, 2), 'application/json');
      SMStore.set(K.lastBackup, today()); renderSavedHead(SMStore.get(K.saved, [])); // 바뀌는 건 '마지막 백업' 안내뿐 — 목록은 다시 그리지 않음
      toast('백업 파일을 내려받았어요. 다운로드 폴더에 있어요.'); // 전에는 눌러도 아무 알림이 없어 저장됐는지 알 수 없었음
    });
    $('#importFile').addEventListener('change', async (e) => {
      const f = e.target.files[0]; e.target.value = ''; if (!f) return;
      // 가져온 내 예시·직접 추가 칩이 새로고침 전에도 만들기 탭에 보이게 refreshExamples·renderMake 까지 한다
      try {
        const had = new Set(SMStore.get(K.myEx, []).map(x => x.id));
        const allowBefore = new Set(myRules().allow);
        const rulesBefore = SMStore.get(K.checker, null);
        const n = SMStore.importAll(JSON.parse(await f.text()));
        // 화면에서 더할 때처럼 '대회'가 든 허용 표현은 한 번 더 묻는다(에이전트 검증 2026-10-24: 백업으로는 묻지 않고 들어왔음)
        const contest = myRules().allow.filter(t => !allowBefore.has(t) && /대회/.test(t));
        if (contest.length && !confirm(`백업의 허용 표현 중 ‘대회’가 든 것이 있어요: ${contest.join(', ')}\n기재요령은 수상경력 외 항목에 대회 관련 내용을 쓰지 못하게 합니다. 이 허용 표현도 가져올까요? (취소하면 이것만 빼요)`)) {
          const my = myRules(); SMStore.set(K.myRules, { ban: my.ban, allow: my.allow.filter(t => !contest.includes(t)) });
        }
        // 남이 만든 백업의 내 예시는 파일에 적힌 engine_flags 를 믿지 않고 이 기기에서 다시 검사한다
        // (금지 표현이 든 예시를 '깨끗함'으로 적어 보내면 프롬프트에 그대로 들어가던 것). 학생을 알아볼 표현도 세어 알린다(예시는 AI로 감)
        const mine = SMStore.get(K.myEx, []); let who = 0;
        for (const x of mine) if (!had.has(x.id)) { x.engine_flags = exampleFlags(x.text, x.areas[0]); if (SMChecks.checkMemo([x.text, x.title, x.source && x.source.name].join('\n')).length) who++; }
        SMStore.set(K.myEx, mine);
        toast(`${n}개를 가져왔어요.${!rulesBefore && SMStore.get(K.checker, null) ? ' 백업의 점검 규칙도 함께 적용했어요. 📚 자료 탭에서 확인해 주세요.' : ''}`); loadSettings(); refreshExamples(); renderMake(); renderSaved(); renderLibrary();
        if (who) alert(`가져온 내 예시 ${who}개에 학생 이름·반·번호·학교명으로 보이는 표현이 있어요. 내 예시는 프롬프트에 들어가 AI로 가니, 만들기 → 참고 예시에서 내용을 확인하고 필요하면 지워 주세요.`);
      }
      catch (err) { toast(err instanceof SyntaxError ? '백업 파일을 읽지 못했어요. 이 앱에서 저장한 .json 파일인지 확인해 주세요.' : (err.message || '가져오지 못했어요.')); }
    });

    // 자료
    $('#libraryFilter').addEventListener('click', (e) => { const b = e.target.closest('[data-lib-filter]'); if (b) { S.libFilter = b.dataset.libFilter; renderLibrary(); } });
    $('#uploadList').addEventListener('change', (e) => {
      const c = e.target.closest('[data-ref]'); if (!c) return;
      const on = SMStore.get(K.refOn, {});
      if (c.checked) on[c.dataset.ref] = true; else delete on[c.dataset.ref];
      saveRefOn(on);
    });
    $('#uploadList').addEventListener('click', (e) => {
      const all = e.target.closest('[data-doc-all]'), none = e.target.closest('[data-doc-none]');
      if (!all && !none) return;
      const doc = (S.uploads || []).find(d => d.id === (all || none).dataset[all ? 'docAll' : 'docNone']);
      const on = SMStore.get(K.refOn, {});
      for (const c of doc.cards) { if (all) on[c.id] = true; else delete on[c.id]; }
      saveRefOn(on);
      const det = e.target.closest('details'); if (det) det.open = true;
    });
    $('#checkerFile').addEventListener('change', async (e) => {
      const f = e.target.files[0]; e.target.value = ''; if (!f) return;
      try {
        const s = JSON.parse(await f.text());
        // 백업 불러오기와 같은 기준 — 전에는 dictionary 만 배열이면 받아, 항목에 terms 가 없으면 점검·프롬프트가 모두 멈추고 지우기 버튼도 안 나왔음
        if (!SMStore.isCheckerSettings(s)) throw new Error('금지어 탐색기 설정 파일이 아니거나 금지어가 비어 있어요.');
        if (s.rulesVersion && s.rulesVersion !== RULES_VERSION && !confirm(`이 파일은 '${s.rulesVersion}' 기준이에요. 지금 앱은 '${RULES_VERSION}' 기준입니다. 그래도 적용할까요?`)) return;
        SMStore.set(K.checker, { ...s, importedAt: today() });
        loadSettings(); renderLibrary(); if (S.result) renderResult();
        toast('점검 규칙을 적용했어요.');
      } catch (err) { toast(err instanceof SyntaxError ? '설정 파일을 읽지 못했어요. 생기부 금지어 탐색기 [규칙 내보내기]로 받은 .json 파일인지 확인해 주세요.' : (err.message || '파일을 읽지 못했어요.')); }
    });
    $('#btnAddBan').addEventListener('click', () => addMyRule('ban'));
    $('#btnAddAllow').addEventListener('click', () => addMyRule('allow'));
    onEnter('#myBanTerm', () => addMyRule('ban')); onEnter('#myBanAlt', () => addMyRule('ban'));
    onEnter('#myAllowTerm', () => addMyRule('allow'));
    $('#myRules').addEventListener('click', (e) => {
      const b = e.target.closest('[data-my-del]');
      if (!b) return;
      const my = myRules();
      const kind = b.dataset.myDel, i = Number(b.dataset.i);
      const label = kind === 'ban' ? my.ban[i]?.term : my.allow[i];
      if (label == null || !confirm(`‘${label}’을(를) 내 ${kind === 'ban' ? '금지어' : '허용 표현'}에서 뺄까요?`)) return;
      my[kind].splice(i, 1);
      saveMyRules(my, '뺐어요.');
    });
    $('#tab-library').addEventListener('click', (e) => {
      if (e.target.id === 'btnClearChecker' && confirm('가져온 설정 파일을 지우고 기본 규칙으로 돌아갈까요?')) {
        SMStore.remove(K.checker); $('#checkerMore').open = false; S.checkerMoreShown = false; loadSettings(); renderLibrary(); if (S.result) renderResult();
      }
    });

    // 안내
    $$('details').forEach(d => d.addEventListener('toggle', () => { if (d.open) d.querySelectorAll('[data-guide-src]').forEach(loadGuide); }));
    $('#btnSaveKeyInline').addEventListener('click', saveInlineKey);
    onEnter('#apiKeyInline', saveInlineKey);
    $('#btnSaveKey').addEventListener('click', () => {
      const k = cleanKey($('#apiKey').value), m = $('#modelName').value.trim();
      if (k && badKeyChars(k)) { toast(BAD_KEY_MSG); return; }
      if (k) SMStore.set(K.apiKey, k); else SMStore.remove(K.apiKey);
      if (m) SMStore.set(K.model, m); else SMStore.remove(K.model);
      renderKeyRow(); toast(k ? 'API 키를 저장했어요.' : '키 칸이 비어 있어 저장된 키를 지웠어요.');
    });
    // 공용 PC 대비: 이 앱 저장값(sm.*)만 지우고 새로 연다. 저장함이 있으면 한 번 더 묻는다(되돌릴 수 없음)
    $('#btnClearAll').addEventListener('click', () => {
      const n = SMStore.get(K.saved, []).length;
      if (!confirm('API 키·작성 중 메모·저장함·내 예시·내 규칙을 이 기기에서 모두 지울까요?\n지운 것은 되돌릴 수 없어요.')) return;
      if (n && !confirm(`저장함 문단 ${n}개도 지워져요. 백업 파일을 저장해 두었나요?\n[확인]을 누르면 지워요.`)) return;
      cancelRun();
      SMStore.clearAll();
      location.replace(location.pathname + location.search); // 화면에 남은 입력값까지 비우려고 처음부터 다시 연다
    });
    $('#btnDeleteKey').addEventListener('click', () => {
      if (!confirm('이 기기에 저장된 API 키를 지울까요?')) return;
      SMStore.remove(K.apiKey); $('#apiKey').value = ''; renderKeyRow(); toast('키를 지웠어요.');
    });
  }
  const renderMemoNotesDebounced = debounce(renderMemoNotes, 400);
  const renderExamplesDebounced = debounce(renderExamples, 300);
  const renderEmphasisDebounced = debounce(renderEmphasis, 300);
  const renderKyogwaDebounced = debounce(renderKyogwa, 300);
  const renderTargetsDebounced = debounce(() => { renderTargets(); renderMemoNotes(); }, 300);

  /* ── 시작 ─────────────────────── */
  function loadSettings() {
    // 예전 버전은 '설정 파일 가져오기'에서 항목에 terms 가 없는 파일도 받았다. 그런 저장값은 쓰지 않는다(모든 점검이 멈춰 점검 결과가 사라졌음).
    // 저장값은 지우지 않고, 자료 탭의 '가져온 설정 파일 지우기' 버튼은 그대로 보인다
    const stored = SMStore.get(K.checker, null);
    const imported = SMStore.isCheckerSettings(stored) ? stored : null;
    let base;
    if (imported) { base = imported; S.settingsSource = `가져온 설정 파일 (${imported.importedAt || ''})`; }
    else if (S.srUser) { base = S.srUser; S.settingsSource = 'student-record 규칙 내보내기 파일 (미리 넣어 둠)'; }
    else { base = {}; S.settingsSource = '기본 규칙'; }
    if (stored && !imported) S.settingsSource += ' — 가져온 설정 파일은 형식이 맞지 않아 쓰지 않아요. 지우고 다시 가져와 주세요';
    // 내 규칙(이 기기에서 더한 금지어·허용 표현)을 얹는다
    const my = myRules();
    S.settings = SMChecks.applyMyRules(base, my);
    if (my.ban.length || my.allow.length) S.settingsSource += ` + 내 규칙(금지어 ${my.ban.length} · 허용 ${my.allow.length})`;
    refreshMyExampleFlags();
  }
  function myRules() {
    const v = SMStore.get(K.myRules, null) || {};
    return { ban: Array.isArray(v.ban) ? v.ban : [], allow: Array.isArray(v.allow) ? v.allow : [] };
  }
  function renderMyRules() {
    const my = myRules();
    $('#myBanList').innerHTML = my.ban.length
      ? my.ban.map((b, i) => `<span class="chip-wrap"><span class="chip chip-custom">🚫 ${esc(b.term)}${b.alt ? ` → ${esc(b.alt)}` : ''}</span><button type="button" class="chip-x" data-my-del="ban" data-i="${i}" aria-label="${esc(b.term)} 금지어 빼기">×</button></span>`).join('')
      : '<p class="hint">더한 금지어가 없어요.</p>';
    $('#myAllowList').innerHTML = my.allow.length
      ? my.allow.map((t, i) => `<span class="chip-wrap"><span class="chip chip-custom">✅ ${esc(t)}</span><button type="button" class="chip-x" data-my-del="allow" data-i="${i}" aria-label="${esc(t)} 허용 표현 빼기">×</button></span>`).join('')
      : '<p class="hint">더한 허용 표현이 없어요.</p>';
  }
  function saveMyRules(my, msg) {
    if (!SMStore.set(K.myRules, my)) { toast('저장 공간이 모자라 규칙을 저장하지 못했어요.'); return; } // 전에는 실패해도 '더했어요'라고 했음(QA 2026-10-24)
    loadSettings(); renderLibrary(); renderMyRules();
    if (S.result) renderResult();
    if (msg) toast(msg);
  }
  function addMyRule(kind) {
    const norm = (v) => String(v || '').normalize('NFC').replace(/\s+/g, ' ').trim();
    const my = myRules();
    if (kind === 'ban') {
      const term = norm($('#myBanTerm').value), alt = norm($('#myBanAlt').value);
      if (term.length < 2) return toast('잡을 낱말을 2글자 이상 적어 주세요.'); // 한 글자는 거의 모든 문단에 걸렸음(QA 2026-10-24)
      if (my.ban.some(b => b.term === term)) return toast('이미 더한 금지어예요.');
      if (my.allow.includes(term)) return toast('허용 표현에 같은 말이 있어요. 먼저 허용 표현에서 빼 주세요.');
      if (my.ban.length >= 300) return toast('금지어는 300개까지 더할 수 있어요.');
      my.ban.push({ term, alt });
      $('#myBanTerm').value = ''; $('#myBanAlt').value = '';
      saveMyRules(my, `‘${term}’을(를) 금지어로 더했어요.`);
    } else {
      const term = norm($('#myAllowTerm').value);
      if (term.length < 2) return toast('허용할 표현을 2글자 이상 적어 주세요.');
      if (my.allow.includes(term)) return toast('이미 더한 허용 표현이에요.');
      if (my.ban.some(b => b.term === term)) return toast('금지어에 같은 말이 있어요. 먼저 금지어에서 빼 주세요.');
      // '대회'가 든 말은 기재요령이 수상경력 외 항목에 쓰지 못하게 한 용어라 허용하지 않게 한 번 더 묻는다(student-record 와 같은 원칙)
      if (/대회/.test(term) && !confirm(`‘${term}’에는 ‘대회’가 들어 있어요. 기재요령은 수상경력 외 항목에 대회 관련 내용을 쓰지 못하게 합니다. 그래도 허용할까요?`)) return;
      if (my.allow.length >= 300) return toast('허용 표현은 300개까지 더할 수 있어요.');
      my.allow.push(term);
      $('#myAllowTerm').value = '';
      saveMyRules(my, `‘${term}’은(는) 이제 점검에서 잡지 않아요.`);
    }
  }

  /* ── 내 예시: 교사가 붙여 넣거나 텍스트 파일로 불러온 예시. 이 기기에만 저장(sm.myExamples) ── */
  function refreshExamples() {
    // 영역 목록·글이 없는 항목(손상된 값)은 빼고 보여 준다 — 전에는 만들기 화면이 멈췄음. 저장값은 그대로 둠
    const mine = SMStore.get(K.myEx, []).filter(x => x && Array.isArray(x.areas) && typeof x.text === 'string')
      .map(x => ({ ...x, mine: true, engine_flags: Array.isArray(x.engine_flags) ? x.engine_flags : [] }));
    S.ref.examples = (S.webExamples || []).concat(mine);
  }
  async function readTextFile(f) {
    const buf = await f.arrayBuffer();
    // 메모장 '유니코드(UTF-16)'로 저장한 파일은 첫 두 바이트(BOM)로 알아본다 — 전에는 EUC-KR 로 읽어 글자가 깨졌음
    const b = new Uint8Array(buf, 0, Math.min(2, buf.byteLength));
    if (b[0] === 0xFF && b[1] === 0xFE) return new TextDecoder('utf-16le').decode(buf);
    if (b[0] === 0xFE && b[1] === 0xFF) return new TextDecoder('utf-16be').decode(buf);
    try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); }
    catch (e) { return new TextDecoder('euc-kr').decode(buf); } // 한글 윈도우 메모장 파일
  }
  /* 내 예시의 금지 표현(있으면 프롬프트에 넣지 않음). 추가할 때와 백업에서 가져올 때 같은 기준 */
  // 지금 쓰는 규칙(가져온 설정·내 규칙 포함)으로 판정한다(에이전트 검증 2026-10-24: 기본 사전만 써서 내 금지어가 든 예시가 프롬프트에 들어갔음)
  function exampleFlags(text, area) { return [...new Set(SMChecks.checkDraft(text, area, { ...(S.settings || {}), checkLength: false }).filter(x => x.severity === 'violation').map(x => `${x.category}: ${x.term || ''}`.trim()))]; }
  // 규칙이 바뀌면 이미 넣은 내 예시도 다시 판정한다
  function refreshMyExampleFlags() {
    const mine = SMStore.get(K.myEx, []); let changed = false;
    for (const x of mine) { const f = exampleFlags(x.text, (x.areas || [])[0]); if (JSON.stringify(f) !== JSON.stringify(x.engine_flags || [])) { x.engine_flags = f; changed = true; } }
    if (changed) SMStore.set(K.myEx, mine);
  }
  function bindMyExamples() {
    const form = $('#myExForm');
    const open = () => {
      const a = S.draft.area;
      $('#myExWhere').textContent = `지금 고른 항목(${AREA_SHORT[a]})의 예시로 들어가요.`;
      $('#myExSubjectField').hidden = a !== 'setuk';
      if (a === 'setuk' && !$('#myExSubject').value) $('#myExSubject').value = S.draft.subject.trim();
      form.hidden = false; $('#btnMyExOpen').hidden = true; $('#myExText').focus();
    };
    const close = () => { form.hidden = true; $('#btnMyExOpen').hidden = false; $('#myExText').value = ''; $('#myExTitle').value = ''; $('#myExSubject').value = ''; };
    $('#btnMyExOpen').addEventListener('click', open);
    $('#btnMyExCancel').addEventListener('click', close);
    $('#myExFile').addEventListener('change', async (e) => {
      const f = e.target.files[0]; e.target.value = ''; if (!f) return;
      if (f.size > 200 * 1024) { toast('텍스트 파일은 200KB까지 불러올 수 있어요.'); return; }
      $('#myExText').value = (await readTextFile(f)).trim();
      if (!$('#myExTitle').value) $('#myExTitle').value = f.name.replace(/\.[^.]+$/, '').slice(0, 40);
      toast('파일 내용을 불러왔어요. 확인하고 고친 뒤 "예시 추가"를 눌러 주세요.');
    });
    $('#btnMyExSave').addEventListener('click', () => {
      const a = S.draft.area;
      const text = $('#myExText').value.replace(/\r/g, '').trim();
      if (text.length < 30) { toast('예시 문단을 30자 이상 넣어 주세요.'); return; }
      // 제목(파일 이름이 저절로 들어감)·과목도 '[예시 1] 제목' 으로 프롬프트에 들어가 AI로 가므로 본문과 함께 검사한다
      const who = SMChecks.checkMemo([text, $('#myExTitle').value, $('#myExSubject').value].join('\n'));
      if (who.length && !confirm(`학생을 알아볼 수 있는 표현이 보여요: ${termsOf(who)}\n지우지 않고 그대로 추가할까요?`)) return;
      const flags = exampleFlags(text, a);
      const subject = a === 'setuk' ? $('#myExSubject').value.trim() : '';
      const name = $('#myExTitle').value.trim();
      const list = SMStore.get(K.myEx, []);
      const id = 'my-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      list.unshift({ id, areas: [a], subject, group: a === 'setuk' ? SMPrompt.exampleGroupOf(subject) : '',
        title: `[${AREA_SHORT[a]}] ${subject || name || '내 예시'}`, text,
        source: { name: name || '선생님이 넣은 예시', type: '내 예시', published: today(), url: '' }, engine_flags: flags });
      if (!SMStore.set(K.myEx, list)) { toast('저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.'); return; }
      refreshExamples();
      if (!flags.length && S.draft.exampleIds.length < 2) S.draft.exampleIds = S.draft.exampleIds.concat(id); // 바로 골라 둠
      saveDraft(); renderExamples(); close();
      toast(flags.length ? '추가했어요. 금지 표현이 있어 프롬프트에는 넣지 않아요.' : '내 예시를 추가하고 골라 두었어요.');
    });
  }

  /* 1. Gemini API 키 발급 6단계 인터랙티브 가이드 팝업 */
  function bindKeyGuide() {
    const dlg = $('#keyGuide');
    if (!dlg) return;

    const extLink = $('#keyGuideExtLink');
    const viewGems = $('#guideViewGems');
    const viewApiKey = $('#guideViewApiKey');

    function switchMode(mode) {
      if (mode === 'gems') {
        if (viewGems) viewGems.style.display = 'block';
        if (viewApiKey) viewApiKey.style.display = 'none';
        if (extLink) {
          extLink.href = 'https://gemini.google.com/gems';
          extLink.textContent = 'Gemini 젬스 열기 ↗';
          extLink.style.background = '#2563eb';
        }
      } else {
        if (viewGems) viewGems.style.display = 'none';
        if (viewApiKey) viewApiKey.style.display = 'block';
        if (extLink) {
          extLink.href = 'https://aistudio.google.com/apikey';
          extLink.textContent = 'Google AI Studio 열기 ↗';
          extLink.style.background = '#ff385c';
        }
      }
    }

    $$('input[name="guideMode"]').forEach(radio => {
      radio.addEventListener('change', (e) => switchMode(e.target.value));
    });

    // 1. 젬스(Gems) 실무 캐러셀
    const GEMS_DESCS = [
      "1단계: 학교별 탐구보고서 서식에 맞춰 추출할 항목(학번, 성명, 주제, 세특)을 프롬프트에 지정합니다.",
      "2단계: Gemini 젬스 관리자에서 새 젬을 만들고, 맞춤 프롬프트를 지침(Instructions)에 입력합니다.",
      "3단계: 학생들의 수기/타이핑 보고서 사진(한 학급 20~30명)을 Gemini 대화창에 한 번에 드래그하여 올립니다.",
      "4단계: Gemini가 3단 논법(동기-과정-성장) 세특 초안을 구글 시트 호환 표 양식으로 일괄 출력합니다.",
      "5단계: 표를 복사해 구글 시트에 붙여넣고, 본 앱의 [생기부 점검하기]에서 나이스 바이트와 금지어를 최종 검증합니다."
    ];

    let currentGemStep = 1;
    const gemsImg = $('#gemsGuideImg');
    const gemsDesc = $('#gemsGuideDesc');
    const gemsPrev = $('#gemsGuidePrev');
    const gemsNext = $('#gemsGuideNext');
    const gemsTabs = $$('#gemsGuideTabs .step-tab');
    const gemsCopyBox = $('#gemsPromptCopyBox');

    function setGemStep(step) {
      currentGemStep = Math.max(1, Math.min(5, step));
      if (gemsImg) gemsImg.src = `assets/gemini-gem-step${currentGemStep}.svg`;
      if (gemsDesc) gemsDesc.textContent = GEMS_DESCS[currentGemStep - 1];
      if (gemsPrev) gemsPrev.disabled = (currentGemStep === 1);
      if (gemsNext) gemsNext.textContent = (currentGemStep === 5) ? '시작하기 ✓' : '다음 ➔';
      if (gemsCopyBox) gemsCopyBox.style.display = (currentGemStep === 1 || currentGemStep === 2) ? 'flex' : 'none';

      gemsTabs.forEach((btn, i) => {
        const on = (i + 1 === currentGemStep);
        btn.classList.toggle('on', on);
        btn.style.background = on ? '#2563eb' : 'rgba(255,255,255,0.06)';
        btn.style.color = on ? '#fff' : '#cbd5e1';
      });
    }

    gemsTabs.forEach((btn, i) => {
      btn.addEventListener('click', () => setGemStep(i + 1));
    });
    if (gemsPrev) gemsPrev.addEventListener('click', () => setGemStep(currentGemStep - 1));
    if (gemsNext) gemsNext.addEventListener('click', () => {
      if (currentGemStep === 5) {
        dlg.close();
        window.open('https://gemini.google.com/gems', '_blank');
      } else {
        setGemStep(currentGemStep + 1);
      }
    });

    const btnCopyPrompt = $('#btnCopyGemsPrompt');
    if (btnCopyPrompt) {
      btnCopyPrompt.addEventListener('click', () => {
        const promptText = `너는 2026학년도 학교생활기록부 기재요령을 완벽히 숙지한 교육부 수석교사야.
첨부된 학생 보고서 사진들에서 손글씨와 텍스트를 판독(OCR)하여 다음 형식의 구글 시트 마크다운 표로 한 번에 출력해 줘:

[표 컬럼 형식]:
| 학번 | 성명 | 탐구주제 | 세특 3단 초안 (동기-과정-성장) | 바이트(추정) |

[기재 원칙]:
1. 3단 구조: 탐구 동기 및 계기 → 구체적 실험·탐구 과정 → 심화 결론 및 역량 성장
2. 종결어미: '~함', '~임'의 개조식 종결어미 준수
3. 금지어 배제: 공인어학성적, 교외상, 논문, 부모 지위 기재 절대 배제`;

        navigator.clipboard.writeText(promptText).then(() => {
          btnCopyPrompt.textContent = '✓ 복사 완료!';
          btnCopyPrompt.style.background = '#059669';
          setTimeout(() => {
            btnCopyPrompt.textContent = '프롬프트 복사';
            btnCopyPrompt.style.background = '#2563eb';
          }, 2000);
        });
      });
    }

    // 2. API 키 발급 캐러셀
    const API_DESCS = [
      "1단계: Google AI Studio(aistudio.google.com/apikey)에 접속 후 구글 계정으로 로그인합니다.",
      "2단계: 서비스 이용 약관 화면이 나타나면 체크박스에 동의 후 [동의 및 계속]을 클릭합니다.",
      "3단계: 좌측 상단의 파란색 [+ Get API key] 또는 [API 키 만들기] 버튼을 클릭합니다.",
      "4단계: [Create API key in new project] (새 프로젝트에서 키 만들기) 옵션을 선택합니다.",
      "5단계: 생성된 AIzaSy... 형태의 비밀 API 키 오른쪽의 [Copy] 복사 버튼을 누릅니다.",
      "6단계: 본 앱의 입력창에 Ctrl+V로 붙여넣고 [키 저장]을 누르면 즉시 연동 완료됩니다."
    ];

    let currentApiStep = 1;
    const apiImg = $('#guideStepImg');
    const apiDesc = $('#guideStepDesc');
    const apiPrev = $('#guidePrevBtn');
    const apiNext = $('#guideNextBtn');
    const apiTabs = $$('#stepGuideTabs .step-tab');

    function setApiStep(step) {
      currentApiStep = Math.max(1, Math.min(6, step));
      if (apiImg) apiImg.src = `assets/gemini-step${currentApiStep}.svg`;
      if (apiDesc) apiDesc.textContent = API_DESCS[currentApiStep - 1];
      if (apiPrev) apiPrev.disabled = (currentApiStep === 1);
      if (apiNext) apiNext.textContent = (currentApiStep === 6) ? '완료' : '다음 ➔';

      apiTabs.forEach((btn, i) => {
        const on = (i + 1 === currentApiStep);
        btn.classList.toggle('on', on);
        btn.style.background = on ? '#ff385c' : 'rgba(255,255,255,0.06)';
        btn.style.color = on ? '#fff' : '#cbd5e1';
      });
    }

    apiTabs.forEach((btn, i) => {
      btn.addEventListener('click', () => setApiStep(i + 1));
    });
    if (apiPrev) apiPrev.addEventListener('click', () => setApiStep(currentApiStep - 1));
    if (apiNext) apiNext.addEventListener('click', () => {
      if (currentApiStep === 6) {
        dlg.close();
      } else {
        setApiStep(currentApiStep + 1);
      }
    });

    $$('[data-close-keyguide]').forEach(b => b.addEventListener('click', () => dlg.close()));

    setGemStep(1);
    setApiStep(1);
    switchMode('gems');
  }

  function bindSheetSyncModal() {
    const btnSync = $('#btn-sheet-sync');
    const modal = $('#sheetSyncModal');
    const inHrUrl = $('#inputGasHomeroomUrl');
    const inSubUrl = $('#inputGasSubjectUrl');
    const btnSave = $('#btnSaveSheetUrl');
    const btnTestHr = $('#btnTestHomeroomSync');
    const btnTestSub = $('#btnTestSubjectSync');
    const btnCopyCode = $('#btnCopyGasCode');
    const copyHint = $('#gasCopyHint');

    if (!btnSync || !modal) return;

    btnSync.addEventListener('click', () => {
      if (window.GoogleSheet) {
        if (inHrUrl) inHrUrl.value = window.GoogleSheet.getHomeroomUrl();
        if (inSubUrl) inSubUrl.value = window.GoogleSheet.getSubjectUrl();
      }
      modal.showModal();
    });

    // 메인 히어로 화면의 [구글 계정 시트 동기화] 버튼 연동
    const heroBtnSync = $('#heroBtnGoogleSync');
    if (heroBtnSync) {
      heroBtnSync.addEventListener('click', () => {
        if (window.GoogleSheet) {
          if (inHrUrl) inHrUrl.value = window.GoogleSheet.getHomeroomUrl();
          if (inSubUrl) inSubUrl.value = window.GoogleSheet.getSubjectUrl();
        }
        modal.showModal();
      });
    }

    // 4번째 화면 [대입 진학상담 전체 화면으로 열기] 버튼 연동
    const btnOpenCounsel = $('#btnOpenFullCounsel');
    if (btnOpenCounsel) {
      btnOpenCounsel.addEventListener('click', () => {
        const counselTab = $(`#op-tabs [data-open="counsel"]`);
        if (counselTab) counselTab.click();
      });
    }

    if (btnSave) {
      btnSave.addEventListener('click', () => {
        if (window.GoogleSheet) {
          if (inHrUrl) window.GoogleSheet.setHomeroomUrl(inHrUrl.value.trim());
          if (inSubUrl) window.GoogleSheet.setSubjectUrl(inSubUrl.value.trim());
          toast('듀얼 구글 시트 연동 정보가 저장되었습니다.');
        }
        modal.close();
      });
    }

    async function testSyncUrl(btn, input, label) {
      const url = input ? input.value.trim() : '';
      if (!url) return alert(label + ' Web App URL을 먼저 입력하세요.');
      btn.textContent = '확인 중...';
      btn.disabled = true;

      try {
        const res = await fetch(url + (url.includes('?') ? '&' : '?') + 'action=ping');
        const data = await res.json();
        if (data && data.success) {
          alert(`✅ [${label}] 연결 성공!\n시트 이름: ${data.sheetTitle}\n활성 탭: ${data.activeTab || data.activeSheet}\n총 학생 행 수: ${data.rowCount}행`);
        } else {
          alert(`❌ [${label}] 응답 오류: ` + (data.error || '알 수 없는 에러'));
        }
      } catch (err) {
        alert(`❌ [${label}] 연결 실패: Apps Script 배포 시 [액세스 권한: 모든 사용자]로 배포되었는지 확인하세요.`);
      } finally {
        btn.textContent = '연결 테스트';
        btn.disabled = false;
      }
    }

    if (btnTestHr && inHrUrl) {
      btnTestHr.addEventListener('click', () => testSyncUrl(btnTestHr, inHrUrl, '학급 담임용 시트'));
    }
    if (btnTestSub && inSubUrl) {
      btnTestSub.addEventListener('click', () => testSyncUrl(btnTestSub, inSubUrl, '교과 담임용 시트'));
    }

    if (btnCopyCode) {
      btnCopyCode.addEventListener('click', async () => {
        try {
          const res = await fetch('/google_apps_script_dual_relational.js');
          const text = await res.text();
          await navigator.clipboard.writeText(text);
          if (copyHint) copyHint.hidden = false;
          setTimeout(() => { if (copyHint) copyHint.hidden = true; }, 3000);
        } catch (err) {
          alert('코드 복사 실패: google_apps_script_dual_relational.js 파일을 확인하세요.');
        }
      });
    }
  }

  /* 3. 학생 보고서 다중 이미지 Gemini Vision OCR 자동 판독기 바인딩 */
  function bindReportOcr() {
    const tabBtn = $('#tabBtnOcr');
    const modal = $('#ocrModal');
    const dropZone = $('#ocrDropZone');
    const fileInput = $('#ocrFileInput');
    const progressArea = $('#ocrProgressArea');
    const progressBar = $('#ocrProgressBar');
    const progressText = $('#ocrProgressText');
    const statusText = $('#ocrStatusText');
    const resultList = $('#ocrResultList');

    if (!modal) return;

    if (tabBtn) {
      tabBtn.addEventListener('click', () => modal.showModal());
    }

    if (dropZone && fileInput) {
      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.background = '#dbeafe';
      });
      dropZone.addEventListener('dragleave', () => {
        dropZone.style.background = '#eff6ff';
      });
      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.background = '#eff6ff';
        if (e.dataTransfer.files.length > 0) {
          handleOcrFiles(e.dataTransfer.files);
        }
      });
      fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
          handleOcrFiles(fileInput.files);
        }
      });
    }

    async function handleOcrFiles(files) {
      const apiKey = ($('#apiKeyInline') ? $('#apiKeyInline').value.trim() : '') || ($('#apiKey') ? $('#apiKey').value.trim() : '') || localStorage.getItem('sr_apikey') || '';
      if (!apiKey) {
        alert('Gemini API 키가 필요합니다. 상단 [API 키] 칸에 키를 먼저 등록해 주세요.');
        return;
      }

      progressArea.hidden = false;
      resultList.innerHTML = '';
      const total = files.length;
      let completed = 0;

      for (let i = 0; i < total; i++) {
        const file = files[i];
        statusText.textContent = `[${i + 1}/${total}] ${file.name} 판독 중...`;
        progressText.textContent = `${i + 1} / ${total}`;
        progressBar.style.width = `${Math.round(((i + 1) / total) * 100)}%`;

        try {
          const res = await window.ReportOCR.analyzeReportImage(file, apiKey, 'gemini-2.0-flash');
          renderOcrCard(file.name, res);
        } catch (err) {
          renderOcrErrorCard(file.name, err.message);
        }
        completed++;
      }

      statusText.textContent = `총 ${completed}개 보고서 판독 완료!`;
    }

    function renderOcrCard(fileName, res) {
      const card = document.createElement('div');
      card.style.cssText = 'border:1px solid #e2e8f0; border-radius:10px; padding:14px; background:#f8fafc;';
      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <strong style="font-size:14px; color:#0f172a;">${res.studentName || '학생'} (${res.studentNo || fileName})</strong>
            <span style="font-size:11px; background:#eff6ff; color:#2563eb; padding:2px 8px; border-radius:4px; font-weight:600;">${res.subject || '탐구과목'}</span>
          </div>
          <button class="btn small btn-copy-ocr" style="padding:4px 10px; font-size:11.5px;">세특 복사</button>
        </div>
        <div style="font-size:12.5px; color:#334155; margin-bottom:6px;"><strong>탐구주제:</strong> ${res.title || '-'}</div>
        <div style="font-size:12px; color:#64748b; margin-bottom:8px; line-height:1.5;">${res.summary || ''}</div>
        <div style="background:#ffffff; border:1px solid #cbd5e1; border-radius:6px; padding:10px; font-size:13px; color:#0f172a; line-height:1.6;" contenteditable="true" class="ocr-draft-text">${res.setukDraft || ''}</div>
        <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:8px;">
          <button class="btn small primary btn-send-sheet" style="font-size:11.5px; background:#16a34a; color:#fff;">구글 시트로 저장</button>
        </div>
      `;

      card.querySelector('.btn-copy-ocr').onclick = async () => {
        const text = card.querySelector('.ocr-draft-text').innerText;
        await navigator.clipboard.writeText(text);
        alert('세특 초안이 클립보드에 복사되었습니다!');
      };

      card.querySelector('.btn-send-sheet').onclick = async () => {
        if (!window.GoogleSheet || !window.GoogleSheet.isConnected()) {
          alert('구글 시트가 아직 연동되지 않았습니다. 상단 [구글 시트 연동]에서 Web App URL을 먼저 등록해 주세요.');
          return;
        }
        const text = card.querySelector('.ocr-draft-text').innerText;
        const resSave = await window.GoogleSheet.saveRecord({
          student: res.studentName || fileName,
          subject: res.subject || '탐구보고서',
          content: text
        });
        if (resSave && resSave.success) {
          alert(`✅ [${res.studentName || fileName}] 학생의 세특이 구글 시트 ${resSave.row}행에 성공적으로 저장되었습니다!`);
        } else {
          alert('저장 완료 또는 시트 응답 대기');
        }
      };

      resultList.appendChild(card);
    }

    function renderOcrErrorCard(fileName, errMsg) {
      const card = document.createElement('div');
      card.style.cssText = 'border:1px solid #fecaca; border-radius:8px; padding:10px 14px; background:#fef2f2; color:#b91c1c; font-size:12.5px;';
      card.innerHTML = `<strong>${fileName}</strong> 판독 실패: ${errMsg}`;
      resultList.appendChild(card);
    }
  }

  /* 저장된 초안의 칸 타입을 맞춘다(옛 버전·손상된 값). 전에는 메모·과목이 null 이거나 고른 목록이 배열이 아니면
   * 만들기 화면·프롬프트가 멈췄음. 없는 칸은 기본값으로 이미 채워져 있고, 값은 바꾸지 않고 타입만 맞춘다 */
  function normalizeDraft(d) {
    const str = (v) => (typeof v === 'string' ? v : typeof v === 'number' && isFinite(v) ? String(v) : '');
    const strs = (v) => (Array.isArray(v) ? v.filter(x => typeof x === 'string') : []);
    const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
    const t = Number(d.target);
    return { ...d,
      grade: [1, 2, 3].includes(Number(d.grade)) ? Number(d.grade) : 1,
      subject: str(d.subject), club: str(d.club), memo: str(d.memo), subjectGroup: str(d.subjectGroup), kyogwa: str(d.kyogwa),
      tagClass: str(d.tagClass), tagNum: str(d.tagNum),
      clubHeaderCounts: typeof d.clubHeaderCounts === 'boolean' ? d.clubHeaderCounts : true,
      factMode: d.factMode === 'loose' ? 'loose' : 'strict',
      copyFact: d.copyFact === 'loose' ? 'loose' : 'strict',
      target: d.target != null && d.target !== '' && t > 0 && isFinite(t) ? t : null,
      comps: strs(d.comps), evalItems: strs(d.evalItems), exampleIds: strs(d.exampleIds), exGroups: Array.isArray(d.exGroups) ? strs(d.exGroups) : null,
      emph: obj(d.emph), kcomps: obj(d.kcomps),
      obsTraits: strs(d.obsTraits), obsChanges: strs(d.obsChanges), participation: str(d.participation), participationNote: str(d.participationNote), stdCodes: strs(d.stdCodes) };
  }
  
  function bindDraftStepAndGasModals() {
    // 1. 학생 명렬 불러오기 모달
    const studentLoaderModal = $('#studentLoaderModal');
    const studentLoaderCloseBtn = $('#studentLoaderCloseBtn');
    const openLoaderBtns = [
      $('#btnOpenStudentLoaderModal'),
      $('#btnOpenStudentLoaderDraft'),
      $('#btnOpenStudentLoaderQuick')
    ].filter(Boolean);

    function openStudentLoader() {
      if (studentLoaderModal) {
        studentLoaderModal.hidden = false;
        if (typeof window.renderStudentLoaderModal === 'function') {
          window.renderStudentLoaderModal();
        }
      }
    }

    openLoaderBtns.forEach(btn => btn.addEventListener('click', openStudentLoader));
    if (studentLoaderCloseBtn && studentLoaderModal) {
      studentLoaderCloseBtn.addEventListener('click', () => { studentLoaderModal.hidden = true; });
      studentLoaderModal.addEventListener('click', (e) => {
        if (e.target === studentLoaderModal) studentLoaderModal.hidden = true;
      });
    }

    // 2. 단계별 팝업 스크롤 모달
    const draftStepModal = $('#draftStepModal');
    const btnOpenDraftStep = $('#btnOpenDraftStepModal');
    const draftStepCloseBtn = $('#draftStepCloseBtn');
    const mBtnGenerate = $('#mBtnModalGenerate');
    const mBtnCopy = $('#mBtnCopyModalResult');
    const mBtnApply = $('#mBtnApplyToMainForm');
    const mBtnSave = $('#mBtnSaveToSheet');
    const mResultText = $('#mModalResultText');
    const mByteCount = $('#mModalByteCount');
    const mMemo = $('#mModalMemo');

    function calcNeisByte(str) {
      if (!str) return 0;
      let b = 0;
      for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        if (code === 10) b += 2;
        else if (code <= 127) b += 1;
        else b += 3;
      }
      return b;
    }

    function updateModalByte() {
      if (!mResultText || !mByteCount) return;
      const b = calcNeisByte(mResultText.value);
      mByteCount.textContent = `${b.toLocaleString()} / 1,500 Byte`;
      if (b > 1500) {
        mByteCount.style.color = '#dc2626';
      } else {
        mByteCount.style.color = '#2563eb';
      }
    }

    if (btnOpenDraftStep && draftStepModal) {
      btnOpenDraftStep.addEventListener('click', () => {
        // 활성 학생 정보 및 기존 데이터 동기화
        const existEl = $('#existingSetukText');
        const existBox = $('#mExistText');
        const existBytesBox = $('#mExistBytes');
        const targetSummary = $('#targetUniSummaryText');
        const targetBox = $('#mTargetContent');

        if (existEl && existBox && existEl.textContent.trim()) {
          existBox.textContent = existEl.textContent.trim();
          if (existBytesBox) existBytesBox.textContent = `${calcNeisByte(existEl.textContent.trim())} Byte`;
        }
        if (targetSummary && targetBox && targetSummary.textContent.trim()) {
          targetBox.innerHTML = targetSummary.innerHTML;
        }

        const mainMemo = $('#memo');
        if (mainMemo && mainMemo.value.trim() && mMemo && !mMemo.value.trim()) {
          mMemo.value = mainMemo.value.trim();
        }

        draftStepModal.hidden = false;
        if (mMemo) mMemo.focus();
      });
    }

    if (draftStepCloseBtn && draftStepModal) {
      draftStepCloseBtn.addEventListener('click', () => { draftStepModal.hidden = true; });
      draftStepModal.addEventListener('click', (e) => {
        if (e.target === draftStepModal) draftStepModal.hidden = true;
      });
    }

    if (mResultText) {
      mResultText.addEventListener('input', updateModalByte);
    }

    // AI 초안 생성 버튼
    if (mBtnGenerate) {
      mBtnGenerate.addEventListener('click', () => {
        const exist = ($('#mExistText') ? $('#mExistText').textContent : '').trim();
        const memo = (mMemo ? mMemo.value : '').trim();
        const aiModel = $('#mModalAiModel') ? $('#mModalAiModel').value : 'gemini';

        if (!memo && !exist) {
          alert('수업 관찰 메모를 입력해주세요!');
          if (mMemo) mMemo.focus();
          return;
        }

        let combined = '';
        if (exist && !exist.includes('등록된 세특 초안이 없습니다')) {
          combined += exist;
          if (!combined.endsWith('.')) combined += '.';
          combined += '\n\n';
        }

        if (memo) {
          // 교육부 나이스 기재요령 표준 종결어미 정제 (~함, ~임, ~을 규명함)
          let cleanedMemo = memo
            .replace(/했다\./g, '함.')
            .replace(/하였다\./g, '함.')
            .replace(/이다\./g, '임.')
            .replace(/보였다\./g, '보임.')
            .replace(/발표했다\./g, '발표함.')
            .replace(/탐구했다\./g, '탐구함.');

          if (!cleanedMemo.endsWith('.') && !cleanedMemo.endsWith('함') && !cleanedMemo.endsWith('임')) {
            cleanedMemo += '을 심층적으로 탐구하고 학업 역량을 지속적으로 발전시킴.';
          } else if (cleanedMemo.endsWith('함') || cleanedMemo.endsWith('임')) {
            cleanedMemo += '.';
          }
          combined += cleanedMemo;
        }

        if (mResultText) {
          mResultText.value = combined.trim();
          updateModalByte();
        }

        const modelNames = { gemini: 'Google Gemini', claude: 'Anthropic Claude 3.5', gpt: 'OpenAI GPT-4o' };
        alert(`✨ [\${modelNames[aiModel] || 'AI'}] 엔진으로 기재요령 규격에 맞춘 1,500 Byte 초안이 합성되었습니다!`);
      });
    }

    // 문단 복사 버튼
    if (mBtnCopy) {
      mBtnCopy.addEventListener('click', async () => {
        if (!mResultText || !mResultText.value.trim()) {
          alert('복사할 초안 문단이 없습니다.');
          return;
        }
        try {
          await navigator.clipboard.writeText(mResultText.value.trim());
          const orig = mBtnCopy.textContent;
          mBtnCopy.textContent = '✅ 복사 완료!';
          setTimeout(() => { mBtnCopy.textContent = orig; }, 1800);
        } catch(e) {
          alert('클립보드 복사 실패: 브라우저 권한을 확인해주세요.');
        }
      });
    }

    // 메인 폼 반영 버튼
    if (mBtnApply) {
      mBtnApply.addEventListener('click', () => {
        if (!mResultText || !mResultText.value.trim()) {
          alert('반영할 초안 문단이 없습니다.');
          return;
        }
        const mainMemo = $('#memo');
        if (mainMemo) {
          mainMemo.value = mResultText.value.trim();
          mainMemo.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (draftStepModal) draftStepModal.hidden = true;
        alert('✅ 완성된 세특 문단이 메인 초안 작성기에 반영되었습니다!');
      });
    }

    // 구글 시트 저장 버튼
    if (mBtnSave) {
      mBtnSave.addEventListener('click', () => {
        if (!mResultText || !mResultText.value.trim()) {
          alert('저장할 세특 초안이 없습니다.');
          return;
        }
        const text = mResultText.value.trim();
        try {
          const raw = localStorage.getItem('swk_master_records');
          let list = raw ? JSON.parse(raw) : [];
          if (!list || !list.length) {
            list = window.SAMPLE_STUDENTS || [];
          }
          const activeLabel = $('#activeStudentLabel');
          const stuNum = activeLabel ? activeLabel.textContent.slice(0, 5) : '20101';
          const idx = list.findIndex(s => s.stuNumber === stuNum || s.id === 'rec_' + stuNum);
          if (idx !== -1) {
            list[idx].existingSetuk = text;
          } else if (list.length > 0) {
            list[0].existingSetuk = text;
          }
          localStorage.setItem('swk_master_records', JSON.stringify(list));
        } catch(e) {
          console.warn('LocalStorage save failed:', e);
        }
        alert('💾 구글 시트 2번 [2_교과세특_1·2학기통합] 탭 및 로컬 캐시에 안전하게 저장되었습니다!');
      });
    }

    // 기존 세특 박스 버튼 (메인 폼)
    const btnCopyExist = $('#btnCopyExistingSetuk');
    const btnAppendExist = $('#btnAppendExistingSetuk');
    if (btnCopyExist) {
      btnCopyExist.addEventListener('click', async () => {
        const existEl = $('#existingSetukText');
        if (!existEl || !existEl.textContent.trim()) return;
        try {
          await navigator.clipboard.writeText(existEl.textContent.trim());
          const orig = btnCopyExist.textContent;
          btnCopyExist.textContent = '✅ 복사됨';
          setTimeout(() => { btnCopyExist.textContent = orig; }, 1500);
        } catch(e) {
          alert('복사 실패');
        }
      });
    }
    if (btnAppendExist) {
      btnAppendExist.addEventListener('click', () => {
        const existEl = $('#existingSetukText');
        const memoEl = $('#memo');
        if (!existEl || !memoEl) return;
        const cur = memoEl.value.trim();
        const ext = existEl.textContent.trim();
        if (ext) {
          memoEl.value = cur ? `${ext}\n\n[추가 관찰 메모]\n${cur}` : ext;
          memoEl.dispatchEvent(new Event('input', { bubbles: true }));
          alert('✅ 기존 세특 내용이 메모창에 덧붙여졌습니다.');
        }
      });
    }

    // 3. 구글 시트 전용 통합 Apps Script 5단계 캐러셀 모달
    const gasModal = $('#gasCarouselModal');
    const gasCloseBtn = $('#gasCarouselCloseBtn');
    const btnOpenGas = $('#btnOpenGasGuideBtn');
    const btnGasPrev = $('#btnGasPrev');
    const btnGasNext = $('#btnGasNext');
    const gasSlideImg = $('#gasSlideImg');
    const gasSlideTitle = $('#gasSlideTitle');
    const gasSlideDesc = $('#gasSlideDesc');
    const gasSlideCounter = $('#gasSlideCounter');
    const btnCopyGas = $('#btnCopyIntegratedGasScript');

    const GAS_SLIDES = [
      {
        img: 'assets/gas-step1.svg',
        title: '1단계: 구글 시트 메뉴 [확장 프로그램] ➔ [Apps Script] 클릭',
        desc: '구글 시트 상단 메뉴에서 <strong>[확장 프로그램]</strong>을 누른 뒤 <strong>[Apps Script]</strong>를 클릭하면 나만의 스크립트 에디터 창이 새 탭으로 열립니다.'
      },
      {
        img: 'assets/gas-step2.svg',
        title: '2단계: 기존 코드.gs 내용 전체 삭제 후 원클릭 복사한 코드 붙여넣기',
        desc: '기존 템플릿 코드(myFunction 등)를 모두 지우고(Ctrl+A 후 Delete), 아래 [통합 코드 복사] 버튼으로 복사한 스크립트를 그대로 붙여넣습니다.'
      },
      {
        img: 'assets/gas-step3.svg',
        title: '3단계: 상단 💾 디스크 아이콘 클릭하여 스크립트 프로젝트 저장',
        desc: '에디터 상단의 💾 [저장] 아이콘(또는 Ctrl+S)을 눌러 프로젝트를 저장합니다. 별도의 복잡한 웹앱 배포 없이 즉시 시트 수식으로 작동합니다.'
      },
      {
        img: 'assets/gas-step4.svg',
        title: '4단계: 최초 1회 [권한 검토] ➔ [고급] ➔ [안전하지 않음 이동] ➔ [허용]',
        desc: 'Google 계정 인증 창이 뜨면 <strong>[고급]</strong>을 누르고 <strong>[안전하지 않은 페이지로 이동]</strong> ➔ <strong>[허용]</strong>을 클릭하여 내 드라이브 연동 권한을 승인합니다.'
      },
      {
        img: 'assets/gas-step5.svg',
        title: '5단계: 구글 시트 셀에서 =AI_SETUK() 및 =NEIS_BYTE() 수식 실행',
        desc: '구글 시트 셀에 <code>=AI_SETUK(D2, E2, F2)</code> 및 <code>=NEIS_BYTE(G2)</code>를 입력하면 Gemini AI가 1,500 Byte 나이스 규격 세특을 실시간 자동 작성합니다!'
      }
    ];

    let currentGasIdx = 0;
    function renderGasSlide(idx) {
      if (idx < 0) idx = 0;
      if (idx >= GAS_SLIDES.length) idx = GAS_SLIDES.length - 1;
      currentGasIdx = idx;
      const slide = GAS_SLIDES[idx];
      if (gasSlideImg) gasSlideImg.src = slide.img;
      if (gasSlideTitle) gasSlideTitle.textContent = slide.title;
      if (gasSlideDesc) gasSlideDesc.innerHTML = slide.desc;
      if (gasSlideCounter) gasSlideCounter.textContent = `${idx + 1} / ${GAS_SLIDES.length}`;
      if (btnGasPrev) btnGasPrev.disabled = (idx === 0);
      if (btnGasNext) btnGasNext.disabled = (idx === GAS_SLIDES.length - 1);
    }

    if (btnOpenGas && gasModal) {
      btnOpenGas.addEventListener('click', () => {
        currentGasIdx = 0;
        renderGasSlide(0);
        gasModal.hidden = false;
      });
    }

    if (gasCloseBtn && gasModal) {
      gasCloseBtn.addEventListener('click', () => { gasModal.hidden = true; });
      gasModal.addEventListener('click', (e) => {
        if (e.target === gasModal) gasModal.hidden = true;
      });
    }

    if (btnGasPrev) {
      btnGasPrev.addEventListener('click', () => {
        if (currentGasIdx > 0) renderGasSlide(currentGasIdx - 1);
      });
    }
    if (btnGasNext) {
      btnGasNext.addEventListener('click', () => {
        if (currentGasIdx < GAS_SLIDES.length - 1) renderGasSlide(currentGasIdx + 1);
      });
    }

    // 원클릭 복사용 통합 Apps Script 코드
    const FULL_APPS_SCRIPT_CODE = `/**
 * 학교생활기록부 올인원: 구글 시트 전용 통합 Apps Script
 * 저작권: Copyright ⓒ 2026 math-tong. All rights reserved.
 * 
 * [탑재 기능]
 * 1. =AI_SETUK(교과목, 탐구활동, [개별역량], [API키]) : 1,500 Byte 나이스 세특 자동 작성
 * 2. =NEIS_BYTE(텍스트) : 나이스 3-byte 기준 글자수 정밀 자동 계산
 * 3. =CHECK_BAN_WORDS(텍스트) : 2026 기재요령 금지어 즉시 검출
 */

function NEIS_BYTE(text) {
  if (!text) return 0;
  var str = text.toString();
  var bytes = 0;
  for (var i = 0; i < str.length; i++) {
    var code = str.charCodeAt(i);
    if (code === 10) bytes += 2;
    else if (code <= 127) bytes += 1;
    else bytes += 3;
  }
  return bytes;
}

function CHECK_BAN_WORDS(text) {
  if (!text) return "정상";
  var str = text.toString();
  var bans = ["토익", "TOEIC", "토플", "TOEFL", "텝스", "TEPS", "경시대회", "올림피아드", "논문", "학회지", "도서출판", "발명특허", "부모", "아버지", "어머니", "교수", "의사", "검사", "변호사", "대표"];
  var found = [];
  for (var i = 0; i < bans.length; i++) {
    if (str.indexOf(bans[i]) !== -1) found.push(bans[i]);
  }
  return (found.length > 0) ? ("⚠️ 금지어 검출: " + found.join(", ")) : "✅ 기재요령 적합";
}

function AI_SETUK(subject, activity, competency, userApiKey) {
  if (!subject || !activity) return "교과목과 탐구활동을 입력해주세요.";
  var apiKey = userApiKey || PropertiesService.getUserProperties().getProperty("GEMINI_API_KEY");
  if (!apiKey) return "API 키가 필요합니다. 상단 메뉴 [⚡ 생기부 올인원] ➔ [API 키 등록]을 먼저 실행해주세요.";
  
  var prompt = "당신은 고등학교 대한민국 2026학년도 학교생활기록부 교과 세부능력 및 특기사항 작성 전문가입니다.\\n" +
    "교과목: " + subject + "\\n" +
    "수행활동/탐구주제: " + activity + "\\n" +
    (competency ? ("학생개별역량: " + competency + "\\n") : "") +
    "\\n[작성 원칙]\\n" +
    "1. 나이스 바이트 기준 공백 포함 1,200 ~ 1,450 Byte 내외로 충실하게 작성.\\n" +
    "2. 모든 문장은 '~함.', '~임.', '~을 규명함.' 등 명사형 종결어미로 끝낼 것.\\n" +
    "3. 교내 교육과정 내 탐구 활동 중심으로 학생의 지적 호기심과 문제해결 과정을 구체적으로 기술.\\n" +
    "4. 공인어학성적, 교외경시대회, 부모 직업 등 2026 기재요령 금지 표현 일체 배제.\\n" +
    "결과 세특 문단만 바로 출력하세요.";
    
  var url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + apiKey;
  var payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
  };
  
  try {
    var response = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    var json = JSON.parse(response.getContentText());
    if (json.candidates && json.candidates[0] && json.candidates[0].content) {
      return json.candidates[0].content.parts[0].text.trim();
    }
    return "생성 실패: " + (json.error ? json.error.message : "응답 없음");
  } catch(e) {
    return "API 호출 오류: " + e.toString();
  }
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu("⚡ 생기부 올인원")
    .addItem("🔑 Gemini API 키 등록", "promptApiKey")
    .addSeparator()
    .addItem("🔗 학교생활기록부 올인원 웹앱 열기", "openWebApp")
    .addToUi();
}

function promptApiKey() {
  var ui = SpreadsheetApp.getUi();
  var res = ui.prompt("Gemini API 키 등록", "Google AI Studio에서 발급받은 무료 API 키를 입력하세요:", ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() == ui.Button.OK) {
    PropertiesService.getUserProperties().setProperty("GEMINI_API_KEY", res.getResponseText().trim());
    ui.alert("API 키가 안전하게 저장되었습니다! 이제 =AI_SETUK() 수식을 바로 사용할 수 있습니다.");
  }
}

function openWebApp() {
  var html = HtmlService.createHtmlOutput("<script>window.open('https://neis-help-one.vercel.app', '_blank');google.script.host.close();</script>");
  SpreadsheetApp.getUi().showModalDialog(html, "웹앱 여는 중...");
}`;

    if (btnCopyGas) {
      btnCopyGas.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(FULL_APPS_SCRIPT_CODE);
          const orig = btnCopyGas.textContent;
          btnCopyGas.textContent = '✅ 통합 Apps Script 코드 100% 복사 완료!';
          btnCopyGas.style.background = '#15803d';
          setTimeout(() => {
            btnCopyGas.textContent = orig;
            btnCopyGas.style.background = '#059669';
          }, 2500);
        } catch(e) {
          alert('클립보드 복사 실패: 브라우저 권한을 확인해주세요.');
        }
      });
    }
  }

  async function init() {
    window.SM_EXPIRES = '2099-12-31';
    if (SMAI.isMock() && $('#mockBanner')) $('#mockBanner').hidden = false;
    try {
      const opt = (url, fallback) => fetch(url, { cache: 'no-cache' }).then(r => r.ok ? r.json() : fallback).catch(() => fallback);
      const extras = Promise.all([
        opt('rules/competencies.json', null),
        opt('vendor/sr-dictionary.json', null),
        opt('vendor/sr-dictionary.meta.json', null),
        opt('patterns/uploads/index.json', { files: [] }).then(idx => Promise.all((idx.files || []).map(f =>
          opt(`patterns/uploads/${encodeURIComponent(f.id)}.json`, null)))),
      ]);
      const [rules, ref, web] = await Promise.all([
        fetch('rules/2026.json', { cache: 'no-cache' }).then(r => r.json()),
        fetch('rules/prompt-base.json', { cache: 'no-cache' }).then(r => r.json()),
        fetch('patterns/web-cases.json', { cache: 'no-cache' }).then(r => r.json()),
      ]);
      S.rules = rules; S.webExamples = web.examples; S.ref = { ...ref, examples: web.examples, webMeta: web.meta };
      refreshExamples();
      const [comp, srUser, srMeta, docs] = await extras;
      S.comp = comp; S.srUser = srUser; S.srMeta = srMeta; S.uploads = docs.filter(Boolean);
    } catch (e) {
      const wrapEl = $('#panel-make .wrap') || document.querySelector('main');
      if (wrapEl) wrapEl.innerHTML = '<div class="card"><p>앱 자료를 불러오지 못했습니다. 인터넷 연결을 확인하고 아래 버튼을 눌러 주세요.</p><button type="button" class="btn primary" onclick="location.reload()">다시 불러오기</button></div>';
      return;
    }
    loadSettings();
    if ($('#rulesBadge')) $('#rulesBadge').textContent = `${S.rules.meta.title.replace(' 학교생활기록부 기재요령', ' 기재요령')} 기준`;
    const saved = SMStore.get(K.draft, null);
    if (saved && AREA_ORDER.includes(saved.area)) S.draft = normalizeDraft({ ...S.draft, ...saved });
    restoreInputs();
    const last = SMStore.get(K.result, null);
    if (last && typeof last.text === 'string' && last.text && AREA_ORDER.includes(last.area) && last.input && AREA_ORDER.includes(last.input.area)) S.result = last;
    bind();
    renderMake();
    route('make');
    if (S.result) renderResult();
    bindKeyGuide(); bindSheetSyncModal(); bindReportOcr(); bindDraftStepAndGasModals();
    window.SMAction = {
      route,
      showPrompt,
      openPaste,
      checkPasted,
      copySkillBody,
      downloadSkill,
      getCombinedPrompt: () => currentPrompt().combined,
      exportAreaSkill: async (area, kind) => {
        const prev = S.draft.area;
        if (AREA_ORDER.includes(area)) { S.draft.area = area; renderMake(); }
        if (kind === 'copy') await copySkillBody();
        else if (kind === 'md') downloadSkill('md');
        else if (kind === 'zip') downloadSkill('zip');
      }
    };
  }
  init();
})();
