const getAdminGasUrl = () => {
  return (
    process.env.ADMIN_GAS_URL ||
    process.env.GAS_ADMIN_URL ||
    process.env.ADMIN_GAS_APPROVAL_URL ||
    ''
  ).trim();
};

﻿// api/sheet-sync.js — 클라우드 내장 시트 동기화 및 테스트 엔진
// 개인 구글 시트 연동 전에도 1초 만에 전 기능(불러오기/저장/승인)을 실시간으로 테스트할 수 있도록 지원하는 백엔드 API
// Vercel Serverless Function (Node.js ESM)

// 1학년 1반 30명 모의 학급 메모리 DB (서버리스 인스턴스 라이프사이클 동안 유지)
let mockHomeroomStudents = [
  { stuNumber: "10101", stuName: "김태형", stuMajor: "생명공학과 (바이오신약)", grade5: "1.25", grade9: "1.15", targetUni1: "서울대 생명과학 (지역균형)", targetUni2: "연세대 시스템생물 (학생부종합)", targetUni3: "고려대 바이오의공학 (계열적합)", subject: "공통수학1", existingSetuk: "수학적 모델링을 통해 약물 체내 동태(PK/PD) 미분 방정식을 분석하고, 신약 개발에서 약물 농도 감쇠 곡선을 수치해석적으로 규명하여 생명과학과 수학의 융합적 탐구 역량을 탁월하게 드러냄." },
  { stuNumber: "10102", stuName: "박서준", stuMajor: "컴퓨터공학과 (인공지능)", grade5: "1.45", grade9: "1.30", targetUni1: "KAIST 전산학부", targetUni2: "서울대 컴퓨터공학 (일반전형)", targetUni3: "연세대 인공지능 (활동우수)", subject: "공통수학1", existingSetuk: "행렬 연산과 다차원 벡터 공간의 개념을 심화 학습하여 인공신경망 역전파(Backpropagation) 알고리즘의 선형대수학적 원리를 보고서로 작성하고 급우들에게 명쾌하게 설명함." },
  { stuNumber: "10103", stuName: "이지은", stuMajor: "통계데이터사이언스학과", grade5: "1.65", grade9: "1.55", targetUni1: "고려대 통계학과 (학업우수)", targetUni2: "성균관대 통계학 (학과모집)", targetUni3: "중앙대 응용통계 (다빈치형)", subject: "공통수학1", existingSetuk: "조건부 확률과 베이즈 정리를 활용하여 공공 의료 데이터의 위양성/위음성 오류를 분석하고, 실생활 통계 왜곡을 바로잡는 통계 리터러시 탐구 보고서를 완성함." },
  { stuNumber: "10104", stuName: "정해인", stuMajor: "기계로봇공학과", grade5: "1.80", grade9: "1.70", targetUni1: "한양대 미래자동차 (학생부종합)", targetUni2: "성균관대 기계공학 (계열모집)", targetUni3: "서강대 기계공학 (일반전형)", subject: "공통수학1", existingSetuk: "삼각함수의 주기성과 회전변환을 이용해 로봇 팔 3축 매니퓰레이터의 기구학적 궤적을 수학적으로 모델링하고 시뮬레이션 오차를 정밀하게 분석함." },
  { stuNumber: "10105", stuName: "윤아린", stuMajor: "화학생명공학과", grade5: "1.95", grade9: "1.85", targetUni1: "서강대 화공생명 (일반전형)", targetUni2: "중앙대 화학신소재 (CAU인재)", targetUni3: "이화여대 화공신소재 (미래인재)", subject: "공통수학1", existingSetuk: "화학 반응 속도론에서 농도 변화에 따른 반응 차수 결정을 미분 연산으로 유도하고 촉매 반응의 아레니우스 식을 그래프로 정밀하게 해석함." }
];

// 보완용 30명 자동 채우기
for (let i = 6; i <= 30; i++) {
  const numStr = `101${String(i).padStart(2, '0')}`;
  const names = ["최유진", "강도현", "송민재", "임서현", "한지우", "조예준", "배도윤", "신하은", "오지호", "서수아", "권도경", "황민성", "안채원", "유승우", "문다은", "양시우", "손유나", "고태양", "백지안", "노현우", "구예나", "차우진", "우소율", "주원호", "진하랑"];
  const majors = ["전자전기공학과", "의예과 (기초의학)", "경영학과 (핀테크)", "신소재공학과", "행정학과 (공공정책)", "정치외교학과", "건축학과 (친환경)", "미디어커뮤니케이션", "환경에너지공학", "경제학과 (금융수학)", "심리학과 (인지과학)", "국어교육과", "수학교육과", "바이오헬스공학", "자율전공학부", "소프트웨어학과", "우주항공공학과", "통계학과", "물리학과", "나노공학과", "국제통상학과", "치의예과", "수의예과", "로봇공학과", "데이터사이언스학과"];
  const name = names[i - 6] || `학생${i}`;
  const major = majors[i - 6] || "융합전공학부";
  const g5 = (1.2 + (i - 1) * 0.12).toFixed(2);
  const g9 = (1.1 + (i - 1) * 0.11).toFixed(2);

  mockHomeroomStudents.push({
    stuNumber: numStr,
    stuName: name,
    stuMajor: major,
    grade5: g5,
    grade9: g9,
    targetUni1: "서울·수도권 주요대학 1지망",
    targetUni2: "학생부종합 2지망",
    targetUni3: "학생부교과 3지망",
    subject: "공통수학1",
    existingSetuk: `수학적 개념의 본질을 깊이 있게 탐구하고 [${major}] 분야와의 연계성을 논리적으로 입증함. 교과 수업 활동에 성실하고 적극적으로 참여함.`
  });
}

// 메모리 승인 교사 레지스트리
const applicants = [
  { date: "2026-11-04 18:00:00", name: "김선생", school: "신천고등학교", email: "math@sch.hs.kr", subject: "1학년 공통수학", reason: "1학년 1반 세특 및 진학상담 연동", status: "승인", note: "학교 공식 계정 자동승인" },
  { date: "2026-11-04 18:05:00", name: "이선생", school: "소래고등학교", email: "lee@goedu.kr", subject: "2학년 수학I", reason: "대입 진학상담 워크벤치 활용", status: "승인", note: "학교 공식 계정 자동승인" },
  { date: "2026-11-04 18:10:00", name: "박선생", school: "서울신천고등학교", email: "park@sen.go.kr", subject: "1학년 공통수학", reason: "교과세특 1500B 바이트 계산", status: "대기", note: "관리자 승인 대기" }
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET 처리
  if (req.method === 'GET') {
    const action = String(req.query.action || 'ping');

    // 1. 핑 테스트
    if (action === 'ping') {
      return res.status(200).json({
        success: true,
        mode: 'cloud_demo',
        message: '클라우드 데모 시트 연동 성공! (개인 시트 연결 없이도 1초 만에 30명 모의 학급 및 전 기능 테스트 가능)',
        count: mockHomeroomStudents.length,
        version: '2026-11-04-v2'
      });
    }

    // 2. 전체 학생 명렬 및 세특 목록 불러오기 (시트에서 불러오기)
    if (action === 'list' || action === 'pull' || action === 'getAllStudents') {
      return res.status(200).json({
        success: true,
        list: mockHomeroomStudents,
        count: mockHomeroomStudents.length,
        source: 'cloud_demo_sheet'
      });
    }

    // 3. 학생 관계형 데이터 단건 조회 (학번 기준)
    if (action === 'getRelationalData') {
      const sId = String(req.query.studentId || '').trim();
      const student = mockHomeroomStudents.find(s => s.stuNumber === sId || s.stuName === sId) || mockHomeroomStudents[0];
      return res.status(200).json({
        success: true,
        data: student
      });
    }

    // 4. 사용자 승인 여부 실시간 확인
    if (action === 'check_access') {
      const email = String(req.query.email || '').trim().toLowerCase();
      const adminGasUrl = getAdminGasUrl();
      if (adminGasUrl) {
        try {
          const remoteUrl = ${adminGasUrl}?action=check_access&email=;
          const r = await fetch(remoteUrl, { method: 'GET', headers: { 'Accept': 'application/json' } });
          if (r.ok) {
            const data = await r.json();
            if (data && data.found) return res.status(200).json(data);
          }
        } catch (e) {
          console.warn('[sheet-sync] Remote GAS check_access error:', e.message);
        }
      }
      // 신천고 또는 경기도교육청 계정은 무조건 즉시 승인!
      if (email.endsWith('@sch.hs.kr') || email.endsWith('@goedu.kr')) {
        return res.status(200).json({
          found: true,
          approved: true,
          status: "승인",
          school: "신천고 / 경기도교육청",
          message: "학교 공식 계정 자동승인 확인 완료"
        });
      }

      const found = applicants.find(a => a.email.toLowerCase() === email);
      if (found) {
        return res.status(200).json({
          found: true,
          approved: found.status === '승인',
          status: found.status,
          name: found.name,
          school: found.school
        });
      }

      return res.status(200).json({
        found: false,
        approved: false,
        status: "not_found"
      });
    }

    // 5. 신청자 전체 목록 조회
    if (action === 'list_applicants') {
      return res.status(200).json({
        success: true,
        list: applicants
      });
    }

    return res.status(200).json({ success: true, message: "Sheet Sync Engine Ready" });
  }

  // POST 처리
  if (req.method === 'POST') {
    let body = {};
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    } catch (e) {
      body = {};
    }

    const action = body.action || req.query.action || 'saveRecord';

    // 1. 진학상담 / 마스터 기록 시트 저장
    if (action === 'saveRecord' || action === 'saveCounsel') {
      const sId = String(body.studentId || body.stuNumber || '').trim();
      const sName = String(body.studentName || body.stuName || '').trim();
      const targetUni = body.targetUni || body.university || '';
      const careerHope = body.careerHope || body.stuMajor || '';
      const content = body.content || body.setukMemo || '';

      const idx = mockHomeroomStudents.findIndex(s => s.stuNumber === sId || s.stuName === sName);
      if (idx !== -1) {
        if (targetUni) mockHomeroomStudents[idx].targetUni1 = targetUni;
        if (careerHope) mockHomeroomStudents[idx].stuMajor = careerHope;
        if (content) mockHomeroomStudents[idx].existingSetuk = content;
      } else {
        mockHomeroomStudents.push({
          stuNumber: sId || String(10100 + mockHomeroomStudents.length + 1),
          stuName: sName || "신규학생",
          stuMajor: careerHope || "진로미정",
          grade5: "2.00",
          grade9: "2.00",
          targetUni1: targetUni || "목표대학",
          existingSetuk: content || "상담 기록 입력됨"
        });
      }

      return res.status(200).json({
        success: true,
        message: "클라우드 데모 시트에 성공적으로 저장 및 동기화되었습니다.",
        row: (idx !== -1 ? idx + 2 : mockHomeroomStudents.length + 1),
        studentId: sId,
        studentName: sName
      });
    }

    // 2. 교과담임 세특 관찰메모 동기화 저장
    if (action === 'save_subject_memo') {
      const sId = String(body.studentId || '').trim();
      const sName = String(body.studentName || '').trim();
      const draft = body.draft || '';

      const idx = mockHomeroomStudents.findIndex(s => s.stuNumber === sId || s.stuName === sName);
      if (idx !== -1 && draft) {
        mockHomeroomStudents[idx].existingSetuk = draft;
      }

      return res.status(200).json({
        success: true,
        message: "교과담임 세특 초안이 클라우드 시트에 동기화되었습니다.",
        row: idx !== -1 ? idx + 2 : 2
      });
    }

    // 3. 교사 사용 승인 신청
        if (action === 'approve_teacher') {
      const email = String(body.email || req.query.email || '').trim().toLowerCase();
      const target = applicants.find(a => a.email.toLowerCase() === email);
      if (target) {
        target.status = '승인';
        target.approvedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
        return res.status(200).json({ success: true, message: `${target.name} 교사 승인 완료`, teacher: target });
      }
      return res.status(404).json({ success: false, error: '해당 교사를 찾을 수 없습니다.' });
    }

    if (action === 'approve_all_teachers') {
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
      let count = 0;
      applicants.forEach(a => {
        if (a.status !== '승인') {
          a.status = '승인';
          a.approvedAt = now;
          count++;
        }
      });
      return res.status(200).json({ success: true, message: `총 ${count}명의 교사가 승인되었습니다.`, updatedCount: count, applicants: applicants });
    }

    if (action === 'apply_access') {
      const email = String(body.email || '').trim().toLowerCase();
      const adminGasUrl = getAdminGasUrl();
      if (adminGasUrl) {
        try {
          const fwdRes = await fetch(adminGasUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(body)
          });
          if (fwdRes.ok) {
            const fwdData = await fwdRes.json();
            return res.status(200).json(fwdData);
          }
        } catch (fwdErr) {
          console.warn('[sheet-sync] Remote GAS forward apply_access error:', fwdErr.message);
        }
      }
      const name = body.name || '';
      const school = body.school || '';
      const isAuto = email.endsWith('@sch.hs.kr') || email.endsWith('@goedu.kr');
      const status = isAuto ? '승인' : '대기';
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

      const existingIdx = applicants.findIndex(a => a.email.toLowerCase() === email);
      if (existingIdx !== -1) {
        applicants[existingIdx].status = status;
      } else {
        applicants.unshift({
          date: now,
          name,
          school,
          email,
          subject: body.phone || body.subject || '',
          reason: body.reason || '웹앱 사용 신청',
          status,
          note: isAuto ? '학교 공식 계정 자동승인' : '관리자 승인 대기'
        });
      }

      return res.status(200).json({
        success: true,
        approved: isAuto,
        status,
        message: isAuto
          ? "학교 공식 계정(@sch.hs.kr / @goedu.kr) 확인 완료! 3개월 이용 권한이 즉시 자동 승인되었습니다."
          : "사용 승인 신청이 완료되었습니다. 관리자 승인 후 3개월간 이용하실 수 있습니다."
      });
    }

    return res.status(200).json({ success: false, error: "알 수 없는 POST action" });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
