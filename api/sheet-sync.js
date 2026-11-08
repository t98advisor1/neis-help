const ADMIN_EMAILS = [
  'indosupervisor0126@gmail.com',
  'admin@sch.hs.kr',
  ...(process.env.ADMIN_EMAIL || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
];

const getAdminGasUrl = () => {

  return (

    process.env.ADMIN_GAS_URL ||

    process.env.GAS_ADMIN_URL ||

    process.env.ADMIN_GAS_APPROVAL_URL ||

    ''

  ).trim();

};



const KV_URL = (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '').replace(/\/+$/, '');

const KV_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';

const KV_APPLICANTS_KEY = 'neis-help:applicants';



async function loadApplicantsFromKV() {

  if (!KV_URL || !KV_TOKEN) return applicants;

  try {

    const fetchUrl = KV_URL + '/get/' + encodeURIComponent(KV_APPLICANTS_KEY);

    const res = await fetch(fetchUrl, {

      headers: { 'Authorization': 'Bearer ' + KV_TOKEN }

    });

    if (res.ok) {

      const data = await res.json();

      if (data && data.result) {

        const parsed = typeof data.result === 'string' ? JSON.parse(data.result) : data.result;

        if (Array.isArray(parsed) && parsed.length > 0) {

          return parsed;

        }

      }

    }

  } catch (e) {

    console.warn('[sheet-sync] KV load error:', e.message);

  }

  return applicants;

}



async function saveApplicantsToKV(list) {

  if (!KV_URL || !KV_TOKEN) return false;

  try {

    const fetchUrl = KV_URL + '/set/' + encodeURIComponent(KV_APPLICANTS_KEY);

    const res = await fetch(fetchUrl, {

      method: 'POST',

      headers: { 'Authorization': 'Bearer ' + KV_TOKEN },

      body: JSON.stringify(list)

    });

    return res.ok;

  } catch (e) {

    console.warn('[sheet-sync] KV save error:', e.message);

    return false;

  }

}



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



    // 4. 사용자 승인 여부 실시간 확인 (KV 저장소 우선 대조 - 취소/차단 계정 즉시 차단)
    if (action === 'check_access') {
      const email = String(req.query.email || '').trim().toLowerCase();
      if (!email) {
        return res.status(400).json({ found: false, approved: false, error: '이메일을 입력해 주세요.' });
      }

      // 최고 관리자 계정은 항상 승인 및 관리자 권한 부여
      if (ADMIN_EMAILS.includes(email)) {
        return res.status(200).json({
          found: true,
          approved: true,
          role: 'admin',
          isAdmin: true,
          status: '승인',
          name: '최고 관리자',
          school: '신천고 · 시스템 총괄 관리자',
          expiresAt: '2099-12-31',
          message: '[최고 관리자 인증 완료] 관리자 권한이 활성화되었습니다.'
        });
      }

      // KV 레지스트리 조회 (관리자의 승인/취소 상태가 최우선 기준)
      const currentApplicants = await loadApplicantsFromKV();
      const found = currentApplicants.find(a => a.email.toLowerCase() === email);

      if (found) {
        let isApproved = (found.status === '승인');
        const todayStr = new Date().toISOString().slice(0, 10);
        // 만료일 검증: 구글 시트 또는 관리자 설정 만료일 대조
        if (isApproved && found.expiresAt && /^\d{4}-\d{2}-\d{2}$/.test(found.expiresAt)) {
          if (todayStr > found.expiresAt) {
            isApproved = false;
            found.status = '만료';
          }
        }
        return res.status(200).json({
          found: true,
          approved: isApproved,
          status: found.status,
          name: found.name || email.split('@')[0],
          school: found.school || '고등학교',
          expiresAt: found.expiresAt || null,
          message: isApproved
            ? '[승인 확인 완료] 한 학기(6개월) 정식 이용이 활성화되었습니다. (만료일: ' + (found.expiresAt || '학기말') + ')'
            : (found.status === '만료' ? '이용 기간이 만료되었습니다. 관리자에게 연장을 요청하세요.' : '관리자에 의해 이용 승인이 대기 또는 취소 상태로 변경되었습니다.')
        });
      }

      // KV에 미등록된 최초 접속자 중 학교/교육청 공식 도메인은 자동 승인 등록
      const isOfficialDomain = email.endsWith('@sch.hs.kr') || email.endsWith('@goedu.kr') || email.endsWith('.sch.kr') || email.endsWith('sch.kr');
      if (isOfficialDomain) {
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
        const exp = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const schoolName = email.includes('sch') ? '신천고등학교(공식도메인)' : '경기도교육청(공식도메인)';
        const newTeacher = {
          date: now,
          name: email.split('@')[0] + ' 교사',
          school: schoolName,
          email: email,
          subject: '공식 도메인 로그인',
          reason: '학교/교육청 공식 도메인 실시간 자동승인 접속',
          status: '승인',
          expiresAt: exp,
          note: '학교 공식 계정 자동승인'
        };
        currentApplicants.unshift(newTeacher);
        await saveApplicantsToKV(currentApplicants);

        return res.status(200).json({
          found: true,
          approved: true,
          status: '승인',
          name: newTeacher.name,
          school: schoolName,
          expiresAt: exp,
          message: '학교 공식 계정 자동승인 확인 완료 (한 학기(6개월) 정식 이용 활성화)'
        });
      }

      return res.status(200).json({
        found: false,
        approved: false,
        status: 'not_found',
        message: '신청 내역이 없습니다. 교사 정보를 입력하고 [교사 사용 승인 신청하기]를 눌러주세요.'
      });
    }

    // 5. 신청자 전체 목록 조회 (KV 영구 저장소 우선 조회)
    if (action === 'list_applicants') {

      const currentApplicants = await loadApplicantsFromKV();

      return res.status(200).json({

        success: true,

        list: currentApplicants,

        count: currentApplicants.length

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



    // 3. 교사 사용 승인 / 대기 전환 / 전체 승인 / 신청 접수 (KV 영구 저장)

    if (action === 'approve_teacher') {
      const email = String(body.email || req.query.email || '').trim().toLowerCase();
      if (!email) return res.status(400).json({ success: false, error: '이메일을 입력해 주세요.' });
      const currentApplicants = await loadApplicantsFromKV();
      const target = currentApplicants.find(a => a.email.toLowerCase() === email);
      const exp = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
      if (target) {
        target.status = '승인';
        target.approvedAt = now;
        target.expiresAt = exp;
        await saveApplicantsToKV(currentApplicants);
        return res.status(200).json({ success: true, message: target.name + ' 교사 한 학기(6개월) 승인 완료', teacher: target });
      } else {
        const newTeacher = {
          date: now,
          name: email.split('@')[0],
          school: '관리자 수동 승인',
          email: email,
          subject: '관리자 직권 승인',
          reason: '관리자에 의한 직권 승인',
          status: '승인',
          expiresAt: exp,
          approvedAt: now,
          note: '관리자 수동 승인'
        };
        currentApplicants.unshift(newTeacher);
        await saveApplicantsToKV(currentApplicants);
        return res.status(200).json({ success: true, message: email + ' 교사 한 학기(6개월) 승인 완료', teacher: newTeacher });
      }
    }



    if (action === 'reject_teacher') {
      const email = String(body.email || req.query.email || '').trim().toLowerCase();
      if (!email) return res.status(400).json({ success: false, error: '이메일을 입력해 주세요.' });
      const currentApplicants = await loadApplicantsFromKV();
      const target = currentApplicants.find(a => a.email.toLowerCase() === email);
      if (target) {
        target.status = '대기';
        target.expiresAt = null;
        target.revokedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
        target.note = '관리자에 의해 승인 취소/차단됨';
        await saveApplicantsToKV(currentApplicants);
        return res.status(200).json({ success: true, message: target.name + ' 교사 승인 취소(대기 전환) 완료', teacher: target });
      } else {
        // 명단에 없는 계정 사전 차단 등록
        currentApplicants.unshift({
          date: new Date().toISOString().slice(0, 19).replace('T', ' '),
          name: email.split('@')[0],
          school: '관리자 사전 차단',
          email: email,
          subject: '관리자 사전 차단',
          reason: '관리자에 의한 계정 접근 차단',
          status: '대기',
          expiresAt: null,
          note: '관리자에 의해 승인 취소/차단됨'
        });
        await saveApplicantsToKV(currentApplicants);
        return res.status(200).json({ success: true, message: email + ' 계정이 차단(대기) 목록에 등록되었습니다.' });
      }
    }



    if (action === 'approve_all_teachers') {

      const currentApplicants = await loadApplicantsFromKV();

      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

      const exp = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      let count = 0;

      currentApplicants.forEach(a => {

        if (a.status !== '승인') {

          a.status = '승인';

          a.approvedAt = now;

          a.expiresAt = exp;

          count++;

        }

      });

      await saveApplicantsToKV(currentApplicants);

      return res.status(200).json({ success: true, message: `총 ${count}명의 교사가 한 학기(6개월) 승인되었습니다.`, updatedCount: count, applicants: currentApplicants });

    }



    if (action === 'apply_access') {
      const email = String(body.email || '').trim().toLowerCase();
      const adminGasUrl = getAdminGasUrl();
      if (adminGasUrl) {
        try {
          await fetch(adminGasUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(body)
          });
        } catch (fwdErr) {
          console.warn('[sheet-sync] Remote GAS forward apply_access error:', fwdErr.message);
        }
      }

      const currentApplicants = await loadApplicantsFromKV();
      const name = body.name || '';
      const school = body.school || '';
      const isAuto = email.endsWith('@sch.hs.kr') || email.endsWith('@goedu.kr') || email.endsWith('.sch.kr') || email.endsWith('sch.kr');
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
      const exp = isAuto ? new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) : '';

      const existingIdx = currentApplicants.findIndex(a => a.email.toLowerCase() === email);
      if (existingIdx !== -1) {
        // 이미 명단에 존재하는 경우: 관리자가 취소/대기로 설정한 상태를 함부로 '승인'으로 덮어쓰지 않음!
        const curStatus = currentApplicants[existingIdx].status || '대기';
        currentApplicants[existingIdx].date = now;
        if (name) currentApplicants[existingIdx].name = name;
        if (school) currentApplicants[existingIdx].school = school;
        if (body.subject) currentApplicants[existingIdx].subject = body.subject;
        if (body.reason) currentApplicants[existingIdx].reason = body.reason;
        await saveApplicantsToKV(currentApplicants);

        const isApproved = (curStatus === '승인');
        return res.status(200).json({
          success: true,
          approved: isApproved,
          status: curStatus,
          message: isApproved
            ? '이미 승인 완료된 계정입니다. (한 학기(6개월) 정식 이용 가능)'
            : '현재 관리자 승인 대기 또는 취소 상태입니다. 관리자 승인 완료 후 이용하실 수 있습니다.'
        });
      } else {
        const initialStatus = isAuto ? '승인' : '대기';
        currentApplicants.unshift({
          date: now,
          name: name || '선생님',
          school: school || (isAuto ? '신천고/경기도교육청' : '고등학교'),
          email: email,
          subject: body.phone || body.subject || '',
          reason: body.reason || '웹앱 사용 신청',
          status: initialStatus,
          expiresAt: isAuto ? exp : '',
          note: isAuto ? '학교 공식 계정 자동승인' : '관리자 승인 대기'
        });
        await saveApplicantsToKV(currentApplicants);

        return res.status(200).json({
          success: true,
          approved: isAuto,
          status: initialStatus,
          message: isAuto
            ? '학교 공식 계정 확인 완료! 한 학기(6개월) 이용 권한이 즉시 자동 승인되었습니다.'
            : '사용 승인 신청이 완료되었습니다. 관리자 승인 후 한 학기(6개월)간 이용하실 수 있습니다.'
        });
      }
    }

    // 3-1. 교사 만료일 직접 연장 및 변경 (구글 시트 연동 지원)
    if (action === 'update_expiry') {
      const email = String(body.email || req.query.email || '').trim().toLowerCase();
      const newExpiry = String(body.expiresAt || req.query.expiresAt || '').trim();
      if (!email || !newExpiry) return res.status(400).json({ success: false, error: '이메일과 만료일을 입력해 주세요.' });
      const currentApplicants = await loadApplicantsFromKV();
      const target = currentApplicants.find(a => a.email.toLowerCase() === email);
      if (target) {
        target.expiresAt = newExpiry;
        target.status = '승인';
        await saveApplicantsToKV(currentApplicants);
        return res.status(200).json({ success: true, message: target.name + ' 교사의 이용 기한이 ' + newExpiry + '까지로 연장되었습니다.', teacher: target });
      } else {
        return res.status(404).json({ success: false, error: '해당 교사를 찾을 수 없습니다.' });
      }
    }

    // 4. 관리자 수동 교사 추가 / 차단
    if (action === 'add_teacher') {
      const email = String(body.email || '').trim().toLowerCase();
      if (!email) return res.status(400).json({ success: false, error: '이메일을 입력해 주세요.' });
      const currentApplicants = await loadApplicantsFromKV();
      const status = (body.status === '대기' ? '대기' : '승인');
      const exp = status === '승인' ? new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) : '';
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

      const existing = currentApplicants.find(a => a.email.toLowerCase() === email);
      if (existing) {
        existing.status = status;
        existing.expiresAt = exp;
        if (body.name) existing.name = body.name;
        if (body.school) existing.school = body.school;
        existing.note = status === '승인' ? '관리자 수동 승인' : '관리자 승인 취소/차단';
      } else {
        currentApplicants.unshift({
          date: now,
          name: body.name || email.split('@')[0],
          school: body.school || '고등학교',
          email: email,
          subject: body.subject || '관리자 수동 등록',
          reason: body.reason || '관리자 직접 등록',
          status: status,
          expiresAt: exp,
          note: status === '승인' ? '관리자 수동 승인' : '관리자 사전 차단'
        });
      }
      await saveApplicantsToKV(currentApplicants);
      return res.status(200).json({ success: true, message: email + ' 계정이 ' + status + ' 상태로 등록되었습니다.' });
    }



    return res.status(200).json({ success: false, error: "알 수 없는 POST action" });

  }



  return res.status(405).json({ error: "Method not allowed" });

}

