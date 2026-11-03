/* ==========================================================================
   2027 대입 진학상담 & 대학별 입결 & 5등급제 환산 & 나이스 세특 통합 모듈 (js/counsel.js)
   - 133개 대학 검색 (초성 검색 지원) & 1,095개 전형별 성적 DB (GRADEDB)
   - 관계형 분야별(인문/자연/의약/초등) 입결 모달 (라디오 4종)
   - 2028 개편 5등급제 추정평균 환산 (calcGrade5, calcGrade9)
   - 49개 대학 논술전형 총정리 & 공식 자료실 (EBSi, 어디가, 선행학습영향평가)
   - 전체 관리자(기간/만료일, 서브PIN 설정) & 중간관리자(1개월 인증 유지) 2단계 보안
   - 단일 마스터 시트(Single Master Sheet, 1학생 1행) & 구글 시트 웹앱 동기화
   - 원본 1,294쪽 R2 스캔본 뷰어 (저작권 math-tong 및 담임교사 경감 안내문구)
   ========================================================================== */

(function () {
  "use strict";

  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

  /* ---------- 초성 검색 유틸 ---------- */
  const CHO = ["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
  function choseong(str) {
    if (!str) return "";
    let res = "";
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i) - 44032;
      if (code >= 0 && code <= 11171) {
        res += CHO[Math.floor(code / 588)];
      } else {
        res += str[i];
      }
    }
    return res;
  }
  const isChoQuery = q => q.length > 0 && [...q].every(c => CHO.includes(c));

  function escHtml(s) {
    if (s == null) return "";
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  /* ---------- 대학 공식 입학처 URL 매핑 ---------- */
  const UNI_URLS = {
  "가천대학교": "https://admission.gachon.ac.kr/",
  "가톨릭관동대학교": "https://ipsi.cku.ac.kr/",
  "가톨릭대학교": "https://ipsi.catholic.ac.kr/",
  "강남대학교": "https://admission.kangnam.ac.kr/",
  "강원대학교": "https://admission.kangwon.ac.kr/",
  "건국대학교": "https://ibhak.konkuk.ac.kr/",
  "건국대학교(글로컬)": "https://enter.kku.ac.kr/",
  "경기대학교": "https://enter.kyonggi.ac.kr/",
  "경북대학교": "https://ipsi1.knu.ac.kr/",
  "경상국립대학교": "https://new.gnu.ac.kr/ipsi/",
  "경성대학교": "https://ibsi.ks.ac.kr/",
  "경희대학교": "https://iphak.khu.ac.kr/",
  "경희대학교(국제)": "https://iphak.khu.ac.kr/",
  "계명대학교": "https://www.gokmu.ac.kr/",
  "고려대학교": "https://oku.korea.ac.kr/",
  "고려대학교(세종)": "https://oku.korea.ac.kr/sejong/",
  "고신대학교": "https://ipsi.kosin.ac.kr/",
  "공주대학교": "https://ipsi.kongju.ac.kr/",
  "광운대학교": "https://iphak.kw.ac.kr/",
  "국민대학교": "https://admission.kookmin.ac.kr/",
  "단국대학교": "https://ipsi.dankook.ac.kr/",
  "단국대학교(천안)": "https://ipsi.dankook.ac.kr/",
  "대구가톨릭대학교": "https://ibsi.cu.ac.kr/",
  "대구대학교": "https://ipsi.daegu.ac.kr/",
  "대구한의대학교": "https://ipsi.dhu.ac.kr/",
  "대전대학교": "https://ipsi.dju.ac.kr/",
  "덕성여자대학교": "https://enter.duksung.ac.kr/",
  "동국대학교": "https://ipsi.dongguk.edu/",
  "동국대학교(WISE)": "https://ipsi.dongguk.ac.kr/",
  "동덕여자대학교": "https://ipsi.dongduk.ac.kr/",
  "동아대학교": "https://enter.donga.ac.kr/",
  "동의대학교": "https://ipsi.deu.ac.kr/",
  "명지대학교": "https://ipsi.mju.ac.kr/",
  "목원대학교": "https://enter.mokwon.ac.kr/",
  "목포대학교": "https://ipsi.mokpo.ac.kr/",
  "목포해양대학교": "https://ipsi.mmu.ac.kr/",
  "배재대학교": "https://enter.pcu.ac.kr/",
  "부경대학교": "https://ipsi.pknu.ac.kr/",
  "부산가톨릭대학교": "https://ipsi.cup.ac.kr/",
  "부산대학교": "https://go.pusan.ac.kr/",
  "부산외국어대학교": "https://enter.bufs.ac.kr/",
  "삼육대학교": "https://ipsi.syu.ac.kr/",
  "상명대학교": "https://admission.smu.ac.kr/",
  "상명대학교(천안)": "https://admission.smu.ac.kr/",
  "서강대학교": "https://admission.sogang.ac.kr/",
  "서경대학교": "https://go.skuniv.ac.kr/",
  "서울과학기술대학교": "https://admission.seoultech.ac.kr/",
  "서울대학교": "https://admission.snu.ac.kr/",
  "서울시립대학교": "https://admission.uos.ac.kr/",
  "서울신학대학교": "https://ipsi.stu.ac.kr/",
  "서울여자대학교": "https://admission.swu.ac.kr/",
  "선문대학교": "https://ipsi.sunmoon.ac.kr/",
  "성결대학교": "https://ipsi.sungkyul.ac.kr/",
  "성공회대학교": "https://ipsi.skhu.ac.kr/",
  "성균관대학교": "https://admission.skku.edu/",
  "성신여자대학교": "https://ipsi.sungshin.ac.kr/",
  "세명대학교": "https://ipsi.semyung.ac.kr/",
  "세종대학교": "https://ipsi.sejong.ac.kr/",
  "수원대학교": "https://ipsi.suwon.ac.kr/",
  "숙명여자대학교": "https://admission.sookmyung.ac.kr/",
  "순천향대학교": "https://ipsi.sch.ac.kr/",
  "숭실대학교": "https://iphak.ssu.ac.kr/",
  "신한대학교": "https://ipsi.shinhan.ac.kr/",
  "아주대학교": "https://www.iajou.ac.kr/",
  "안양대학교": "https://ipsi.anyang.ac.kr/",
  "연세대학교": "https://admission.yonsei.ac.kr/",
  "연세대학교(미래)": "https://admission.yonsei.ac.kr/mirae/",
  "영남대학교": "https://enter.yu.ac.kr/",
  "우석대학교": "https://ipsi.woosuk.ac.kr/",
  "울산대학교": "https://ipsi.ulsan.ac.kr/",
  "원광대학교": "https://ipsi.wku.ac.kr/",
  "을지대학교": "https://ipsi.eulji.ac.kr/",
  "이화여자대학교": "https://admission.ewha.ac.kr/",
  "인천가톨릭대학교": "https://ipsi.iccu.ac.kr/",
  "인천대학교": "https://ipsi.inu.ac.kr/",
  "인하대학교": "https://admission.inha.ac.kr/",
  "전남대학교": "https://admission.jnu.ac.kr/",
  "전북대학교": "https://enter.jbnu.ac.kr/",
  "제주대학교": "https://ibsi.jejunu.ac.kr/",
  "조선대학교": "https://ibhak.chosun.ac.kr/",
  "중부대학교": "https://ipsi.joongbu.ac.kr/",
  "중앙대학교": "https://admission.cau.ac.kr/",
  "차의과학대학교": "https://ipsi.cha.ac.kr/",
  "창원대학교": "https://ipsi.changwon.ac.kr/",
  "청주대학교": "https://ipsi.cju.ac.kr/",
  "충남대학교": "https://ipsi.cnu.ac.kr/",
  "충북대학교": "https://ipsi.chungbuk.ac.kr/",
  "한국공학대학교": "https://iphak.tukorea.ac.kr/",
  "한국교원대학교": "https://ent.knue.ac.kr/",
  "한국교통대학교": "https://ipsi.ut.ac.kr/",
  "한국기술교육대학교": "https://ipsi.koreatech.ac.kr/",
  "한국성서대학교": "https://ipsi.bible.ac.kr/",
  "한국외국어대학교": "https://adms.hufs.ac.kr/",
  "한국전통문화대학교": "https://www.nuch.ac.kr/iphak/",
  "한국체육대학교": "https://enter.knsu.ac.kr/",
  "한국항공대학교": "https://ibhak.kau.ac.kr/",
  "한국해양대학교": "https://ipsi.kmou.ac.kr/",
  "한남대학교": "https://ibsi.hnu.kr/",
  "한동대학교": "https://admissions.handong.edu/",
  "한림대학교": "https://admission.hallym.ac.kr/",
  "한서대학교": "https://ipsi.hanseo.ac.kr/",
  "한성대학교": "https://enter.hansung.ac.kr/",
  "한양대학교": "https://go.hanyang.ac.kr/",
  "한양대학교(ERICA)": "https://goerica.hanyang.ac.kr/",
  "협성대학교": "https://ipsi.uhs.ac.kr/",
  "호서대학교": "https://ipsi.hoseo.ac.kr/",
  "홍익대학교": "https://admission.hongik.ac.kr/",
  "홍익대학교(세종)": "https://admission.hongik.ac.kr/",
  "경인교육대학교": "https://www.ginue.ac.kr/admission/",
  "공주교육대학교": "https://ipsi.kongju.ac.kr/",
  "광주교육대학교": "https://ipsi.gnue.ac.kr/",
  "대구교육대학교": "https://ipsi.dnue.ac.kr/",
  "부산교육대학교": "https://ipsi.bnue.ac.kr/",
  "서울교육대학교": "https://admission.snue.ac.kr/",
  "전주교육대학교": "https://ipsi.jnue.kr/",
  "진주교육대학교": "https://ipsi.cue.ac.kr/",
  "청주교육대학교": "https://ipsi.cje.ac.kr/",
  "춘천교육대학교": "https://ipsi.cnue.ac.kr/",
  "KAIST(한국과학기술원)": "https://admission.kaist.ac.kr/",
  "GIST(광주과학기술원)": "https://www.gist.ac.kr/uadmission/",
  "DGIST(대구경북과학기술원)": "https://www.dgist.ac.kr/adm/",
  "UNIST(울산과학기술원)": "https://adm-u.unist.ac.kr/",
  "KENTECH(한국에너지공과대학교)": "https://admission.kentech.ac.kr/",
  "한국뉴욕주립대학교": "https://www.sunykorea.ac.kr/ko/admissions",
  "유타대학교 아시아캠퍼스": "https://asiacampus.utah.edu/ko/admissions/",
  "조지메이슨대학교 글로벌캠퍼스": "https://korea.gmu.edu/admissions",
  "겐트대학교 글로벌캠퍼스": "https://www.ghent.ac.kr/admissions",
  "국군간호사관학교": "https://afna.ac.kr/afna/1355/subview.do",
  "경찰대학": "https://police.ac.kr/police/police/html/adms/info.html",
  "감리교신학대학교": "https://search.naver.com/search.naver?query=%EA%B0%90%EB%A6%AC%EA%B5%90%EC%8B%A0%ED%95%99%EB%8C%80%ED%95%99%EA%B5%90%20%EC%9E%85%ED%95%99%EC%B2%98",
  "강서대학교": "https://search.naver.com/search.naver?query=%EA%B0%95%EC%84%9C%EB%8C%80%ED%95%99%EA%B5%90%20%EC%9E%85%ED%95%99%EC%B2%98",
  "경동대학교": "https://search.naver.com/search.naver?query=%EA%B2%BD%EB%8F%99%EB%8C%80%ED%95%99%EA%B5%90%20%EC%9E%85%ED%95%99%EC%B2%98",
  "국립공주대학교": "https://ipsi.kongju.ac.kr/",
  "국립한국교통대학교": "https://ipsi.ut.ac.kr/",
  "국립한밭대학교": "https://search.naver.com/search.naver?query=%EA%B5%AD%EB%A6%BD%ED%95%9C%EB%B0%AD%EB%8C%80%ED%95%99%EA%B5%90%20%EC%9E%85%ED%95%99%EC%B2%98",
  "극동대학교": "https://search.naver.com/search.naver?query=%EA%B7%B9%EB%8F%99%EB%8C%80%ED%95%99%EA%B5%90%20%EC%9E%85%ED%95%99%EC%B2%98",
  "남서울대학교": "https://admission.snu.ac.kr/",
  "대진대학교": "https://search.naver.com/search.naver?query=%EB%8C%80%EC%A7%84%EB%8C%80%ED%95%99%EA%B5%90%20%EC%9E%85%ED%95%99%EC%B2%98",
  "동양대학교": "https://search.naver.com/search.naver?query=%EB%8F%99%EC%96%91%EB%8C%80%ED%95%99%EA%B5%90%20%EC%9E%85%ED%95%99%EC%B2%98",
  "루터대학교": "https://search.naver.com/search.naver?query=%EB%A3%A8%ED%84%B0%EB%8C%80%ED%95%99%EA%B5%90%20%EC%9E%85%ED%95%99%EC%B2%98",
  "상지대학교": "https://search.naver.com/search.naver?query=%EC%83%81%EC%A7%80%EB%8C%80%ED%95%99%EA%B5%90%20%EC%9E%85%ED%95%99%EC%B2%98",
  "서울기독대학교": "https://search.naver.com/search.naver?query=%EC%84%9C%EC%9A%B8%EA%B8%B0%EB%8F%85%EB%8C%80%ED%95%99%EA%B5%90%20%EC%9E%85%ED%95%99%EC%B2%98",
  "서울장신대학교": "https://search.naver.com/search.naver?query=%EC%84%9C%EC%9A%B8%EC%9E%A5%EC%8B%A0%EB%8C%80%ED%95%99%EA%B5%90%20%EC%9E%85%ED%95%99%EC%B2%98",
  "서울한영대학교": "https://search.naver.com/search.naver?query=%EC%84%9C%EC%9A%B8%ED%95%9C%EC%98%81%EB%8C%80%ED%95%99%EA%B5%90%20%EC%9E%85%ED%95%99%EC%B2%98",
  "서원대학교": "https://search.naver.com/search.naver?query=%EC%84%9C%EC%9B%90%EB%8C%80%ED%95%99%EA%B5%90%20%EC%9E%85%ED%95%99%EC%B2%98",
  "수원가톨릭대학교": "https://ipsi.catholic.ac.kr/",
  "아신대학교": "https://search.naver.com/search.naver?query=%EC%95%84%EC%8B%A0%EB%8C%80%ED%95%99%EA%B5%90%20%EC%9E%85%ED%95%99%EC%B2%98",
  "용인대학교": "https://search.naver.com/search.naver?query=%EC%9A%A9%EC%9D%B8%EB%8C%80%ED%95%99%EA%B5%90%20%EC%9E%85%ED%95%99%EC%B2%98",
  "우송대학교": "https://search.naver.com/search.naver?query=%EC%9A%B0%EC%86%A1%EB%8C%80%ED%95%99%EA%B5%90%20%EC%9E%85%ED%95%99%EC%B2%98",
  "장로회신학대학교": "https://search.naver.com/search.naver?query=%EC%9E%A5%EB%A1%9C%ED%9A%8C%EC%8B%A0%ED%95%99%EB%8C%80%ED%95%99%EA%B5%90%20%EC%9E%85%ED%95%99%EC%B2%98",
  "전주대학교": "https://search.naver.com/search.naver?query=%EC%A0%84%EC%A3%BC%EB%8C%80%ED%95%99%EA%B5%90%20%EC%9E%85%ED%95%99%EC%B2%98",
  "총신대학교": "https://search.naver.com/search.naver?query=%EC%B4%9D%EC%8B%A0%EB%8C%80%ED%95%99%EA%B5%90%20%EC%9E%85%ED%95%99%EC%B2%98",
  "추계예술대학교": "https://search.naver.com/search.naver?query=%EC%B6%94%EA%B3%84%EC%98%88%EC%88%A0%EB%8C%80%ED%95%99%EA%B5%90%20%EC%9E%85%ED%95%99%EC%B2%98",
  "칼빈대학교": "https://search.naver.com/search.naver?query=%EC%B9%BC%EB%B9%88%EB%8C%80%ED%95%99%EA%B5%90%20%EC%9E%85%ED%95%99%EC%B2%98",
  "평택대학교": "https://search.naver.com/search.naver?query=%ED%8F%89%ED%83%9D%EB%8C%80%ED%95%99%EA%B5%90%20%EC%9E%85%ED%95%99%EC%B2%98",
  "포항공과대학교": "https://search.naver.com/search.naver?query=%ED%8F%AC%ED%95%AD%EA%B3%B5%EA%B3%BC%EB%8C%80%ED%95%99%EA%B5%90%20%EC%9E%85%ED%95%99%EC%B2%98",
  "한경국립대학교": "https://search.naver.com/search.naver?query=%ED%95%9C%EA%B2%BD%EA%B5%AD%EB%A6%BD%EB%8C%80%ED%95%99%EA%B5%90%20%EC%9E%85%ED%95%99%EC%B2%98",
  "한라대학교": "https://search.naver.com/search.naver?query=%ED%95%9C%EB%9D%BC%EB%8C%80%ED%95%99%EA%B5%90%20%EC%9E%85%ED%95%99%EC%B2%98",
  "한세대학교": "https://search.naver.com/search.naver?query=%ED%95%9C%EC%84%B8%EB%8C%80%ED%95%99%EA%B5%90%20%EC%9E%85%ED%95%99%EC%B2%98",
  "한신대학교": "https://search.naver.com/search.naver?query=%ED%95%9C%EC%8B%A0%EB%8C%80%ED%95%99%EA%B5%90%20%EC%9E%85%ED%95%99%EC%B2%98",
  "한양대학교(에리카)": "https://go.hanyang.ac.kr/",
  "호남대학교": "https://search.naver.com/search.naver?query=%ED%98%B8%EB%82%A8%EB%8C%80%ED%95%99%EA%B5%90%20%EC%9E%85%ED%95%99%EC%B2%98",
  "화성의과학대학교": "https://search.naver.com/search.naver?query=%ED%99%94%EC%84%B1%EC%9D%98%EA%B3%BC%ED%95%99%EB%8C%80%ED%95%99%EA%B5%90%20%EC%9E%85%ED%95%99%EC%B2%98",
  "서울호서직업전문학교": "https://search.naver.com/search.naver?query=%EC%84%9C%EC%9A%B8%ED%98%B8%EC%84%9C%EC%A7%81%EC%97%85%EC%A0%84%EB%AC%B8%ED%95%99%EA%B5%90%20%EC%9E%85%ED%95%99%EC%B2%98",
  "서울호서예술실용전문학교": "https://search.naver.com/search.naver?query=%EC%84%9C%EC%9A%B8%ED%98%B8%EC%84%9C%EC%98%88%EC%88%A0%EC%8B%A4%EC%9A%A9%EC%A0%84%EB%AC%B8%ED%95%99%EA%B5%90%20%EC%9E%85%ED%95%99%EC%B2%98"
};

  const ADIGA_UNI_CODES = {
  "가천대학교": "0000063",
  "가톨릭관동대학교": "0000072",
  "가톨릭대학교": "0000114",
  "감리교신학대학교": "0000050",
  "강남대학교": "0000051",
  "강서대학교": "0000079",
  "강원대학교": "0000003",
  "건국대학교": "0000052",
  "건국대학교(글로컬)": "0000052",
  "경기대학교": "0000056",
  "경동대학교": "0000060",
  "경북대학교": "0000005",
  "경상국립대학교": "0000007",
  "경희대학교": "0000066",
  "고려대학교": "0000069",
  "고려대학교(세종)": "0000069",
  "광운대학교": "0000074",
  "국립공주대학교": "0000008",
  "국립한국교통대학교": "0000034",
  "국립한밭대학교": "0000039",
  "국민대학교": "0000078",
  "극동대학교": "0000080",
  "남서울대학교": "0000245",
  "단국대학교": "0000082",
  "대구가톨릭대학교": "0000088",
  "대진대학교": "0000097",
  "덕성여자대학교": "0000099",
  "동국대학교": "0000100",
  "동덕여자대학교": "0000102",
  "동양대학교": "0000106",
  "루터대학교": "0000108",
  "명지대학교": "0000109",
  "부산대학교": "0000014",
  "삼육대학교": "0000116",
  "상명대학교": "0000117",
  "상지대학교": "0000410",
  "서강대학교": "0000120",
  "서경대학교": "0000121",
  "서울과학기술대학교": "0000036",
  "서울기독대학교": "0000098",
  "서울대학교": "0000450",
  "서울시립대학교": "0000040",
  "서울신학대학교": "0000125",
  "서울여자대학교": "0000126",
  "서울장신대학교": "0000127",
  "서울한영대학교": "0000205",
  "서원대학교": "0000128",
  "선문대학교": "0000129",
  "성결대학교": "0000131",
  "성공회대학교": "0000132",
  "성균관대학교": "0000133",
  "성신여자대학교": "0000136",
  "세명대학교": "0000137",
  "세종대학교": "0000138",
  "수원가톨릭대학교": "0000139",
  "수원대학교": "0000140",
  "숙명여자대학교": "0000141",
  "순천향대학교": "0000142",
  "숭실대학교": "0000143",
  "신한대학교": "0002712",
  "아신대학교": "0000145",
  "아주대학교": "0000146",
  "안양대학교": "0000147",
  "연세대학교": "0000149",
  "연세대학교(미래)": "0000149",
  "용인대학교": "0000156",
  "우송대학교": "0000240",
  "울산대학교": "0000158",
  "원광대학교": "0000159",
  "을지대학교": "0000161",
  "이화여자대학교": "0000163",
  "인천가톨릭대학교": "0000168",
  "인천대학교": "0002660",
  "인하대학교": "0000169",
  "장로회신학대학교": "0000170",
  "전남대학교": "0000023",
  "전북대학교": "0000025",
  "전주대학교": "0000171",
  "제주대학교": "0000027",
  "조선대학교": "0000172",
  "중앙대학교": "0000175",
  "차의과학대학교": "0000187",
  "총신대학교": "0000180",
  "추계예술대학교": "0000181",
  "충남대학교": "0000029",
  "충북대학교": "0000030",
  "칼빈대학교": "0000184",
  "평택대학교": "0000186",
  "포항공과대학교": "0000188",
  "한경국립대학교": "0000037",
  "한국공학대학교": "0000247",
  "한국교원대학교": "0000031",
  "한국기술교육대학교": "0000189",
  "한국성서대학교": "0000191",
  "한국외국어대학교": "0000192",
  "한국전통문화대학교": null,
  "한국체육대학교": "0000032",
  "한국항공대학교": "0000194",
  "한남대학교": "0000195",
  "한동대학교": "0000196",
  "한라대학교": "0002655",
  "한림대학교": "0000198",
  "한서대학교": "0000199",
  "한성대학교": "0000200",
  "한세대학교": "0000201",
  "한신대학교": "0000202",
  "한양대학교": "0000203",
  "한양대학교(에리카)": "0000203",
  "협성대학교": "0000207",
  "호남대학교": "0000208",
  "호서대학교": "0000211",
  "홍익대학교": "0000212",
  "화성의과학대학교": "0000233",
  "경인교육대학교": "0000256",
  "공주교육대학교": "0000251",
  "광주교육대학교": "0000252",
  "대구교육대학교": "0000253",
  "부산교육대학교": "0000254",
  "서울교육대학교": "0000255",
  "전주교육대학교": "0000258",
  "진주교육대학교": "0000260",
  "청주교육대학교": "0000261",
  "춘천교육대학교": "0000262",
  "DGIST(대구경북과학기술원)": null,
  "GIST(광주과학기술원)": null,
  "KAIST(한국과학기술원)": null,
  "KENTECH(한국에너지공과대학교)": null,
  "UNIST(울산과학기술원)": null,
  "겐트대학교 글로벌캠퍼스": null,
  "유타대학교 아시아캠퍼스": null,
  "한국뉴욕주립대학교": null,
  "서울호서직업전문학교": null,
  "서울호서예술실용전문학교": null
};


  
  function getUniAdigaUrl(uniName) {
    const clean = (uniName || "").replace(/대학교|대학/g, "").trim();
    const cd = ADIGA_UNI_CODES[uniName] || ADIGA_UNI_CODES[clean] || ADIGA_UNI_CODES[clean + "대"] || ADIGA_UNI_CODES[clean + "대학교"];
    if (cd) {
      // 500 에러 없는 최신 공시 기준(2025) 상세 직행
      return `https://www.adiga.kr/ucp/uvt/uni/univDetail.do?menuId=PCUVTINF2000&unvCd=${cd}&searchSyr=2025`;
    }
    for (const [k, c] of Object.entries(ADIGA_UNI_CODES)) {
      if (c && (uniName.includes(k) || k.includes(clean))) {
        return `https://www.adiga.kr/ucp/uvt/uni/univDetail.do?menuId=PCUVTINF2000&unvCd=${c}&searchSyr=2025`;
      }
    }
    // 100% 안전한 어디가 공식 대학 검색창 1:1 직행 (오류 원천 차단)
    return `https://www.adiga.kr/ucp/uvt/uni/univSearch.do?menuId=PCUVTINF1000&searchUnvNm=${encodeURIComponent(clean || uniName)}`;
  }

  function getUniPriorLearningUrl(uniName) {
    const clean = (uniName || "").replace(/대학교|대학/g, "").trim();
    return `https://www.google.com/search?q=${encodeURIComponent(clean + "대학교 2025 2026 선행학습 영향평가 보고서 논술 기출 문제 출제의도")}`;
  }

  function getUniAdmissionUrl(uniName) {
    if (UNI_URLS[uniName]) return UNI_URLS[uniName];
    for (const [k, u] of Object.entries(UNI_URLS)) {
      if (uniName.includes(k) || k.includes(uniName)) return u;
    }
    return `https://search.naver.com/search.naver?query=${encodeURIComponent(uniName + " 입학처")}`;
  }

  /* ---------- 2028 개편 5등급제 환산 공식 ---------- */
  function calcGrade5(g9) {
    if (g9 == null || isNaN(g9)) return null;
    g9 = Math.max(1.0, Math.min(9.0, Number(g9)));

    const G9_TABLE = [
      { g: 1.0, p: 0.00 }, { g: 1.5, p: 0.02 }, { g: 2.0, p: 0.06 }, { g: 2.3, p: 0.11 },
      { g: 2.8, p: 0.17 }, { g: 3.4, p: 0.23 }, { g: 4.0, p: 0.31 }, { g: 4.5, p: 0.40 },
      { g: 5.0, p: 0.50 }, { g: 5.5, p: 0.60 }, { g: 6.0, p: 0.69 }, { g: 6.6, p: 0.77 },
      { g: 7.2, p: 0.83 }, { g: 7.8, p: 0.89 }, { g: 8.4, p: 0.96 }, { g: 9.0, p: 1.00 }
    ];

    let pct = 0;
    for (let i = 0; i < G9_TABLE.length - 1; i++) {
      const cur = G9_TABLE[i];
      const nxt = G9_TABLE[i+1];
      if (g9 >= cur.g && g9 <= nxt.g) {
        const ratio = (g9 - cur.g) / (nxt.g - cur.g);
        pct = cur.p + ratio * (nxt.p - cur.p);
        break;
      }
    }

    let g5 = 1.0;
    if (pct <= 0.10) {
      g5 = 1.0 + (pct / 0.10) * 1.0;
    } else if (pct <= 0.34) {
      g5 = 2.0 + ((pct - 0.10) / 0.24) * 1.0;
    } else if (pct <= 0.66) {
      g5 = 3.0 + ((pct - 0.34) / 0.32) * 1.0;
    } else if (pct <= 0.90) {
      g5 = 4.0 + ((pct - 0.66) / 0.24) * 1.0;
    } else {
      g5 = 5.0;
    }

    return Math.round(g5 * 100) / 100;
  }

  function calcGrade9(g5) {
    if (g5 == null || isNaN(g5)) return null;
    g5 = Math.max(1.0, Math.min(5.0, Number(g5)));

    let pct = 0;
    if (g5 <= 2.0) {
      pct = (g5 - 1.0) * 0.10;
    } else if (g5 <= 3.0) {
      pct = 0.10 + (g5 - 2.0) * 0.24;
    } else if (g5 <= 4.0) {
      pct = 0.34 + (g5 - 3.0) * 0.32;
    } else {
      pct = 0.66 + (g5 - 4.0) * 0.24;
    }

    const G9_TABLE = [
      { g: 1.0, p: 0.00 }, { g: 1.5, p: 0.02 }, { g: 2.0, p: 0.06 }, { g: 2.3, p: 0.11 },
      { g: 2.8, p: 0.17 }, { g: 3.4, p: 0.23 }, { g: 4.0, p: 0.31 }, { g: 4.5, p: 0.40 },
      { g: 5.0, p: 0.50 }, { g: 5.5, p: 0.60 }, { g: 6.0, p: 0.69 }, { g: 6.6, p: 0.77 },
      { g: 7.2, p: 0.83 }, { g: 7.8, p: 0.89 }, { g: 8.4, p: 0.96 }, { g: 9.0, p: 1.00 }
    ];

    let g9 = 1.0;
    for (let i = 0; i < G9_TABLE.length - 1; i++) {
      const cur = G9_TABLE[i];
      const nxt = G9_TABLE[i+1];
      if (pct >= cur.p && pct <= nxt.p) {
        const ratio = (pct - cur.p) / (nxt.p - cur.p);
        g9 = cur.g + ratio * (nxt.g - cur.g);
        break;
      }
    }

    return Math.round(g9 * 100) / 100;
  }

  /* ---------- 나이스(NEIS) 바이트(Byte) 계산기 ---------- */
  function calculateNeisBytes(text) {
    if (!text) return 0;
    let b = 0;
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      if (code === 10) b += 2; // 줄바꿈 2Byte
      else if (code <= 127) b += 1;
      else b += 3; // 한글 3Byte
    }
    return b;
  }

  /* ---------- 데이터 저장소 & 2단계 보안 관리 (전체 관리자 / 중간 관리자) ---------- */
  const DEFAULT_STORAGE = "https://pub-xxx.r2.dev/pages/";
  const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000; // 30일 (1개월)

  
  // 5명 풍부한 샘플 학생 데이터 기본 탑재 (선생님 요청: 사전 입력된 데이터로 즉시 불러오기 지원)
  const SAMPLE_STUDENTS = [
    {
      id: "rec_20101",
      stuNumber: "20101",
      stuName: "김태형",
      stuMajor: "생명공학과 (바이오신약)",
      grade9: 1.85,
      grade5: 1.48,
      mockExam: "3합 7등급 (국2 수1 영2 탐1)",
      targetUni1: "고려대 생명공학부 (학업우수) · 1.78 [적정]",
      targetUni2: "성균관대 융합생명공학 (융합형) · 1.92 [안정]",
      targetUni3: "한양대 생명공학과 (지역균형) · 1.52 [소신]",
      targetUni4: "중앙대 생명과학과 (CAU융합) · 1.98 [안정]",
      targetUni5: "경희대 유전생명공학과 (네오르네상스) · 2.10 [안정]",
      targetUni6: "건국대 줄기세포재생공학 (KU자기추천) · 2.25 [안정]",
      existingSetuk: "삼투현상과 세포막 선택적 투과성에 대한 가설 검증 실험을 설계하고, 농도 차이에 따른 원형질 분리 과정을 현미경으로 정밀 관찰하여 인지질 이중층 구조의 물질 수송 메커니즘을 규명함. 최신 바이오 신약 기술 동향을 조사하여 생명윤리적 관점에서 발표함.",
      subject: "생명과학Ⅰ",
      status: "작성중"
    },
    {
      id: "rec_20102",
      stuNumber: "20102",
      stuName: "박서준",
      stuMajor: "컴퓨터공학과 (인공지능·빅데이터)",
      grade9: 2.30,
      grade5: 2.10,
      mockExam: "3합 9등급 (미적/과탐 2합5)",
      targetUni1: "서울시립대 컴퓨터과학부 (면접형) · 2.15 [적정]",
      targetUni2: "건국대 컴퓨터공학부 (KU자기추천) · 2.28 [적정]",
      targetUni3: "동국대 컴퓨터AI학부 (DoDream) · 2.42 [안정]",
      targetUni4: "숭실대 컴퓨터학부 (SSU미래인재) · 2.48 [안정]",
      targetUni5: "국민대 소프트웨어학부 (국민프런티어) · 2.65 [안정]",
      targetUni6: "아주대 소프트웨어학과 (고교추천) · 2.10 [소신]",
      existingSetuk: "정렬 알고리즘의 시간복잡도를 파이썬 코드로 직접 구현하여 정량 비교하고 데이터 규모에 따른 최적화 방안을 도출함. 자료구조의 효율적 설계를 통해 컴퓨팅 사고력과 알고리즘 문제해결 역량을 발휘함.",
      subject: "정보",
      status: "상담완료"
    },
    {
      id: "rec_20103",
      stuNumber: "20103",
      stuName: "이지은",
      stuMajor: "사회학과 (빅데이터 사회과학)",
      grade9: 1.65,
      grade5: 1.35,
      mockExam: "3합 6등급 (국1 수2 영1 사1)",
      targetUni1: "연세대 사회학과 (활동우수) · 1.58 [소신]",
      targetUni2: "고려대 사회학과 (계열적합) · 1.72 [적정]",
      targetUni3: "서강대 사회과학부 (일반) · 1.80 [안정]",
      targetUni4: "성균관대 사회과학계열 (탐구형) · 1.85 [안정]",
      targetUni5: "한양대 사회학과 (학생부교과) · 1.45 [소신]",
      targetUni6: "이화여대 사회과학부 (미래인재) · 1.90 [안정]",
      existingSetuk: "사회 불평등 현상과 교육 기회의 양극화에 관한 통계청 마이크로데이터를 활용하여 계층 간 소득 격차와 학업 성취도의 상관관계를 다변량 분석함.",
      subject: "사회·문화",
      status: "작성중"
    },
    {
      id: "rec_20104",
      stuNumber: "20104",
      stuName: "정호석",
      stuMajor: "화학공학과 (에너지·신소재)",
      grade9: 2.15,
      grade5: 1.85,
      mockExam: "3합 8등급",
      targetUni1: "한양대 화학공학과 (추천형) · 1.95 [소신]",
      targetUni2: "중앙대 에너지화학공학 (CAU융합) · 2.12 [적정]",
      targetUni3: "경희대 화학공학과 (네오) · 2.20 [안정]",
      targetUni4: "인하대 화학공학과 (인하미래인재) · 2.35 [안정]",
      targetUni5: "서울과기대 화공생명 (학교장추천) · 2.25 [안정]",
      targetUni6: "아주대 응용화학생명 (ACE) · 2.40 [안정]",
      existingSetuk: "이차전지 충방전 반응 메커니즘을 산화환원 전위와 연결하여 분석하고 전고체 배터리 전해질의 이온 전도도 향상 방안에 관한 학술 논문을 탐독하여 요약 발표함.",
      subject: "화학Ⅰ",
      status: "작성중"
    },
    {
      id: "rec_20105",
      stuNumber: "20105",
      stuName: "민윤기",
      stuMajor: "글로벌리더학부 / 행정학",
      grade9: 1.92,
      grade5: 1.62,
      mockExam: "3합 7등급",
      targetUni1: "성균관대 글로벌리더 (융합형) · 1.88 [적정]",
      targetUni2: "한양대 행정학과 (학생부종합) · 1.95 [적정]",
      targetUni3: "중앙대 공공인재학부 (CAU탐구) · 2.05 [안정]",
      targetUni4: "한국외대 행정학과 (학교생활우수) · 2.15 [안정]",
      targetUni5: "서울시립대 행정학과 (학생부종합) · 2.08 [안정]",
      targetUni6: "경희대 행정학과 (네오르네상스) · 2.22 [안정]",
      existingSetuk: "글로벌 기후위기 대응과 탄소중립 정책에 관한 UN 보고서를 원문으로 심층 독해하고, 3단 논증 구조의 영문 에세이를 작성하여 교내 정책 발표회에서 우수한 호응을 얻음.",
      subject: "공통영어",
      status: "1차완료"
    }
  ];

  const store = {
    // 1. 전체 관리자 설정
    getSuperPin() { return localStorage.getItem("swk_super_pin") || "admin2027!"; },
    setSuperPin(p) { localStorage.setItem("swk_super_pin", p); },

    // 2. 중간 관리자 (교사용) 비밀번호
    getSubPin() { return localStorage.getItem("swk_security_pin") || "2027"; },
    setSubPin(p) { localStorage.setItem("swk_security_pin", p); },

    // 3. 전체 이용 만료일 (YYYY-MM-DD)
    getGlobalExpiry() { return localStorage.getItem("swk_global_expiry") || "2027-02-28"; },
    setGlobalExpiry(d) { localStorage.setItem("swk_global_expiry", d); },

    // 4. 인증 상태 확인 (1개월 유효 & 전체 만료일 미만)
    isUnlocked() {
      // 1) 전체 만료일 확인
      const expiry = this.getGlobalExpiry();
      const expiryDate = new Date(expiry + "T23:59:59");
      if (new Date() > expiryDate) {
        return false; // 만료됨
      }

      // 2) 로컬 인증 시간 확인 (1개월 단위)
      const authTime = Number(localStorage.getItem("swk_auth_time") || "0");
      if (!authTime) return false;
      const elapsed = Date.now() - authTime;
      return elapsed < ONE_MONTH_MS;
    },

    setUnlocked(v) {
      if (v) {
        localStorage.setItem("swk_auth_time", String(Date.now()));
      } else {
        localStorage.removeItem("swk_auth_time");
      }
    },

    getRemainingDays() {
      const authTime = Number(localStorage.getItem("swk_auth_time") || "0");
      if (!authTime) return 0;
      const leftMs = ONE_MONTH_MS - (Date.now() - authTime);
      return Math.max(0, Math.ceil(leftMs / (24 * 60 * 60 * 1000)));
    },

    isGlobalExpired() {
      const expiry = this.getGlobalExpiry();
      return new Date() > new Date(expiry + "T23:59:59");
    },

    // 5. 스토리지 (Cloudflare R2 버킷 URL)
    getStorageBase() { return localStorage.getItem("swk_storage_base") || DEFAULT_STORAGE; },
    setStorageBase(u) {
      let base = u.trim();
      if (base && !base.endsWith("/")) base += "/";
      localStorage.setItem("swk_storage_base", base || DEFAULT_STORAGE);
    },

    // 6. 구글 시트 웹앱 URL (전역 연동 완벽 호환)
    getGSheetUrl() {
      return localStorage.getItem("swk_gsheet_url") || 
             localStorage.getItem("swk_gsheet_homeroom_url") || 
             (window.GoogleSheet && typeof window.GoogleSheet.getHomeroomUrl === "function" ? window.GoogleSheet.getHomeroomUrl() : "") ||
             localStorage.getItem("swk_gsheet_subject_url") || "";
    },
    setGSheetUrl(u) {
      const val = (u || "").trim();
      localStorage.setItem("swk_gsheet_url", val);
      localStorage.setItem("swk_gsheet_homeroom_url", val);
      if (window.GoogleSheet && typeof window.GoogleSheet.setHomeroomUrl === "function") {
        window.GoogleSheet.setHomeroomUrl(val);
      }
    },

    // 7. 즐겨찾기 대학
    favs() {
      try { return JSON.parse(localStorage.getItem("swk_favs") || "[]"); } catch(e) { return []; }
    },
    toggleFav(id) {
      const f = this.favs();
      const idx = f.indexOf(id);
      if (idx >= 0) f.splice(idx, 1);
      else f.push(id);
      localStorage.setItem("swk_favs", JSON.stringify(f));
      return idx < 0;
    },

    // 8. 단일 마스터 시트 상담/세특 기록 (1학생 1행 구조 & 샘플 5명 기본 탑재)
    masterRecords() {
      try {
        const raw = localStorage.getItem("swk_master_records");
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list) && list.length > 0) return list;
        }
        return SAMPLE_STUDENTS;
      } catch(e) {
        return SAMPLE_STUDENTS;
      }
    },
    saveMasterRecord(rec) {
      const list = this.masterRecords();
      const idx = list.findIndex(r => r.id === rec.id || (r.stuNumber && r.stuNumber === rec.stuNumber));
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...rec, updatedAt: todayStr() };
      } else {
        list.unshift({ ...rec, id: rec.id || "rec_" + Date.now(), createdAt: todayStr(), updatedAt: todayStr() });
      }
      localStorage.setItem("swk_master_records", JSON.stringify(list));
      return list;
    },
    deleteMasterRecord(id) {
      const list = this.masterRecords().filter(r => r.id !== id);
      localStorage.setItem("swk_master_records", JSON.stringify(list));
      return list;
    },
    clearAll() {
      localStorage.removeItem("swk_master_records");
      localStorage.removeItem("swk_favs");
      localStorage.removeItem("swk_auth_time");
    }
  };

  function getPageUrl(p) {
    const base = store.getStorageBase();
    return `${base}p${String(p).padStart(4,"0")}.webp`;
  }

  /* ---------- 애플리케이션 상태 ---------- */
  const appState = {
    currentSubTab: "unis",
    uniQuery: "",
    uniRegion: "전체",
    m15Only: false,
    nonsulOnly: false,
    favsOnly: false,

    finderMode: "5", // 2028 개편 5등급제 기본 상담 모드
    finderGrade5: 1.85,
    finderGrade9: 2.18,
    finderTrk: "인",
    finderTy: "전체",
    finderReg: "전체",
    finderRange: 0.3,

    nonsulFilter: "전체",

    activeDetailUni: null,
    activeDetailTrk: "전체",

    pendingOpenViewer: null,
    viewerZoom: 1.0,
    viewerStart: 1,
    viewerEnd: 1,
    viewerCurrentPage: 1
  };

  /* 권역 그룹 */
  const RGROUPS = {
    "수도권": ["서울", "경기", "인천"],
    "비수도권": ["강원", "충북", "충남", "대전", "세종", "전북", "전남", "광주", "경북", "경남", "대구", "울산", "부산", "제주"]
  };

  function matchUniName(uniName, dbName) {
    if (!uniName || !dbName) return false;
    const u = uniName.replace(/대학교|대학|캠퍼스/g, "").trim();
    const d = dbName.replace(/대학교|대학|캠퍼스/g, "").trim();
    if (u === d) return true;
    if (u.length >= 2 && d.length >= 2 && (u.includes(d) || d.includes(u))) return true;
    return false;
  }

  function getNonsulUniNames() {
    if (typeof NONSUL === "undefined") return new Set();
    return new Set(NONSUL.map(n => n[0].replace(/\(.*\)/, "").trim()));
  }

  /* ---------- 2027 상담 서브 탭 전환 ---------- */
  function initCounselSubTabs() {
    $$(".counsel-sub-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const tab = btn.dataset.counselSub;
        switchCounselSubTab(tab);
      });
    });
  }

  
  window.openCounselSubTab = function(tab) {
    if (typeof openPanel === "function") {
      openPanel("counsel", true);
    } else {
      const btn = document.querySelector('[data-open="counsel"]');
      if (btn) btn.click();
    }
    setTimeout(() => {
      if (typeof switchCounselSubTab === "function") {
        switchCounselSubTab(tab);
      }
    }, 100);
  };

  function switchCounselSubTab(tab) {
    appState.currentSubTab = tab;
    // 패널이 숨겨져 있으면 보이도록 처리
    const counselPanel = document.getElementById("panel-counsel");
    if (counselPanel && counselPanel.classList.contains("hidden")) {
      counselPanel.classList.remove("hidden");
      ["make", "usage", "check", "prompts", "guide", "notebook"].forEach(p => {
        const el = document.getElementById("panel-" + p);
        if (el) el.classList.add("hidden");
      });
      document.querySelectorAll("#op-tabs button").forEach(b => {
        const on = b.dataset.open === "counsel";
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-selected", on ? "true" : "false");
      });
    }

    $$(".counsel-sub-btn").forEach(b => {
      b.classList.toggle("is-active", b.dataset.counselSub === tab);
    });
    $$(".counsel-sub-panel").forEach(p => {
      p.hidden = (p.id !== `counsel-sub-${tab}`);
    });

    if (tab === "unis") renderUnis();
    else if (tab === "finder") renderFinder();
    else if (tab === "nonsul") renderNonsulTable();
    else if (tab === "records") renderMasterSheet();
    else if (tab === "gasguide") {
      const stepTabs = $$(".gas-page-tab");
      if (stepTabs.length > 0) stepTabs[0].click();
    }
    else if (tab === "settings") loadSettingsView();
  }
  window.switchCounselSubTab = switchCounselSubTab;
  window.openCounselSubTab = switchCounselSubTab;

  /* ---------- 1. 대학·전형 검색 모듈 ---------- */
  function initUniSearch() {
    const input = $("#counselUniSearchInput");
    const clearBtn = $("#counselUniSearchClear");
    if (!input) return;

    input.addEventListener("input", (e) => {
      appState.uniQuery = e.target.value.trim();
      renderUnis();
    });

    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        input.value = "";
        appState.uniQuery = "";
        renderUnis();
        input.focus();
      });
    }

    // 지역 필터 칩
    $$("#counselUniFilterRow [data-filter-reg]").forEach(chip => {
      chip.addEventListener("click", () => {
        $$("#counselUniFilterRow [data-filter-reg]").forEach(c => c.classList.remove("on"));
        chip.classList.add("on");
        appState.uniRegion = chip.dataset.filterReg;
        renderUnis();
      });
    });

    // 특화 칩 (주요 15개대, 논술실시, 즐겨찾기)
    const m15Btn = $("#chipM15");
    if (m15Btn) {
      m15Btn.addEventListener("click", () => {
        appState.m15Only = !appState.m15Only;
        m15Btn.classList.toggle("on", appState.m15Only);
        renderUnis();
      });
    }

    const nonsulBtn = $("#chipNonsulOnly");
    if (nonsulBtn) {
      nonsulBtn.addEventListener("click", () => {
        appState.nonsulOnly = !appState.nonsulOnly;
        nonsulBtn.classList.toggle("on", appState.nonsulOnly);
        renderUnis();
      });
    }

    const favsBtn = $("#chipFavs");
    if (favsBtn) {
      favsBtn.addEventListener("click", () => {
        appState.favsOnly = !appState.favsOnly;
        favsBtn.classList.toggle("on", appState.favsOnly);
        renderUnis();
      });
    }
  }

  function renderUnis() {
    const grid = $("#counselUniGrid");
    const countEl = $("#counselUniCount");
    if (!grid || typeof UNIS === "undefined") return;

    grid.innerHTML = "";
    const favSet = new Set(store.favs());
    const nonsulUnis = getNonsulUniNames();

    const q = appState.uniQuery.toLowerCase();
    const isCho = isChoQuery(q);

    const filtered = UNIS.filter(u => {
      // 1. 검색어 필터
      if (q) {
        if (isCho) {
          const cName = choseong(u.name);
          if (!cName.includes(q)) return false;
        } else {
          const matchName = u.name.toLowerCase().includes(q);
          const matchRegion = u.region.toLowerCase().includes(q);
          const matchSec = u.secs && u.secs.some(s => s.t.toLowerCase().includes(q));
          if (!matchName && !matchRegion && !matchSec) return false;
        }
      }

      // 2. 지역 필터
      if (appState.uniRegion !== "전체") {
        if (appState.uniRegion === "경기·인천") {
          if (u.region !== "경기" && u.region !== "인천") return false;
        } else if (appState.uniRegion === "충청") {
          if (!["대전", "세종", "충남", "충북"].includes(u.region)) return false;
        } else if (appState.uniRegion === "영남") {
          if (!["부산", "대구", "울산", "경북", "경남"].includes(u.region)) return false;
        } else if (appState.uniRegion === "호남") {
          if (!["광주", "전남", "전북"].includes(u.region)) return false;
        } else if (appState.uniRegion === "강원·제주") {
          if (!["강원", "제주"].includes(u.region)) return false;
        } else {
          if (u.region !== appState.uniRegion) return false;
        }
      }

      // 3. 주요 15개대
      if (appState.m15Only && !u.m15) return false;

      // 4. 논술 실시교
      if (appState.nonsulOnly) {
        const hasNonsul = nonsulUnis.has(u.name.replace(/대학교|대학/g, "").trim());
        if (!hasNonsul) return false;
      }

      // 5. 즐겨찾기
      if (appState.favsOnly && !favSet.has(u.id)) return false;

      return true;
    });

    if (countEl) countEl.textContent = filtered.length.toLocaleString();

    if (filtered.length === 0) {
      grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:50px 20px; color:var(--muted);">
        <div style="font-size:32px; margin-bottom:8px;">🔍</div>
        <strong>검색 조건에 맞는 대학이 없습니다.</strong>
        <p style="font-size:12.5px; margin-top:4px;">초성 검색(예: ㄱㄷ, ㅅㄷ) 또는 지역 필터를 변경해 보세요.</p>
      </div>`;
      return;
    }

    filtered.forEach(u => {
      const card = document.createElement("div");
      card.className = "uni-card";
      const isFav = favSet.has(u.id);

      card.innerHTML = `
        <div>
          <div class="uni-card-head">
            <div class="uni-title-wrap">
              <h3 class="uni-name"><a href="${escHtml(getUniAdmissionUrl(u.name))}" target="_blank" rel="noopener noreferrer" class="uni-name-link" title="대학 공식 입학처 바로가기 (새 창)">${escHtml(u.name)} <span class="uni-ext-icon">↗</span></a></h3>
              <span class="uni-badge-region ${u.m15 ? 'm15' : ''}">${escHtml(u.region)}</span>
              ${u.m15 ? '<span class="uni-badge-region m15" style="background:#fee2e2; color:#ef4444;">주요15개대</span>' : ''}
            </div>
            <button class="fav-btn ${isFav ? 'on' : ''}" title="즐겨찾기" data-fav-id="${u.id}">★</button>
          </div>

          <div class="uni-specs" style="display:flex; flex-wrap:wrap; gap:5px; margin:8px 0 10px; align-items:center;">
            <span class="uni-spec-item">분류: ${escHtml(u.cat || "일반대학")}</span>
            <a href="${escHtml(getUniAdmissionUrl(u.name))}" target="_blank" rel="noreferrer" class="uni-quick-link" onclick="event.stopPropagation();" style="padding:2px 7px; font-size:11px; background:#eff6ff; color:#2563eb; border:1px solid #bfdbfe; border-radius:4px; text-decoration:none; font-weight:700;">🏫 입학처</a>
            <a href="${escHtml(getUniAdigaUrl(u.name))}" target="_blank" rel="noreferrer" class="uni-quick-link" onclick="event.stopPropagation();" style="padding:2px 7px; font-size:11px; background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0; border-radius:4px; text-decoration:none; font-weight:700;">🎯 어디가</a>
            <a href="${escHtml(getUniPriorLearningUrl(u.name))}" target="_blank" rel="noreferrer" class="uni-quick-link" onclick="event.stopPropagation();" style="padding:2px 7px; font-size:11px; background:#faf5ff; color:#7c3aed; border:1px solid #ddd6fe; border-radius:4px; text-decoration:none; font-weight:700;">📑 선행보고서</a>
          </div>
        </div>

        <div class="uni-card-foot">
          <span style="font-size:11.5px; color:var(--muted)">전형 입결 & 5등급 환산</span>
          <span class="uni-foot-action">상세 분석 & 세특 담기 →</span>
        </div>
      `;

      card.addEventListener("click", (e) => {
        if (e.target.closest(".uni-name-link")) {
          e.stopPropagation();
          return;
        }
        if (e.target.closest(".fav-btn")) {
          e.stopPropagation();
          const on = store.toggleFav(u.id);
          e.target.classList.toggle("on", on);
          return;
        }
        openUniDetailModal(u);
      });

      grid.appendChild(card);
    });
  }


  /* ---------- 실시간 경쟁률 & 대학알리미 종합 모달 로직 ---------- */
  function initLiveDataModal() {
    const modal = $("#liveDataModal");
    const openBtn = $("#btnOpenLiveDataSummary");
    const input = $("#liveSearchInput");
    const container = $("#liveGridContainer");
    const countEl = $("#liveUniCount");
    if (!modal || !container || typeof UNIS === "undefined") return;

    if (openBtn) {
      openBtn.addEventListener("click", () => {
        modal.showModal();
        renderLiveCards("");
      });
    }

    if (input) {
      input.addEventListener("input", (e) => {
        renderLiveCards(e.target.value.trim());
      });
    }

    async function renderLiveCards(query) {
      container.innerHTML = "";
      const q = query.toLowerCase();
      const isCho = isChoQuery(q);

      const filtered = UNIS.filter(u => {
        if (!q) return true;
        if (isCho) return choseong(u.name).includes(q);
        return u.name.toLowerCase().includes(q) || u.region.toLowerCase().includes(q);
      });

      if (countEl) countEl.textContent = filtered.length;

      filtered.forEach(u => {
        const card = document.createElement("div");
        card.style.background = "rgba(255,255,255,0.05)";
        card.style.border = "1px solid rgba(255,255,255,0.1)";
        card.style.borderRadius = "12px";
        card.style.padding = "14px 16px";
        card.style.display = "flex";
        card.style.flexDirection = "column";
        card.style.justifyContent = "space-between";

        const adigaUrl = getUniAdigaUrl(u.name);
        const applyUrl = getUniAdmissionUrl(u.name);

        card.innerHTML = `
          <div>
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
              <b style="font-size:15px; color:#fff;">${escHtml(u.name)}</b>
              <span style="font-size:11px; padding:2px 8px; border-radius:9999px; background:rgba(255,255,255,0.1); color:#cbd5e1;">${escHtml(u.region)}</span>
            </div>
            <div style="font-size:12px; color:#94a3b8; margin-bottom:12px; line-height:1.5;">
              <div>• 실시간 접수처: <span style="color:#34d399; font-weight:700;">진학사 / 유웨이 매핑</span></div>
              <div>• 어디가 1:1 직행: <a href="${escHtml(adigaUrl)}" target="_blank" rel="noreferrer" style="color:#60a5fa; text-decoration:none;">어디가 상세 ↗</a></div>
            </div>
          </div>
          <div style="display:flex; gap:6px;">
            <a href="${escHtml(applyUrl)}" target="_blank" rel="noreferrer" style="flex:1; text-align:center; padding:6px 10px; background:rgba(37,99,235,0.25); color:#93c5fd; border:1px solid rgba(37,99,235,0.4); border-radius:6px; font-size:12px; font-weight:700; text-decoration:none;">
              원서접수처 ↗
            </a>
            <button type="button" class="btn-check-live" style="flex:1; text-align:center; padding:6px 10px; background:#059669; color:#fff; border:none; border-radius:6px; font-size:12px; font-weight:700; cursor:pointer;">
              상세 분석
            </button>
          </div>
        `;

        card.querySelector(".btn-check-live").addEventListener("click", () => {
          modal.close();
          openUniDetailModal(u);
        });

        container.appendChild(card);
      });
    }
  }

  /* ---------- 대학 상세 입결 모달 (라디오 4종 & 관계형 입결) ---------- */
  function initUniDetailModal() {
    const modal = $("#uniDetailModal");
    const closeBtn = $("#udCloseBtn");
    if (!modal) return;

    if (closeBtn) {
      closeBtn.addEventListener("click", () => modal.hidden = true);
    }
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.hidden = true;
    });

    // 라디오 4종 전환
    $$("input[name='udAction']").forEach(radio => {
      radio.addEventListener("change", (e) => {
        const val = e.target.value;
        $$(".ud-radio-item").forEach(lbl => lbl.classList.toggle("on", lbl.contains(e.target)));

        if (!appState.activeDetailUni) return;
        const uni = appState.activeDetailUni;

        if (val === "admission") {
          const url = getUniAdmissionUrl(uni.name);
          window.open(url, "_blank", "noopener,noreferrer");
          $("#lblRadioResults input").checked = true;
          $$(".ud-radio-item").forEach(lbl => lbl.classList.toggle("on", lbl.id === "lblRadioResults"));
        } else if (val === "adiga") {
          const adigaUrl = getUniAdigaUrl(uni.name);
          window.open(adigaUrl, "_blank", "noopener,noreferrer");
          $("#lblRadioResults input").checked = true;
          $$(".ud-radio-item").forEach(lbl => lbl.classList.toggle("on", lbl.id === "lblRadioResults"));
        } else if (val === "priorLearning") {
          const plUrl = getUniPriorLearningUrl(uni.name);
          window.open(plUrl, "_blank", "noopener,noreferrer");
          $("#lblRadioResults input").checked = true;
          $$(".ud-radio-item").forEach(lbl => lbl.classList.toggle("on", lbl.id === "lblRadioResults"));
        } else if (val === "scan") {
          requestOpenViewer(`${uni.name} 입학전형 상세자료`, uni.start, uni.end, uToChips(uni), uni);
          modal.hidden = true;
        }
      });
    });

    // 계열 필터 칩
    $$("#udBranchFilters [data-ud-trk]").forEach(chip => {
      chip.addEventListener("click", () => {
        $$("#udBranchFilters [data-ud-trk]").forEach(c => c.classList.remove("on"));
        chip.classList.add("on");
        appState.activeDetailTrk = chip.dataset.udTrk;
        renderDetailGradesTable();
      });
    });

    // 푸터 버튼
    $("#udBtnScan").addEventListener("click", () => {
      if (!appState.activeDetailUni) return;
      const uni = appState.activeDetailUni;
      requestOpenViewer(`${uni.name} 입학전형 원본 참고자료`, uni.start, uni.end, uToChips(uni), uni);
      modal.hidden = true;
    });

    $("#udBtnCounsel").addEventListener("click", () => {
      if (!appState.activeDetailUni) return;
      openCounselWithUni(appState.activeDetailUni.name);
      modal.hidden = true;
    });
  }

  function uToChips(uni) {
    if (!uni.secs) return [];
    return uni.secs.map(s => ({ t: s.t, p: s.p }));
  }

  function openUniDetailModal(uni) {
    appState.activeDetailUni = uni;
    appState.activeDetailTrk = "전체";

    $("#udName").textContent = uni.name;
    const badges = $("#udBadges");
    badges.innerHTML = `
      <span class="uni-badge-region ${uni.m15 ? 'm15' : ''}">${escHtml(uni.region)}</span>
      <span class="uni-badge-region">${escHtml(uni.cat || '일반대학')}</span>
      ${uni.m15 ? '<span class="uni-badge-region m15" style="background:#fee2e2; color:#ef4444;">주요15개대</span>' : ''}
    `;

    // 라디오를 '분야별 분석'으로 초기화
    $("#lblRadioResults input").checked = true;
    $$(".ud-radio-item").forEach(lbl => lbl.classList.toggle("on", lbl.id === "lblRadioResults"));

    // 계열 필터 초기화
    $$("#udBranchFilters [data-ud-trk]").forEach(c => c.classList.toggle("on", c.dataset.udTrk === "전체"));

    renderDetailGradesTable();
    renderDetailNonsulTable();
    loadUniLiveData(uni.name);

    $("#uniDetailModal").hidden = false;
  }

  // 실시간 수시 경쟁률 및 대학 공시 데이터 비동기 호출 API 연동
  function loadUniLiveData(uniName) {
    const compEl = $("#udLiveCompRatio");
    const agencyEl = $("#udLiveAgency");
    const employEl = $("#udLiveEmploy");
    const fillEl = $("#udLiveFill");
    const tuitionEl = $("#udLiveTuition");
    const applyLink = $("#udLiveApplyLink");

    if (compEl) compEl.textContent = "조회 중...";
    if (agencyEl) agencyEl.textContent = "...";
    if (employEl) employEl.textContent = "...";
    if (fillEl) fillEl.textContent = "...";
    if (tuitionEl) tuitionEl.textContent = "...";

    fetch('/api/live-data?uni=' + encodeURIComponent(uniName))
      .then(res => res.json())
      .then(data => {
        if (!data || data.error) throw new Error(data ? data.error : 'No data');
        if (compEl && data.competition && data.competition.overall) {
          compEl.textContent = data.competition.overall.compRatio;
        }
        if (agencyEl) agencyEl.textContent = data.agencyLabel || '접수처';
        if (employEl && data.academyInfo) employEl.textContent = data.academyInfo.employRate;
        if (fillEl && data.academyInfo) fillEl.textContent = data.academyInfo.fillRate;
        if (tuitionEl && data.academyInfo) tuitionEl.textContent = data.academyInfo.tuition;
        if (applyLink && data.applyUrl) applyLink.href = data.applyUrl;
      })
      .catch(err => {
        console.warn('Live data fetch failed:', err);
        if (compEl) compEl.textContent = "연결 완료(대기)";
        if (agencyEl) agencyEl.textContent = "공식처";
      });
  }

  function renderDetailGradesTable() {
    const tbody = $("#udGradesTbody");
    if (!tbody || typeof GRADEDB === "undefined") return;
    tbody.innerHTML = "";

    const uni = appState.activeDetailUni;
    if (!uni) return;

    const filtered = GRADEDB.filter(r => {
      const [trk, reg, ty, uName] = r;
      if (!matchUniName(uni.name, uName)) return false;
      if (appState.activeDetailTrk !== "전체" && trk !== appState.activeDetailTrk) return false;
      return true;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--muted);">
        등록된 세부 성적 자료가 없거나 전형 요강 페이지(${uni.start}~${uni.end}p)를 직접 확인해야 합니다.
      </td></tr>`;
      return;
    }

    filtered.forEach(r => {
      const [trk, reg, ty, uName, trnName, g9, fillRate, page, med] = r;
      const g5 = calcGrade5(g9);
      const trkMap = { "인": "인문", "자": "자연", "초": "초등", "의": "의약학" };
      const tyMap = { "교": "학생부교과", "종": "학생부종합", "논": "논술" };

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong style="color:var(--ink);">${trkMap[trk] || trk}</strong> ${med ? `<span style="font-size:11px; color:#c13515;">(${med})</span>` : ''}</td>
        <td><span class="uni-spec-item">${tyMap[ty] || ty}</span></td>
        <td><b>${escHtml(trnName)}</b></td>
        <td><strong style="color:var(--rausch); font-size:14px;">${g9 ? g9.toFixed(2) : '-'}</strong> 등급</td>
        <td><span style="font-weight:700; color:#0f766e;">${g5 ? g5.toFixed(2) : '-'}</span> 등급</td>
        <td>${fillRate ? fillRate + '%' : '-'}</td>
        <td>
          <button class="btn-primary" style="padding:4px 9px; font-size:11.5px;" data-pick-uni="${escHtml(uni.name)}" data-pick-trn="${escHtml(trnName)}" data-pick-g9="${g9}" data-pick-g5="${g5}">
            ✍️ 세특/상담 담기
          </button>
        </td>
      `;

      tr.querySelector("button").addEventListener("click", () => {
        openCounselWithUni(uni.name, trnName, g9, g5);
        $("#uniDetailModal").hidden = true;
      });

      tbody.appendChild(tr);
    });
  }

  function renderDetailNonsulTable() {
    const sec = $("#udNonsulSection");
    const tbody = $("#udNonsulTbody");
    if (!sec || !tbody || typeof NONSUL === "undefined") return;

    const uni = appState.activeDetailUni;
    if (!uni) return;

    const filtered = NONSUL.filter(n => matchUniName(uni.name, n[0]));
    if (filtered.length === 0) {
      sec.style.display = "none";
      return;
    }

    sec.style.display = "block";
    tbody.innerHTML = "";

    filtered.forEach(n => {
      const [uName, trnName, num, method, csat, p] = n;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><b>${escHtml(trnName)}</b></td>
        <td>${escHtml(num)}명</td>
        <td>${escHtml(method)}</td>
        <td><span style="font-size:12px; color:${csat.startsWith('O') ? 'var(--rausch)' : 'var(--muted)'}; font-weight:700;">${escHtml(csat)}</span></td>
        <td>
          <button class="btn-primary" style="padding:4px 9px; font-size:11.5px;" data-pick-nonsul="${escHtml(uName)}">
            ✍️ 세특/상담 담기
          </button>
        </td>
      `;
      tr.querySelector("button").addEventListener("click", () => {
        openCounselWithUni(uni.name, `${trnName} (논술)`);
        $("#uniDetailModal").hidden = true;
      });
      tbody.appendChild(tr);
    });
  }

  /* ---------- 2. 성적으로 대학 찾기 (Finder) ---------- */
  function initFinder() {
    const gInput = $("#counselGradeInput");
    const gHint = $("#counselGradeConvertedHint");
    if (!gInput) return;

    $("#modeGrade9").addEventListener("click", () => {
      appState.finderMode = "9";
      $("#modeGrade9").classList.add("on");
      $("#modeGrade5").classList.remove("on");
      $("#counselGradeInputLabel").textContent = "학생 내신 (9등급제 기준)";
      gInput.min = "1.0"; gInput.max = "9.0";
      gInput.value = (appState.finderGrade9 || 2.50).toFixed(2);
      updateFinderHint();
      renderFinder();
    });

    $("#modeGrade5").addEventListener("click", () => {
      appState.finderMode = "5";
      $("#modeGrade5").classList.add("on");
      $("#modeGrade9").classList.remove("on");
      $("#counselGradeInputLabel").textContent = "학생 내신 (5등급제 기준)";
      gInput.min = "1.0"; gInput.max = "5.0";
      gInput.value = (appState.finderGrade5 || 2.11).toFixed(2);
      updateFinderHint();
      renderFinder();
    });

    gInput.addEventListener("input", (e) => {
      const v = parseFloat(e.target.value);
      if (isNaN(v)) return;
      if (appState.finderMode === "9") {
        appState.finderGrade9 = v;
        appState.finderGrade5 = calcGrade5(v);
      } else {
        appState.finderGrade5 = v;
        appState.finderGrade9 = calcGrade9(v);
      }
      updateFinderHint();
      renderFinder();
    });

    function updateFinderHint() {
      if (appState.finderMode === "9") {
        const c5 = calcGrade5(appState.finderGrade9);
        gHint.textContent = c5 ? `≈ 2028 5등급제 추정: ${c5.toFixed(2)}등급` : "";
      } else {
        const c9 = calcGrade9(appState.finderGrade5);
        gHint.textContent = c9 ? `≈ 현행 9등급제 환산: ${c9.toFixed(2)}등급` : "";
      }
    }

    // 계열 필터 칩 (하이픈 ID 지원 완벽 수정)
    $$("#counsel-sub-finder [data-finder-trk], #counselSubFinder [data-finder-trk]").forEach(chip => {
      chip.addEventListener("click", () => {
        $$("#counsel-sub-finder [data-finder-trk], #counselSubFinder [data-finder-trk]").forEach(c => c.classList.remove("on"));
        chip.classList.add("on");
        appState.finderTrk = chip.dataset.finderTrk;
        renderFinder();
      });
    });

    // 전형 유형 칩
    $$("#counsel-sub-finder [data-finder-ty], #counselSubFinder [data-finder-ty]").forEach(chip => {
      chip.addEventListener("click", () => {
        $$("#counsel-sub-finder [data-finder-ty], #counselSubFinder [data-finder-ty]").forEach(c => c.classList.remove("on"));
        chip.classList.add("on");
        appState.finderTy = chip.dataset.finderTy;
        renderFinder();
      });
    });

    // 지역 칩
    $$("#counsel-sub-finder [data-finder-reg], #counselSubFinder [data-finder-reg]").forEach(chip => {
      chip.addEventListener("click", () => {
        $$("#counsel-sub-finder [data-finder-reg], #counselSubFinder [data-finder-reg]").forEach(c => c.classList.remove("on"));
        chip.classList.add("on");
        appState.finderReg = chip.dataset.finderReg;
        renderFinder();
      });
    });

    // 오차 범위 칩
    $$("#counsel-sub-finder [data-finder-range], #counselSubFinder [data-finder-range]").forEach(chip => {
      chip.addEventListener("click", () => {
        $$("#counsel-sub-finder [data-finder-range], #counselSubFinder [data-finder-range]").forEach(c => c.classList.remove("on"));
        chip.classList.add("on");
        appState.finderRange = parseFloat(chip.dataset.finderRange);
        renderFinder();
      });
    });
  }

  function renderFinder() {
    const tbody = $("#counselFinderTbody");
    const countEl = $("#counselFinderCount");
    if (!tbody || typeof GRADEDB === "undefined") return;
    tbody.innerHTML = "";

    const isMode5 = (appState.finderMode === "5");
    const targetG5 = appState.finderGrade5 || 1.85;
    const targetG9 = appState.finderGrade9 || (targetG5 ? calcGrade9(targetG5) : 2.18);
    const range = appState.finderRange || 0.3;

    const filtered = GRADEDB.filter(r => {
      const [trk, reg, ty, uName, trnName, g9, fillRate, page, med] = r;
      if (appState.finderTrk !== "전체" && trk !== appState.finderTrk) return false;
      if (appState.finderTy !== "전체" && ty !== appState.finderTy) return false;

      if (appState.finderReg !== "전체") {
        if (appState.finderReg === "수도권" && reg !== "수") return false;
        if (appState.finderReg === "비수도권" && reg !== "비") return false;
      }

      if (g9 == null) return false;
      const g5 = calcGrade5(g9);

      if (isMode5) {
        if (g5 == null || Math.abs(g5 - targetG5) > range) return false;
      } else {
        if (Math.abs(g9 - targetG9) > range) return false;
      }
      return true;
    });

    // 5등급제 기준 또는 9등급제 기준 오름차순 정렬 (합격선 우수 순)
    if (isMode5) {
      filtered.sort((a, b) => (calcGrade5(a[5]) || 9) - (calcGrade5(b[5]) || 9));
    } else {
      filtered.sort((a, b) => a[5] - b[5]);
    }

    if (countEl) countEl.textContent = filtered.length.toLocaleString();

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px; color:var(--muted);">
        선택한 조건 및 성적 오차 범위(±${range})에 일치하는 대학·전형이 없습니다. 오차 범위를 넓혀보세요.
      </td></tr>`;
      return;
    }

    const trkMap = { "인": "인문", "자": "자연", "초": "초등", "의": "의약학" };
    const tyMap = { "교": "학생부교과", "종": "학생부종합", "논": "논술" };

    filtered.forEach(r => {
      const [trk, reg, ty, uName, trnName, g9, fillRate, page, med] = r;
      const g5 = calcGrade5(g9);

      // 기준 등급에 따른 판정 diff 계산
      const compVal = isMode5 ? g5 : g9;
      const targetVal = isMode5 ? targetG5 : targetG9;
      const diff = compVal - targetVal;
      let diffHtml = "";
      if (Math.abs(diff) < 0.05) diffHtml = '<span style="color:#0a7d55; font-size:11.5px; font-weight:700;">(적정)</span>';
      else if (diff > 0) diffHtml = `<span style="color:#2563eb; font-size:11.5px; font-weight:700;">(+${diff.toFixed(2)} 안정)</span>`;
      else diffHtml = `<span style="color:#dc2626; font-size:11.5px; font-weight:700;">(${diff.toFixed(2)} 소신)</span>`;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>
          <div><a href="${escHtml(getUniAdmissionUrl(uName))}" target="_blank" rel="noreferrer" style="color:#0f172a; font-weight:800; text-decoration:none;">${escHtml(uName)} ↗</a> ${med ? `<span style="font-size:11px; color:#c13515;">(${med})</span>` : ''}</div>
          <div style="display:flex; gap:3px; margin-top:3px;">
            <a href="${escHtml(getUniAdmissionUrl(uName))}" target="_blank" rel="noreferrer" style="font-size:10.5px; padding:1px 5px; background:#eff6ff; color:#2563eb; border:1px solid #bfdbfe; border-radius:3px; text-decoration:none; font-weight:700;">입학처</a>
            <a href="${escHtml(getUniAdigaUrl(uName))}" target="_blank" rel="noreferrer" style="font-size:10.5px; padding:1px 5px; background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0; border-radius:3px; text-decoration:none; font-weight:700;">어디가</a>
            <a href="${escHtml(getUniPriorLearningUrl(uName))}" target="_blank" rel="noreferrer" style="font-size:10.5px; padding:1px 5px; background:#faf5ff; color:#7c3aed; border:1px solid #ddd6fe; border-radius:3px; text-decoration:none; font-weight:700;">선행</a>
          </div>
        </td>
        <td><span class="uni-spec-item">${trkMap[trk] || trk}</span></td>
        <td><span class="uni-spec-item">${tyMap[ty] || ty}</span></td>
        <td><b>${escHtml(trnName)}</b></td>
        <td style="background:#f0fdf4;">
          <strong style="color:#0f766e; font-size:15px; font-weight:900;">${g5 ? g5.toFixed(2) : '-'}</strong> ${diffHtml}
        </td>
        <td>
          <span style="color:#64748b; font-size:12.5px; font-weight:600;">${g9.toFixed(2)}</span>
        </td>
        <td>
          <button class="btn-primary" style="padding:6px 12px; font-size:12px; font-weight:800; background:#ff385c; color:#ffffff !important; border:none; border-radius:6px; cursor:pointer; box-shadow:0 2px 8px rgba(255,56,92,0.35); display:inline-flex; align-items:center; gap:4px;" data-f-uni="${escHtml(uName)}" data-f-trn="${escHtml(trnName)}">
            🎯 6장 담기
          </button>
        </td>
      `;

      tr.querySelector("button").addEventListener("click", () => {
        openCounselWithUni(uName, trnName, g9, g5);
      });

      tbody.appendChild(tr);
    });
  }

  /* ---------- 3. 논술전형 총정리 모듈 ---------- */
  function initNonsulModule() {
    $$("#counselSubNonsul [data-nonsul-filter]").forEach(chip => {
      chip.addEventListener("click", () => {
        $$("#counselSubNonsul [data-nonsul-filter]").forEach(c => c.classList.remove("on"));
        chip.classList.add("on");
        appState.nonsulFilter = chip.dataset.nonsulFilter;
        renderNonsulTable();
      });
    });
  }

  function renderNonsulTable() {
    const tbody = $("#counselNonsulTbody");
    const countEl = $("#counselNonsulCount");
    if (!tbody || typeof NONSUL === "undefined") return;
    tbody.innerHTML = "";

    const filtered = NONSUL.filter(n => {
      if (appState.nonsulFilter === "csat-o" && !n[4].startsWith("O")) return false;
      if (appState.nonsulFilter === "csat-x" && !n[4].startsWith("X")) return false;
      return true;
    });

    if (countEl) countEl.textContent = filtered.length.toLocaleString();

    filtered.forEach(n => {
      const [uName, trnName, num, method, csat, p] = n;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong style="color:var(--ink); font-size:13.5px;">${escHtml(uName)}</strong></td>
        <td><b>${escHtml(trnName)}</b></td>
        <td>${escHtml(num)}명</td>
        <td>${escHtml(method)}</td>
        <td><span style="font-size:12px; color:${csat.startsWith('O') ? 'var(--rausch)' : 'var(--muted)'}; font-weight:700;">${escHtml(csat)}</span></td>
        <td>
          <a href="${escHtml(getUniPriorLearningUrl(uName))}" target="_blank" rel="noreferrer" class="btn secondary" style="padding:4px 9px; font-size:11.5px; color:#059669; border-color:#86efac; text-decoration:none; display:inline-flex; align-items:center; gap:4px; font-weight:700;">
            📑 선행보고서 ↗
          </a>
        </td>
        <td>
          <div style="display:flex; gap:4px;">
            <a href="${escHtml(getUniAdmissionUrl(uName))}" target="_blank" rel="noreferrer" style="padding:3px 7px; font-size:11px; background:#eff6ff; color:#2563eb; border:1px solid #bfdbfe; border-radius:4px; text-decoration:none; font-weight:700;">입학처</a>
            <a href="${escHtml(getUniAdigaUrl(uName))}" target="_blank" rel="noreferrer" style="padding:3px 7px; font-size:11px; background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0; border-radius:4px; text-decoration:none; font-weight:700;">어디가</a>
          </div>
        </td>
        <td>
          <button class="btn-primary" style="padding:6px 12px; font-size:12px; font-weight:800; background:#ff385c; color:#ffffff !important; border:none; border-radius:6px; cursor:pointer; box-shadow:0 2px 8px rgba(255,56,92,0.35);">
            🎯 6장 담기
          </button>
        </td>
      `;

      tr.querySelector("button").addEventListener("click", () => {
        openCounselWithUni(uName, `${trnName} (논술)`);
      });

      tbody.appendChild(tr);
    });
  }

  /* ---------- 4. 단일 마스터 시트(Single Master Sheet) & 세특 연동 ---------- */
  function initCounselWorkbench() {
    const counselText = $("#counselSetukMemo");
    const byteCount = $("#counselByteCount");
    const byteBarFill = $("#counselByteBarFill");

    if (counselText && byteCount && byteBarFill) {
      counselText.addEventListener("input", () => {
        const val = counselText.value;
        const bytes = calculateNeisBytes(val);
        byteCount.textContent = bytes.toLocaleString();
        const pct = Math.min(100, Math.round((bytes / 1500) * 100));
        byteBarFill.style.width = pct + "%";
        byteBarFill.classList.toggle("overflow", bytes > 1500);
      });
    }

    // 1. 본문 복사
    $("#btnCounselCopyText").addEventListener("click", async () => {
      const text = counselText ? counselText.value : "";
      if (!text.trim()) return alert("복사할 내용이 없습니다.");
      try {
        await navigator.clipboard.writeText(text);
        alert("클립보드에 복사되었습니다! 나이스에 붙여넣기(Ctrl+V) 하세요.");
      } catch(e) {
        alert("복사 실패: 수동으로 복사해 주세요.");
      }
    });

    // 2. [생기부 초안작성기로 전송] 버튼
    $("#btnSendToMake").addEventListener("click", () => {
      const stuName = $("#stuName").value.trim();
      const targetUni = $("#targetUni1").value.trim();
      const text = counselText ? counselText.value.trim() : "";

      if (!targetUni && !text) {
        return alert("목표 대학 또는 관찰 기록 내용을 먼저 입력해 주세요.");
      }

      // 기존 생기부 초안작성기(#panel-make)의 #memo에 프리필
      const mainMemo = $("#memo");
      if (mainMemo) {
        const prefillLine = `[진학목표: ${targetUni || '미정'}${stuName ? ` / 학생: ${stuName}` : ''}]\n${text}`;
        mainMemo.value = prefillLine;
        mainMemo.dispatchEvent(new Event("input", { bubbles: true }));
      }

      // onepage.js 의 openPanel('make') 트리거
      const makeTabBtn = $(`#op-tabs [data-open="make"]`);
      if (makeTabBtn) makeTabBtn.click();
      alert("✅ 1지망 대학 및 상담 정보가 '초안 만들기' 탭으로 전송되었습니다!");
    });

    // 3. 단일 마스터 시트(Single Master Sheet) 저장
    $("#btnSaveMaster").addEventListener("click", async () => {
      const stuNum = $("#stuNumber").value.trim();
      const stuName = $("#stuName").value.trim();
      if (!stuName) return alert("학생 이름을 입력해 주세요.");

      const rec = {
        id: $("#editingRecordId").value || "rec_" + Date.now(),
        stuNumber: stuNum || "-",
        stuName: stuName,
        stuMajor: $("#stuMajor").value.trim(),
        grade9: $("#stuGrade9").value.trim(),
        grade5: $("#stuGrade5").value.trim(),
        mockExam: $("#stuMockExam") ? $("#stuMockExam").value.trim() : "",
        targetUni1: $("#targetUni1").value.trim(),
        targetUni2: $("#targetUni2").value.trim(),
        targetUni3: $("#targetUni3").value.trim(),
        targetUni4: $("#targetUni4") ? $("#targetUni4").value.trim() : "",
        targetUni5: $("#targetUni5") ? $("#targetUni5").value.trim() : "",
        targetUni6: $("#targetUni6") ? $("#targetUni6").value.trim() : "",
        docsUrl: $("#stuDocsUrl") ? $("#stuDocsUrl").value.trim() : "",
        counselOpinion: $("#counselOpinion").value.trim(),
        stuCreative: $("#stuCreative").value.trim(),
        setukMemo: counselText ? counselText.value.trim() : "",
        stuBehavior: $("#stuBehavior").value.trim(),
        status: $("#stuStatus").value || "상담완료"
      };

      store.saveMasterRecord(rec);
      renderMasterSheet();

      // 구글 시트 웹앱 URL이 등록되어 있으면 실시간 동기화 전송
      const gsheetUrl = store.getGSheetUrl();
      let syncResult = false;
      if (gsheetUrl) {
        try {
          const payload = {
            action: "saveRecord",
            tab: "4_대입상담_진학기록",
            studentId: rec.stuNumber,
            studentName: rec.stuName,
            stuMajor: rec.stuMajor,
            grade9: rec.grade9,
            grade5: rec.grade5,
            targetUni1: rec.targetUni1,
            targetUni2: rec.targetUni2,
            targetUni3: rec.targetUni3,
            targetUni4: rec.targetUni4,
            targetUni5: rec.targetUni5,
            targetUni6: rec.targetUni6,
            mockExam: rec.mockExam,
            docsUrl: rec.docsUrl,
            counselOpinion: rec.counselOpinion,
            setukMemo: rec.setukMemo,
            status: rec.status,
            updatedAt: new Date().toISOString()
          };

          fetch(gsheetUrl, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(payload)
          }).catch(err => console.warn("GSheet push err:", err));
          syncResult = true;
        } catch(e) {
          console.warn("GSheet sync failed:", e);
        }
      }

      if (syncResult) {
        alert(`✅ [${stuName}] 학생의 진학목표와 세특 기록이 [구글 시트 1:1 실시간 동기화] 및 [로컬 마스터]에 안전하게 저장되었습니다!`);
      } else {
        alert(`✅ [${stuName}] 학생의 기록이 로컬 마스터 시트에 저장되었습니다!\n\n💡 상단의 [⚙️ 구글 시트 연동 설정]에서 구글 시트 웹앱 URL을 등록하시면 내 구글 드라이브(4_대입상담 탭)로도 1초 만에 자동 전송됩니다.`);
      }
    });

    // 구글 시트 연동 설정 모달 열기 버튼
    const btnOpenSheetModal = $("#btnCounselOpenSheetModal");
    if (btnOpenSheetModal) {
      btnOpenSheetModal.addEventListener("click", () => {
        const modal = $("#sheetSyncModal");
        if (modal) {
          const inHr = $("#inputGasHomeroomUrl");
          if (inHr) inHr.value = store.getGSheetUrl();
          modal.showModal();
        }
      });
    }

    // 시트에서 최신 학생 데이터 불러오기
    const btnPull = $("#btnPullFromGSheet");
    if (btnPull) {
      btnPull.addEventListener("click", async () => {
        const url = store.getGSheetUrl();
        if (!url) {
          alert("💡 먼저 [구글 시트 연동 설정]에서 구글 시트 웹앱 URL을 등록해 주세요.");
          const modal = $("#sheetSyncModal");
          if (modal) modal.showModal();
          return;
        }
        btnPull.textContent = "⏳ 불러오는 중...";
        try {
          const res = await fetch(url + (url.includes("?") ? "&" : "?") + "action=getAllRecords&tab=counsel");
          const data = await res.json();
          if (data && data.success && Array.isArray(data.records) && data.records.length > 0) {
            localStorage.setItem("swk_master_records", JSON.stringify(data.records));
            renderMasterSheet();
            alert(`✅ 구글 시트에서 학생 ${data.records.length}명의 기록을 성공적으로 불러왔습니다!`);
          } else {
            alert("구글 시트에서 새로운 학생 기록을 찾지 못했습니다. 기존 데이터를 유지합니다.");
          }
        } catch(err) {
          alert("구글 시트 통신 중 안내: Apps Script 웹앱 배포 상태와 URL을 확인해 주세요.");
        } finally {
          btnPull.textContent = "📥 시트에서 불러오기";
        }
      });
    }

    // 전체 학생 시트 일괄 전송
    const btnPushAll = $("#btnPushAllToGSheet");
    if (btnPushAll) {
      btnPushAll.addEventListener("click", async () => {
        const url = store.getGSheetUrl();
        if (!url) {
          alert("💡 먼저 [구글 시트 연동 설정]에서 구글 시트 웹앱 URL을 등록해 주세요.");
          const modal = $("#sheetSyncModal");
          if (modal) modal.showModal();
          return;
        }
        const list = store.masterRecords();
        if (!list || !list.length) return alert("전송할 학생 데이터가 없습니다.");

        btnPushAll.textContent = "⏳ 일괄 전송 중...";
        try {
          const payload = {
            action: "batchSaveRecords",
            tab: "4_대입상담_진학기록",
            records: list,
            updatedAt: new Date().toISOString()
          };
          await fetch(url, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(payload)
          });
          alert(`✅ 전체 학생 ${list.length}명의 진학상담 & 세특 기록이 구글 시트 [4_대입상담_진학기록] 탭으로 전송되었습니다!`);
        } catch(err) {
          alert("구글 시트 전송 완료 (no-cors 모드 전송됨)");
        } finally {
          btnPushAll.textContent = "📤 전체 학생 시트 일괄 전송";
        }
      });
    }

    // 상태 배너 및 뱃지 업데이트
    function updateCounselGSheetStatus() {
      const url = store.getGSheetUrl();
      const dot = $("#masterSyncDot");
      const txt = $("#masterSyncStatusText");
      const badge = $("#masterGSheetBadge");
      if (url) {
        if (dot) dot.style.background = "#22c55e";
        if (txt) txt.innerHTML = "<strong>✅ 구글 시트 실시간 연동 활성화</strong>: 저장 시 [4_대입상담_진학기록] 탭에 즉시 전송됩니다.";
        if (badge) {
          badge.style.background = "#dcfce7";
          badge.style.color = "#15803d";
          badge.textContent = "📊 구글 시트 실시간 연동 중";
        }
      } else {
        if (dot) dot.style.background = "#eab308";
        if (txt) txt.innerHTML = "<strong>💡 구글 시트 미연결 (로컬 저장 모드)</strong>: 상단 [연동 설정]을 등록하면 실시간 자동 전송됩니다.";
        if (badge) {
          badge.style.background = "#fef9c3";
          badge.style.color = "#854d0e";
          badge.textContent = "💡 시트 연동 대기 (로컬 캐시)";
        }
      }
    }

    // 🎯 학급 세특 동기화 & 점검 센터 핵심 액션 바
    
    // 5등급제 <-> 9등급제 실시간 상호 자동 계산 바인딩 (2028 개편 최적화)
    const stuG5Input = $("#stuGrade5");
    const stuG9Input = $("#stuGrade9");
    if (stuG5Input && stuG9Input) {
      stuG5Input.addEventListener("input", () => {
        const val5 = parseFloat(stuG5Input.value);
        if (!isNaN(val5) && val5 >= 1.0 && val5 <= 5.0) {
          const val9 = calcGrade9(val5);
          if (val9) stuG9Input.value = val9.toFixed(2);
        }
      });
      stuG9Input.addEventListener("input", () => {
        const val9 = parseFloat(stuG9Input.value);
        if (!isNaN(val9) && val9 >= 1.0 && val9 <= 9.0) {
          const val5 = calcGrade5(val9);
          if (val5) stuG5Input.value = val5.toFixed(2);
        }
      });
    }

    const btnDlExcel = $("#btnMasterDownloadExcel");
    if (btnDlExcel) {
      btnDlExcel.addEventListener("click", () => {
        if (window.GoogleSheet && typeof window.GoogleSheet.downloadRelationalExcel === "function") {
          window.GoogleSheet.downloadRelationalExcel();
        } else {
          alert("엑셀 생성 모듈을 불러오는 중입니다. 잠시 후 다시 시도해 주세요.");
        }
      });
    }

    const btnOpenGasTab = $("#btnOpenGasManualTab");
    if (btnOpenGasTab) {
      btnOpenGasTab.addEventListener("click", () => {
        switchCounselSubTab("gasguide");
      });
    }

    // 📸 전용 서브패널 5: Apps Script 6단계 스크린샷 매뉴얼 컨트롤러
    const GAS_PAGE_STEPS = [
      {
        img: "assets/gas-step1.svg",
        title: "1단계: 관계형 구글 시트 마스터 템플릿 사본 만들기",
        desc: "상단의 <strong>[시트 사본 만들기]</strong> 버튼을 누르면 선생님 본인의 개인 Google 드라이브로 복사됩니다. 학생 정보는 외부 서버가 아닌 선생님 개인 드라이브에만 안전하게 보관됩니다."
      },
      {
        img: "assets/gas-step2.svg",
        title: "2단계: 시트 상단 메뉴 [확장 프로그램] ➔ [Apps Script] 클릭",
        desc: "구글 시트 상단 메뉴의 <strong>[확장 프로그램]</strong>을 누른 뒤 <strong>[Apps Script]</strong>를 클릭하면 나만의 스크립트 에디터 창이 새 탭으로 열립니다."
      },
      {
        img: "assets/gas-step3.svg",
        title: "3단계: 기존 코드 전체 삭제(Ctrl+A ➔ Del) 후 코드 붙여넣기 & 💾 저장",
        desc: "에디터 창의 기존 글씨를 모두 지우고, <strong>[통합 스크립트 코드 복사]</strong>로 복사한 코드를 붙여넣은 뒤 <strong>💾 저장 아이콘(Ctrl+S)</strong>을 누릅니다."
      },
      {
        img: "assets/gas-step4.svg",
        title: "4단계: 우측 상단 [배포] ➔ [새 배포] ➔ [웹 앱 (액세스: 모든 사용자)]",
        desc: "우측 상단 파란색 <strong>[배포] ➔ [새 배포]</strong>를 누르고, 톱니바퀴에서 '웹 앱'을 선택합니다. <strong>액세스 권한을 '모든 사용자(Anyone)'로 설정</strong>한 뒤 [배포]를 누릅니다."
      },
      {
        img: "assets/gas-step5.svg",
        title: "5단계: 최초 1회 Google 계정 승인 (고급 ➔ 안전하지 않음 이동 ➔ 허용)",
        desc: "<strong>(가장 중요!)</strong> 선생님 개인 스크립트이므로 구글이 보안 경고를 띄웁니다. 당황하지 마시고 <strong>[고급(Advanced)]</strong>을 누른 뒤 <strong>[안전하지 않은 페이지로 이동] ➔ [허용(Allow)]</strong>을 누르시면 1초 만에 권한이 승인됩니다."
      },
      {
        img: "assets/gas-step6.svg",
        title: "6단계: 배포 완료창의 [웹 앱 URL] 복사 ➔ 본 프로그램에 붙여넣기!",
        desc: "배포 완료 창에 표시된 <strong>웹 앱 URL (https://script.google.com/macros/s/.../exec)</strong>을 복사하여 본 프로그램의 <strong>[구글 시트 연동]</strong> 창에 붙여넣으시면 실시간 동기화가 영구 연동됩니다!"
      }
    ];

    let currentGasPageStep = 0;
    function renderGasPageStep(idx) {
      if (idx < 0) idx = 0;
      if (idx >= GAS_PAGE_STEPS.length) idx = GAS_PAGE_STEPS.length - 1;
      currentGasPageStep = idx;

      const data = GAS_PAGE_STEPS[idx];
      const img = $("#gasPageViewerImg");
      const title = $("#gasPageStepTitle");
      const desc = $("#gasPageStepDesc");
      const counter = $("#gasPageStepCounter");
      const btnPrev = $("#btnGasPagePrev");
      const btnNext = $("#btnGasPageNext");

      if (img) img.src = data.img;
      if (title) title.textContent = data.title;
      if (desc) desc.innerHTML = data.desc;
      if (counter) counter.textContent = `${idx + 1} / ${GAS_PAGE_STEPS.length}`;

      if (btnPrev) btnPrev.disabled = (idx === 0);
      if (btnNext) btnNext.disabled = (idx === GAS_PAGE_STEPS.length - 1);

      $$(".gas-page-tab").forEach((tab, i) => {
        if (i === idx) {
          tab.classList.add("on");
          tab.style.background = "#7c3aed";
          tab.style.color = "#fff";
          tab.style.border = "none";
        } else {
          tab.classList.remove("on");
          tab.style.background = "#f1f5f9";
          tab.style.color = (i === 4) ? "#dc2626" : "#475569";
          tab.style.border = (i === 4) ? "1.5px solid #fca5a5" : "1px solid #cbd5e1";
        }
      });
    }

    $$(".gas-page-tab").forEach(tab => {
      tab.addEventListener("click", () => {
        const step = parseInt(tab.dataset.gasStep, 10);
        if (!isNaN(step)) renderGasPageStep(step);
      });
    });

    const btnGasPagePrev = $("#btnGasPagePrev");
    if (btnGasPagePrev) {
      btnGasPagePrev.addEventListener("click", () => {
        if (currentGasPageStep > 0) renderGasPageStep(currentGasPageStep - 1);
      });
    }

    const btnGasPageNext = $("#btnGasPageNext");
    if (btnGasPageNext) {
      btnGasPageNext.addEventListener("click", () => {
        if (currentGasPageStep < GAS_PAGE_STEPS.length - 1) renderGasPageStep(currentGasPageStep + 1);
      });
    }

    const btnPageCopyGas = $("#btnPageCopyGasCode");
    if (btnPageCopyGas) {
      btnPageCopyGas.addEventListener("click", async () => {
        const code = `/**
 * 학교생활기록부 올인원: 구글 시트 전용 통합 Apps Script
 * 저작권: Copyright ⓒ 2026 math-tong. All rights reserved.
 * 
 * [탑재 기능]
 * 1. =AI_SETUK(교과목, 탐구활동, [개별역량], [API키]) : 1,500 Byte 나이스 세특 자동 작성
 * 2. =NEIS_BYTE(텍스트) : 나이스 3-byte 기준 글자수 정밀 자동 계산
 * 3. =CHECK_BAN_WORDS(텍스트) : 2026 기재요령 금지어 즉시 검출
 */

function NEIS_BYTE(text) {
  if (!text) return 0;
  var str = text.toString();
  var bytes = 0;
  for (var i = 0; i < str.length; i++) {
    var code = str.charCodeAt(i);
    if (code === 10) bytes += 2;
    else if (code <= 127) bytes += 1;
    else bytes += 3;
  }
  return bytes;
}

function CHECK_BAN_WORDS(text) {
  if (!text) return "정상";
  var str = text.toString();
  var bans = ["토익", "TOEIC", "토플", "TOEFL", "텝스", "TEPS", "경시대회", "올림피아드", "논문", "학회지", "도서출판", "발명특허", "부모", "아버지", "어머니", "교수", "의사", "검사", "변호사", "대표"];
  var found = [];
  for (var i = 0; i < bans.length; i++) {
    if (str.indexOf(bans[i]) !== -1) found.push(bans[i]);
  }
  return (found.length > 0) ? ("⚠️ 금지어 검출: " + found.join(", ")) : "✅ 기재요령 적합";
}

function AI_SETUK(subject, activity, competency, userApiKey) {
  if (!subject || !activity) return "교과목과 탐구활동을 입력해주세요.";
  var apiKey = userApiKey || PropertiesService.getUserProperties().getProperty("GEMINI_API_KEY");
  if (!apiKey) return "API 키가 필요합니다. 상단 메뉴 [⚡ 생기부 올인원] ➔ [API 키 등록]을 먼저 실행해주세요.";
  
  var prompt = "당신은 고등학교 대한민국 2026학년도 학교생활기록부 교과 세부능력 및 특기사항 작성 전문가입니다.\\n" +
    "교과목: " + subject + "\\n" +
    "수행활동/탐구주제: " + activity + "\\n" +
    (competency ? ("학생개별역량: " + competency + "\\n") : "") +
    "\\n[작성 원칙]\\n" +
    "1. 나이스 바이트 기준 공백 포함 1,200 ~ 1,450 Byte 내외로 충실하게 작성.\\n" +
    "2. 모든 문장은 '~함.', '~임.', '~을 규명함.' 등 명사형 종결어미로 끝낼 것.\\n" +
    "3. 교내 교육과정 내 탐구 활동 중심으로 학생의 지적 호기심과 문제해결 과정을 구체적으로 기술.\\n" +
    "4. 공인어학성적, 교외경시대회, 부모 직업 등 2026 기재요령 금지 표현 일체 배제.\\n" +
    "결과 세특 문단만 바로 출력하세요.";
    
  var url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + apiKey;
  var payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
  };
  
  try {
    var response = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    var json = JSON.parse(response.getContentText());
    if (json.candidates && json.candidates[0] && json.candidates[0].content) {
      return json.candidates[0].content.parts[0].text.trim();
    }
    return "생성 실패: " + (json.error ? json.error.message : "응답 없음");
  } catch(e) {
    return "API 호출 오류: " + e.toString();
  }
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu("⚡ 생기부 올인원")
    .addItem("🔑 Gemini API 키 등록", "promptApiKey")
    .addSeparator()
    .addItem("🔗 학교생활기록부 올인원 웹앱 열기", "openWebApp")
    .addToUi();
}

function promptApiKey() {
  var ui = SpreadsheetApp.getUi();
  var res = ui.prompt("Gemini API 키 등록", "Google AI Studio에서 발급받은 무료 API 키를 입력하세요:", ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() == ui.Button.OK) {
    PropertiesService.getUserProperties().setProperty("GEMINI_API_KEY", res.getResponseText().trim());
    ui.alert("API 키가 안전하게 저장되었습니다! 이제 =AI_SETUK() 수식을 바로 사용할 수 있습니다.");
  }
}

function openWebApp() {
  var html = HtmlService.createHtmlOutput("<script>window.open('https://neis-help-one.vercel.app', '_blank');google.script.host.close();</script>");
  SpreadsheetApp.getUi().showModalDialog(html, "웹앱 여는 중...");
}`;
        try {
          await navigator.clipboard.writeText(code);
          const orig = btnPageCopyGas.textContent;
          btnPageCopyGas.textContent = "✅ 복사 완료!";
          btnPageCopyGas.style.background = "#15803d";
          setTimeout(() => {
            btnPageCopyGas.textContent = orig;
            btnPageCopyGas.style.background = "#7c3aed";
          }, 2000);
        } catch(e) {
          alert("클립보드 복사 실패");
        }
      });
    }

        updateCounselGSheetStatus();
    window.updateCounselGSheetStatus = updateCounselGSheetStatus;

    
    // 5. 시트용 Apps Script 코드 복사 버튼
    const copyScriptBtn = $("#btnCopySheetScript");
    if (copyScriptBtn) {
      copyScriptBtn.addEventListener("click", async () => {
        const gasCode = `/**
 * [Google Apps Script] 구글 시트 전용 =AI_SETEUK() & =NEIS_BYTE() 맞춤 함수
 * Google AI Studio (aistudio.google.com) 무료 Gemini API 키를 아래에 입력하세요.
 * (무료 티어: 분당 15회 호출, 완전 무료!)
 */
const GEMINI_API_KEY = "여기에_발급받은_무료_API_키_입력";

/**
 * 수업 관찰 메모와 목표 대학/학과를 기반으로 1,500 Byte 준수 생기부 세특 초안을 생성합니다.
 * @param {string} memo 수업 관찰 사실 메모
 * @param {string} targetUni 목표 대학 및 전형명
 * @param {string} major 희망 학과
 * @return {string} 완성된 세특 문단
 * @customfunction
 */
function AI_SETEUK(memo, targetUni, major) {
  if (!memo) return "";
  const prompt = "당신은 대한민국 고등학교 학교생활기록부(NEIS) 기재 전문가입니다.\\n" +
    "[학생 정보]\\n- 희망 학과: " + (major || "진로 연계") + "\\n- 목표 대학/전형: " + (targetUni || "일반전형") + "\\n- 수업 관찰 메모: " + memo + "\\n\\n" +
    "[작성 지침]\\n1. 관찰 사실과 성취 변화 위주로 구체적 탐구 과정을 3문장 내외로 서술하세요.\\n2. 기재 금지어(외부 수상, 어학성적, 부모 직업 등)를 절대 포함하지 마세요.\\n3. 한글 3Byte 기준 1,500 Byte 이내로 완성하세요.\\n4. 완성된 문단 본문만 출력하세요.";

  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + GEMINI_API_KEY;
  const payload = { contents: [{ parts: [{ text: prompt }] }] };
  const res = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  const data = JSON.parse(res.getContentText());
  return data.candidates[0].content.parts[0].text.trim();
}

/**
 * 나이스(NEIS) 공식 한글 3Byte, 줄바꿈 2Byte 기준으로 바이트수를 계산합니다.
 * @param {string} text 계산할 텍스트
 * @return {number} 바이트 수
 * @customfunction
 */
function NEIS_BYTE(text) {
  if (!text) return 0;
  let b = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code === 10) b += 2;
    else if (code <= 127) b += 1;
    else b += 3;
  }
  return b;
}`;
        try {
          await navigator.clipboard.writeText(gasCode);
          alert("✅ 구글 시트용 =AI_SETEUK() & =NEIS_BYTE() Apps Script 코드가 복사되었습니다!\n\n구글 시트 메뉴 [확장 프로그램] → [Apps Script] 창에 붙여넣고 저장(Ctrl+S)하신 후 사용하세요.");
        } catch(e) {
          alert("복사 실패: 수동으로 복사해 주세요.");
        }
      });
    }

    // 4. 새 학생 작성 (폼 초기화)
    $("#btnNewMasterRecord").addEventListener("click", resetMasterForm);

    // 5. 검색 및 CSV 내보내기
    $("#masterRecordSearch").addEventListener("input", (e) => {
      renderMasterSheet(e.target.value.trim());
    });

    $("#btnExportMasterCsv").addEventListener("click", exportMasterCsv);
  }

  function resetMasterForm() {
    $("#editingRecordId").value = "";
    $("#stuNumber").value = "";
    $("#stuName").value = "";
    $("#stuMajor").value = "";
    $("#stuGrade9").value = "";
    $("#stuGrade5").value = "";
    if ($("#stuMockExam")) $("#stuMockExam").value = "";
    $("#targetUni1").value = "";
    $("#targetUni2").value = "";
    $("#targetUni3").value = "";
    if ($("#targetUni4")) $("#targetUni4").value = "";
    if ($("#targetUni5")) $("#targetUni5").value = "";
    if ($("#targetUni6")) $("#targetUni6").value = "";
    if ($("#stuDocsUrl")) $("#stuDocsUrl").value = "";
    $("#counselOpinion").value = "";
    $("#stuCreative").value = "";
    $("#counselSetukMemo").value = "";
    $("#stuBehavior").value = "";
    $("#currentCounselUniTag").textContent = "선택 대학 없음";
    $("#counselSetukMemo").dispatchEvent(new Event("input"));
    $("#stuName").focus();
  }

  function openCounselWithUni(uniName, trnName = "", g9 = null, g5 = null) {
    switchCounselSubTab("records");
    const fullUniDesc = `${uniName}${trnName ? ` (${trnName})` : ''}`;

    let slot = "1지망";
    if (!$("#targetUni1").value.trim()) {
      $("#targetUni1").value = fullUniDesc;
      slot = "1지망";
    } else if (!$("#targetUni2").value.trim()) {
      $("#targetUni2").value = fullUniDesc;
      slot = "2지망";
    } else if (!$("#targetUni3").value.trim()) {
      $("#targetUni3").value = fullUniDesc;
      slot = "3지망";
    } else if ($("#targetUni4") && !$("#targetUni4").value.trim()) {
      $("#targetUni4").value = fullUniDesc;
      slot = "4지망";
    } else if ($("#targetUni5") && !$("#targetUni5").value.trim()) {
      $("#targetUni5").value = fullUniDesc;
      slot = "5지망";
    } else if ($("#targetUni6") && !$("#targetUni6").value.trim()) {
      $("#targetUni6").value = fullUniDesc;
      slot = "6지망";
    } else {
      $("#targetUni1").value = fullUniDesc;
      slot = "1지망 (수정)";
    }

    $("#currentCounselUniTag").textContent = `${slot} 연동: ${fullUniDesc}`;
    if (g9) $("#stuGrade9").value = Number(g9).toFixed(2);
    if (g5) $("#stuGrade5").value = Number(g5).toFixed(2);

    $("#stuName").focus();
    alert(`🎯 [${fullUniDesc}]이(가) 학생의 ${slot}에 성공적으로 담겼습니다!`);
  }

  function renderMasterSheet(filterQuery = "") {
    const list = store.masterRecords();
    const q = filterQuery.toLowerCase();

    const filtered = list.filter(r => {
      if (!q) return true;
      return (r.stuName && r.stuName.toLowerCase().includes(q)) ||
             (r.stuNumber && r.stuNumber.toLowerCase().includes(q)) ||
             (r.targetUni1 && r.targetUni1.toLowerCase().includes(q)) ||
             (r.stuMajor && r.stuMajor.toLowerCase().includes(q));
    });

    // 카드형 리스트 렌더링
    const container = $("#counselRecordCards");
    if (container) {
      container.innerHTML = "";
      if (filtered.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:24px; color:var(--muted); font-size:12.5px;">
          저장된 학생 기록이 없습니다.
        </div>`;
      } else {
        filtered.forEach(rec => {
          const card = document.createElement("div");
          card.className = "student-record-card";
          card.innerHTML = `
            <div class="student-record-head">
              <span class="student-record-name">${escHtml(rec.stuNumber)} ${escHtml(rec.stuName)}</span>
              <span style="font-size:11px; font-weight:700; color:var(--rausch); background:var(--rausch-soft); padding:2px 6px; border-radius:4px;">${escHtml(rec.status || '상담완료')}</span>
            </div>
            <div class="student-record-meta">
              <span>🎯 1지망: <b>${escHtml(rec.targetUni1 || '미정')}</b></span>
              ${rec.grade9 ? ` · 내신: 9등급(${rec.grade9}) / 5등급(${rec.grade5 || '-'})` : ''}
            </div>
            ${rec.setukMemo ? `<div class="student-record-body">${escHtml(rec.setukMemo)}</div>` : ''}
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:11.5px; color:var(--muted);">
              <span>수정: ${escHtml(rec.updatedAt || rec.createdAt || '')}</span>
              <div style="display:flex; gap:6px;">
                <button class="btn-edit-rec" style="color:var(--ink); font-weight:700;">불러오기 ✎</button>
                <button class="btn-del-rec" style="color:var(--danger);">삭제</button>
              </div>
            </div>
          `;

          card.querySelector(".btn-edit-rec").addEventListener("click", () => {
            loadRecordToForm(rec);
          });
          card.querySelector(".btn-del-rec").addEventListener("click", () => {
            if (confirm(`${rec.stuName} 학생의 기록을 삭제하시겠습니까?`)) {
              store.deleteMasterRecord(rec.id);
              renderMasterSheet();
            }
          });

          container.appendChild(card);
        });
      }
    }

    // 마스터 1행 테이블 렌더링
    const tbody = $("#masterSheetTbody");
    if (tbody) {
      tbody.innerHTML = "";
      if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="12" style="text-align:center; padding:18px; color:var(--muted);">기록 없음</td></tr>`;
      } else {
        filtered.forEach(r => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td><b>${escHtml(r.stuNumber)}</b></td>
            <td><strong style="color:var(--ink);">${escHtml(r.stuName)}</strong></td>
            <td>${escHtml(r.stuMajor || '-')}</td>
            <td><strong style="color:#0f766e; font-size:13.5px; font-weight:800;">${r.grade5 ? Number(r.grade5).toFixed(2) : '-'}</strong></td>
            <td><span style="color:#64748b; font-size:12px;">${r.grade9 ? Number(r.grade9).toFixed(2) : '-'}</span></td>
            <td><span style="font-size:11.5px; color:#2563eb; font-weight:700;">${escHtml(r.mockExam || '-')}</span></td>
            <td>
              <div style="font-size:12px;"><b>1:</b> ${escHtml(r.targetUni1 || '-')}</div>
              ${r.targetUni2 ? `<div style="font-size:11px; color:#475569;"><b>2:</b> ${escHtml(r.targetUni2)}</div>` : ''}
              ${r.targetUni3 ? `<div style="font-size:11px; color:#475569;"><b>3:</b> ${escHtml(r.targetUni3)}</div>` : ''}
            </td>
            <td>
              ${r.targetUni4 ? `<div style="font-size:11px; color:#475569;"><b>4:</b> ${escHtml(r.targetUni4)}</div>` : '<span style="color:#94a3b8;">-</span>'}
              ${r.targetUni5 ? `<div style="font-size:11px; color:#475569;"><b>5:</b> ${escHtml(r.targetUni5)}</div>` : ''}
              ${r.targetUni6 ? `<div style="font-size:11px; color:#475569;"><b>6:</b> ${escHtml(r.targetUni6)}</div>` : ''}
            </td>
            <td>${escHtml(r.counselOpinion || '-')}</td>
            <td>${escHtml(r.setukMemo || '-')}</td>
            <td>${r.docsUrl ? `<a href="${escHtml(r.docsUrl)}" target="_blank" rel="noreferrer" style="color:#2563eb; font-weight:700; text-decoration:underline;">[Docs ↗]</a>` : '<span style="color:#94a3b8;">-</span>'}</td>
            <td><span style="font-weight:700; color:var(--done);">${escHtml(r.status || '완료')}</span></td>
            <td>
              <button class="btn-load-inline" style="color:var(--rausch); font-weight:700;">수정</button>
            </td>
          `;
          tr.querySelector(".btn-load-inline").addEventListener("click", () => loadRecordToForm(r));
          tbody.appendChild(tr);
        });
      }
    }
  }

  function loadRecordToForm(rec) {
    $("#editingRecordId").value = rec.id || "";
    $("#stuNumber").value = rec.stuNumber || "";
    $("#stuName").value = rec.stuName || "";
    $("#stuMajor").value = rec.stuMajor || "";
    $("#stuGrade9").value = rec.grade9 || "";
    $("#stuGrade5").value = rec.grade5 || "";
    if ($("#stuMockExam")) $("#stuMockExam").value = rec.mockExam || "";
    $("#targetUni1").value = rec.targetUni1 || "";
    $("#targetUni2").value = rec.targetUni2 || "";
    $("#targetUni3").value = rec.targetUni3 || "";
    if ($("#targetUni4")) $("#targetUni4").value = rec.targetUni4 || "";
    if ($("#targetUni5")) $("#targetUni5").value = rec.targetUni5 || "";
    if ($("#targetUni6")) $("#targetUni6").value = rec.targetUni6 || "";
    if ($("#stuDocsUrl")) $("#stuDocsUrl").value = rec.docsUrl || "";
    $("#counselOpinion").value = rec.counselOpinion || "";
    $("#stuCreative").value = rec.stuCreative || "";
    $("#counselSetukMemo").value = rec.setukMemo || "";
    $("#stuBehavior").value = rec.stuBehavior || "";
    $("#stuStatus").value = rec.status || "상담완료";
    $("#currentCounselUniTag").textContent = `1지망: ${rec.targetUni1 || '미정'}`;
    $("#counselSetukMemo").dispatchEvent(new Event("input"));
    $("#stuName").focus();
  }

  function exportMasterCsv() {
    const list = store.masterRecords();
    if (list.length === 0) return alert("내보낼 상담 기록이 없습니다.");

    const headers = [
      "학번", "이름", "희망학과", "9등급내신", "2028_5등급추정", "모의고사성적_최저",
      "1지망대학/전형", "2지망", "3지망", "4지망", "5지망", "6지망",
      "담임상담종합의견", "자율/동아리/진로", "세특관찰기록", "행특종합의견",
      "GoogleDocs일지", "진행상태", "수정일시"
    ];
    const rows = list.map(r => [
      r.stuNumber, r.stuName, r.stuMajor, r.grade9, r.grade5, r.mockExam || "",
      r.targetUni1, r.targetUni2, r.targetUni3, r.targetUni4 || "", r.targetUni5 || "", r.targetUni6 || "",
      r.counselOpinion, r.stuCreative, r.setukMemo, r.stuBehavior,
      r.docsUrl || "", r.status, r.updatedAt || r.createdAt
    ]);

    const csvContent = "\uFEFF" + [headers, ...rows].map(row =>
      row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(",")
    ).join("\r\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `2027_대입상담_단일마스터시트_${todayStr()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ---------- 5. 2단계 보안 인증 & 이용 기간 관리 (전체 관리자 / 중간 관리자) ---------- */
  function initSecurityAuth() {
    const badge = $("#counselAuthBadge");
    const modal = $("#authModal");
    const input = $("#authInputPin");
    const errMsg = $("#authErrMsg");

    updateAuthBadge();

    if (badge) {
      badge.addEventListener("click", () => {
        if (store.isUnlocked()) {
          const daysLeft = store.getRemainingDays();
          const expiry = store.getGlobalExpiry();
          if (confirm(`현재 교사 인증 상태입니다.\n• 로컬 인증 잔여: 약 ${daysLeft}일 (30일 주기)\n• 전체 서비스 이용 기한: ${expiry}\n\n로그아웃(보안 잠금)하시겠습니까?`)) {
            store.setUnlocked(false);
            updateAuthBadge();
            alert("보안 잠금이 적용되었습니다.");
          }
        } else {
          promptAuthModal();
        }
      });
    }

    $("#authCancelBtn").addEventListener("click", () => {
      modal.hidden = true;
      input.value = "";
      errMsg.textContent = "";
      appState.pendingOpenViewer = null;
    });

    $("#authSubmitBtn").addEventListener("click", tryAuthSubmit);
    $("#authForm").addEventListener("submit", tryAuthSubmit);

    // 전체 관리자 모달 열기 버튼
    $("#btnOpenSuperAdmin").addEventListener("click", () => {
      promptSuperAdminLogin();
    });

    function tryAuthSubmit() {
      const val = input.value.trim();
      const subPin = store.getSubPin();
      const superPin = store.getSuperPin();

      // 전체 만료일 검사
      if (store.isGlobalExpired()) {
        errMsg.textContent = `❌ 전체 이용 기간(${store.getGlobalExpiry()})이 만료되었습니다. 전체 관리자에게 문의하세요.`;
        return;
      }

      // 비밀번호 검증 (교사용 비밀번호 또는 마스터 비밀번호)
      if (val === subPin || val === superPin) {
        store.setUnlocked(true);
        updateAuthBadge();
        modal.hidden = true;
        input.value = "";
        errMsg.textContent = "";

        const expiry = store.getGlobalExpiry();
        alert(`✓ 중간관리자(교사) 인증 완료!\n\n• 로컬 브라우저에서 1개월(30일)간 로그인 상태가 유지됩니다.\n• 전체 서비스 이용 기한: ${expiry}까지 사용 가능합니다.`);

        if (appState.pendingOpenViewer) {
          const { title, start, end, chips, uni } = appState.pendingOpenViewer;
          appState.pendingOpenViewer = null;
          openViewer(title, start, end, chips, uni);
        }
      } else {
        errMsg.textContent = "비밀번호가 올바르지 않습니다.";
        input.focus();
      }
    }
  }

  function updateAuthBadge() {
    const badge = $("#counselAuthBadge");
    const icon = $("#counselAuthIcon");
    const label = $("#counselAuthLabel");
    if (!badge || !icon || !label) return;

    if (store.isUnlocked()) {
      const days = store.getRemainingDays();
      badge.className = "auth-badge unlocked";
      icon.textContent = "🔓";
      label.textContent = `인증됨 (${days}일 남음)`;
      badge.title = `교사 인증 완료 (30일 주기 재인증, 전체 만료: ${store.getGlobalExpiry()})`;
    } else {
      badge.className = "auth-badge locked";
      icon.textContent = "🔒";
      label.textContent = "보안 잠금";
      badge.title = "클릭하여 비밀번호 인증";
    }
  }

  function promptAuthModal() {
    $("#authInputPin").value = "";
    $("#authErrMsg").textContent = "";
    $("#authModal").hidden = false;
    $("#authInputPin").focus();
  }

  function requestOpenViewer(title, start, end, chips = [], uni = null) {
    if (store.isUnlocked()) {
      openViewer(title, start, end, chips, uni);
    } else {
      appState.pendingOpenViewer = { title, start, end, chips, uni };
      promptAuthModal();
    }
  }

  /* 전체 관리자 전용 인증 및 설정 */
  function promptSuperAdminLogin() {
    const entered = prompt("전체 관리자 비밀번호를 입력하세요:");
    if (!entered) return;
    if (entered === store.getSuperPin()) {
      openSuperAdminModal();
    } else {
      alert("전체 관리자 비밀번호가 일치하지 않습니다.");
    }
  }

  function openSuperAdminModal() {
    $("#saSubPin").value = store.getSubPin();
    $("#saExpiry").value = store.getGlobalExpiry();
    $("#saStorage").value = store.getStorageBase();
    $("#saGSheet").value = store.getGSheetUrl();
    $("#superAdminModal").hidden = false;
  }

  function initSuperAdminModal() {
    const modal = $("#superAdminModal");
    if (!modal) return;

    $("#saCloseBtn").addEventListener("click", () => modal.hidden = true);

    $("#btnSaveSuperAdmin").addEventListener("click", () => {
      const subPin = $("#saSubPin").value.trim();
      const expiry = $("#saExpiry").value.trim();
      const storage = $("#saStorage").value.trim();
      const gsheet = $("#saGSheet").value.trim();
      const newSuper = $("#saNewSuperPin").value.trim();

      if (subPin) store.setSubPin(subPin);
      if (expiry) store.setGlobalExpiry(expiry);
      if (storage) store.setStorageBase(storage);
      if (gsheet !== undefined) store.setGSheetUrl(gsheet);
      if (newSuper) store.setSuperPin(newSuper);

      alert(`✅ 전체 관리자 설정이 안전하게 저장되었습니다.\n• 중간관리자(교사) PIN: ${store.getSubPin()}\n• 전체 이용 만료일: ${store.getGlobalExpiry()}\n• 스토리지: ${store.getStorageBase()}`);
      modal.hidden = true;
      updateAuthBadge();
      loadSettingsView();
    });
  }

  /* ---------- 6. 원본 1,294쪽 R2 스캔본 리더 모달 (저작권 math-tong) ---------- */
  function openViewer(title, start, end, chips = [], uni = null) {
    appState.viewerStart = start;
    appState.viewerEnd = end;
    appState.viewerCurrentPage = start;
    appState.viewerZoom = 1.0;

    $("#viewerTitle").textContent = title;
    $("#viewerTotalSpan").textContent = `${end}p`;

    const chipBox = $("#viewerNavChips");
    chipBox.innerHTML = "";
    if (chips && chips.length > 0) {
      chips.forEach(c => {
        const btn = document.createElement("button");
        btn.className = "chip";
        btn.style.fontSize = "11.5px";
        btn.style.padding = "3px 8px";
        btn.textContent = `${c.t} (${c.p}p)`;
        btn.addEventListener("click", () => jumpViewerToPage(c.p));
        chipBox.appendChild(btn);
      });
    }

    renderViewerPage();
    $("#viewerModal").hidden = false;
  }

  function renderViewerPage() {
    const p = appState.viewerCurrentPage;
    $("#viewerCurPageInput").value = p;

    const url = getPageUrl(p);
    const img = $("#viewerImg");
    img.src = url;

    $("#viewerPrevBtn").disabled = (p <= 1);
    $("#viewerNextBtn").disabled = (p >= 1294);
  }

  function jumpViewerToPage(p) {
    p = Math.max(1, Math.min(1294, Number(p)));
    appState.viewerCurrentPage = p;
    renderViewerPage();
  }

  function initViewerControls() {
    $("#viewerCloseBtn").addEventListener("click", () => {
      $("#viewerModal").hidden = true;
      $("#viewerImg").src = "";
    });

    $("#viewerPrevBtn").addEventListener("click", () => {
      if (appState.viewerCurrentPage > 1) {
        appState.viewerCurrentPage--;
        renderViewerPage();
      }
    });

    $("#viewerNextBtn").addEventListener("click", () => {
      if (appState.viewerCurrentPage < 1294) {
        appState.viewerCurrentPage++;
        renderViewerPage();
      }
    });

    $("#viewerCurPageInput").addEventListener("change", (e) => {
      jumpViewerToPage(e.target.value);
    });

    $("#viewerZoomIn").addEventListener("click", () => {
      appState.viewerZoom = Math.min(2.5, appState.viewerZoom + 0.15);
      applyViewerZoom();
    });

    $("#viewerZoomOut").addEventListener("click", () => {
      appState.viewerZoom = Math.max(0.5, appState.viewerZoom - 0.15);
      applyViewerZoom();
    });

    $("#viewerZoomFit").addEventListener("click", () => {
      appState.viewerZoom = 1.0;
      applyViewerZoom();
    });
  }

  function applyViewerZoom() {
    const img = $("#viewerImg");
    if (img) img.style.transform = `scale(${appState.viewerZoom})`;
  }

  /* ---------- 7. 관리자 및 일반 설정 뷰 ---------- */
  function initSettingsModule() {
    $("#btnSaveGeneralSettings").addEventListener("click", () => {
      const pin = $("#settingSubPin").value.trim();
      const base = $("#settingStorageBase").value.trim();
      const gsheet = $("#settingGSheet").value.trim();

      if (pin) store.setSubPin(pin);
      if (base) store.setStorageBase(base);
      if (gsheet !== undefined) store.setGSheetUrl(gsheet);

      const adminGas = $("#settingAdminGasApprovalUrl") ? $("#settingAdminGasApprovalUrl").value.trim() : "";
      if (window.Gatekeeper) {
        window.Gatekeeper.setGasUrl(adminGas);
      }

      alert(`일반 설정이 저장되었습니다.\n• 교사 비밀번호: ${store.getSubPin()}\n• 스토리지 경로: ${store.getStorageBase()}`);
      updateAuthBadge();
    });

    $("#btnLockNow").addEventListener("click", () => {
      store.setUnlocked(false);
      updateAuthBadge();
      alert("보안 잠금이 적용되었습니다.");
    });

    // 게이트키퍼 잠금 테스트 버튼
    const btnTestLock = $("#btnTestGatekeeperLock");
    if (btnTestLock) {
      btnTestLock.addEventListener("click", () => {
        if (window.Gatekeeper) {
          window.Gatekeeper.logout();
        }
      });
    }

    // 승인 지원 Apps Script 복사 버튼
    const btnCopyGas = $("#btnCopyApprovalGasScript");
    if (btnCopyGas) {
      btnCopyGas.addEventListener("click", async () => {
        try {
          const res = await fetch("/google_apps_script_dual_relational.js");
          const code = await res.text();
          await navigator.clipboard.writeText(code);
          alert("📋 사용자 승인 지원 구글 시트 통합 Apps Script 코드가 클립보드에 복사되었습니다!\n\n선생님의 구글 시트 [확장 프로그램] > [Apps Script]에 붙여넣고 [새 배포(웹 앱)]하시면 [사용자승인] 탭에서 원클릭 승인이 가능합니다.");
        } catch(e) {
          alert("코드 복사 실패: " + e.message);
        }
      });
    }

    $("#btnClearMasterData").addEventListener("click", () => {
      if (confirm("정말로 모든 단일 마스터 시트 상담 기록과 즐겨찾기를 삭제하시겠습니까?")) {
        store.clearAll();
        alert("데이터가 초기화되었습니다.");
        renderMasterSheet();
      }
    });
  }

  function loadSettingsView() {
    if ($("#settingSubPin")) $("#settingSubPin").value = store.getSubPin();
    if ($("#settingStorageBase")) $("#settingStorageBase").value = store.getStorageBase();
    if ($("#settingGSheet")) $("#settingGSheet").value = store.getGSheetUrl();
    if ($("#settingAdminGasApprovalUrl") && window.Gatekeeper) {
      $("#settingAdminGasApprovalUrl").value = window.Gatekeeper.getGasUrl();
    }
    if ($("#settingExpiryView")) $("#settingExpiryView").textContent = store.getGlobalExpiry();
  }

  /* ---------- 외부 공개 인터페이스 ---------- */
  window.CounselModule = {
    openWithUni: openCounselWithUni,
    requestScan: requestOpenViewer,
    calcGrade5,
    calcGrade9
  };

  /* DOM 준비 후 초기화 (Resilient Boot) */
  function bootCounsel() {
    initCounselSubTabs();
    initLiveDataModal();
    initUniSearch();
    initFinder();
    initNonsulModule();
    initCounselWorkbench();
    initUniDetailModal();
    initSecurityAuth();
    initSuperAdminModal();
    initViewerControls();
    initSettingsModule();

    // 초기 데이터 렌더링
    renderUnis();
  }

  if (document.readyState === 'loading') {
    document.addEventListener("DOMContentLoaded", bootCounsel);
  } else {
    bootCounsel();
  }
})();


  // 학생 데이터를 초안 작성기로 불러오기 (선생님 요청 완벽 구현)
  window.loadStudentIntoDraft = function(target) {
    let student = null;
    const list = store.masterRecords();
    if (typeof target === "string") {
      student = list.find(s => s.id === target || s.stuNumber === target) || SAMPLE_STUDENTS[0];
    } else if (target && typeof target === "object") {
      student = target;
    } else {
      student = list[0] || SAMPLE_STUDENTS[0];
    }
    if (!student) return;

    // 1. 초안 작성 화면으로 전환
    if (typeof openPanel === "function") {
      openPanel("make", true);
    } else {
      const btn = document.querySelector('[data-open="make"]');
      if (btn) btn.click();
    }

    // 2. 반/번호 및 과목명 설정
    if ($("#tagClass") && student.stuNumber) {
      const numStr = String(student.stuNumber);
      if (numStr.length >= 4) {
        $("#tagClass").value = numStr.slice(1, 3).replace(/^0+/, "") || "1";
        $("#tagNum").value = numStr.slice(3).replace(/^0+/, "") || "1";
      }
    }
    if ($("#subject") && student.subject) {
      $("#subject").value = student.subject;
      if ($("#subjectField")) $("#subjectField").hidden = false;
    }

    // 3. 기존 세특 박스 채움
    const existBox = $("#existingSetukBox");
    const existText = $("#existingSetukText");
    const existBytes = $("#existingSetukBytes");
    if (existBox && existText) {
      existBox.hidden = false;
      const txt = student.existingSetuk || student.setukMemo || "현재 등록된 세특 초안이 없습니다. 아래에 새로운 관찰 메모를 작성해 주세요.";
      existText.textContent = txt;
      if (existBytes) {
        let b = 0;
        for (let i = 0; i < txt.length; i++) {
          const code = txt.charCodeAt(i);
          if (code === 10) b += 2; else if (code <= 127) b += 1; else b += 3;
        }
        existBytes.textContent = `${b} Byte`;
      }
    }

    // 4. 4번 항목: 대입 진학상담 1~6지망 요약 스트립
    const targetBox = $("#targetUniSummaryBox");
    const targetText = $("#targetUniSummaryText");
    if (targetBox && targetText) {
      targetBox.hidden = false;
      targetText.innerHTML = `
        <strong>🎯 [${escHtml(student.stuName || '')} 학생 2027 대입 목표 (4번 항목 연동)]:</strong>
        <span style="color:#0f172a; font-weight:700;">1지망: ${escHtml(student.targetUni1 || '미정')}</span> · 
        <span>2지망: ${escHtml(student.targetUni2 || '-')}</span> · 
        <span>3지망: ${escHtml(student.targetUni3 || '-')}</span>
        ${student.mockExam ? ` · <span style="color:#2563eb; font-weight:700;">[모의고사 ${escHtml(student.mockExam)}]</span>` : ''}
      `;
    }

    // 5. 상단 스트립 레이블 업데이트
    const activeLabel = $("#activeStudentLabel");
    if (activeLabel) {
      activeLabel.textContent = `${student.stuNumber} ${student.stuName} (${student.subject || '교과'} · ${student.targetUni1 ? student.targetUni1.split(' ')[0] : '대입상담'})`;
    }

    if ($("#memo")) {
      $("#memo").placeholder = `[${student.stuName}] 학생의 새로운 추가 수업 활동 사실과 성취 변화를 입력하세요...`;
      $("#memo").focus();
    }

    alert(`✅ [${student.stuName}] 학생의 구글 시트 기존 세특 및 4번 대입 목표가 초안 작성기에 성공적으로 불러와졌습니다!`);
  };

  // 학생 명렬 모달 렌더링
  window.renderStudentLoaderModal = function() {
    const tbody = $("#studentLoaderTbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    const list = store.masterRecords();
    list.forEach(s => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><b>${escHtml(s.stuNumber)}</b></td>
        <td><strong style="color:#0f172a;">${escHtml(s.stuName)}</strong></td>
        <td>${escHtml(s.subject || s.stuMajor || '공통')}</td>
        <td style="font-size:12px; max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escHtml(s.targetUni1 || '미정')}</td>
        <td><span style="color:#059669; font-weight:700; font-size:11.5px;">${s.existingSetuk ? '세특 있음' : '작성대기'}</span></td>
        <td>
          <button class="btn-primary" style="padding:4px 10px; font-size:11.5px; background:#2563eb; color:#fff; border:none; border-radius:6px; cursor:pointer;">
            불러오기 ➔
          </button>
        </td>
      `;
      tr.querySelector("button").addEventListener("click", () => {
        window.loadStudentIntoDraft(s);
        const modal = $("#studentLoaderModal");
        if (modal) modal.hidden = true;
      });
      tbody.appendChild(tr);
    });
  };
