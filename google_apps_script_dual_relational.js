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
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("생기부·대입 도우미")
    .addItem("🔑 Gemini API 키 설정", "promptSetApiKey")
    .addSeparator()
    .addItem("📋 학번 기준 명렬표 자동 동기화", "syncAllTabsByNameList")
    .addItem("📑 다부서 동아리/진로활동 자동 합산", "aggregateClubActivities")
    .addItem("📁 선택 학생 Google Docs 상담일지 생성", "createDocsForSelectedRow")
    .addToUi();
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
function getSystemPromptInstructions() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("_설정_프롬프트지침") || ss.getSheetByName("설정_프롬프트지침");
  if (!sheet) {
    return "당신은 고등학교 생기부 및 세특 전문 교사입니다. 기재요령을 준수하여 [동기-과정-성장] 3단 구조로 공백포함 400자 내외로 작성하세요.";
  }

  var data = sheet.getRange("B2:B8").getValues();
  var parts = [];
  for (var i = 0; i < data.length; i++) {
    var val = String(data[i][0] || "").trim();
    if (val) parts.push(val);
  }

  if (parts.length === 0) {
    return "당신은 고등학교 생기부 및 세특 전문 교사입니다. 기재요령을 준수하여 [동기-과정-성장] 3단 구조로 공백포함 400자 내외로 작성하세요.";
  }
  return parts.join("\n");
}

function AI(prompt, context1, context2) {
  if (!prompt && !context1) return "";
  
  var fullText = String(prompt || "") + " " + String(context1 || "") + " " + String(context2 || "");
  var sysPrompt = getSystemPromptInstructions();
  if (!prompt && !context1) return "";
  
  var fullText = String(prompt || "") + " " + String(context1 || "") + " " + String(context2 || "");
  
  // 캐싱 적용 (동일 입력에 대한 과도한 API 호출 방지)
  var cache = CacheService.getDocumentCache();
  var cacheKey = "ai_" + Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, fullText)).slice(0, 30);
  var cached = cache.get(cacheKey);
  if (cached) return cached;

  var apiKey = getGeminiApiKey();
  if (!apiKey || apiKey.includes("YOUR_API_KEY")) {
    return "[안내] 상단 메뉴 [생기부·대입 도우미] > [API 키 설정]에서 Gemini API 키를 먼저 등록해 주세요.";
  }

  try {
    var url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + apiKey;
    var payload = {
      contents: [{
        parts: [{ text: sysPrompt + "\n\n[작성 대상 활동 내용]:\n" + fullText }]
      }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 600 }
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
      cache.put(cacheKey, resultText, 21600); // 6시간 캐시
      return resultText;
    }
    return "생성 실패: 응답 없음";
  } catch(e) {
    return "API 호출 오류: " + e.toString();
  }
}

/**
 * 3단 구조(동기-활동-성장) 과목별 세특 초안 생성 커스텀 함수
 * @param {string} subject 과목명 (예: 경제)
 * @param {string} activity 학생 탐구활동 내용
 * @param {string} careerHope 학생 희망진로/학과 (선택)
 * @return {string} 세특 초안
 * @customfunction
 */
function AI_SETUK(subject, activity, careerHope) {
  if (!activity) return "";
  var prompt = subject + " 과목 세부능력 및 특기사항 작성. " +
               (careerHope ? "학생 희망분야: " + careerHope + ". " : "") +
               "활동내용: " + activity + ". " +
               "지침: '탐구동기 - 구체적 탐구과정 및 역량 - 배운 점과 성장'의 3단계 유기적 흐름으로 나이스 기재요령을 엄격히 준수하여 400~500자 내외로 작성할 것.";
  return AI(prompt);
}

// ==========================================
// 2. 다부서 동아리/진로활동 자동 합산 기능
// ==========================================
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

    return ContentService.createTextOutput(JSON.stringify({ success: false, error: "알 수 없는 POST action" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
