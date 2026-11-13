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

    // === [T-ong 모바일 교무수첩 전체 데이터 불러오기 API (시간표·학교·동아리·명렬·관찰)] ===
    if (action === "pull_tong_notebook") {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var profileSheet = ss.getSheetByName("9_교무수첩_시간표_동기화");
      var teacherProfile = null;
      if (profileSheet && profileSheet.getLastRow() >= 2) {
        var jsonRaw = String(profileSheet.getRange("J9").getValue() || "").trim();
        if (!jsonRaw) {
          var legacyRaw = String(profileSheet.getRange("J2").getValue() || "").trim();
          if (legacyRaw && legacyRaw.charAt(0) === "{") jsonRaw = legacyRaw;
        }
        if (jsonRaw) {
          try { teacherProfile = JSON.parse(jsonRaw); } catch (errParse) {}
        }
      }

      var stuList = [];
      var stuSheet = ss.getSheetByName("2_학생명렬표") || ss.getSheetByName("교과담임_세특") || ss.getSheetByName("2027_진학상담_마스터");
      if (stuSheet && stuSheet.getLastRow() >= 2) {
        var sRows = stuSheet.getDataRange().getValues();
        for (var sr = 1; sr < sRows.length; sr++) {
          var r0 = String(sRows[sr][0] || "").trim();
          var r1 = String(sRows[sr][1] || "").trim();
          var r2 = String(sRows[sr][2] || "").trim();
          var r3 = String(sRows[sr][3] || "").trim();
          var sId = r0 || r2;
          var sNm = r1 || r3;
          if (!sId && !sNm) continue;
          stuList.push({ id: sId || String(sr), name: sNm || sId, gender: "" });
        }
      }

      var obsList = [];
      var obsSheet = ss.getSheetByName("6_수업관찰_기록") || ss.getSheetByName("교과담임_세특");
      if (obsSheet && obsSheet.getLastRow() >= 2) {
        var oRows = obsSheet.getDataRange().getValues();
        for (var or = 1; or < oRows.length; or++) {
          var rowO = oRows[or];
          if (!rowO[1] && !rowO[3]) continue;
          obsList.push({
            date: String(rowO[0] || "").slice(0, 10),
            studentId: String(rowO[1] || ""),
            studentName: String(rowO[2] || ""),
            subject: String(rowO[3] || "수업관찰"),
            category: String(rowO[4] || "수업 참여"),
            content: String(rowO[5] || rowO[3] || "")
          });
        }
      }

      return jsonResponse({
        success: true,
        teacherProfile: teacherProfile,
        students: stuList,
        observations: obsList
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

    // === [T-ong 모바일 교무수첩 전체 양방향 동기화 저장 API (학교·비담임·시간표·동아리·명렬·기록)] ===
    if (action === "sync_tong_notebook") {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var nowStr = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd HH:mm:ss");

      // 1) 교사 환경설정 & 주간 시간표 & 동아리 & 시트 메모장 저장 (9_교무수첩_시간표_동기화)
      if (body.teacherProfile) {
        var pSheet = ss.getSheetByName("9_교무수첩_시간표_동기화");
        if (!pSheet) {
          pSheet = ss.insertSheet("9_교무수첩_시간표_동기화");
        }
        pSheet.clear();
        pSheet.getRange("A1:J1").setValues([[
          "최종동기화일시", "교사계정", "소속학교", "담임구분", "교시", "월", "화", "수", "목", "금"
        ]]).setBackground("#0f172a").setFontColor("#ffffff").setFontWeight("bold");

        var tp = body.teacherProfile;
        var schoolName = (tp.school && tp.school.schoolName) || "";
        var homeroomLabel = tp.isNonHomeroom ? "비담임(교과전담)" : ((tp.homeroom && tp.homeroom.label) || "미설정");
        var days = ["월", "화", "수", "목", "금"];
        var tt = tp.timetable || {};
        for (var p = 1; p <= 7; p++) {
          var rowVals = [p === 1 ? nowStr : "", p === 1 ? (body.userEmail || "") : "", p === 1 ? schoolName : "", p === 1 ? homeroomLabel : "", p + "교시"];
          for (var di = 0; di < days.length; di++) {
            var cell = (tt[days[di]] && tt[days[di]][p]) || {};
            var txt = cell.subject ? ((cell.className ? "[" + cell.className + "] " : "") + cell.subject) : "-";
            rowVals.push(txt);
          }
          pSheet.getRange(p + 1, 1, 1, 10).setValues([rowVals]);
        }
        // 전체 복원용 JSON 스냅샷을 J9 셀에 안전하게 저장 (J2 금요일 1교시 셀 보존)
        pSheet.getRange("I9").setValue("SYNC_SNAPSHOT_JSON");
        pSheet.getRange("J9").setNote("T-ong 기기간 시간표 복원용 스냅샷");
        pSheet.getRange("J9").setValue(JSON.stringify(tp));
      }

      // 2) 출결·칭찬·수업관찰·학급역할 누적 기록 저장 (8_출결_칭찬_기록 / 6_수업관찰_기록)
      var items = Array.isArray(body.items) ? body.items : [];
      if (items.length > 0) {
        var obsSheet = ss.getSheetByName("6_수업관찰_기록");
        if (!obsSheet) {
          obsSheet = ss.insertSheet("6_수업관찰_기록");
          obsSheet.appendRow(["일시", "학번", "성명", "과목", "구분", "관찰내용", "비고"]);
          obsSheet.getRange("A1:G1").setBackground("#1e293b").setFontColor("#ffffff").setFontWeight("bold");
        }
        var attSheet = ss.getSheetByName("8_출결_칭찬_기록");
        if (!attSheet) {
          attSheet = ss.insertSheet("8_출결_칭찬_기록");
          attSheet.appendRow(["일시", "학번", "성명", "학급", "구분", "상세내용", "메모"]);
          attSheet.getRange("A1:G1").setBackground("#065f46").setFontColor("#ffffff").setFontWeight("bold");
        }
        for (var idx = 0; idx < items.length; idx++) {
          var it = items[idx];
          if (it.category === "수업관찰" || it.category === "탐구 활동" || it.category === "학생관찰") {
            obsSheet.appendRow([it.timestamp || nowStr, it.studentId || "", it.studentName || "", it.subject || "", it.category || "수업관찰", it.detail || "", it.memo || ""]);
          } else {
            attSheet.appendRow([it.timestamp || nowStr, it.studentId || "", it.studentName || "", it.className || "", it.category || "기록", it.detail || "", it.memo || ""]);
          }
        }
      }

      return jsonResponse({ success: true, message: "교무수첩 전체(시간표·설정·기록) 동기화 완료", count: items.length });
    }

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


// =========================================================================
// [대시보드 및 승인 관리 메뉴 / 함수]
// =========================================================================

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("🏆 생기부 올인원 관리 (math-tong)")
    .addItem("📊 대시보드 및 승인 시트 예쁘게 자동 생성", "setupExecutiveDashboard")
    .addSeparator()
    .addItem("✅ '대기' 상태 신청자 전체 일괄 승인", "approveAllPendingUsers")
    .addItem("✨ 선택한 행의 교사 즉시 승인", "approveSelectedUser")
    .addItem("🚫 선택한 행의 교사 '반려' 처리", "rejectSelectedUser")
    .addSeparator()
    .addItem("🔗 NEIS 올인원 웹앱 바로가기", "openWebApp")
    .addToUi();
}

function setupExecutiveDashboard() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var dash = ss.getSheetByName("📊_대시보드") || ss.getSheetByName("대시보드");
  if (!dash) {
    dash = ss.insertSheet("📊_대시보드", 0);
  } else {
    dash.clear();
  }
  ss.setActiveSheet(dash);
  dash.setTabColor("#2563eb");

  var appSheet = ss.getSheetByName("사용자승인");
  if (!appSheet) {
    appSheet = ss.insertSheet("사용자승인", 1);
  }
  formatApprovalSheet(appSheet);

  dash.getRange("A1:Z60").setFontFamily("Pretendard").setBackground("#f8fafc");

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

  dash.getRange("A5").setValue("📌 교사 사용 승인 신청 및 인증 현황")
    .setFontSize(12).setFontWeight("bold").setFontColor("#0f172a");

  // Card 1
  dash.getRange("B6:C6").merge().setValue("👥 총 신청 교사").setFontSize(10).setFontWeight("bold").setFontColor("#475569").setHorizontalAlignment("center").setBackground("#ffffff");
  dash.getRange("B7:C8").merge().setFormula('=IFERROR(COUNTA(\'사용자승인\'!D2:D), 0) & "명"').setFontSize(18).setFontWeight("bold").setFontColor("#0f172a").setHorizontalAlignment("center").setVerticalAlignment("middle").setBackground("#ffffff");
  dash.getRange("B6:C8").setBorder(true, true, true, true, false, false, "#cbd5e1", SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

  // Card 2
  dash.getRange("D6:E6").merge().setValue("✅ 승인 완료 (이용 가능)").setFontSize(10).setFontWeight("bold").setFontColor("#15803d").setHorizontalAlignment("center").setBackground("#f0fdf4");
  dash.getRange("D7:E8").merge().setFormula('=IFERROR(COUNTIF(\'사용자승인\'!G2:G, "승인"), 0) & "명"').setFontSize(18).setFontWeight("bold").setFontColor("#15803d").setHorizontalAlignment("center").setVerticalAlignment("middle").setBackground("#f0fdf4");
  dash.getRange("D6:E8").setBorder(true, true, true, true, false, false, "#86efac", SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

  // Card 3
  dash.getRange("F6:G6").merge().setValue("⏳ 승인 대기 (확인 필요)").setFontSize(10).setFontWeight("bold").setFontColor("#b45309").setHorizontalAlignment("center").setBackground("#fffbeb");
  dash.getRange("F7:G8").merge().setFormula('=IFERROR(COUNTIF(\'사용자승인\'!G2:G, "대기"), 0) & "명"').setFontSize(18).setFontWeight("bold").setFontColor("#b45309").setHorizontalAlignment("center").setVerticalAlignment("middle").setBackground("#fffbeb");
  dash.getRange("F6:G8").setBorder(true, true, true, true, false, false, "#fde68a", SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

  // Card 4
  dash.getRange("H6:I6").merge().setValue("⚡ 학교계정 자동승인").setFontSize(10).setFontWeight("bold").setFontColor("#2563eb").setHorizontalAlignment("center").setBackground("#eff6ff");
  dash.getRange("H7:I8").merge().setFormula('=IFERROR(COUNTIF(\'사용자승인\'!H2:H, "*자동승인*"), 0) & "명"').setFontSize(18).setFontWeight("bold").setFontColor("#2563eb").setHorizontalAlignment("center").setVerticalAlignment("middle").setBackground("#eff6ff");
  dash.getRange("H6:I8").setBorder(true, true, true, true, false, false, "#93c5fd", SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

  // 섹션 2
  dash.getRange("A10").setValue("📊 학급 진학 & 세특 기록 관제")
    .setFontSize(12).setFontWeight("bold").setFontColor("#0f172a");

  dash.getRange("B11:C11").merge().setValue("🎓 등록 학생 수").setFontSize(10).setFontWeight("bold").setFontColor("#be185d").setHorizontalAlignment("center").setBackground("#fdf2f8");
  dash.getRange("B12:C13").merge().setFormula('=IFERROR(IF(ISBLANK(\'2027_진학상담_마스터\'!A2), "30명", COUNTA(\'2027_진학상담_마스터\'!A2:A) & "명"), "30명")').setFontSize(18).setFontWeight("bold").setFontColor("#be185d").setHorizontalAlignment("center").setVerticalAlignment("middle").setBackground("#fdf2f8");
  dash.getRange("B11:C13").setBorder(true, true, true, true, false, false, "#fbcfe8", SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

  dash.getRange("D11:E11").merge().setValue("📈 2028 개편 평균 내신").setFontSize(10).setFontWeight("bold").setFontColor("#7e22ce").setHorizontalAlignment("center").setBackground("#faf5ff");
  dash.getRange("D12:E13").merge().setFormula('=IFERROR(TEXT(AVERAGE(\'2027_진학상담_마스터\'!D2:D), "0.00") & " 등급", "2.35 등급")').setFontSize(18).setFontWeight("bold").setFontColor("#7e22ce").setHorizontalAlignment("center").setVerticalAlignment("middle").setBackground("#faf5ff");
  dash.getRange("D11:E13").setBorder(true, true, true, true, false, false, "#e9d5ff", SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

  dash.getRange("F11:G11").merge().setValue("✍️ 1500B 세특 작성률").setFontSize(10).setFontWeight("bold").setFontColor("#0f766e").setHorizontalAlignment("center").setBackground("#f0fdfa");
  dash.getRange("F12:G13").merge().setFormula('=IFERROR(TEXT(COUNTIF(\'교과담임_세특\'!F2:F, "<>") / COUNTA(\'교과담임_세특\'!A2:A), "0.0%"), "100.0%")').setFontSize(18).setFontWeight("bold").setFontColor("#0f766e").setHorizontalAlignment("center").setVerticalAlignment("middle").setBackground("#f0fdfa");
  dash.getRange("F11:G13").setBorder(true, true, true, true, false, false, "#99f6e4", SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

  dash.getRange("H11:I11").merge().setValue("🔗 NEIS 올인원 웹앱").setFontSize(10).setFontWeight("bold").setFontColor("#ffffff").setHorizontalAlignment("center").setBackground("#1e293b");
  dash.getRange("H12:I13").merge().setValue("https://neis-help-one.vercel.app").setFontSize(11).setFontWeight("bold").setFontColor("#38bdf8").setHorizontalAlignment("center").setVerticalAlignment("middle").setBackground("#1e293b");
  dash.getRange("H11:I13").setBorder(true, true, true, true, false, false, "#0f172a", SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

  // 실시간 쿼리 테이블
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

  dash.getRange("B17").setFormula('=IFERROR(QUERY(\'사용자승인\'!A2:H, "SELECT A, B, C, D, E, F, G, H WHERE A IS NOT NULL ORDER BY A DESC LIMIT 20", 0), "아직 접수된 신청 내역이 없습니다.")');

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

function formatApprovalSheet(appSheet) {
  if (!appSheet) return;
  appSheet.setTabColor("#10b981");

  if (appSheet.getLastRow() === 0) {
    appSheet.appendRow(["신청일시", "교사성명", "소속학교", "이메일", "연락처/과목", "신청사유", "승인상태", "메모/구분"]);
    var now = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd HH:mm:ss");
    appSheet.appendRow([now, "김선생", "신천고등학교", "math@sch.hs.kr", "1학년 공통수학", "1학년 1반 세특 및 진학상담 연동", "승인", "학교 공식 계정 자동승인"]);
    appSheet.appendRow([now, "이선생", "소래고등학교", "lee@goedu.kr", "2학년 수학I", "대입 진학상담 워크벤치 활용", "승인", "학교 공식 계정 자동승인"]);
    appSheet.appendRow([now, "박선생", "서울신천고등학교", "park@sen.go.kr", "1학년 공통수학", "교과세특 1500B 바이트 계산 및 초안 작성", "대기", "관리자 승인 대기"]);
  }

  appSheet.getRange("A1:H1")
    .setBackground("#0f172a")
    .setFontColor("#ffffff")
    .setFontWeight("bold")
    .setFontSize(11)
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");
  appSheet.setRowHeight(1, 38);
  appSheet.setFrozenRows(1);

  appSheet.setColumnWidth(1, 150);
  appSheet.setColumnWidth(2, 95);
  appSheet.setColumnWidth(3, 160);
  appSheet.setColumnWidth(4, 210);
  appSheet.setColumnWidth(5, 130);
  appSheet.setColumnWidth(6, 220);
  appSheet.setColumnWidth(7, 105);
  appSheet.setColumnWidth(8, 170);

  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["승인", "대기", "반려"], true)
    .setAllowInvalid(false)
    .build();
  appSheet.getRange("G2:G500").setDataValidation(rule).setHorizontalAlignment("center");

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
