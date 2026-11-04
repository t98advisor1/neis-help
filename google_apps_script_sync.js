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

    // === [교과담임 모바일 교무수첩 관찰메모 조회 API] ===
    if (action === "get_subject_memos") {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var subSheet = ss.getSheetByName("교과담임_세특") || ss.getSheetByName("1_교과명렬_관찰기록");
      if (!subSheet) {
        return jsonResponse({ success: true, list: [] });
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
      return jsonResponse({ success: true, list: list });
    }

    // === [사용자 승인 상태 조회 API] ===
    if (action === "check_access") {
      var email = (e.parameter.email || "").trim().toLowerCase();
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var appSheet = ss.getSheetByName("사용자승인") || ss.getSheetByName("승인관리");
      if (!appSheet) {
        return jsonResponse({ found: false, approved: false, status: "no_sheet" });
      }
      var rows = appSheet.getDataRange().getValues();
      for (var i = 1; i < rows.length; i++) {
        var rowEmail = String(rows[i][3]).trim().toLowerCase();
        if (rowEmail === email) {
          var status = String(rows[i][6]).trim();
          var isApproved = (status === "승인" || status.toLowerCase() === "true" || status.toLowerCase() === "approved");
          return jsonResponse({
            found: true,
            approved: isApproved,
            status: status,
            name: rows[i][1],
            school: rows[i][2]
          });
        }
      }
      return jsonResponse({ found: false, approved: false, status: "not_found" });
    }

    // === [관리자 승인 신청 목록 조회 API] ===
    if (action === "list_applicants") {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var appSheet = ss.getSheetByName("사용자승인") || ss.getSheetByName("승인관리");
      if (!appSheet) {
        return jsonResponse({ success: true, applicants: [] });
      }
      var rows = appSheet.getDataRange().getValues();
      var list = [];
      for (var i = 1; i < rows.length; i++) {
        if (!rows[i][3]) continue;
        list.push({
          date: rows[i][0],
          name: rows[i][1],
          school: rows[i][2],
          email: rows[i][3],
          phone: rows[i][4],
          reason: rows[i][5],
          status: rows[i][6] || "대기",
          memo: rows[i][7] || ""
        });
      }
      return jsonResponse({ success: true, applicants: list });
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

    // === [교과담임 모바일 교무수첩 관찰메모 동기화 저장 API] ===
    if (action === "save_subject_memo") {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
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
      return jsonResponse({ success: true, message: "교과담임 시트 동기화 완료", row: foundRow });
    }

    // === [사용자 승인 신청 제출 API (신천고/교육청 자동승인 + 타 계정 수동승인)] ===
    if (action === "apply_access") {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var appSheet = ss.getSheetByName("사용자승인");
      if (!appSheet) {
        appSheet = ss.insertSheet("사용자승인");
        appSheet.appendRow(["신청일시", "교사성명", "소속학교", "이메일", "연락처/과목", "신청사유", "승인상태", "메모"]);
        appSheet.getRange("A1:H1").setBackground("#1e293b").setFontColor("#ffffff").setFontWeight("bold");
      }
      var now = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd HH:mm:ss");
      var targetEmail = (body.email || "").trim().toLowerCase();

      // 신천고(@sch.hs.kr) 또는 경기도교육청(@goedu.kr) 도메인은 시트에서 자동으로 "승인" 처리!
      var initialStatus = "대기";
      var note = "";
      if (targetEmail.endsWith("@sch.hs.kr") || targetEmail.endsWith("@goedu.kr")) {
        initialStatus = "승인";
        note = "학교 공식 계정 자동승인";
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

      return jsonResponse({
        success: true,
        approved: initialStatus === "승인",
        status: initialStatus,
        message: initialStatus === "승인"
          ? "학교 공식 계정 확인 완료! 3개월 이용 권한이 자동으로 승인되었습니다."
          : "사용 승인 신청이 완료되었습니다. 관리자 승인 후 3개월간 이용하실 수 있습니다."
      });
    }

    // === [관리자 승인 상태 변경 API (3개월 권한 부여)] ===
    if (action === "update_approval") {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var appSheet = ss.getSheetByName("사용자승인") || ss.getSheetByName("승인관리");
      if (!appSheet) {
        return jsonResponse({ success: false, error: "사용자승인 시트가 없습니다." });
      }
      var targetEmail = (body.email || "").trim().toLowerCase();
      var newStatus = body.status || "승인";
      var rows = appSheet.getDataRange().getValues();
      var updated = false;
      for (var i = 1; i < rows.length; i++) {
        var rowEmail = String(rows[i][3]).trim().toLowerCase();
        if (rowEmail === targetEmail) {
          appSheet.getRange(i + 1, 7).setValue(newStatus);
          if (body.memo) appSheet.getRange(i + 1, 8).setValue(body.memo);
          updated = true;
          break;
        }
      }
      if (!updated) {
        var now = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd HH:mm:ss");
        appSheet.appendRow([now, body.name || "선생님", body.school || "", targetEmail, body.phone || "", "대시보드 직접 승인", newStatus, body.memo || ""]);
      }
      return jsonResponse({ success: true, message: "승인 상태가 [" + newStatus + "](으)로 업데이트되었습니다." });
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
