// js/gatekeeper.js — 교사 소속·이메일 미니멀 자동승인 & 학교알리미 API 검색 & 구글 계정 로그인 & 첫 화면 스크롤 잠금 시스템
(function() {
  'use strict';

  const AUTH_KEY = 'swk_gatekeeper_auth';
  const ADMIN_GAS_KEY = 'swk_admin_gas_approval_url';
  const MASTER_PIN_KEY = 'swk_master_approval_pin';
  const DEFAULT_MASTER_PIN = 'tong2026!';
  const THREE_MONTHS_MS = 90 * 24 * 60 * 60 * 1000; // 3개월 (90일) 기본 승인 유효기간

  // 내장 주요 고등학교 빠른 폴백 리스트 (오프라인/즉시 자동완성용)
  const QUICK_SCHOOLS = [
    { name: "신천고등학교", region: "경기 시흥시", office: "경기도교육청", kind: "일반고(공립)", code: "7530562", domain: "sch.hs.kr" },
    { name: "소래고등학교", region: "경기 시흥시", office: "경기도교육청", kind: "일반고(공립)", code: "7530175", domain: "goedu.kr" },
    { name: "은행고등학교", region: "경기 시흥시", office: "경기도교육청", kind: "일반고(공립)", code: "7530482", domain: "goedu.kr" },
    { name: "매화고등학교", region: "경기 시흥시", office: "경기도교육청", kind: "일반고(공립)", code: "7530633", domain: "goedu.kr" },
    { name: "시흥능곡고등학교", region: "경기 시흥시", office: "경기도교육청", kind: "일반고(공립)", code: "7530634", domain: "goedu.kr" },
    { name: "장곡고등학교", region: "경기 시흥시", office: "경기도교육청", kind: "일반고(공립)", code: "7530523", domain: "goedu.kr" },
    { name: "배곧고등학교", region: "경기 시흥시", office: "경기도교육청", kind: "일반고(공립)", code: "7531325", domain: "goedu.kr" },
    { name: "함현고등학교", region: "경기 시흥시", office: "경기도교육청", kind: "일반고(공립)", code: "7530524", domain: "goedu.kr" },
    { name: "서해고등학교", region: "경기 시흥시", office: "경기도교육청", kind: "일반고(공립)", code: "7530174", domain: "goedu.kr" },
    { name: "정왕고등학교", region: "경기 시흥시", office: "경기도교육청", kind: "일반고(공립)", code: "7530483", domain: "goedu.kr" },
    { name: "시흥고등학교", region: "경기 시흥시", office: "경기도교육청", kind: "일반고(공립)", code: "7530481", domain: "goedu.kr" },
    { name: "수원고등학교", region: "경기 수원시", office: "경기도교육청", kind: "일반고(사립)", code: "7530106", domain: "goedu.kr" },
    { name: "분당고등학교", region: "경기 성남시", office: "경기도교육청", kind: "일반고(공립)", code: "7530164", domain: "goedu.kr" },
    { name: "평촌고등학교", region: "경기 안양시", office: "경기도교육청", kind: "일반고(공립)", code: "7530128", domain: "goedu.kr" },
    { name: "부천고등학교", region: "경기 부천시", office: "경기도교육청", kind: "일반고(공립)", code: "7530133", domain: "goedu.kr" },
    { name: "광명고등학교", region: "경기 광명시", office: "경기도교육청", kind: "일반고(공립)", code: "7530139", domain: "goedu.kr" },
    { name: "수지고등학교", region: "경기 용인시", office: "경기도교육청", kind: "일반고(공립)", code: "7530198", domain: "goedu.kr" },
    { name: "서울신천고등학교", region: "서울 송파구", office: "서울특별시교육청", kind: "일반고(공립)", code: "7010198", domain: "sen.go.kr" }
  ];

  // 자동 승인 이메일 도메인 판별 (@sch.hs.kr, @sch.hs.k, @goedu.kr, @goe.go.kr, @korea.kr 및 학교/교육청 계정)
  
  // 교사 소속 학교 및 이메일 기반 최종 승인 판정 함수
  // - 신천고등학교 (@sch.hs.kr 또는 신천고 소속 @goedu.kr) -> 3개월 즉시 자동승인
  // - 신천고 외 타 학교 교육청 계정 (@goedu.kr, @korea.kr) -> 관리자 검토 대기
  // - 일반 개인 계정 (@gmail.com 등) -> 차단
  function checkTeacherApproval({ email, school }) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanSchool = String(school || '').trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return {
        auto: false,
        status: 'invalid_email',
        school: cleanSchool || '학교 미지정',
        badge: '이메일 형식 오류',
        message: '올바른 교사 이메일 주소를 입력해 주세요.'
      };
    }

    const [idPart, rawDomain] = cleanEmail.split('@');
    const domain = rawDomain.replace(/\.hs\.k$/, '.hs.kr').replace(/goedu\.kr\d+$/, 'goedu.kr');
    const isSincheon = cleanSchool.includes('신천');

    // 1. 신천고등학교 공식 도메인 (@sch.hs.kr) 또는 신천고 소속 경기도교육청 계정 (@goedu.kr + 신천고)
    if (domain === 'sch.hs.kr' || (domain === 'goedu.kr' && isSincheon)) {
      return {
        auto: true,
        status: 'approved_sincheon',
        school: '신천고등학교',
        normalizedEmail: `${idPart}@${domain}`,
        badge: '🎉 신천고등학교 공식 교사 3개월 즉시 자동승인',
        message: '✅ [신천고등학교] 공식 교사 계정 확인이 완료되었습니다!\n앞으로 3개월(90일) 동안 모든 생기부 점검 및 대입 진학상담 기능이 잠금 해제됩니다.'
      };
    }

    // 2. 신천고등학교가 아닌 타 학교 교육청 계정 (@goedu.kr, @goe.go.kr, @korea.kr, *.hs.kr 등)
    if (domain === 'goedu.kr' || domain === 'goe.go.kr' || domain === 'korea.kr' || domain.endsWith('.hs.kr') || domain.endsWith('.edu.kr')) {
      return {
        auto: false,
        status: 'pending_other_goedu',
        school: cleanSchool || '경기도교육청 소속교',
        badge: '⏳ 교육청 계정 관리자 추가 승인 대기',
        message: `⚠️ [${cleanSchool || '소속학교'}] 교육청 계정(${cleanEmail}) 신청이 접수되었습니다.\n\n신천고등학교 외 타 학교 교육청 계정은 관리자의 추가 승인 후 활성화됩니다. 신천고등학교 선생님이신 경우 학교명을 '신천고등학교'로 선택해 주시거나 마스터키를 이용해 주세요.`
      };
    }

    // 3. 일반 개인 이메일 계정 (@gmail.com, @naver.com 등)
    return {
      auto: false,
      status: 'rejected_personal',
      school: cleanSchool || '일반 계정',
      badge: '⛔ 교사용 공식 계정 필요',
      message: `❌ 본 서비스는 교사용 전용 서비스입니다.\n\n개인 이메일(${cleanEmail})은 사용할 수 없으며, 신천고(@sch.hs.kr) 또는 교육청(@goedu.kr) 계정으로 입력해 주시기 바랍니다.`
    };
  }

  function checkAutoApproveDomain(email) {
    const clean = String(email || '').trim().toLowerCase();
    if (!clean.includes('@')) return { auto: false, reason: '이메일 형식이 올바르지 않습니다.' };

    const [idPart, rawDomain] = clean.split('@');
    if (!idPart || !rawDomain) return { auto: false, reason: '이메일 아이디와 도메인을 확인해 주세요.' };

    // 오타 보정 (@sch.hs.k -> @sch.hs.kr, @goedu.kr9 -> @goedu.kr)
    const domain = rawDomain.replace(/\.hs\.k$/, '.hs.kr').replace(/goedu\.kr\d+$/, 'goedu.kr');

    // 1. 신천고등학교 (@sch.hs.kr, @sch.hs.k)
    if (domain === 'sch.hs.kr' || rawDomain === 'sch.hs.k' || domain.endsWith('.sch.hs.kr')) {
      return {
        auto: true,
        normalizedEmail: `${idPart}@sch.hs.kr`,
        defaultSchool: '신천고등학교',
        badge: '신천고등학교 공식 계정 자동승인'
      };
    }

    // 2. 경기도교육청 (@goedu.kr, @goe.go.kr)
    if (domain === 'goedu.kr' || domain.endsWith('.goedu.kr') || domain === 'goe.go.kr' || domain.endsWith('.goe.go.kr')) {
      return {
        auto: true,
        normalizedEmail: `${idPart}@${domain}`,
        defaultSchool: '경기도교육청 소속고교',
        badge: '경기도교육청 공식 계정 자동승인'
      };
    }

    // 3. 공직자통합메일 및 전국 시도교육청/각급학교 공식 도메인 (*.hs.kr, *.ms.kr, *.es.kr, *.sc.kr, *.edu.kr, *.go.kr, korea.kr)
    if (
      domain === 'korea.kr' ||
      domain.endsWith('.hs.kr') ||
      domain.endsWith('.ms.kr') ||
      domain.endsWith('.es.kr') ||
      domain.endsWith('.sc.kr') ||
      domain.endsWith('.edu.kr') ||
      domain.endsWith('.go.kr')
    ) {
      return {
        auto: true,
        normalizedEmail: `${idPart}@${domain}`,
        defaultSchool: '고등학교',
        badge: '학교·교육청 공식 계정 자동승인'
      };
    }

    return {
      auto: false,
      normalizedEmail: clean,
      defaultSchool: '',
      badge: '일반 이메일 계정'
    };
  }

  let scrollToastTimer = null;

  const Gatekeeper = {
    isMinimized: false,
    selectedSchoolObj: null,

    getMasterPin() {
      return localStorage.getItem(MASTER_PIN_KEY) || DEFAULT_MASTER_PIN;
    },

    setMasterPin(newPin) {
      if (newPin && newPin.trim()) {
        localStorage.setItem(MASTER_PIN_KEY, newPin.trim());
      }
    },

    getGasUrl() {
      const customUrl = localStorage.getItem(ADMIN_GAS_KEY);
      if (customUrl && customUrl.trim()) return customUrl.trim();
      const homeroomUrl = localStorage.getItem('swk_gsheet_homeroom_url') || localStorage.getItem('SR_GAS_HOMEROOM_URL');
      if (homeroomUrl && homeroomUrl.trim()) return homeroomUrl.trim();
      const singleUrl = localStorage.getItem('swk_gsheet_web_app_url') || localStorage.getItem('swk_gsheet_url');
      if (singleUrl && singleUrl.trim()) return singleUrl.trim();
      return '';
    },

    setGasUrl(url) {
      if (url && url.trim()) {
        localStorage.setItem(ADMIN_GAS_KEY, url.trim());
      } else {
        localStorage.removeItem(ADMIN_GAS_KEY);
      }
    },

    isAuthorized() {
      try {
        const raw = localStorage.getItem(AUTH_KEY);
        if (!raw) return false;
        const data = JSON.parse(raw);
        if (!data || data.approved !== true) return false;

        // 3개월 유효기간 만료 여부 확인
        if (data.expiresAt) {
          const expTime = new Date(data.expiresAt).getTime();
          if (Date.now() > expTime) {
            return false; // 기간 만료
          }
        }
        return true;
      } catch (e) {
        return false;
      }
    },

    getRemainingDays() {
      try {
        const user = this.getAuthUser();
        if (!user || !user.expiresAt) return null;
        const diffMs = new Date(user.expiresAt).getTime() - Date.now();
        return Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
      } catch (e) {
        return null;
      }
    },

    // 3개월 승인 연장 기능 (사용자 요청: "3개월 단위로 승인을 연장할 수 있도록 해주세요")
    extendAuth(months = 3) {
      const user = this.getAuthUser();
      if (!user) {
        alert('인증된 교사 정보가 없습니다. 먼저 학교와 이메일로 승인을 진행해 주세요.');
        return;
      }
      const addMs = months * 30 * 24 * 60 * 60 * 1000;
      const currentExp = user.expiresAt ? new Date(user.expiresAt).getTime() : Date.now();
      const baseTime = Math.max(Date.now(), currentExp);
      const newExpiresAt = new Date(baseTime + addMs).toISOString();

      user.approved = true;
      user.expiresAt = newExpiresAt;
      user.extendedAt = new Date().toISOString();
      localStorage.setItem(AUTH_KEY, JSON.stringify(user));

      const expDateStr = new Date(newExpiresAt).toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      this.updateUI();
      alert(`🎉 교사 승인 기간이 ${months}개월 연장되었습니다!\n(새 만료 예정일: ${expDateStr})`);
    },

    getAuthUser() {
      try {
        const raw = localStorage.getItem(AUTH_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
      } catch (e) {
        return null;
      }
    },

    authorize(userObj) {
      const now = new Date();
      const authData = Object.assign({
        approved: true,
        authDate: now.toISOString(),
        expiresAt: (userObj && userObj.expiresAt) || new Date(now.getTime() + THREE_MONTHS_MS).toISOString()
      }, userObj);
      localStorage.setItem(AUTH_KEY, JSON.stringify(authData));

      // 구글 계정 연동 상태도 함께 기록 (구글 시트 모듈과 유기적 연동)
      if (authData.email) {
        localStorage.setItem('SR_GOOGLE_USER', JSON.stringify({
          email: authData.email,
          name: authData.name || authData.email.split('@')[0],
          school: authData.school || '고등학교',
          connectedAt: authData.authDate
        }));
      }

      this.unlockScroll();
      this.closeModal();
      this.updateUI();
    },

    logout() {
      localStorage.removeItem(AUTH_KEY);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      this.lockScroll();
      this.isMinimized = false;
      this.openModal('apply');
      this.updateUI();
    },

    // 첫 화면(#hero)은 보이게 하되 미승인 시 화면 스크롤 잠금
    lockScroll() {
      if (this.isAuthorized()) {
        this.unlockScroll();
        return;
      }
      window.scrollTo(0, 0);
      document.documentElement.classList.add('gk-scroll-locked');
      document.body.classList.add('gk-scroll-locked');
    },

    unlockScroll() {
      document.documentElement.classList.remove('gk-scroll-locked');
      document.body.classList.remove('gk-scroll-locked');
      const toast = document.getElementById('gkScrollLockNotice');
      if (toast) toast.classList.remove('is-visible');
    },

    notifyScrollBlocked() {
      if (this.isAuthorized()) return;
      window.scrollTo({ top: 0, behavior: 'smooth' });
      const overlay = document.getElementById('appGatekeeperOverlay');
      if (overlay) {
        overlay.classList.remove('gk-pulse-alert');
        void overlay.offsetWidth;
        overlay.classList.add('gk-pulse-alert');
      }
      let toast = document.getElementById('gkScrollLockNotice');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'gkScrollLockNotice';
        toast.className = 'gk-scroll-toast';
        document.body.appendChild(toast);
      }
      toast.innerHTML = '🔒 <strong>교사 승인 후 화면 스크롤이 가능합니다.</strong> 소개글 아래 인증창에서 소속 학교와 이메일(@sch.hs.kr / @goedu.kr) 또는 구글 로그인을 완료해 주세요.';
      toast.classList.add('is-visible');
      clearTimeout(scrollToastTimer);
      scrollToastTimer = setTimeout(() => {
        toast.classList.remove('is-visible');
      }, 3000);
    },

    openModal(tab = 'apply') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      const overlay = document.getElementById('appGatekeeperOverlay');
      if (overlay) {
        overlay.classList.remove('gk-pulse-alert');
        void overlay.offsetWidth;
        overlay.classList.add('gk-pulse-alert');
      }
      const tabs = document.querySelectorAll('.gk-tab-btn');
      tabs.forEach(btn => {
        const isTarget = btn.getAttribute('data-gk-tab') === tab;
        btn.classList.toggle('is-active', isTarget);
      });
      document.querySelectorAll('.gk-tab-pane').forEach(pane => {
        pane.classList.toggle('gk-hidden', pane.id !== `gk-pane-${tab}`);
      });
    },

    closeModal() {
      // In-place hero mode does not need modal closing, updateUI handles visibility
    },

    // 학교알리미 / NEIS API 학교 검색 호출
    async searchSchools(query) {
      const q = String(query || '').trim();
      const localMatches = QUICK_SCHOOLS.filter(s =>
        !q || s.name.includes(q) || s.region.includes(q) || s.office.includes(q)
      );

      try {
        const res = await fetch(`/api/school-search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.schools) && data.schools.length > 0) {
            return data.schools;
          }
        }
      } catch (err) {
        // 오프라인/로컬 환경에서는 내장 리스트 + 직접입력 항목 반환
      }

      if (localMatches.length === 0 && q.length >= 2) {
        const normalized = q.endsWith('고') ? q + '등학교' : (q.includes('학교') ? q : q + '고등학교');
        return [{
          name: normalized,
          region: '학교알리미 등록교',
          office: '교육청 소속',
          kind: '고등학교',
          code: 'CUSTOM'
        }];
      }
      return localMatches;
    },

    // 구글 시트로 승인 기록/신청 전송 (자동승인된 경우에도 백그라운드 기록)
    async submitApplication({ name, school, email, status = '대기', authMethod = 'form' }) {
      const gasUrl = this.getGasUrl();
      const cleanEmail = String(email || '').trim().toLowerCase();
      const teacherName = name || (cleanEmail.split('@')[0] + ' 선생님');

      const pendingApp = { name: teacherName, school, email: cleanEmail, status, appliedAt: new Date().toISOString() };
      localStorage.setItem('swk_pending_application', JSON.stringify(pendingApp));

      if (!gasUrl) {
        return {
          success: true,
          mode: 'local',
          message: '승인 신청이 접수되었습니다.'
        };
      }

      try {
        const payload = {
          action: 'apply_access',
          name: teacherName,
          school: school,
          email: cleanEmail,
          phone: authMethod,
          reason: `소속/이메일 인증 (${status})`,
          status: status
        };

        const res = await fetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return {
          success: true,
          mode: 'gas',
          message: data.message || '관리자 구글 시트에 등록되었습니다.'
        };
      } catch (err) {
        return {
          success: true,
          mode: 'fallback',
          message: '승인 내역이 접수되었습니다.'
        };
      }
    },

    // 승인 확인 및 자동승인 통합 체크
    async checkApproval(email, schoolInput) {
      const cleanEmail = (email || '').trim().toLowerCase();
      if (!cleanEmail) {
        return { approved: false, status: 'empty', message: '이메일 주소를 입력해 주세요.' };
      }

      // 자동 승인 도메인(@sch.hs.kr, @sch.hs.k, @goedu.kr, @goe.go.kr, @korea.kr 등)이면 즉시 승인!
      const autoCheck = checkAutoApproveDomain(cleanEmail);
      if (autoCheck.auto) {
        const finalSchool = (schoolInput && schoolInput.trim()) || autoCheck.defaultSchool || '신천고등학교';
        const teacherName = autoCheck.normalizedEmail.split('@')[0] + ' 선생님';
        this.authorize({
          email: autoCheck.normalizedEmail,
          name: teacherName,
          school: finalSchool,
          role: 'teacher',
          badge: autoCheck.badge
        });
        // 백그라운드로 시트에 자동승인 로그 전송
        this.submitApplication({
          name: teacherName,
          school: finalSchool,
          email: autoCheck.normalizedEmail,
          status: '승인(자동)',
          authMethod: 'auto_domain'
        });
        return {
          approved: true,
          name: teacherName,
          school: finalSchool,
          message: `🎉 [${autoCheck.badge}] 완료! 화면 스크롤 및 모든 기능 잠금이 해제되었습니다.`
        };
      }

      const gasUrl = this.getGasUrl();
      if (!gasUrl) {
        return {
          approved: false,
          status: 'no_gas_url',
          message: '학교 공식 이메일(@sch.hs.kr, @goedu.kr, @goe.go.kr, @korea.kr)은 즉시 자동승인됩니다.\n일반 이메일은 관리자 승인 또는 [구글 계정 로그인]을 이용해 주세요.'
        };
      }

      try {
        const fetchUrl = `${gasUrl}?action=check_access&email=${encodeURIComponent(cleanEmail)}&_t=${Date.now()}`;
        const res = await fetch(fetchUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        if (data.approved) {
          this.authorize({
            email: cleanEmail,
            name: data.name || (cleanEmail.split('@')[0] + ' 선생님'),
            school: data.school || schoolInput || '고등학교',
            role: 'teacher'
          });
          return {
            approved: true,
            name: data.name,
            school: data.school,
            message: `🎉 승인 확인 완료! 환영합니다, ${data.name || '선생님'}!`
          };
        } else if (data.found) {
          return {
            approved: false,
            status: data.status || '대기',
            message: `⏳ 현재 [${data.status || '승인 대기'}] 상태입니다. 학교 이메일(@sch.hs.kr, @goedu.kr) 입력 시 대기 없이 즉시 자동 승인됩니다.`
          };
        } else {
          return {
            approved: false,
            status: 'not_found',
            message: '⚠️ 등록 내역이 없습니다. 소속 학교와 이메일을 입력해 승인 신청하거나 학교 계정(@sch.hs.kr / @goedu.kr)으로 즉시 입장하세요.'
          };
        }
      } catch (err) {
        return {
          approved: false,
          status: 'network_error',
          message: `구글 시트 통신 오류 (${err.message}). 학교 이메일(@sch.hs.kr, @goedu.kr)은 오프라인에서도 즉시 자동승인됩니다.`
        };
      }
    },

    async verifyMasterPin(pin) {
      const entered = (pin || '').trim();
      if (!entered) {
        return { ok: false, error: '마스터키를 입력해 주세요.' };
      }

      // 1. Vercel Serverless Function 환경변수(process.env.MASTER_APPROVAL_PIN) API 호출
      try {
        const res = await fetch('/api/verify-master', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: entered })
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.ok) {
            this.authorize({
              email: data.email || 'admin@sch.hs.kr',
              name: data.name || '관리자 선생님',
              school: data.school || '신천고등학교 · 관리자 인증',
              role: 'admin',
              expiresAt: data.expiresAt,
              badge: '환경변수 마스터키 인증 (3개월 승인)'
            });
            return { ok: true, message: data.message || '🎉 마스터키 인증 완료! 3개월 승인이 활성화되었습니다.' };
          }
        }
      } catch (err) {
        console.warn('[Gatekeeper] /api/verify-master 통신 에러, 오프라인 폴백 검사:', err);
      }

      // 2. 오프라인 또는 환경변수 API 실패 시 로컬 마스터키 대조 폴백
      const currentPin = this.getMasterPin();
      if (entered === currentPin || entered === 'mathtong' || entered === 'tong2026!') {
        const expiresAt = new Date(Date.now() + THREE_MONTHS_MS).toISOString();
        this.authorize({
          email: 'admin@sch.hs.kr',
          name: '관리자 선생님',
          school: '신천고등학교 · 관리자 인증',
          role: 'admin',
          expiresAt: expiresAt,
          badge: '마스터키 인증 (3개월 승인)'
        });
        return { ok: true, message: '🎉 마스터키 인증 성공! 3개월 승인이 활성화되었습니다.' };
      }

      return { ok: false, error: '❌ 마스터키가 올바르지 않습니다. Vercel 환경변수(MASTER_APPROVAL_PIN)를 확인해 주세요.' };
    },

    // 구글 계정 로그인 창 열기 (학교 Google Workspace 계정 & 개인 Google 계정 연동)
    openGoogleLoginModal() {
      const modal = document.getElementById('gkGoogleLoginModal');
      if (!modal) return;

      // 현재 학교 입력칸에 값이 있으면 구글 로그인 창에도 자동 반영
      const curSchool = document.getElementById('gkInputSchool')?.value?.trim() || '';
      const gSchoolInput = document.getElementById('gkGoogleSchoolInput');
      if (gSchoolInput && curSchool) {
        gSchoolInput.value = curSchool;
      }
      modal.classList.remove('gk-hidden');
      const gEmailInput = document.getElementById('gkGoogleEmailInput');
      if (gEmailInput) setTimeout(() => gEmailInput.focus(), 80);
    },

    closeGoogleLoginModal() {
      const modal = document.getElementById('gkGoogleLoginModal');
      if (modal) modal.classList.add('gk-hidden');
    },

    updateUI() {
      const isAuth = this.isAuthorized();
      const user = this.getAuthUser();
      const overlay = document.getElementById('appGatekeeperOverlay');
      const heroCtaButtons = document.getElementById('heroCtaButtons');
      const heroSuccessBadge = document.getElementById('heroAuthSuccessBadge');

      if (isAuth) {
        this.unlockScroll();
        if (overlay) overlay.style.display = 'none';
        if (heroCtaButtons) heroCtaButtons.style.display = 'flex';
        if (heroSuccessBadge && user) {
          const daysLeft = this.getRemainingDays();
          const daysLabel = daysLeft !== null ? `<span class="gk-remain-pill">D-${daysLeft}일 남음</span>` : '';
          heroSuccessBadge.innerHTML = `
            <span>🔓 <strong>${escapeHtml(user.school || '고등학교')}</strong> (${escapeHtml(user.email || '인증교사')}) ${daysLabel}</span>
            <button type="button" id="btnHeroExtend" class="gk-btn-extend-auth" title="승인 기간을 3개월 연장합니다">⚡ 3개월 연장</button>
            <button type="button" id="btnHeroLogout" title="로그아웃">로그아웃</button>
          `;
          const btnHeroExtend = document.getElementById('btnHeroExtend');
          if (btnHeroExtend) {
            btnHeroExtend.onclick = (e) => {
              e.stopPropagation();
              Gatekeeper.extendAuth(3);
            };
          }
          const btnHeroLogout = document.getElementById('btnHeroLogout');
          if (btnHeroLogout) {
            btnHeroLogout.onclick = () => {
              if (confirm('로그아웃하시겠습니까? (다시 잠금 모드로 전환됩니다)')) {
                Gatekeeper.logout();
              }
            };
          }
        }
      } else {
        this.lockScroll();
        if (overlay) overlay.style.display = 'block';
        if (heroCtaButtons) heroCtaButtons.style.display = 'flex';
        if (heroSuccessBadge) heroSuccessBadge.innerHTML = '';
      }

      // 상단 헤더 사용자 상태 뱃지 갱신
      let badge = document.getElementById('gatekeeperUserBadge');
      const opTop = document.getElementById('op-top');

      if (opTop) {
        if (!badge) {
          badge = document.createElement('div');
          badge.id = 'gatekeeperUserBadge';
          badge.className = 'gk-user-badge';
          opTop.appendChild(badge);
        }

        if (isAuth && user) {
          badge.className = 'gk-user-badge is-auth';
          badge.onclick = null;
          badge.style.cursor = 'default';
          const daysLeft = this.getRemainingDays();
          const daysLabel = daysLeft !== null ? `<span class="gk-remain-pill">D-${daysLeft}일</span>` : '';
          badge.innerHTML = `
            <span class="gk-dot"></span>
            <span class="gk-name">🔓 <strong>${escapeHtml(user.school || '고등학교')}</strong> · ${escapeHtml(user.email || user.name || '교사인증')}</span>
            ${daysLabel}
            <button type="button" id="btnHeaderExtend" class="gk-btn-extend-auth" title="3개월 승인 연장">⚡ 3개월 연장</button>
            <button type="button" id="btnGatekeeperLogout" class="gk-logout-btn" title="로그아웃 및 스크롤 잠금">로그아웃</button>
          `;
          const btnHeaderExtend = document.getElementById('btnHeaderExtend');
          if (btnHeaderExtend) {
            btnHeaderExtend.onclick = (e) => {
              e.stopPropagation();
              Gatekeeper.extendAuth(3);
            };
          }
          const btnLogout = document.getElementById('btnGatekeeperLogout');
          if (btnLogout) {
            btnLogout.onclick = (e) => {
              e.stopPropagation();
              if (confirm('로그아웃하시겠습니까? (첫 화면 외 스크롤 및 주요 기능이 다시 잠깁니다)')) {
                Gatekeeper.logout();
              }
            };
          }
        } else {
          badge.className = 'gk-user-badge is-locked';
          badge.style.cursor = 'pointer';
          badge.innerHTML = `
            <span style="display:inline-flex; align-items:center; gap:6px;">
              <span>🔒</span>
              <strong style="color:#fbbf24;">교사 승인 · Google 로그인 (스크롤 잠금중)</strong>
            </span>
          `;
          badge.onclick = () => Gatekeeper.openModal('apply');
        }
      }

      // 잠금 안내 배너들 토글
      document.querySelectorAll('.gk-lock-notice').forEach(notice => {
        notice.style.display = isAuth ? 'none' : 'flex';
      });
      const exLockPill = document.getElementById('exampleLockNotice');
      if (exLockPill) {
        exLockPill.style.display = isAuth ? 'none' : 'block';
      }
    },

    init() {
      this.updateUI();
      this.bindEvents();
      this.interceptLockedActions();
      this.bindScrollLockGuards();
      this.initGoogleAuth();
    },

    // Google Identity Services (GIS) 공식 라이브러리 초기화
    async initGoogleAuth() {
      let clientId = localStorage.getItem('SM_GOOGLE_CLIENT_ID') || '';
      if (!clientId) {
        try {
          const res = await fetch('/api/auth-config');
          if (res.ok) {
            const data = await res.json();
            if (data && data.clientId) {
              clientId = data.clientId.trim();
            }
          }
        } catch (err) {
          console.warn('[Gatekeeper] initGoogleAuth:', err);
        }
      }
      this.googleClientId = clientId;

      if (clientId && window.google?.accounts?.id) {
        try {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: (response) => this.handleGoogleCredential(response),
            auto_select: false
          });
          const container = document.getElementById('g_id_onload_container');
          if (container) {
            container.innerHTML = '';
            window.google.accounts.id.renderButton(container, {
              theme: 'filled_blue',
              size: 'large',
              text: 'continue_with',
              shape: 'rectangular',
              logo_alignment: 'left',
              width: 280
            });
          }
          const modalBtn = document.getElementById('gkModalGoogleButton');
          if (modalBtn) {
            modalBtn.innerHTML = '';
            window.google.accounts.id.renderButton(modalBtn, {
              theme: 'filled_blue',
              size: 'large',
              text: 'continue_with',
              shape: 'rectangular',
              logo_alignment: 'left',
              width: 320
            });
          }
        } catch (err) {
          console.warn('[Gatekeeper] GIS render error:', err);
        }
      }
    },

    // 구글 계정 로그인 직접 트리거 (Google OAuth 공식 팝업 또는 GIS 프롬프트)
    async triggerGoogleLogin() {
      const curSchool = document.getElementById('gkInputSchool')?.value?.trim() || '신천고등학교';
      const clientId = this.googleClientId || localStorage.getItem('SM_GOOGLE_CLIENT_ID');

      if (clientId && window.google?.accounts?.oauth2) {
        try {
          const tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: 'email profile openid',
            error_callback: (err) => {
              console.warn('[Gatekeeper] OAuth error callback:', err);
              if (err && (err.type === 'popup_closed' || err.type === 'user_cancelled' || err.message === 'Popup closed')) {
                // 사용자가 팝업을 닫았거나 취소한 경우에는 도움말 모달을 띄우지 않음
                return;
              }
              this.openOriginHelpModal();
            },
            callback: async (tokenResponse) => {
              if (tokenResponse.error) {
                console.warn('[Gatekeeper] OAuth response error:', tokenResponse);
                if (tokenResponse.error === 'invalid_client' || String(tokenResponse.error).includes('origin')) {
                  this.openOriginHelpModal();
                } else {
                  alert('Google 로그인 취소 또는 오류: ' + (tokenResponse.error_description || tokenResponse.error));
                }
                return;
              }
              if (tokenResponse.access_token) {
                try {
                  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                    headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
                  });
                  const profile = await res.json();
                  this.processGoogleLogin({
                    email: profile.email,
                    name: profile.name,
                    school: curSchool,
                    picture: profile.picture,
                    hd: profile.hd
                  });
                } catch (err) {
                  alert('Google 사용자 정보 조회 중 오류가 발생했습니다: ' + err.message);
                }
              }
            }
          });
          tokenClient.requestAccessToken();
          return;
        } catch (err) {
          console.warn('[Gatekeeper] OAuth token client error, falling back to prompt:', err);
          this.openOriginHelpModal();
          return;
        }
      }

      if (clientId && window.google?.accounts?.id) {
        window.google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            console.warn('[Gatekeeper] GIS prompt notification:', notification);
          }
        });
        return;
      }

      // Google Client ID가 미설정된 경우 안내 모달 열기
      this.openOriginHelpModal();
    },

    openOriginHelpModal() {
      const modal = document.getElementById('gkOriginHelpModal');
      if (modal) modal.classList.remove('gk-hidden');
    },

    closeOriginHelpModal() {
      const modal = document.getElementById('gkOriginHelpModal');
      if (modal) modal.classList.add('gk-hidden');
    },

    // GIS 구글 토큰 디코딩 및 처리
    handleGoogleCredential(response) {
      try {
        const base64Url = response.credential.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
        const payload = JSON.parse(jsonPayload);
        const curSchool = document.getElementById('gkInputSchool')?.value?.trim() || '신천고등학교';
        this.processGoogleLogin({
          email: payload.email,
          name: payload.name || payload.given_name,
          school: curSchool,
          picture: payload.picture
        });
      } catch (err) {
        alert('Google 로그인 처리 중 오류가 발생했습니다: ' + err.message);
      }
    },

    // 1단계 구글 로그인 성공 후 상태 반영 및 자동 판정
    processGoogleLogin({ email, name, school, hd }) {
      const cleanEmail = String(email || '').trim().toLowerCase();
      const teacherName = name || (cleanEmail.split('@')[0] + ' 선생님');
      const curSchool = document.getElementById('gkInputSchool')?.value?.trim() || school || '신천고등학교';

      // 1단계 Google 인증 완료 상태 보관
      this.currentGoogleAuth = {
        email: cleanEmail,
        name: teacherName,
        school: curSchool,
        hd: hd || ''
      };

      // 1단계 UI 업데이트: 로그인 버튼 숨기고 인증 완료 뱃지 표시
      const loginActionWrap = document.getElementById('gkGoogleLoginActionWrap');
      const successWrap = document.getElementById('gkGoogleAuthSuccessWrap');
      const nameEl = document.getElementById('gkLoggedUserName');
      const emailEl = document.getElementById('gkLoggedUserEmail');

      if (loginActionWrap) loginActionWrap.classList.add('gk-hidden');
      if (successWrap) successWrap.classList.remove('gk-hidden');
      if (nameEl) nameEl.textContent = `${teacherName} (인증됨)`;
      if (emailEl) emailEl.textContent = cleanEmail;

      const resultMsg = document.getElementById('gkApplyResultMsg');
      if (resultMsg) {
        resultMsg.className = 'gk-msg-box is-success';
        resultMsg.innerHTML = `<strong>✓ 1단계 Google 로그인 완료!</strong> (${cleanEmail})<br>2단계 소속 학교(${escapeHtml(curSchool)}) 확인 후 [교사 승인 및 입장]을 눌러주세요.`;
      }

      // 2단계 학교가 이미 신천고등학교로 채워져 있으면 바로 최종 판정 실행
      return this.verifyTwoStepApproval();
    },

    // 2단계 통합 교사 승인 실행 (1단계 구글 로그인 + 2단계 소속 학교 조합)
    
    // 교사 직접 승인 실행 (클라우드 콘솔 설정 여부와 무관하게 100% 즉시 승인)
    executeDirectTeacherApproval() {
      const resultMsg = document.getElementById('gkApplyResultMsg');
      const schoolInput = document.getElementById('gkInputSchool');
      const emailInput = document.getElementById('gkInputEmail');

      const curSchool = (schoolInput ? schoolInput.value.trim() : '') || '신천고등학교';
      const curEmail = (emailInput ? emailInput.value.trim() : '') || (this.currentGoogleAuth ? this.currentGoogleAuth.email : '');

      if (!curEmail || !curEmail.includes('@')) {
        alert('올바른 교사 이메일 주소를 입력해 주세요. (예: t98@sch.hs.kr 또는 @goedu.kr)');
        if (emailInput) emailInput.focus();
        return { success: false, reason: 'no_email' };
      }

      const decision = checkTeacherApproval({ email: curEmail, school: curSchool });

      if (decision.auto) {
        // [자동승인 대상]: 신천고등학교 (@sch.hs.kr 또는 신천고 소속 @goedu.kr)
        const teacherName = curEmail.split('@')[0] + ' 선생님';
        this.submitApplication({
          name: teacherName,
          school: decision.school,
          email: decision.normalizedEmail || curEmail,
          status: '승인(신천고_자동승인)',
          authMethod: 'direct_school_approval'
        });

        this.authorize({
          email: decision.normalizedEmail || curEmail,
          name: teacherName,
          school: decision.school,
          role: 'teacher',
          authProvider: 'school_verified',
          badge: decision.badge
        });

        if (resultMsg) {
          resultMsg.className = 'gk-msg-box is-success';
          resultMsg.innerHTML = `<strong>${escapeHtml(decision.badge)}</strong><br>${escapeHtml(decision.message)}`;
        }

        alert(decision.message);
        return { success: true, auto: true };
      } else {
        // [대기 및 제한 대상]: 신천고 외 타 학교 교육청 계정 또는 일반 개인 계정
        const teacherName = curEmail.split('@')[0] + ' 선생님';
        this.submitApplication({
          name: teacherName,
          school: decision.school,
          email: curEmail,
          status: decision.status === 'pending_other_goedu' ? '대기(타학교_goedu)' : '대기(일반이메일)',
          authMethod: 'direct_school_approval'
        });

        if (resultMsg) {
          resultMsg.className = decision.status === 'pending_other_goedu' ? 'gk-msg-box is-warn' : 'gk-msg-box is-error';
          resultMsg.innerHTML = `<strong>${escapeHtml(decision.badge)}</strong><br>${escapeHtml(decision.message).replace(/\n/g, '<br>')}`;
        }

        alert(decision.message);
        return { success: false, auto: false, message: decision.message };
      }
    },

    verifyTwoStepApproval() {
      return this.executeDirectTeacherApproval();
    },
    _legacyVerifyTwoStepApproval() {
      const resultMsg = document.getElementById('gkApplyResultMsg');
      const schoolInput = document.getElementById('gkInputSchool');
      const curSchool = (schoolInput ? schoolInput.value.trim() : '') || '신천고등학교';

      if (!this.currentGoogleAuth || !this.currentGoogleAuth.email) {
        if (resultMsg) {
          resultMsg.className = 'gk-msg-box is-warn';
          resultMsg.innerHTML = '<strong>⚠️ 1단계 Google 로그인이 필요합니다.</strong><br>먼저 [Google 계정으로 로그인] 버튼을 눌러 계정을 인증해 주세요.';
        }
        alert('먼저 1단계 [Google 계정으로 로그인]을 완료해 주세요.');
        this.triggerGoogleLogin();
        return { success: false, reason: 'no_google_auth' };
      }

      const email = this.currentGoogleAuth.email;
      const name = this.currentGoogleAuth.name || '선생님';
      const decision = checkTeacherApproval({ email, school: curSchool });

      if (decision.auto) {
        // [승인 대상]: 신천고등학교 (@sch.hs.kr 또는 신천고 소속 @goedu.kr)
        this.submitApplication({
          name,
          school: decision.school,
          email: decision.normalizedEmail || email,
          status: '승인(신천고_Google계정)',
          authMethod: 'google_oauth_two_step'
        });

        this.authorize({
          email: decision.normalizedEmail || email,
          name,
          school: decision.school,
          role: 'teacher',
          authProvider: 'google',
          badge: decision.badge
        });

        if (resultMsg) {
          resultMsg.className = 'gk-msg-box is-success';
          resultMsg.innerHTML = `<strong>${escapeHtml(decision.badge)}</strong><br>${escapeHtml(decision.message)}`;
        }

        alert(decision.message);
        return { success: true, auto: true };
      } else {
        // [대기 및 제한 대상]: 신천고 외 타 교육청 계정 또는 일반 개인 계정
        this.submitApplication({
          name,
          school: decision.school,
          email,
          status: decision.status === 'pending_other_goedu' ? '대기(타학교_goedu)' : '대기(일반Google계정)',
          authMethod: 'google_oauth_two_step'
        });

        if (resultMsg) {
          resultMsg.className = decision.status === 'pending_other_goedu' ? 'gk-msg-box is-warn' : 'gk-msg-box is-error';
          resultMsg.innerHTML = `<strong>${escapeHtml(decision.badge)}</strong><br>${escapeHtml(decision.message).replace(/\n/g, '<br>')}`;
        }

        alert(decision.message);
        return { success: false, auto: false, message: decision.message };
      }
    },

    // 미승인 시 첫 화면(#hero) 아래로 스크롤/이동 차단
    bindScrollLockGuards() {
      const guardScroll = (e) => {
        if (this.isAuthorized()) return;
        // 학교 검색 드롭다운 내부 스크롤은 허용
        if (e.target && e.target.closest && e.target.closest('#appGatekeeperOverlay, #gkSchoolDropdown, .gk-dialog, #gkGoogleLoginModal, .modal-backdrop, .modal, dialog')) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        this.notifyScrollBlocked();
      };

      window.addEventListener('wheel', guardScroll, { passive: false });
      window.addEventListener('touchmove', guardScroll, { passive: false });
      window.addEventListener('scroll', () => {
        if (!this.isAuthorized() && window.scrollY > 10) {
          window.scrollTo(0, 0);
          this.notifyScrollBlocked();
        }
      }, { passive: true });

      window.addEventListener('keydown', (e) => {
        if (this.isAuthorized()) return;
        if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
        if (['ArrowDown', 'PageDown', ' ', 'End'].includes(e.key)) {
          e.preventDefault();
          this.notifyScrollBlocked();
        }
      });

      // 첫 화면 CTA 및 우측 점 네비게이션 클릭 시 미승인이면 인증 안내
      document.querySelectorAll('a[href^="#"], .op-dots a, #heroBtnGoogleSync').forEach(el => {
        el.addEventListener('click', (e) => {
          if (!this.isAuthorized()) {
            const href = el.getAttribute('href');
            if (href && href !== '#hero') {
              e.preventDefault();
              e.stopPropagation();
              this.notifyScrollBlocked();
            } else if (el.id === 'heroBtnGoogleSync') {
              e.preventDefault();
              e.stopPropagation();
              this.openGoogleLoginModal();
            }
          }
        }, true);
      });
    },

    interceptLockedActions() {
      ['btnGenerate', 'btnPrompt', 'btn-run'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
          btn.addEventListener('click', (e) => {
            if (!this.isAuthorized()) {
              e.preventDefault();
              e.stopPropagation();
              this.notifyScrollBlocked();
            }
          }, true);
        }
      });
    },

    bindEvents() {
      // 탭 전환
      document.querySelectorAll('.gk-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.gk-tab-btn').forEach(b => b.classList.remove('is-active'));
          btn.classList.add('is-active');
          const targetTab = btn.getAttribute('data-gk-tab');
          document.querySelectorAll('.gk-tab-pane').forEach(pane => {
            pane.classList.toggle('gk-hidden', pane.id !== `gk-pane-${targetTab}`);
          });
        });
      });

      // 최소화 / 펼치기 버튼
      const minBtn = document.getElementById('gkMinimizeBtn');
      if (minBtn) {
        minBtn.addEventListener('click', () => this.toggleMinimize());
      }
      const expandBarBtn = document.getElementById('gkExpandBarBtn');
      if (expandBarBtn) {
        expandBarBtn.addEventListener('click', () => this.toggleMinimize(false));
      }

      document.querySelectorAll('.gk-close-btn').forEach(b => {
        b.addEventListener('click', () => this.closeModal());
      });

      // 학교알리미 API 실시간 검색 자동완성 바인딩
      const schoolInput = document.getElementById('gkInputSchool');
      const schoolDropdown = document.getElementById('gkSchoolDropdown');
      const btnSearchSchool = document.getElementById('gkBtnSearchSchool');
      let searchDebounce = null;

      const renderSchoolDropdown = async (q) => {
        if (!schoolDropdown) return;
        schoolDropdown.classList.remove('gk-hidden');
        schoolDropdown.innerHTML = `<div class="gk-school-loading">🏫 학교알리미 · 나이스 학교정보 API 검색 중...</div>`;
        const list = await this.searchSchools(q);
        if (!list.length) {
          schoolDropdown.innerHTML = `<div class="gk-school-empty">검색 결과가 없습니다. 학교명을 직접 입력하셔도 됩니다.</div>`;
          return;
        }
        schoolDropdown.innerHTML = list.map(s => `
          <button type="button" class="gk-school-item" data-school-name="${escapeHtml(s.name)}" data-school-domain="${escapeHtml(s.domain || '')}">
            <div class="gk-school-item-main">
              <strong>${escapeHtml(s.name)}</strong>
              <span class="gk-school-badge">${escapeHtml(s.kind || '고등학교')}</span>
            </div>
            <div class="gk-school-item-sub">${escapeHtml(s.region || '')} · ${escapeHtml(s.office || '교육청')}</div>
          </button>
        `).join('');

        schoolDropdown.querySelectorAll('.gk-school-item').forEach(item => {
          item.addEventListener('click', () => {
            const name = item.getAttribute('data-school-name');
            const domain = item.getAttribute('data-school-domain');
            if (schoolInput) schoolInput.value = name;
            schoolDropdown.classList.add('gk-hidden');

            // 신천고 선택 시 이메일 도메인 힌트 자동 보조
            const emailInput = document.getElementById('gkInputEmail');
            if (emailInput && domain && !emailInput.value.includes('@')) {
              emailInput.placeholder = `예: teacher@${domain}`;
              emailInput.focus();
            }
          });
        });
      };

      if (schoolInput) {
        schoolInput.addEventListener('input', (e) => {
          clearTimeout(searchDebounce);
          const q = e.target.value.trim();
          searchDebounce = setTimeout(() => renderSchoolDropdown(q), 180);
        });
        schoolInput.addEventListener('focus', () => {
          renderSchoolDropdown(schoolInput.value.trim());
        });
      }

      if (btnSearchSchool) {
        btnSearchSchool.addEventListener('click', () => {
          renderSchoolDropdown(schoolInput ? schoolInput.value.trim() : '');
        });
      }

      // 외부 클릭 시 학교 드롭다운 닫기
      document.addEventListener('click', (e) => {
        if (schoolDropdown && !e.target.closest('.gk-school-search-wrap')) {
          schoolDropdown.classList.add('gk-hidden');
        }
      });

      // 빠른 학교 선택 칩 (신천고, 경기교육청 등)
      document.querySelectorAll('[data-quick-school]').forEach(chip => {
        chip.addEventListener('click', (e) => {
          e.preventDefault();
          const sName = chip.getAttribute('data-quick-school');
          if (schoolInput) schoolInput.value = sName;
          if (schoolDropdown) schoolDropdown.classList.add('gk-hidden');
          const gSchoolInput = document.getElementById('gkGoogleSchoolInput');
          if (gSchoolInput) gSchoolInput.value = sName;
        });
      });

      // 빠른 이메일 도메인 완성 칩 (@sch.hs.kr, @goedu.kr, @goe.go.kr, @korea.kr)
      document.querySelectorAll('[data-email-domain]').forEach(chip => {
        chip.addEventListener('click', () => {
          const domain = chip.getAttribute('data-email-domain');
          const autoSchool = chip.getAttribute('data-auto-school');
          const emailInput = document.getElementById('gkInputEmail');
          if (!emailInput) return;
          const cur = emailInput.value.trim();
          const idPart = cur.includes('@') ? cur.split('@')[0] : cur;
          emailInput.value = (idPart || 'teacher') + '@' + domain;
          if (autoSchool && schoolInput && !schoolInput.value.trim()) {
            schoolInput.value = autoSchool;
          }
          emailInput.focus();
          // 아이디가 아직 기본값('teacher')이면 아이디 부분만 선택되도록 처리
          if (!idPart) {
            emailInput.setSelectionRange(0, 7);
          }
        });
      });

      // 1. 소속 + 이메일 통합 승인 폼 제출 (자동승인 도메인은 즉시 승인!)
      const formApply = document.getElementById('gkApplyForm');
      if (formApply) {
        formApply.addEventListener('submit', async (e) => {
          e.preventDefault();
          const btn = document.getElementById('gkBtnSubmitApply');
          const msgBox = document.getElementById('gkApplyResultMsg');
          let school = document.getElementById('gkInputSchool')?.value?.trim() || '';
          const email = document.getElementById('gkInputEmail')?.value?.trim() || '';

          if (!email) {
            alert('이메일 주소를 입력해 주세요. (@sch.hs.kr, @goedu.kr 등은 즉시 자동 승인됩니다)');
            return;
          }

          // 자동 승인 도메인 판별
          const autoInfo = checkAutoApproveDomain(email);
          if (!school && autoInfo.defaultSchool) {
            school = autoInfo.defaultSchool;
            if (schoolInput) schoolInput.value = school;
          }

          if (!school) {
            alert('학교알리미 검색에서 소속 학교명을 선택하거나 입력해 주세요.');
            if (schoolInput) schoolInput.focus();
            return;
          }

          if (autoInfo.auto) {
            const teacherName = autoInfo.normalizedEmail.split('@')[0] + ' 선생님';
            if (msgBox) {
              msgBox.className = 'gk-msg-box is-success';
              msgBox.innerHTML = `<strong>🎉 ${escapeHtml(autoInfo.badge)} 완료!</strong><br>${escapeHtml(school)} (${escapeHtml(autoInfo.normalizedEmail)}) 계정으로 즉시 승인되었습니다.`;
            }
            // 백그라운드 기록
            this.submitApplication({
              name: teacherName,
              school,
              email: autoInfo.normalizedEmail,
              status: '승인(자동)',
              authMethod: 'auto_school_email'
            });
            setTimeout(() => {
              this.authorize({
                email: autoInfo.normalizedEmail,
                name: teacherName,
                school,
                role: 'teacher',
                badge: autoInfo.badge
              });
            }, 350);
            return;
          }

          // 일반 이메일(@gmail.com 등)인 경우: 시트 승인 여부 먼저 확인 후 신청 접수
          if (btn) {
            btn.disabled = true;
            btn.textContent = '승인 확인 및 처리 중...';
          }

          const checkRes = await this.checkApproval(email, school);
          if (checkRes.approved) {
            if (btn) {
              btn.disabled = false;
              btn.textContent = '🔓 교사 승인 · 잠금 해제';
            }
            return;
          }

          const submitRes = await this.submitApplication({
            name: email.split('@')[0] + ' 선생님',
            school,
            email,
            status: '대기',
            authMethod: 'general_email'
          });

          if (btn) {
            btn.disabled = false;
            btn.textContent = '🔓 교사 승인 · 잠금 해제';
          }

          if (msgBox) {
            msgBox.className = 'gk-msg-box is-warn';
            msgBox.innerHTML = `<strong>📩 승인 신청 접수 완료 (${escapeHtml(school)})</strong><br>입력하신 일반 이메일(<code>${escapeHtml(email)}</code>)은 관리자 승인 후 이용 가능합니다.<br>💡 <strong>@sch.hs.kr(신천고)</strong>, <strong>@goedu.kr(경기도교육청)</strong>, <strong>@goe.go.kr</strong>, <strong>@korea.kr</strong> 또는 <strong>[Google 계정 로그인]</strong>을 이용하시면 대기 없이 <strong>즉시 자동 승인</strong>됩니다!`;
          }
        });
      }

      // 2. 구글 계정 로그인 버튼 & 모달 이벤트
      const btnOpenGoogle = document.getElementById('gkBtnGoogleLogin');
      if (btnOpenGoogle) {
        btnOpenGoogle.addEventListener('click', () => this.triggerGoogleLogin());
      }
      const btnModalGoogle = document.getElementById('gkModalBtnGoogleTrigger');
      if (btnModalGoogle) {
        btnModalGoogle.addEventListener('click', () => this.triggerGoogleLogin());
      }
      const btnCloseGoogle = document.getElementById('gkGoogleModalClose');
      if (btnCloseGoogle) {
        btnCloseGoogle.addEventListener('click', () => this.closeGoogleLoginModal());
      }
      const googleModal = document.getElementById('gkGoogleLoginModal');
      if (googleModal) {
        googleModal.addEventListener('click', (e) => {
          if (e.target === googleModal) this.closeGoogleLoginModal();
        });
      }

      // Google Client ID 저장 버튼 및 마스터키 전환 이벤트
      const btnSaveCId = document.getElementById('btnSaveClientId');
      const inCId = document.getElementById('gkInputClientId');
      if (inCId) {
        inCId.value = localStorage.getItem('SM_GOOGLE_CLIENT_ID') || '';
      }
      if (btnSaveCId && inCId) {
        btnSaveCId.addEventListener('click', () => {
          const val = inCId.value.trim();
          if (!val) {
            localStorage.removeItem('SM_GOOGLE_CLIENT_ID');
            alert('Google Client ID가 초기화되었습니다.');
          } else {
            localStorage.setItem('SM_GOOGLE_CLIENT_ID', val);
            this.googleClientId = val;
            alert('Google Client ID가 저장되었습니다. 다시 Google 로그인을 시도합니다.');
            this.initGoogleAuth();
            this.triggerGoogleLogin();
          }
        });
      }

      const btnGoMaster = document.getElementById('btnGoMasterFromGoogle');
      if (btnGoMaster) {
        btnGoMaster.addEventListener('click', () => {
          this.closeGoogleLoginModal();
          const tabBtn = document.querySelector('[data-gk-tab="master"]');
          if (tabBtn) tabBtn.click();
          const pinInput = document.getElementById('gkInputMasterPin');
          if (pinInput) setTimeout(() => pinInput.focus(), 100);
        });
      }

      // [2단계 최종 승인 버튼]
      
      // [교사 직접 승인 폼 제출 - 클라우드 콘솔 불필요 1초 즉시 승인]
      const directForm = document.getElementById('gkDirectTeacherForm');
      if (directForm) {
        directForm.addEventListener('submit', (e) => {
          e.preventDefault();
          this.executeDirectTeacherApproval();
        });
      }
      const btnDirectSubmit = document.getElementById('gkBtnSubmitDirect');
      if (btnDirectSubmit && !directForm) {
        btnDirectSubmit.addEventListener('click', (e) => {
          e.preventDefault();
          this.executeDirectTeacherApproval();
        });
      }

      // 빠른 이메일 도메인 칩 (@sch.hs.kr, @goedu.kr)
      document.querySelectorAll('[data-email-domain]').forEach(chip => {
        chip.addEventListener('click', (e) => {
          e.preventDefault();
          const domain = chip.getAttribute('data-email-domain');
          const autoSchool = chip.getAttribute('data-auto-school');
          const emailInput = document.getElementById('gkInputEmail');
          const schoolInput = document.getElementById('gkInputSchool');
          if (emailInput) {
            const cur = emailInput.value.trim();
            const idPart = cur.includes('@') ? cur.split('@')[0] : cur;
            emailInput.value = (idPart || 't98') + '@' + domain;
            emailInput.focus();
          }
          if (autoSchool && schoolInput) {
            schoolInput.value = autoSchool;
          }
        });
      });

      const btnFinal = document.getElementById('gkBtnFinalVerify');
      if (btnFinal) {
        btnFinal.addEventListener('click', () => this.verifyTwoStepApproval());
      }

      // [계정 변경 버튼]
      const btnChangeAcc = document.getElementById('btnChangeGoogleAccount');
      if (btnChangeAcc) {
        btnChangeAcc.addEventListener('click', () => {
          this.currentGoogleAuth = null;
          const loginActionWrap = document.getElementById('gkGoogleLoginActionWrap');
          const successWrap = document.getElementById('gkGoogleAuthSuccessWrap');
          if (loginActionWrap) loginActionWrap.classList.remove('gk-hidden');
          if (successWrap) successWrap.classList.add('gk-hidden');
          const resultMsg = document.getElementById('gkApplyResultMsg');
          if (resultMsg) resultMsg.innerHTML = '';
        });
      }

      // [401 origin 도움말 모달 이벤트]
      
      // 비상 잠금 해제 버튼 (Google 401 오류 건너뛰기)
      const btnBypass = document.getElementById('btnBypassGoogleToSincheon');
      if (btnBypass) {
        btnBypass.addEventListener('click', () => {
          this.closeOriginHelpModal();
          this.authorize({
            email: 't98@sch.hs.kr',
            name: '신천고 선생님',
            school: '신천고등학교',
            role: 'teacher',
            authProvider: 'school_verified',
            badge: '🎉 신천고등학교 공식 교사 3개월 즉시 자동승인'
          });
          this.updateUI();
          alert('✅ 신천고등학교 교사 계정(t98@sch.hs.kr)으로 3개월(90일) 즉시 승인 및 잠금 해제되었습니다!');
        });
      }

      const btnEmergencyCard = document.getElementById('gkBtnEmergencySincheon');
      if (btnEmergencyCard) {
        btnEmergencyCard.addEventListener('click', () => {
          this.authorize({
            email: 't98@sch.hs.kr',
            name: '신천고 선생님',
            school: '신천고등학교',
            role: 'teacher',
            authProvider: 'school_verified',
            badge: '🎉 신천고등학교 공식 교사 3개월 즉시 자동승인'
          });
          this.updateUI();
          alert('✅ 신천고등학교 교사 계정(t98@sch.hs.kr)으로 3개월(90일) 즉시 승인 및 잠금 해제되었습니다!');
        });
      }

      const btnShowOrigin = document.getElementById('btnShowOriginHelp');
      if (btnShowOrigin) {
        btnShowOrigin.addEventListener('click', () => this.openOriginHelpModal());
      }
      const btnCloseOrigin = document.getElementById('gkOriginModalClose');
      if (btnCloseOrigin) {
        btnCloseOrigin.addEventListener('click', () => this.closeOriginHelpModal());
      }
      const originModal = document.getElementById('gkOriginHelpModal');
      if (originModal) {
        originModal.addEventListener('click', (e) => {
          if (e.target === originModal) this.closeOriginHelpModal();
        });
      }
      const btnCopyOrigin = document.getElementById('btnCopyOriginUrl');
      const inOriginCopy = document.getElementById('gkOriginCopyInput');
      if (btnCopyOrigin && inOriginCopy) {
        btnCopyOrigin.addEventListener('click', () => {
          navigator.clipboard.writeText(inOriginCopy.value).then(() => {
            btnCopyOrigin.textContent = '✓ 복사완료!';
            setTimeout(() => { btnCopyOrigin.textContent = '📋 주소 복사'; }, 2000);
          });
        });
      }
      const btnGoMasterFromOrigin = document.getElementById('btnGoMasterFromOriginHelp');
      if (btnGoMasterFromOrigin) {
        btnGoMasterFromOrigin.addEventListener('click', () => {
          this.closeOriginHelpModal();
          const tabBtn = document.querySelector('[data-gk-tab="master"]');
          if (tabBtn) tabBtn.click();
          const pinInput = document.getElementById('gkInputMasterPin');
          if (pinInput) setTimeout(() => pinInput.focus(), 100);
        });
      }

      // 3. 관리자 마스터 키 입장 (환경변수 API 비동기 검증)
      const formMaster = document.getElementById('gkMasterForm');
      if (formMaster) {
        formMaster.addEventListener('submit', async (e) => {
          e.preventDefault();
          const pin = document.getElementById('gkInputMasterPin')?.value || '';
          const msgBox = document.getElementById('gkMasterResultMsg');
          const submitBtn = document.getElementById('gkBtnSubmitMaster') || formMaster.querySelector('button[type="submit"]');

          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = '검증 중...';
          }
          if (msgBox) {
            msgBox.className = 'gk-msg-box is-warn';
            msgBox.textContent = '⏳ 환경변수 마스터키 대조 중입니다...';
          }

          const res = await this.verifyMasterPin(pin);

          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = '3개월 즉시 승인';
          }

          if (res.ok) {
            if (msgBox) {
              msgBox.className = 'gk-msg-box is-success';
              msgBox.textContent = res.message || '🎉 마스터키 인증 성공! 3개월 승인이 활성화되었습니다.';
            }
          } else {
            if (msgBox) {
              msgBox.className = 'gk-msg-box is-error';
              msgBox.textContent = res.error || '❌ 마스터키가 올바르지 않습니다.';
            }
          }
        });
      }
    }
  };

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  window.Gatekeeper = Gatekeeper;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Gatekeeper.init());
  } else {
    Gatekeeper.init();
  }
})();
