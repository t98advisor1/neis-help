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
    "가톨릭대학교": "https://ipsi.catholic.ac.kr/",
    "강원대학교": "https://admission.kangwon.ac.kr/",
    "건국대학교": "https://ibhak.konkuk.ac.kr/",
    "경기대학교": "https://enter.kyonggi.ac.kr/",
    "경북대학교": "https://ipsi1.knu.ac.kr/",
    "경상국립대학교": "https://new.gnu.ac.kr/ipsi/",
    "경희대학교": "https://iphak.khu.ac.kr/",
    "고려대학교": "https://oku.korea.ac.kr/",
    "광운대학교": "https://iphak.kw.ac.kr/",
    "국민대학교": "https://admission.kookmin.ac.kr/",
    "단국대학교": "https://ipsi.dankook.ac.kr/",
    "동국대학교": "https://ipsi.dongguk.edu/",
    "동덕여자대학교": "https://ipsi.dongduk.ac.kr/",
    "명지대학교": "https://ipsi.mju.ac.kr/",
    "부산대학교": "https://go.pusan.ac.kr/",
    "상명대학교": "https://admission.smu.ac.kr/",
    "서강대학교": "https://admission.sogang.ac.kr/",
    "서경대학교": "https://go.skuniv.ac.kr/",
    "서울과학기술대학교": "https://admission.seoultech.ac.kr/",
    "서울대학교": "https://admission.snu.ac.kr/",
    "서울시립대학교": "https://admission.uos.ac.kr/",
    "서울여자대학교": "https://admission.swu.ac.kr/",
    "성균관대학교": "https://admission.skku.edu/",
    "성신여자대학교": "https://ipsi.sungshin.ac.kr/",
    "세종대학교": "https://ipsi.sejong.ac.kr/",
    "숙명여자대학교": "https://admission.sookmyung.ac.kr/",
    "숭실대학교": "https://iphak.ssu.ac.kr/",
    "아주대학교": "https://www.iajou.ac.kr/",
    "연세대학교": "https://admission.yonsei.ac.kr/",
    "이화여자대학교": "https://admission.ewha.ac.kr/",
    "인하대학교": "https://admission.inha.ac.kr/",
    "중앙대학교": "https://admission.cau.ac.kr/",
    "한국외국어대학교": "https://adms.hufs.ac.kr/",
    "한국항공대학교": "https://ibhak.kau.ac.kr/",
    "한양대학교": "https://go.hanyang.ac.kr/",
    "홍익대학교": "https://admission.hongik.ac.kr/"
  };

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

    // 6. 구글 시트 웹앱 URL
    getGSheetUrl() { return localStorage.getItem("swk_gsheet_url") || ""; },
    setGSheetUrl(u) { localStorage.setItem("swk_gsheet_url", u.trim()); },

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

    // 8. 단일 마스터 시트 상담/세특 기록 (1학생 1행 구조)
    masterRecords() {
      try { return JSON.parse(localStorage.getItem("swk_master_records") || "[]"); } catch(e) { return []; }
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

    finderMode: "9",
    finderGrade9: 2.50,
    finderGrade5: 2.11,
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

  function switchCounselSubTab(tab) {
    appState.currentSubTab = tab;
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
    else if (tab === "settings") loadSettingsView();
  }

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
              <h3 class="uni-name">${escHtml(u.name)}</h3>
              <span class="uni-badge-region ${u.m15 ? 'm15' : ''}">${escHtml(u.region)}</span>
              ${u.m15 ? '<span class="uni-badge-region m15" style="background:#fee2e2; color:#ef4444;">주요15개대</span>' : ''}
            </div>
            <button class="fav-btn ${isFav ? 'on' : ''}" title="즐겨찾기" data-fav-id="${u.id}">★</button>
          </div>

          <div class="uni-specs">
            <span class="uni-spec-item">분류: ${escHtml(u.cat || "일반대학")}</span>
            <span class="uni-spec-item">자료 페이지: ${u.start}~${u.end}p</span>
          </div>
        </div>

        <div class="uni-card-foot">
          <span style="font-size:11.5px; color:var(--muted)">전형 입결 & 5등급 환산</span>
          <span class="uni-foot-action">상세 분석 & 세특 담기 →</span>
        </div>
      `;

      card.addEventListener("click", (e) => {
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
          const adigaUrl = `https://www.adiga.kr/man/sch/searchView.do?menuId=PCMANSCH5001&checkMiss=1&search=${encodeURIComponent(uni.name)}`;
          window.open(adigaUrl, "_blank", "noopener,noreferrer");
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

    // 계열 필터 칩
    $$("#counselSubFinder [data-finder-trk]").forEach(chip => {
      chip.addEventListener("click", () => {
        $$("#counselSubFinder [data-finder-trk]").forEach(c => c.classList.remove("on"));
        chip.classList.add("on");
        appState.finderTrk = chip.dataset.finderTrk;
        renderFinder();
      });
    });

    // 전형 유형 칩
    $$("#counselSubFinder [data-finder-ty]").forEach(chip => {
      chip.addEventListener("click", () => {
        $$("#counselSubFinder [data-finder-ty]").forEach(c => c.classList.remove("on"));
        chip.classList.add("on");
        appState.finderTy = chip.dataset.finderTy;
        renderFinder();
      });
    });

    // 지역 칩
    $$("#counselSubFinder [data-finder-reg]").forEach(chip => {
      chip.addEventListener("click", () => {
        $$("#counselSubFinder [data-finder-reg]").forEach(c => c.classList.remove("on"));
        chip.classList.add("on");
        appState.finderReg = chip.dataset.finderReg;
        renderFinder();
      });
    });

    // 오차 범위 칩
    $$("#counselSubFinder [data-finder-range]").forEach(chip => {
      chip.addEventListener("click", () => {
        $$("#counselSubFinder [data-finder-range]").forEach(c => c.classList.remove("on"));
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

    const targetG9 = appState.finderGrade9 || 2.50;
    const range = appState.finderRange || 0.3;
    const minG = targetG9 - range;
    const maxG = targetG9 + range;

    const filtered = GRADEDB.filter(r => {
      const [trk, reg, ty, uName, trnName, g9, fillRate, page, med] = r;
      if (appState.finderTrk !== "전체" && trk !== appState.finderTrk) return false;
      if (appState.finderTy !== "전체" && ty !== appState.finderTy) return false;

      if (appState.finderReg !== "전체") {
        if (appState.finderReg === "수도권" && reg !== "수") return false;
        if (appState.finderReg === "비수도권" && reg !== "비") return false;
      }

      if (g9 == null || g9 < minG || g9 > maxG) return false;
      return true;
    });

    // 등록자 평균 내림차순 정렬
    filtered.sort((a, b) => a[5] - b[5]);

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

      const diff = g9 - targetG9;
      let diffHtml = "";
      if (Math.abs(diff) < 0.05) diffHtml = '<span style="color:#0a7d55; font-size:11.5px; font-weight:700;">(적정)</span>';
      else if (diff > 0) diffHtml = `<span style="color:#2563eb; font-size:11.5px;">(+${diff.toFixed(2)} 안정)</span>`;
      else diffHtml = `<span style="color:#dc2626; font-size:11.5px;">(${diff.toFixed(2)} 소신)</span>`;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong style="color:var(--ink);">${escHtml(uName)}</strong> ${med ? `<span style="font-size:11px; color:#c13515;">(${med})</span>` : ''}</td>
        <td><span class="uni-spec-item">${trkMap[trk] || trk}</span></td>
        <td><span class="uni-spec-item">${tyMap[ty] || ty}</span></td>
        <td><b>${escHtml(trnName)}</b></td>
        <td><strong style="color:var(--rausch);">${g9.toFixed(2)}</strong> ${diffHtml}</td>
        <td><span style="font-weight:700; color:#0f766e;">${g5 ? g5.toFixed(2) : '-'}</span></td>
        <td>
          <button class="btn-primary" style="padding:4px 9px; font-size:11.5px;" data-f-uni="${escHtml(uName)}" data-f-trn="${escHtml(trnName)}">
            ✍️ 세특/상담 담기
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
        <td><strong style="color:var(--ink);">${escHtml(uName)}</strong></td>
        <td><b>${escHtml(trnName)}</b></td>
        <td>${escHtml(num)}명</td>
        <td>${escHtml(method)}</td>
        <td><span style="font-size:12px; color:${csat.startsWith('O') ? 'var(--rausch)' : 'var(--muted)'}; font-weight:700;">${escHtml(csat)}</span></td>
        <td>
          <button class="btn-primary" style="padding:4px 9px; font-size:11.5px;">
            ✍️ 세특/상담 담기
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
        targetUni1: $("#targetUni1").value.trim(),
        targetUni2: $("#targetUni2").value.trim(),
        targetUni3: $("#targetUni3").value.trim(),
        counselOpinion: $("#counselOpinion").value.trim(),
        stuCreative: $("#stuCreative").value.trim(),
        setukMemo: counselText ? counselText.value.trim() : "",
        stuBehavior: $("#stuBehavior").value.trim(),
        status: $("#stuStatus").value || "상담완료"
      };

      store.saveMasterRecord(rec);
      renderMasterSheet();

      // 구글 시트 웹앱 URL이 등록되어 있으면 자동 동기화 시도
      const gsheetUrl = store.getGSheetUrl();
      if (gsheetUrl) {
        try {
          fetch(gsheetUrl, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(rec)
          }).catch(() => {});
        } catch(e) {}
      }

      alert(`✅ [${stuName}] 학생의 진학목표와 세특 기록이 단일 마스터 시트에 저장되었습니다!`);
    });

    
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
    $("#targetUni1").value = "";
    $("#targetUni2").value = "";
    $("#targetUni3").value = "";
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
    const targetField = $("#targetUni1");
    const fullUniDesc = `${uniName}${trnName ? ` (${trnName})` : ''}`;
    targetField.value = fullUniDesc;
    $("#currentCounselUniTag").textContent = `1지망 연동: ${fullUniDesc}`;

    if (g9) $("#stuGrade9").value = Number(g9).toFixed(2);
    if (g5) $("#stuGrade5").value = Number(g5).toFixed(2);

    $("#stuName").focus();
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
            <td>${escHtml(r.grade9 || '-')}</td>
            <td>${escHtml(r.grade5 || '-')}</td>
            <td><b>${escHtml(r.targetUni1 || '-')}</b></td>
            <td>${escHtml(r.targetUni2 || '-')}</td>
            <td>${escHtml(r.targetUni3 || '-')}</td>
            <td>${escHtml(r.counselOpinion || '-')}</td>
            <td>${escHtml(r.setukMemo || '-')}</td>
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
    $("#targetUni1").value = rec.targetUni1 || "";
    $("#targetUni2").value = rec.targetUni2 || "";
    $("#targetUni3").value = rec.targetUni3 || "";
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

    const headers = ["학번", "이름", "희망학과", "9등급내신", "5등급추정", "1지망대학/전형", "2지망", "3지망", "담임상담의견", "자율/동아리/진로", "국영수탐세특", "행특", "진행상태", "수정일"];
    const rows = list.map(r => [
      r.stuNumber, r.stuName, r.stuMajor, r.grade9, r.grade5,
      r.targetUni1, r.targetUni2, r.targetUni3, r.counselOpinion,
      r.stuCreative, r.setukMemo, r.stuBehavior, r.status, r.updatedAt || r.createdAt
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

      alert(`일반 설정이 저장되었습니다.\n• 교사 비밀번호: ${store.getSubPin()}\n• 스토리지 경로: ${store.getStorageBase()}`);
      updateAuthBadge();
    });

    $("#btnLockNow").addEventListener("click", () => {
      store.setUnlocked(false);
      updateAuthBadge();
      alert("보안 잠금이 적용되었습니다.");
    });

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
    if ($("#settingExpiryView")) $("#settingExpiryView").textContent = store.getGlobalExpiry();
  }

  /* ---------- 외부 공개 인터페이스 ---------- */
  window.CounselModule = {
    openWithUni: openCounselWithUni,
    requestScan: requestOpenViewer,
    calcGrade5,
    calcGrade9
  };

  /* DOM 준비 후 초기화 */
  document.addEventListener("DOMContentLoaded", () => {
    initCounselSubTabs();
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
  });
})();
