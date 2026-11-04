// js/gatekeeper.js — math-tong 사용자 승인 관리 & 관리자 비밀번호 대시보드 시스템
// - 교사 승인제: 신청 ➔ 구글 시트 또는 관리자 대시보드 승인 ➔ 3개월(90일) 자유 로그인
// - 30명 관계형 모의 학급 데이터 연동 및 관리자 원클릭 승인 체계
(function() {
  'use strict';

  const AUTH_KEY = 'swk_gatekeeper_auth';
  const ADMIN_GAS_KEY = 'swk_admin_gas_approval_url';
  const MASTER_PIN_KEY = 'swk_admin_master_pin';
  const PENDING_APPLICANTS_KEY = 'swk_pending_applicants';
  const APPROVED_USERS_KEY = 'swk_approved_users';
  const THREE_MONTHS_MS = 90 * 24 * 60 * 60 * 1000;

  // 기본 시흥시/신천고 및 수도권 주요 고교
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

  const Gatekeeper = {
    isAdminDashboardUnlocked: false,

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

        // 3개월 유효기간 확인
        if (data.expiresAt) {
          const expTime = new Date(data.expiresAt).getTime();
          if (Date.now() > expTime) return false; // 만료됨
        }
        return true;
      } catch (e) {
        return false;
      }
    },

    getAuthUser() {
      try {
        const raw = localStorage.getItem(AUTH_KEY);
        return raw ? JSON.parse(raw) : null;
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

    // 3개월 승인 부여
    authorize(userObj = {}) {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + THREE_MONTHS_MS).toISOString();
      const authData = Object.assign({
        approved: true,
        role: 'teacher',
        authDate: now.toISOString(),
        expiresAt: expiresAt,
        validDays: 90
      }, userObj);
      localStorage.setItem(AUTH_KEY, JSON.stringify(authData));

      // 승인된 사용자 레지스트리에도 등록
      if (userObj.email) {
        const approvedMap = JSON.parse(localStorage.getItem(APPROVED_USERS_KEY) || '{}');
        approvedMap[userObj.email.trim().toLowerCase()] = authData;
        localStorage.setItem(APPROVED_USERS_KEY, JSON.stringify(approvedMap));
      }

      this.closeModal();
      this.updateUI();
    },

    logout() {
      localStorage.removeItem(AUTH_KEY);
      this.updateUI();
      alert('로그아웃되었습니다. 검사 및 AI 세특 작성 기능에 보안 잠금이 적용되었습니다.');
    },

    extendAuth(months = 3) {
      const user = this.getAuthUser();
      if (!user) return;
      const currentExp = user.expiresAt ? new Date(user.expiresAt).getTime() : Date.now();
      const baseTime = Math.max(Date.now(), currentExp);
      const newExp = new Date(baseTime + months * 30 * 24 * 60 * 60 * 1000).toISOString();
      user.expiresAt = newExp;
      localStorage.setItem(AUTH_KEY, JSON.stringify(user));
      this.updateUI();
      alert(`🎉 승인 기간이 ${months}개월 연장되었습니다! (만료일: ${newExp.slice(0, 10)})`);
    },

    openModal(tab = 'apply') {
      const overlay = document.getElementById('appGatekeeperOverlay');
      if (overlay) overlay.classList.remove('gk-hidden');
      this.switchModalTab(tab);
    },

    closeModal() {
      const overlay = document.getElementById('appGatekeeperOverlay');
      if (overlay) overlay.classList.add('gk-hidden');
    },

    switchModalTab(tab = 'apply') {
      const tabs = document.querySelectorAll('.gk-tab-btn');
      tabs.forEach(btn => {
        const isTarget = btn.getAttribute('data-gk-tab') === tab;
        btn.classList.toggle('is-active', isTarget);
      });
      ['apply', 'login', 'admin'].forEach(t => {
        const pane = document.getElementById(`gk-pane-${t}`);
        if (pane) pane.classList.toggle('gk-hidden', t !== tab);
      });
    },

    // 1. 사용 승인 신청 (구글 시트 전송 + 로컬 큐 저장)
    async submitApplication({ name, school, email, phone, reason }) {
      const cleanEmail = String(email || '').trim().toLowerCase();
      const cleanName = String(name || '').trim();
      const cleanSchool = String(school || '').trim();

      if (!cleanEmail || !cleanName || !cleanSchool) {
        return { success: false, message: '성함, 소속 학교, 이메일은 필수 입력 항목입니다.' };
      }

      const newApp = {
        date: new Date().toISOString().replace('T', ' ').slice(0, 19),
        name: cleanName,
        school: cleanSchool,
        email: cleanEmail,
        phone: phone || '',
        reason: reason || '기재요령 세특 연구 및 대입상담',
        status: '대기'
      };

      // 1) 로컬 신청자 큐에 저장 (관리자 대시보드에서 즉시 확인 가능)
      let applicants = JSON.parse(localStorage.getItem(PENDING_APPLICANTS_KEY) || '[]');
      const existIdx = applicants.findIndex(a => a.email.toLowerCase() === cleanEmail);
      if (existIdx >= 0) {
        applicants[existIdx] = Object.assign(applicants[existIdx], newApp);
      } else {
        applicants.unshift(newApp);
      }
      localStorage.setItem(PENDING_APPLICANTS_KEY, JSON.stringify(applicants));

      // 로그인 이메일 칸 자동 채움
      const loginInput = document.getElementById('gkLoginEmail');
      if (loginInput) loginInput.value = cleanEmail;

      // 2) 관리자 구글 시트로 전송 (GAS action=apply_access)
      const gasUrl = this.getGasUrl();
      if (gasUrl) {
        try {
          const payload = {
            action: 'apply_access',
            name: cleanName,
            school: cleanSchool,
            email: cleanEmail,
            phone: phone || '',
            reason: reason || '',
            status: '대기'
          };
          fetch(gasUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
          }).catch(e => console.warn('GAS apply error:', e));
        } catch (e) {}
      }

      return {
        success: true,
        message: '✅ 승인 신청이 접수되었습니다!\n\n관리자(math-tong) 선생님께서 구글 시트 또는 관리자 대시보드에서 승인 처리하신 후 바로 3개월간 이용하실 수 있습니다.'
      };
    },

    // 2. 승인 확인 및 3개월 로그인
    async checkApproval(email) {
      const cleanEmail = (email || '').trim().toLowerCase();
      if (!cleanEmail) {
        return { approved: false, message: '신청하신 이메일 주소를 입력해 주세요.' };
      }

      // 1) 로컬 승인 레지스트리 확인
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
            message: `🎉 [승인 확인 완료] 환영합니다, ${u.name} 선생님! (3개월 이용 활성화)`
          };
        }
      }

      // 2) 구글 시트에서 승인 상태 원격 조회 (GAS action=check_access)
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
                message: `🎉 [구글 시트 승인 확인] 환영합니다, ${teacherName}! (3개월 이용 활성화)`
              };
            } else if (data.found) {
              return {
                approved: false,
                status: '대기',
                message: '⏳ 현재 관리자(math-tong) 선생님의 [승인 대기] 상태입니다.\n관리자 선생님께서 구글 시트 또는 관리자 대시보드에서 승인 처리하신 후 다시 확인해 주세요.'
              };
            }
          }
        } catch (err) {
          console.warn('Google Sheet check_access failed:', err);
        }
      }

      // 3) 로컬 신청자 큐 확인
      const applicants = JSON.parse(localStorage.getItem(PENDING_APPLICANTS_KEY) || '[]');
      const found = applicants.find(a => a.email.toLowerCase() === cleanEmail);
      if (found) {
        if (found.status === '승인') {
          this.authorize({
            email: cleanEmail,
            name: found.name,
            school: found.school,
            role: 'teacher'
          });
          return {
            approved: true,
            name: found.name,
            school: found.school,
            message: `🎉 [관리자 승인 확인] 환영합니다, ${found.name} 선생님! (3개월 이용 활성화)`
          };
        } else {
          return {
            approved: false,
            status: '대기',
            message: '⏳ 현재 관리자(math-tong) 선생님의 [승인 대기] 상태입니다.\n관리자 선생님께서 승인 처리하신 후 이용 가능합니다.'
          };
        }
      }

      return {
        approved: false,
        status: 'not_found',
        message: '⚠️ 신청 내역이 없습니다. 먼저 [1. 사용 승인 신청] 탭에서 신청서를 작성해 주세요.'
      };
    },

    // 3. 관리자 마스터키 검증
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
          this.isAdminDashboardUnlocked = true;
          return { ok: true, data: data };
        }
      } catch (e) {}

      // 로컬 마스터키 백업 검증
      const savedPin = localStorage.getItem(MASTER_PIN_KEY) || 'tong2026!';
      if (entered === savedPin || entered === 'mathtong' || entered === 'tong2026!') {
        this.isAdminDashboardUnlocked = true;
        return { ok: true, data: { name: '관리자 선생님', school: '신천고 · 관리자' } };
      }

      return { ok: false, error: '마스터 비밀번호가 올바르지 않습니다.' };
    },

    // 관리자 대시보드 렌더링
    renderAdminDashboard() {
      const tbody = document.getElementById('gkAdminApplicantListBody');
      const countBadge = document.getElementById('gkApplicantCountBadge');
      const gasInput = document.getElementById('gkInputAdminGasUrl');
      if (gasInput) gasInput.value = this.getGasUrl();

      let applicants = JSON.parse(localStorage.getItem(PENDING_APPLICANTS_KEY) || '[]');
      if (countBadge) {
        const approvedCount = applicants.filter(a => a.status === '승인').length;
        countBadge.textContent = `(총 ${applicants.length}명 / 승인 ${approvedCount}명)`;
      }

      if (!tbody) return;
      if (applicants.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="padding:24px; text-align:center; color:#94a3b8;">접수된 승인 신청이 없습니다.</td></tr>`;
        return;
      }

      tbody.innerHTML = applicants.map((app, idx) => {
        const isApproved = app.status === '승인';
        return `
          <tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:8px 10px; color:#64748b; font-size:11.5px;">${app.date || '-'}</td>
            <td style="padding:8px 10px; font-weight:700; color:#0f172a;">${app.name}</td>
            <td style="padding:8px 10px; color:#334155;">${app.school || '-'}</td>
            <td style="padding:8px 10px; font-family:monospace; color:#2563eb;">${app.email}</td>
            <td style="padding:8px 10px;">
              <span class="gk-status-badge ${isApproved ? 'is-approved' : 'is-pending'}">${app.status || '대기'}</span>
            </td>
            <td style="padding:8px 10px; text-align:center; white-space:nowrap;">
              ${isApproved
                ? `<button type="button" class="gk-btn-reject-sm" onclick="window.Gatekeeper.setApplicantStatus('${app.email}', '대기')">대기 전환</button>`
                : `<button type="button" class="gk-btn-approve-sm" onclick="window.Gatekeeper.setApplicantStatus('${app.email}', '승인')">✅ 즉시 3개월 승인</button>`
              }
              <button type="button" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:11px; margin-left:4px;" onclick="window.Gatekeeper.deleteApplicant('${app.email}')" title="삭제">🗑️</button>
            </td>
          </tr>
        `;
      }).join('');
    },

    setApplicantStatus(email, newStatus) {
      const cleanEmail = email.trim().toLowerCase();
      let applicants = JSON.parse(localStorage.getItem(PENDING_APPLICANTS_KEY) || '[]');
      const target = applicants.find(a => a.email.toLowerCase() === cleanEmail);
      if (target) {
        target.status = newStatus;
        localStorage.setItem(PENDING_APPLICANTS_KEY, JSON.stringify(applicants));
      }

      // 승인일 경우 승인 레지스트리에 3개월 권한 추가
      const approvedMap = JSON.parse(localStorage.getItem(APPROVED_USERS_KEY) || '{}');
      if (newStatus === '승인') {
        const now = new Date();
        approvedMap[cleanEmail] = {
          approved: true,
          email: cleanEmail,
          name: target ? target.name : cleanEmail.split('@')[0],
          school: target ? target.school : '고등학교',
          role: 'teacher',
          authDate: now.toISOString(),
          expiresAt: new Date(now.getTime() + THREE_MONTHS_MS).toISOString(),
          validDays: 90
        };
        localStorage.setItem(APPROVED_USERS_KEY, JSON.stringify(approvedMap));

        // 구글 시트에 실시간 반영 (GAS action=update_approval)
        const gasUrl = this.getGasUrl();
        if (gasUrl) {
          fetch(gasUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
              action: 'update_approval',
              email: cleanEmail,
              status: '승인',
              name: target ? target.name : '',
              school: target ? target.school : ''
            })
          }).catch(e => console.warn('GAS update_approval failed:', e));
        }
        alert(`🎉 [${cleanEmail}] 선생님께 3개월 사용 권한이 승인되었습니다!`);
      } else {
        delete approvedMap[cleanEmail];
        localStorage.setItem(APPROVED_USERS_KEY, JSON.stringify(approvedMap));
      }

      this.renderAdminDashboard();
    },

    deleteApplicant(email) {
      if (!confirm(`${email} 신청 내역을 삭제하시겠습니까?`)) return;
      let applicants = JSON.parse(localStorage.getItem(PENDING_APPLICANTS_KEY) || '[]');
      applicants = applicants.filter(a => a.email.toLowerCase() !== email.toLowerCase());
      localStorage.setItem(PENDING_APPLICANTS_KEY, JSON.stringify(applicants));
      this.renderAdminDashboard();
    },

    // UI 헤더 상태 갱신
    updateUI() {
      const isAuth = this.isAuthorized();
      const user = this.getAuthUser();

      // 상단 헤더 사용자 상태 뱃지 갱신
      let badge = document.getElementById('gatekeeperUserBadge');
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
            ${daysLabel}
            <button type="button" class="gk-logout-btn" onclick="window.Gatekeeper.logout()" style="margin-left:4px; font-size:11px; padding:2px 6px; border-radius:4px; cursor:pointer;">로그아웃</button>
          `;
        } else {
          badge.className = 'gk-user-badge is-locked';
          badge.style.cursor = 'pointer';
          badge.innerHTML = `
            <span style="display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:700; color:#fbbf24;">
              <span>🔒</span> <span>교사 승인 / 로그인</span>
            </span>
          `;
          badge.onclick = () => Gatekeeper.openModal('apply');
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
              alert('🔒 본 기능은 관리자 승인을 받은 선생님에 한하여 이용 가능합니다.\n\n사용 승인 신청 후 관리자 승인이 완료되면 3개월간 이용하실 수 있습니다.');
              this.openModal('apply');
            }
          }, true);
        }
      });
    },

    bindEvents() {
      // 1. 모달 탭 전환 버튼
      document.querySelectorAll('.gk-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const tab = btn.getAttribute('data-gk-tab');
          Gatekeeper.switchModalTab(tab);
        });
      });

      // 2. 사용 승인 신청 폼 제출
      const formApp = document.getElementById('gkApplyFormFull');
      if (formApp) {
        formApp.addEventListener('submit', async (e) => {
          e.preventDefault();
          const btn = document.getElementById('gkBtnSubmitApp');
          const msgBox = document.getElementById('gkApplyFormResultMsg');
          if (btn) {
            btn.disabled = true;
            btn.textContent = '⏳ 구글 시트로 신청서 접수 중...';
          }

          const res = await Gatekeeper.submitApplication({
            name: document.getElementById('gkApplyName')?.value,
            school: document.getElementById('gkApplySchool')?.value,
            email: document.getElementById('gkApplyEmail')?.value,
            phone: document.getElementById('gkApplySubject')?.value,
            reason: document.getElementById('gkApplyReason')?.value
          });

          if (btn) {
            btn.disabled = false;
            btn.textContent = '📋 관리자에게 사용 승인 신청 전송 (구글 시트 접수)';
          }

          if (msgBox) {
            msgBox.style.display = 'block';
            msgBox.className = 'gk-msg-box is-success';
            msgBox.innerHTML = res.message.replace(/\n/g, '<br>');
          }

          setTimeout(() => {
            Gatekeeper.switchModalTab('login');
          }, 2000);
        });
      }

      // 3. 승인 확인 & 로그인 폼
      const formLogin = document.getElementById('gkLoginForm');
      if (formLogin) {
        formLogin.addEventListener('submit', async (e) => {
          e.preventDefault();
          const emailInput = document.getElementById('gkLoginEmail');
          const msgBox = document.getElementById('gkLoginResultMsg');
          const btn = document.getElementById('gkBtnCheckLogin');

          if (btn) {
            btn.disabled = true;
            btn.textContent = '⏳ 승인 상태 확인 중...';
          }

          const res = await Gatekeeper.checkApproval(emailInput ? emailInput.value : '');

          if (btn) {
            btn.disabled = false;
            btn.textContent = '✅ 승인 상태 확인 & 3개월 로그인 입장';
          }

          if (msgBox) {
            msgBox.style.display = 'block';
            msgBox.className = res.approved ? 'gk-msg-box is-success' : 'gk-msg-box is-warn';
            msgBox.innerHTML = res.message.replace(/\n/g, '<br>');
          }
        });
      }

      // 4. 관리자 마스터키 폼
      const formMaster = document.getElementById('gkMasterForm');
      if (formMaster) {
        formMaster.addEventListener('submit', async (e) => {
          e.preventDefault();
          const pinInput = document.getElementById('gkInputMasterPin');
          const msgBox = document.getElementById('gkMasterResultMsg');
          const btn = document.getElementById('gkBtnSubmitMaster');

          if (btn) {
            btn.disabled = true;
            btn.textContent = '⏳ 인증 중...';
          }

          const res = await Gatekeeper.verifyMasterPin(pinInput ? pinInput.value : '');

          if (btn) {
            btn.disabled = false;
            btn.textContent = '대시보드 열기';
          }

          if (res.ok) {
            const authWrap = document.getElementById('gkAdminAuthWrap');
            const dashWrap = document.getElementById('gkAdminDashboardWrap');
            if (authWrap) authWrap.classList.add('gk-hidden');
            if (dashWrap) dashWrap.classList.remove('gk-hidden');
            Gatekeeper.renderAdminDashboard();
          } else {
            if (msgBox) {
              msgBox.style.display = 'block';
              msgBox.className = 'gk-msg-box is-error';
              msgBox.textContent = res.error || '마스터키가 올바르지 않습니다.';
            }
          }
        });
      }

      // 5. 관리자 대시보드 버튼들
      const btnRefresh = document.getElementById('btnAdminRefresh');
      if (btnRefresh) btnRefresh.addEventListener('click', () => Gatekeeper.renderAdminDashboard());

      const btnEnterWorkbench = document.getElementById('btnAdminEnterWorkbench');
      if (btnEnterWorkbench) {
        btnEnterWorkbench.addEventListener('click', () => {
          Gatekeeper.authorize({
            role: 'admin',
            name: '관리자 선생님',
            school: '신천고 · 관리자'
          });
        });
      }

      const btnSaveGas = document.getElementById('btnSaveAdminGasUrl');
      if (btnSaveGas) {
        btnSaveGas.addEventListener('click', () => {
          const val = document.getElementById('gkInputAdminGasUrl')?.value;
          Gatekeeper.setGasUrl(val);
          alert('구글 시트 웹앱 URL이 저장되었습니다!');
        });
      }

      // 학교 검색 팝업 바인딩
      const btnSearchSchool = document.getElementById('gkBtnSearchSchoolApp');
      if (btnSearchSchool) {
        btnSearchSchool.addEventListener('click', () => {
          const input = document.getElementById('gkApplySchool');
          const dropdown = document.getElementById('gkSchoolDropdownApp');
          if (!input || !dropdown) return;
          const q = input.value.trim();
          const list = BUILTIN_SCHOOLS.filter(s => s.name.includes(q) || s.region.includes(q));
          dropdown.classList.remove('gk-hidden');
          dropdown.innerHTML = list.map(s => `
            <div style="padding:6px 10px; cursor:pointer; font-size:12px; border-bottom:1px solid #f1f5f9;" onclick="document.getElementById('gkApplySchool').value='${s.name}'; document.getElementById('gkSchoolDropdownApp').classList.add('gk-hidden');">
              <strong>${s.name}</strong> <span style="color:#64748b; font-size:11px;">(${s.region})</span>
            </div>
          `).join('');
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

  window.Gatekeeper = Gatekeeper;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Gatekeeper.init());
  } else {
    Gatekeeper.init();
  }
})();
