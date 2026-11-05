/**
 * =========================================================================================
 * [2027 학교생활기록부 & 대입진학상담] 듀얼 관계형 구글 시트 통합 Apps Script 엔진
 * =========================================================================================
 * 
 * 1. 커스텀 함수 제공:
 *    - =AI(프롬프트, 활동내용, [추가맥락]): 셀 안에서 Gemini API 즉시 호출
 *    - =AI_SETUK(과목명, 탐구활동내용, 희망진로): 3단 구조(동기-활동-성장) 세특 초안 자동 생성
 *    - =NEIS_BYTES(텍스트): 교육부 나이스 바이트 수(한글 3B, 영문/숫자 1B, 엔터 2B) 자동 계산
 * 
 * 2. 듀얼 관계형 동기화 API (Web App):
 *    - 학급 담임용 시트 ↔ 교과 담임용 시트 간 학번(ID) 기반 실시간 상호 참조
 *    - 다부서 동아리/진로활동 내용 자동 취합 및 합산
 * 
 * 3. Google Docs 상담 일지 자동 생성 및 링크 연동:
 *    - 학생별 개인 상담 포트폴리오 구글 독스 문서 자동 생성 및 시트 링크 바인딩
 */

// ==========================================
// [설정] 개인 Gemini API 키 등록 (시트 메뉴에서 입력 가능)
// ==========================================
function getGeminiApiKey() {
  var props = PropertiesService.getScriptProperties();
  var key = props.getProperty("GEMINI_API_KEY");
  if (!key) {
    // 기본값 또는 안내
    key = "AIzaSy_YOUR_API_KEY_HERE"; 
  }
  return key;
}

// 시트 상단 메뉴 생성
// 시트 상단 메뉴 생성
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("🏆 생기부 올인원 관리 (math-tong)")
    .addItem("📊 대시보드 및 승인 시트 예쁘게 자동 생성", "setupExecutiveDashboard")
    .addSeparator()
    .addItem("✅ '대기' 상태 신청자 전체 일괄 승인", "approveAllPendingUsers")
    .addItem("✨ 선택한 행의 교사 즉시 승인", "approveSelectedUser")
    .addItem("🚫 선택한 행의 교사 '반려' 처리", "rejectSelectedUser")
    .addSeparator()
    .addItem("📋 학번 기준 명렬표 자동 동기화", "syncAllTabsByNameList")
    .addItem("📑 다부서 동아리/진로활동 자동 합산", "aggregateClubActivities")
    .addItem("📁 선택 학생 Google Docs 상담일지 생성", "createDocsForSelectedRow")
    .addSeparator()
    .addItem("🔑 Gemini API 키 설정", "promptSetApiKey")
    .addItem("🔗 NEIS 올인원 웹앱 바로가기", "openWebApp")
    .addToUi();
}

/**
 * [📊_대시보드] 및 [사용자승인] 탭을 최고급 대시보드 서식으로 자동 생성 및 정리
 */
function setupExecutiveDashboard() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. [📊_대시보드] 탭 생성 또는 기존 시트 서식 리셋
  var dash = ss.getSheetByName("📊_대시보드") || ss.getSheetByName("대시보드");
  if (!dash) {
    dash = ss.insertSheet("📊_대시보드", 0);
  } else {
    dash.clear();
  }
  ss.setActiveSheet(dash);
  dash.setTabColor("#2563eb");

  // 2. [사용자승인] 탭 확인 및 서식 정리
  var appSheet = ss.getSheetByName("사용자승인");
  if (!appSheet) {
    appSheet = ss.insertSheet("사용자승인", 1);
  }
  formatApprovalSheet(appSheet);

  // 3. 대시보드 전체 폰트 Pretendard 및 배경 설정
  dash.getRange("A1:Z60").setFontFamily("Pretendard").setBackground("#f8fafc");

  // [헤더 배너]
  dash.getRange("A1:I2").merge()
    .setValue("🏫 2026-2027 학교생활기록부 & 대입진학상담 올인원 통합 대시보드")
    .setBackground("#0f172a")
    .setFontColor("#ffffff")
    .setFontSize(15)
    .setFontWeight("bold")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");

  dash.getRange("A3:I3").merge()
    .setValue("실시간 교사 사용 승인 관제 · 1학년 30명 진학상담 관제 · 교과세특 1500B 바이트 분석 | 저작권: math-tong")
    .setBackground("#1e293b")
    .setFontColor("#94a3b8")
    .setFontSize(10.5)
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");

  // [섹션 타이틀 1: 사용자 승인 현황 KPI]
  dash.getRange("A5").setValue("📌 교사 사용 승인 신청 및 인증 현황")
    .setFontSize(12).setFontWeight("bold").setFontColor("#0f172a");

  // KPI 카드 4개 구성
  // Card 1: 총 신청 교사
  dash.getRange("B6:C6").merge().setValue("👥 총 신청 교사").setFontSize(10).setFontWeight("bold").setFontColor("#475569").setHorizontalAlignment("center").setBackground("#ffffff");
  dash.getRange("B7:C8").merge().setFormula('=IFERROR(COUNTA(\'사용자승인\'!D2:D), 0) & "명"').setFontSize(18).setFontWeight("bold").setFontColor("#0f172a").setHorizontalAlignment("center").setVerticalAlignment("middle").setBackground("#ffffff");
  dash.getRange("B6:C8").setBorder(true, true, true, true, false, false, "#cbd5e1", SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

  // Card 2: 승인 완료 교사 (1개월 권한)
  dash.getRange("D6:E6").merge().setValue("✅ 승인 완료 (이용 가능)").setFontSize(10).setFontWeight("bold").setFontColor("#15803d").setHorizontalAlignment("center").setBackground("#f0fdf4");
  dash.getRange("D7:E8").merge().setFormula('=IFERROR(COUNTIF(\'사용자승인\'!G2:G, "승인"), 0) & "명"').setFontSize(18).setFontWeight("bold").setFontColor("#15803d").setHorizontalAlignment("center").setVerticalAlignment("middle").setBackground("#f0fdf4");
  dash.getRange("D6:E8").setBorder(true, true, true, true, false, false, "#86efac", SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

  // Card 3: 승인 대기 중 (관리자 확인 필요)
  dash.getRange("F6:G6").merge().setValue("⏳ 승인 대기 (확인 필요)").setFontSize(10).setFontWeight("bold").setFontColor("#b45309").setHorizontalAlignment("center").setBackground("#fffbeb");
  dash.getRange("F7:G8").merge().setFormula('=IFERROR(COUNTIF(\'사용자승인\'!G2:G, "대기"), 0) & "명"').setFontSize(18).setFontWeight("bold").setFontColor("#b45309").setHorizontalAlignment("center").setVerticalAlignment("middle").setBackground("#fffbeb");
  dash.getRange("F6:G8").setBorder(true, true, true, true, false, false, "#fde68a", SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

  // Card 4: 신천고/교육청 자동승인
  dash.getRange("H6:I6").merge().setValue("⚡ 학교계정 자동승인").setFontSize(10).setFontWeight("bold").setFontColor("#2563eb").setHorizontalAlignment("center").setBackground("#eff6ff");
  dash.getRange("H7:I8").merge().setFormula('=IFERROR(COUNTIF(\'사용자승인\'!H2:H, "*자동승인*"), 0) & "명"').setFontSize(18).setFontWeight("bold").setFontColor("#2563eb").setHorizontalAlignment("center").setVerticalAlignment("middle").setBackground("#eff6ff");
  dash.getRange("H6:I8").setBorder(true, true, true, true, false, false, "#93c5fd", SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

  // [섹션 타이틀 2: 학급 진학상담 및 세특 관제]
  dash.getRange("A10").setValue("📊 1학년 1반 30명 모의 학급 진학 & 세특 기록 관제")
    .setFontSize(12).setFontWeight("bold").setFontColor("#0f172a");

  // Card 5: 관리 학생 수
  dash.getRange("B11:C11").merge().setValue("🎓 등록 학생 수").setFontSize(10).setFontWeight("bold").setFontColor("#be185d").setHorizontalAlignment("center").setBackground("#fdf2f8");
  dash.getRange("B12:C13").merge().setFormula('=IFERROR(IF(ISBLANK(\'1_학급담임_마스터\'!A2), "30명", COUNTA(\'1_학급담임_마스터\'!A2:A) & "명"), "30명")').setFontSize(18).setFontWeight("bold").setFontColor("#be185d").setHorizontalAlignment("center").setVerticalAlignment("middle").setBackground("#fdf2f8");
  dash.getRange("B11:C13").setBorder(true, true, true, true, false, false, "#fbcfe8", SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

  // Card 6: 평균 내신 등급
  dash.getRange("D11:E11").merge().setValue("📈 2028 개편 평균 내신").setFontSize(10).setFontWeight("bold").setFontColor("#7e22ce").setHorizontalAlignment("center").setBackground("#faf5ff");
  dash.getRange("D12:E13").merge().setFormula('=IFERROR(TEXT(AVERAGE(\'1_학급담임_마스터\'!D2:D), "0.00") & " 등급", "2.35 등급")').setFontSize(18).setFontWeight("bold").setFontColor("#7e22ce").setHorizontalAlignment("center").setVerticalAlignment("middle").setBackground("#faf5ff");
  dash.getRange("D11:E13").setBorder(true, true, true, true, false, false, "#e9d5ff", SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

  // Card 7: 1500B 세특 작성 완성률
  dash.getRange("F11:G11").merge().setValue("✍️ 1500B 세특 작성률").setFontSize(10).setFontWeight("bold").setFontColor("#0f766e").setHorizontalAlignment("center").setBackground("#f0fdfa");
  dash.getRange("F12:G13").merge().setFormula('=IFERROR(TEXT(COUNTIF(\'교과담임_세특\'!F2:F, "<>") / COUNTA(\'교과담임_세특\'!A2:A), "0.0%"), "100.0%")').setFontSize(18).setFontWeight("bold").setFontColor("#0f766e").setHorizontalAlignment("center").setVerticalAlignment("middle").setBackground("#f0fdfa");
  dash.getRange("F11:G13").setBorder(true, true, true, true, false, false, "#99f6e4", SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

  // Card 8: NEIS 웹앱 바로가기 버튼 카드
  dash.getRange("H11:I11").merge().setValue("🔗 NEIS 올인원 웹앱").setFontSize(10).setFontWeight("bold").setFontColor("#ffffff").setHorizontalAlignment("center").setBackground("#1e293b");
  dash.getRange("H12:I13").merge().setValue("https://neis-help-one.vercel.app").setFontSize(11).setFontWeight("bold").setFontColor("#38bdf8").setHorizontalAlignment("center").setVerticalAlignment("middle").setBackground("#1e293b");
  dash.getRange("H11:I13").setBorder(true, true, true, true, false, false, "#0f172a", SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

  // [섹션 타이틀 3: 실시간 신청자 현황 쿼리 뷰]
  dash.getRange("A15").setValue("📋 최근 교사 사용 승인 신청 내역 (실시간 동기화)")
    .setFontSize(12).setFontWeight("bold").setFontColor("#0f172a");

  dash.getRange("B16:I16").setBackground("#1e293b").setFontColor("#ffffff").setFontWeight("bold").setFontSize(10.5).setHorizontalAlignment("center");
  dash.getRange("B16").setValue("신청일시");
  dash.getRange("C16").setValue("교사성명");
  dash.getRange("D16").setValue("소속학교");
  dash.getRange("E16").setValue("이메일");
  dash.getRange("F16").setValue("담당과목/학년");
  dash.getRange("G16").setValue("신청사유");
  dash.getRange("H16").setValue("승인상태");
  dash.getRange("I16").setValue("메모/구분");

  // 실시간 쿼리 수식
  dash.getRange("B17").setFormula('=IFERROR(QUERY(\'사용자승인\'!A2:H, "SELECT A, B, C, D, E, F, G, H WHERE A IS NOT NULL ORDER BY A DESC LIMIT 20", 0), "아직 접수된 신청 내역이 없습니다.")');

  // 열 너비 설정
  dash.setColumnWidth(1, 24);
  dash.setColumnWidth(2, 140);
  dash.setColumnWidth(3, 90);
  dash.setColumnWidth(4, 150);
  dash.setColumnWidth(5, 190);
  dash.setColumnWidth(6, 120);
  dash.setColumnWidth(7, 200);
  dash.setColumnWidth(8, 100);
  dash.setColumnWidth(9, 160);

  SpreadsheetApp.getUi().alert("🎉 [📊_대시보드] 및 [사용자승인] 탭이 최고급 대시보드 서식으로 자동 생성되었습니다!");
}

/**
 * [사용자승인] 탭 서식 정리 및 드롭다운/조건부 서식 자동 적용
 */
function formatApprovalSheet(appSheet) {
  if (!appSheet) return;
  appSheet.setTabColor("#10b981");

  // 헤더 행이 비어있으면 작성
  if (appSheet.getLastRow() === 0) {
    appSheet.appendRow(["신청일시", "교사성명", "소속학교", "이메일", "연락처/과목", "신청사유", "승인상태", "메모/구분"]);
    var now = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd HH:mm:ss");
    appSheet.appendRow([now, "김선생", "신천고등학교", "math@sch.hs.kr", "1학년 공통수학", "1학년 1반 세특 및 진학상담 연동", "승인", "학교 공식 계정 자동승인"]);
    appSheet.appendRow([now, "이선생", "소래고등학교", "lee@goedu.kr", "2학년 수학I", "대입 진학상담 워크벤치 활용", "승인", "학교 공식 계정 자동승인"]);
    appSheet.appendRow([now, "박선생", "서울신천고등학교", "park@sen.go.kr", "1학년 공통수학", "교과세특 1500B 바이트 계산 및 초안 작성", "대기", "관리자 승인 대기"]);
  }

  // 1행 헤더 서식
  appSheet.getRange("A1:H1")
    .setBackground("#0f172a")
    .setFontColor("#ffffff")
    .setFontWeight("bold")
    .setFontSize(11)
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");
  appSheet.setRowHeight(1, 38);
  appSheet.setFrozenRows(1);

  // 열 너비
  appSheet.setColumnWidth(1, 150);
  appSheet.setColumnWidth(2, 95);
  appSheet.setColumnWidth(3, 160);
  appSheet.setColumnWidth(4, 210);
  appSheet.setColumnWidth(5, 130);
  appSheet.setColumnWidth(6, 220);
  appSheet.setColumnWidth(7, 105);
  appSheet.setColumnWidth(8, 170);

  // G열(승인상태) 드롭다운 데이터 유효성 검사 (승인, 대기, 반려)
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["승인", "대기", "반려"], true)
    .setAllowInvalid(false)
    .build();
  appSheet.getRange("G2:G500").setDataValidation(rule).setHorizontalAlignment("center");

  // G열 조건부 서식
  var range = appSheet.getRange("G2:G500");
  var ruleApproved = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo("승인")
    .setBackground("#dcfce7")
    .setFontColor("#15803d")
    .setBold(true)
    .setRanges([range])
    .build();

  var rulePending = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo("대기")
    .setBackground("#fef3c7")
    .setFontColor("#b45309")
    .setBold(true)
    .setRanges([range])
    .build();

  var ruleRejected = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo("반려")
    .setBackground("#fee2e2")
    .setFontColor("#b91c1c")
    .setBold(true)
    .setRanges([range])
    .build();

  appSheet.setConditionalFormatRules([ruleApproved, rulePending, ruleRejected]);
}

/**
 * 대기 중인 모든 신청자 일괄 '승인' 처리
 */
function approveAllPendingUsers() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("사용자승인");
  if (!sheet) {
    SpreadsheetApp.getUi().alert("사용자승인 시트를 찾을 수 없습니다.");
    return;
  }
  var data = sheet.getDataRange().getValues();
  var count = 0;
  for (var r = 1; r < data.length; r++) {
    var status = String(data[r][6]).trim();
    if (status === "대기" || status === "") {
      sheet.getRange(r + 1, 7).setValue("승인");
      sheet.getRange(r + 1, 8).setValue("관리자 일괄 승인");
      count++;
    }
  }
  SpreadsheetApp.getUi().alert("🎉 총 " + count + "명의 대기 신청자가 '승인' 처리되었습니다! (1개월간 이용 가능)");
}

/**
 * 현재 선택한 행의 교사 즉시 '승인' 처리
 */
function approveSelectedUser() {
  var sheet = SpreadsheetApp.getActiveSheet();
  if (sheet.getName() !== "사용자승인") {
    SpreadsheetApp.getUi().alert("'사용자승인' 시트에서 승인할 행의 셀을 선택하고 실행해주세요.");
    return;
  }
  var row = sheet.getActiveCell().getRow();
  if (row <= 1) return;
  sheet.getRange(row, 7).setValue("승인");
  sheet.getRange(row, 8).setValue("관리자 즉시 승인");
  SpreadsheetApp.getUi().alert("✅ " + row + "행의 교사가 '승인' 완료되었습니다.");
}

/**
 * 현재 선택한 행의 교사 '반려' 처리
 */
function rejectSelectedUser() {
  var sheet = SpreadsheetApp.getActiveSheet();
  if (sheet.getName() !== "사용자승인") {
    SpreadsheetApp.getUi().alert("'사용자승인' 시트에서 반려할 행의 셀을 선택하고 실행해주세요.");
    return;
  }
  var row = sheet.getActiveCell().getRow();
  if (row <= 1) return;
  sheet.getRange(row, 7).setValue("반려");
  sheet.getRange(row, 8).setValue("관리자 반려");
  SpreadsheetApp.getUi().alert("🚫 " + row + "행의 교사가 '반려' 처리되었습니다.");
}

/**
 * NEIS 올인원 웹앱 브라우저로 열기 안내
 */
function openWebApp() {
  var html = HtmlService.createHtmlOutput(
    '<div style="font-family:sans-serif; text-align:center; padding:20px;">' +
    '<h3>🏫 학교생활기록부 올인원</h3>' +
    '<p>아래 버튼을 누르면 웹앱으로 즉시 이동합니다.</p>' +
    '<a href="https://neis-help-one.vercel.app" target="_blank" style="display:inline-block; padding:10px 20px; background:#2563eb; color:#fff; text-decoration:none; border-radius:6px; font-weight:bold;">웹앱 열기</a>' +
    '</div>'
  ).setWidth(360).setHeight(180);
  SpreadsheetApp.getUi().showModalDialog(html, "NEIS 올인원 웹앱");
}

function promptSetApiKey() {
  var ui = SpreadsheetApp.getUi();
  var resp = ui.prompt("Gemini API 키 등록", "Google AI Studio에서 발급받은 API 키를 입력하세요:", ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton() === ui.Button.OK) {
    var key = resp.getResponseText().trim();
    if (key) {
      PropertiesService.getScriptProperties().setProperty("GEMINI_API_KEY", key);
      ui.alert("API 키가 성공적으로 저장되었습니다! 이제 =AI() 및 =AI_SETUK() 함수를 사용하실 수 있습니다.");
    }
  }
}

// ==========================================
// 1. 구글 시트 전용 커스텀 함수 (Custom Functions)
// ==========================================

/**
 * 나이스 규격 글자수/바이트 계산 함수
 * 한글: 3바이트, 영문/숫자/기호: 1바이트, 줄바꿈(엔터): 2바이트
 * @param {string} text 계산할 텍스트
 * @return {number} 나이스 바이트 수
 * @customfunction
 */
function NEIS_BYTES(text) {
  if (!text) return 0;
  var str = String(text);
  var bytes = 0;
  for (var i = 0; i < str.length; i++) {
    var c = str.charCodeAt(i);
    if (c === 10) { // 줄바꿈
      bytes += 2;
    } else if (c > 127) { // 한글 등 유니코드
      bytes += 3;
    } else {
      bytes += 1;
    }
  }
  return bytes;
}

/**
 * 구글 시트 셀 안에서 제미나이 AI를 호출하는 함수
 * @param {string} prompt 지시사항
 * @param {string} context1 활동 내용 또는 학생 관찰 데이터
 * @param {string} context2 추가 맥락 (희망진로 등)
 * @return {string} AI가 작성한 초안
 * @customfunction
 */

// ==========================================
// [신규] 숨겨진/보호된 '_설정_프롬프트지침' 탭에서 지침 자동 참조
// ==========================================
// ==========================================
// [신규] 스킬 지침 셀($B$5) 우선 참조 및 커스텀 함수 엔진
// ==========================================
function getSystemPromptInstructions() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("_스킬지침") || ss.getSheetByName("0_AI함수_사용안내_및_스킬지침") ||
              ss.getSheetByName("0_AI함수_사용안내") ||
              ss.getSheetByName("_설정_프롬프트지침") ||
              ss.getSheetByName("설정_프롬프트지침");
  if (!sheet) {
    return "당신은 고등학교 생기부 및 세특 전문 교사입니다. 교육부 훈령 기재요령을 준수하여 [동기-과정-성장] 3단 논법으로 1,500 Byte(한글 500자) 이내, 개조식 종결(~함, ~임)으로 작성하세요. 사교육, 수상경력, 공인어학시험, 외부경시대회 언급은 엄격히 금지됩니다.";
  }

  // 1순위: B5 셀 단독 조회 (스킬 지침 텍스트)
  try {
    var b5 = String(sheet.getRange("B5").getValue() || "").trim();
    if (b5.length > 20) return b5;
  } catch(e) {}

  // 2순위: B2:B8 범위 조합
  try {
    var data = sheet.getRange("B2:B8").getValues();
    var parts = [];
    for (var i = 0; i < data.length; i++) {
      var val = String(data[i][0] || "").trim();
      if (val) parts.push(val);
    }
    if (parts.length > 0) return parts.join("\n");
  } catch(e) {}

  return "교육부 훈령 기재요령 준수 3단 논법 1,500 Byte 작성.";
}

/**
 * 구글 시트 셀 안에서 제미나이 AI를 호출하는 커스텀 함수
 * @param {string} prompt 지시사항 또는 활동내용
 * @param {string} [context1] 추가 맥락 1 (예: 과목명 또는 학생 특성)
 * @param {string} [context2] 추가 맥락 2 (예: 희망진로)
 * @param {string} [customGuideline] 셀에 기록된 스킬 지침 (예: '0_AI함수_사용안내_및_스킬지침'!$B$5)
 * @return {string} AI가 작성한 초안
 * @customfunction
 */
function AI(prompt, context1, context2, customGuideline) {
  if (!prompt && !context1) return "";

  // 🌟 [배열/범위 자동 파싱 지원] F2:I2 또는 단일 셀 등 구글 시트 범위 매끄럽게 처리
  var parseArg = function(v) {
    if (v === null || v === undefined) return "";
    if (Array.isArray(v)) {
      return v.map(function(row) {
        if (Array.isArray(row)) {
          return row.map(function(c) { return String(c || "").trim(); }).filter(Boolean).join(" | ");
        }
        return String(row || "").trim();
      }).filter(Boolean).join("\n");
    }
    return String(v).trim();
  };

  var pStr = parseArg(prompt);
  var c1Str = parseArg(context1);
  var c2Str = parseArg(context2);
  var fullText = [pStr, c1Str, c2Str].filter(Boolean).join("\n\n");
  
  // 1순위: 파라미터로 직접 전달된 스킬 지침 셀 텍스트
  var sysPrompt = "";
  if (customGuideline && String(customGuideline).trim().length > 10) {
    sysPrompt = String(customGuideline).trim();
  } else {
    // 2순위: 시트 첫 번째 탭 '0_AI함수_사용안내_및_스킬지침'의 B5 또는 설정탭 B2:B8
    sysPrompt = getSystemPromptInstructions();
  }
  
  // 캐싱 적용 (동일 입력에 대한 과도한 API 호출 방지)
  var cache = CacheService.getDocumentCache();
  var cacheKey = "ai_" + Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, fullText + sysPrompt)).slice(0, 30);
  var cached = cache ? cache.get(cacheKey) : null;
  if (cached) return cached;

  var apiKey = getGeminiApiKey();
  if (!apiKey || apiKey.includes("YOUR_API_KEY")) {
    return "[안내] 상단 메뉴 [🎓 NEIS 생기부 마스터] > [🔑 Gemini API Key 등록]에서 API 키를 먼저 등록해 주세요.";
  }

  try {
    var url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + apiKey;
    var payload = {
      contents: [{
        parts: [{ text: "[작성 지침 및 기재요령]:\n" + sysPrompt + "\n\n[학생 활동 관찰 데이터]:\n" + fullText }]
      }],
      generationConfig: { temperature: 0.35, maxOutputTokens: 700 }
    };

    var res = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    var json = JSON.parse(res.getContentText());
    var resultText = json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts[0].text;
    
    if (resultText) {
      resultText = resultText.trim();
      if (cache) cache.put(cacheKey, resultText, 21600); // 6시간 캐시
      return resultText;
    }
    return "생성 실패: AI 모델 응답 없음";
  } catch(e) {
    return "API 호출 오류: " + e.toString();
  }
}

/**
 * 3단 구조(동기-활동-성장) 과목별 세특 초안 생성 커스텀 함수
 * @param {string} subject 과목명 (예: 경제, 수학I)
 * @param {string} activity 학생 탐구활동 및 수행평가 관찰 내용
 * @param {string} [careerHope] 학생 희망진로/학과 (선택)
 * @param {string} [skillCell] '0_AI함수_사용안내_및_스킬지침'!$B$5 와 같은 지침 셀 참조 (선택)
 * @return {string} 1,500 Byte 3단 논법 세특 초안
 * @customfunction
 */
function AI_SETUK(subject, activity, careerHope, skillCell) {
  if (!activity) return "";
  var prompt = subject + " 과목 세부능력 및 특기사항 작성. " +
               (careerHope ? "희망 진로: " + careerHope + ". " : "") +
               "수업 관찰 및 탐구 내용: " + activity + ". " +
               "지침: '탐구 동기 및 계기 ➔ 자기주도적 탐구 수행 과정 ➔ 배움과 학업적/역량적 성장'의 3단계 흐름으로 완성할 것.";
  return AI(prompt, "", "", skillCell);
}

/**
 * 학급 담임용 행동특성 및 종합의견 초안 생성 커스텀 함수
 * @param {string} studentName 학생 성명
 * @param {string} obsAutonomy 자율/인성/리더십 관찰 메모
 * @param {string} obsCareer 동아리/진로/학업 관찰 메모
 * @param {string} [personality] 교사가 파악한 핵심 인성 및 강점 키워드
 * @param {string} [skillCell] '0_AI함수_사용안내_및_스킬지침'!$B$5 스킬 지침 셀
 * @return {string} 행동특성 및 종합의견 초안 (1,500 Byte 이내)
 * @customfunction
 */
function AI_HAENGTEUK(studentName, obsAutonomy, obsCareer, personality, skillCell) {
  if (!obsAutonomy && !obsCareer) return "";
  var prompt = "학생 성명: " + (studentName || "학생") + "\n" +
               "자율·인성·학급기여 관찰: " + (obsAutonomy || "성실하고 책임감 있게 학급 활동에 임함") + "\n" +
               "동아리·진로·학업역량 관찰: " + (obsCareer || "자기주도적으로 학업과 진로 탐구에 몰입함") + "\n" +
               (personality ? "교사 총평 키워드: " + personality + "\n" : "") +
               "작성 요청: 교육부 훈령 기재요령을 준수하여 인성과 잠재력이 돋보이도록 행동특성 및 종합의견 400~500자(1,500 Byte 이내)를 개조식 종결어미(~함, ~임)로 작성할 것.";
  return AI(prompt, "", "", skillCell);
}

function aggregateClubActivities() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  var ui = SpreadsheetApp.getUi();

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return;

  // 학번(A열)을 키로 맵 생성
  var map = {};
  for (var i = 1; i < data.length; i++) {
    var sid = String(data[i][0]).trim(); // A열: 학번
    if (!sid) continue;
    var name = data[i][1]; // B열: 이름
    var act = data[i][2];  // C열: 활동내용

    if (!map[sid]) {
      map[sid] = { name: name, activities: [] };
    }
    if (act) {
      map[sid].activities.push(act);
    }
  }

  // 별도 취합 탭 생성 또는 업데이트
  var targetTab = ss.getSheetByName("취합_통합결과");
  if (!targetTab) {
    targetTab = ss.insertSheet("취합_통합결과");
    targetTab.appendRow(["학번", "성명", "통합 활동내용", "나이스 바이트 수", "=AI() 세특/창체 초안"]);
  } else {
    targetTab.clear();
    targetTab.appendRow(["학번", "성명", "통합 활동내용", "나이스 바이트 수", "=AI() 세특/창체 초안"]);
  }

  var rows = [];
  for (var id in map) {
    var combined = map[id].activities.join("\n\n");
    rows.push([
      id,
      map[id].name,
      combined,
      '=NEIS_BYTES(C' + (rows.length + 2) + ')',
      '=AI("창의적체험활동 특기사항 작성: ", C' + (rows.length + 2) + ')'
    ]);
  }

  if (rows.length > 0) {
    targetTab.getRange(2, 1, rows.length, 5).setValues(rows);
    ui.alert("총 " + rows.length + "명 학생의 다부서 활동내용이 [취합_통합결과] 탭에 학번 기준으로 자동 합산되었습니다!");
  }
}

// ==========================================
// 3. 학생별 Google Docs 상담 일지 자동 생성
// ==========================================
function createDocsForSelectedRow() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  var row = sheet.getActiveRange().getRow();
  var ui = SpreadsheetApp.getUi();

  if (row <= 1) {
    ui.alert("학생 정보가 있는 데이터 행을 선택한 후 실행해 주세요.");
    return;
  }

  var sId = sheet.getRange(row, 1).getValue();   // A열: 학번
  var sName = sheet.getRange(row, 2).getValue(); // B열: 성명
  var sMajor = sheet.getRange(row, 4).getValue(); // D열: 희망학과
  var sUni = sheet.getRange(row, 7).getValue();  // G열: 1지망 대학

  if (!sName) {
    ui.alert("선택한 행에 학생 성명이 없습니다.");
    return;
  }

  var docName = "[대입진학상담] " + (sId ? sId + "_" : "") + sName;
  var doc = DocumentApp.create(docName);
  var body = doc.getBody();

  body.appendParagraph(docName).setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph("■ 생성일시: " + Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd HH:mm"));
  body.appendParagraph("■ 기본정보: " + sId + " " + sName + " (희망분야: " + (sMajor || "미정") + ")");
  body.appendParagraph("■ 1지망 목표대학: " + (sUni || "상담 후 결정"));
  body.appendHorizontalRule();
  body.appendParagraph("【심층 진학상담 및 세특 누적 기록】").setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph("일자: " + Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd"));
  body.appendParagraph("상담내용: 초기 목표대학 설정 및 과목별 탐구활동 방향 논의.");
  
  var docUrl = doc.getUrl();

  // 시트의 마지막 열 또는 L열(상담일지 링크)에 URL 기입
  sheet.getRange(row, 12).setValue(docUrl); // L열
  ui.alert("Google Docs 상담일지가 생성되었습니다!\n링크가 L열에 기록되었습니다:\n" + docUrl);
}

// ==========================================
// 4. 웹앱 양방향 통신 API (doGet, doPost)
// ==========================================
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || "ping";
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();

  if (action === "getPromptRules") {
    var promptRules = getSystemPromptInstructions();
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      rules: promptRules
    })).setMimeType(ContentService.MimeType.JSON);
  }

  if (action === "ping") {
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      sheetTitle: ss.getName(),
      activeTab: sheet.getName(),
      rowCount: sheet.getLastRow()
    })).setMimeType(ContentService.MimeType.JSON);
  }

  if (action === "getRelationalData") {
    var studentId = e.parameter.studentId;
    var data = sheet.getDataRange().getValues();
    var result = null;

    for (var r = 1; r < data.length; r++) {
      if (String(data[r][0]).trim() === String(studentId).trim() || String(data[r][1]).trim() === String(studentId).trim()) {
        result = {
          studentId: data[r][0],
          name: data[r][1],
          careerHope: data[r][3] || "", // 희망분야
          targetUni: data[r][6] || "",   // 목표대학
          counselMemo: data[r][10] || "",
          docUrl: data[r][11] || ""
        };
        break;
      }
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: !!result,
      data: result
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // === [교과담임 모바일 교무수첩 관찰메모 조회 API] ===
  if (action === "get_subject_memos") {
    var subSheet = ss.getSheetByName("교과담임_세특") || ss.getSheetByName("1_교과명렬_관찰기록");
    if (!subSheet) {
      return ContentService.createTextOutput(JSON.stringify({ success: true, list: [] }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    var data = subSheet.getDataRange().getValues();
    var list = [];
    for (var r = 1; r < data.length; r++) {
      var row = data[r];
      if (!row[0] && !row[1]) continue;
      list.push({
        studentId: row[0],
        name: row[1],
        subject: row[2],
        memo: row[3],
        tags: row[4],
        draft: row[5],
        updatedAt: row[6]
      });
    }
    return ContentService.createTextOutput(JSON.stringify({ success: true, list: list }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // === [사용자 승인 상태 조회 API — '2_교사승인명단' 체크박스(A열) & 1개월(90일) 만료 자동 확인] ===
  if (action === "check_access") {
    var email = (e.parameter.email || "").trim().toLowerCase();
    var chkSheet = ss.getSheetByName("2_교사승인명단");
    if (chkSheet) {
      var rows = chkSheet.getDataRange().getValues();
      for (var i = 4; i < rows.length; i++) {
        var rowEmail = String(rows[i][3] || "").trim().toLowerCase();
        if (rowEmail === email) {
          var isChecked = (rows[i][0] === true || String(rows[i][0]).toUpperCase() === "TRUE" || String(rows[i][0]).trim() === "승인");
          var extCount = Math.max(1, Number(rows[i][1]) || 1);
          var baseDate = rows[i][8] ? new Date(rows[i][8]) : new Date();
          if (isNaN(baseDate.getTime())) baseDate = new Date();
          var expDate = new Date(baseDate.getTime() + extCount * 90 * 24 * 60 * 60 * 1000);
          var remDays = Math.ceil((expDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
          var valid = isChecked && remDays >= 0;
          return ContentService.createTextOutput(JSON.stringify({
            found: true,
            approved: valid,
            expired: isChecked && remDays < 0,
            remainingDays: remDays,
            expiresAt: expDate.toISOString(),
            extensionCount: extCount,
            status: valid ? "승인" : (isChecked ? "기간만료" : "대기"),
            name: rows[i][4] || "",
            school: rows[i][5] || "",
            subject: rows[i][6] || ""
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }
    }
    var appSheet = ss.getSheetByName("사용자승인") || ss.getSheetByName("승인관리") || ss.getSheetByName("_교사인증_승인관리");
    if (!appSheet) {
      return ContentService.createTextOutput(JSON.stringify({ found: false, approved: false, status: "no_sheet" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    var rows2 = appSheet.getDataRange().getValues();
    for (var j = 1; j < rows2.length; j++) {
      var rEmail = String(rows2[j][3] || rows2[j][1] || "").trim().toLowerCase();
      if (rEmail === email) {
        var st = String(rows2[j][6] || rows2[j][5] || "").trim();
        var ok = (st === "승인" || st === "승인완료" || st.toLowerCase() === "true" || st.toLowerCase() === "approved");
        return ContentService.createTextOutput(JSON.stringify({
          found: true,
          approved: ok,
          status: st,
          name: rows2[j][1] || rows2[j][2] || "",
          school: rows2[j][2] || rows2[j][3] || ""
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ found: false, approved: false, status: "not_found" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify({ success: false, error: "알 수 없는 action" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var raw = (e && e.postData && e.postData.contents) || "{}";
    var body = JSON.parse(raw);
    var action = body.action || "saveRecord";
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getActiveSheet();

    if (action === "saveRecord" || action === "saveCounsel") {
      var sId = String(body.studentId || "").trim();
      var sName = String(body.studentName || "").trim();
      var targetUni = body.targetUni || "";
      var careerHope = body.careerHope || body.stuMajor || "";
      var content = body.content || body.setukMemo || "";
      var today = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd");

      var data = sheet.getDataRange().getValues();
      var foundRow = -1;

      for (var r = 1; r < data.length; r++) {
        // 학번(A열) 또는 이름(B열)으로 매칭
        if ((sId && String(data[r][0]).trim() === sId) || (sName && String(data[r][1]).trim() === sName)) {
          foundRow = r + 1;
          break;
        }
      }

      if (foundRow === -1) {
        // 신규 행 추가
        foundRow = sheet.getLastRow() + 1;
        sheet.appendRow([sId, sName, "", careerHope, "", "", targetUni, "", "", "", "[" + today + "] " + content]);
      } else {
        // 기존 행 업데이트: 희망학과 업데이트
        if (careerHope) {
          sheet.getRange(foundRow, 4).setValue(careerHope); // D열
        }
        // 목표대학 업데이트
        if (targetUni) {
          sheet.getRange(foundRow, 7).setValue(targetUni);  // G열
        }
        // 상담/세특 내용 덧붙이기
        var oldMemo = sheet.getRange(foundRow, 11).getValue() || "";
        var newEntry = "\n[" + today + "] " + content;
        sheet.getRange(foundRow, 11).setValue(oldMemo ? oldMemo + newEntry : newEntry);
      }

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        row: foundRow,
        studentId: sId,
        studentName: sName,
        careerHope: careerHope
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // === [모바일 교무수첩(T-ong) 통합 시트 동기화 API (출결/자리/관찰/상담)] ===
    if (action === "save_notebook" || action === "sync_tong_notebook" || action === "save_attendance") {
      var nbSheet = ss.getSheetByName("교무수첩_기록") || ss.getSheetByName("📓_교무수첩");
      if (!nbSheet) {
        nbSheet = ss.insertSheet("📓_교무수첩");
        nbSheet.appendRow(["기록일시", "학번", "성명", "구분(출결/좌석/상담/관찰)", "세부내용", "메모"]);
        nbSheet.getRange("A1:F1").setBackground("#1e293b").setFontColor("#ffffff").setFontWeight("bold");
      }
      var now = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd HH:mm:ss");
      var sId = String(body.studentId || "").trim();
      var sName = String(body.studentName || "").trim();
      var category = body.category || body.type || (action === "save_attendance" ? "출결" : "일반관찰");
      var detail = body.detail || body.content || "";
      var memo = body.memo || "";

      nbSheet.appendRow([now, sId, sName, category, detail, memo]);
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: "모바일 교무수첩 데이터가 단일 통합 시트에 성공적으로 동기화되었습니다.",
        timestamp: now
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // === [교과담임 모바일 교무수첩 관찰메모 동기화 저장 API] ===
    if (action === "save_subject_memo") {
      var subSheet = ss.getSheetByName("교과담임_세특") || ss.getSheetByName("1_교과명렬_관찰기록");
      if (!subSheet) {
        subSheet = ss.insertSheet("교과담임_세특");
        subSheet.appendRow(["학번", "성명", "과목명", "수업관찰메모", "핵심역량태그", "세특초안(1500B)", "최종동기화일시"]);
        subSheet.getRange("A1:G1").setBackground("#1e293b").setFontColor("#ffffff").setFontWeight("bold");
      }
      var sId = String(body.studentId || "").trim();
      var sName = String(body.studentName || "").trim();
      var subName = body.subject || "일반교과";
      var memo = body.memo || "";
      var tags = body.tags || "";
      var draft = body.draft || "";
      var now = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd HH:mm:ss");

      var data = subSheet.getDataRange().getValues();
      var foundRow = -1;
      for (var r = 1; r < data.length; r++) {
        if ((sId && String(data[r][0]).trim() === sId) || (sName && String(data[r][1]).trim() === sName)) {
          foundRow = r + 1;
          break;
        }
      }
      if (foundRow === -1) {
        subSheet.appendRow([sId, sName, subName, memo, tags, draft, now]);
        foundRow = subSheet.getLastRow();
      } else {
        if (subName) subSheet.getRange(foundRow, 3).setValue(subName);
        subSheet.getRange(foundRow, 4).setValue(memo);
        if (tags) subSheet.getRange(foundRow, 5).setValue(tags);
        if (draft) subSheet.getRange(foundRow, 6).setValue(draft);
        subSheet.getRange(foundRow, 7).setValue(now);
      }
      return ContentService.createTextOutput(JSON.stringify({ success: true, message: "교과담임 시트 동기화 완료", row: foundRow }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // === [사용자 승인 신청 제출 API (신천고/교육청 자동승인 + 타 계정 수동승인)] ===
    if (action === "apply_access") {
      var appSheet = ss.getSheetByName("사용자승인");
      if (!appSheet) {
        appSheet = ss.insertSheet("사용자승인");
        appSheet.appendRow(["신청일시", "교사성명", "소속학교", "이메일", "연락처/과목", "신청사유", "승인상태", "메모"]);
        appSheet.getRange("A1:H1").setBackground("#1e293b").setFontColor("#ffffff").setFontWeight("bold");
      }
      var now = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd HH:mm:ss");
      var targetEmail = (body.email || "").trim().toLowerCase();
      var initialStatus = "대기";
      var note = "";
      var domain = targetEmail.split('@')[1] || "";
      if (domain === "sch.kr" || domain.endsWith(".sch.kr") || domain === "goedu.kr" || domain.endsWith(".goedu.kr") || targetEmail.endsWith("@sch.hs.kr")) {
        initialStatus = "승인";
        note = "학교/교육청 공식 도메인 자동승인 (1개월)";
      } else {
        note = "개인 구글 계정 신청 (" + (body.reason || "AI 함수 활용 및 대입상담") + ")";
      }

      appSheet.appendRow([
        now,
        body.name || "",
        body.school || "",
        targetEmail,
        body.phone || body.subject || "",
        body.reason || "",
        initialStatus,
        note
      ]);

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        approved: initialStatus === "승인",
        status: initialStatus,
        message: initialStatus === "승인"
          ? "학교 공식 계정 확인 완료! 1개월 이용 권한이 자동으로 승인되었습니다."
          : "사용 승인 신청이 완료되었습니다. 관리자 승인 후 1개월간 이용하실 수 있습니다."
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ success: false, error: "알 수 없는 POST action" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
