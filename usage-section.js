'use strict';
/* 사용법·검사 규칙 섹션 — usage.html 의 슬라이드를 위에서 아래로 이어 붙여 그린다.
 * 한 장씩 넘기던 방식을 스크롤로 바꾼 것일 뿐 내용은 그대로다. */
(function () {

const USE = [
  {title:"1. 로그인", sub:"배부받은 아이디와 비밀번호로 접속합니다.",
   mock:`<div class="mock"><div class="mock-login"><div class="lg"></div><h3>학교생활기록부 점검 도우미</h3><p class="ls">교내 접속용 · 로그인이 필요합니다</p><div class="lf">아이디</div><div class="li"></div><div class="lf">비밀번호</div><div class="li"></div><div class="lb">로그인</div></div></div>`,
   notes:[["아이디","배부받은 아이디(예: teacher01)를 입력합니다."],["비밀번호","함께 받은 비밀번호를 입력합니다."],["로그인","누르면 앱으로 들어갑니다. 한 번 로그인하면 하루 유지됩니다."]]},
  {title:"2. 첫 화면 둘러보기", sub:"로그인하면 이 화면이 나옵니다.",
   mock:`<div class="mock"><div class="mock-top"><div class="mock-burger">≡</div><div class="mock-title">학교생활기록부 점검 도우미</div><div class="mock-navlink">파일 열기</div><div class="mock-badge">🔒 외부 전송 없음</div><div class="mock-ghost">로그아웃</div></div><div class="mock-main"><div class="mock-side"><div class="st">점검 단계</div><div class="sl on"><span class="sn">1</span>파일 열기</div><div class="sl"><span class="sn">2</span>항목 확인</div><div class="sl"><span class="sn">3</span>검사 결과</div></div><div class="mock-content"><div class="mock-caution">[주의] 참고용 자료입니다. 최종 판단은 교사가 확인하세요.</div><div class="mock-drop"><div class="dm">엑셀·PDF를 여기에 끌어다 놓기</div><div class="ds">클릭해서 선택할 수도 있어요</div></div></div></div></div>`,
   notes:[["≡ 메뉴 접기","왼쪽 메뉴를 접거나 펼칩니다."],["점검 단계 메뉴","1→2→3 단계로 이동. 지금 단계는 분홍색 강조."],["파일 올리는 곳","파일을 끌어다 놓거나 클릭해서 고릅니다."],["개인정보 안내","파일은 이 브라우저 안에서만 처리됩니다."],["로그아웃","사용을 마치면 여기서 로그아웃."]]},
  {title:"3. 검사할 항목 확인", sub:"무엇을 검사할지 자동으로 맞춰집니다.",
   mock:`<div class="mock"><div class="mock-top"><div class="mock-title">학교생활기록부 점검 도우미</div><div class="mock-badge">🔒 외부 전송 없음</div></div><div class="mock-content"><div style="font-size:12px;font-weight:700;margin-bottom:10px">② 검사할 항목 확인</div><div class="mock-run">검사 실행</div><div style="margin-top:12px"><div class="mock-row"><span>세부능력 및 특기사항</span><span style="margin-left:auto;color:#999">검사함</span></div><div class="mock-row"><span>행동특성 및 종합의견</span><span style="margin-left:auto;color:#999">검사함</span></div><div class="mock-row"><span>번호 / 이름 열</span><span style="margin-left:auto;color:#999">검사 안 함</span></div></div></div></div>`,
   notes:[["검사 실행","확인이 끝나면 눌러서 검사를 시작합니다."],["자동 인식된 항목","검사 대상이 자동으로 맞춰져 있습니다. 틀리면 바꿀 수 있어요."]]},
  {title:"4. 검사 결과 보기", sub:"결과가 네 개의 탭으로 정리됩니다.",
   mock:`<div class="mock"><div class="mock-top"><div class="mock-title">학교생활기록부 점검 도우미</div><div class="mock-badge">🔒 외부 전송 없음</div></div><div class="mock-content"><div class="mock-tabs"><div class="mock-tab on">지적 사항</div><div class="mock-tab">학생별</div><div class="mock-tab">유형별</div><div class="mock-tab">중복 문장</div></div><div class="mock-filter"><div class="mock-sel">심각도 ▾</div><div class="mock-sel">영역 ▾</div><div class="mock-sel" style="flex:1;text-align:left">🔎 검색</div><div class="mock-sel" style="background:var(--soft)">결과 엑셀로 저장</div></div><div class="mock-row"><span class="dot v"></span><span>부모 직업 암시 표현</span></div><div class="mock-row"><span class="dot w"></span><span>맥락 확인이 필요한 표현</span></div><div class="mock-row"><span class="dot i"></span><span>표기·형식 점검</span></div></div></div>`,
   notes:[["4개의 탭","지적 사항 / 학생별 / 유형별 / 중복 문장."],["심각도 필터","위반·주의·점검 중 골라 봅니다."],["검색","낱말·학생을 찾을 때."],["엑셀로 저장","지적 목록을 엑셀로 내려받기."],["색깔","🔴위반 🟡주의 ⚪점검"]]},
  {title:"5. 규칙 설정 (선택)", sub:"처음에는 건드리지 않아도 됩니다.",
   mock:`<div class="mock"><div class="mock-top"><div class="mock-title">학교생활기록부 점검 도우미</div><div class="mock-badge">🔒 외부 전송 없음</div><div class="mock-ghost">규칙 설정</div></div><div class="mock-content"><div class="mock-caution" style="border-color:#f3d3cc">⚠️ 처음엔 건드리지 않아도 됩니다. 기본값 그대로 쓰세요.</div><div class="mock-row"><span>금지어·허용 표현 직접 넣기</span></div><div class="mock-row"><span>기본값: 2026학년도 기재요령 기준</span></div></div></div>`,
   notes:[["규칙 설정","상단/왼쪽 메뉴에서 엽니다."],["처음엔 그대로","기본값이 기재요령 기준으로 맞춰져 있습니다."],["직접 추가","학교만의 금지어를 더할 수 있어요. 이 브라우저에만 저장."]]},
];
const RULE = [
  {title:"검사 규칙 ① — 이렇게 검사합니다", sub:"다섯 가지 방식으로 한 칸씩 살펴봅니다.", full:true,
   html:`<div class="way">
     <div class="way-item"><b>1. 분량 초과</b><span>영역별 글자 수 한도를 넘는지 확인 (NEIS 기준 바이트로 계산)</span></div>
     <div class="way-item"><b>2. 금지 표현</b><span>기재요령상 적으면 안 되는 낱말·표현이 있는지 사전으로 검색</span></div>
     <div class="way-item"><b>3. 형식·표기</b><span>개인정보 형식, 특수기호, 이모지 등 표기 문제</span></div>
     <div class="way-item"><b>4. 문맥 규칙</b><span>'부모 직업'처럼 특정 단어가 함께 나올 때만 잡는 규칙</span></div>
     <div class="way-item" style="grid-column:1/-1"><b>5. 문장 종결</b><span>서술형 영역에서 '-함/-임' 명사형 종결을 지키는지 (참고용)</span></div>
   </div>`},
  {title:"검사 규칙 ② — 영역별 글자 수 한도", sub:"NEIS 실제 한도에 맞춰 계산합니다. (한글 1자 = 3바이트)", full:true,
   html:`<div class="lim-grid">AREA_ROWS</div>`},
  {title:"검사 규칙 ③ — 주로 잡아내는 금지 표현", sub:"모두 「2026학년도 학교생활기록부 기재요령(고등학교)」 근거입니다.", full:true,
   html:`GROUP_ROWS`},
  {title:"검사 규칙 ④ — 심각도 3단계", sub:"색깔로 구분해 표시합니다.", full:true,
   html:`<div class="sev-row"><span class="sev-badge sev-v">위반</span><span class="d"><b>기재요령에 어긋날 가능성이 큼</b><span> — 꼭 확인하고 수정하세요. (예: 부모 직업, 교외 수상)</span></span></div>
     <div class="sev-row"><span class="sev-badge sev-w">주의</span><span class="d"><b>맥락에 따라 문제될 수 있음</b><span> — 문장을 보고 판단하세요.</span></span></div>
     <div class="sev-row"><span class="sev-badge sev-i">점검</span><span class="d"><b>표기·형식 관련</b><span> — 가볍게 확인하세요. (예: 띄어쓰기, 기호)</span></span></div>
     <p style="font-size:12px;color:var(--muted);margin-top:12px">※ 애매한 경우 놓치지 않도록 '위반'으로 넉넉히 표시합니다. 최종 판단은 반드시 선생님이 하세요.</p>`},
];
// 실제 데이터 주입
const AREA_ROWS = `<div class="lim"><span>인적·학적사항 특기사항</span><b>500자</b></div><div class="lim"><span>출결상황 특기사항</span><b>500자</b></div><div class="lim"><span>수상경력 수상명</span><b>100자</b></div><div class="lim"><span>자격증 명칭</span><b>100자</b></div><div class="lim"><span>자율·자치활동</span><b>500자</b></div><div class="lim"><span>동아리활동</span><b>500자</b></div><div class="lim"><span>진로활동</span><b>500자</b></div><div class="lim"><span>봉사활동실적 활동내용</span><b>50자</b></div><div class="lim"><span>일상생활 활동상황</span><b>1000자</b></div><div class="lim"><span>과목별 세부능력 및 특기사항</span><b>500자</b></div><div class="lim"><span>개인별 세부능력 및 특기사항</span><b>500자</b></div><div class="lim"><span>독서활동상황(공통)</span><b>500자</b></div><div class="lim"><span>독서활동상황(과목별)</span><b>250자</b></div><div class="lim"><span>행동특성 및 종합의견</span><b>300자</b></div>`;
const GROUP_ROWS = `<div class="grow-item"><div class="gi-top"><b>부모·친인척 배경</b><span class="clause">유의사항 3-차</span></div><span class="gi-desc">부모·친인척의 직업·지위 암시</span></div><div class="grow-item"><div class="gi-top"><b>교외 수상·대회</b><span class="clause">유의사항 3-나·다</span></div><span class="gi-desc">교내·외 대회 참여·수상, 올림피아드</span></div><div class="grow-item"><div class="gi-top"><b>공인어학·모의고사 성적</b><span class="clause">유의사항 3-가·마</span></div><span class="gi-desc">TOEIC·TEPS, 모의고사 성적 등</span></div><div class="grow-item"><div class="gi-top"><b>특정 대학·기관·상호명</b><span class="clause">유의사항 3-타</span></div><span class="gi-desc">대학명·학원명·기업명·브랜드</span></div><div class="grow-item"><div class="gi-top"><b>논문·도서·지식재산권</b><span class="clause">유의사항 3-바·사·아</span></div><span class="gi-desc">학회 발표, 도서출간, 특허 등</span></div><div class="grow-item"><div class="gi-top"><b>자격증·인증시험</b><span class="clause">유의사항 3-라·파</span></div><span class="gi-desc">자격증 명칭, 교내외 인증시험</span></div><div class="grow-item"><div class="gi-top"><b>학교 특정·개인정보</b><span class="clause">유의사항 4</span></div><span class="gi-desc">학교를 알 수 있는 내용, 개인정보 노출</span></div><div class="grow-item"><div class="gi-top"><b>기타 입력 불가</b><span class="clause">세특 입력 불가 등</span></div><span class="gi-desc">방과후학교·MOOC·소논문·기부 등</span></div>`;
RULE[1].html = RULE[1].html.replace('AREA_ROWS', AREA_ROWS);
RULE[2].html = RULE[2].html.replace('GROUP_ROWS', GROUP_ROWS);


const host = document.getElementById('usage-body');
if (!host) return;
function slide(s) {
  const head = `<h3 class="slide-title">${s.title}</h3><p class="slide-sub">${s.sub}</p>`;
  if (s.full) return `<article class="slide">${head}${s.html}</article>`;
  return `<article class="slide">${head}<div class="slide-grid"><div class="mock-wrap">${s.mock}</div>` +
    `<ol class="notes">${s.notes.map((n, i) => `<li><span class="n">${i + 1}</span><span class="tx"><b>${n[0]}</b><span>${n[1]}</span></span></li>`).join('')}</ol></div></article>`;
}
host.innerHTML =
  `<h3 class="group-title">사용법</h3>${USE.map(slide).join('')}` +
  `<h3 class="group-title">검사 규칙</h3>${RULE.map(slide).join('')}`;
})();
