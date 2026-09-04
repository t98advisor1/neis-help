'use strict';
/* 생기부 금지어 탐색기 — 화면 로직.
 *
 * 파일은 FileReader 로 읽어 SheetJS 로 파싱한다. 서버로 올리지 않는다.
 * 검사 판단은 전부 rules.js 에 있고, 이 파일은 입력을 모으고 결과를 그리는 일만 한다.
 */
(function () {

const R = window.SRRules;
const $ = (sel) => document.querySelector(sel);

/* 규칙셋의 근거 문서 판. 저장해 둔 설정이 이 판과 다르면 그대로 되살리지 않는다 —
 * 글자수 한도나 조항이 바뀐 상태에서 옛 설정을 덮어쓰면 틀린 기준으로 검사하게 된다. */
const RULES_VERSION = '2026-고';

/* 교사가 직접 넣은 금지어를 담는 사전 항목. 기본 사전과 섞이면 나중에 기본값을
 * 갱신할 때 어느 쪽이 손으로 넣은 것인지 알 수 없어 별도 항목으로 고정해 둔다. */
const CUSTOM_BAN_ID = 'custom-ban';

const CAUTION_TEXT =
  '[주의] 본 프로그램은 참고용 자료입니다. 내용의 오류나 누락이 있을 수 있으므로 ' +
  '최종 판단은 반드시 교사가 직접 확인해 주시기 바랍니다.';

/* ── 상태 ──────────────────────────────────────────────────── */
const state = {
  source: 'excel',   // 'excel' | 'pdf' | 'mixed' — 연 파일들의 종류
  fileName: '',      // 화면 표시용. 여러 개면 'N개 파일'
  docs: [],          // 파일 한 벌씩. { source, name, grid/columns … | students/segments }
  findings: [],
  duplicates: [],
  checked: false,    // 한 번이라도 검사를 돌렸는가 (findings.length 로 판단하면 0건일 때 틀린다)
  // 교사가 '확인함'으로 넘긴 지적. 생기부 본문이 디스크에 남으면 안 되므로
  // 저장하지 않고 이 탭이 열려 있는 동안만 들고 있는다.
  resolved: new Set(),
  fileKey: '',       // 파일 내용의 지문. 확인 표시를 이 열쇠로 찾아 온다
  restored: 0,       // 이번에 되살린 확인 표시 건수 (안내에만 쓴다)
  settingsPending: false,   // 서버로 올리지 못한 규칙 변경이 남아 있는가
  serverOk: true,           // server.js 에 닿는가 (파일을 직접 열면 false)
  onlyUnresolved: false,
  // 방금 [N건 모두 확인] 으로 넘긴 지적들. 900건이 한 번에 넘어가는 자리라
  // 되돌릴 길이 없으면 잘못 누른 순간 그 900건을 영영 안 보게 된다.
  lastBulk: null,
  saveFailed: false,   // 확인 표시를 브라우저에 남기지 못했다 (저장 공간 부족)
  catMode: 'term',   // 유형별 탭에서 무엇으로 묶을지: 'term'(금지어) | 'category'(유형)
  settings: defaultSettings(),
};

function emptyCustomBan() {
  return {
    id: CUSTOM_BAN_ID, category: '직접 넣은 금지어', severity: 'violation',
    clause: null, source: '직접 넣은 규칙',
    basis: '교사가 직접 넣은 낱말입니다. 기재요령 조항이 아니라 학교·학년 사정에 따른 자체 기준입니다',
    terms: [], enabled: true,
  };
}

/* 예전에 저장해 둔 설정에는 이 항목이 없다. 없으면 그 자리에서 만들어 붙인다. */
function customBan() {
  let e = state.settings.dictionary.find(d => d.id === CUSTOM_BAN_ID);
  if (!e) { e = emptyCustomBan(); state.settings.dictionary.push(e); }
  return e;
}

function defaultSettings() {
  return {
    limits: R.AREAS.reduce((o, a) => { o[a.key] = a.limit; return o; }, {}),
    dictionary: JSON.parse(JSON.stringify(R.DICTIONARY)).concat([emptyCustomBan()]),
    disabledPatterns: [],
    disabledRules: [],   // 문맥(근접) 규칙 끄기
    // 기본값은 비워 둔다. 기재요령이 금지한 것은 일단 모두 지적하는 편이 안전하고,
    // 예외는 교사가 문서를 확인한 뒤 직접 넣는 것이 맞다.
    // 특히 '대회'가 들어간 말은 넣지 말 것 — 기재요령은 '대회'라는 용어 자체를
    // 수상경력 외 항목에 쓰지 못하게 하므로 교내 행사라도 기재 불가다.
    allowlist: [],
    checkLength: true,
    checkEnding: true,
    dupMinLen: 20,
    rulesVersion: RULES_VERSION,
  };
}

/* ── 확인 표시 이어보기 ──────────────────────────────────────
 * 학급 하나가 지적 수천 건이라 하루에 다 못 본다. 어디까지 봤는지가 남지 않으면 다음 날 처음부터다.
 *
 * 개인정보 경계는 그대로다. 저장하는 값은 지적의 자리(`행|열|규칙|위치`)뿐이고 학생 이름도
 * 문장도 담기지 않는다. 열쇠는 파일 이름이 아니라 파일 내용의 지문이다 — 파일 이름에는
 * '3학년 2반 홍길동' 같은 것이 들어 있다. 저장 위치는 이 브라우저 안(localStorage)이라
 * 서버로 나가지 않는다. */
const RESOLVED_KEY = 'srcheck.resolved.v1';
const RESOLVED_MAX_FILES = 20;
const RESOLVED_MAX_AGE = 180 * 24 * 60 * 60 * 1000;   // 반년

async function fileFingerprint(buf) {
  const bytes = new Uint8Array(buf);
  if (window.crypto && crypto.subtle) {
    try {
      const h = await crypto.subtle.digest('SHA-256', bytes);
      return [...new Uint8Array(h)].slice(0, 10).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) { /* file:// 로 열면 crypto.subtle 이 없다 — 아래 대체 지문으로 */ }
  }
  // 대체 지문. 충돌해도 확인 표시가 어긋날 뿐이라 이 정도면 된다.
  let a = 0x811c9dc5, b = 0x01000193;
  for (let i = 0; i < bytes.length; i++) {
    a = ((a ^ bytes[i]) * 16777619) >>> 0;
    b = (b + bytes[i] * (i % 251 + 1)) >>> 0;
  }
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0') + bytes.length.toString(16);
}

function readResolvedStore() {
  try { return JSON.parse(localStorage.getItem(RESOLVED_KEY)) || {}; } catch (e) { return {}; }
}

function loadResolved(key) {
  const rec = readResolvedStore()[key];
  return new Set(rec && Array.isArray(rec.ids) ? rec.ids : []);
}

let resolvedSaveTimer = null;
function saveResolvedSoon() {
  clearTimeout(resolvedSaveTimer);
  resolvedSaveTimer = setTimeout(saveResolved, 400);
}

function saveResolved() {
  if (!state.fileKey) return;
  const store = readResolvedStore();
  if (state.resolved.size) store[state.fileKey] = { at: Date.now(), ids: [...state.resolved] };
  else delete store[state.fileKey];
  // 오래된 것과 넘치는 것을 걷어낸다. 지문만 쌓이지만 무한히 늘릴 이유가 없다.
  const now = Date.now();
  const keep = Object.keys(store)
    .filter(k => now - (store[k].at || 0) < RESOLVED_MAX_AGE)
    .sort((x, y) => (store[y].at || 0) - (store[x].at || 0))
    .slice(0, RESOLVED_MAX_FILES);
  let trimmed = {};
  keep.forEach(k => { trimmed[k] = store[k]; });

  // 학년 전체를 다 확인하면 파일 하나 몫이 400KB 를 넘는다. 저장 한도에 걸리면
  // 오래된 파일부터 버리고 다시 시도한다 — 지금 보는 파일이 가장 나중 것이라 끝까지 남는다.
  let order = keep.slice();
  for (;;) {
    try {
      localStorage.setItem(RESOLVED_KEY, JSON.stringify(trimmed));
      state.saveFailed = false;
      return;
    }
    catch (e) {
      if (order.length <= 1) {
        // 더 버릴 것이 없다. 조용히 포기하면 화면은 '모두 확인했습니다' 라고 말하는데
        // 새로고침하면 하루치가 통째로 사라진다 — 반드시 알린다.
        state.saveFailed = true;
        renderProgress();
        return;
      }
      const drop = order.pop();
      delete trimmed[drop];
    }
  }
}

/* ── 유틸 ──────────────────────────────────────────────────── */
function splitTerms(v) {
  return String(v).split(/[,\n]/).map(x => x.trim()).filter(Boolean);
}

/* 학년 전체면 지적이 15,626건이다. 자릿수 구분이 없으면 15626 과 1562 를 한눈에 못 가른다 —
 * 며칠에 걸쳐 훑는 사람에게는 이 숫자가 곧 남은 일의 크기라 잘못 읽으면 안 된다. */
function fmt(n) {
  return Number(n).toLocaleString('ko-KR');
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function colLetter(n) {
  let s = '';
  n = n + 1;
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = ((n - m) / 26) | 0; }
  return s;
}

/* 사람이 알아볼 이름을 못 만들면 엑셀 행 번호라도 정확히 짚어 줘야
 * 결과를 보고 원본을 찾아갈 수 있다. */
const ID_HEADERS = ['성명', '이름', '학번', '번호', '학년', '반', '학생', '성 명'];
function looksLikeId(header) {
  const h = String(header || '').replace(/\s/g, '');
  return ID_HEADERS.some(k => h.includes(k.replace(/\s/g, ''))) && h.length <= 8;
}

/* ── 1단계: 파일 열기 ───────────────────────────────────────── */
const dropzone = $('#dropzone');
const fileInput = $('#file-input');

dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('drag'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag'));
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('drag');
  if (e.dataTransfer.files.length) loadFiles(e.dataTransfer.files);
});
fileInput.addEventListener('change', () => {
  if (fileInput.files.length) loadFiles(fileInput.files);
  // 비워 두지 않으면 같은 파일을 다시 골랐을 때 change 가 뜨지 않아 아무 일도 일어나지 않는다.
  fileInput.value = '';
});

/* ── 파일 열기 ──────────────────────────────────────────────
 * 개별점검은 과목별로 파일이 나뉜다(국어_세특.xlsx, 영어_세특.xlsx …).
 * 파일마다 따로 읽어 doc 하나로 담고, 검사와 결과는 통째로 합친다.
 * 파일을 가로지르는 중복 문장은 이때 드러난다 — 같은 문장을 여러 과목에 붙여 넣은 경우다. */

/* 파일 열기 세대. 학년 전체 PDF 는 읽는 데 3~5초가 걸려서, 그 사이에 다른 파일을 고르는
 * 일이 실제로 있다. 세대를 매기지 않으면 앞 작업이 뒤늦게 끝나면서 새 묶음에
 * 제 doc 을 밀어 넣고 fileKey 까지 제 것으로 덮어쓴다 — 고르지도 않은 파일의 결과가
 * 섞이고, 확인 표시는 엉뚱한 지문으로 되살아난다. 세대가 바뀌었으면 그냥 버린다. */
let loadGen = 0;

function loadFiles(fileList) {
  const files = [...fileList];
  if (!files.length) return;
  const gen = ++loadGen;

  // 앞 파일의 결과가 화면에 남아 있으면 새 파일의 것으로 오해하게 된다. 통째로 걷어낸다.
  state.docs = [];
  state.fileName = files.length === 1 ? files[0].name : files.length + '개 파일';
  state.resolved.clear();
  state.restored = 0;
  state.fileKey = '';
  state.checked = false;
  state.findings = [];
  state.duplicates = [];
  $('#step-result').classList.add('hidden');
  $('#progress').classList.add('hidden');
  $('#step-map').classList.add('hidden');
  // 앞 파일에 걸어 둔 필터가 남으면 새 결과가 엉뚱하게 걸러진다.
  $('#f-file').value = '';
  $('#f-file-wrap').classList.add('hidden');
  collapseCard('step-file', false);
  collapseCard('step-map', false);
  const info = $('#file-info');
  info.classList.remove('hidden');
  info.textContent = files.length === 1 ? '읽는 중…' : files.length + '개 파일을 읽는 중…';

  readDocs(files, info, gen);
}

function readArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('파일을 읽지 못했습니다'));
    reader.readAsArrayBuffer(file);
  });
}

/* 파일 읽기 실패를 한국어로 옮긴다. pdf.js·SheetJS 는 영어로 던지는데,
 * `No password given` 만 보여 주면 무엇을 해야 하는지 알 수 없다.
 * NEIS 출력물에 암호가 걸린 경우가 실제로 있어 이 하나는 특히 필요하다. */
function fileErrorText(err, isPdf) {
  const m = String((err && err.message) || err);
  if (/password/i.test(m))
    return '암호가 걸린 PDF 입니다. 암호를 풀어 저장한 뒤 다시 올려 주세요.';
  if (/size is zero|empty/i.test(m))
    return '내용이 없는 빈 파일입니다.';
  if (/Invalid PDF|InvalidPDFException|structure/i.test(m))
    return 'PDF 로 읽을 수 없습니다. 이름만 .pdf 이거나 파일이 깨졌을 수 있습니다.';
  if (/Unsupported file|Cannot find file|zip/i.test(m))
    return '엑셀로 읽을 수 없습니다. 이름만 .xlsx 이거나 파일이 깨졌을 수 있습니다.';
  return m + (isPdf ? ' (PDF 를 읽지 못했습니다)' : '');
}

async function readDocs(files, info, gen) {
  const keys = [];
  const notes = [];
  // 읽는 도중 다른 파일을 고르면 세대가 올라간다. 그때부터는 아무것도 건드리지 않는다.
  const live = () => gen === loadGen;

  for (const file of files) {
    const isPdf = /\.pdf$/i.test(file.name) || file.type === 'application/pdf';
    try {
      const buffer = await readArrayBuffer(file);
      if (!live()) return;
      const key = await fileFingerprint(buffer);
      if (!live()) return;
      // 같은 파일을 두 번 고르면 지적이 두 배가 되고, 중복 문장 탭에 '자기 자신과 중복' 이
      // 쏟아진다. 내용 지문이 같으면 뒤엣것을 버린다 — 이름이 달라도 내용이 같으면 같은 파일이다.
      if (keys.includes(key)) {
        notes.push('<div class="split-warn"><div>⚠ ' + escapeHtml(file.name) +
          ' — 앞서 연 파일과 내용이 같아 건너뜁니다.</div></div>');
        continue;
      }
      keys.push(key);
      const doc = isPdf
        ? await parsePdf(buffer, file, info, files.length, live)
        : parseExcel(buffer, file);
      if (!live()) return;
      state.docs.push(doc);
      notes.push(doc.note);
    } catch (err) {
      if (!live()) return;
      notes.push('<div class="split-warn"><div>⚠ ' + escapeHtml(file.name) + ' — ' +
        escapeHtml(fileErrorText(err, isPdf)) + '</div></div>');
    }
  }
  if (!live()) return;

  // 고른 순서는 그때그때 다르다. docTag 가 순서에서 나오므로 그대로 두면 같은 묶음을
  // 다시 열었을 때 확인 표시가 통째로 어긋난다. 이름순으로 세워 순서를 고정한다.
  state.docs.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  keys.sort();

  // 여러 파일이면 지문도 묶어서 낸다. 같은 묶음을 다시 열어야 확인 표시가 이어진다.
  state.fileKey = keys.join('_');
  state.resolved = loadResolved(state.fileKey);
  state.restored = state.resolved.size;

  state.source = !state.docs.length ? 'excel'
    : state.docs.every(d => d.source === 'pdf') ? 'pdf'
    : state.docs.every(d => d.source === 'excel') ? 'excel' : 'mixed';

  info.innerHTML = notes.join('');
  if (!state.docs.length) { $('#step-map').classList.add('hidden'); return; }

  $('#step2-title').textContent = state.source === 'pdf' ? '인식된 구간 확인'
    : state.source === 'excel' ? '검사할 열 확인' : '검사할 내용 확인';
  renderDocs();
  showStepMap();
}

/* CSV 는 글자를 어떤 방식으로 담았는지 파일에 적혀 있지 않다.
 * SheetJS 에 바이트를 그대로 넘기면 한글이 통째로 깨져(번호 → ë²í¸) 검사가 무의미해진다.
 * 우리말 자료는 UTF-8 아니면 EUC-KR(CP949) 둘 중 하나다. UTF-8 로 풀어 보고
 * 깨진 글자(U+FFFD)가 섞이면 EUC-KR 로 다시 푼다. */
function decodeCsv(buffer) {
  const bytes = new Uint8Array(buffer);
  let text = new TextDecoder('utf-8').decode(bytes);
  if (text.indexOf('\uFFFD') >= 0) {
    try {
      const euc = new TextDecoder('euc-kr').decode(bytes);
      if (euc.indexOf('\uFFFD') < 0) text = euc;
    } catch (e) { /* 브라우저가 euc-kr 을 모르면 UTF-8 결과를 그대로 쓴다 */ }
  }
  return text.replace(/^\uFEFF/, '');   // 엑셀이 붙이는 BOM
}

/* 엑셀 한 벌 → doc */
function parseExcel(buffer, file) {
  const isCsv = /\.csv$/i.test(file.name) || file.type === 'text/csv';
  // 이름만 .xlsx 인 파일을 SheetJS 에 넘기면 오류 없이 깨진 글자로 열린다
  // (`이건 엑셀이 아니다` → `ì´ê±´ ììì´ ìëë¤`). 겉으로는 도는 것처럼 보이니
  // 원인을 못 찾는다. 앞머리 서명으로 먼저 거른다 — xlsx 는 ZIP(PK), xls 는 OLE 다.
  if (!isCsv) {
    const b = new Uint8Array(buffer);
    if (!b.length) throw new Error('내용이 없는 빈 파일입니다.');
    const zip = b[0] === 0x50 && b[1] === 0x4B;                       // PK
    const ole = b[0] === 0xD0 && b[1] === 0xCF && b[2] === 0x11;      // OLE2
    if (!zip && !ole) {
      throw new Error('엑셀 파일이 아닙니다. 이름만 ' +
        (/\.xls$/i.test(file.name) ? '.xls' : '.xlsx') +
        ' 이거나 파일이 깨졌을 수 있습니다. 텍스트라면 확장자를 .csv 로 바꿔 올려 주세요.');
    }
  }
  const workbook = isCsv
    ? XLSX.read(decodeCsv(buffer), { type: 'string' })
    : XLSX.read(new Uint8Array(buffer), { type: 'array' });
  const doc = {
    source: 'excel', name: file.name, workbook,
    sheetName: '', grid: [], headerRow: 0, columns: [],
    note: '<div>' + escapeHtml(file.name) + ' — 시트 ' + workbook.SheetNames.length +
          '개 (' + escapeHtml(workbook.SheetNames.join(', ')) + ')</div>',
  };
  selectSheet(doc, workbook.SheetNames[0]);
  return doc;
}

/* PDF 한 벌 → doc */
async function parsePdf(buffer, file, info, total, live) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;

  const pages = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const content = await page.getTextContent();
    // pdf.js 는 한 낱말도 여러 조각으로 쪼개 준다. 조각 사이에 공백을 끼워 넣으면
    // '인 적 · 학 적 사 항' 처럼 글자마다 벌어져 제목을 못 알아본다.
    // 실제 공백은 조각 안에 이미 들어 있으므로 그대로 잇고, 줄바꿈만 hasEOL 로 넣는다.
    let text = '';
    for (const item of content.items) {
      text += item.str;
      if (item.hasEOL) text += '\n';
    }
    pages.push(text);
    // 세대가 바뀌었으면(사용자가 다른 파일을 골랐으면) 진행 표시도 덮어쓰지 않는다.
    if (live && !live()) break;
    info.textContent = file.name + ' — PDF 를 읽는 중… (' + n + '/' + pdf.numPages + '쪽)' +
      (total > 1 ? ' · 파일 ' + (state.docs.length + 1) + '/' + total : '');
  }

  const pdfText = pages.join('\n');
  // 학급 전체를 한 파일로 출력한 경우가 많다. 먼저 학생 단위로 자르고,
  // 학생마다 다시 영역 구간으로 나눈다.
  const students = R.splitPdfStudents(pdfText);
  const segments = [];
  students.forEach((st) => {
    for (const seg of R.splitPdfText(st.text)) {
      segments.push(Object.assign({}, seg, { studentIndex: st.index, studentLabel: st.label }));
    }
  });

  if (!segments.length) {
    throw new Error('텍스트를 찾지 못했습니다. 스캔한 이미지 PDF 라면 글자를 읽을 수 없습니다' +
      '(문자 인식 기능은 없습니다).');
  }

  const chars = pdfText.replace(/\s/g, '').length;
  const many = students.length > 1;
  const summary = file.name + ' — ' + fmt(pdf.numPages) + '쪽, 글자 ' + fmt(chars) + '자' +
    (many ? ', 학생 ' + fmt(students.length) + '명' : '') +
    ', 구간 ' + fmt(segments.length) + '개를 인식했습니다.';

  // 학생 경계를 놓치면 결과가 한 사람에게 몰려 통째로 못 쓰게 된다. 조용히 넘기지 않는다.
  const diag = R.diagnosePdfSplit(pdfText, students);
  const note = '<div>' + escapeHtml(summary) + '</div>' +
    (diag.warnings.length
      ? '<div class="split-warn">' + diag.warnings.map(w =>
          '<div>⚠ ' + escapeHtml(w) + '</div>').join('') + '</div>'
      : '');

  return { source: 'pdf', name: file.name, pdfText, students, segments, pageCount: pdf.numPages, note };
}

function selectSheet(doc, name) {
  doc.sheetName = name;
  const ws = doc.workbook.Sheets[name];
  doc.grid = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '', blankrows: true });

  // 제목 행 후보: 앞쪽 10행 중 '채워진 칸이 가장 많고 셀이 짧은' 행을 기본으로 고른다.
  const limit = Math.min(10, doc.grid.length);
  let best = 0, bestScore = -1;
  for (let i = 0; i < limit; i++) {
    const row = doc.grid[i] || [];
    const filled = row.filter(c => String(c).trim()).length;
    const avgLen = filled ? row.reduce((s, c) => s + String(c).length, 0) / filled : 0;
    const score = filled * 2 - (avgLen > 40 ? 10 : 0);
    if (score > bestScore) { bestScore = score; best = i; }
  }
  doc.headerRow = best;
  buildColumns(doc);
}

function buildColumns(doc) {
  const header = doc.grid[doc.headerRow] || [];
  const width = Math.max(header.length, ...doc.grid.slice(0, 50).map(r => (r || []).length));
  doc.columns = [];

  for (let c = 0; c < width; c++) {
    const title = String(header[c] == null ? '' : header[c]).trim();

    // 아래쪽 데이터의 평균 길이로 '서술형 칸'인지 가늠한다.
    let sum = 0, n = 0;
    for (let r = doc.headerRow + 1; r < Math.min(doc.grid.length, doc.headerRow + 40); r++) {
      const v = String((doc.grid[r] || [])[c] || '');
      if (v.trim()) { sum += v.length; n++; }
    }
    const avg = n ? sum / n : 0;

    const areaKey = R.detectArea(title);
    let role, key;
    if (looksLikeId(title)) { role = 'id'; key = null; }
    else if (areaKey) { role = 'text'; key = areaKey; }
    else if (avg >= 25) { role = 'text'; key = 'etc'; }
    else { role = 'ignore'; key = null; }

    doc.columns.push({ index: c, header: title, role, areaKey: key, avgLen: Math.round(avg), sample: n });
  }
}

/* ── 2단계 표 ───────────────────────────────────────────────
 * 파일마다 한 덩이씩 그린다. 엑셀은 열 매핑, PDF 는 구간 목록이라 표 모양이 다르다. */
function renderDocs() {
  const areaOptions = R.AREAS.map(a =>
    '<option value="' + a.key + '">' + escapeHtml(a.label) + '</option>').join('');

  $('#doc-list').innerHTML = state.docs.map((doc, di) => `
    <section class="doc" data-doc="${di}">
      ${state.docs.length > 1
        ? `<h3 class="doc-name"><span class="doc-kind">${doc.source === 'pdf' ? 'PDF' : '엑셀'}</span>
             ${escapeHtml(doc.name)}</h3>`
        : ''}
      ${doc.source === 'excel' ? excelControls(doc, di) : ''}
      ${doc.source === 'pdf' && doc.students.length > 1
        ? segGroups(doc, di)
        : `<div class="table-scroll">
             <table class="map-table">
               <thead>${doc.source === 'pdf' ? segHead(doc) : mapHead()}</thead>
               <tbody>${doc.source === 'pdf' ? segRows(doc, di, areaOptions, doc.segments.map((_, i) => i))
                                             : mapRows(doc, di, areaOptions)}</tbody>
             </table>
           </div>`}
      <p class="hint doc-hint"><span class="dh-text">${docHint(doc)}</span>
        ${doc.source === 'pdf'
          ? `<button class="tiny dump-text" data-doc="${di}"
               title="PDF 에서 읽어 들인 글자를 텍스트 파일로 저장합니다. 학년·영역이 어떤 모양으로 들어 있는지 확인할 때 씁니다">읽어 들인 글자 저장</button>`
          : ''}</p>
    </section>`).join('');

  // select 의 선택값은 innerHTML 로 못 넣으므로 그린 뒤 채운다.
  state.docs.forEach((doc, di) => {
    const scope = document.querySelector(`.doc[data-doc="${di}"]`);
    if (!scope) return;
    if (doc.source === 'excel') {
      const sh = scope.querySelector('.sheet-select');
      if (sh) sh.value = doc.sheetName;
      const hr = scope.querySelector('.header-row-select');
      if (hr) hr.value = String(doc.headerRow);
      doc.columns.forEach(col => {
        const sel = scope.querySelector(`.area-select[data-col="${col.index}"]`);
        if (sel && col.areaKey) sel.value = col.areaKey;
      });
    } else {
      doc.segments.forEach((seg, i) => {
        const sel = scope.querySelector(`.seg-area[data-seg="${i}"]`);
        if (sel) sel.value = seg.areaKey;
      });
    }
  });

  updateRunState();
  updateCardSummaries();
}

function excelControls(doc, di) {
  const sheets = doc.workbook.SheetNames.map(n =>
    `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('');
  const limit = Math.min(10, doc.grid.length);
  let rows = '';
  for (let i = 0; i < limit; i++) {
    const preview = (doc.grid[i] || []).slice(0, 5).map(c => String(c).slice(0, 12)).join(' | ');
    rows += `<option value="${i}">${escapeHtml((i + 1) + '행 — ' + preview)}</option>`;
  }
  return `
    <div class="row-controls">
      <label>시트 <select class="sheet-select" data-doc="${di}">${sheets}</select></label>
      <label>제목 행 <select class="header-row-select" data-doc="${di}">${rows}</select></label>
    </div>`;
}

function mapHead() {
  return '<tr><th>열</th><th>제목</th><th>역할</th><th>영역 / 글자수 제한</th><th>미리보기</th></tr>';
}

function mapRows(doc, di, areaOptions) {
  const lengthOff = state.settings.checkLength === false;
  return doc.columns.map(col => {
    let firstData = '';
    for (let r = doc.headerRow + 1; r < doc.grid.length; r++) {
      const v = String((doc.grid[r] || [])[col.index] || '').trim();
      if (v) { firstData = v; break; }
    }
    const limit = col.areaKey ? state.settings.limits[col.areaKey] : null;
    const limitText = col.role !== 'text' ? '—'
      : lengthOff ? '검사 안 함'
      : (limit === 0 ? '미입력 항목' : limit == null ? '제한 없음' : limit + '자');

    return `
      <tr class="${col.role === 'ignore' ? 'is-ignored' : ''}" data-col="${col.index}">
        <td class="col-letter">${colLetter(col.index)}</td>
        <td>${escapeHtml(col.header) || '<span class="hint">(제목 없음)</span>'}</td>
        <td>
          <select class="role-select" data-doc="${di}" data-col="${col.index}">
            <option value="text"${col.role === 'text' ? ' selected' : ''}>검사</option>
            <option value="id"${col.role === 'id' ? ' selected' : ''}>학생 식별</option>
            <option value="ignore"${col.role === 'ignore' ? ' selected' : ''}>제외</option>
          </select>
        </td>
        <td>
          ${col.role === 'text'
            ? `<select class="area-select" data-doc="${di}" data-col="${col.index}">${areaOptions}</select>
               <span class="hint">${limitText}</span>`
            : '<span class="hint">—</span>'}
        </td>
        <td class="preview" title="${escapeHtml(firstData)}">${escapeHtml(firstData.slice(0, 90))}</td>
      </tr>`;
  }).join('');
}

function segHead() {
  return '<tr><th>구간</th><th>인식된 영역</th><th>분량</th><th>미리보기</th></tr>';
}

function segRows(doc, di, areaOptions, indexes) {
  const off = state.settings.checkLength === false;
  return indexes.map((i) => {
    const seg = doc.segments[i];
    const body = seg.text.trim();
    const bytes = R.countNeisBytes(body);
    const limit = off ? null : state.settings.limits[seg.areaKey];
    const limitText = off ? '검사 안 함'
      : (limit == null ? '제한 없음' : `${fmt(bytes)} / ${fmt(limit * 3)}Byte`);
    const over = limit != null && bytes > limit * 3;

    return `
      <tr data-seg="${i}">
        <td>${escapeHtml(seg.title)}</td>
        <td><select class="seg-area" data-doc="${di}" data-seg="${i}">${areaOptions}</select></td>
        <td${over ? ' style="color:var(--violation);font-weight:600"' : ''}>${limitText}</td>
        <td class="preview" title="${escapeHtml(body.slice(0, 300))}">${escapeHtml(body.slice(0, 90))}</td>
      </tr>`;
  }).join('');
}

/* 학년 전체(450명)면 구간이 5천 개다. 통째로 그리면 검사도 하기 전에 DOM 이 11만이 된다.
 * 결과 화면과 같은 방식으로 학생마다 접어 두고, 펼칠 때만 안쪽 표를 그린다. */
function segGroups(doc, di) {
  const off = state.settings.checkLength === false;
  const byStudent = new Map();
  doc.segments.forEach((seg, i) => {
    if (!byStudent.has(seg.studentIndex)) byStudent.set(seg.studentIndex, { label: seg.studentLabel, idx: [] });
    byStudent.get(seg.studentIndex).idx.push(i);
  });

  return [...byStudent.entries()].map(([sIdx, g]) => {
    const named = g.idx.filter(i => doc.segments[i].areaKey !== 'etc').length;
    const over = off ? 0 : g.idx.filter(i => {
      const limit = state.settings.limits[doc.segments[i].areaKey];
      return limit != null && R.countNeisBytes(doc.segments[i].text.trim()) > limit * 3;
    }).length;
    return `
      <details class="rowgroup segroup" data-doc="${di}" data-student="${sIdx}">
        <summary>
          <span class="rg-name">${escapeHtml(g.label)}</span>
          <span class="cat-sub">구간 ${fmt(g.idx.length)}개 · 영역 인식 ${fmt(named)}개</span>
          <span class="rg-counts">${over ? `<span class="pill violation">분량 초과 ${fmt(over)}</span>` : ''}</span>
        </summary>
        <div class="seg-body" data-filled="0"></div>
      </details>`;
  }).join('');
}

/* 학생 하나치 구간 표를 그린다. 펼칠 때와 영역을 고쳤을 때 쓴다. */
function fillSegGroup(details) {
  const di = Number(details.dataset.doc);
  const doc = state.docs[di];
  if (!doc) return;
  const sIdx = Number(details.dataset.student);
  const areaOptions = R.AREAS.map(a =>
    '<option value="' + a.key + '">' + escapeHtml(a.label) + '</option>').join('');
  const idx = [];
  doc.segments.forEach((seg, i) => { if (seg.studentIndex === sIdx) idx.push(i); });

  const body = details.querySelector('.seg-body');
  body.innerHTML = `
    <div class="table-scroll">
      <table class="map-table">
        <thead>${segHead()}</thead>
        <tbody>${segRows(doc, di, areaOptions, idx)}</tbody>
      </table>
    </div>`;
  idx.forEach(i => {
    const sel = body.querySelector(`.seg-area[data-seg="${i}"]`);
    if (sel) sel.value = doc.segments[i].areaKey;
  });
  body.dataset.filled = '1';
}

/* 접힌 학생 묶음은 열릴 때 채운다. toggle 은 버블링하지 않으므로 캡처 단계에서 받는다. */
document.addEventListener('toggle', (e) => {
  const d = e.target.closest && e.target.closest('details.segroup');
  if (!d || !d.open) return;
  const body = d.querySelector('.seg-body');
  if (body && body.dataset.filled !== '1') fillSegGroup(d);
}, true);

function docHint(doc) {
  if (doc.source === 'pdf') {
    const named = doc.segments.filter(s => s.areaKey !== 'etc').length;
    return (doc.students.length > 1 ? `학생 ${fmt(doc.students.length)}명 · ` : '') +
      `구간 ${fmt(doc.segments.length)}개 · 영역 인식 ${fmt(named)}개`;
  }
  const textCols = doc.columns.filter(c => c.role === 'text').length;
  const idCols = doc.columns.filter(c => c.role === 'id').length;
  const dataRows = Math.max(0, doc.grid.length - doc.headerRow - 1);
  // 시트가 여럿이면 그중 하나만 검사한다. 반별로 시트를 나눈 파일이 흔해서,
  // 이 말이 없으면 한 반만 보고 전체를 봤다고 오해한다.
  const sheets = doc.workbook ? doc.workbook.SheetNames.length : 1;
  const only = sheets > 1 ? ` <strong>— 시트 ${fmt(sheets)}개 가운데 이 하나만 검사합니다</strong>` : '';
  return `${escapeHtml(doc.sheetName)} · 데이터 ${fmt(dataRows)}행 · 검사 대상 ${fmt(textCols)}열 · 식별 ${fmt(idCols)}열${only}`;
}

/* 구간의 영역을 바꾸면 '영역 인식 N개' 도 함께 낡는다. 2단계 표를 통째로 다시 그리면
 * 펼쳐 둔 학생이 닫히므로, 요약 글월만 갈아 끼운다. */
function updateDocHint(doc) {
  const di = state.docs.indexOf(doc);
  const el = document.querySelector(`section.doc[data-doc="${di}"] .doc-hint .dh-text`);
  if (el) el.innerHTML = docHint(doc);   // docHint 는 escapeHtml 을 거친 HTML 을 돌려준다
}

/* 검사할 것이 하나도 없으면 [검사 실행] 을 막는다. 파일이 여럿이면 하나라도 있으면 된다. */
function updateRunState() {
  const checkable = state.docs.some(d => d.source === 'pdf' || d.columns.some(c => c.role === 'text'));
  const noArea = state.docs.every(d => d.source !== 'pdf' || !d.segments.some(s => s.areaKey !== 'etc'));
  $('#btn-run').disabled = !checkable;
  $('#run-hint').classList.remove('is-error');
  $('#run-hint').textContent = !checkable
    ? '검사할 열이 없습니다. 역할을 ‘검사’로 바꿔 주세요.'
    : (state.source === 'pdf' && noArea
      ? '영역을 인식하지 못했습니다. 금지어 검사는 그대로 되지만 분량은 판정하지 않습니다.'
      : '');
}

/* PDF 에서 읽어 들인 글자를 그대로 파일로 내린다.
 * 학교마다 출력 서식이 달라 학년·영역이 어떤 모양으로 들어 있는지는 이 글자를 봐야 안다.
 * 이 컴퓨터에만 저장되고 서버로 나가지 않는다 — 검사와 같은 경계다. */
$('#doc-list').addEventListener('click', (e) => {
  const btn = e.target.closest('.dump-text');
  if (!btn) return;
  const doc = state.docs[Number(btn.dataset.doc)];
  if (!doc || !doc.pdfText) return;

  const 머리 = [
    '# ' + doc.name + ' 에서 읽어 들인 글자',
    '# 학생 ' + doc.students.length + '명 · 구간 ' + doc.segments.length + '개',
    '# 구간을 제대로 나눴는지, 영역을 제대로 알아봤는지 아래 목록으로 확인할 수 있습니다.',
    '',
    '## 구간 목록',
  ];
  doc.segments.forEach((seg) => {
    머리.push(seg.studentLabel + '\t' + seg.title + '\t[' + seg.areaKey + ']\t' +
      seg.text.replace(/\s+/g, ' ').trim().slice(0, 60));
  });
  머리.push('', '## 원문', '');

  const blob = new Blob([머리.join('\n') + doc.pdfText], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = doc.name.replace(/\.pdf$/i, '') + '_읽어들인글자.txt';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

$('#doc-list').addEventListener('change', (e) => {
  const section = e.target.closest('.doc');
  if (!section) return;
  const doc = state.docs[Number(section.dataset.doc)];
  if (!doc) return;
  const t = e.target;

  if (t.classList.contains('sheet-select')) { selectSheet(doc, t.value); renderDocs(); return; }
  if (t.classList.contains('header-row-select')) {
    doc.headerRow = Number(t.value); buildColumns(doc); renderDocs(); return;
  }
  if (t.classList.contains('seg-area')) {
    doc.segments[Number(t.dataset.seg)].areaKey = t.value;
    // 전체를 다시 그리면 펼쳐 둔 학생이 닫힌다. 고친 묶음만 새로 그린다.
    const group = t.closest('details.segroup');
    if (group) { fillSegGroup(group); updateRunState(); updateCardSummaries(); updateDocHint(doc); }
    else renderDocs();
    return;
  }
  const col = doc.columns && doc.columns.find(c => c.index === Number(t.dataset.col));
  if (!col) return;
  if (t.classList.contains('role-select')) {
    col.role = t.value;
    if (col.role === 'text' && !col.areaKey) col.areaKey = R.detectArea(col.header) || 'etc';
    renderDocs();
  } else if (t.classList.contains('area-select')) {
    col.areaKey = t.value;
    renderDocs();
  }
});

function showStepMap() {
  updateCardSummaries();
  $('#step-map').classList.remove('hidden');
  $('#step-map').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* 여러 파일을 열 수 있으므로 학생 수도 문서를 가로질러 센다. */
function totalStudents() {
  return state.docs.reduce((n, d) => n + (d.students ? d.students.length : 0), 0);
}

/* ── 2단계: 검사 실행 ───────────────────────────────────────── */
/* 학년 전체는 검사에 1초 이상 걸리고 그동안 화면이 멈춘다. 멈춘 것인지 도는 것인지
 * 알 수 없으면 다시 누르게 되므로, 버튼을 바꿔 놓고 한 프레임 뒤에 돌린다. */
$('#btn-run').addEventListener('click', () => {
  const btn = $('#btn-run');
  if (btn.disabled) return;
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = '검사 중…';
  requestAnimationFrame(() => setTimeout(() => {
    try { runCheck(); }
    catch (err) {
      // 조용히 삼키면 버튼만 돌아오고 결과가 없어, 검사가 끝났는데 안 뜬다고 느낀다.
      console.error(err);
      const hint = $('#run-hint');
      hint.classList.add('is-error');
      hint.textContent = '검사 중 오류가 나 멈췄습니다 — ' +
        (err && err.message ? err.message : String(err));
    }
    finally { btn.textContent = label; btn.disabled = false; }
  }, 0));
});

function rowLabelFor(doc, rowIdx) {
  const parts = doc.columns.filter(c => c.role === 'id')
    .map(c => String((doc.grid[rowIdx] || [])[c.index] || '').trim())
    .filter(Boolean);
  const excelRow = rowIdx + 1;
  return parts.length ? parts.join(' ') + ` (${excelRow}행)` : `${excelRow}행`;
}

function runCheck() {
  const base = {
    dictionary: state.settings.dictionary,
    limits: state.settings.limits,
    disabledPatterns: state.settings.disabledPatterns,
    disabledRules: state.settings.disabledRules,
    allowlist: state.settings.allowlist,
    checkLength: state.settings.checkLength,
    checkEnding: state.settings.checkEnding,
  };

  const findings = [];
  const cells = [];
  // 파일이 하나면 지적의 식별자를 예전 그대로 둔다 — 앞서 남긴 확인 표시가 살아 있어야 한다.
  const multi = state.docs.length > 1;

  state.docs.forEach((doc, di) => {
    const docTag = multi ? String(di) : '';
    const opts = Object.assign({}, base);

    if (doc.source === 'pdf') {
      // PDF 의 줄바꿈·연속공백은 원본에 입력된 것이 아니라 페이지 레이아웃에서 나온
      // 추출 부산물이다. 지적해 봐야 고칠 것이 없고 진짜 지적을 덮어 버린다.
      // 문단구분 번호도 마찬가지다 — 표의 번호·쪽번호가 모두 줄머리로 나온다.
      opts.disabledPatterns = (base.disabledPatterns || []).concat(['p-newline', 'p-space', 'p-paranum']);

      // PDF 는 한 문서가 곧 한 학생이라고 본다. 구간이 엑셀의 '열' 자리를 대신한다.
      // 한 학생 안에서 같은 제목의 구간이 여러 번 나온다 — 독서활동상황·행동특성이
      // 학년별로 되풀이되는 서식이 흔하다. 제목만으로 자리를 적으면 두 구간의 지적이
      // 같은 식별자를 갖게 되고, 한쪽에 '확인' 표시를 하면 보지도 않은 다른 쪽까지
      // 확인한 것이 되어 금지어를 놓친다. 두 번째부터 순번을 붙여 자리를 갈라 둔다
      // (첫 번째는 그대로라 예전에 남긴 확인 표시가 살아남는다).
      const slotSeen = new Map();
      doc.segments.forEach((seg) => {
        const slotKey = seg.studentIndex + '|' + seg.title;
        const nth = (slotSeen.get(slotKey) || 0) + 1;
        slotSeen.set(slotKey, nth);
        const body = seg.text;
        if (!body.trim()) return;
        const area = R.areaByKey(seg.areaKey);
        // 학생을 행으로, 구간을 열 자리로 놓으면 엑셀과 같은 구조가 되어
        // '학생별' 탭과 중복 문장 검사가 그대로 맞아 들어간다.
        const meta = {
          docTag: docTag, fileName: doc.name, rowKey: docTag + '|' + seg.studentIndex,
          rowIndex: seg.studentIndex, rowLabel: seg.studentLabel,
          column: seg.title, columnHeader: seg.title,
          slot: nth > 1 ? seg.title + '#' + nth : seg.title,
          areaKey: seg.areaKey, areaLabel: area.label,
        };
        cells.push(Object.assign({}, meta, { text: body }));
        for (const f of R.checkText(body, seg.areaKey, opts)) {
          findings.push(Object.assign({}, f, meta, { fullText: body }));
        }
      });
      return;
    }

    const textCols = doc.columns.filter(c => c.role === 'text');
    for (let r = doc.headerRow + 1; r < doc.grid.length; r++) {
      const row = doc.grid[r];
      if (!row || !row.some(v => String(v).trim())) continue;
      const label = rowLabelFor(doc, r);

      for (const col of textCols) {
        const text = String(row[col.index] == null ? '' : row[col.index]);
        if (!text.trim()) continue;
        const area = R.areaByKey(col.areaKey);
        const meta = {
          docTag: docTag, fileName: doc.name, rowKey: docTag + '|' + r,
          rowIndex: r, rowLabel: label,
          column: colLetter(col.index), columnHeader: col.header,
          // 식별자에 시트를 실어야 한다. 안 실으면 시트를 바꿔 다시 검사했을 때
          // 앞 시트에서 한 확인 표시가 **뒤 시트의 다른 학생 지적에 그대로 붙는다**.
          // 반별로 시트를 나눈 파일이 흔한데, 그러면 보지도 않은 금지어가 확인 처리된다.
          // 첫 시트는 접미사를 붙이지 않아 예전 확인 표시가 그대로 산다 (PDF 의 slot 과 같은 방식).
          slot: doc.workbook && doc.workbook.SheetNames[0] !== doc.sheetName
            ? colLetter(col.index) + '@' + doc.sheetName : colLetter(col.index),
          areaKey: col.areaKey, areaLabel: area.label,
        };
        cells.push(Object.assign({}, meta, { text: text }));
        for (const f of R.checkText(text, col.areaKey, opts)) {
          findings.push(Object.assign({}, f, meta, { fullText: text }));
        }
      }
    }
  });

  finishCheck(findings, cells);
}

/* 지적의 자리표. `행|열|규칙|위치` 다.
 * PDF 는 '열' 자리에 slot(구간 제목 + 되풀이 순번)을 쓴다 — 같은 제목의 구간이
 * 한 학생 안에 두 번 나오는 서식이 있어 제목만으로는 자리가 겹친다.
 * 엑셀에는 slot 이 없어 예전 식별자 그대로다. */
function findingId(f) {
  const slot = f.slot != null ? f.slot : f.column;
  return [f.docTag || '', f.rowIndex, slot, f.ruleId, f.start == null ? '' : f.start].join('|');
}

function finishCheck(findings, cells) {
  state.checked = true;
  state.lastBulk = null;
  findings.forEach(f => { f._id = findingId(f); });
  // 이번 검사에 없는 지적의 '확인함' 표시는 버린다 (규칙이 바뀌어 사라진 지적).
  const alive = new Set(findings.map(f => f._id));
  const before = state.resolved.size;
  state.resolved = new Set([...state.resolved].filter(id => alive.has(id)));
  state.restored = Math.min(state.restored, state.resolved.size);
  if (state.resolved.size !== before) saveResolvedSoon();
  // 기본 정렬은 심각도 우선이다. 문서 순서 그대로 두면 첫 화면이 김가온의 전각 콜론(점검)으로
  // 채워지는데, 뒤에 위반이 1만 건 넘게 있다. 무엇을 먼저 손봐야 하는지가 곧 순서여야 한다.
  // **같은 심각도 안에서는 문서 순서를 지킨다** — '학생 순서대로 훑는' 동선이 깨지면 안 된다.
  findings.forEach((f, i) => { f._seq = i; });
  findings.sort((a, b) =>
    R.SEVERITY_ORDER[a.severity] - R.SEVERITY_ORDER[b.severity] || a._seq - b._seq);
  state.findings = findings;
  state.duplicates = R.findDuplicates(cells, { minLength: state.settings.dupMinLen });

  renderSummary();
  populateFilters();
  renderFindings();
  renderByRow();
  renderByCategory();
  renderDups();

  document.querySelector('.tab[data-tab="byrow"]').textContent =
    (state.source === 'pdf' && totalStudents() <= 1) ? '구간별' : '학생별';

  // 결과를 보는 동안 앞 단계는 접어 둔다. 필요하면 제목의 [펼치기] 로 다시 연다.
  collapseCard('step-file', true);
  collapseCard('step-map', true);

  $('#step-result').classList.remove('hidden');
  $('#step-result').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ── 3단계: 결과 ───────────────────────────────────────────── */
function renderSummary() {
  const c = { violation: 0, warning: 0, info: 0 };
  for (const f of state.findings) c[f.severity]++;
  // 파일이 다르면 같은 행 번호라도 다른 사람이다. 학생별 탭이 묶는 열쇠와 같은 것으로 센다 —
  // 다르면 카드의 숫자와 탭의 그룹 수가 어긋난다.
  const rowsFlagged = new Set(state.findings
    .filter(f => f.severity !== 'info')
    .map(f => (f.docTag || '') + '|' + f.rowIndex)).size;
  const unitLabel = (state.source === 'pdf' && totalStudents() <= 1)
    ? '확인 필요한 구간' : '확인 필요한 학생/행';

  renderProgress();
  // 어느 판으로 검사했는지 결과 맨 위에 밝힌다. 판이 다르면 조항 번호가 어긋난다.
  $('#rules-src').textContent =
    `「${R.SOURCE.year} ${R.SOURCE.title}」(${R.SOURCE.pages}쪽) 기준으로 검사했습니다.`;
  const zero = (n) => n ? '' : ' is-zero';
  // 카드를 누르면 그 항목만 추려 '금지어별'로 보여준다 — 수천 건에서는 이 경로가 가장 빠르다.
  $('#summary').innerHTML = `
    <div class="sum-card violation${zero(c.violation)}" data-jump="violation"><div class="n">${fmt(c.violation)}</div><div class="t">위반 — 기재 불가</div></div>
    <div class="sum-card warning${zero(c.warning)}" data-jump="warning"><div class="n">${fmt(c.warning)}</div><div class="t">주의 — 맥락 확인 필요</div></div>
    <div class="sum-card info${zero(c.info)}" data-jump="info"><div class="n">${fmt(c.info)}</div><div class="t">점검 — 표기·분량</div></div>
    <div class="sum-card" data-jump="rows"><div class="n">${fmt(rowsFlagged)}</div><div class="t">${unitLabel}</div></div>
    <div class="sum-card" data-jump="dups"><div class="n">${fmt(state.duplicates.length)}</div><div class="t">중복 문장</div></div>`;
}

/* 얼마나 훑었는지. 30명치를 나눠 보는 동안 어디까지 왔는지가 가장 궁금한 값이다. */
function renderProgress() {
  const total = state.findings.length;
  const done = state.findings.filter(f => state.resolved.has(f._id)).length;
  const el = $('#progress');
  if (!el) return;
  el.classList.toggle('hidden', !total);
  if (!total) return;
  const pct = Math.round(done / total * 100);
  const left = total - done;
  // 며칠에 걸쳐 훑는 일이라 '남은 것이 몇 건인가' 가 '확인한 것이 몇 건인가' 보다 쓸모 있다.
  // 다음에 볼 것으로 가는 길([남은 것만 보기])도 필터 속이 아니라 여기 둔다.
  el.innerHTML = `
    <div class="pg-bar" role="progressbar" aria-label="확인 진행률"
      aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><div class="pg-fill" style="width:${pct}%"></div></div>
    <span class="pg-text">${done === total ? `${fmt(total)}건 모두 확인했습니다`
      : done === 0 ? `지적 ${fmt(total)}건 — 아직 확인한 것이 없습니다`
      : `남은 것 ${fmt(left)}건 · 확인 ${fmt(done)} / ${fmt(total)}건 (${pct}%)`}</span>
    ${state.lastBulk && state.lastBulk.length
      ? `<button class="tiny" id="btn-undo-bulk">방금 ${fmt(state.lastBulk.length)}건 확인함 — 되돌리기</button>` : ''}
    ${left && done && !state.onlyUnresolved
      ? '<button class="tiny" id="btn-only-left">남은 것만 보기</button>' : ''}
    ${state.restored ? `<span class="pg-restored">지난번에 확인한 ${fmt(state.restored)}건을 이어서 표시했습니다</span>` : ''}
    ${state.saveFailed
      ? `<span class="pg-failed">확인 표시를 이 브라우저에 남기지 못했습니다 — 저장 공간이 가득 찼습니다.
           <strong>새로고침하면 오늘 확인한 것이 사라집니다.</strong>
           브라우저 설정에서 이 사이트의 저장 공간을 비운 뒤 다시 확인해 주세요.</span>` : ''}
    ${done ? '<button class="tiny pg-danger" id="btn-clear-resolved">확인 표시 지우기</button>' : ''}`;
}

function populateFilters() {
  const areas = [...new Set(state.findings.map(f => f.areaLabel))].sort();
  const cats = [...new Set(state.findings.map(f => f.category))].sort();
  $('#f-area').innerHTML = '<option value="">전체</option>' +
    areas.map(a => `<option>${escapeHtml(a)}</option>`).join('');
  $('#f-category').innerHTML = '<option value="">전체</option>' +
    cats.map(a => `<option>${escapeHtml(a)}</option>`).join('');

  // 파일이 여럿일 때만 파일 고르개를 낸다. 하나면 고를 것이 없어 자리만 차지한다.
  const multi = state.docs.length > 1;
  $('#f-file-wrap').classList.toggle('hidden', !multi);
  if (multi) {
    // 값은 이름이 아니라 docTag 다 — 다른 폴더의 같은 이름 파일 둘을 갈라야 한다.
    const keep = $('#f-file').value;
    $('#f-file').innerHTML = '<option value="">전체</option>' +
      state.docs.map((d, i) => `<option value="${i}">${escapeHtml(d.name)}</option>`).join('');
    if (keep && state.docs[Number(keep)]) $('#f-file').value = keep;
  } else {
    $('#f-file').value = '';
  }
}

function currentFilter() {
  return {
    onlyUnresolved: state.onlyUnresolved,
    severity: $('#f-severity').value,
    area: $('#f-area').value,
    category: $('#f-category').value,
    file: $('#f-file').value,
    q: $('#f-text').value.trim().toLowerCase(),
  };
}

function filtered() {
  const f = currentFilter();
  return state.findings.filter(x =>
    (!f.onlyUnresolved || !state.resolved.has(x._id)) &&
    (!f.severity || x.severity === f.severity) &&
    (!f.area || x.areaLabel === f.area) &&
    (!f.category || x.category === f.category) &&
    (!f.file || (x.docTag || '') === f.file) &&
    (!f.q || (x.message + ' ' + x.rowLabel + ' ' + (x.fullText || '')).toLowerCase().includes(f.q)));
}

function excerptHtml(ex) {
  if (!ex) return '';
  return `<div class="f-excerpt">${escapeHtml(ex.before)}<mark>${escapeHtml(ex.match)}</mark>${escapeHtml(ex.after)}</div>`;
}

/* 짧은 발췌만으로는 이 지적을 넘겨도 되는지 판단하기 어렵다.
 * 눌렀을 때 앞뒤를 넓게 펼쳐 볼 수 있도록 확장본을 미리 만들어 숨겨 둔다. */
const CONTEXT_PAD = 300;

function contextHtml(f) {
  if (f.start == null || f.end == null || !f.fullText || !f.excerpt) return '';
  const full = f.fullText;
  // 발췌 앞뒤의 '…' 가 곧 잘렸다는 표시다. 잘린 데가 없으면 펼칠 것도 없다.
  const truncated = f.excerpt.before.startsWith('…') || f.excerpt.after.endsWith('…');
  if (!truncated) return '';
  const wide = R.excerptAround(full, f.start, f.end, CONTEXT_PAD);
  const whole = wide.before.length + wide.match.length + wide.after.length >= full.length;
  // 본문은 pre-wrap 이라 템플릿 들여쓰기까지 그대로 그려진다. 한 줄로 붙여 쓸 것.
  const body = escapeHtml(wide.before) + '<mark>' + escapeHtml(wide.match) + '</mark>' + escapeHtml(wide.after);
  return `
    <div class="f-context hidden">
      <div class="f-context-label">${whole ? '항목 전체' : '앞뒤 ' + CONTEXT_PAD + '자'}</div>
      <div class="f-context-body">${body}</div>
    </div>`;
}

/* '대회' 하나만 허용어에 넣으면 모든 대회가 통과해 버린다.
 * 앞에 붙은 말까지 묶어 '체육대회' 같은 구체적인 후보를 먼저 제안한다. */
function suggestAllowPhrase(f) {
  if (!f.excerpt || !f.excerpt.match) return f.term || '';
  const m = String(f.excerpt.before || '').match(/[가-힣A-Za-z]+$/);
  return (m ? m[0] : '') + f.excerpt.match;
}

/* 엑셀은 몇 열인지가 유용하지만, PDF 는 영역 이름이 곧 위치라 열 번호가 의미 없다. */
function whereSuffix(f) {
  const where = f.docTag ? ` · ${escapeHtml(f.fileName)}` : '';
  return (f.column && f.columnHeader !== f.column ? ` · ${f.column}열` : '') + where;
}

/* 근거를 '어느 판의 어느 조항' 과 '무슨 내용' 으로 나눠 보여 준다.
 * 조항만 알면 교사가 기재요령 원문을 펴서 바로 확인할 수 있다.
 * 기재요령 조항이 아니라 이 프로그램이 스스로 두는 점검이면 그렇게 밝힌다 — 근거를 부풀리지 않는다. */
function basisHtml(f) {
  const own = !f.clause;
  const 조항 = own ? (f.source || R.OWN_CHECK) : f.clause;
  const 기준 = own ? (f.source ? '내가 만든 기준' : '이 프로그램') : R.SOURCE.label;
  // basis 는 조항으로 시작하므로 겹치는 앞부분을 덜어 낸다.
  let rest = f.basis || '';
  if (f.clause && rest.startsWith(f.clause)) rest = rest.slice(f.clause.length).replace(/^\s*—\s*/, '');
  return `
    <div class="f-basis">
      <span class="fb-src${own ? ' is-own' : ''}">${escapeHtml(기준)}</span>
      <span class="fb-clause">${escapeHtml(조항)}</span>
      ${rest ? `<span class="fb-text">${escapeHtml(rest)}</span>` : ''}
    </div>`;
}

function findingHtml(f, showWhere) {
  const canAllow = f.excerpt && f.excerpt.match && f.category !== '분량';
  const context = contextHtml(f);
  const done = state.resolved.has(f._id);
  return `
    <div class="finding ${f.severity}${context ? ' has-context' : ''}${done ? ' is-resolved' : ''}">
      <div class="f-head">
        <label class="f-check" title="확인한 지적으로 표시합니다">
          <input type="checkbox" class="resolve-box" data-fid="${escapeHtml(f._id)}"${done ? ' checked' : ''}>
          <span>확인</span>
        </label>
        <span class="sev ${f.severity}">${R.SEVERITY_LABEL[f.severity]}</span>
        <span class="f-msg">${escapeHtml(f.message)}</span>
        ${showWhere !== false
          ? `<span class="f-where">${escapeHtml(f.rowLabel)} · ${escapeHtml(f.areaLabel)}${whereSuffix(f)}</span>`
          : `<span class="f-where">${escapeHtml(f.areaLabel)}${whereSuffix(f)}</span>`}
        ${canAllow
          ? `<button class="tiny allow-btn" data-phrase="${escapeHtml(suggestAllowPhrase(f))}"
               title="이 표현을 허용 목록에 넣어 앞으로 걸리지 않게 합니다">문제 없음</button>`
          : ''}
      </div>
      ${f.alt ? `<div class="f-alt"><span class="fa-tag">이렇게</span>${escapeHtml(f.alt)}</div>` : ''}
      ${basisHtml(f)}
      ${excerptHtml(f.excerpt)}
      ${context}
      ${context ? '<button class="f-more">앞뒤 더 보기</button>' : ''}
    </div>`;
}

/* '확인' 체크. 같은 지적이 지적사항·학생별 두 탭에 걸쳐 있으므로 양쪽을 함께 맞춘다. */
document.addEventListener('change', (e) => {
  const box = e.target.closest('.resolve-box');
  if (!box) return;
  const id = box.dataset.fid;
  if (box.checked) state.resolved.add(id); else state.resolved.delete(id);
  state.restored = 0;   // 손으로 건드린 뒤로는 '되살렸다'는 안내를 거둔다
  state.lastBulk = null;   // 손으로 하나를 건드렸으면 앞선 일괄 확인은 더 이상 '방금' 이 아니다
  saveResolvedSoon();

  document.querySelectorAll(`.resolve-box[data-fid="${CSS.escape(id)}"]`).forEach(other => {
    other.checked = box.checked;
    other.closest('.finding').classList.toggle('is-resolved', box.checked);
  });
  renderProgress();
  // '남은 것만' 을 켜 둔 상태라면 방금 확인한 항목은 목록에서 빠져야 한다.
  if (state.onlyUnresolved) { renderFindings(); renderByRow(); renderByCategory(); }
  else refreshGroupCounts();
});

/* 발췌를 누르면 앞뒤를 펼친다. 결과 화면 어디서 눌러도 같게 동작해야 하므로 위임으로 건다. */
document.addEventListener('click', (e) => {
  if (e.target.closest('.allow-btn')) return;   // '문제 없음' 버튼이 먼저다
  const card = e.target.closest('.finding.has-context');
  if (!card) return;
  if (!e.target.closest('.f-excerpt, .f-context, .f-more')) return;

  const context = card.querySelector('.f-context');
  const more = card.querySelector('.f-more');
  const opened = context.classList.toggle('hidden') === false;
  card.querySelector('.f-excerpt').classList.toggle('hidden', opened);
  if (more) more.textContent = opened ? '접기' : '앞뒤 더 보기';
});

/* '문제 없음' 처리는 결과 화면 어디서 눌러도 같게 동작해야 하므로 위임으로 한 번만 건다. */
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.allow-btn');
  if (!btn) return;
  const suggested = btn.dataset.phrase || '';
  const phrase = prompt(
    '허용할 표현을 확인해 주세요. 이 표현을 포함한 부분은 앞으로 지적하지 않습니다.\n' +
    '너무 짧게 넣으면 잡아야 할 것까지 놓치니 되도록 구체적으로 적으세요.',
    suggested);
  if (!phrase || !phrase.trim()) return;
  const list = state.settings.allowlist;
  if (!list.includes(phrase.trim())) list.push(phrase.trim());
  applySettingsChange();
});

/* 목록이 비는 데는 이유가 셋이고 뜻이 전혀 다르다 — 정말 깨끗한 것, 필터에 걸린 것,
 * 다 확인한 것. 한 문장으로 뭉뚱그리면 프로그램이 고장 난 것으로 읽힌다.
 * 무엇 때문에 비었는지와 다음에 무엇을 하면 되는지를 함께 적는다. */
function emptyPaneHtml() {
  const f = currentFilter();
  const on = [];
  if (f.severity) on.push('심각도 ‘' + (R.SEVERITY_LABEL[f.severity] || f.severity) + '’');
  if (f.area) on.push('영역 ‘' + f.area + '’');
  if (f.category) on.push('유형 ‘' + f.category + '’');
  if (f.file && state.docs[Number(f.file)]) on.push('파일 ‘' + state.docs[Number(f.file)].name + '’');
  if (f.q) on.push('검색어 ‘' + $('#f-text').value.trim() + '’');

  if (!state.findings.length) {
    return `<div class="empty">
      <p class="em-title">지적할 내용을 찾지 못했습니다.</p>
      <p>이 프로그램이 보는 기준으로는 걸리는 것이 없다는 뜻입니다.
         <strong>참고용이므로 기재 내용은 선생님이 한 번 더 확인해 주세요.</strong></p>
      <p>2단계에서 영역을 제대로 알아봤는지, 검사할 열을 빠뜨리지 않았는지도 함께 봐 주세요.</p>
    </div>`;
  }
  if (f.onlyUnresolved && !on.length) {
    return `<div class="empty">
      <p class="em-title">남은 것이 없습니다 — ${fmt(state.findings.length)}건을 모두 확인했습니다.</p>
      <p>확인한 지적을 다시 보려면 위 <strong>[남은 것만]</strong> 을 꺼 주세요.</p>
      <p><button class="tiny" id="btn-empty-reset">조건 모두 지우기</button></p>
    </div>`;
  }
  return `<div class="empty">
    <p class="em-title">이 조건에 맞는 지적이 없습니다.</p>
    <p>지금 걸어 둔 조건 — ${escapeHtml(on.join(' · ')) || '없음'}${f.onlyUnresolved ? ' · 남은 것만' : ''}</p>
    <p>전체 ${fmt(state.findings.length)}건 가운데 걸러진 것이 0건입니다. 조건을 하나씩 넓혀 보세요.</p>
    <p><button class="tiny" id="btn-empty-reset">조건 모두 지우기</button></p>
  </div>`;
}

/* 비어 있는 화면에서 바로 빠져나올 수 있어야 한다 — 어떤 조건이 걸렸는지 찾아
 * 하나씩 되돌리게 두면 필터 상자를 뒤지게 된다. */
document.addEventListener('click', (e) => {
  if (!e.target.closest('#btn-empty-reset')) return;
  ['#f-severity', '#f-area', '#f-category', '#f-file'].forEach(sel => { $(sel).value = ''; });
  $('#f-text').value = '';
  $('#f-unresolved').checked = false;
  state.onlyUnresolved = false;
  renderProgress(); renderFindings(); renderByRow(); renderByCategory();
});

/* 검사 자체에 대한 알림 — '이 칸은 검사를 중간에 멈췄다' 같은 것. 낱말 하나를 가리키는
 * 지적이 아니라 결과 전체의 신뢰도를 좌우하므로 목록 맨 위에 고정하고 800 자르기에서 뺀다.
 * 중단은 정의상 한 칸에 위반이 500건 넘게 나온 상황이라, 심각도순으로 세우면 알림이
 * **구조적으로 800건 뒤로 밀려 화면에서 사라진다** — 놓쳤는데 다 본 줄 알게 되는 자리다. */
const SCOPE_NOTICES = new Set(['cell-truncated']);

function renderFindings() {
  const all = filtered();
  const notices = all.filter(f => SCOPE_NOTICES.has(f.ruleId));
  const list = notices.length ? all.filter(f => !SCOPE_NOTICES.has(f.ruleId)) : all;
  const pinned = notices.map(f => findingHtml(f)).join('');
  $('#pane-findings').innerHTML = (all.length
    ? pinned + list.slice(0, 800).map(f => findingHtml(f)).join('') +
      (list.length > 800 ? `<p class="hint list-more">위 800건만 그렸습니다 — 나머지 ${fmt(list.length - 800)}건은 화면에 없습니다.<br>
         심각도를 ‘위반’으로 좁히거나, [학생별]·[유형별] 탭에서 나눠 보세요. 저장은 필터에 걸린 ${fmt(all.length)}건 전부 나갑니다.</p>` : '')
    : emptyPaneHtml());
}

/* 확인 표시 하나 때문에 탭을 통째로 다시 그리면 펼쳐 둔 그룹이 닫히고 스크롤을 잃는다.
 * 300건짜리 그룹을 훑는 중이라면 체크할 때마다 처음부터 다시 펼쳐야 한다.
 * 그래서 다시 그리지 않고 그룹 머리의 '남은 건수'만 제자리에서 고친다
 * (2단계 표가 '고친 묶음만 새로 그린다'로 푸는 것과 같은 문제다).
 * '남은 것만' 을 켜 둔 때는 항목 자체가 목록에서 빠져야 하므로 이 길로 오지 않는다. */
function refreshGroupCounts() {
  const left = { row: new Map(), cat: new Map() };
  for (const f of filtered()) {
    if (state.resolved.has(f._id)) continue;
    const rk = (f.docTag || '') + '|' + f.rowIndex;
    left.row.set(rk, (left.row.get(rk) || 0) + 1);
    const ck = groupKeyOf(f);
    left.cat.set(ck, (left.cat.get(ck) || 0) + 1);
  }
  document.querySelectorAll('details.rowgroup[data-kind]').forEach(d => {
    const map = left[d.dataset.kind];
    if (!map) return;
    const undone = map.get(d.dataset.gkey) || 0;
    d.classList.toggle('is-done', !undone);
    const slot = d.querySelector('.rg-counts');
    if (!slot) return;
    const btn = slot.querySelector('.cat-resolve');
    if (undone && btn) { btn.textContent = fmt(undone) + '건 모두 확인'; return; }
    if (!undone && !btn) return;
    const attr = d.dataset.kind === 'cat' ? 'data-cat' : 'data-row';
    (btn || slot.querySelector('.cat-done')).outerHTML = undone
      ? `<button class="tiny cat-resolve" ${attr}="${escapeHtml(d.dataset.gkey)}">${fmt(undone)}건 모두 확인</button>`
      : '<span class="cat-done">모두 확인함</span>';
  });
}

function renderByRow() {
  const list = filtered();
  const groups = new Map();
  for (const f of list) {
    // 파일이 여럿이면 같은 행 번호라도 다른 사람이다. 문서까지 묶어 나눈다.
    const key = (f.docTag || '') + '|' + f.rowIndex;
    if (!groups.has(key)) {
      groups.set(key, { label: f.rowLabel, file: f.fileName, rowIndex: f.rowIndex, items: [] });
    }
    groups.get(key).items.push(f);
  }
  if (!groups.size) {
    $('#pane-byrow').innerHTML = emptyPaneHtml();
    return;
  }
  const sorted = [...groups.entries()].sort((a, b) =>
    a[1].file === b[1].file ? a[1].rowIndex - b[1].rowIndex : String(a[0]).localeCompare(String(b[0])));
  const multi = state.docs.length > 1;
  // 한 학급이면 지적이 수천 건이 된다. 펼친 그룹만 그려야 화면이 버틴다.
  $('#pane-byrow').innerHTML = sorted.map(([rowIdx, g]) => {
    const c = { violation: 0, warning: 0, info: 0 };
    for (const f of g.items) c[f.severity]++;
    const pills = ['violation', 'warning', 'info']
      .filter(s => c[s])
      .map(s => `<span class="pill ${s}">${R.SEVERITY_LABEL[s]} ${fmt(c[s])}</span>`).join('');
    // 학생별로도 한 사람을 다 보면 통째로 넘길 수 있어야 한다 — 유형별과 같은 방식으로.
    const undone = g.items.filter(f => !state.resolved.has(f._id)).length;
    return `
      <details class="rowgroup${undone ? '' : ' is-done'}" data-kind="row" data-gkey="${escapeHtml(String(rowIdx))}">
        <summary>
          ${multi ? `<span class="rg-file">${escapeHtml(g.file || '')}</span>` : ''}
          <span class="rg-name">${escapeHtml(g.label)}</span>
          <span class="rg-counts">${pills}
            ${undone
              ? `<button class="tiny cat-resolve" data-row="${escapeHtml(String(rowIdx))}">${fmt(undone)}건 모두 확인</button>`
              : '<span class="cat-done">모두 확인함</span>'}
          </span>
        </summary>
        <div class="rg-body" data-filled="0"></div>
      </details>`;
  }).join('');
}

/* 그룹 안쪽은 열릴 때 채운다. toggle 은 버블링하지 않으므로 캡처 단계에서 받는다. */
document.addEventListener('toggle', (e) => {
  const d = e.target.closest && e.target.closest('details.rowgroup');
  if (!d || !d.open) return;
  const body = d.querySelector('.rg-body');
  if (!body || body.dataset.filled === '1') return;

  const kind = d.dataset.kind, key = d.dataset.gkey;
  const items = filtered().filter(f =>
    kind === 'row' ? (f.docTag || '') + '|' + f.rowIndex === key : groupKeyOf(f) === key);

  const LIMIT = 300;
  const shown = items.slice(0, LIMIT);
  body.innerHTML =
    (kind === 'cat' && items[0] && items[0].basis
      ? `<div class="cat-basis">근거: ${escapeHtml(items[0].basis)}</div>` : '') +
    shown.map(f => findingHtml(f, kind !== 'row')).join('') +
    (items.length > LIMIT
      ? `<p class="hint list-more">이 묶음의 앞 ${LIMIT}건만 그렸습니다 — 나머지 ${fmt(items.length - LIMIT)}건은 화면에 없습니다.<br>
         위 필터에서 심각도나 영역을 좁히면 남은 것도 볼 수 있습니다.</p>` : '');
  body.dataset.filled = '1';
}, true);

/* 유형별 탭에서 무엇을 기준으로 묶을지 — 금지어 낱말이 기본이다.
 * 수천 건 규모에서는 '어떤 낱말이 몇 번 나왔나' 가 가장 먼저 알아야 할 정보다. */
function groupKeyOf(f) {
  return state.catMode === 'term' ? (f.term || f.message) : f.category;
}

/* 유형별로 묶어 본다. 같은 조항에 걸린 것들이 학급 전체에 어떻게 퍼져 있는지 한눈에 들어오고,
 * 하나씩 고치는 대신 같은 유형을 한 번에 처리할 수 있다. */
function renderByCategory() {
  const list = filtered();
  const modeRow = `
    <div class="cat-mode">
      <span>묶는 기준</span>
      <label><input type="radio" name="catmode" value="term"${state.catMode === 'term' ? ' checked' : ''}> 금지어별</label>
      <label><input type="radio" name="catmode" value="category"${state.catMode === 'category' ? ' checked' : ''}> 유형별</label>
    </div>`;

  if (!list.length) {
    $('#pane-bycat').innerHTML = modeRow + emptyPaneHtml();
    return;
  }

  const groups = new Map();
  for (const f of list) {
    const k = groupKeyOf(f);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(f);
  }
  // 많이 걸린 것부터. 무엇을 먼저 손봐야 하는지가 곧 순서다.
  const sorted = [...groups.entries()].sort((a, b) =>
    b[1].length - a[1].length ||
    R.SEVERITY_ORDER[a[1][0].severity] - R.SEVERITY_ORDER[b[1][0].severity]);

  $('#pane-bycat').innerHTML = modeRow + sorted.map(([key, items]) => {
    const sev = items[0].severity;
    const who = [...new Set(items.map(f => f.rowLabel))];
    const undone = items.filter(f => !state.resolved.has(f._id)).length;
    const label = state.catMode === 'term'
      ? `‘${key}’ <span class="cat-sub">${escapeHtml(items[0].category)}</span>`
      : escapeHtml(key);
    return `
      <details class="rowgroup catgroup${undone ? '' : ' is-done'}" data-kind="cat" data-gkey="${escapeHtml(key)}">
        <summary>
          <span class="rg-name">${state.catMode === 'term' ? escapeHtml(key).replace(/^/, '‘') + '’' : label}</span>
          ${state.catMode === 'term' ? `<span class="cat-sub">${escapeHtml(items[0].category)}</span>` : ''}
          <span class="pill ${sev}">${R.SEVERITY_LABEL[sev]} ${fmt(items.length)}</span>
          <span class="cat-who">${escapeHtml(who.slice(0, 3).join(', '))}${who.length > 3 ? ` 외 ${fmt(who.length - 3)}명` : ''}</span>
          <span class="rg-counts">
            ${undone
              ? `<button class="tiny cat-resolve" data-cat="${escapeHtml(key)}">${fmt(undone)}건 모두 확인</button>`
              : '<span class="cat-done">모두 확인함</span>'}
          </span>
        </summary>
        <div class="rg-body" data-filled="0"></div>
      </details>`;
  }).join('');
}

/* 묶는 기준 바꾸기 */
document.addEventListener('change', (e) => {
  if (e.target.name !== 'catmode') return;
  state.catMode = e.target.value;
  renderByCategory();
});

/* 한 유형을 통째로 확인 처리 — 화면에 보이는(필터가 걸린) 것만 대상으로 한다. */
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.cat-resolve');
  if (!btn) return;
  e.preventDefault();   // summary 안이라 접힘이 토글되지 않게
  const pick = btn.dataset.row !== undefined
    ? (f) => (f.docTag || '') + '|' + f.rowIndex === btn.dataset.row   // 학생별 탭
    : (f) => groupKeyOf(f) === btn.dataset.cat;                        // 유형별 탭
  // 되돌릴 수 있게 '이번에 새로 넘어간 것'만 따로 적어 둔다. 이미 확인해 둔 것까지
  // 되돌리면 어제 본 것이 도로 살아나 같은 자리를 두 번 보게 된다.
  const added = [];
  filtered().filter(pick).forEach(f => {
    if (!state.resolved.has(f._id)) { state.resolved.add(f._id); added.push(f._id); }
  });
  state.lastBulk = added.length ? added : null;
  state.restored = 0;
  saveResolvedSoon();
  renderProgress();
  if (state.onlyUnresolved) { renderFindings(); renderByRow(); renderByCategory(); }
  else {
    document.querySelectorAll('.resolve-box').forEach(box => {
      const on = state.resolved.has(box.dataset.fid);
      box.checked = on;
      box.closest('.finding').classList.toggle('is-resolved', on);
    });
    refreshGroupCounts();
  }
});

function renderDups() {
  if (!state.duplicates.length) {
    $('#pane-dups').innerHTML =
      '<div class="empty"><p class="em-title">여러 학생에게 반복된 문장을 찾지 못했습니다.</p>' +
      '<p>붙여넣기로 같아진 문장이 없다는 뜻이라 좋은 결과입니다.</p>' +
      '<p>짧은 문장까지 보려면 [규칙 설정] → 형식 검사의 ‘중복 문장 판정 최소 길이’ 를 줄여 보세요. ' +
      '(지금 ' + fmt(state.settings.dupMinLen) + '자)</p></div>';
    return;
  }
  $('#pane-dups').innerHTML = state.duplicates.slice(0, 300).map(d => `
    <div class="dup">
      <div class="dup-sentence">${escapeHtml(d.sentence)}</div>
      <div class="dup-rows">
        <strong>${fmt(d.count)}곳</strong>에 반복 —
        ${d.rows.slice(0, 12).map(r =>
          escapeHtml((r.file && state.docs.length > 1 ? r.file + ' — ' : '') + r.label + ' / ' + r.area)
        ).join(' · ')}
        ${d.rows.length > 12 ? ` 외 ${fmt(d.rows.length - 12)}곳` : ''}
      </div>
    </div>`).join('');
}

/* 접힌 카드의 제목 옆에 요약을 남겨 둔다 — 접힌 채로도 무엇을 골랐는지 보이게. */
function updateCardSummaries() {
  $('#step1-sum').textContent = state.fileName || '';
  const students = totalStudents();
  const segs = state.docs.reduce((n, d) => n + (d.segments ? d.segments.length : 0), 0);
  const cols = state.docs.reduce((n, d) =>
    n + (d.columns ? d.columns.filter(c => c.role === 'text').length : 0), 0);
  const rows = state.docs.reduce((n, d) =>
    n + (d.grid ? Math.max(0, d.grid.length - d.headerRow - 1) : 0), 0);

  const parts = [];
  if (state.docs.length > 1) parts.push(`파일 ${fmt(state.docs.length)}개`);
  if (students) parts.push(`학생 ${fmt(students)}명`);
  if (segs) parts.push(`구간 ${fmt(segs)}개`);
  if (rows) parts.push(`${fmt(rows)}행`);
  if (cols) parts.push(`검사 ${fmt(cols)}열`);
  $('#step2-sum').textContent = parts.join(' · ');
}

/* 카드 접기. 학급 전체를 올리면 구간 표가 수백 줄이 되어 결과까지 스크롤이 멀다. */
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.card-toggle');
  if (!btn) return;
  const card = btn.closest('.card');
  const collapsed = card.classList.toggle('collapsed');
  btn.textContent = collapsed ? '펼치기' : '접기';
});

function collapseCard(id, collapse) {
  const card = $('#' + id);
  if (!card) return;
  card.classList.toggle('collapsed', collapse);
  const btn = card.querySelector('.card-toggle');
  if (btn) btn.textContent = collapse ? '펼치기' : '접기';
}

/* 요약 카드를 누르면 해당 보기로 데려간다. */
document.addEventListener('click', (e) => {
  const card = e.target.closest('.sum-card[data-jump]');
  if (!card) return;
  const kind = card.dataset.jump;

  if (kind === 'dups') { switchTab('dups'); return; }
  if (kind === 'rows') { switchTab('byrow'); return; }

  // 심각도 카드 — 그 심각도만 남기고 금지어 빈도순으로 세운다
  const sev = $('#f-severity');
  sev.value = kind;
  sev.dispatchEvent(new Event('change', { bubbles: true }));
  state.catMode = 'term';
  renderByCategory();
  switchTab('bycat');
});

function switchTab(name) {
  const tab = document.querySelector(`.tab[data-tab="${name}"]`);
  if (tab) tab.click();
  document.querySelector('.tabs').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* 탭 · 필터 */
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const name = tab.dataset.tab;
    ['findings', 'byrow', 'bycat', 'dups'].forEach(p =>
      $('#pane-' + p).classList.toggle('hidden', p !== name));
    // 중복 문장 탭에는 심각도·영역 필터가 적용되지 않는다. 헷갈리지 않도록 항목만 감추되,
    // 같은 상자에 든 [결과 엑셀로 저장] 은 남긴다.
    $('#filters').classList.toggle('dups-mode', name === 'dups');
  });
});

['#f-severity', '#f-area', '#f-category', '#f-file'].forEach(sel =>
  $(sel).addEventListener('change', () => { renderFindings(); renderByRow(); renderByCategory(); }));

$('#f-unresolved').addEventListener('change', (e) => {
  state.onlyUnresolved = e.target.checked;
  renderProgress();   // '남은 것만 보기' 버튼이 이미 켠 상태에서 남아 있으면 안 된다
  renderFindings(); renderByRow(); renderByCategory();
});

/* 확인 표시를 모두 지우는 것은 되돌릴 수 없다. 며칠에 걸쳐 쌓은 표시가 한 번에 날아가므로
 * 무엇이 사라지는지 건수로 밝히고 한 번 묻는다. */
document.addEventListener('click', (e) => {
  if (!e.target.closest('#btn-clear-resolved')) return;
  const n = state.findings.filter(f => state.resolved.has(f._id)).length;
  if (!confirm(`이 파일에 해 둔 확인 표시 ${fmt(n)}건을 모두 지웁니다.\n` +
               '되돌릴 수 없고, 어디까지 봤는지도 함께 사라집니다. 계속할까요?')) return;
  state.resolved.clear();
  state.restored = 0;
  state.lastBulk = null;
  saveResolved();
  renderProgress(); renderFindings(); renderByRow(); renderByCategory();
});

/* 방금 넘긴 일괄 확인을 되돌린다. [900건 모두 확인] 을 잘못 누르면 그 900건을
 * 다시는 안 보게 되는데, 그것이 이 프로그램의 가장 나쁜 실패다. */
document.addEventListener('click', (e) => {
  if (!e.target.closest('#btn-undo-bulk')) return;
  (state.lastBulk || []).forEach(id => state.resolved.delete(id));
  state.lastBulk = null;
  saveResolvedSoon();
  renderProgress(); renderFindings(); renderByRow(); renderByCategory();
});

/* 이어서 볼 것으로 가는 길. 필터 속 체크상자와 같은 상태를 쓴다. */
document.addEventListener('click', (e) => {
  if (!e.target.closest('#btn-only-left')) return;
  $('#f-unresolved').checked = true;
  state.onlyUnresolved = true;
  renderProgress(); renderFindings(); renderByRow(); renderByCategory();
});
let searchTimer;
$('#f-text').addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { renderFindings(); renderByRow(); renderByCategory(); }, 180);
});

/* ── 결과 내보내기 ─────────────────────────────────────────── */
$('#btn-export').addEventListener('click', () => {
  const list = filtered();
  // PDF 는 영역 이름이 곧 위치라 '열' 번호가 없다. 자료 형태에 맞춰 열 구성을 바꾼다.
  const isPdf = state.source === 'pdf';
  // 파일이 여럿이면 어느 파일에서 나온 지적인지가 첫 번째로 궁금한 값이다.
  const multi = state.docs.length > 1;
  const head = (multi ? ['파일'] : []).concat(isPdf
    ? ['확인', '학생', '항목(영역)', '문서 구간', '심각도', '유형', '지적 내용', '고치는 방법', '기준 문서', '조항', '근거', '해당 부분']
    : ['확인', '행', '학생/행', '영역', '열', '항목명', '심각도', '유형', '지적 내용', '고치는 방법', '기준 문서', '조항', '근거', '해당 부분']);
  const mark = (f) => state.resolved.has(f._id) ? 'O' : '';
  const srcLabel = (f) => f.clause ? R.SOURCE.label : (f.source ? '내가 만든 기준' : '이 프로그램');
  const toRow = (f) => (multi ? [f.fileName || ''] : []).concat(isPdf
    ? [mark(f), f.rowLabel, f.areaLabel, f.columnHeader,
       R.SEVERITY_LABEL[f.severity], f.category, f.message, f.alt || '',
       srcLabel(f), f.clause || f.source || R.OWN_CHECK, f.basis || '',
       f.excerpt ? f.excerpt.match : '']
    : [mark(f), f.rowIndex + 1, f.rowLabel, f.areaLabel, f.column, f.columnHeader,
       R.SEVERITY_LABEL[f.severity], f.category, f.message, f.alt || '',
       srcLabel(f), f.clause || f.source || R.OWN_CHECK, f.basis || '',
       f.excerpt ? f.excerpt.match : '']);

  // 파일만 따로 돌아다녀도 참고용이라는 게 보이도록 첫 줄에 주의 문구를 둔다.
  const aoa = [[CAUTION_TEXT], []].concat([head]).concat(list.map(toRow));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = (multi ? [{ wch: 22 }] : []).concat(isPdf
    ? [{ wch: 5 }, { wch: 18 }, { wch: 22 }, { wch: 20 }, { wch: 7 }, { wch: 18 },
       { wch: 40 }, { wch: 46 }, { wch: 20 }, { wch: 26 }, { wch: 44 }, { wch: 24 }]
    : [{ wch: 5 }, { wch: 6 }, { wch: 18 }, { wch: 16 }, { wch: 5 }, { wch: 20 },
       { wch: 7 }, { wch: 18 }, { wch: 40 }, { wch: 46 }, { wch: 20 }, { wch: 26 },
       { wch: 44 }, { wch: 24 }]);
  XLSX.utils.book_append_sheet(wb, ws, '지적사항');

  if (state.duplicates.length) {
    const dHead = ['반복 횟수', '문장', '해당 위치'];
    const dAoa = [[CAUTION_TEXT], []].concat([dHead]).concat(state.duplicates.map(d => [
      d.count, d.sentence, d.rows.map(r => r.label + '/' + r.area).join(' · '),
    ]));
    const dws = XLSX.utils.aoa_to_sheet(dAoa);
    dws['!cols'] = [{ wch: 9 }, { wch: 70 }, { wch: 50 }];
    XLSX.utils.book_append_sheet(wb, dws, '중복문장');
  }

  const base = state.docs.length > 1 ? '생기부_' + state.docs.length + '개파일'
    : (state.fileName.replace(/\.[^.]+$/, '') || '생기부');
  XLSX.writeFile(wb, base + '_검사결과.xlsx');
});

/* ── 설정 모달 ─────────────────────────────────────────────── */
const modal = $('#settings-modal');
$('#btn-settings').addEventListener('click', () => { renderSettings(); modal.classList.remove('hidden'); });
$('#btn-close-settings').addEventListener('click', () => modal.classList.add('hidden'));
// 배경을 눌러 닫되, 누르기가 배경에서 '시작'했을 때만 닫는다.
// click 으로 받으면 파일 선택창을 닫고 돌아온 잔여 클릭이나, 모달 안에서 드래그해
// 밖에서 손을 뗀 경우까지 닫혀 버린다.
modal.addEventListener('mousedown', (e) => { if (e.target === modal) modal.classList.add('hidden'); });

function renderSettings() {
  $('#limits-grid').innerHTML = R.AREAS.map(a => {
    const v = state.settings.limits[a.key];
    return `<div class="limit-item">
      <span>${escapeHtml(a.label)}</span>
      <span><input type="number" class="num limit-input" data-area="${a.key}" min="0" max="5000"
        value="${v == null ? '' : v}" placeholder="제한없음"> 자</span>
    </div>`;
  }).join('');

  $('#dict-list').innerHTML = state.settings.dictionary.map((d, i) => d.id === CUSTOM_BAN_ID ? '' : `
    <details class="dict-cat">
      <summary>
        <input type="checkbox" class="dict-on" data-i="${i}" ${d.enabled === false ? '' : 'checked'}>
        <span class="dc-name">${escapeHtml(d.category)}</span>
        <span class="dc-count">${d.terms.length}개</span>
        <select class="dc-sev dict-sev" data-i="${i}">
          <option value="violation"${d.severity === 'violation' ? ' selected' : ''}>위반</option>
          <option value="warning"${d.severity === 'warning' ? ' selected' : ''}>주의</option>
          <option value="info"${d.severity === 'info' ? ' selected' : ''}>점검</option>
        </select>
      </summary>
      <div class="dict-body">
        <p class="db-basis">근거: <input type="text" class="dict-basis" data-i="${i}"
           value="${escapeHtml(d.basis || '')}" style="width:100%"></p>
        <textarea class="dict-terms" data-i="${i}"
          placeholder="쉼표 또는 줄바꿈으로 구분">${escapeHtml(d.terms.join(', '))}</textarea>
        <div class="db-row">
          <button class="ghost dict-del" data-i="${i}">이 항목 삭제</button>
        </div>
      </div>
    </details>`).join('');

  $('#proximity-list').innerHTML = R.PROXIMITY.map(p => `
    <label class="check-line">
      <input type="checkbox" class="prox-on" data-id="${p.id}"
        ${(state.settings.disabledRules || []).includes(p.id) ? '' : 'checked'}>
      ${escapeHtml(p.category)}
    </label>`).join('');

  $('#pattern-list').innerHTML = R.PATTERNS.map(p => `
    <label class="check-line">
      <input type="checkbox" class="pat-on" data-id="${p.id}"
        ${state.settings.disabledPatterns.includes(p.id) ? '' : 'checked'}>
      ${escapeHtml(p.basis)}
    </label>`).join('');

  $('#opt-length').checked = state.settings.checkLength !== false;
  applyLengthToggle();
  const ban = customBan();
  $('#custom-ban-input').value = ban.terms.join(', ');
  $('#custom-ban-sev').value = ban.severity;
  $('#allowlist-input').value = (state.settings.allowlist || []).join(', ');
  renderCustomCounts();
  $('#opt-ending').checked = state.settings.checkEnding;
  $('#opt-duplen').value = state.settings.dupMinLen;

  const hint = $('#save-hint');
  hint.classList.toggle('is-error', !!state.settingsPending);
  hint.textContent = state.settingsPending
    ? '지난번에 서버로 올리지 못한 내용이 남아 있습니다. [저장]을 눌러 마무리해 주세요.' : '';
}

function renderCustomCounts() {
  const n = customBan().terms.length;
  const m = (state.settings.allowlist || []).length;
  $('#custom-ban-count').textContent = n ? n + '개' : '';
  $('#allowlist-count').textContent = m ? m + '개' : '';
}

/* 직접 넣는 칸은 적은 것이 바로 걸리는지 보여야 쓸 만하다. 다만 학급 전체는 지적이
 * 수천 건이라 글자마다 다시 돌릴 수는 없어, 손을 멈춘 뒤에 한 번만 돌린다. */
let applyTimer = null;
function applySettingsSoon() {
  clearTimeout(applyTimer);
  applyTimer = setTimeout(() => { renderCustomCounts(); applySettingsChange(); }, 500);
}

/* 분량 검사를 끄면 글자수 입력란은 쓸 일이 없으므로 함께 잠근다. */
function applyLengthToggle() {
  const on = state.settings.checkLength !== false;
  const grid = $('#limits-grid');
  grid.classList.toggle('is-off', !on);
  grid.querySelectorAll('input').forEach(i => { i.disabled = !on; });
}

/* 모달 안의 입력은 종류가 많아 개별 리스너 대신 위임으로 한 번에 받는다. */
$('.modal-body').addEventListener('input', (e) => {
  const t = e.target;
  if (t.classList.contains('limit-input')) {
    const v = t.value.trim();
    state.settings.limits[t.dataset.area] = v === '' ? null : Number(v);
  } else if (t.classList.contains('dict-terms')) {
    state.settings.dictionary[t.dataset.i].terms =
      t.value.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
  } else if (t.classList.contains('dict-basis')) {
    state.settings.dictionary[t.dataset.i].basis = t.value;
  } else if (t.id === 'custom-ban-input') {
    customBan().terms = splitTerms(t.value);
    applySettingsSoon();
  } else if (t.id === 'allowlist-input') {
    state.settings.allowlist = splitTerms(t.value);
    applySettingsSoon();
  } else if (t.id === 'opt-duplen') {
    state.settings.dupMinLen = Math.max(8, Number(t.value) || 20);
  }
});

$('.modal-body').addEventListener('change', (e) => {
  const t = e.target;
  if (t.classList.contains('dict-on')) {
    state.settings.dictionary[t.dataset.i].enabled = t.checked;
  } else if (t.classList.contains('dict-sev')) {
    state.settings.dictionary[t.dataset.i].severity = t.value;
  } else if (t.classList.contains('prox-on')) {
    const set = new Set(state.settings.disabledRules || []);
    if (t.checked) set.delete(t.dataset.id); else set.add(t.dataset.id);
    state.settings.disabledRules = [...set];
  } else if (t.classList.contains('pat-on')) {
    const set = new Set(state.settings.disabledPatterns);
    if (t.checked) set.delete(t.dataset.id); else set.add(t.dataset.id);
    state.settings.disabledPatterns = [...set];
  } else if (t.id === 'custom-ban-sev') {
    customBan().severity = t.value;
    applySettingsSoon();
  } else if (t.id === 'opt-length') {
    state.settings.checkLength = t.checked;
    applyLengthToggle();
  } else if (t.id === 'opt-ending') {
    state.settings.checkEnding = t.checked;
  }
});

$('.modal-body').addEventListener('click', (e) => {
  if (e.target.classList.contains('dict-del')) {
    state.settings.dictionary.splice(Number(e.target.dataset.i), 1);
    renderSettings();
  }
});

$('#btn-add-cat').addEventListener('click', () => {
  const name = prompt('추가할 사전 항목의 이름을 적어 주세요. (예: 교외 체험활동)');
  if (!name) return;
  state.settings.dictionary.push({
    id: 'custom-' + Date.now(), category: name, severity: 'warning',
    basis: '직접 추가한 항목', terms: [], enabled: true,
  });
  renderSettings();
});

/* 되돌리기는 [저장] 바로 옆에 있고 되돌릴 수 없다. '직접 고친 내용' 이라고만 하면
 * 무엇이 사라지는지 몰라 누르게 되므로, 손으로 쌓은 것을 건수로 세어 보여 준다. */
$('#btn-reset').addEventListener('click', () => {
  const 잃는것 = [];
  const ban = customBan().terms.length;
  const allow = (state.settings.allowlist || []).length;
  // custom-ban 은 위 '직접 넣은 금지어' 로 이미 셌다. 두 번 세면 없는 항목이 있는 것처럼 보인다.
  const 추가항목 = state.settings.dictionary
    .filter(d => d.id !== CUSTOM_BAN_ID && String(d.id || '').startsWith('custom-')).length;
  const 끈규칙 = (state.settings.disabledPatterns || []).length + (state.settings.disabledRules || []).length;
  if (ban) 잃는것.push(`직접 넣은 금지어 ${fmt(ban)}개`);
  if (allow) 잃는것.push(`허용 표현 ${fmt(allow)}개`);
  if (추가항목) 잃는것.push(`직접 만든 사전 항목 ${fmt(추가항목)}개`);
  if (끈규칙) 잃는것.push(`꺼 둔 규칙 ${fmt(끈규칙)}개`);

  if (!confirm('규칙을 기재요령 기본값으로 되돌립니다.\n\n' +
      (잃는것.length ? '사라지는 것 — ' + 잃는것.join(', ') + '\n' : '') +
      '고쳐 둔 글자수 한도와 사전 낱말도 모두 처음 상태가 됩니다.\n' +
      '되돌릴 수 없습니다. 계속할까요?')) return;
  state.settings = defaultSettings();
  renderSettings();
  applySettingsChange();
});

/* 저장에 실패해도 손으로 고친 규칙이 날아가면 안 된다. 서버가 잠깐 꺼져 있었을 뿐인데
 * 새로고침 한 번에 사라지면 다시 넣을 방법이 없다. 실패분은 브라우저에 담아 두고
 * 다음에 열 때 되살린 뒤, [저장] 을 다시 누르라고 알린다. */
const PENDING_KEY = 'srcheck.settings.pending';

function stashSettings() {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(state.settings)); } catch (e) { /* 용량 초과 */ }
}
function clearStash() {
  try { localStorage.removeItem(PENDING_KEY); } catch (e) { /* 무시 */ }
}

$('#btn-save').addEventListener('click', saveSettings);

async function saveSettings() {
  const hint = $('#save-hint');
  hint.classList.remove('is-error');
  hint.textContent = '저장 중…';

  // 직렬화 실패도 TypeError 라, 통신 실패와 뭉뚱그리면 엉뚱한 안내를 하게 된다. 먼저 떼어 낸다.
  let body;
  try {
    body = JSON.stringify(state.settings);
  } catch (e) {
    stashSettings();
    hint.classList.add('is-error');
    hint.textContent = '규칙을 저장할 형태로 바꾸지 못했습니다: ' + e.message;
    return;
  }

  try {
    const res = await fetch('/api/dictionary', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: body,
    });
    let out = {};
    try { out = await res.json(); } catch (e) { /* 본문이 JSON 이 아닐 수도 있다 */ }
    if (res.status === 404) {
      // API 자체가 없는 배포(예: 학교 웹 배포판)다. 고장이 아니라 애초에 이 기능이 빠진
      // 형태이므로, '서버가 꺼졌다'는 식으로 말하면 안 된다.
      const err = new Error('NO_API');
      err.noApi = true;
      throw err;
    }
    if (!res.ok) throw new Error(out.error || ('서버가 ' + res.status + ' 로 답했습니다'));
    clearStash();
    state.settingsPending = false;
    state.serverOk = true;
    $('#server-warn').classList.add('hidden');
    hint.textContent = '저장했습니다.';
    setTimeout(() => { if (hint.textContent === '저장했습니다.') hint.textContent = ''; }, 2500);
    applySettingsChange();
  } catch (err) {
    // fetch 자체가 실패하면(서버가 꺼져 있거나 재시작 중) TypeError 가 온다.
    // 'Failed to fetch' 만 보여 주면 무엇을 해야 할지 알 수 없다.
    stashSettings();
    state.settingsPending = true;
    state.serverOk = false;
    hint.classList.toggle('is-error', !err.noApi);   // 배포판 안내는 오류가 아니라 정상 동작이다
    hint.textContent = messageFor(err);
    showServerWarn(err.noApi ? 'standalone' : undefined);
  }
}

/* 무엇 때문에 못 올렸는지 갈라서 알려 준다. '서버에 닿지 못했습니다' 하나로 뭉뚱그리면
 * 파일을 직접 연 경우 / 학교 웹 배포판처럼 원인이 다른 것까지 같은 말이 되어 헤매게 된다. */
function messageFor(err) {
  const 담아둠 = ' 고친 내용은 이 브라우저에 담아 두었으니 사라지지 않습니다.';
  if (location.protocol === 'file:') {
    // 파일로 열었을 때는 이것이 정상 동작이다. 실패로 말하면 안 된다.
    return '이 브라우저에 저장했습니다 — 새로고침해도 그대로입니다. ' +
      '백업은 [규칙 내보내기] 후 [규칙 가져오기].';
  }
  if (err.noApi) {
    // 학교 웹 배포판: 원래 이 브라우저에만 저장되는 형태다. 고장이 아니다.
    return '이 브라우저에 저장했습니다. (웹 배포판은 저장 내용이 다른 선생님과 공유되지 않고, ' +
      '이 컴퓨터·이 브라우저에서만 유지됩니다.)';
  }
  if (err instanceof TypeError) {
    return '서버에 닿지 못했습니다(' + err.message + '). 터미널에서 node server.js 가 떠 있는지 ' +
      '확인한 뒤 [저장]을 다시 눌러 주세요.' + 담아둠;
  }
  return '저장 실패: ' + err.message + 담아둠;
}

/* 설정이 바뀌면 2단계 표의 글자수 표시와 이미 본 검사 결과가 모두 낡는다.
 * 저장·되돌리기 어디서 바꾸든 같은 자리를 거치게 한다. */
function applySettingsChange() {
  if (state.docs.length) renderDocs();
  if (state.checked) runCheck();
}

/* ── 규칙 파일 주고받기 ──────────────────────────────────────
 * 사전과 허용 표현은 손으로 쌓아 올린 자산이라 옮길 수단이 있어야 한다.
 * 규칙만 담기므로 생기부 내용이 파일에 새어 나가지 않는다. */
function ioHint(msg, isError) {
  const el = $('#io-hint');
  el.textContent = msg;
  el.classList.toggle('is-error', !!isError);
  if (!isError) setTimeout(() => { if (el.textContent === msg) el.textContent = ''; }, 4000);
}

$('#btn-export-rules').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state.settings, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `생기부탐색기-규칙-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  ioHint('내보냈습니다.');
});

$('#btn-import-rules').addEventListener('click', () => $('#rules-file').click());

$('#rules-file').addEventListener('change', (e) => {
  const file = e.target.files[0];
  e.target.value = '';           // 같은 파일을 다시 고를 수 있게 비운다
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (ev) => {
    let parsed;
    try {
      parsed = JSON.parse(ev.target.result);
    } catch (err) {
      ioHint('읽지 못했습니다 — JSON 형식이 아닙니다.', true);
      return;
    }
    if (!parsed || !Array.isArray(parsed.dictionary)) {
      ioHint('이 프로그램의 규칙 파일이 아닙니다.', true);
      return;
    }
    if (parsed.rulesVersion !== RULES_VERSION) {
      const from = parsed.rulesVersion || '판 표기 없음';
      if (!confirm(`이 파일은 ‘${from}’ 기준입니다. 지금은 ‘${RULES_VERSION}’ 판을 쓰고 있어\n` +
                   '글자수 한도나 조항이 어긋날 수 있습니다. 그래도 가져올까요?')) return;
    }
    // 빠진 항목은 현재 기본값으로 채운다. 판 표기는 지금 판으로 맞춘다.
    state.settings = fillAlt(Object.assign(defaultSettings(), parsed, { rulesVersion: RULES_VERSION }));
    renderSettings();
    applySettingsChange();
    const n = state.settings.dictionary.length;
    ioHint('가져왔습니다 — 사전 ' + n + '개 항목으로 바뀌었습니다' +
      (n < 10 ? ' (기본 사전이 대체되었습니다. 되돌리려면 [기본값으로 되돌리기])' : '') +
      '. [저장]을 눌러야 다음에도 유지됩니다.');
  };
  reader.onerror = () => ioHint('파일을 읽지 못했습니다.', true);
  reader.readAsText(file);
});

/* 저장해 둔 설정에는 대체 표현(alt)이 없을 수 있다. 근거 문서의 판이 바뀐 것이 아니라
 * 이 프로그램이 나중에 붙인 안내라서, 판 검사에는 걸리지 않고 조용히 사라진다.
 * 교사가 고친 낱말·심각도는 그대로 두고 안내만 규칙 id 로 맞춰 채운다. */
function fillAlt(settings) {   // 대체 표현과 근거 조항을 채운다
  const base = new Map(R.DICTIONARY.map(d => [d.id, d]));
  for (const d of settings.dictionary || []) {
    const b = base.get(d.id);
    if (!b) continue;
    if (!d.alt && b.alt) d.alt = b.alt;
    if (!d.altByTerm && b.altByTerm) d.altByTerm = b.altByTerm;
    if (d.clause === undefined) d.clause = b.clause;
  }
  return settings;
}

/* 시작할 때 저장해 둔 설정을 불러온다. */
(async function initSettings() {
  try {
    const res = await fetch('/api/dictionary');
    if (res.status === 404) {
      // API 없는 배포(학교 웹 배포판) — 서버가 고장 난 게 아니라 애초에 이 형태다.
      state.serverOk = false;
      showServerWarn('standalone');
      restorePending();
      return;
    }
    const saved = await res.json();
    if (!saved || !Array.isArray(saved.dictionary)) return;

    if (saved.rulesVersion !== RULES_VERSION) {
      // 근거 문서가 바뀌었다. 옛 설정을 되살리면 틀린 한도로 검사하게 되므로 기본값을 쓴다.
      const info = $('#file-info');
      info.classList.remove('hidden');
      info.textContent =
        '저장해 둔 규칙 설정이 이전 판(' + (saved.rulesVersion || '판 표기 없음') + ')이라 적용하지 않았습니다. ' +
        '현재 판(' + RULES_VERSION + ') 기본 규칙으로 검사합니다. ' +
        '직접 고치셨던 내용이 있다면 [규칙 설정]에서 다시 넣고 저장해 주세요.';
      return;
    }
    state.settings = fillAlt(Object.assign(defaultSettings(), saved));
    state.serverOk = true;
  } catch (e) {
    // 서버 없이 열린 경우 — 검사는 그대로 되지만 규칙 저장만 안 된다.
    // 저장을 눌러 보고 나서야 알게 되면 늦으므로 미리 알린다.
    state.serverOk = false;
    showServerWarn();
  }
  restorePending();
})();

/* 두 경우를 갈라 말한다 — 뜻이 다르기 때문이다.
 *
 * 파일을 직접 열었으면(file://) 고장이 아니다. 검사도 규칙 설정도 다 되고, 고친 규칙은
 * localStorage 에 남아 새로고침해도 살아난다. 다만 그 브라우저에만 산다.
 * 이것을 '저장이 되지 않습니다' 라고 하면, 그대로 써도 되는 사람이 터미널을 켜야 하는 줄 알고
 * 규칙 설정을 통째로 접는다. 실제로 나온 질문이라 문구를 갈랐다.
 *
 * http:// 인데 서버에 못 닿는 것은 다르다. 규칙이 파일에 사는 줄 알고 쓰던 사람이므로
 * 그대로 두면 잃는다 — 이쪽은 고쳐야 할 문제로 말한다. */
function showServerWarn(kind) {
  const el = $('#server-warn');
  if (!el) return;
  if (!kind) kind = location.protocol === 'file:' ? 'file' : 'localdown';
  el.classList.remove('hidden');
  el.classList.toggle('is-note', kind !== 'localdown');   // '고장'만 강한 경고색, 나머지는 안내색
  if (kind === 'file') {
    el.innerHTML = '<strong>html 파일을 직접 열어쓰는 중입니다.</strong> ' +
      '검사와 규칙 설정은 이 브라우저에 남습니다. (다른 브라우저나 컴퓨터에서는 작동 안 함.)<br>' +
      '백업은 [규칙 설정] → [규칙 내보내기] 후 [규칙 가져오기]';
  } else if (kind === 'standalone') {
    // 학교 웹 배포판: 애초에 서버 저장 기능이 없는 형태다. 고장이 아니므로 안내 톤으로만 말한다.
    el.innerHTML = '규칙 설정은 <strong>이 브라우저에만</strong> 저장되며, 다른 선생님과는 공유되지 않습니다. ' +
      '검사 기능은 그대로 사용할 수 있습니다.';
  } else {
    el.innerHTML = '서버에 닿지 못해 <strong>규칙이 파일에 저장되지 않습니다.</strong> ' +
      '터미널에서 <code>node server.js</code> 가 떠 있는지 확인해 주세요. ' +
      '(검사는 지금도 되고, 고친 규칙은 이 브라우저에 담아 둡니다)';
  }
}

/* 화면 코드가 언제 것인지 머리에 적어 둔다. 고친 내용이 반영됐는지 확인할 길이 없으면
 * 브라우저가 옛 파일을 들고 있는 것을 모른 채 엉뚱한 곳을 찾게 된다. */
(async function showBuild() {
  const el = $('#build');
  if (!el) return;
  try {
    const res = await fetch('/api/version');
    const v = await res.json();
    const d = new Date(v.builtAt);
    const two = (n) => String(n).padStart(2, '0');
    el.textContent = '화면 코드 ' + (d.getMonth() + 1) + '/' + d.getDate() + ' ' +
      two(d.getHours()) + ':' + two(d.getMinutes());
  } catch (e) { /* 서버 없이 열린 경우 — 위 배너가 따로 알린다 */ }
})();

/* 지난번에 서버로 올리지 못한 설정을 되살린다. 서버에 남은 것보다 나중 것이므로 덮어쓴다. */
function restorePending() {
  let pending;
  try { pending = JSON.parse(localStorage.getItem(PENDING_KEY) || 'null'); } catch (e) { return; }
  if (!pending || !Array.isArray(pending.dictionary)) return;
  if (pending.rulesVersion !== RULES_VERSION) { clearStash(); return; }
  state.settings = fillAlt(Object.assign(defaultSettings(), pending));
  state.settingsPending = true;
}

})();
