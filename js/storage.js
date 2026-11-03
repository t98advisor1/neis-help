'use strict';
/* 이 기기(브라우저)에만 저장한다. 서버로 보내지 않는다 (PLAN 0-2).
 * 모든 키는 'sm.' 으로 시작한다 — 다른 앱의 저장값을 건드리지 않고, 지울 때도 이 앱 것만 지운다.
 * 사생활 보호 모드 등에서 저장이 막혀도 앱은 동작해야 하므로 읽기·쓰기를 모두 try 로 감싼다. */
(function (root) {
  const P = 'sm.';
  const KEYS = {
    draft: 'draft',           // 만들기 탭 입력값 (자동 저장)
    saved: 'saved',           // 저장한 문단 목록
    apiKey: 'apiKey',         // Gemini API 키 — 백업 파일에 넣지 않음
    model: 'model',
    checker: 'checkerSettings', // student-record 설정 파일에서 가져온 점검 규칙
    welcomed: 'welcomed',
    lastBackup: 'lastBackup',
    refOn: 'refOn',            // 올린 자료 카드 중 초안에 반영할 것 {카드id: true}
    custom: 'customChips',     // 교사가 직접 추가한 칩 {emph|kg|comp|trait|change: {묶음키: [이름]}}
    myEx: 'myExamples',        // 교사가 직접 넣은 참고 예시 [{id, areas, subject, text, …}]
    myRules: 'myCheckerRules', // 교사가 직접 더한 점검 규칙 {ban: [{term, alt}], allow: [표현]} — 기본·가져온 규칙 위에 덧붙임
    viewWidth: 'viewWidth',    // 컴퓨터 화면 폭 'wide'(기본)|'narrow' — 이 기기 설정이라 백업 파일에 넣지 않음. index.html 머리의 짧은 스크립트도 같은 키를 읽음
    result: 'lastResult',      // 저장 전 완성 문단(만든 때 입력 포함) — 새로고침·안드로이드 탭 다시 불러오기에도 남게. 백업 파일에는 넣지 않음
  };

  // 기본값이 목록([])이나 묶음({})인데 저장값의 타입이 다르면(옛 버전·손상된 값, 'null' 등) 기본값을 돌려준다
  // — 전에는 sm.myExamples 가 목록이 아니면 앱이 아예 열리지 않았고, sm.saved 가 목록이 아니면 저장함이 멈췄음. 저장값 자체는 고치지 않음
  const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
  function get(k, fallback) {
    try {
      const v = localStorage.getItem(P + k);
      if (v == null) return fallback;
      const r = JSON.parse(v);
      if (Array.isArray(fallback) && !Array.isArray(r)) return fallback;
      if (isObj(fallback) && !isObj(r)) return fallback;
      return r;
    } catch (e) { return fallback; }
  }
  let cleared = false; // 모두 지운 뒤 다시 열리기 전까지는 쓰지 않는다(늦게 도는 자동 저장이 메모를 다시 남기지 않게)
  function set(k, v) {
    if (cleared) return false;
    try { localStorage.setItem(P + k, JSON.stringify(v)); return true; }
    catch (e) { return false; }
  }
  function remove(k) {
    try { localStorage.removeItem(P + k); } catch (e) { /* 무시 */ }
  }

  /* 백업: 저장 문단·점검 규칙·직접 추가한 칩·내 예시. API 키는 넣지 않는다 */
  function exportAll() {
    return {
      app: 'sangibu-maker', version: 1, exportedAt: new Date().toISOString(),
      saved: get(KEYS.saved, []),
      checkerSettings: get(KEYS.checker, null),
      customChips: get(KEYS.custom, {}),
      myExamples: get(KEYS.myEx, []),
      myCheckerRules: get(KEYS.myRules, { ban: [], allow: [] }),
    };
  }
  /* student-record 점검 규칙 형식인지(dictionary 배열, 항목마다 terms 배열). 틀린 값이 저장되면 모든 점검·프롬프트가 멈춘다.
   * 백업 불러오기와 자료 탭 '설정 파일 가져오기'가 같은 기준을 쓰도록 여기 한 곳에 둔다 */
  const isCheckerSettings = (cs) => !!cs && Array.isArray(cs.dictionary) && cs.dictionary.every(d => d && Array.isArray(d.terms)) && cs.dictionary.some(d => d.terms.length > 0); // 금지어가 하나도 없으면 점검이 사실상 꺼지므로 받지 않음

  /* 가져오기: 같은 id 는 건너뛰고 새 것만 더한다 (지금 기기의 문단을 덮어쓰지 않음) */
  function importAll(data) {
    if (!data || data.app !== 'sangibu-maker' || !Array.isArray(data.saved)) throw new Error('이 앱의 백업 파일이 아닙니다.');
    const cur = get(KEYS.saved, []);
    const ids = new Set(cur.map(x => x.id));
    // id 는 글자로 맞춘다(숫자 id 는 화면 버튼의 data-id 와 맞지 않아 지우기·고치기가 안 됨). 파일 안에서 같은 id 가 겹치면 한 번만
    // 학년·반·번호는 숫자로 맞춘다 — 남이 만든 백업 파일에 글자(꺾쇠·따옴표 등)가 들어 있으면 저장함·엑셀 고르기 칸에 코드가 끼어들 수 있음
    // 숫자만으로 된 값만 받는다(섞인 글자에서 숫자를 골라내면 '1"><img…=1' 이 11반이 되는 식으로 엉뚱한 값이 생김)
    const no = (v, max) => { const t = String(v == null ? '' : v).trim(); if (!/^\d{1,3}$/.test(t)) return ''; const n = Number(t); return n >= 1 && n <= max ? n : ''; };
    const add = data.saved.filter(x => x && x.id && typeof x.text === 'string')
      // createdAt 도 글자로 맞춘다(숫자면 저장함 엑셀 정렬이 멈췄음)
      .map(x => ({ ...x, id: String(x.id), grade: no(x.grade, 3), cls: no(x.cls, 99), num: no(x.num, 99), createdAt: typeof x.createdAt === 'string' ? x.createdAt : '' })).filter(x => !ids.has(x.id) && ids.add(x.id));
    // 저장 공간이 모자라 못 썼으면 "가져왔어요"라고 하지 않는다
    if (!set(KEYS.saved, cur.concat(add).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))))) throw new Error('저장 공간이 모자라 가져오지 못했어요.');
    // 점검 규칙은 student-record 형식(dictionary 배열, 항목마다 terms 배열)일 때만 — 틀린 값이면 모든 점검이 멈춤
    const cs = data.checkerSettings;
    if (isCheckerSettings(cs) && !get(KEYS.checker, null)) set(KEYS.checker, cs);
    // 직접 추가한 칩: 지금 기기 것과 합친다(겹치면 한 번만)
    if (data.customChips && typeof data.customChips === 'object') {
      const cur = get(KEYS.custom, {});
      // trait·change: 관찰한 특성·변화 직접 추가(2026-10-24, 변화는 60자까지) — 전에는 빠져서 백업을 불러오면 사라졌음
      const maxLen = { trait: 30, change: 60 };
      for (const kind of ['emph', 'kg', 'comp', 'trait', 'change']) for (const key of Object.keys((data.customChips[kind] && typeof data.customChips[kind] === 'object') ? data.customChips[kind] : {})) {
        const names = data.customChips[kind][key]; if (!Array.isArray(names)) continue; // 칩 이름 목록이 아니면 건너뜀. 이름은 화면에서 추가할 때와 같이 30자까지(프롬프트에 그대로 들어감)
        cur[kind] = cur[kind] || {};
        cur[kind][key] = [...new Set((cur[kind][key] || []).concat(names.filter(n => typeof n === 'string' && n.trim() && n.length <= (maxLen[kind] || 30))))];
      }
      set(KEYS.custom, cur);
    }
    // 내 규칙: 지금 기기 것과 합친다(같은 낱말은 한 번만, 지금 기기 쪽 바꿔 쓸 말을 남김)
    if (data.myCheckerRules && typeof data.myCheckerRules === 'object') {
      const cur = get(KEYS.myRules, { ban: [], allow: [] });
      const ban = (cur.ban || []).slice();
      const arr = (v) => (Array.isArray(v) ? v : []); // 배열이 아니면 중간에 멈춰 절반만 가져오던 것을 막음
      for (const b of arr(data.myCheckerRules.ban)) if (b && b.term && !ban.some(x => x.term === b.term)) ban.push({ term: String(b.term), alt: String(b.alt || '') });
      const allow = [...new Set((cur.allow || []).concat(arr(data.myCheckerRules.allow).filter(x => typeof x === 'string')))];
      set(KEYS.myRules, { ban, allow });
    }
    // 내 예시: 같은 id 는 건너뛰고 더한다
    if (Array.isArray(data.myExamples)) {
      const mine = get(KEYS.myEx, []); const have = new Set(mine.map(x => x.id));
      // areas 가 배열이 아니면 만들기 탭이 멈추므로 뺀다. engine_flags 는 배열로 맞춘다
      set(KEYS.myEx, mine.concat(data.myExamples.filter(x => x && x.id && typeof x.text === 'string' && Array.isArray(x.areas))
        .map(x => ({ ...x, id: String(x.id), engine_flags: Array.isArray(x.engine_flags) ? x.engine_flags.map(String) : [] }))
        .filter(x => !have.has(x.id) && have.add(x.id))));
    }
    return add.length;
  }

  // 이 앱 저장값('sm.' 으로 시작하는 것)만 모두 지운다 — 공용 컴퓨터에서 쓴 뒤 키·메모·저장함을 남기지 않으려고. 지운 개수를 돌려준다
  function clearAll() {
    let n = 0;
    try {
      const ks = [];
      for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(P)) ks.push(k); }
      for (const k of ks) { localStorage.removeItem(k); n++; }
    } catch (e) { /* 무시 */ }
    cleared = true;
    return n;
  }

  root.SMStore = { KEYS, get, set, remove, clearAll, exportAll, importAll, isCheckerSettings };
})(typeof self !== 'undefined' ? self : this);
