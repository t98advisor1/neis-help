/**
 * =========================================================================
 * 2027 대입상담 & 생기부 도우미 — 구글 시트 1:1 양방향 실시간 동기화 스크립트
 * =========================================================================
 * 
 * [사용 방법]
 * 1. 구글 드라이브에서 공유받은 '2027 대입상담_생기부_마스터시트'를 엽니다.
 * 2. 상단 메뉴 [확장 프로그램] > [Apps Script]를 클릭합니다.
 * 3. 기존 코드를 모두 지우고 이 스크립트 전체를 복사하여 붙여넣습니다.
 * 4. 우측 상단 [배포] > [새 배포] 클릭
 *    - 유형: '웹 앱' 선택
 *    - 설명: '대입상담 동기화 API'
 *    - 다음 사용자 권한으로 앱 실행: '나(내 계정)'
 *    - 액세스 권한이 있는 사용자: '모든 사용자(Anyone)' 선택 (※ 앱에서 내 시트로 통신하기 위해 필수)
 * 5. 발급된 '웹 앱 URL'을 복사하여 우리 웹앱의 [구글 시트 연동 설정]에 등록하면 끝!
 */

// 시트 이름 (기본 첫 번째 시트 또는 지정 시트)
var SHEET_NAME = "2027_진학상담_마스터";

function getTargetSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.getSheets()[0];
  }
  return sheet;
}

// 1. GET 요청 핸들러 (연결 테스트 및 학생 목록 불러오기)
function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) || "ping";
    var sheet = getTargetSheet();

    if (action === "ping") {
      return jsonResponse({
        success: true,
        message: "Google Sheets API 연결 성공!",
        sheetTitle: SpreadsheetApp.getActiveSpreadsheet().getName(),
        activeSheet: sheet.getName(),
        rowCount: sheet.getLastRow()
      });
    }

    if (action === "getStudents") {
      var data = sheet.getDataRange().getValues();
      if (data.length <= 1) {
        return jsonResponse({ success: true, students: [] });
      }

      var headers = data[0];
      var students = [];

      for (var r = 1; r < data.length; r++) {
        var row = data[r];
        if (!row[0] && !row[1] && !row[2]) continue; // 빈 행 스킵

        students.push({
          row: r + 1,
          grade: row[0],         // A열: 학년
          classNo: row[1],       // B열: 반
          studentNo: row[2],     // C열: 번호
          name: row[3],          // D열: 성명
          track: row[4],         // E열: 계열
          overallGrade: row[6],  // G열: 내신 전과목 평균
          targetUni1: row[9],    // J열: 목표대학1
          targetUni2: row[10],   // K열: 목표대학2
          targetUni3: row[11],   // L열: 목표대학3
          counselMemo: row[14],  // O열: 종합 상담의견
          subjectRecord: row[15] // P열: 교과세특 초안
        });
      }

      return jsonResponse({ success: true, count: students.length, students: students });
    }

    return jsonResponse({ success: false, error: "알 수 없는 요청: " + action });
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

// 2. POST 요청 핸들러 (상담 내용 / 목표대학 / 세특 실시간 기록)
function doPost(e) {
  try {
    var raw = (e && e.postData && e.postData.contents) || "{}";
    var body = JSON.parse(raw);
    var action = body.action || "saveCounsel";
    var sheet = getTargetSheet();

    if (action === "saveCounsel") {
      var sName = String(body.studentName || "").trim();
      var targetUni = body.targetUni || "";
      var gradeLine = body.gradeLine || "";
      var content = body.content || "";
      var subject = body.subject || "대입상담";

      if (!sName) {
        return jsonResponse({ success: false, error: "학생 성명(studentName)이 누락되었습니다." });
      }

      var data = sheet.getDataRange().getValues();
      var foundRow = -1;

      // 성명으로 기존 행 검색 (D열: 인덱스 3)
      for (var r = 1; r < data.length; r++) {
        if (String(data[r][3]).trim() === sName) {
          foundRow = r + 1;
          break;
        }
      }

      if (foundRow === -1) {
        // 학생이 없으면 새 행 추가
        var newRowIdx = sheet.getLastRow() + 1;
        var today = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd");
        sheet.appendRow([
          body.grade || "3",
          body.classNo || "1",
          body.studentNo || "",
          sName,
          body.track || "일반",
          "", // F: 전형유형
          body.overallGrade || "", // G: 내신
          "", "", // H, I
          targetUni, // J: 목표대학1
          "", "", "", "", // K, L, M, N
          "[" + today + " " + subject + "] " + content // O: 상담의견
        ]);
        return jsonResponse({ success: true, action: "created", row: newRowIdx, student: sName });
      } else {
        // 기존 학생 행 업데이트
        var today = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd");
        
        // 목표대학 칸(J열: 10번째 열)이 비어있으면 채우기
        var currentUni = sheet.getRange(foundRow, 10).getValue();
        if (!currentUni && targetUni) {
          sheet.getRange(foundRow, 10).setValue(targetUni);
        }

        // 상담/세특 칸(O열: 15번째 열)에 내용 추가 (누적 덧붙이기)
        var oldMemo = sheet.getRange(foundRow, 15).getValue() || "";
        var newEntry = "\n[" + today + " " + subject + "] " + content;
        sheet.getRange(foundRow, 15).setValue(oldMemo ? oldMemo + "\n" + newEntry : newEntry);

        return jsonResponse({ success: true, action: "updated", row: foundRow, student: sName });
      }
    }

    return jsonResponse({ success: false, error: "지원하지 않는 POST action: " + action });
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

// JSON 반환 헬퍼 (CORS 헤더 포함)
function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
