'use strict';
/* 자동 점검: student-record 검사 엔진(vendor/sr-rules.js) + 이 앱에서만 덧붙이는 검사 (PLAN 6-4).
 * 엔진은 고치지 않는다. 엔진이 다루지 않는 것(학생 시점 표현, 학생 이름·반번호 패턴)만 여기서 같은 결과 형식으로 더한다.
 * 브라우저(<script>, 전역 SRRules 필요)와 node(require) 양쪽에서 쓴다.
 */
(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports
    ? require('../vendor/sr-rules.js')
    : root.SRRules);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SMChecks = api;
})(typeof self !== 'undefined' ? self : this, function (SR) {

  /* 학생 시점 표현. 서술형은 교사가 관찰·평가한 내용으로 쓴다(기재요령 인쇄 27쪽).
   * 띄어쓰기가 달라도 잡도록 글자 사이 공백을 허용한다. */
  const STUDENT_VIEW = ['깨달음', '깨닫', '느꼈', '느낌을 받', '__FEEL_END__', '다짐', '결심', '알게 됨', '알게 되', '계기가 됨', '계기가 되', '생각하게 됨', '생각하게 되'];
  const spaced = (w) => new RegExp(w.replace(/\s+/g, '').split('').join('\\s*'), 'g');
  // 문장 끝의 '느낌'(= 느끼다의 명사형 종결, 예: '성취감을 느낌.'). 문장 가운데 명사 '느낌'('시의 느낌을 표현함')은 잡지 않는다
  const FEEL_END = /느낌(?=\s*(?:[.。!?]|$))/gm;

  /* 학생 이름 패턴: 성씨 + 이름 2글자 + '학생/군/양'. 개인정보 입력 칸 없음 원칙(PLAN 0-2)의 보조 장치 */
  const SURNAMES = '김이박최정강조윤장임한오서신권황안송류유전홍고문양손배백허남심노하곽성차주우구민진지엄채원천방공현함변염여추도소석선설마길연위표명기반왕금옥육인맹제탁국은편용예경봉';
  // '학생회·학생부' 같은 낱말은 빼고, '학생은/학생이'처럼 조사가 붙는 경우는 잡는다
  // 낱말 첫머리에서만 잡고('반장으로 학생'의 '장으로'), 끝 글자가 '는·던·할·될'이면 꾸밈말로 본다('참여하는 학생'의 '여하는') — 완성 문단에도 켜면서 더함
  const NAME_RE = new RegExp('(?<![가-힣])[' + SURNAMES + '][가-힣][가-힣](?<![는던할될])(?=\\s?(학생(?![회부증들])|군|양))', 'g');
  // 성씨 글자로 시작해 이름처럼 보이는 꾸밈말 ('매우 우수한 학생'). 이 낱말일 때만 정확히 뺀다 — 이름 검사는 넓게 유지
  const NOT_NAMES = new Set(['우수한', '성실한', '유능한', '차분한', '조용한', '정직한', '명랑한', '유쾌한', '소심한', '유일한', '성숙한', '진지한', '진취적', '모범적', '신중한', '안정적', '한명의', '한명이', '고등학',
    // 완성 문단에 자주 나오는 '~한 학생' 꾸밈말 (2026-10-21, 완성 문단에도 이름 검사를 켜며 공개 사례 112개로 확인)
    '노력한', '주도한', '성장한', '조사한', '정리한', '구성한', '고민한', '표현한', '기여한', '진행한', '연구한', '설명한', '도전한', '소통한', '소개한', '정확한', '전달한', '주목한', '공감한', '공유한', '성취한', '변화한', '발전한', '경험한', '문제를']);

  /* 반·번호·학번: 저장함의 반·번호 칸은 AI로 보내지 않는데(사용자 결정 2026-10-21) 메모에 적으면 그대로 나가므로 메모에서도 잡는다 */
  const STUDENT_NO_RE = /\d{1,2}\s*반\s*\d{1,2}\s*번|학번\s*[:：]?\s*\d{4,6}|\d{1,2}\s*번\s*학생/g;

  /* opts.names: 이름·반번호 패턴 검사. 메모(전송 전)와 완성 문단 모두 켠다.
   * 처음에는 완성 문단에서 '우수한 학생' 같은 말을 잘못 잡아 껐으나(PLAN 6-4) NOT_NAMES 로 거른 뒤, 붙여 넣은 문단의 '김민수 학생'을
   * 놓치던 것을 막으려고 켬(2026-10-21 사용자 결정 — 알림일 뿐 복사는 막지 않음) */
  function extraChecks(text, opts) {
    const raw = String(text == null ? '' : text);
    const names = !opts || opts.names !== false;
    const out = [];
    const feelHits = [...raw.matchAll(FEEL_END)].map(m => Object.assign(m, { word: '느낌' }));
    for (const w of STUDENT_VIEW) {
      for (const m of (w === '__FEEL_END__' ? feelHits : raw.matchAll(spaced(w)))) {
        out.push({
          ruleId: 'sm-student-view', severity: 'warning', category: '학생 시점 표현',
          message: `‘${m[0]}’ — 학생의 내면을 단정하는 표현`,
          basis: '서술형 항목은 교사가 직접 관찰·평가한 내용을 근거로 입력 (기재요령 제4조 처리요령, 인쇄 27쪽)',
          alt: '관찰한 행동으로 바꿈 (예: ‘협력의 중요성을 깨달음’ → ‘협력의 중요성을 발표에서 설명함’)',
          term: m[0], start: m.index, end: m.index + m[0].length,
        });
      }
    }
    if (names) for (const m of raw.matchAll(NAME_RE)) {
      if (NOT_NAMES.has(m[0])) continue;
      out.push({
        ruleId: 'sm-person-name', severity: 'warning', category: '학생 이름으로 보이는 표현',
        message: `‘${m[0]}’ — 학생 이름일 수 있음`,
        basis: '이 앱은 학생 개인정보를 받지 않음. AI로 보내기 전에 이름을 지움',
        alt: '이름을 빼고 활동 내용만 적음',
        term: m[0], start: m.index, end: m.index + m[0].length,
      });
    }
    if (names) for (const m of raw.matchAll(STUDENT_NO_RE)) {
      out.push({
        ruleId: 'sm-student-no', severity: 'warning', category: '학생을 알아볼 수 있는 번호',
        message: `‘${m[0]}’ — 반·번호·학번은 AI로 보내지 않음`,
        basis: '반·번호는 저장함 칸에만 적고, 메모에는 적지 않음',
        alt: '반·번호를 빼고 활동 내용만 적음',
        term: m[0], start: m.index, end: m.index + m[0].length,
      });
    }
    return out;
  }

  /* 완성 문단 점검 = 엔진 결과 + 덧붙인 검사. settings 는 student-record 설정 파일 형식
   * (dictionary, limits, allowlist, disabledRules, disabledPatterns, checkLength, checkEnding) 을 그대로 받는다. */
  function checkDraft(text, areaKey, settings) {
    const s = settings || {};
    const engine = SR.checkText(text, areaKey, {
      dictionary: s.dictionary, limits: s.limits, allowlist: s.allowlist,
      disabledRules: s.disabledRules, disabledPatterns: s.disabledPatterns,
      checkLength: s.checkLength, checkEnding: s.checkEnding,
    });
    return engine.concat(extraChecks(text, { names: true }));
  }

  /* 내 규칙 덧붙이기: 기본(또는 가져온) 설정 위에 교사가 이 기기에서 더한 금지어·허용 표현을 얹는다.
   * 금지어는 student-record 와 같은 '직접 넣은 금지어'(custom-ban) 항목에 넣어 엔진이 그대로 검사하게 하고,
   * 바꿔 쓸 말은 낱말별 대체어(altByTerm)로 단다. 원래 설정은 고치지 않고 새 객체를 돌려준다. */
  const CUSTOM_BAN_ID = 'custom-ban';
  function applyMyRules(settings, my) {
    const s = JSON.parse(JSON.stringify(settings || {}));
    const ban = (my && Array.isArray(my.ban) ? my.ban : []).filter(b => b && String(b.term || '').trim());
    const allow = (my && Array.isArray(my.allow) ? my.allow : []).map(x => String(x || '').trim()).filter(Boolean);
    if (ban.length) {
      s.dictionary = Array.isArray(s.dictionary) ? s.dictionary : JSON.parse(JSON.stringify(SR.DICTIONARY));
      let c = s.dictionary.find(d => d.id === CUSTOM_BAN_ID);
      if (!c) {
        c = { id: CUSTOM_BAN_ID, category: '직접 넣은 금지어', severity: 'violation', clause: null, source: '직접 넣은 규칙',
          basis: '교사가 직접 넣은 낱말입니다. 기재요령 조항이 아니라 학교·학년 사정에 따른 자체 기준입니다', terms: [], enabled: true };
        s.dictionary.push(c);
      }
      c.enabled = true;
      c.terms = [...new Set((c.terms || []).concat(ban.map(b => String(b.term).trim())))];
      for (const b of ban) if (String(b.alt || '').trim()) { c.altByTerm = c.altByTerm || {}; c.altByTerm[String(b.term).trim()] = String(b.alt).trim(); }
    }
    if (allow.length) s.allowlist = [...new Set((Array.isArray(s.allowlist) ? s.allowlist : []).concat(allow))];
    return s;
  }

  function summarize(findings) {
    const c = { violation: 0, warning: 0, info: 0 };
    for (const f of findings) c[f.severity] = (c[f.severity] || 0) + 1;
    return c;
  }

  /* 메모 점검(AI로 보내기 전): 이름·반·번호 패턴 + 엔진의 개인정보 형식(전화·주민번호·이메일)·학교명 형식(p-school)
   * 학교명은 메모 안내(이름·학교명·연락처는 빼고)와 AGENTS 원칙대로 전송 전에 잡는다 — 전에는 개인정보 분류만 걸러 학교명이 빠졌음 */
  /* 학교 줄임말(메모만): '한빛여고', '한빛고 2학년', '한빛고에서'. 엔진의 학교명 형식은 '○○고등학교'만 잡아 줄임말이 그냥 나갔음(QA 2026-10-21).
   * '~하고'·'~되고' 같은 끝말과 '활동 중에'를 잡지 않게 여고·여중은 낱말 끝, 고·중은 뒤에 '에서'·'N학년'이 올 때만 */
  const SCHOOL_SHORT_RE = /(?<![가-힣])[가-힣]{2,5}(?:여고|여중)(?![가-힣])|(?<![가-힣])[가-힣]{2,4}(?<![하되이며])(?:고(?=에서|\s?[1-3]\s?학년)|중(?=\s?[1-3]\s?학년))/g;
  function checkMemo(text) {
    const engine = SR.checkText(text, 'etc', { checkLength: false, checkEnding: false })
      .filter(f => /개인정보/.test(f.category) || f.ruleId === 'p-school');
    const school = [...String(text == null ? '' : text).matchAll(SCHOOL_SHORT_RE)]
      .filter(m => !engine.some(f => f.start <= m.index && m.index < f.end))
      .map(m => ({ ruleId: 'sm-school-short', severity: 'warning', category: '학교명으로 보이는 표현', message: `‘${m[0]}’ — 학교 이름일 수 있음`,
        basis: '이 앱은 학생·학교를 알아볼 수 있는 정보를 AI로 보내지 않음', alt: '학교 이름을 빼고 활동 내용만 적음',
        term: m[0], start: m.index, end: m.index + m[0].length }));
    return engine.concat(school, extraChecks(text, { names: true }).filter(f => f.ruleId === 'sm-person-name' || f.ruleId === 'sm-student-no'));
  }

  return { extraChecks, checkDraft, applyMyRules, checkMemo, summarize, STUDENT_VIEW: STUDENT_VIEW.filter(w => !w.startsWith('__')), countNeisBytes: SR.countNeisBytes, SOURCE: SR.SOURCE };
});
