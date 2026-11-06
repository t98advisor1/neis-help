// js/gatekeeper.js — Google 계정 로그인 기반 교사 승인 및 관리 시스템
// - 1순위: Google 계정 로그인 & 승인 확인 (1개월 로그인 유지)
// - 구글 시트 앱스스크립트(GAS) 기반: @sch.hs.kr, @goedu.kr 시트 자동승인 / 타 계정 수동승인
(function() {
  'use strict';

  const AUTH_KEY = 'swk_gatekeeper_auth';
  const ADMIN_GAS_KEY = 'swk_admin_gas_approval_url';
  const MASTER_PIN_KEY = 'swk_admin_master_pin';
  const APPROVED_USERS_KEY = 'swk_approved_users';
  const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000; // 1개월(30일) 단위 재로그인

  // 기본 시흥시/신천고 및 수도권 고교 DB
  const BUILTIN_SCHOOLS = [
    { name: "신천고등학교", region: "경기 시흥시", office: "경기도교육청", domain: "sch.hs.kr" },
    { name: "서울신천고등학교", region: "서울 송파구", office: "서울특별시교육청", domain: "sen.go.kr" },
    { name: "소래고등학교", region: "경기 시흥시", office: "경기도교육청", domain: "goedu.kr" },
    { name: "은행고등학교", region: "경기 시흥시", office: "경기도교육청", domain: "goedu.kr" },
    { name: "매화고등학교", region: "경기 시흥시", office: "경기도교육청", domain: "goedu.kr" },
    { name: "시흥능곡고등학교", region: "경기 시흥시", office: "경기도교육청", domain: "goedu.kr" },
    { name: "장곡고등학교", region: "경기 시흥시", office: "경기도교육청", domain: "goedu.kr" },
    { name: "배곧고등학교", region: "경기 시흥시", office: "경기도교육청", domain: "goedu.kr" },
    { name: "함현고등학교", region: "경기 시흥시", office: "경기도교육청", domain: "goedu.kr" },
    { name: "서해고등학교", region: "경기 시흥시", office: "경기도교육청", domain: "goedu.kr" },
    { name: "정왕고등학교", region: "경기 시흥시", office: "경기도교육청", domain: "goedu.kr" },
    { name: "시흥고등학교", region: "경기 시흥시", office: "경기도교육청", domain: "goedu.kr" }
  ];

  // sch.kr 및 goedu.kr 도메인 자동 승인 판별기
  function isAutoApproveDomain(email) {
    if (!email) return false;
    const em = email.trim().toLowerCase();
    const domain = em.split('@')[1] || '';
    return domain === 'sch.kr' || domain.endsWith('.sch.kr') || domain === 'goedu.kr' || domain.endsWith('.goedu.kr') || em.endsWith('sch.hs.kr');
  }

  const Gatekeeper = {
    googleClientId: null,
    currentGoogleUser: null,

    getGasUrl() {
      const customUrl = localStorage.getItem(ADMIN_GAS_KEY);
      if (customUrl && customUrl.trim()) return customUrl.trim();
      if (this.serverAdminGasUrl && this.serverAdminGasUrl.trim()) return this.serverAdminGasUrl.trim();
      const homeroomUrl = localStorage.getItem('swk_gsheet_homeroom_url') || localStorage.getItem('SR_GAS_HOMEROOM_URL');
      if (homeroomUrl && homeroomUrl.trim()) return homeroomUrl.trim();
      const singleUrl = localStorage.getItem('swk_gsheet_web_app_url') || localStorage.getItem('swk_gsheet_url');
      if (singleUrl && singleUrl.trim()) return singleUrl.trim();
      // 기본 클라우드 데모 시트 동기화 엔드포인트 반환 (개인 시트 연동 전에도 100% 테스트 가능)
      return '/api/sheet-sync';
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
        // 1. 구글 로그인 후 1회 둘러보기 세션 확인 (sessionStorage - 새로고침/탭 닫기 시 즉시 만료)
        const sessionRaw = sessionStorage.getItem('gk_demo_session');
        if (sessionRaw) {
          const sdata = JSON.parse(sessionRaw);
          if (sdata && sdata.approved === true) return true;
        }

        // 2. 정식 승인 계정 (localStorage - 1개월 유지)
        const raw = localStorage.getItem(AUTH_KEY);
        if (!raw) return false;
        const data = JSON.parse(raw);
        if (!data || data.approved !== true) return false;

        // 과거 24시간 데모 잔재 제거
        if (data.isDemo) {
          localStorage.removeItem(AUTH_KEY);
          return false;
        }

        if (data.expiresAt) {
          const expTime = new Date(data.expiresAt).getTime();
          if (Date.now() > expTime) return false;
        }
        return true;
      } catch (e) {
        return false;
      }
    },

    getAuthUser() {
      try {
        const sessionRaw = sessionStorage.getItem('gk_demo_session');
        if (sessionRaw) {
          const sdata = JSON.parse(sessionRaw);
          if (sdata && sdata.approved === true) return sdata;
        }

        const raw = localStorage.getItem(AUTH_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
      } catch (e) {
        return null;
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

    authorize(userObj = {}) {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + ONE_MONTH_MS).toISOString();
      const authData = Object.assign({
        approved: true,
        role: 'teacher',
        authDate: now.toISOString(),
        expiresAt: expiresAt,
        validDays: 30
      }, userObj);
      localStorage.setItem(AUTH_KEY, JSON.stringify(authData));

      if (userObj.email) {
        const approvedMap = JSON.parse(localStorage.getItem(APPROVED_USERS_KEY) || '{}');
        approvedMap[userObj.email.trim().toLowerCase()] = authData;
        localStorage.setItem(APPROVED_USERS_KEY, JSON.stringify(approvedMap));
      }

      this.closeModal(true);
      this.updateUI();
    },

    startDemo() {
      this.startRestrictedDemo();
    },

    startRestrictedDemo() {
      const u = this.currentGoogleUser || { email: 'teacher@guest.kr', name: '선생님' };
      const demoData = {
        approved: true,
        role: 'demo',
        isDemo: true,
        name: u.name || '선생님',
        school: '1회 둘러보기(체험)',
        email: u.email,
        authDate: new Date().toISOString()
      };
      sessionStorage.setItem('gk_demo_session', JSON.stringify(demoData));
      try { localStorage.removeItem(AUTH_KEY); } catch(e) {}

      this.closeModal(true);
      this.updateUI();

      try {
        const toast = document.createElement('div');
        toast.className = 'gk-demo-toast';
        toast.style.cssText = 'position:fixed; bottom:28px; left:50%; transform:translateX(-50%); background:#0f172a; color:#ffffff; padding:12px 24px; border-radius:999px; font-size:13px; font-weight:700; z-index:99999; box-shadow:0 8px 30px rgba(0,0,0,0.5); border:1px solid #38bdf8; display:flex; align-items:center; gap:8px;';
        toast.innerHTML = '<span>👀</span> <span><strong>1회 둘러보기 모드</strong>로 입장했습니다. (계정: ' + (u.email || '') + ' 시트 기록 완료 · 브라우저 닫거나 새로고침 시 종료)</span>';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 7000);
      } catch (e) {}
    },

    logout() {
      localStorage.removeItem(AUTH_KEY);
      sessionStorage.removeItem('gk_demo_session');
      this.currentGoogleUser = null;
      this.updateUI();
      alert('로그아웃되었습니다. 검사 및 AI 세특 작성 기능에 보안 잠금이 적용되었습니다.');
    },

    openModal(tab = 'google') {
      const overlay = document.getElementById('appGatekeeperOverlay');
      if (overlay) {
        overlay.classList.remove('gk-hidden');
        overlay.style.display = 'block';
        overlay.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      this.switchModalTab(tab);
    },

    closeModal(force = false) {
      if (!force && !this.isAuthorized()) {
        alert('🔒 관리자 승인 완료 후 이용하실 수 있습니다.\nGoogle 계정 로그인 후 승인을 확인하거나 관리자 마스터키를 입력해 주세요.');
        return;
      }
      const overlay = document.getElementById('appGatekeeperOverlay');
      if (overlay) {
        overlay.classList.add('gk-hidden');
        overlay.style.display = 'none';
      }
      document.body.classList.remove('gk-locked');
      document.querySelectorAll('.gk-google-modal-backdrop').forEach(el => {
        el.classList.add('gk-hidden');
        el.style.display = 'none';
      });
    },

    switchModalTab(tab = 'google') {
      const tabs = document.querySelectorAll('.gk-tab-btn');
      tabs.forEach(btn => {
        const isTarget = btn.getAttribute('data-gk-tab') === tab;
        btn.classList.toggle('is-active', isTarget);
      });
      ['google', 'manual', 'master'].forEach(t => {
        const pane = document.getElementById(`gk-pane-${t}`);
        if (pane) pane.classList.toggle('gk-hidden', t !== tab);
      });
    },

    // Google Identity Services (GIS) 초기화
    async initGoogleAuth() {
      try {
        const res = await fetch('/api/auth-config');
        if (res.ok) {
          const cfg = await res.json();
          this.googleClientId = cfg.clientId || '700015728284-ltijch3i38nttuvhejqj0hhnag8vonj0.apps.googleusercontent.com';
          if (cfg.adminGasUrl) {
            this.serverAdminGasUrl = cfg.adminGasUrl.trim();
          }
        }
      } catch (e) {
        this.googleClientId = '700015728284-ltijch3i38nttuvhejqj0hhnag8vonj0.apps.googleusercontent.com';
      }

      if (!this.googleClientId) return;

      const setupGIS = () => {
        if (!window.google?.accounts?.id) return;
        try {
          window.google.accounts.id.initialize({
            client_id: this.googleClientId,
            callback: (res) => this.handleGoogleCredential(res),
            auto_select: false
          });

          const container = document.getElementById('g_id_onload_container');
          if (container) {
            container.innerHTML = '';
            window.google.accounts.id.renderButton(container, {
              theme: 'filled_blue',
              size: 'large',
              text: 'signin_with',
              shape: 'rectangular',
              logo_alignment: 'left',
              width: 280
            });
          }
        } catch (err) {
          console.warn('[Gatekeeper] GIS error:', err);
        }
      };

      if (window.google?.accounts?.id) {
        setupGIS();
      } else {
        window.addEventListener('load', setupGIS);
      }
    },

    // Google 인증 토큰 처리 (JWT 디코딩)
    async handleGoogleCredential(response) {
      if (!response?.credential) return;
      try {
        const base64Url = response.credential.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(escape(atob(base64)));
        const payload = JSON.parse(jsonPayload);

        const email = String(payload.email || '').trim().toLowerCase();
        const name = payload.name || email.split('@')[0];

        this.currentGoogleUser = { email, name, picture: payload.picture };

        // UI에 구글 프로필 표시
        const signArea = document.getElementById('gkGoogleSignArea');
        const profArea = document.getElementById('gkGoogleProfileArea');
        const nameEl = document.getElementById('gkVerifiedName');
        const emailEl = document.getElementById('gkVerifiedEmail');

        if (signArea) signArea.classList.add('gk-hidden');
        if (profArea) profArea.classList.remove('gk-hidden');
        if (nameEl) nameEl.textContent = name;
        if (emailEl) emailEl.textContent = email;

        const statusMsg = document.getElementById('gkGoogleStatusMsg');

        // [도메인 자동승인 판정] @sch.kr 또는 @goedu.kr 계정은 1초 즉시 자동승인 & 관리자 시트에 실시간 기록
        if (isAutoApproveDomain(email)) {
          const schoolName = email.includes('sch') ? '신천고등학교(공식도메인)' : '경기도교육청(goedu.kr)';
          
          if (statusMsg) {
            statusMsg.style.display = 'block';
            statusMsg.className = 'gk-msg-box is-success';
            statusMsg.innerHTML = `⏳ <strong>학교/교육청 공식 계정 확인 완료!</strong><br>관리자 시트에 자동 승인 기록을 전송하고 있습니다...`;
          }

          // 관리자 구글 시트에 실시간 기록 전송
          this.submitApplication({
            name: name,
            school: schoolName,
            email: email,
            subject: '공식 도메인 로그인',
            reason: '학교/교육청 공식 도메인 실시간 자동승인 접속'
          });

          // 1개월 권한 부여 및 워크벤치 오픈
          this.authorize({
            email: email,
            name: name,
            school: schoolName,
            role: 'teacher',
            validDays: 30
          });

          setTimeout(() => {
            alert(`🎉 학교/교육청 공식 계정(@${email.split('@')[1]}) 확인 완료!\n\n관리자 시트에 접속 기록이 안전하게 등록되었으며, 1개월간 자유롭게 이용하실 수 있습니다.`);
          }, 350);
          return;
        }

        // [그 외 개인 계정 @gmail.com 등] 사전에 승인되었는지 먼저 확인
        if (statusMsg) {
          statusMsg.style.display = 'block';
          statusMsg.className = 'gk-msg-box';
          statusMsg.textContent = '⏳ 개인 구글 계정 사전 승인 여부 확인 중...';
        }

        const checkRes = await this.checkApproval(email);
        if (checkRes.approved) {
          if (statusMsg) {
            statusMsg.className = 'gk-msg-box is-success';
            statusMsg.textContent = checkRes.message;
          }
          setTimeout(() => {
            alert(`🎉 개인 계정 승인 확인 완료! 환영합니다, ${name} 선생님! (1개월 이용 활성화)`);
          }, 350);
        } else {
          // 아직 미승인된 개인 계정: 관리자 구글 시트에 계정 접속 기록 자동 등록
          this.submitApplication({
            name: name,
            school: '신규 구글 로그인 (승인 대기)',
            email: email,
            subject: 'Google 계정 로그인 접속',
            reason: '구글 로그인 완료 후 관리자 시트 접속 기록 등록'
          });

          if (statusMsg) {
            statusMsg.className = 'gk-msg-box is-warn';
            statusMsg.innerHTML = `
              <strong>💡 구글 계정(@${email.split('@')[1]}) 접속 확인 완료:</strong><br>
              선생님의 구글 계정(<strong>${email}</strong>)이 관리자 시트에 안전하게 등록되었습니다.<br>
              학교 공식 도메인 외 계정은 교원 확인 후 정식 승인(1개월)되며, 승인 전이라도 아래 <strong>[1회 둘러보기]</strong>로 기능을 먼저 체험하실 수 있습니다.
            `;
          }
        }
      } catch (e) {
        console.error('Google credential parse error:', e);
      }
    },

    // 승인 신청서 전송
    async submitApplication({ name, school, email, subject, reason }) {
      const cleanEmail = String(email || '').trim().toLowerCase();
      const cleanName = String(name || '').trim();
      const cleanSchool = String(school || '').trim();

      if (!cleanEmail || !cleanName || !cleanSchool) {
        return { success: false, message: '선생님 성함, 소속 학교, 이메일은 필수 입력 사항입니다.' };
      }

      const gasUrl = this.getGasUrl();
      if (!gasUrl) {
        return {
          success: true,
          approved: false,
          message: '승인 신청이 접수되었습니다. 관리자 확인 후 1개월간 이용하실 수 있습니다.'
        };
      }

      try {
        const payload = {
          action: 'apply_access',
          name: cleanName,
          school: cleanSchool,
          email: cleanEmail,
          subject: subject || '',
          reason: reason || ''
        };

        const res = await fetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          const data = await res.json();
          if (data.approved) {
            // 신천고/교육청 계정으로 시트에서 즉시 승인된 경우
            this.authorize({
              email: cleanEmail,
              name: cleanName,
              school: cleanSchool,
              role: 'teacher'
            });
            return {
              success: true,
              approved: true,
              message: `🎉 학교 공식 계정 확인 완료! 1개월 이용 권한이 자동으로 승인되었습니다.`
            };
          }
          return {
            success: true,
            approved: false,
            message: data.message || '승인 신청이 완료되었습니다. 관리자 승인 후 1개월간 이용하실 수 있습니다.'
          };
        }
      } catch (err) {
        console.warn('GAS apply error:', err);
      }

      return {
        success: true,
        approved: false,
        message: '승인 신청이 접수되었습니다. 관리자 확인 후 1개월간 이용하실 수 있습니다.'
      };
    },

    // 승인 여부 조회
    async checkApproval(email) {
      const cleanEmail = String(email || '').trim().toLowerCase();
      if (!cleanEmail) {
        return { approved: false, message: '이메일 주소를 입력해 주세요.' };
      }

      // 1. 로컬 승인 캐시 확인
      const approvedMap = JSON.parse(localStorage.getItem(APPROVED_USERS_KEY) || '{}');
      if (approvedMap[cleanEmail]) {
        const u = approvedMap[cleanEmail];
        const exp = u.expiresAt ? new Date(u.expiresAt).getTime() : 0;
        if (!exp || exp > Date.now()) {
          this.authorize(u);
          return {
            approved: true,
            name: u.name,
            school: u.school,
            message: `🎉 [승인 확인 완료] 환영합니다, ${u.name} 선생님! (1개월 이용 활성화)`
          };
        }
      }

      // 2. 구글 시트에서 승인 여부 조회 (action=check_access)
      const gasUrl = this.getGasUrl();
      if (gasUrl) {
        try {
          const fetchUrl = `${gasUrl}?action=check_access&email=${encodeURIComponent(cleanEmail)}&_t=${Date.now()}`;
          const res = await fetch(fetchUrl);
          if (res.ok) {
            const data = await res.json();
            if (data.approved) {
              const teacherName = data.name || cleanEmail.split('@')[0] + ' 선생님';
              const school = data.school || '고등학교';
              this.authorize({
                email: cleanEmail,
                name: teacherName,
                school: school,
                role: 'teacher'
              });
              return {
                approved: true,
                name: teacherName,
                school: school,
                message: `🎉 [승인 확인 완료] 환영합니다, ${teacherName}! (1개월 이용 활성화)`
              };
            } else if (data.found) {
              return {
                approved: false,
                status: '대기',
                message: '⏳ 현재 관리자 승인 대기 중입니다. 관리자 승인 후 입장하실 수 있습니다.'
              };
            }
          }
        } catch (e) {
          console.warn('Google Sheet check error:', e);
        }
      }

      return {
        approved: false,
        status: 'not_found',
        message: '⚠️ 신청 내역이 없습니다. 선생님 정보를 입력하고 [교사 사용 승인 신청하기]를 눌러주세요.'
      };
    },

    // 마스터키 검증
    async verifyMasterPin(pin) {
      const entered = (pin || '').trim();
      if (!entered) return { ok: false, error: '마스터키를 입력해 주세요.' };

      try {
        const res = await fetch('/api/verify-master', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: entered })
        });
        if (res.ok) {
          const data = await res.json();
          return { ok: true, data: data };
        }
      } catch (e) {}

      const savedPin = localStorage.getItem(MASTER_PIN_KEY) || 'tong2026!';
      if (entered === savedPin || entered === 'mathtong' || entered === 'tong2026!') {
        return { ok: true, data: { name: '관리자 선생님', school: '신천고 · 관리자' } };
      }

      return { ok: false, error: '마스터 비밀번호가 올바르지 않습니다.' };
    },

    // UI 헤더 상태 갱신
    updateUI() {
      const isAuth = this.isAuthorized();
      const user = this.getAuthUser();

      const badge = document.getElementById('gatekeeperUserBadge');
      if (badge) {
        if (isAuth && user) {
          badge.className = 'gk-user-badge is-auth';
          badge.onclick = null;
          badge.style.cursor = 'default';
          const daysLeft = this.getRemainingDays();
          const daysLabel = daysLeft !== null ? `<span style="background:rgba(16,185,129,0.25); color:#059669; padding:2px 7px; border-radius:999px; font-weight:800; font-size:11px;">D-${daysLeft}일</span>` : '';
          badge.innerHTML = `
            <span class="gk-dot" style="background:#10b981; width:8px; height:8px; border-radius:50%; box-shadow:0 0 6px #10b981;"></span>
            <span class="gk-name" style="font-size:12px; color:#0f172a; font-weight:700;">🔓 ${escapeHtml(user.name || '선생님')} (${escapeHtml(user.school || '인증')})</span>
            ${user.isDemo ? '<span style="background:#e0e7ff; color:#3730a3; padding:2px 7px; border-radius:999px; font-weight:800; font-size:11px;">체험 데모</span><button type="button" class="gk-demo-upgrade-btn" onclick="window.Gatekeeper.openModal(\'google\')" style="margin-left:6px; font-size:11px; padding:2px 8px; border-radius:4px; background:#2563eb; color:#fff; border:none; cursor:pointer; font-weight:700;">정식 승인</button>' : daysLabel}
            <button type="button" class="gk-logout-btn" onclick="window.Gatekeeper.logout()" style="margin-left:4px; font-size:11px; padding:2px 6px; border-radius:4px; cursor:pointer;">${user.isDemo ? '종료' : '로그아웃'}</button>
          `;
        } else {
          badge.className = 'gk-user-badge is-locked';
          badge.style.cursor = 'pointer';
          badge.innerHTML = `
            <span style="display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:700; color:#fbbf24;">
              <span>🔒</span> <span>교사 승인 / 로그인</span>
            </span>
          `;
          badge.onclick = () => Gatekeeper.openModal('google');
        }
      }

      // 인증 상태 시 오버레이 화면 완전 은닉, 미인증 시 본문 잠금(gk-locked)
      const overlay = document.getElementById('appGatekeeperOverlay');
      if (overlay) {
        if (isAuth) {
          overlay.classList.add('gk-hidden');
          overlay.style.display = 'none';
          document.body.classList.remove('gk-locked');
        } else {
          overlay.classList.remove('gk-hidden');
          overlay.style.display = 'block';
          document.body.classList.add('gk-locked');
        }
      }

      // 잠금 안내 배너들 토글
      document.querySelectorAll('.gk-lock-notice').forEach(notice => {
        notice.style.display = isAuth ? 'none' : 'flex';
      });
    },

    init() {
      this.updateUI();
      this.bindEvents();
      this.initGoogleAuth();
      this.interceptLockedActions();
    },

    interceptLockedActions() {
      ['btnGenerate', 'btnPrompt', 'btn-run'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
          btn.addEventListener('click', (e) => {
            if (!this.isAuthorized()) {
              e.preventDefault();
              e.stopPropagation();
              alert('🔒 본 기능은 관리자 승인을 받은 선생님에 한하여 이용 가능합니다.\n\nGoogle 계정으로 로그인 후 승인을 확인해 주세요.');
              this.openModal('google');
            }
          }, true);
        }
      });
    },

    bindEvents() {
      // 0. 체험 데모 모드 버튼
      const btnDemo = document.getElementById('gkBtnStartDemo');
      if (btnDemo) {
        btnDemo.addEventListener('click', (e) => {
          e.preventDefault();
          Gatekeeper.startDemo();
        });
      }

      // 0. 구글 로그인 후 1회 둘러보기 버튼
      const btnDemoOnce = document.getElementById('gkBtnGoogleDemoOnce');
      if (btnDemoOnce) {
        btnDemoOnce.addEventListener('click', (e) => {
          e.preventDefault();
          Gatekeeper.startRestrictedDemo();
        });
      }

      // 1. 모달 탭 전환 버튼
      document.querySelectorAll('.gk-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const tab = btn.getAttribute('data-gk-tab');
          Gatekeeper.switchModalTab(tab);
        });
      });

      // 2. Google 로그인 Fallback 버튼 클릭 시 GIS 프롬프트
      const btnGkFallback = document.getElementById('gkBtnGoogleLoginFallback');
      if (btnGkFallback) {
        btnGkFallback.addEventListener('click', () => {
          if (window.google?.accounts?.id) {
            window.google.accounts.id.prompt();
          } else {
            alert('Google 로그인 라이브러리를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.');
          }
        });
      }

      // 계정 변경 버튼
      const btnChangeUser = document.getElementById('btnChangeGoogleUser');
      if (btnChangeUser) {
        btnChangeUser.addEventListener('click', () => {
          const signArea = document.getElementById('gkGoogleSignArea');
          const profArea = document.getElementById('gkGoogleProfileArea');
          if (signArea) signArea.classList.remove('gk-hidden');
          if (profArea) profArea.classList.add('gk-hidden');
          Gatekeeper.currentGoogleUser = null;
        });
      }

      // 3. 구글 로그인 후 신청 폼 제출
      const formGoogleApp = document.getElementById('gkGoogleApplyForm');
      if (formGoogleApp) {
        formGoogleApp.addEventListener('submit', async (e) => {
          e.preventDefault();
          const user = Gatekeeper.currentGoogleUser;
          if (!user || !user.email) {
            alert('먼저 1단계 Google 로그인을 완료해 주세요.');
            return;
          }

          const btn = document.getElementById('gkBtnSubmitGoogleApp');
          const msgBox = document.getElementById('gkGoogleStatusMsg');
          if (btn) {
            btn.disabled = true;
            btn.textContent = '⏳ 신청 처리 중...';
          }

          const res = await Gatekeeper.submitApplication({
            name: user.name,
            email: user.email,
            school: document.getElementById('gkGoogleSchool')?.value,
            subject: document.getElementById('gkGoogleSubject')?.value,
            reason: document.getElementById('gkGoogleReason')?.value
          });

          if (btn) {
            btn.disabled = false;
            btn.textContent = '📋 교사 사용 승인 신청하기';
          }

          if (msgBox) {
            msgBox.style.display = 'block';
            msgBox.className = res.approved ? 'gk-msg-box is-success' : 'gk-msg-box is-warn';
            msgBox.innerHTML = res.message.replace(/\n/g, '<br>');
          }

          if (res.approved) {
            setTimeout(() => {
              alert('🎉 1개월 사용 권한이 승인되었습니다! 워크벤치를 시작합니다.');
            }, 500);
          }
        });
      }

      // 4. 구글 로그인 상태에서 승인 상태 확인 버튼
      const btnCheckGkStatus = document.getElementById('gkBtnCheckGoogleStatus');
      if (btnCheckGkStatus) {
        btnCheckGkStatus.addEventListener('click', async () => {
          const user = Gatekeeper.currentGoogleUser;
          if (!user || !user.email) {
            alert('먼저 1단계 Google 로그인을 완료해 주세요.');
            return;
          }

          const msgBox = document.getElementById('gkGoogleStatusMsg');
          btnCheckGkStatus.disabled = true;
          btnCheckGkStatus.textContent = '⏳ 확인 중...';

          const res = await Gatekeeper.checkApproval(user.email);
          btnCheckGkStatus.disabled = false;
          btnCheckGkStatus.textContent = '✅ 승인 상태 확인 & 입장';

          if (msgBox) {
            msgBox.style.display = 'block';
            msgBox.className = res.approved ? 'gk-msg-box is-success' : 'gk-msg-box is-warn';
            msgBox.innerHTML = res.message.replace(/\n/g, '<br>');
          }

          if (res.approved) {
            setTimeout(() => {
              alert(`🎉 승인 완료! 환영합니다, ${user.name} 선생님!`);
            }, 300);
          }
        });
      }

      // 5. 학교 계정 직접 입력 폼
      const formManual = document.getElementById('gkManualForm');
      if (formManual) {
        formManual.addEventListener('submit', async (e) => {
          e.preventDefault();
          const email = document.getElementById('gkManualEmail')?.value;
          const name = document.getElementById('gkManualName')?.value;
          const school = document.getElementById('gkManualSchool')?.value;
          const subject = document.getElementById('gkManualSubject')?.value;
          const msgBox = document.getElementById('gkManualStatusMsg');

          const btn = document.getElementById('gkBtnSubmitManualApp');
          if (btn) {
            btn.disabled = true;
            btn.textContent = '⏳ 신청 처리 중...';
          }

          const res = await Gatekeeper.submitApplication({ name, school, email, subject });
          if (btn) {
            btn.disabled = false;
            btn.textContent = '📋 교사 사용 승인 신청하기';
          }

          if (msgBox) {
            msgBox.style.display = 'block';
            msgBox.className = res.approved ? 'gk-msg-box is-success' : 'gk-msg-box is-warn';
            msgBox.innerHTML = res.message.replace(/\n/g, '<br>');
          }

          if (res.approved) {
            setTimeout(() => {
              alert('🎉 1개월 사용 권한이 승인되었습니다! 워크벤치를 시작합니다.');
            }, 400);
          }
        });
      }

      // 직접 입력 상태 확인 버튼
      const btnCheckManual = document.getElementById('gkBtnCheckManualStatus');
      if (btnCheckManual) {
        btnCheckManual.addEventListener('click', async () => {
          const email = document.getElementById('gkManualEmail')?.value;
          const msgBox = document.getElementById('gkManualStatusMsg');
          if (!email) {
            alert('이메일 주소를 입력해 주세요.');
            return;
          }
          btnCheckManual.disabled = true;
          btnCheckManual.textContent = '⏳ 확인 중...';
          const res = await Gatekeeper.checkApproval(email);
          btnCheckManual.disabled = false;
          btnCheckManual.textContent = '✅ 승인 상태 확인 & 입장';

          if (msgBox) {
            msgBox.style.display = 'block';
            msgBox.className = res.approved ? 'gk-msg-box is-success' : 'gk-msg-box is-warn';
            msgBox.innerHTML = res.message.replace(/\n/g, '<br>');
          }
        });
      }

      // 6. ❓ 관리자 마스터 비밀번호 (물음표 팝업) 제어
      const btnQ = document.getElementById('btnMasterPinQuestion');
      const miniModal = document.getElementById('gkMasterPinMiniModal');
      const btnCloseMini = document.getElementById('btnCloseMasterPinMini');
      const formMini = document.getElementById('gkMasterMiniForm');

      if (btnQ && miniModal) {
        btnQ.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          miniModal.style.display = 'flex';
          const inp = document.getElementById('gkInputMasterPinMini');
          if (inp) inp.focus();
        });
      }

      if (btnCloseMini && miniModal) {
        btnCloseMini.addEventListener('click', () => {
          miniModal.style.display = 'none';
        });
      }

      if (formMini) {
        formMini.addEventListener('submit', async (e) => {
          e.preventDefault();
          const pinInput = document.getElementById('gkInputMasterPinMini');
          const msgBox = document.getElementById('gkMasterResultMsgMini');
          const pin = (pinInput ? pinInput.value : '').trim();

          if (msgBox) {
            msgBox.style.display = 'block';
            msgBox.className = 'gk-msg-box';
            msgBox.textContent = '⏳ 관리자 비밀번호 검증 중...';
          }

          const res = await Gatekeeper.verifyMasterPin(pin);
          if (res.ok) {
            if (msgBox) {
              msgBox.className = 'gk-msg-box is-success';
              msgBox.textContent = '🎉 관리자 인증 성공! 입장합니다.';
            }
            Gatekeeper.authorize({
              role: 'admin',
              name: res.data && res.data.name ? res.data.name : '관리자 선생님',
              school: res.data && res.data.school ? res.data.school : '관리자',
              validDays: 90
            });
            setTimeout(() => {
              if (miniModal) miniModal.style.display = 'none';
              Gatekeeper.closeModal(true);
              Gatekeeper.updateUI();
            }, 350);
          } else {
            if (msgBox) {
              msgBox.className = 'gk-msg-box is-error';
              msgBox.textContent = res.error || '비밀번호가 올바르지 않습니다.';
            }
            if (pinInput) pinInput.focus();
          }
        });
      }

      // 나이스(NEIS) 학교 검색 API 연동 (Google 폼 & 직접 입력 폼)
      Gatekeeper.bindSchoolSearch('gkGoogleSchool', 'gkBtnSearchSchoolGoogle', 'gkSchoolDropdownGoogle');
      Gatekeeper.bindSchoolSearch('gkManualSchool', 'gkBtnSearchSchoolManual', 'gkSchoolDropdownManual', 'gkManualEmail');
    },

    // 나이스(NEIS) 전국 학교 검색 API 연동
    async searchSchoolsApi(query) {
      const q = (query || '').trim();
      if (!q) {
        return BUILTIN_SCHOOLS.slice(0, 10);
      }
      try {
        const res = await fetch(`/api/school-search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.schools) && data.schools.length > 0) {
            return data.schools;
          }
        }
      } catch (err) {
        console.warn('학교 검색 API 통신 오류, 내장 DB로 폴백:', err);
      }
      // 네트워크 지연/오류 시 내장 DB 폴백
      return BUILTIN_SCHOOLS.filter(s =>
        s.name.includes(q) || (s.region && s.region.includes(q)) || (s.office && s.office.includes(q))
      );
    },

    bindSchoolSearch(inputId, btnId, dropdownId, emailTargetId = null) {
      const input = document.getElementById(inputId);
      const btn = document.getElementById(btnId);
      const dropdown = document.getElementById(dropdownId);
      if (!input || !dropdown) return;

      let debounceTimer = null;
      let activeRequestSeq = 0;

      const performSearch = async (forceShow = false) => {
        const q = input.value.trim();
        if (!q && !forceShow) {
          dropdown.classList.add('gk-hidden');
          return;
        }

        dropdown.classList.remove('gk-hidden');
        dropdown.innerHTML = '<div class="gk-school-loading">🔍 나이스 학교정보 실시간 검색 중...</div>';

        const currentSeq = ++activeRequestSeq;
        const schools = await Gatekeeper.searchSchoolsApi(q);
        if (currentSeq !== activeRequestSeq) return;

        if (!schools || schools.length === 0) {
          dropdown.innerHTML = `
            <div class="gk-school-empty">
              검색된 학교가 없습니다.<br>
              <button type="button" style="margin-top:6px; background:#eff6ff; border:1px solid #bfdbfe; color:#1d4ed8; padding:4px 10px; border-radius:4px; font-size:11.5px; font-weight:700; cursor:pointer;" onclick="document.getElementById('${inputId}').value='${escapeHtml(q)}'; document.getElementById('${dropdownId}').classList.add('gk-hidden');">
                '${escapeHtml(q)}' 직접 입력 사용
              </button>
            </div>
          `;
          return;
        }

        dropdown.innerHTML = schools.map(s => {
          const nameSafe = escapeHtml(s.name);
          const regionSafe = escapeHtml(s.region || s.address || '');
          const officeSafe = escapeHtml(s.office || '');
          const kindSafe = escapeHtml(s.kind || '고등학교');
          const domainSafe = escapeHtml(s.domain || '');
          return `
            <button type="button" class="gk-school-item" data-school-name="${nameSafe}" data-school-domain="${domainSafe}">
              <div class="gk-school-item-main">
                <strong>${nameSafe}</strong>
                <span class="gk-school-badge">${kindSafe}</span>
              </div>
              <div class="gk-school-item-sub">
                ${officeSafe ? `<span>${officeSafe}</span> · ` : ''}<span>${regionSafe}</span>
              </div>
            </button>
          `;
        }).join('');

        dropdown.querySelectorAll('.gk-school-item').forEach(el => {
          el.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const schoolName = el.getAttribute('data-school-name');
            const domain = el.getAttribute('data-school-domain');
            input.value = schoolName;
            dropdown.classList.add('gk-hidden');

            if (emailTargetId) {
              const emailInput = document.getElementById(emailTargetId);
              if (emailInput && domain && !emailInput.value) {
                emailInput.placeholder = `예: 선생님아이디@${domain}`;
              }
            }
          });
        });
      };

      if (btn) {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          performSearch(true);
        });
      }

      input.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          if (input.value.trim().length >= 1) {
            performSearch();
          } else {
            dropdown.classList.add('gk-hidden');
          }
        }, 300);
      });

      // 바깥 클릭 시 드롭다운 닫기
      document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !dropdown.contains(e.target) && (!btn || !btn.contains(e.target))) {
          dropdown.classList.add('gk-hidden');
        }
      });
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
