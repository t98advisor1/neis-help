// js/mock-class-30.js — 1학년 1반 30명 모의 학급 관계형 데이터셋 (담임교사용 마스터 & 교과교사용 세특)
(function() {
  'use strict';

  // 1. 담임교사용 마스터 레코드 (30명)
  // 2028 개편 5등급제(1.00~5.00) 및 9등급제 환산 내신, 모의고사 최저, 목표대학 1~3, 행특 종합의견
  const MOCK_HOMEROOM_30 = [
    {
      id: "rec_10101",
      stuNumber: "10101",
      stuName: "김태형",
      gender: "남",
      stuMajor: "생명공학과 (바이오신약개발)",
      track: "자연계열",
      grade5: 1.48,
      grade9: 1.85,
      mockExam: "3합 7 (국2 수1 영2 탐1)",
      targetUni1: "고려대 생명공학부 (학업우수) · 1.78 [적정]",
      targetUni2: "성균관대 융합생명공학 (융합형) · 1.92 [안정]",
      targetUni3: "한양대 생명공학과 (지역균형) · 1.52 [소신]",
      status: "1차완료",
      existingSetuk: "삼투현상과 세포막 선택적 투과성에 대한 가설 검증 실험을 설계하고, 농도 차이에 따른 원형질 분리 과정을 현미경으로 정밀 관찰하여 인지질 이중층 구조의 물질 수송 메커니즘을 규명함. 최신 바이오 신약 기술 동향을 조사하여 생명윤리적 관점에서 발표함.",
      subject: "통합과학",
      homeroomOpinion: "학급 반장으로서 뛰어난 리더십과 봉사 정신을 발휘하며, 생명과학 분야의 깊은 탐구열로 동료들의 학업 멘토 역할을 성실히 수행함."
    },
    {
      id: "rec_10102",
      stuNumber: "10102",
      stuName: "박서준",
      gender: "남",
      stuMajor: "컴퓨터공학과 (인공지능·빅데이터)",
      track: "자연계열",
      grade5: 2.10,
      grade9: 2.30,
      mockExam: "3합 9 (수2 영3 탐2)",
      targetUni1: "서울시립대 컴퓨터과학부 (면접형) · 2.15 [적정]",
      targetUni2: "건국대 컴퓨터공학부 (KU자기추천) · 2.28 [적정]",
      targetUni3: "동국대 컴퓨터AI학부 (DoDream) · 2.42 [안정]",
      status: "작성중",
      existingSetuk: "정렬 알고리즘의 시간복잡도를 파이썬 코드로 직접 구현하여 정량 비교하고 데이터 규모에 따른 최적화 방안을 도출함. 자료구조의 효율적 설계를 통해 컴퓨팅 사고력과 알고리즘 문제해결 역량을 발휘함.",
      subject: "공통수학1",
      homeroomOpinion: "문제 상황에 부딪혔을 때 포기하지 않고 알고리즘적 사고를 적용해 대안을 찾는 집념이 돋보이며, 학급 정보기기 도우미로 헌신함."
    },
    {
      id: "rec_10103",
      stuNumber: "10103",
      stuName: "이지은",
      gender: "여",
      stuMajor: "사회학과 (빅데이터 사회과학)",
      track: "인문사회",
      grade5: 1.35,
      grade9: 1.65,
      mockExam: "3합 6 (국1 수2 영1 사1)",
      targetUni1: "연세대 사회학과 (활동우수) · 1.58 [소신]",
      targetUni2: "고려대 사회학과 (계열적합) · 1.72 [적정]",
      targetUni3: "서강대 사회과학부 (일반) · 1.80 [안정]",
      status: "수시확정",
      existingSetuk: "사회 불평등 현상과 교육 기회의 양극화에 관한 통계청 마이크로데이터를 활용하여 계층 간 소득 격차와 학업 성취도의 상관관계를 다변량 분석함.",
      subject: "통합사회",
      homeroomOpinion: "공동체 문제에 대한 예리한 통찰력과 따뜻한 공감 능력을 겸비하였으며, 모둠 활동 시 소외되는 팀원이 없도록 조율하는 소통 역량이 탁월함."
    },
    {
      id: "rec_10104",
      stuNumber: "10104",
      stuName: "정호석",
      gender: "남",
      stuMajor: "화학공학과 (에너지·이차전지)",
      track: "자연계열",
      grade5: 1.85,
      grade9: 2.15,
      mockExam: "3합 8 (국3 수2 영2)",
      targetUni1: "한양대 화학공학과 (추천형) · 1.95 [소신]",
      targetUni2: "중앙대 에너지화학공학 (CAU융합) · 2.12 [적정]",
      targetUni3: "경희대 화학공학과 (네오) · 2.20 [안정]",
      status: "1차완료",
      existingSetuk: "이차전지 충방전 반응 메커니즘을 산화환원 전위와 연결하여 분석하고 전고체 배터리 전해질의 이온 전도도 향상 방안에 관한 학술 논문을 탐독하여 요약 발표함.",
      subject: "통합과학",
      homeroomOpinion: "매사 긍정적이고 활기찬 태도로 학급 분위기를 밝게 이끌며, 과학 실험 시간 철저한 안전 관리와 적극적인 참여 태도가 모범적임."
    },
    {
      id: "rec_10105",
      stuNumber: "10105",
      stuName: "최유나",
      gender: "여",
      stuMajor: "경제학과 (금융공학·계량경제)",
      track: "인문사회",
      grade5: 1.60,
      grade9: 1.90,
      mockExam: "3합 7 (국2 수2 영2 사1)",
      targetUni1: "서강대 경제학과 (일반) · 1.75 [적정]",
      targetUni2: "성균관대 글로벌경제 (학과형) · 1.85 [적정]",
      targetUni3: "중앙대 경제학부 (다빈치) · 2.05 [안정]",
      status: "1차완료",
      existingSetuk: "기준금리 변동이 거시경제 지표에 미치는 영향을 파급 경로별로 정리하고 테일러 준칙(Taylor's rule)을 적용한 통화정책 모델링을 수행하여 실물경제의 탄력성을 수식화함.",
      subject: "경제수학",
      homeroomOpinion: "학급 환경미화 부장으로서 쾌적한 학습 환경 조성을 위해 헌신적이며, 논리적인 언변과 차분한 태도로 신뢰를 받는 학생임."
    },
    {
      id: "rec_10106",
      stuNumber: "10106",
      stuName: "강도현",
      gender: "남",
      stuMajor: "기계공학과 (로봇공학·메카트로닉스)",
      track: "자연계열",
      grade5: 2.20,
      grade9: 2.45,
      mockExam: "3합 9 (수2 영3 탐3)",
      targetUni1: "인하대 기계공학과 (인하미래) · 2.35 [적정]",
      targetUni2: "아주대 기계공학과 (ACE) · 2.40 [적정]",
      targetUni3: "국민대 기계금속공학 (프런티어) · 2.60 [안정]",
      status: "대기",
      existingSetuk: "4절 링크 메커니즘을 활용한 보행 로봇 다리 구조를 설계하고 자유도 계산식을 도출함. 모터 토크와 감속비 선정을 위한 역학 해석을 성실히 수행함.",
      subject: "공통수학1",
      homeroomOpinion: "기계 메커니즘에 대한 호기심이 남다르며, 묵묵히 자신의 역할을 완수하고 친구들을 배려하는 성실한 심성을 지님."
    },
    {
      id: "rec_10107",
      stuNumber: "10107",
      stuName: "문채원",
      gender: "여",
      stuMajor: "약학과 (천연물신약연구)",
      track: "자연계열",
      grade5: 1.25,
      grade9: 1.40,
      mockExam: "3합 5 (국1 수1 영2 탐1)",
      targetUni1: "서울대 약학계열 (지역균형) · 1.25 [소신]",
      targetUni2: "성균관대 약학과 (학과형) · 1.35 [적정]",
      targetUni3: "중앙대 약학부 (CAU융합) · 1.42 [안정]",
      status: "수시확정",
      existingSetuk: "식물 유래 플라보노이드 성분의 항산화 활성 메커니즘을 DPPH 라디칼 소거능 측정 실험을 통해 정량적으로 검증하고 분자 구조와의 상관성을 분석함.",
      subject: "통합과학",
      homeroomOpinion: "자기주도적 학습 능력이 최상위권이며, 정직하고 바른 생활 태도로 모든 교과 선생님들로부터 극찬을 받는 모범생임."
    },
    {
      id: "rec_10108",
      stuNumber: "10108",
      stuName: "오세진",
      gender: "남",
      stuMajor: "전자공학과 (지능형반도체·VLSI)",
      track: "자연계열",
      grade5: 1.70,
      grade9: 1.95,
      mockExam: "3합 7 (국2 수1 영2 탐2)",
      targetUni1: "성균관대 반도체시스템 (학과형) · 1.85 [적정]",
      targetUni2: "한양대 융합전자공학부 (일반) · 1.90 [적정]",
      targetUni3: "서강대 전자공학과 (일반) · 2.05 [안정]",
      status: "1차완료",
      existingSetuk: "MOSFET 트랜지스터의 게이트 산화막 두께 감소에 따른 양자 터널링 효과와 누설 전류 문제를 조사하고 FinFET 및 GAA 3차원 트랜지스터 구조의 혁신성을 비교 정리함.",
      subject: "공통수학1",
      homeroomOpinion: "수학적 직관력과 물리적 사고력이 매우 뛰어나며, 학습 부진 친구들을 위해 자발적으로 스터디를 조직해 가르쳐주는 따뜻한 인성을 보임."
    },
    {
      id: "rec_10109",
      stuNumber: "10109",
      stuName: "윤서아",
      gender: "여",
      stuMajor: "미디어커뮤니케이션 (디지털영상·저널리즘)",
      track: "인문사회",
      grade5: 2.05,
      grade9: 2.35,
      mockExam: "3합 8 (국2 영2 사2)",
      targetUni1: "경희대 미디어학과 (네오) · 2.20 [적정]",
      targetUni2: "동국대 미디어커뮤니케이션 (DoDream) · 2.30 [적정]",
      targetUni3: "성신여대 미디어커뮤니케이션 · 2.50 [안정]",
      status: "작성중",
      existingSetuk: "뉴미디어 플랫폼에서의 허위 정보 확산 메커니즘을 전염병 확산 모델과 결합하여 고찰하고, 팩트체크 시스템의 제도적 개선 방안에 대한 비판적 논평을 작성함.",
      subject: "통합사회",
      homeroomOpinion: "창의적인 기획력과 영상 편집 역량을 갖추었으며, 학급 홍보위원으로서 학급의 소중한 순간들을 기록하고 동료들과 공유하는 데 앞장섬."
    },
    {
      id: "rec_10110",
      stuNumber: "10110",
      stuName: "배준우",
      gender: "남",
      stuMajor: "신소재공학과 (나노소재·디스플레이)",
      track: "자연계열",
      grade5: 2.15,
      grade9: 2.40,
      mockExam: "3합 9 (수2 영3 탐2)",
      targetUni1: "숭실대 신소재공학과 (SSU미래) · 2.35 [적정]",
      targetUni2: "세종대 나노신소재공학 · 2.45 [안정]",
      targetUni3: "단국대 고분자공학과 · 2.60 [안정]",
      status: "대기",
      existingSetuk: "탄소나노튜브(CNT)와 그래핀의 결정 구조적 특성을 비교하고 유연 디스플레이 투명전극 적용 시의 장단점을 재료역학적 관점에서 탐구 보고서로 완성함.",
      subject: "통합과학",
      homeroomOpinion: "실험 탐구에 대한 열정이 높고 규율을 솔선수범하여 준수하며, 교우 관계가 원만하여 학급의 궂은일을 도맡아 해결함."
    },
    {
      id: "rec_10111",
      stuNumber: "10111",
      stuName: "송민아",
      gender: "여",
      stuMajor: "수학교육과 (수리철학·교육공학)",
      track: "사범계열",
      grade5: 1.50,
      grade9: 1.75,
      mockExam: "3합 6 (국2 수1 영2)",
      targetUni1: "고려대 수학교육과 (학업우수) · 1.65 [소신]",
      targetUni2: "이화여대 수학교육과 (미래인재) · 1.75 [적정]",
      targetUni3: "한국교원대 수학교육과 · 1.80 [적정]",
      status: "1차완료",
      existingSetuk: "다양한 수열의 귀납적 정의와 프랙털 도형의 자기유사성을 수학적 귀납법으로 논증하고, 동료 학생들이 쉽게 이해할 수 있는 시각적 증명 교구를 제작하여 시연함.",
      subject: "공통수학1",
      homeroomOpinion: "학급 부반장으로서 학급 대소사를 세심하게 챙기고, 수학을 어려워하는 친구들을 1:1로 지도하며 헌신하는 진정한 교육자의 자질을 보임."
    },
    {
      id: "rec_10112",
      stuNumber: "10112",
      stuName: "임재원",
      gender: "남",
      stuMajor: "의예과 (신경외과·뇌과학)",
      track: "의약학",
      grade5: 1.05,
      grade9: 1.18,
      mockExam: "3합 4 (국1 수1 영1 탐1)",
      targetUni1: "서울대 의예과 (일반) · 1.15 [소신]",
      targetUni2: "연세대 의예과 (활동우수) · 1.18 [적정]",
      targetUni3: "가톨릭대 의예과 (학교장추천) · 1.20 [안정]",
      status: "수시확정",
      existingSetuk: "신경전달물질의 시냅스 간극 방출과 활동전위 재분극 메커니즘을 이온 통로 개폐 모델로 분석하고, 퇴행성 뇌신경질환의 조기 진단 바이오마커 연구 동향을 심도 있게 탐색함.",
      subject: "통합과학",
      homeroomOpinion: "학업 역량과 인성 모두에서 전교 최고의 표본이 되는 학생으로, 항상 겸손하고 타인의 아픔에 깊이 공감하는 훌륭한 의사로서의 자질을 갖춤."
    },
    {
      id: "rec_10113",
      stuNumber: "10113",
      stuName: "장하은",
      gender: "여",
      stuMajor: "간호학과 (임상간호·글로벌보건)",
      track: "보건의료",
      grade5: 2.30,
      grade9: 2.55,
      mockExam: "3합 9 (국3 영2 사2)",
      targetUni1: "가천대 간호학과 (가천바람개비) · 2.40 [적정]",
      targetUni2: "을지대 간호학과 · 2.50 [적정]",
      targetUni3: "삼육대 간호학과 · 2.65 [안정]",
      status: "대기",
      existingSetuk: "감염병 전파 차단을 위한 손위생 프로토콜의 임상적 유의성을 세균 배양 실험을 통해 입증하고, 환자 안전 중심의 간호 윤리 강령을 주제로 발표함.",
      subject: "통합과학",
      homeroomOpinion: "매사 따뜻하고 배려심 넘치는 태도로 급우들을 돌보며, 보건실 도우미 활동 시 응급 처치 요령을 정확히 숙지하여 침착하게 대응함."
    },
    {
      id: "rec_10114",
      stuNumber: "10114",
      stuName: "한승우",
      gender: "남",
      stuMajor: "건축학과 (친환경건축·도시재생)",
      track: "자연계열",
      grade5: 2.40,
      grade9: 2.70,
      mockExam: "3합 10 (수3 영3 탐3)",
      targetUni1: "명지대 건축학부 (명지인재) · 2.55 [적정]",
      targetUni2: "경기대 건축학과 · 2.65 [적정]",
      targetUni3: "인천대 건축공학과 · 2.80 [안정]",
      status: "작성중",
      existingSetuk: "패시브 하우스의 단열 설계 원리를 열전도 방정식과 연결하여 시뮬레이션하고, 제로에너지 빌딩 인증 기준을 만족하기 위한 일조 분석 모델을 작성함.",
      subject: "공통수학1",
      homeroomOpinion: "공간 감각과 미적 감수성이 뛰어나며, 모둠 과제 시 창의적인 아이디어를 제시하고 솔선수범하여 모형을 제작함."
    },
    {
      id: "rec_10115",
      stuNumber: "10115",
      stuName: "고은비",
      gender: "여",
      stuMajor: "국어교육과 (한국어문학·매체교육)",
      track: "사범계열",
      grade5: 2.10,
      grade9: 2.35,
      mockExam: "3합 8 (국2 영2 사2)",
      targetUni1: "공주대 국어교육과 · 2.25 [적정]",
      targetUni2: "충남대 국어교육과 · 2.35 [적정]",
      targetUni3: "인하대 국어교육과 · 2.45 [안정]",
      status: "1차완료",
      existingSetuk: "훈민정음 창제 원리의 제자해를 음성학적 조음 기관 관점에서 분석하고 현대 한국어 맞춤법의 소리대로 적되 어법에 맞도록 함의 역사적 변천 과정을 소논문으로 작성함.",
      subject: "국어",
      homeroomOpinion: "어휘 구사력이 매우 정교하고 품격이 있으며, 학급 도서부원으로서 아침 독서 10분 운동을 이끌며 독서 분위기 조성에 크게 기여함."
    },
    {
      id: "rec_10116",
      stuNumber: "10116",
      stuName: "류태민",
      gender: "남",
      stuMajor: "환경공학과 (탄소중립·수처리기술)",
      track: "자연계열",
      grade5: 2.50,
      grade9: 2.80,
      mockExam: "3합 10 (수3 영3 탐3)",
      targetUni1: "수원대 환경에너지공학 · 2.70 [적정]",
      targetUni2: "한경국립대 환경공학 · 2.85 [안정]",
      targetUni3: "강원대 환경공학부 · 2.95 [안정]",
      status: "대기",
      existingSetuk: "오염 하천수의 부영양화 지표(BOD, COD, 질소·인 농도)를 분석하고, 키토산 기반 천연 응집제를 활용한 응집 침전 실험을 통해 탁도 제거율을 비교 평가함.",
      subject: "통합과학",
      homeroomOpinion: "환경 보존에 대한 남다른 책임감을 지니고 있으며, 학급 분리수거 분리배출 담당으로서 매일 종례 후 묵묵히 정리정돈을 실천함."
    },
    {
      id: "rec_10117",
      stuNumber: "10117",
      stuName: "서지우",
      gender: "여",
      stuMajor: "산업공학과 (스마트물류·최적화설계)",
      track: "자연계열",
      grade5: 2.25,
      grade9: 2.50,
      mockExam: "3합 9 (수2 영3 사2)",
      targetUni1: "단국대 산업보안학과 · 2.40 [적정]",
      targetUni2: "가천대 산업경영공학 · 2.50 [적정]",
      targetUni3: "한성대 스마트경영공학 · 2.65 [안정]",
      status: "작성중",
      existingSetuk: "선형계획법의 단체법(Simplex Method)을 활용하여 제한된 자원 내에서의 생산 효율 극대화 최적해를 도출하고 파이썬 라이브러리로 수치적 해법을 구현함.",
      subject: "공통수학1",
      homeroomOpinion: "조직적이고 체계적인 일 처리 능력이 뛰어나며, 학급 행사 기획 시 일정과 동선을 효율적으로 설계하여 성공적인 행사를 견인함."
    },
    {
      id: "rec_10118",
      stuNumber: "10118",
      stuName: "안희원",
      gender: "여",
      stuMajor: "응용통계학과 (핀테크·데이터마이닝)",
      track: "인문사회",
      grade5: 1.75,
      grade9: 2.05,
      mockExam: "3합 7 (국2 수2 영2)",
      targetUni1: "중앙대 응용통계학과 · 1.95 [소신]",
      targetUni2: "동국대 통계학과 · 2.10 [적정]",
      targetUni3: "서울여대 디지털미디어 · 2.30 [안정]",
      status: "1차완료",
      existingSetuk: "베이즈 정리를 활용한 질병 진단 검사의 사후 확률 계산 오차를 탐구하고 거짓 양성(False Positive)의 역설이 사회적 방역 정책에 주는 시사점을 논증함.",
      subject: "경제수학",
      homeroomOpinion: "수리적 분석력과 인문학적 감수성을 두루 갖추었으며, 매사 성실하고 예의 바른 태도로 교사와 학우 모두에게 사랑받는 학생임."
    },
    {
      id: "rec_10119",
      stuNumber: "10119",
      stuName: "양시우",
      gender: "남",
      stuMajor: "항공우주공학과 (비행제어·무인드론)",
      track: "자연계열",
      grade5: 2.35,
      grade9: 2.65,
      mockExam: "3합 9 (수2 영3 탐3)",
      targetUni1: "한국항공대 항공우주공학 · 2.45 [소신]",
      targetUni2: "세종대 항공시스템공학 · 2.55 [적정]",
      targetUni3: "경상국립대 항공우주학부 · 2.75 [안정]",
      status: "대기",
      existingSetuk: "양력 발생 원리를 베르누이 정리와 뉴턴 제3법칙으로 통합 해석하고 날개 받음각(Angle of Attack) 변화에 따른 실속(Stall) 한계를 풍동 실험으로 모사함.",
      subject: "통합과학",
      homeroomOpinion: "항공 역학에 대한 탐구열이 대단하며, 실패를 두려워하지 않고 끊임없이 원인을 분석하여 개선책을 찾아내는 끈기가 돋보임."
    },
    {
      id: "rec_10120",
      stuNumber: "10120",
      stuName: "유채린",
      gender: "여",
      stuMajor: "경영학과 (ESG경영·소셜벤처)",
      track: "인문사회",
      grade5: 1.95,
      grade9: 2.25,
      mockExam: "3합 8 (국2 영2 사2)",
      targetUni1: "건국대 경영학과 · 2.15 [적정]",
      targetUni2: "국민대 경영학부 · 2.28 [적정]",
      targetUni3: "숭실대 벤처중소기업 · 2.40 [안정]",
      status: "작성중",
      existingSetuk: "기업의 ESG 평가 지표와 재무적 성과의 상관관계를 국내 상장기업 50개 사 사례를 바탕으로 패널 분석하고 지속가능경영 보고서의 신뢰성 검증 방안을 제안함.",
      subject: "통합사회",
      homeroomOpinion: "창의적인 사업 기획력과 리더십을 지녔으며, 교내 바자회 프로젝트를 주도하여 얻은 수익금을 전액 기부하는 등 사회적 가치 실현에 열정적임."
    },
    {
      id: "rec_10121",
      stuNumber: "10121",
      stuName: "조한결",
      gender: "남",
      stuMajor: "물리학과 (양자정보·응집물질)",
      track: "자연계열",
      grade5: 1.65,
      grade9: 1.92,
      mockExam: "3합 6 (국2 수1 영2 탐1)",
      targetUni1: "카이스트 (KAIST) 무학과 · 일반 [소신]",
      targetUni2: "성균관대 물리학과 · 1.85 [적정]",
      targetUni3: "한양대 물리학과 · 1.95 [안정]",
      status: "수시확정",
      existingSetuk: "빛의 이중성을 영의 이중슬릿 간섭 실험으로 확인하고 광전효과 실험 데이터를 통해 플랑크 상수를 직접 유도하는 등 양자역학 기초 원리를 엄밀하게 증명함.",
      subject: "공통수학1",
      homeroomOpinion: "자연현상의 근본 원리를 파고드는 학구열이 매우 뛰어나며, 깊이 있는 질문을 통해 수업의 질을 높이는 학급의 지적 리더임."
    },
    {
      id: "rec_10122",
      stuNumber: "10122",
      stuName: "천가람",
      gender: "여",
      stuMajor: "행정학과 (공공정책·복지행정)",
      track: "인문사회",
      grade5: 2.20,
      grade9: 2.48,
      mockExam: "3합 8 (국2 영3 사2)",
      targetUni1: "서울과기대 행정학과 · 2.35 [적정]",
      targetUni2: "가톨릭대 행정학과 · 2.50 [안정]",
      targetUni3: "경기대 공공안전학부 · 2.65 [안정]",
      status: "1차완료",
      existingSetuk: "지방소멸 위기 극복을 위한 청년 정착 지원 조례의 정책 효과를 비용편익 분석(B/C ratio) 기법으로 평가하고 맞춤형 공공 인프라 확충 정책을 기안함.",
      subject: "통합사회",
      homeroomOpinion: "공공의 이익을 먼저 생각하는 성숙한 시민의식을 지니고 있으며, 자치법정 활동에서 공정한 판결을 내려 급우들의 신망을 얻음."
    },
    {
      id: "rec_10123",
      stuNumber: "10123",
      stuName: "표선우",
      gender: "남",
      stuMajor: "소프트웨어융합 (정보보안·블록체인)",
      track: "자연계열",
      grade5: 1.90,
      grade9: 2.18,
      mockExam: "3합 8 (국3 수2 영2)",
      targetUni1: "세종대 정보보호학과 · 2.10 [소신]",
      targetUni2: "단국대 소프트웨어전공 · 2.25 [적정]",
      targetUni3: "성신여대 융합보안공학 · 2.35 [안정]",
      status: "작성중",
      existingSetuk: "RSA 공개키 암호화 알고리즘의 소인수분해 난해성 원리를 합동식과 페르마의 소정리로 수학적으로 증명하고 파이썬으로 256비트 암복호화 프로그램을 시연함.",
      subject: "공통수학1",
      homeroomOpinion: "정보 윤리 의식이 투철하며, 학급 내 사이버 폭력 예방 교육 시 알기 쉬운 프레젠테이션으로 동료들의 경각심을 일깨움."
    },
    {
      id: "rec_10124",
      stuNumber: "10124",
      stuName: "하지민",
      gender: "여",
      stuMajor: "심리학과 (인지신경심리·소비자심리)",
      track: "인문사회",
      grade5: 1.80,
      grade9: 2.10,
      mockExam: "3합 7 (국2 영2 사2)",
      targetUni1: "성신여대 심리학과 · 2.05 [적정]",
      targetUni2: "덕성여대 심리학전공 · 2.20 [안정]",
      targetUni3: "광운대 산업심리학과 · 2.30 [안정]",
      status: "1차완료",
      existingSetuk: "스트룹 효과(Stroop Effect) 실험을 직접 설계하여 자동적 인지 과정과 의식적 통제 과정 간의 간섭 현상을 통계적으로 검증하고 주의 집중 훈련 방안을 제시함.",
      subject: "통합과학",
      homeroomOpinion: "타인의 감정을 민감하게 파악하고 따뜻한 위로를 건넬 줄 아는 또래 상담자로서, 학급 내 갈등 중재에 탁월한 역할을 수행함."
    },
    {
      id: "rec_10125",
      stuNumber: "10125",
      stuName: "황보경",
      gender: "여",
      stuMajor: "영어영문학과 (영미문화·통번역)",
      track: "인문사회",
      grade5: 2.45,
      grade9: 2.75,
      mockExam: "3합 9 (국3 영1 사3)",
      targetUni1: "명지대 영어영문학과 · 2.60 [적정]",
      targetUni2: "상명대 한일문화콘텐츠 · 2.75 [안정]",
      targetUni3: "동덕여대 영어전공 · 2.85 [안정]",
      status: "대기",
      existingSetuk: "셰익스피어 4대 비극에 나타난 운명관과 르네상스 인문주의 사상의 충돌을 텍스트의 수사학적 비유를 중심으로 정밀 독해하고 현대적 가치로 재해석함.",
      subject: "영어",
      homeroomOpinion: "원어민 수준의 어학 능력과 유창한 발표력을 갖추었으며, 다문화 가정 멘토링 활동에 주도적으로 참여하여 온정을 나눔."
    },
    {
      id: "rec_10126",
      stuNumber: "10126",
      stuName: "남궁건",
      gender: "남",
      stuMajor: "지구환경과학 (해양기후·극지탐사)",
      track: "자연계열",
      grade5: 2.60,
      grade9: 2.90,
      mockExam: "3합 10 (수3 영3 탐3)",
      targetUni1: "인천대 해양학과 · 2.75 [적정]",
      targetUni2: "군산대 해양바이오학부 · 3.00 [안정]",
      targetUni3: "전남대 지구환경과학부 · 2.95 [안정]",
      status: "작성중",
      existingSetuk: "엘니뇨·라니냐 현상 발생 시 열대 태평양의 기압 배치와 워커 순환 변화를 기상 위성 데이터로 추적하고 한반도 기상이변과의 통계적 연관성을 규명함.",
      subject: "통합과학",
      homeroomOpinion: "지구과학 분야에 깊은 열정을 쏟으며, 묵묵하고 진중한 태도로 맡은 바 책임을 끝까지 완수하는 신뢰감 높은 학생임."
    },
    {
      id: "rec_10127",
      stuNumber: "10127",
      stuName: "도유찬",
      gender: "남",
      stuMajor: "역사교육과 (한국근현대사·사료비판)",
      track: "사범계열",
      grade5: 2.30,
      grade9: 2.60,
      mockExam: "3합 8 (국2 영3 사2)",
      targetUni1: "충남대 국사학과 · 2.45 [적정]",
      targetUni2: "전북대 사학과 · 2.60 [안정]",
      targetUni3: "순천향대 한국문화학과 · 2.80 [안정]",
      status: "1차완료",
      existingSetuk: "일제강점기 1920년대 산미증식계획의 수탈적 성격을 조선총독부 통계연보와 당시 농민 생계 지표의 비교 사료 비판을 통해 역사적 진실을 논리정연하게 규명함.",
      subject: "한국사",
      homeroomOpinion: "올바른 역사관을 정립하기 위해 방대한 사료를 비판적으로 검토하며, 역사적 사실을 알기 쉽게 설명해 급우들의 역사 흥미를 고취함."
    },
    {
      id: "rec_10128",
      stuNumber: "10128",
      stuName: "민설아",
      gender: "여",
      stuMajor: "식품영양학과 (임상영양·메디컬푸드)",
      track: "자연계열",
      grade5: 2.15,
      grade9: 2.42,
      mockExam: "3합 9 (국3 수2 영2)",
      targetUni1: "가천대 식품영양학과 · 2.35 [적정]",
      targetUni2: "서울여대 식품영양학전공 · 2.45 [안정]",
      targetUni3: "동덕여대 응용화학식품 · 2.55 [안정]",
      status: "대기",
      existingSetuk: "마이야르 반응과 캐러멜화 반응의 반응 속도론적 차이를 온도별 실험을 통해 분석하고 환원당과 아미노산 조합에 따른 최종 당화산물(AGEs) 생성 억제 방안을 모색함.",
      subject: "통합과학",
      homeroomOpinion: "식습관 개선과 건강 증진에 깊은 관심을 가지고 급식 모니터링단으로 활약하였으며, 배려심 깊은 태도로 동료들에게 긍정적 에너지를 전파함."
    },
    {
      id: "rec_10129",
      stuNumber: "10129",
      stuName: "신우진",
      gender: "남",
      stuMajor: "도시공학과 (스마트모빌리티·교통계획)",
      track: "자연계열",
      grade5: 2.40,
      grade9: 2.68,
      mockExam: "3합 10 (수3 영3 탐3)",
      targetUni1: "홍익대 도시공학과 · 2.50 [소신]",
      targetUni2: "중앙대 도시시스템공학 · 2.60 [적정]",
      targetUni3: "가천대 도시계획학과 · 2.75 [안정]",
      status: "작성중",
      existingSetuk: "도심 교통 혼잡 구간의 병목 현상을 유체역학적 연속 방정식과 결합하여 모델링하고 대중교통 우선 신호 체계 도입 시 통행시간 단축 효과를 시뮬레이션함.",
      subject: "공통수학1",
      homeroomOpinion: "도시 문제 해결에 혁신적인 시각을 제시하며, 학급 내 안전지킴이 역할을 충실히 수행하여 안전사고 예방에 크게 기여함."
    },
    {
      id: "rec_10130",
      stuNumber: "10130",
      stuName: "진하랑",
      gender: "여",
      stuMajor: "치의예과 (구강생체재료·조직재생)",
      track: "의약학",
      grade5: 1.15,
      grade9: 1.30,
      mockExam: "3합 4 (국1 수1 영1 탐1)",
      targetUni1: "서울대 치의학과 (일반) · 1.20 [소신]",
      targetUni2: "연세대 치의예과 (활동우수) · 1.25 [적정]",
      targetUni3: "경희대 치의예과 (네오) · 1.32 [안정]",
      status: "수시확정",
      existingSetuk: "치아 법랑질의 하이드록시아파타이트 결정 구조와 산성 환경에서의 탈회 메커니즘을 화학평형 법칙으로 해석하고, 불소 도포에 의한 플루오르아파타이트 전환 내산성 강화 기전을 규명함.",
      subject: "통합과학",
      homeroomOpinion: "탁월한 학업 지능과 섬세한 손재주를 겸비하였으며, 타인을 위해 헌신할 줄 아는 성품으로 학급 봉사활동 시간을 가장 많이 기록한 최고의 모범생임."
    }
  ];

  // 2. 교과교사용 관찰 메모 및 1,500 Byte 3단 세특 초안 (30명)
  const MOCK_SUBJECT_30 = MOCK_HOMEROOM_30.map((s, idx) => {
    return {
      id: s.stuNumber,
      no: String(idx + 1),
      name: s.stuName,
      hope: s.stuMajor,
      subject: s.subject || "공통수학1",
      memo: `수행평가 보고서: [${s.stuMajor} 연계 탐구]. 수업 중 능동적인 질문과 논리적 가설 검증 과정이 매우 우수하며 정량적 데이터 분석 능력이 탁월함.`,
      tags: "가설검증실험, 정량데이터분석, 논리적사고, 문제해결우수",
      draft: s.existingSetuk,
      updatedAt: "2026-11-04 18:00"
    };
  });

  // 전역 노출
  window.MOCK_CLASS_30_HOMEROOM = MOCK_HOMEROOM_30;
  window.MOCK_CLASS_30_SUBJECT = MOCK_SUBJECT_30;

  // 30명 모의 학급 데이터 1초 전역 로드 함수
  window.load30StudentsRelationalData = function() {
    // 1. 진학상담(counsel.js) 학생 명렬에 30명 주입
    if (window.Counsel && typeof window.Counsel.setCustomStudents === 'function') {
      window.Counsel.setCustomStudents(MOCK_HOMEROOM_30);
    } else {
      window.CUSTOM_COUNSEL_STUDENTS = MOCK_HOMEROOM_30;
    }

    // 2. 교과교사용 모바일 교무수첩(notebook.js) 1반에 30명 주입
    if (window.Notebook) {
      if (!window.Notebook.data) window.Notebook.data = {};
      window.Notebook.data['1'] = JSON.parse(JSON.stringify(MOCK_SUBJECT_30));
      window.Notebook.currentClass = '1';
      window.Notebook.saveLocalData();
      if (typeof window.Notebook.renderStudentList === 'function') {
        window.Notebook.renderStudentList();
      }
    }

    // 3. UI 갱신 이벤트 발생
    window.dispatchEvent(new CustomEvent('mockStudentsLoaded', { detail: { count: 30 } }));

    // 4. 토스트 알림
    const toast = document.getElementById('toast');
    if (toast) {
      toast.textContent = '🎉 1학년 1반 30명 모의 학급 데이터(담임+교과)가 1초 만에 로드되었습니다!';
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 3000);
    } else {
      alert('🎉 1학년 1반 30명 모의 학급 데이터(담임+교과)가 로드되었습니다!');
    }
  };

  // 30명 모의 학급 미리보기 렌더링 함수 전역 등록
  window.renderMock30Table = function() {
    const tbody = document.getElementById('tbodyMock30Preview');
    if (!tbody || !window.MOCK_CLASS_30_HOMEROOM) return;
    tbody.innerHTML = window.MOCK_CLASS_30_HOMEROOM.map(s => `
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:7px 10px; font-family:monospace; font-weight:700;">${s.stuNumber}</td>
        <td style="padding:7px 10px; font-weight:800; color:#0f172a;">${s.stuName}</td>
        <td style="padding:7px 10px; color:#2563eb;">${s.stuMajor}</td>
        <td style="padding:7px 10px; color:#059669; font-weight:700;">${s.grade5}</td>
        <td style="padding:7px 10px; color:#64748b;">${s.grade9}</td>
        <td style="padding:7px 10px; font-size:11.5px;">${s.targetUni1 || '-'}</td>
        <td style="padding:7px 10px; font-weight:600;">${s.subject || '공통수학1'}</td>
        <td style="padding:7px 10px; font-size:11px; color:#475569; max-width:280px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${s.existingSetuk}">${s.existingSetuk}</td>
      </tr>
    `).join('');
  };

  // 30명 엑셀 다운로드 바인딩
  document.addEventListener('DOMContentLoaded', () => {
    const btnEx = document.getElementById('btnPreviewDownloadExcel');
    if (btnEx) {
      btnEx.addEventListener('click', () => {
        if (window.GoogleSheet && typeof window.GoogleSheet.downloadRelationalExcel === 'function') {
          window.GoogleSheet.downloadRelationalExcel();
        } else {
          alert('엑셀 생성 모듈을 준비 중입니다.');
        }
      });
    }
  });

})();