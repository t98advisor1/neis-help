'use strict';
/* 입력값 → 프롬프트. 방식 A(앱에서 바로 AI 호출)와 방식 B(프롬프트 복사 → Gemini·ChatGPT·Claude)가 같은 내용을 쓴다.
 * 재료: rules/2026.json(기재요령 규정), rules/prompt-base.json(역할·작성 구조·문체·끝맺음·총론 핵심역량 — 호출하는 쪽에서 ref 로 넣음), patterns/web-cases.json(참고 예시 — ref.examples).
 * 브라우저(<script>)와 node(require) 양쪽에서 쓴다.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SMPrompt = api;
})(typeof self !== 'undefined' ? self : this, function () {

  // 항목 갈래: 교과세특 / 창체(자율·자치·동아리·진로) / 행특
  const AREA_KIND = { setuk: 'setuk', jayul: 'cc', dongari: 'cc', jinro: 'cc', haengteuk: 'haengteuk' };
  const BYTES = { hangul: 3 };

  /* 금지 표현 처리 (사용자 결정 2026-10-20: 바꿔 쓸 수 있는 것은 대체 표현으로).
   * 기준은 student-record 엔진 사전(DICTIONARY)의 alt 안내. '삭제'로 시작하면 대체 불가.
   * 대회·수상은 엔진이 바꿔 쓰기를 허용하지만, 기재요령이 '대회 명칭을 단순행사로 변경하여 입력하는 행위 불가'
   * (인쇄 118쪽)·대회 준비 과정과 참가 사실 미기재를 정하고 있어 빼기로 둔다. */
  const DELETE_ONLY = new Set(['award-contest']);
  function substitutionRules(dict) {
    const swap = [], drop = [];
    for (const d of dict || []) {
      if (!d.alt || d.enabled === false || d.id === 'custom-ban') continue;
      if (DELETE_ONLY.has(d.id) || /^삭제/.test(d.alt)) drop.push(d.category);
      else swap.push(`- ${d.category}: ${d.alt}`);
    }
    return { swap, drop };
  }

  /* 평가어. 같은 말을 되풀이하면 문단마다 비슷하게 읽힌다 (사용자 선택 4번). 측정에도 쓴다.
   * words: 한 번이라도 쓴 평가어 — 결과 화면이 한 번만 써도 알린다(사용자 요청 2026-10-23, 실측 문단의 '우수한 학생임'이 알림 없이 지나갔음) */
  // 뒤 5개는 2026-10-23 실측 문단(reports/length-2026-10-23.md)에서 더함. 프롬프트에는 앞 10개만 예로 들어가므로 프롬프트는 그대로
  const PRAISE_WORDS = ['매우', '뛰어난', '뛰어남', '탁월', '훌륭', '돋보', '우수', '솔선수범', '적극적', '능동적', '주도적', '깊이 있', '심도 있', '치밀', '성공적',
    '눈에 띄', '두드러', '월등', '남다른', '모범적'];
  // 다른 낱말 속에 든 경우는 세지 않는다(에이전트 검증 2026-10-23: '한글의 우수성', '두드러기'가 평가어로 잡혔음)
  const PRAISE_RE = { '우수': /우수(?![성관])/g, '두드러': /두드러(?=[지진져])/g, '돋보': /돋보(?!기)/g }; // QA: '돋보기', '우수관'도 잡혔음
  function countPraise(text) {
    const t = String(text || '');
    const per = {};
    let total = 0;
    for (const w of PRAISE_WORDS) {
      const n = (t.match(PRAISE_RE[w] || new RegExp(w, 'g')) || []).length;
      if (n) { per[w] = n; total += n; }
    }
    return { total, words: Object.keys(per), repeated: Object.entries(per).filter(([, n]) => n > 1).map(([w, n]) => `${w}×${n}`) };
  }

  /* 메모 보충 질문(사용자 요청 2026-10-23 추천 2번): 메모가 짧을 때 교사가 관찰한 사실을 더 떠올리게 묻는다 — AI 요청이 없어 무료 사용량이 들지 않는다.
   * 처음에는 짧은 메모가 '사실만'이 짧은 원인이라 보았으나, 실측에서 메모를 40→145자로 늘려도 문단은 280→311자로 거의 같았다
   * (reports/length-2026-10-23-lengths.md). 그래서 분량이 아니라 문단을 구체적·정확하게 하는 도움말로 둔다.
   * 기재요령 근거가 아닌 글쓰기 도움말이며, 기재할 수 없는 것(점수·등수·수상·대회)은 묻지 않고 '적지 않아요'라고 함께 알린다 */
  const MEMO_QUESTIONS = {
    activity: [['무엇을', '활동·과제·주제는 무엇이었나요?'], ['어떻게', '어떤 자료를 살펴보고, 어떤 방법·순서로 했나요?'], ['맡은 일', '모둠이나 활동에서 맡은 역할은 무엇이었나요?'],
      ['남은 것', '만든 결과물, 발표·제출한 내용은 무엇인가요?'], ['보인 모습', '그 과정에서 선생님이 본 행동이나 달라진 점은 무엇인가요?']],
    haengteuk: [['어떤 장면', '언제, 어떤 상황에서 본 모습인가요?'], ['한 일', '그때 구체적으로 무엇을 했나요?'], ['꾸준함', '한 번이었나요, 여러 번·한 학기 내내였나요?'],
      ['다른 사람에게', '친구나 학급을 위해 한 일이 있나요?'], ['달라진 점', '학기 초와 비교해 달라진 모습이 있나요?']],
  };
  const memoQuestions = (area) => MEMO_QUESTIONS[AREA_KIND[area] === 'haengteuk' ? 'haengteuk' : 'activity'];

  /* 메모가 짧으면 목표 분량을 낮추자고 제안한다 (선택 2번). 분량을 채우려다 없는 사실을 덧붙이는 것을 막기 위해서.
   * 기준(어림값): 메모(공백 제외) 글자 수의 3배. 첫 실행(2026-10-20)에서 메모 156자→360자(교과세특)는 덧붙임이 거의 없었고,
   * 127자→444자(동아리, 3.5배)·138자→400자(진로, 2.9배)·94자→321자(행특, 3.4배)에서 덧붙임이 나왔다.
   * 표본이 5개뿐인 어림값이라 자동 적용하지 않고 제안만 한다. 실행 결과가 쌓이면 다시 맞춘다. */
  function suggestTarget(memo, target) {
    const len = String(memo || '').replace(/\s+/g, '').length;
    const comfortable = Math.floor(len * 3 / 50) * 50;
    // 제안할 목표가 지금 목표보다 작지 않으면 제안하지 않는다(목표 150자에서 '150자로' 버튼이 사라지지 않던 것)
    if (comfortable >= target * 0.9 || Math.max(150, comfortable) >= target) return null;
    return { target: Math.max(150, comfortable), memoChars: len, reason: `메모가 약 ${len}자라 ${target}자를 채우려면 메모에 없는 내용이 덧붙을 수 있습니다` };
  }

  /* 예시 자동 선택: 같은 영역 안에서 과목이 맞는 정도(같음 > 일부 겹침 > 같은 교과군 > 그 밖)로 먼저 나누고,
   * 같은 단계 안에서는 무작위로 고른다(input.exampleSeed 가 있을 때 — 앱이 과목·항목·교과군이 바뀔 때만 새 값을 줌).
   * exampleSeed 가 없으면(비교 도구 등) 예전처럼 점수 순으로 늘 같은 것을 고른다 */
  const seedHash = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  function pickExamples(ref, input, n) {
    if (input.exampleIds && input.exampleIds.length) {
      return input.exampleIds.map(id => ref.examples.find(e => e.id === id)).filter(Boolean);
    }
    // 금지 표현이 표시된 예시는 buildPrompt 가 어차피 빼므로 자동 선택에서 처음부터 제외한다
    // (전에는 과목이 맞는 표시된 내 예시가 뽑힌 뒤 빠져 예시가 1개만 들어갈 수 있었음)
    let pool = ref.examples.filter(e => e.areas.includes(input.area) && !(e.engine_flags || []).length);
    // 교과군 체크박스로 고른 교과군 안에서만 자동 선택 (그 안에 없으면 전체에서)
    if (Array.isArray(input.exampleGroups) && input.exampleGroups.length) {
      const inG = pool.filter(e => input.exampleGroups.includes(e.group));
      if (inG.length) pool = inG;
    }
    const cutoff = ref.webMeta && ref.webMeta.cutoff;
    if (input.exampleSeed) {
      const tier = (e) => subjectMatch(e, input.subject); // 금지 표현 표시 예시는 위 pool 에서 이미 빠짐
      const roll = (e) => seedHash(input.exampleSeed + '|' + e.id);
      return pool.slice().sort((a, b) => tier(b) - tier(a) || roll(a) - roll(b)).slice(0, n);
    }
    return pool.slice().sort((a, b) => exampleScore(b, input.subject, cutoff) - exampleScore(a, input.subject, cutoff)).slice(0, n);
  }
  /* 예시 점수: 과목명이 같음 4 / 일부 겹침(예: '한국사'와 '한국사1') 2.5 / 같은 교과군 1.5 + 검사 엔진 위반 없음 1 + 2년 이내 자료 0.5
   * 과목명은 띄어쓰기·로마 숫자(Ⅰ↔I)를 맞춰 비교한다 */
  const subjKey = (s) => String(s || '').replace(/\s+/g, '').replace(/Ⅰ/g, 'I').replace(/Ⅱ/g, 'II').replace(/[·･]/g, '');
  // 과목명 → 예시 묶음(web-cases.json 의 group). 앞에서부터 먼저 맞는 것 (예: '스포츠 과학'은 체육, '영어 독해와 작문'은 영어)
  const GROUP_KW = [
    ['체육', ['체육', '운동', '스포츠']], ['예술', ['음악', '미술', '연극', '영화']],
    ['제2외국어·한문', ['일본어', '중국어', '한문', '프랑스어', '독일어', '스페인어', '러시아어', '아랍어', '베트남어']],
    ['교양', ['철학', '심리', '논리', '진로와 직업', '교육학', '논술']], ['정보', ['정보', '인공지능', '데이터', '프로그래밍']],
    ['기술·가정', ['기술', '가정', '공학']], ['영어', ['영어', '영미']], ['국어', ['국어', '문학', '독서', '화법', '작문', '매체']],
    ['수학', ['수학', '미적분', '확률', '기하', '대수']], ['과학', ['과학', '물리', '화학', '생명', '지구', '역학', '물질', '세포', '기후']],
    ['사회', ['사회', '한국사', '역사', '지리', '경제', '정치', '법', '윤리', '세계사', '동아시아']],
  ];
  const groupOf = (subject) => { const s = String(subject || ''); const g = GROUP_KW.find(([, ks]) => ks.some(k => s.includes(k))); return g ? g[0] : ''; };
  // 과목이 맞는 정도: 같음 4 / 일부 겹침 2.5 / 같은 교과군 1.5 / 그 밖 0
  function subjectMatch(e, subject) {
    const a = subjKey(subject), b = subjKey(e.subject);
    const subj = !a ? 0 : (b && a === b) ? 4 : ((b && (a.includes(b) || b.includes(a))) || subjKey(e.title).includes(a)) ? 2.5 : 0;
    return (!subj && a && e.group && groupOf(subject) === e.group) ? 1.5 : subj;
  }
  function exampleScore(e, subject, cutoff) {
    const subj = subjectMatch(e, subject);
    const recent = cutoff && e.source && e.source.published >= cutoff ? 0.5 : 0;
    return subj + (e.engine_flags.length ? 0 : 1) + recent;
  }

  function areaRules(rules, key) {
    const a = rules.areas.find(x => x.key === key);
    if (!a) throw new Error('알 수 없는 영역: ' + key);
    return a;
  }

  /* 기재요령이 영역별로 보라고 정한 관점 (rules/*.json 의 emphasis·emphasis_groups, 원문 쪽수 대조됨).
   * 교과세특은 교과 구분(일반 / 체육·예술 / 전공 실무)에 따라 관점이 다르다. 구분은 과목 이름으로 추정하고 교사가 바꿀 수 있다. */
  function detectSubjectGroup(rules, subject) {
    const a = rules.areas.find(x => x.key === 'setuk');
    const g = a && a.emphasis_groups;
    if (!g) return 'general';
    const name = String(subject || '');
    if (g.arts_pe && (g.arts_pe.keywords || []).some(k => name.includes(k))) return 'arts_pe';
    return 'general';
  }
  /* 교과세특 '자주 쓰는 관점'(rules/prompt-base.json setuk_lenses — 교사 요청, 기재요령 근거 아님). 교과세특이 아니면 빈 목록 */
  function lensItems(ref, area) {
    return area === 'setuk' && ref && ref.setuk_lenses ? ref.setuk_lenses.items : [];
  }
  function emphasisFor(rules, input) {
    const a = rules.areas.find(x => x.key === input.area);
    if (!a) return null;
    if (a.emphasis_groups) {
      const key = input.subjectGroup || detectSubjectGroup(rules, input.subject);
      const g = a.emphasis_groups[key] || a.emphasis_groups.general;
      return { key, label: g.label, items: g.items, sources: g.sources };
    }
    if (a.emphasis) return { key: input.area, label: a.name, items: a.emphasis.items, sources: a.emphasis.sources };
    return null;
  }

  /* 교과 역량 (rules/competencies.json — 2022·2015 개정 교육과정 원문 대조).
   * 학년으로 교육과정을 정하고(3학년 = 2015 개정), 과목 이름으로 교과를 추정한다(교사가 바꿀 수 있음). */
  const curriculumYear = (grade) => Number(grade) === 3 ? '2015' : '2022';
  function detectKyogwa(comp, subject, year) {
    const name = String(subject || '');
    if (!comp || !name.trim()) return '';
    for (const m of comp.subject_map) {
      if (m.keywords.some(k => name.includes(k))) {
        if (comp[year][m.subject]) return m.subject;
        if (m.subject === '통합사회' && comp[year]['사회']) return '사회'; // 2022 에는 통합사회 따로 없음
      }
    }
    return '';
  }
  function kyogwaFor(comp, input) {
    if (!comp || input.area !== 'setuk') return null;
    const year = curriculumYear(input.grade);
    const kyogwa = (input.kyogwa && comp[year][input.kyogwa]) ? input.kyogwa : detectKyogwa(comp, input.subject, year);
    if (!kyogwa) return { year, kyogwa: '', entry: null };
    return { year, kyogwa, entry: comp[year][kyogwa] };
  }

  /* 칩으로 보여 줄 항목: 공식 교과 역량 + (있으면) 원문이 강조한 능력·목표 요약. kind 로 구분해 표시한다 */
  function kyogwaItems(entry) {
    if (!entry) return [];
    const official = entry.competencies.map(c => ({ name: c.name, desc: /원문 정의 없음/.test(c.desc || '') ? '' : (c.desc || ''), kind: 'official' }));
    const extra = (entry.emphasized || []).map(n => ({ name: n, desc: '', kind: official.length ? 'goal' : 'emphasized' }));
    return official.concat(extra);
  }

  /* 반환값: { system, user, combined, meta }
   *  - system/user: 방식 A에서 API의 system·user 메시지로 보냄
   *  - combined: 방식 B에서 한 번에 복사해 붙여 넣는 글 */
  /* 관찰한 특성·변화·참여도(만들기 3번 아래, 사용자 요청 2026-10-24). 교사가 실제로 본 것을 고른 것이라 메모와 같은 '사실'로 다룬다 */
  const OBS_GROUP = (area) => (AREA_KIND[area] === 'setuk' ? 'setuk' : AREA_KIND[area] === 'haengteuk' ? 'haengteuk' : 'cc');
  function observationLines(input, ref) {
    const o = input.obs || {}, cfg = (ref && ref.observation) || {};
    const g = (cfg.groups || {})[OBS_GROUP(input.area)] || {};
    const lv = ((cfg.participation || {}).levels || []).find(x => x.id === o.participation);
    const clean = (a) => (Array.isArray(a) ? a.map(x => String(x || '').trim()).filter(Boolean) : []);
    const lines = [];
    if (clean(o.traits).length) lines.push(`- 관찰한 특성: ${clean(o.traits).join(' / ')}`);
    if (clean(o.changes).length) lines.push(`- ${g.changeLabel || '변화'}: ${clean(o.changes).join(' / ')}`);
    const note = String(o.participationNote || '').trim();
    if (lv || note) lines.push(`- ${input.area === 'setuk' ? '학습활동 참여도' : '활동 참여도'}: ${[lv && lv.name, note].filter(Boolean).join(' — ')}`);
    return lines;
  }
  /* 분량 판단에 쓰는 '사실' 글: 메모 + 교사가 고른 관찰 내용(특성·변화·참여 모습 한 줄). 관찰 내용은 교사가 실제로 본 사실이라
   * 메모가 짧을 때 분량을 채우는 데 쓴다(사용자 결정 2026-10-26 '관찰은 늘, 성취기준은 과장 허용만'). 참여도 단계 이름은 등급이라 세지 않는다.
   * 설계도(factBlueprint)·목표 줄이기 제안·결과의 '메모 대비 김' 경고가 모두 이 글자 수 ×3 을 기준으로 한다 */
  function factText(input) {
    const o = (input && input.obs) || {}, arr = (a) => (Array.isArray(a) ? a : []);
    return [input && input.memo, ...arr(o.traits), ...arr(o.changes), o.participationNote].map(x => String(x || '').trim()).filter(Boolean).join('\n');
  }

  /* 성취기준(교과세특, 사용자 요청 2026-10-24): 교사가 고른 것만. 과목 이름 맞추기는 공백·가운뎃점을 지우고 Ⅰ→I 로 맞춰 비교 */
  const normSubject = (t) => String(t || '').replace(/[\s⋅·ㆍ・]/g, '').replace(/Ⅰ/g, 'I').replace(/Ⅱ/g, 'II').replace(/Ⅲ/g, 'III').toUpperCase();
  function findStandardsSubject(data, subject) {
    const k = normSubject(subject); if (!k || !data || !Array.isArray(data.subjects)) return null;
    return data.subjects.find(x => [x.subject].concat(x.aliases || []).some(n => normSubject(n) === k)) || null;
  }

  // 못 찾았을 때 보여 줄 비슷한 과목 — 사용자 요청 2026-10-24 '후보 버튼'(예: '통합사회' → [통합사회1] [통합사회2]).
  // 순서: 2015→2022 에서 이름이 바뀐 과목 → 이름이 같게 시작 → '공통·기본·심화·고급' 뒤에 붙음 → 그 밖에 들어 있음('국어'에 '중국어'가 앞서던 것)
  // 이름이 바뀐 과목은 교육과정 내용 영역이 이어지는 것만(앱이 정한 안내, 원문 아님). 자료에 없는 이름은 저절로 빠진다
  const RENAMED_2022 = { '수학I': ['대수'], '수학1': ['대수'], '수학II': ['미적분Ⅰ'], '수학2': ['미적분Ⅰ'], '미적분': ['미적분Ⅱ'], '물리학I': ['물리학'], '화학I': ['화학'], '생명과학I': ['생명과학'], '지구과학I': ['지구과학'],
    '사회문화': ['사회와 문화'], '생활과윤리': ['현대사회와 윤리'], '정치와법': ['정치', '법과 사회'], '독서': ['독서와 작문'] };
  function similarSubjects(data, subject, max) {
    const k = normSubject(subject); if (k.length < 2 || !data || !Array.isArray(data.subjects)) return [];
    const has = new Map(data.subjects.map(x => [normSubject(x.subject), x.subject]));
    const out = [];
    for (const n of (/2022/.test(String((data.meta || {}).title || '')) ? RENAMED_2022[k] || [] : [])) if (has.has(normSubject(n))) out.push({ name: has.get(normSubject(n)), r: 0, len: 0 });
    for (const x of data.subjects) {
      const names = [x.subject].concat(x.aliases || []).map(normSubject);
      let r = 9;
      if (names.some(n => n.startsWith(k))) r = 1;
      else if (names.some(n => ['공통', '기본', '심화', '고급'].some(p => n.startsWith(p + k)))) r = 2;
      else if (names.some(n => n.includes(k))) r = 3;
      if (r < 9 && !out.some(o => o.name === x.subject)) out.push({ name: x.subject, r, len: x.subject.length });
    }
    return out.sort((a, b) => a.r - b.r || a.len - b.len).slice(0, max || 8).map(x => x.name);
  }

  function buildPrompt(input, rules, ref, dict, comp) {
    const area = areaRules(rules, input.area);
    const st = ref.structure[input.area]; // rules/prompt-base.json — 기재요령 쪽수 근거의 작성 구조
    const curriculum = input.curriculum || '2022 개정 교육과정';
    // 동아리는 나이스가 붙이는 '(부서명)(00시간) '이 500자에 들어가는지 원문이 밝히지 않아(rules open_questions)
    // 들어간다고 보고 그만큼 한도를 줄인다. 한글 3바이트·그 외 1바이트로 세어 글자 수로 환산한다.
    let limit = area.limit_chars;
    // 동아리명을 비워 두면 보통 길이(한글 8자)로 셈한다 — 비우면 머리말 몫을 빼지 않아 나이스에서 넘칠 수 있었음(에이전트 검증 2026-10-24, AGENTS '애매하면 엄격하게')
    if (input.area === 'dongari' && input.clubHeaderCounts !== false) {
      const header = `(${input.club || '가나다라마바사아'})(00시간) `;
      const bytes = [...header].reduce((n, ch) => n + (ch.charCodeAt(0) > 127 ? BYTES.hangul : 1), 0);
      limit -= Math.ceil(bytes / BYTES.hangul);
    }
    const target = Math.min(input.targetChars || limit, limit);
    const lowChars = Math.round(target * 0.9);
    // 사실만이어도 메모가 충분히 길면(메모×3 ≥ 목표 하한) 문장 설계도를 준다(사용자 결정 2026-10-23 — 10-21 '사실만은 설계도 없음'을 이 경우만 바꿈).
    // 실측에서 사실만은 메모 145자에도 목표의 55~70%에서 멈췄음(reports/length-2026-10-23-lengths.md). 메모가 짧으면 설계도가 덧붙임을 부르므로 주지 않는다.
    // noFactBlueprint: 측정 도구의 비교용(앱은 쓰지 않음)
    const obsLines = observationLines(input, ref);
    // 메모 + 고른 관찰 내용을 센다(사용자 결정 2026-10-26 — 10-24 에는 칩이 짧은 문구라 메모만 셌으나, 관찰 내용으로도 분량을 채우기로 함)
    const memoLen = factText(input).replace(/\s+/g, '').length;
    const factBlueprint = input.factMode !== 'loose' && !input.noFactBlueprint && memoLen * 3 >= lowChars;
    // 금지 표현이 표시된 예시(교사가 추가한 내 예시 등)는 AI가 따라 쓰지 않도록 넣지 않는다
    const examples = pickExamples(ref, input, 2).filter(e => !(e.engine_flags || []).length);

    // 일반 역량 = 교육과정 총론 핵심역량(원문 정의). 학년에 따라 2022/2015
    const comps = ref.core_competencies[curriculum].items
      .concat((input.customComps || []).map(n => ({ id: 'c:' + n, name: n, desc: '교사가 추가한 역량' })));
    const chosen = (input.competencies || []).length
      ? comps.filter(c => input.competencies.includes(c.id))
      : comps;

    const lines = [];
    const sec = (title, body) => { lines.push('# ' + title, body.trim(), ''); };

    sec('역할', ref.role.text);
    // '가장 중요'한 사실 지키기를 역할 바로 뒤로 옮김 — 전에는 금지 목록·대체 표현(약 2,000자) 뒤 8번째 칸이었음
    const src = '메모'; // 학생 결과물 첨부는 2026-10-21 사용자 결정으로 삭제 — 근거는 교사 메모뿐
    const stds = input.area === 'setuk' && Array.isArray(input.standards) ? input.standards.filter(x => x && x.text).slice(0, 6) : [];
    // 메모가 짧을 때의 방식(만들기 4번, 사용자 결정 2026-10-21): 'strict' 사실만(기본) / 'loose' 약간의 과장 허용(범위 '넓게' — 메모 활동의
    // 그럴듯한 세부·해석까지 허용, 수치·수상·도서명·인물·다른 사람의 반응은 금지). loose 로 만든 문단은 앱이 결과에 강한 경고를 늘 붙인다
    if (input.factMode === 'loose') sec('사실과 덧붙임 (교사가 \'약간의 과장 허용\'을 고름)', [
      // 사용자 피드백(2026-10-21): 과장 허용인데도 목표에 많이 모자람 → 분량을 첫 줄에, 글자 수와 함께 문장 수로도 알려 줌
      // (공개 사례 문장 평균 68자 ≈ 한글 약 54자 — rules/prompt-base.json style basis)
      `- 이 문단은 분량이 가장 중요합니다. 반드시 한글 ${lowChars}~${target}자를 채우고, 그보다 짧게 끝내지 마십시오.`,
      // 사용자 요청(2026-10-21) '무료 사용량 1회 더 쓰지 않게 처음부터 목표 분량에' — AI는 글자 수보다 문장 수를 잘 지키므로 문장 설계도를 주고(1),
      // 같은 요청 안에서 스스로 세어 늘린 뒤 내보내게 한다(2). 늘리기 재요청은 교사가 버튼을 누를 때만(js/app.js data-grow)
      `- 문장 설계도: 문장 ${blueprint(target, st.items.length).n}개(문장마다 한글 48~60자)로 쓰십시오. 아래 '작성 구조'의 항목 ${st.items.length}개에 ${blueprint(target, st.items.length).assign}, 활동 하나를 한 문장으로 끝내지 말고 과정·방법·드러난 역량을 각각 문장으로 나눠 쓰되, 나눈 문장은 앞 문장의 활동이나 결과물을 받아 이어지게 쓰십시오.`,
      '- 다 쓴 뒤 문장 수와 글자 수를 스스로 세어 보고, 설계도보다 적으면 모자란 만큼 과정·역량 문장을 더해 늘린 최종 문단만 출력하십시오. 세어 본 과정이나 글자 수는 출력하지 마십시오.',
      `- ${src}가 짧으면 ${src}에 적힌 활동을 중심으로, 그 활동과 어울리는 그럴듯한 세부(살펴본 자료의 종류, 정리·발표 방식, 활동의 과정과 순서, 모둠 안에서 맡은 일)와 그 행동에서 드러난 역량·태도의 해석을 덧붙여 분량을 채우십시오.`,
    ].concat(obsLines.length ? [
      `- 교사가 고른 관찰 내용(특성·변화·참여 모습)도 하나씩 ${src}의 활동과 이어 풀어 써서 분량을 채우십시오. 따로 떨어진 문장으로 덧붙이지 말고 관련된 활동 문장 바로 뒤에 이어 넣으며, 문단을 관찰 내용으로 시작하지 말고 메모의 활동부터 순서대로 쓰십시오.`,
    ] : []).concat(stds.length ? [
      // 사용자 결정(2026-10-26): 성취기준으로 분량을 채우는 것은 과장 허용일 때만 — 사실만에서는 메모에 없으면 건너뜀(아래 '성취기준 반영')
      `- 그래도 모자라면 교사가 고른 성취기준과 이어지는 학습 과정(${src}의 활동 안에서 그 성취기준에 비추어 무엇을 어떻게 탐구·적용했는지)을 그럴듯하게 덧붙여 분량을 채우십시오. 성취기준 문장·코드나 성취기준에 적힌 지식을 그대로 풀어 쓰지 말고, ${src}의 활동과 별개인 새 활동은 만들지 마십시오.`,
    ] : []).concat([
      `- ${src}에 없으면 수치(점수·등수·횟수·인원), 수상·대회, 도서명·저자, 인물 이름, 다른 사람의 반응(예: "높은 신뢰를 받음")은 절대 쓰지 마십시오.`,
      `- ${src}의 행동을 다른 행동으로 바꾸거나 ${src}와 어긋나는 내용, ${src}의 활동과 상관없는 별개의 활동은 쓰지 마십시오.`,
      '- 덧붙인 내용도 아래 기재요령의 기재 원칙·금지 사항을 그대로 지키십시오.',
    ]).concat(input.addedList ? [
      // 덧붙인 내용 목록(사용자 결정 2026-10-23 'B') — 교사가 대조할 곳을 AI가 스스로 밝히게 한다. 같은 응답 안이라 추가 요청 없음.
      // 실측으로 덧붙임을 충분히 잡을 때만 앱이 켠다(js/app.js ADDED_LIST). 목록은 extractParagraph 가 문단에서 떼고 extractAddedList 가 읽는다
      `- 문단을 다 쓴 뒤 빈 줄을 하나 두고 '${ADDED_MARK}'이라고 한 줄 쓴 다음, ${src}와 교사가 고른 관찰 내용에 적혀 있지 않은데 문단에 넣은 세부·해석을 하나도 빠짐없이 '- '로 시작하는 줄에 하나씩 적으십시오. 각 줄은 문단에 쓴 표현을 그대로 짧게(30자 이내) 옮기십시오. 덧붙인 것이 없으면 '- 없음'이라고 쓰십시오.`,
    ] : []).join('\n'));
    else sec('사실 지키기 (가장 중요)', [
      `- 교사가 적은 ${src}에 없는 활동, 성과, 수치, 도서명, 인물은 새로 만들지 마십시오.`,
      `- ${src}에 없는 원인·동기·마음가짐(예: "스스로 문제를 인식하고", "포기하지 않고"), 보고서·발표의 내용과 결론, 다른 사람의 반응(예: "높은 신뢰를 받음")을 추측해 쓰지 마십시오.`,
      '- 메모의 행동을 다른 행동으로 바꾸지 마십시오(예: "정리" → "세척과 정리").',
      // 메모가 짧아도 되도록 목표 분량에 맞춘다(사용자 결정 2026-10-21 — 'A. 사실 안에서 채우기'). 채우는 방법은 메모 속 사실을 풀어 쓰는 것뿐이고,
      // 위 금지는 그대로다. 앱은 메모에 비해 문단이 길면 '덧붙임·과장' 경고를 늘 보여 준다(js/app.js renderResult)
      `- 목표 분량에 되도록 맞추십시오. ${src}가 짧으면 ${src}에 있는 활동마다 어떻게 했는지(과정·방법·순서), 그 행동에서 드러난 역량·태도를 더 구체적으로 풀어 써서 분량을 채우십시오.`,
    ].concat(obsLines.length ? [
      // 실측 2026-10-26(reports/length-2026-10-26-flow.md): 관찰 내용 두 문장이 문단 첫머리에 몰려 활동 흐름보다 앞섰음 → '관찰 내용으로 시작하지 말고'
    // 사용자 결정(2026-10-26): 관찰 내용은 교사가 본 사실이라 사실만에서도 분량 채우기에 쓴다. 관찰 내용에 적힌 행동을 넘는 새 행동·장면은 금지
      `- 교사가 고른 관찰 내용(특성·변화·참여 모습)도 ${src}와 같은 사실이니, 하나씩 ${src}의 활동과 이어 그 행동이 어떻게 나타났는지 풀어 써서 분량을 채우십시오. 따로 떨어진 문장으로 덧붙이지 말고 관련된 활동 문장 바로 뒤에 이어 넣으며, 문단을 관찰 내용으로 시작하지 말고 메모의 활동부터 순서대로 쓰십시오. 관찰 내용에 적힌 행동을 넘는 새 행동·장면은 만들지 마십시오.`,
    ] : []).concat([
      '- 분량을 채우려고 위에서 금지한 내용(새 활동·성과·수치·도서명·인물, 추측한 동기·반응)을 넣거나, 평가어·꾸밈말을 늘려 과장하지 마십시오.' + (factBlueprint ? '' : ' 그렇게 해도 모자라면 목표보다 조금 짧게 끝내십시오.'),
    ]).concat(factBlueprint ? [
      `- ${src}${obsLines.length ? '와 고른 관찰 내용' : ''}의 사실만으로 목표 분량을 채울 수 있습니다. 반드시 한글 ${lowChars}~${target}자를 채우십시오.`,
      `- 문장 설계도: 문장 ${blueprint(target, st.items.length).n}개(문장마다 한글 48~60자)로 쓰십시오. 아래 '작성 구조'의 항목 ${st.items.length}개에 ${blueprint(target, st.items.length).assign}, ${src}에 있는 활동마다 무엇을·어떻게(과정·방법·순서)·그 행동에서 드러난 역량을 각각 문장으로 나눠 쓰되, 나눈 문장은 앞 문장의 활동이나 결과물을 받아 이어지게 쓰십시오.`,
      `- 다 쓴 뒤 문장 수와 글자 수를 스스로 세어 보고, 설계도보다 적으면 ${src}에 있는 사실을 더 풀어 쓴 문장을 더해 늘린 최종 문단만 출력하십시오. 세어 본 과정이나 글자 수는 출력하지 마십시오.`,
    ] : []).join('\n'));
    // 성취기준을 골랐을 때만(교과세특): 기재요령 원문 '성취기준과 성취수준에 근거하여 학생 개인의 성취과정과 성취특성이 명료히 드러나도록 하되,
    // 수업에서 이루어진 활동의 단순 나열이나 이미 성취기준에 명시된 지식의 단순 서술은 지양함'(sources/2026-기재요령-고등학교.txt 3153줄)
    if (stds.length) sec('성취기준 반영', [
      `- 교사가 이 활동과 관련 있다고 고른 성취기준이 아래 사용자 메시지에 있습니다. ${src}의 활동에서 학생이 그 성취기준에 비추어 무엇을 할 수 있게 되었는지(성취과정과 성취특성)가 드러나게 쓰십시오.`,
      '- 성취기준 문장이나 코드([12영Ⅰ-01-01] 같은 것)를 문단에 옮기지 말고, 성취기준에 적힌 지식을 그대로 풀어 설명하지 마십시오(기재요령: 성취기준에 명시된 지식의 단순 서술은 지양).',
      // 실측 2026-10-26: 과장 허용 문단에 '…하는 성취특성을 드러냄'처럼 지시문 낱말이 그대로 나왔음
      "- '성취기준'·'성취과정'·'성취특성'·'성취수준'이라는 낱말 자체는 문단에 쓰지 마십시오.",
      input.factMode === 'loose'
        ? `- ${src}에 그 성취기준과 이어지는 활동이 없더라도, ${src}의 활동 안에서 그 성취기준과 이어질 만한 학습 과정을 덧붙일 수 있습니다(위 '사실과 덧붙임' — 덧붙인 것은 목록에 적을 것). ${src}의 활동과 별개인 새 활동·수치·도서명은 쓰지 말고, 성적·성취도·등급은 쓰지 마십시오.`
        : `- ${src}에 그 성취기준과 이어지는 활동이 없으면 성취기준 내용을 지어내지 말고 그 성취기준은 건너뛰십시오. 성적·성취도·등급은 쓰지 마십시오.`,
    ].join('\n'));
    // 관찰 내용을 골랐을 때만: 메모와 같은 사실로, 평가어 대신 행동으로, 소극적이면 변화 가능성과 함께(기재요령 부정적 기재 원칙)
    if (obsLines.length) sec('교사가 고른 관찰 내용 다루기', [
      `- '교사가 고른 관찰 내용'은 ${src}와 같은 사실입니다. 이것과 ${src}에 없는 내용은 위의 사실 규칙(사실 지키기 또는 사실과 덧붙임)을 그대로 따르십시오.`,
      `- 특성은 "꼼꼼한 태도를 보임" 같은 평가어로 옮기지 말고, ${src}의 활동 속 행동으로 드러내십시오. ${src}에 이어 붙일 활동이 없으면 그 특성이 수업·활동 중에 어떻게 나타났는지를 관찰 내용에 적힌 행동 안에서 한두 문장으로 쓰고, 새 활동·장면은 지어내지 마십시오.`,
      `- 변화는 ${src}의 활동 과정 안에서 처음 모습 → 나중 모습의 순서로 쓰되, 변화의 까닭이나 다른 사람의 반응을 지어내지 마십시오.`,
      `- 참여도는 '참여도가 높음'·'소극적인 모습'·'적극적으로 참여함'처럼 등급으로 쓰지 말고('소극적'·'적극적'·'참여도'라는 낱말을 문단에 쓰지 말 것) 참여한 모습으로 쓰십시오. '소극적'이면 단정하거나 깎아내리지 말고 ${src}·관찰 내용에 있는 노력이나 달라질 가능성과 함께 쓰되, 이를 덮으려고 ${src}에 없는 좋은 행동(예: '경청하며')을 지어내지 마십시오.`, // 실측 2026-10-24: 소극적 참여에 '타인의 의견을 경청하며'를 지어냈음
    ].join('\n'));
    sec(`작성 구조 — ${area.name}`, [st.intro, ...st.items.map(x => '- ' + x), `- 순서: ${st.order}`].join('\n'));

    sec(`${rules.meta.title} — ${area.name} 기재 원칙`, [
      ...(area.writing_rules || []).map(r => '- ' + r.text),
      ...(area.not_allowed || []).map(r => '- 입력 불가: ' + r.text),
      ...(area.special_limits || []).map(r => '- ' + r.text),
      // '창체 특기사항은…'으로 시작하는 공통 원칙은 창체 항목에만 넣는다 — 교과세특·행특에 '횟수·시간은 정량적으로 입력 가능'이 들어가 있었음
      ...rules.common_principles.filter(r => AREA_KIND[input.area] === 'cc' || !/^창체/.test(r.text)).map(r => '- ' + r.text),
    ].join('\n'));

    sec('기재 금지 사항 (어떤 항목에도 쓸 수 없음)', rules.prohibited.map(p => '- ' + p.text).join('\n'));

    const sub = substitutionRules(dict);
    if (sub.swap.length || sub.drop.length) {
      sec('메모에 금지 표현이 있을 때', [
        '아래 기준에 따라 처리하십시오. 바꿔 쓸 때도 메모에 있는 사실의 범위를 넘지 마십시오.',
        '',
        '[대체 표현으로 바꿔 쓰기]',
        ...sub.swap,
        '',
        '[문단에서 빼기 — 어떤 표현으로도 바꿔 쓸 수 없음]',
        '- ' + sub.drop.join(', '),
        '- 대회·수상은 대회 이름을 "행사"로 바꾸거나 준비 과정·참가 사실을 돌려 쓰는 것도 금지됩니다. 그 활동 문장 전체를 빼십시오.',
      ].join('\n'));
    }

    sec('표기 규칙', rules.notation.map(n => '- ' + n.text).join('\n'));

    // 바이트 셈은 기재요령 원문 표현 그대로 (rules/2026.json byte_rule, 인쇄 208쪽)
    const br = rules.byte_rule;
    sec(`길이 — 기재요령 ${br.source.page}쪽 기준`, [
      `- 쓸 길이: 한글 기준 약 ${lowChars}~${target}자.`,
      `- 나이스는 글자가 아니라 바이트로 셉니다(한글 1자 ${br.hangul}Byte, 영문·숫자 1자 ${br.ascii}Byte, 엔터 ${br.enter}Byte). 이 항목은 ${target * br.hangul}바이트를 넘으면 입력되지 않습니다.`,
      '- 엔터 없이 한 덩어리로 쓰십시오.',
    ].join('\n'));

    sec('문체', [
      ...ref.style.rules.map(r => '- ' + r),
      // 작성 구조의 순서(교과세특은 '성취수준의 특성'이 앞)와 부딪치지 않게, 문단 순서가 아니라 평가와 근거의 관계로 적음
      '- 평가는 그 근거가 되는 관찰한 행동·결과와 함께 짧게 쓰십시오. 근거 없이 평가만 하는 문장은 쓰지 마십시오.',
      `- 평가어(${PRAISE_WORDS.slice(0, 10).join(', ')} 등)는 문단 전체에서 꼭 필요한 곳에만 쓰고, 같은 평가어를 두 번 쓰지 마십시오.`,
      '- "매우", "크게", "깊이" 같은 정도 부사를 겹쳐 쓰지 마십시오.',
    ].join('\n'));

    const pt = ref.patterns;
    sec('자주 쓰는 끝맺음 (공개 사례에서 뽑음)', [pt.intro, ...pt.groups.map(g => `- ${g.label}: ${g.items.join(', ')}`), '- ' + pt.connectives].join('\n'));

    const emph = emphasisFor(rules, input);
    if (emph) {
      // 교사가 직접 추가한 관점은 기재요령 관점과 함께 고른다 (id 는 'c:이름')
      const emItems = emph.items.concat((input.customEmphasis || []).map(n => ({ id: 'c:' + n, name: n, desc: '교사가 추가한 관점' })));
      // 교과세특 '자주 쓰는 관점'(prompt-base setuk_lenses, 기재요령 근거 아님)은 고른 것만 넣는다 — 안 고를 때 전체에 섞으면 프롬프트가 길어짐
      const lenses = lensItems(ref, input.area);
      // 고른 것이 지금 목록에 하나도 없으면(교과 구분이 바뀐 직후 등) 전체로 — 전에는 '고른 관점입니다' 아래가 비어 있었음
      const sel = (input.emphasis || []).length ? emItems.concat(lenses).filter(i => input.emphasis.includes(i.id)) : [];
      const picked = sel.length ? sel : emItems;
      const pages = [...new Set((emph.sources || []).map(x => x.page))].sort((x, y) => x - y).join('·');
      sec(`이 항목에서 드러낼 관점 — ${rules.meta.title.replace(' (고등학교)', '')} ${pages}쪽${emph.key in { general: 1, arts_pe: 1, vocational: 1 } ? ` (${emph.label})` : ''}`, [
        sel.length ? '- 교사가 특히 강조해 달라고 고른 관점입니다. 메모에 근거가 있는 것을 중심으로 드러내십시오.' : '- 메모에 근거가 있는 관점만 골라 드러내십시오. 근거가 없는 관점은 억지로 쓰지 마십시오.',
        // 자주 쓰는 관점은 '비판적 사고력이 뛰어남'처럼 이름째 평가어로 들어가기 쉬워 행동으로 쓰라고 한 줄 더함
        ...(picked.some(i => String(i.id).startsWith('l:')) ? ['- 관점 이름(예: "비판적 사고력", "문제해결력")을 문단에 그대로 쓰거나 "~력이 뛰어남"처럼 평가하지 말고, 그 관점이 드러나는 행동으로 보여 주십시오.'] : []),
        ...picked.map(i => `- ${String(i.id).startsWith('l:') ? '(교사 선택, 기재요령 밖) ' : ''}${i.name}: ${i.desc}`),
      ].join('\n'));
    }

    const kg = kyogwaFor(comp, input);
    const kgItems = kg && kg.entry ? kyogwaItems(kg.entry).concat((input.customKyogwa || []).map(n => ({ name: n, desc: '', kind: 'custom' }))) : [];
    if (kgItems.length) {
      const kSel = (input.kyogwaComps || []).length ? kgItems.filter(i => input.kyogwaComps.includes(i.name)) : []; // 위 관점과 같은 이유로 비면 전체
      const picked = kSel.length ? kSel : kgItems;
      const official = kg.entry.competencies.length > 0;
      sec(`이 교과의 ${official ? '교과 역량' : '강조 능력'} — ${kg.year} 개정 교육과정 ${kg.kyogwa}과`, [
        kSel.length ? '- 교사가 강조해 달라고 고른 것입니다. 메모에 근거가 있는 것을 중심으로 드러내십시오.' : '- 메모에 근거가 있는 것만 골라 드러내십시오. 근거가 없으면 억지로 쓰지 마십시오.',
        '- 역량 이름을 그대로 나열하지 말고, 학생의 행동으로 드러나게 쓰십시오.',
        ...picked.map(i => `- ${i.kind === 'goal' ? `(${kg.entry.emphasized_label || '목표'}) ` : i.kind === 'custom' ? '(교사가 추가) ' : ''}${i.name}${i.desc ? ': ' + i.desc : ''}`),
      ].join('\n'));
    }

    if (chosen.length && !kgItems.length) {
      sec(`드러낼 핵심역량 — ${curriculum} 총론`, [
        (input.competencies || []).length ? '- 교사가 강조해 달라고 고른 역량입니다. 메모에 근거가 있는 것을 중심으로 드러내십시오.' : '- 메모에 근거가 있는 역량만 골라 드러내십시오. 근거가 없으면 억지로 쓰지 마십시오.',
        '- 역량 이름을 그대로 쓰지 말고, 학생의 행동으로 드러나게 쓰십시오.',
        ...chosen.map(c => `- ${c.name}: ${c.desc}`),
      ].join('\n'));
    }

    // 대학 평가요소 세부 역량(rules/prompt-base.json eval_factors — 5개 대학 공동연구 원문). 교사가 고른 것만, 문단에 쓸 수 있는 항목(record)만
    const efSel = evalFactorItems(ref).filter(i => i.record && (input.evalItems || []).includes(i.id));
    if (efSel.length) {
      sec('드러낼 관점 — 대학 학생부종합전형 공통 평가요소(5개 대학 공동연구, 2022)', [
        '- 교사가 고른 관점입니다. 메모에 근거가 있는 행동만 이 관점이 드러나게 구체적으로 쓰십시오. 근거가 없으면 쓰지 마십시오.',
        '- 항목 이름(예: "탐구력", "리더십")이나 "역량이 뛰어남" 같은 평가어를 문단에 그대로 쓰지 말고, 관찰한 행동으로 보여 주십시오.',
        '- 성적·등급·이수한 과목 수는 쓰지 마십시오.',
        ...efSel.map(i => `- ${i.group} · ${i.name}${i.def ? ': ' + i.def : ''}`), // 공유판은 정의를 뺌(tools/build-offline.mjs)
      ].join('\n'));
    }

    if (examples.length) {
      sec('참고 예시 (문장 구조와 깊이만 참고)', [
        '- 예시의 괄호 머리말(예: "(교사 총평)")은 결과에 쓰지 마십시오.',
        '- 예시 속 활동·고유명사·표현을 그대로 옮기지 마십시오.',
        // 공개 사례는 원문 그대로라 평가어가 많은 것도 있다 → 예시와 규칙이 다르면 규칙을 따르게 함
        '- 예시가 위 규칙(사실 지키기·문체)과 다르면 위 규칙을 따르십시오.',
        ...examples.map((e, i) => `\n[예시 ${i + 1}] ${e.title}\n${e.text}`),
      ].join('\n'));
    }

    const refCards = (input.refCards || []).filter(c => c.area === input.area || c.area === 'all');
    if (refCards.length) {
      sec('선생님이 올린 참고 자료에서 고른 내용', [
        '- 위 기재요령·규칙과 어긋나면 기재요령과 위 규칙을 따르십시오.',
        '- 예시 문단의 활동·고유명사는 옮기지 말고 서술 방식만 참고하십시오.',
        // 금지 표현이 표시된 예시는 AI가 따라 쓰지 않도록 넣지 않는다
        ...refCards.map(c => `- [${c.docTitle}${c.page ? ' ' + c.page + '쪽' : ''}] ${c.title}: ${c.text}${c.example && !(c.engine_flags || []).length ? `\n  예시: ${c.example}` : ''}`),
      ].join('\n'));
    }

    // 문장 잇기(사용자 요청 2026-10-21·10-26): 보내기 전에 한 번 읽어 이어지지 않는 곳만 고치게 한다(내용은 그대로 — 사실 규칙과 부딪히지 않게)
    sec('보낼 내용', '보내기 전에 문단을 처음부터 한 번 읽어, 앞 문장과 이어지지 않는 문장은 순서를 바꾸거나 첫머리를 앞 문장을 받는 말로 고쳐 잇되 내용은 더하거나 빼지 마십시오. 생기부 칸에 그대로 넣을 문단 본문만 보내 주십시오. 문단 앞뒤에 설명·제목·인사·다음에 할 일 제안을 덧붙이지 말고, 문단 전체를 따옴표로 감싸지도 마십시오.' +
      (input.factMode === 'loose' && input.addedList ? ` 단, 위 '사실과 덧붙임'에서 정한 '${ADDED_MARK}' 목록은 문단 뒤에 붙이십시오.` : ''));

    const system = lines.join('\n').trim();

    const u = [];
    u.push(`작성 항목: ${area.name}`);
    u.push(`교육과정: ${curriculum}`);
    if (input.grade) u.push(`학년: ${input.grade}학년`);
    if (input.subject) u.push(`과목: ${input.subject}`);
    if (input.club) u.push(`동아리: ${input.club}`);
    u.push(`목표 분량: 한글 약 ${target}자 (${target * BYTES.hangul}바이트 이하)` + (input.factMode === 'loose' || factBlueprint ? ` — 약 ${lowChars}자 아래로 짧게 끝내지 말 것` : ''));
    u.push('', '교사 메모(관찰 내용):', String(input.memo || '').trim());
    if (obsLines.length) u.push('', '교사가 고른 관찰 내용(메모와 같은 사실):', ...obsLines);
    if (stds.length) u.push('', '관련 성취기준(교사가 고름, 문단에 옮기지 말 것):', ...stds.map(x => `- ${x.code || ''} ${x.text}`.replace(/\s+/g, ' ').trim()));
    const user = u.join('\n');

    return {
      system,
      user,
      combined: system + '\n\n---\n\n' + user,
      meta: { factBlueprint, addedList: !!(input.factMode === 'loose' && input.addedList), area: input.area, kyogwa: kg ? kg.kyogwa : '', curriculumYear: kg ? kg.year : '', emphasisKey: emph ? emph.key : null, target, limit, lowChars, factMode: input.factMode === 'loose' ? 'loose' : 'strict', exampleIds: examples.map(e => e.id), targetSuggestion: suggestTarget(factText(input), target) },
    };
  }

  /* 대학 평가요소 세부 역량을 한 줄 목록으로: [{ id, name, def, record, why, group }] (eval_factors 가 없으면 빈 목록) */
  function evalFactorItems(ref) {
    const ef = ref && ref.eval_factors;
    return ef ? ef.groups.flatMap(g => g.items.map(i => ({ ...i, group: g.name }))) : [];
  }

  /* 스킬 파일(SKILL.md): 방식 B 프롬프트에서 교사 메모를 뺀 지시문을 Gemini·Claude 스킬 형식으로 묶는다.
   * 두 회사 모두 맨 위 YAML(name·description)이 있는 SKILL.md 를 받는다(2026-10-21 공식 도움말 확인):
   *  - name: 소문자·숫자·하이픈만(Gemini 규칙), 64자 이내(Claude). 과목·동아리가 있으면 이름이 겹치지 않게 짧은 꼬리표를 붙임
   *  - description: 200자 이내(Claude) — 언제 쓰는 스킬인지 적는다
   * 반환값: { name, description, markdown, body } — body 는 맨 위 YAML 을 뺀 지침 본문('지침만 복사': ChatGPT 프로젝트 지침·Gemini 빈 템플릿·Claude 채팅) */
  const SKILL_SLUG = { jayul: 'autonomy', dongari: 'club', jinro: 'career', setuk: 'subject-detail', haengteuk: 'behavior' };
  function buildSkill(input, rules, ref, dict, comp, today) {
    const p = buildPrompt({ ...input, memo: '', obs: null, standards: [] }, rules, ref, dict, comp);
    const area = areaRules(rules, input.area);
    const what = [input.subject, input.club].filter(Boolean).join(' ');
    let tag = '';
    if (what) { let h = 0; for (const ch of what) h = (h * 31 + ch.charCodeAt(0)) >>> 0; tag = '-' + h.toString(36).slice(0, 4); }
    const loose = input.factMode === 'loose';
    const name = `saenggibu-${SKILL_SLUG[input.area] || 'record'}${input.grade ? '-g' + input.grade : ''}${tag}${loose ? '-loose' : ''}`;
    const whatOne = what.replace(/[\r\n:#"']/g, ' ').replace(/\s+/g, ' ').trim();
    const description = `${loose ? '[과장 허용 — 메모에 없는 세부가 들어감] ' : ''}고등학교 생활기록부 ${area.name}${whatOne ? '(' + whatOne + ')' : ''} 초안 쓰기. 교사가 관찰 메모를 보내면 2026 기재요령에 맞는 특기사항 문단 하나를 씀`
      .replace(/[\r\n:#"']/g, ' ').replace(/\s+/g, ' ').slice(0, 200); // YAML 한 줄 값이 깨지지 않게(과목명에 ':' 등)
    const base = p.user.split('\n').filter(l => l && !/^교사 메모/.test(l));
    const system = p.system.split('\n').map(l => (l.startsWith('# ') ? '#' + l : l)).join('\n');
    const body = [
      `# 생기부 ${area.name} 초안${what ? ' — ' + what : ''}`, '',
      `이 지침은 '생기부 초안 도우미'에서 만들었습니다${today ? '(' + today + ')' : ''}. 기재요령이 바뀌면 앱에서 다시 받아 바꾸십시오.`, '',
      '## 쓰는 법',
      '- 교사가 보낸 관찰 메모(와 학년·과목 등)로 아래 규칙에 따라 생기부 문단 하나를 씁니다.',
      '- 메모가 없으면 문단을 지어내지 말고 "관찰 메모를 보내 주세요."라고만 답합니다.',
      '- 교과세특에서 교사가 관련 성취기준을 함께 보내면, 성취기준 문장·코드를 옮기지 말고 메모의 활동에서 학생이 무엇을 할 수 있게 되었는지로 드러냅니다(성취기준에 적힌 지식의 단순 서술은 지양). \'성취기준\'·\'성취과정\'·\'성취특성\'·\'성취수준\'이라는 낱말 자체는 문단에 쓰지 않습니다.',
      '- 교사가 관찰한 특성·변화·참여도를 함께 보내면 메모와 같은 사실로 다루고, 평가어("~한 태도를 보임") 대신 메모의 행동으로 드러냅니다. 참여도가 소극적이면 깎아내리지 말고 노력이나 달라질 가능성과 함께 씁니다. \'소극적\'·\'적극적\'·\'참여도\'라는 낱말은 문단에 쓰지 않습니다. 메모가 짧으면 관찰 내용도 하나씩 메모의 활동과 이어 풀어 써서 분량을 채우되, 관찰 내용에 적힌 행동을 넘는 새 행동·장면은 쓰지 않습니다.',
      // 사용자 결정(2026-10-26): 성취기준으로 분량을 채우는 것은 과장 허용일 때만
      ...(!loose ? ['- 메모에 성취기준과 이어지는 활동이 없으면 성취기준 내용을 지어내지 말고 그 성취기준은 건너뜁니다. 성적·성취도·등급은 쓰지 않습니다.'] : []),
      ...(loose ? ['- (과장 허용) 그래도 분량이 모자라면 교사가 보낸 성취기준과 이어지는 학습 과정을 메모의 활동 안에서 그럴듯하게 덧붙여 채웁니다. 성취기준 문장·코드·지식을 그대로 옮기지 않고, 별개의 새 활동은 만들지 않으며, 덧붙인 것은 목록에 적습니다.'] : []),
      '- 교사가 학년·과목·목표 분량을 따로 적으면 그 값을, 적지 않으면 아래 기본값을 씁니다.', '',
      '## 기본값', ...base.map(l => '- ' + l), '',
      system, '',
    ].join('\n');
    const markdown = ['---', `name: ${name}`, `description: ${description}`, '---', '', body].join('\n');
    return { name, description, markdown, body };
  }

  /* 분량 자동 맞춤: 한도를 넘었을 때만 한 번 더 고쳐 쓰게 할 메시지. 아니면 null.
   * (사용자 결정 2026-10-20) 넘친 문단은 나이스에 들어가지 않으므로 반드시 고친다.
   * 짧을 때는 다시 요청하지 않는다 — 2차 실행에서 6번 중 1번만 늘었고 무료 한도만 두 배로 썼다. 대신 shortNotice 로 교사에게 알린다.
   * 방식 A에서만 쓴다. 대화 이어 쓰기: [system, user, 모델 문단, 이 메시지] */
  // 목표 글자 수 → 문장 수 어림(공개 사례 문장 평균 68자, 한글 약 48~60자)
  const sentencesFor = (chars) => `${Math.max(2, Math.floor(chars / 60))}~${Math.max(3, Math.ceil(chars / 48))}`;
  // 문장 설계도: 목표 글자 수 ÷ 문장당 약 54자 = 문장 수, 작성 구조 항목마다 나눌 개수
  // 문장 수는 내림 — 반올림하면 목표 150~300자에서 문장 수×54자가 목표를 넘어 같은 프롬프트의 '하한~목표자'와 어긋났음(코드 점검 2026-10-22)
  const blueprint = (chars, items) => {
    const n = Math.max(3, Math.floor(chars / 54)), k = Math.max(1, items || 1);
    const lo = Math.floor(n / k), hi = Math.ceil(n / k);
    const assign = n < k ? `중요한 항목부터 문장을 1개씩 배정하고` : `${lo === hi ? lo : `${lo}~${hi}`}개씩 나눠 배정하고`;
    return { n, assign };
  };

  /* 과장 허용(factMode 'loose')일 때만: 목표 하한보다 짧으면 한 번 늘려 다시 쓰게 할 메시지. 아니면 null.
   * 사실만(기본)은 늘리지 않는다 — 2차 실행에서 6번 중 1번만 늘었고 무료 한도만 두 배로 썼음(위 buildLengthFix 설명).
   * 과장 허용은 덧붙일 거리를 허용하므로 늘어날 여지가 있다(사용자 요청 2026-10-21 '과장을 누를 경우 목표 분량에 최대한').
   * 자동으로 부르지 않고 교사가 '목표 분량까지 늘리기' 버튼을 누를 때만 쓴다(무료 사용량이 저절로 더 쓰이지 않게, 사용자 요청 2026-10-21).
   * 붙여 넣은 문단(방식 B)은 같은 글을 '늘리기 요청 복사'로 채팅에 보낸다.
   * opts.addOnly(방식 A 버튼): 문단 전체가 아니라 '더할 새 문장만' 받는다 — 실측(2026-10-23, reports/length-2026-10-23.md)에서 문단 전체를
   *   다시 쓰게 하면 3번 중 2번은 압축돼 오히려 짧아졌음(421→371자). 받은 문장은 insertGrown 이 지금 문단에 끼워 넣어 줄어들 수 없게 한다 */
  function buildLengthGrow(bytes, meta, opts) {
    if (meta.factMode !== 'loose') return null;
    const min = meta.lowChars * BYTES.hangul, max = meta.target * BYTES.hangul;
    if (bytes >= min) return null;
    const now = Math.round(bytes / BYTES.hangul), more = meta.lowChars - now;
    const what = `메모에 적힌 활동과 어울리는 세부(살펴본 자료, 정리·발표 방식, 과정과 순서, 맡은 일)와 드러난 역량·태도의 해석`;
    const ban = `메모에 없는 수치·수상·대회·도서명·인물·다른 사람의 반응, 메모와 별개인 새 활동, 평가어는 덧붙이지 마십시오.`;
    if (opts && opts.addOnly) {
      return `지금 문단은 한글 약 ${now}자로 목표(약 ${meta.lowChars}~${meta.target}자)보다 약 ${more}자 짧습니다. 지금 문단에 더할 새 문장만 ${sentencesFor(more)}개 쓰십시오(모두 합쳐 한글 약 ${more}~${meta.target - now}자). 지금 문단의 문장은 다시 쓰거나 되풀이하지 말고, 이미 쓴 내용과 겹치지 않게 ${what}을 담으십시오. 문장은 앞 문단과 같은 명사형(~함, ~임)으로 끝내십시오. 새 문장은 지금 문단의 마지막 문장 바로 앞에 들어가니, 그 앞 문장에서 이어지고 마지막 문장으로 자연스럽게 넘어가게 쓰십시오. ${ban} 더할 문장만 한 덩어리로 보내 주십시오.`;
    }
    return `지금 문단은 한글 약 ${now}자로 목표(약 ${meta.lowChars}~${meta.target}자)보다 약 ${more}자 짧습니다. 지금 문장은 빼거나 줄이지 말고 그대로 두고, ${what}을 문장 ${sentencesFor(more)}개쯤 더해 약 ${meta.lowChars}~${meta.target}자(${max}바이트 이하)로 늘려 주십시오. ${ban} 늘린 문단 본문만 보내 주십시오.`;
  }

  /* 늘리기(방식 A): 받은 새 문장을 지금 문단의 마지막 문장(보통 정리 문장) 바로 앞에 끼워 넣는다. 지금 문장은 그대로 남는다.
   * 모델이 지시를 어기고 문단 전체를 다시 보내도 지금 문장과 거의 같은 문장(글자 두 개씩 묶음이 긴 쪽 기준 60% 이상 겹침 — 짧은 문장이 긴 새 문장에 들어 있다고 빼지 않게)은 빼서 내용이 두 번 들어가지 않게 한다 */
  const splitSentences = (t) => String(t || '').trim().split(/(?<=[.!?])\s+/).map(x => x.trim()).filter(Boolean);
  const bigrams = (t) => { const s = t.replace(/\s+/g, ''), out = new Set(); for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2)); return out; };
  // 아주 짧은 문장(글자 묶음 8개 미만)은 똑같을 때만 같은 문장으로 본다
  const similar = (a, b) => { const A = bigrams(a), B = bigrams(b); if (A.size < 8 || B.size < 8) return a.replace(/\s+/g, '') === b.replace(/\s+/g, ''); let n = 0; for (const x of A) if (B.has(x)) n++; return n / Math.max(A.size, B.size) >= 0.6; };
  // 지금 문단에 없는 새 문장만(늘리기로 더한 문장 표시에도 씀)
  function addedSentences(current, added) {
    const cur = splitSentences(current);
    return splitSentences(added).filter(s => !cur.some(c => similar(c, s)));
  }
  function insertGrown(current, added) {
    const cur = splitSentences(current);
    const add = addedSentences(current, added);
    if (!add.length) return cur.join(' ');
    return cur.length < 2 ? cur.concat(add).join(' ') : cur.slice(0, -1).concat(add, cur.slice(-1)).join(' ');
  }

  function buildLengthFix(bytes, meta) {
    const max = meta.target * BYTES.hangul, min = meta.lowChars * BYTES.hangul;
    if (bytes <= max) return null;
    const overLimit = !meta.limit || bytes > meta.limit * BYTES.hangul; // 목표만 넘은 경우는 '나이스에 입력되지 않습니다'가 사실이 아님(QA 2026-10-24)
    return `지금 문단은 ${bytes}바이트(한글 약 ${Math.round(bytes / BYTES.hangul)}자)입니다. ${overLimit ? `한도 ${max}바이트(약 ${meta.target}자)를 넘어 나이스에 입력되지 않습니다` : `교사가 고른 목표 ${max}바이트(약 ${meta.target}자)를 넘었습니다`}. 뜻과 사실은 그대로 두고 문장을 압축해 ${min}~${max}바이트(약 ${meta.lowChars}~${meta.target}자)로 다시 쓰십시오. 고친 문단 본문만 보내 주십시오.`;
  }

  /* 다듬기 요청 메시지 (방식 A). 프롬프트 글을 한 곳에 모으려고 js/app.js 에서 옮겨 옴 */
  // factMode: 처음 만들 때 고른 방식('loose' 면 처음 프롬프트의 덧붙임 범위를 그대로 따름)
  function buildRefine(request, factMode) {
    const keep = factMode === 'loose' ? '메모에 없는 수치·수상·도서명·인물·다른 사람의 반응은 덧붙이지 말고' : '메모에 없는 사실은 덧붙이지 말고';
    return `다음 요청에 맞게 고쳐 주십시오: ${String(request || '').trim()}\n${keep}, 기재요령과 분량 규칙을 그대로 지키며, 고친 문단 하나만 출력하십시오.`;
  }

  /* 문단이 목표보다 짧을 때 교사에게 보여 줄 안내 (만든 뒤). 짧지 않으면 null.
   * 두 갈래: ① 메모를 더 적고 다시 만들기 ② 목표를 지금 문단 길이(10자 단위 올림)로 낮춰 그대로 쓰기.
   * 만들기 전 제안은 buildPrompt 의 meta.targetSuggestion(메모 길이 기준)이 따로 맡는다.
   * 메모에 비해 문단이 길면(메모 ×3 초과) 덧붙임이 들어갔을 수 있다고 함께 알린다. */
  function shortNotice(bytes, meta, memo) {
    const min = meta.lowChars * BYTES.hangul;
    if (bytes >= min) return null;
    const chars = Math.round(bytes / BYTES.hangul);
    const lowerTo = Math.min(meta.target, Math.ceil(chars / 10) * 10);
    const memoChars = String(memo || '').replace(/\s+/g, '').length;
    const padded = chars > memoChars * 3;
    return {
      chars, target: meta.target, lowerTo, memoChars, padded,
      message: `문단이 목표보다 짧습니다 (약 ${chars}자 / 목표 ${meta.target}자). ` +
        `메모에 활동 내용(무엇을, 어떻게, 결과는)을 더 적은 뒤 다시 만들거나, 목표를 ${lowerTo}자로 낮추면 지금 문단을 그대로 쓸 수 있습니다.` +
        (padded ? ` 메모(약 ${memoChars}자)에 비해 문단이 길어 메모에 없는 내용이 들어갔을 수 있으니 확인해 주세요.` : ''),
    };
  }

  /* AI 응답에서 생기부 문단만 남긴다.
   * 생기부 문장은 명사형(~함·~임·~음·~됨)으로 끝나고, 이 끝 글자는 모두 받침이 'ㅁ'이다(rules/prompt-base.json style).
   * 그래서 빈 줄로 나눈 덩어리 가운데 '받침 ㅁ 글자 + 마침표'로 끝나는 문장이 있는 덩어리만 남긴다.
   * 앞뒤 인사·제목·"더 필요하면…" 같은 안내는 이런 문장이 없어서 빠진다. 하나도 없으면 가장 긴 덩어리를 쓴다. */
  const endsWithNounForm = (sentence) => {
    const m = sentence.match(/([가-힣])\s*\.\s*$/);
    if (!m) return false;
    const code = m[1].charCodeAt(0) - 0xAC00;
    return code % 28 === 16; // 종성 16 = ㅁ
  };
  const stripMarkup = (s) => s
    .replace(/^\s*(#{1,6}\s+|[-*•]\s+|\d+[.)]\s+|>\s*)/gm, '') // 제목·목록·번호·인용 표시
    .replace(/\*\*|`/g, '')                                         // 굵게·코드 표시 (밑줄 __ 는 '__테스트__' 같은 글자라 건드리지 않음)
    .trim();
  // 문단 바로 앞 줄의 짧은 머리말('완성 문단:' 등)과 문단 끝에 붙인 길이 표시('(약 480자)', '(공백 포함 1,450바이트)')는 뗀다
  // — 같은 덩어리 안에 있으면 전에는 그대로 남아 복사될 수 있었음
  const LABEL_LINE = /^[^\n.]{1,30}[:：]\s*\n/;
  const LENGTH_NOTE = /\s*[(\[]\s*(?:공백\s*(?:포함|제외)\s*)?(?:약\s*)?[\d,]+\s*(?:자|글자|바이트|Byte|byte)[^()\[\]]{0,20}[)\]]\s*$/;
  // 문단 뒤에 붙는 설명 줄('※ 메모에 없는 내용은 넣지 않았음.', '글자 수: 약 480자', '- 금지 표현: 없음.')과
  // 같은 덩어리 안의 채팅 말('네, 작성했습니다.', '더 필요하면 말씀해 주세요.') — 전에는 줄바꿈 하나로만 붙으면 문단에 섞여 복사될 수 있었음(QA 2026-10-21)
  const NOTE_LINE = /^\s*(?:※|(?:글자\s*수|바이트|금지\s*표현|참고|분량|확인)\s*[:：])/;
  const CHAT_LINE = /(?:니다|세요|어요|아요|해요|게요|까요|군요)\s*[.!?~]*\s*$/;
  function cleanLines(c) {
    const lines = c.split('\n').filter(l => !NOTE_LINE.test(l));
    const rec = lines.filter(l => !CHAT_LINE.test(l.trim()));
    return (lines.length > 1 && rec.length ? rec : lines).join('\n');
  }
  // 과장 허용의 '덧붙인 내용' 목록(문단 뒤). 문단을 뽑을 때는 떼어 낸다 — 목록 줄도 '~함'으로 끝날 수 있어 문단에 섞이지 않게
  // 표시에 '나이스에 넣지 않음'을 넣는다 — 채팅에서 답을 통째로 복사해 붙이는 교사가 목록까지 넣지 않게(에이전트 검증 2026-10-23)
  const ADDED_MARK = '[덧붙인 내용 — 나이스에 넣지 않음]';
  // 표시를 조금 다르게 써도 알아본다: [덧붙인 내용…], **덧붙인 내용**, 덧붙인 내용:, 【덧붙인 내용】 — 줄 맨 앞에서만(문장 속 낱말은 아님)
  const ADDED_LINE = /^[ \t]*(?:[-*•·]|\d+[.)])?[ \t]*[*#>]*[ \t]*[\[【(]?[ \t]*덧붙인[ \t]*내용[^\]】)\n:：]*[\]】)]?[*]*[ \t]*[:：]?[*]*[ \t]*(.*)$/m;
  const ITEM_PREFIX = /^\s*(?:[-*•·▪◦]|\d+[.)]|[①-⑳])\s*/;
  /* 응답을 문단 쪽(body)과 목록(items)으로 나눈다. 목록이 문단 앞에 와도 목록 뒤 빈 줄 다음 글은 문단으로 남긴다.
   * items: null = 표시 없음, [] = '없음'이라고 함, 그 밖 = 항목들(글머리표·번호·글머리표 없는 줄·한 줄에 쉼표로 이어 쓴 것 모두) */
  function splitAdded(text) {
    let t = String(text || ''), m = t.match(ADDED_LINE);
    // 문단과 같은 줄에 붙은 '[덧붙인 내용…]'(대괄호 표시만) — 그 앞에서 줄을 나눠 다시 찾는다(에이전트 검증 2026-10-24: 목록이 문단에 남았음)
    if (!m) { const k = t.search(/\[[ \t]*덧붙인[ \t]*내용[^\]\n]*\]/); if (k > 0) { t = t.slice(0, k) + '\n' + t.slice(k); m = t.match(ADDED_LINE); } }
    if (!m) return { body: t, items: null };
    const after = t.slice(m.index + m[0].length).split('\n');
    const items = (m[1] || '').trim() ? m[1].split(/[,，;]|\s+[-•·]\s+/) : []; // 표시와 같은 줄에 쉼표나 ' - '로 이어 쓴 목록
    let i = 0;
    while (i < after.length && !after[i].trim()) i++; // 표시 바로 뒤 빈 줄
    // 빈 줄 없이 문단이 이어지면(문장 둘 이상이 든 긴 줄) 거기서 목록을 끝낸다 — 문단이 통째로 목록이 되던 것(에이전트 검증 2026-10-24)
    const looksParagraph = (l) => l.trim().length > 40 && (l.match(/[.!?](\s|$)/g) || []).length >= 2;
    for (; i < after.length && after[i].trim() && !looksParagraph(after[i]); i++) items.push(after[i]);
    const rest = after.slice(i).join('\n');
    const clean = items.map(l => l.replace(ITEM_PREFIX, '').replace(/^["'“‘「]+|["'”’」]+$/g, '').trim()).filter(l => l && !/^(없음|해당\s*없음)\.?$/.test(l));
    return { body: t.slice(0, m.index) + '\n\n' + rest, items: clean };
  }
  const extractAddedList = (text) => splitAdded(text).items;
  // 설명 목록 덩어리: 모든 줄이 글머리표·번호로 시작하거나, 짧은 머리말(…:, **굵게**, ) 뒤에 목록만 오는 것 — '작성 포인트:'·'반영한 점' 같은 설명(QA 2026-10-24: 문단에 섞였음)
  const LIST_LINE = /^\s*(?:[-*•·▪◦]|\d+[.)]|[①-⑳])\s+/;
  const HEAD_LINE = /^\s*(?:\*\*[^*\n]{1,30}\*\*|[^\n]{1,30}[:：]|[]\s*[^\n]{0,30})\s*$/;
  // 머리말 없이 글머리표 한 줄뿐이면 문단에 표시만 붙인 것으로 본다(예: '- 문단 전체')
  const isListChunk = (c) => { const ls = c.split('\n').filter(l => l.trim()); const head = HEAD_LINE.test(ls[0] || ''); const body = head ? ls.slice(1) : ls; return body.length > 0 && (head || body.length >= 2) && body.every(l => LIST_LINE.test(l)); };
  const LEAD_LABEL = /^(?:완성(?:된)?\s*문단|최종\s*문단|생기부\s*문단|문단|초안|결과)\s*[:：]\s*/;
  /* 문단과 함께, 버린 다른 문단 덩어리 수(extra)를 돌려준다. 문단 덩어리가 여럿이면(버전 1·2, '더 짧은 버전') 첫 덩어리만 쓰고 알린다(QA 2026-10-24: 이어 붙여졌음) */
  function extractParagraphInfo(text) {
    text = splitAdded(text).body.replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\t/g, ' ');
    const raw = String(text || '').split(/\n\s*\n|\n\s*(?:-{3,}|\*{3,}|_{3,})\s*(?:\n|$)/).filter(c => c.trim() && !isListChunk(c))
      // 덩어리 첫 줄이 '버전 1:' 같은 짧은 머리말이면 그 줄만 뗀다
      .map(c => { const ls = c.split('\n'); return ls.length > 1 && HEAD_LINE.test(ls[0]) ? ls.slice(1).join('\n') : c; });
    const chunks = raw.map(stripMarkup).map(cleanLines).map(c => c.replace(LABEL_LINE, '').replace(LEAD_LABEL, '').trim()).filter(Boolean);
    if (!chunks.length) return { text: '', extra: 0 };
    const isRecord = (c) => c.split(/(?<=\.)\s+/).some(endsWithNounForm);
    const kept = chunks.filter(isRecord);
    const body = kept.length ? kept[0] : chunks.reduce((a, b) => (b.length > a.length ? b : a));
    const flat = body.replace(/\s*\n\s*/g, ' ').trim().replace(LENGTH_NOTE, '');
    // 앞 따옴표는 문단 전체를 감쌌을 때(끝에도 따옴표)만 뗀다 — '‘어린 왕자’를 읽고…함.'처럼 제목으로 시작하는 문단의 앞 따옴표가 지워졌음
    const wrapped = /^["“'‘「]/.test(flat) && /["”'’」]$/.test(flat);
    return { text: (wrapped ? flat.replace(/^["“'‘「]+/, '') : flat).replace(/["”'’」]+$/, '').trim(), extra: Math.max(0, kept.length - 1) };
  }
  const extractParagraph = (text) => extractParagraphInfo(text).text;

  return { factText, buildPrompt, buildSkill, evalFactorItems, lensItems, kyogwaFor, kyogwaItems, detectKyogwa, curriculumYear, emphasisFor, detectSubjectGroup, buildLengthFix, buildLengthGrow, insertGrown, addedSentences, splitSentences, extractAddedList, ADDED_MARK, buildRefine, shortNotice, extractParagraph, extractParagraphInfo, pickExamples, exampleScore, exampleGroupOf: groupOf, EXAMPLE_GROUPS: ['국어', '수학', '영어', '사회', '과학', '정보', '기술·가정', '예술', '체육', '제2외국어·한문', '교양'], substitutionRules, suggestTarget, memoQuestions, observationLines, OBS_GROUP, normSubject, findStandardsSubject, similarSubjects, countPraise, PRAISE_WORDS, AREA_KIND };
});
