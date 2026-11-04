// api/school-search.js — 나이스 교육정보 개방 포털(open.neis.go.kr) 공식 Open API 실시간 학교 검색
// Vercel Serverless Function (Node.js ESM)

const BUILTIN_SCHOOLS = [
  { name: "신천고등학교", region: "경기 시흥시", office: "경기도교육청", kind: "일반고(공립)", code: "7530562", address: "경기도 시흥시 신천로79번길 14 (신천동)", domain: "sch.hs.kr" },
  { name: "서울신천고등학교", region: "서울 송파구", office: "서울특별시교육청", kind: "일반고(공립)", code: "7010198", address: "서울특별시 송파구 잠실로 88", domain: "sen.go.kr" },
  { name: "소래고등학교", region: "경기 시흥시", office: "경기도교육청", kind: "일반고(공립)", code: "7530175", address: "경기도 시흥시 소래산길 45 (대야동)", domain: "goedu.kr" },
  { name: "은행고등학교", region: "경기 시흥시", office: "경기도교육청", kind: "일반고(공립)", code: "7530482", address: "경기도 시흥시 은행로 93 (은행동)", domain: "goedu.kr" },
  { name: "매화고등학교", region: "경기 시흥시", office: "경기도교육청", kind: "일반고(공립)", code: "7530633", address: "경기도 시흥시 매화1로 26 (매화동)", domain: "goedu.kr" },
  { name: "시흥능곡고등학교", region: "경기 시흥시", office: "경기도교육청", kind: "일반고(공립)", code: "7530634", address: "경기도 시흥시 능곡중앙로 125", domain: "goedu.kr" },
  { name: "장곡고등학교", region: "경기 시흥시", office: "경기도교육청", kind: "일반고(공립)", code: "7530523", address: "경기도 시흥시 인선길 27 (장곡동)", domain: "goedu.kr" },
  { name: "배곧고등학교", region: "경기 시흥시", office: "경기도교육청", kind: "일반고(공립)", code: "7531325", address: "경기도 시흥시 배곧4로 108-18", domain: "goedu.kr" },
  { name: "시흥매화고등학교", region: "경기 시흥시", office: "경기도교육청", kind: "일반고(공립)", code: "7530633", address: "경기도 시흥시 매화동", domain: "goedu.kr" },
  { name: "함현고등학교", region: "경기 시흥시", office: "경기도교육청", kind: "일반고(공립)", code: "7530524", address: "경기도 시흥시 함현로 49 (정왕동)", domain: "goedu.kr" },
  { name: "서해고등학교", region: "경기 시흥시", office: "경기도교육청", kind: "일반고(공립)", code: "7530174", address: "경기도 시흥시 중심상가1길 27 (정왕동)", domain: "goedu.kr" },
  { name: "정왕고등학교", region: "경기 시흥시", office: "경기도교육청", kind: "일반고(공립)", code: "7530483", address: "경기도 시흥시 정왕신길로 232", domain: "goedu.kr" },
  { name: "시흥고등학교", region: "경기 시흥시", office: "경기도교육청", kind: "일반고(공립)", code: "7530481", address: "경기도 시흥시 하중로 225 (하중동)", domain: "goedu.kr" },
  { name: "경기과학고등학교", region: "경기 수원시", office: "경기도교육청", kind: "과학고(공립)", code: "7530051", address: "경기도 수원시 장안구 수성로 473", domain: "goedu.kr" },
  { name: "수원고등학교", region: "경기 수원시", office: "경기도교육청", kind: "일반고(사립)", code: "7530106", address: "경기도 수원시 팔달구 정조로 732", domain: "goedu.kr" },
  { name: "수원여자고등학교", region: "경기 수원시", office: "경기도교육청", kind: "일반고(공립)", code: "7530108", address: "경기도 수원시 팔달구 화서문로 31", domain: "goedu.kr" },
  { name: "숙지고등학교", region: "경기 수원시", office: "경기도교육청", kind: "일반고(공립)", code: "7530445", address: "경기도 수원시 팔달구 화양로 67", domain: "goedu.kr" },
  { name: "창현고등학교", region: "경기 수원시", office: "경기도교육청", kind: "일반고(사립)", code: "7530113", address: "경기도 수원시 팔달구 월드컵로 275", domain: "goedu.kr" },
  { name: "유신고등학교", region: "경기 수원시", office: "경기도교육청", kind: "일반고(사립)", code: "7530111", address: "경기도 수원시 팔달구 월드컵로 275", domain: "goedu.kr" },
  { name: "분당고등학교", region: "경기 성남시", office: "경기도교육청", kind: "일반고(공립)", code: "7530164", address: "경기도 성남시 분당구 수내로 112", domain: "goedu.kr" },
  { name: "분당중앙고등학교", region: "경기 성남시", office: "경기도교육청", kind: "일반고(공립)", code: "7530165", address: "경기도 성남시 분당구 불정로 273", domain: "goedu.kr" },
  { name: "낙생고등학교", region: "경기 성남시", office: "경기도교육청", kind: "일반고(사립)", code: "7530161", address: "경기도 성남시 분당구 대왕판교로 477", domain: "goedu.kr" },
  { name: "서현고등학교", region: "경기 성남시", office: "경기도교육청", kind: "일반고(공립)", code: "7530166", address: "경기도 성남시 분당구 중앙공원로 66", domain: "goedu.kr" },
  { name: "늘푸른고등학교", region: "경기 성남시", office: "경기도교육청", kind: "일반고(공립)", code: "7530510", address: "경기도 성남시 분당구 정자로 135", domain: "goedu.kr" },
  { name: "보평고등학교", region: "경기 성남시", office: "경기도교육청", kind: "일반고(공립)", code: "7530675", address: "경기도 성남시 분당구 동판교로 65", domain: "goedu.kr" },
  { name: "안양고등학교", region: "경기 안양시", office: "경기도교육청", kind: "일반고(공립)", code: "7530122", address: "경기도 안양시 만안구 박달로 398", domain: "goedu.kr" },
  { name: "평촌고등학교", region: "경기 안양시", office: "경기도교육청", kind: "일반고(공립)", code: "7530128", address: "경기도 안양시 동안구 부림로 112", domain: "goedu.kr" },
  { name: "신성고등학교", region: "경기 안양시", office: "경기도교육청", kind: "일반고(사립)", code: "7530124", address: "경기도 안양시 만안구 예술공원로103번길 33", domain: "goedu.kr" },
  { name: "부천고등학교", region: "경기 부천시", office: "경기도교육청", kind: "일반고(공립)", code: "7530133", address: "경기도 부천시 소사로 192", domain: "goedu.kr" },
  { name: "부천여자고등학교", region: "경기 부천시", office: "경기도교육청", kind: "일반고(공립)", code: "7530134", address: "경기도 부천시 호현로489번길 47", domain: "goedu.kr" },
  { name: "상동고등학교", region: "경기 부천시", office: "경기도교육청", kind: "일반고(공립)", code: "7530488", address: "경기도 부천시 조마루로 132", domain: "goedu.kr" },
  { name: "광명고등학교", region: "경기 광명시", office: "경기도교육청", kind: "일반고(공립)", code: "7530139", address: "경기도 광명시 오리로 644", domain: "goedu.kr" },
  { name: "진성고등학교", region: "경기 광명시", office: "경기도교육청", kind: "일반고(사립)", code: "7530142", address: "경기도 광명시 가림로 63", domain: "goedu.kr" },
  { name: "동산고등학교", region: "경기 안산시", office: "경기도교육청", kind: "일반고(사립)", code: "7530150", address: "경기도 안산시 상록구 동산길 28", domain: "goedu.kr" },
  { name: "안산강서고등학교", region: "경기 안산시", office: "경기도교육청", kind: "일반고(공립)", code: "7530151", address: "경기도 안산시 단원구 와동로 45", domain: "goedu.kr" },
  { name: "고양국제고등학교", region: "경기 고양시", office: "경기도교육청", kind: "특목고(공립)", code: "7530750", address: "경기도 고양시 일산동구 식사로 302", domain: "goedu.kr" },
  { name: "일산대진고등학교", region: "경기 고양시", office: "경기도교육청", kind: "일반고(사립)", code: "7530184", address: "경기도 고양시 일산서구 대산로 107", domain: "goedu.kr" },
  { name: "백석고등학교", region: "경기 고양시", office: "경기도교육청", kind: "일반고(공립)", code: "7530179", address: "경기도 고양시 일산동구 강촌로 105", domain: "goedu.kr" },
  { name: "용인한국외국어대학교부설고등학교", region: "경기 용인시", office: "경기도교육청", kind: "자사고(사립)", code: "7530547", address: "경기도 용인시 처인구 모현읍 외대로81번길 39", domain: "goedu.kr" },
  { name: "수지고등학교", region: "경기 용인시", office: "경기도교육청", kind: "일반고(공립)", code: "7530198", address: "경기도 용인시 수지구 수지로342번길 39", domain: "goedu.kr" },
  { name: "동탄국제고등학교", region: "경기 화성시", office: "경기도교육청", kind: "특목고(공립)", code: "7530751", address: "경기도 화성시 동탄나루로 27", domain: "goedu.kr" },
  { name: "병점고등학교", region: "경기 화성시", office: "경기도교육청", kind: "일반고(공립)", code: "7530519", address: "경기도 화성시 병점3로 75", domain: "goedu.kr" },
  { name: "운정고등학교", region: "경기 파주시", office: "경기도교육청", kind: "자공고(공립)", code: "7530833", address: "경기도 파주시 가온로 199", domain: "goedu.kr" },
  { name: "김포고등학교", region: "경기 김포시", office: "경기도교육청", kind: "일반고(공립)", code: "7530224", address: "경기도 김포시 사우중로73번길 37", domain: "goedu.kr" },
  { name: "구리고등학교", region: "경기 구리시", office: "경기도교육청", kind: "일반고(공립)", code: "7530169", address: "경기도 구리시 체육관로 43", domain: "goedu.kr" },
  { name: "다산고등학교", region: "경기 남양주시", office: "경기도교육청", kind: "일반고(공립)", code: "7531361", address: "경기도 남양주시 다산중앙로 151", domain: "goedu.kr" },
  { name: "의정부고등학교", region: "경기 의정부시", office: "경기도교육청", kind: "일반고(공립)", code: "7530117", address: "경기도 의정부시 가능로136번길 29", domain: "goedu.kr" },
  { name: "평택고등학교", region: "경기 평택시", office: "경기도교육청", kind: "일반고(공립)", code: "7530143", address: "경기도 평택시 비전2로 33", domain: "goedu.kr" },
  { name: "이천고등학교", region: "경기 이천시", office: "경기도교육청", kind: "일반고(공립)", code: "7530210", address: "경기도 이천시 영창로 255", domain: "goedu.kr" },
  { name: "경기고등학교", region: "서울 강남구", office: "서울특별시교육청", kind: "일반고(공립)", code: "7010059", address: "서울특별시 강남구 영동대로 643", domain: "sen.go.kr" },
  { name: "숙명여자고등학교", region: "서울 강남구", office: "서울특별시교육청", kind: "일반고(사립)", code: "7010085", address: "서울특별시 강남구 남부순환로 2807", domain: "sen.go.kr" },
  { name: "휘문고등학교", region: "서울 강남구", office: "서울특별시교육청", kind: "자사고(사립)", code: "7010115", address: "서울특별시 강남구 역삼로 541", domain: "sen.go.kr" },
  { name: "서울고등학교", region: "서울 서초구", office: "서울특별시교육청", kind: "일반고(공립)", code: "7010079", address: "서울특별시 서초구 효령로 197", domain: "sen.go.kr" },
  { name: "반포고등학교", region: "서울 서초구", office: "서울특별시교육청", kind: "일반고(공립)", code: "7010073", address: "서울특별시 서초구 신반포로 55", domain: "sen.go.kr" },
  { name: "양정고등학교", region: "서울 양천구", office: "서울특별시교육청", kind: "자사고(사립)", code: "7010256", address: "서울특별시 양천구 안양천로 1069", domain: "sen.go.kr" },
  { name: "목동고등학교", region: "서울 양천구", office: "서울특별시교육청", kind: "일반고(사립)", code: "7010251", address: "서울특별시 양천구 목동서로 247", domain: "sen.go.kr" },
  { name: "인천고등학교", region: "인천 미추홀구", office: "인천광역시교육청", kind: "일반고(공립)", code: "7310029", address: "인천광역시 미추홀구 경원대로 773", domain: "ice.go.kr" },
  { name: "송도고등학교", region: "인천 연수구", office: "인천광역시교육청", kind: "일반고(사립)", code: "7310040", address: "인천광역시 연수구 독배로 146", domain: "ice.go.kr" },
  { name: "인천포스코고등학교", region: "인천 연수구", office: "인천광역시교육청", kind: "자사고(사립)", code: "7310394", address: "인천광역시 연수구 컨벤시아대로42번길 50", domain: "ice.go.kr" }
];

// 주요 고등학교 약칭/별칭 매핑 사전
const ALIASES = {
  "단대부고": "단국대학교사범대학부속고등학교",
  "단대부중": "단국대학교사범대학부속중학교",
  "외대부고": "용인한국외국어대학교부설고등학교",
  "중대부고": "중앙대학교사범대학부속고등학교",
  "중대부여고": "중앙대학교사범대학부속여자고등학교",
  "동대부고": "동국대학교사범대학부속고등학교",
  "동대부여고": "동국대학교사범대학부속여자고등학교",
  "한대부고": "한양대학교사범대학부속고등학교",
  "홍대부고": "홍익대학교사범대학부속고등학교",
  "홍대부여고": "홍익대학교사범대학부속여자고등학교",
  "이대부고": "이화여자대학교사범대학부속이화금란고등학교",
  "건대부고": "건국대학교사범대학부속고등학교",
  "서울과고": "서울과학고등학교",
  "경기과고": "경기과학고등학교",
  "한성과고": "한성과학고등학교",
  "세종과고": "세종과학고등학교",
  "인천과고": "인천과학고등학교",
  "대전과고": "대전과학고등학교",
  "대구과고": "대구과학고등학교",
  "광주과고": "광주과학고등학교",
  "울산과고": "울산과학고등학교",
  "경남과고": "경남과학고등학교",
  "전북과고": "전북과학고등학교",
  "전남과고": "전남과학고등학교",
  "경북과고": "경북과학고등학교",
  "충남과고": "충남과학고등학교",
  "충북과고": "충북과학고등학교",
  "강원과고": "강원과학고등학교",
  "제주과고": "제주과학고등학교",
  "민사고": "민족사관고등학교",
  "상산고": "상산고등학교",
  "포철고": "포항제철고등학교",
  "광양제철고": "광양제철고등학교",
  "북일고": "북일고등학교",
  "김천고": "김천고등학교",
  "현대청운고": "현대청운고등학교"
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const q = String(req.query.q || '').trim();
  if (!q) {
    return res.status(200).json({
      source: 'builtin',
      schools: BUILTIN_SCHOOLS.slice(0, 15)
    });
  }

  const results = [];
  const seen = new Set();

  // 1. 내장 DB 우선 매칭 (신천고 및 시흥/경기 관내 고교 0.01초 즉시 매칭)
  for (const s of BUILTIN_SCHOOLS) {
    if (s.name.includes(q) || (s.region && s.region.includes(q)) || (s.office && s.office.includes(q))) {
      const key = `${s.name}_${s.region}`;
      if (!seen.has(key)) {
        seen.add(key);
        results.push(s);
      }
    }
  }

  // 2. 검색어 변형 구성 (약칭 매핑 + "여고" -> "여자고" 변환)
  const queries = [q];
  if (ALIASES[q]) {
    queries.unshift(ALIASES[q]);
  }
  if (q.includes('여고')) {
    queries.push(q.replace(/여고/g, '여자고'));
  }

  // 3. 나이스 교육정보 개방 포털(open.neis.go.kr) 공식 Open API 실시간 검색
  try {
    const apiKey = process.env.NEIS_API_KEY || '';
    for (const queryStr of queries) {
      if (results.length >= 30) break;
      const neisUrl = `https://open.neis.go.kr/hub/schoolInfo?Type=json&pIndex=1&pSize=25&SCHUL_NM=${encodeURIComponent(queryStr)}${apiKey ? `&KEY=${apiKey}` : ''}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);

      try {
        const response = await fetch(neisUrl, {
          signal: controller.signal,
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SangibuHelper/1.0)' }
        });
        clearTimeout(timer);

        if (response.ok) {
          const data = await response.json();
          const rows = data?.schoolInfo?.[1]?.row || [];
          for (const r of rows) {
            const name = r.SCHUL_NM || '';
            const address = r.ORG_RDNMA || '';
            const region = address ? address.split(' ').slice(0, 2).join(' ') : (r.LCTN_SC_NM || '');
            const office = r.ATPT_OFCDC_SC_NM || '';
            const schoolType = r.SCHUL_KND_SC_NM || '';
            const hsType = r.HS_SC_NM || '';
            const fondType = r.FOND_SC_NM || '공립';
            const kind = hsType ? `${hsType}(${fondType})` : (schoolType ? `${schoolType}(${fondType})` : `고등학교(${fondType})`);
            const code = r.SD_SCHUL_CODE || '';
            const homepage = r.HMPG_ADRES || '';

            // 도메인 힌트 도출
            let domain = 'goedu.kr';
            if (office.includes('서울')) domain = 'sen.go.kr';
            else if (office.includes('인천')) domain = 'ice.go.kr';
            else if (office.includes('부산')) domain = 'pen.go.kr';
            else if (office.includes('대구')) domain = 'dge.go.kr';
            else if (office.includes('광주')) domain = 'gen.go.kr';
            else if (office.includes('대전')) domain = 'dje.go.kr';
            else if (name.includes('신천고')) domain = 'sch.hs.kr';

            const key = `${name}_${region}`;
            if (!seen.has(key)) {
              seen.add(key);
              results.push({
                name,
                region,
                office,
                kind,
                code,
                address,
                homepage,
                domain
              });
            }
          }
        }
      } catch (innerErr) {
        // 단일 쿼리 실패 시 다음 쿼리 진행
      }
    }
  } catch (err) {
    // 네트워크 실패 시 내장 DB 결과 유지
  }

  // 4. 만약 검색어가 2글자 이상인데 아무 결과도 없다면 입력값으로 직접 선택 가능 항목 생성
  if (results.length === 0 && q.length >= 2) {
    const normalizedName = q.endsWith('고') ? q + '등학교' : (q.includes('학교') ? q : q + '고등학교');
    results.push({
      name: normalizedName,
      region: "전국 / 직접 입력",
      office: "교육청 소속",
      kind: "고등학교",
      code: "CUSTOM",
      address: `${normalizedName} (직접 입력)`,
      domain: "goedu.kr"
    });
  }

  // 5. 정렬: 완전 일치 > 고등학교 우선 > 중학교 > 초등학교 순
  results.sort((a, b) => {
    const aExact = a.name === q || a.name === q + '등학교' || a.name === q + '고등학교';
    const bExact = b.name === q || b.name === q + '등학교' || b.name === q + '고등학교';
    if (aExact && !bExact) return -1;
    if (!aExact && bExact) return 1;

    const aHigh = a.name.includes('고등학교') || a.kind.includes('고');
    const bHigh = b.name.includes('고등학교') || b.kind.includes('고');
    if (aHigh && !bHigh) return -1;
    if (!aHigh && bHigh) return 1;

    const aMid = a.name.includes('중학교');
    const bMid = b.name.includes('중학교');
    if (aMid && !bMid) return -1;
    if (!aMid && bMid) return 1;

    return a.name.localeCompare(b.name, 'ko');
  });

  return res.status(200).json({
    source: 'neis_schoolinfo_api',
    query: q,
    count: results.length,
    schools: results.slice(0, 25)
  });
}
