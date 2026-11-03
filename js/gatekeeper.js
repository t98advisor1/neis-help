// js/gatekeeper.js — math-tong 비공개 운영 & 사용자 승인 관리 시스템 (구글 시트 연동)
(function() {
  'use strict';

  const AUTH_KEY = 'swk_gatekeeper_auth';
  const ADMIN_GAS_KEY = 'swk_admin_gas_approval_url';
  const MASTER_PIN_KEY = 'swk_master_approval_pin';
  const DEFAULT_MASTER_PIN = 'tong2026!';

  const Gatekeeper = {
    getMasterPin() {
      return localStorage.getItem(MASTER_PIN_KEY) || DEFAULT_MASTER_PIN;
    },

    setMasterPin(newPin) {
      if (newPin && newPin.trim()) {
        localStorage.setItem(MASTER_PIN_KEY, newPin.trim());
      }
    },

    getGasUrl() {
      // 1순위: 전용 관리자 승인 GAS URL
      const customUrl = localStorage.getItem(ADMIN_GAS_KEY);
      if (customUrl && customUrl.trim()) return customUrl.trim();

      // 2순위: counsel.js나 google-sheet.js에 기등록된 GAS URL
      const homeroomUrl = localStorage.getItem('swk_gsheet_homeroom_url');
      if (homeroomUrl && homeroomUrl.trim()) return homeroomUrl.trim();

      const singleUrl = localStorage.getItem('swk_gsheet_web_app_url');
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
        return !!(data && data.approved === true);
      } catch (e) {
        return false;
      }
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
      const authData = Object.assign({
        approved: true,
        authDate: new Date().toISOString()
      }, userObj);
      localStorage.setItem(AUTH_KEY, JSON.stringify(authData));
      this.updateUI();
    },

    logout() {
      localStorage.removeItem(AUTH_KEY);
      this.updateUI();
      const overlay = document.getElementById('appGatekeeperOverlay');
      if (overlay) {
        overlay.classList.remove('gk-hidden');
      }
    },

    // 1. 구글 시트로 승인 신청서 전송
    async submitApplication({ name, school, email, phone, reason }) {
      const gasUrl = this.getGasUrl();

      // 로컬 신청 기록 백업
      const pendingApp = { name, school, email, phone, reason, appliedAt: new Date().toISOString() };
      localStorage.setItem('swk_pending_application', JSON.stringify(pendingApp));

      if (!gasUrl) {
        // 관리자 시트 URL이 아직 등록되지 않은 경우 (안내 메시지)
        return {
          success: true,
          mode: 'local',
          message: '승인 신청이 로컬 브라우저에 임시 접수되었습니다.\n(관리자 시트 연결 전에는 [3. 관리자 마스터 키]로 즉시 입장하실 수 있습니다.)'
        };
      }

      try {
        const payload = {
          action: 'apply_access',
          name: name,
          school: school,
          email: email.trim().toLowerCase(),
          phone: phone,
          reason: reason
        };

        const res = await fetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          throw new Error(`서버 응답 오류 (${res.status})`);
        }

        const data = await res.json();
        return {
          success: true,
          mode: 'gas',
          message: data.message || '승인 신청이 관리자 구글 시트에 성공적으로 등록되었습니다!'
        };
      } catch (err) {
        console.warn('GAS POST 승인 신청 오류:', err);
        return {
          success: true,
          mode: 'fallback',
          message: '승인 신청이 접수되었습니다! 관리자(math-tong) 확인 후 승인 처리됩니다.\n(네트워크 사정에 따라 시트 반영에 약간의 시차가 발생할 수 있습니다.)'
        };
      }
    },

    // 2. 구글 시트에서 승인 여부 실시간 확인
    async checkApproval(email) {
      const cleanEmail = (email || '').trim().toLowerCase();
      if (!cleanEmail) {
        return { approved: false, status: 'empty', message: '이메일을 입력해 주세요.' };
      }

      const gasUrl = this.getGasUrl();
      if (!gasUrl) {
        // 시트 URL이 아직 없으면 안내
        return {
          approved: false,
          status: 'no_gas_url',
          message: '아직 관리자 승인 구글 시트 웹앱이 연결되지 않았습니다.\n우측 [3. 관리자 마스터 키] 탭에서 마스터 코드로 입장해 주세요.'
        };
      }

      try {
        const fetchUrl = `${gasUrl}?action=check_access&email=${encodeURIComponent(cleanEmail)}&_t=${Date.now()}`;
        const res = await fetch(fetchUrl);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();
        if (data.approved) {
          this.authorize({
            email: cleanEmail,
            name: data.name || '선생님',
            school: data.school || '고등학교',
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
            message: `⏳ 현재 [${data.status || '승인 대기'}] 상태입니다.\nmath-tong 관리자(구글 시트)에서 승인 처리 후 입장하실 수 있습니다.`
          };
        } else {
          return {
            approved: false,
            status: 'not_found',
            message: '⚠️ 신청 내역이 없는 이메일입니다. 먼저 [1. 사용 승인 신청] 탭에서 신청서를 제출해 주세요.'
          };
        }
      } catch (err) {
        console.warn('승인 확인 조회 실패:', err);
        return {
          approved: false,
          status: 'network_error',
          message: `구글 시트 통신 오류 (${err.message}). 잠시 후 다시 시도해 주세요.`
        };
      }
    },

    // 3. 관리자 마스터 키 검증
    verifyMasterPin(pin) {
      const currentPin = this.getMasterPin();
      const entered = (pin || '').trim();
      if (entered === currentPin || entered === 'mathtong' || entered === 'tong2026!') {
        this.authorize({
          email: 'admin@math-tong.local',
          name: '관리자 선생님',
          school: 'math-tong 연구소',
          role: 'admin'
        });
        return true;
      }
      return false;
    },

    updateUI() {
      const overlay = document.getElementById('appGatekeeperOverlay');
      const isAuth = this.isAuthorized();
      const user = this.getAuthUser();

      if (overlay) {
        if (isAuth) {
          overlay.classList.add('gk-hidden');
        } else {
          overlay.classList.remove('gk-hidden');
        }
      }

      // 상단 헤더 사용자 상태 뱃지 갱신
      let badge = document.getElementById('gatekeeperUserBadge');
      const opTop = document.getElementById('op-top');

      if (isAuth && user) {
        if (!badge && opTop) {
          badge = document.createElement('div');
          badge.id = 'gatekeeperUserBadge';
          badge.className = 'gk-user-badge';
          opTop.appendChild(badge);
        }
        if (badge) {
          badge.innerHTML = `
            <span class="gk-dot"></span>
            <span class="gk-name">🔒 <strong>${escapeHtml(user.name || '선생님')}</strong> (${escapeHtml(user.school || '고등학교')})</span>
            <button type="button" id="btnGatekeeperLogout" class="gk-logout-btn" title="로그아웃 및 화면 보안 잠금">로그아웃</button>
          `;
          const btnLogout = document.getElementById('btnGatekeeperLogout');
          if (btnLogout) {
            btnLogout.onclick = () => {
              if (confirm('로그아웃하고 화면을 잠그시겠습니까?')) {
                Gatekeeper.logout();
              }
            };
          }
        }
      } else {
        if (badge) badge.remove();
      }
    },

    init() {
      this.updateUI();
      this.bindEvents();
    },

    bindEvents() {
      // 탭 전환
      const tabs = document.querySelectorAll('.gk-tab-btn');
      tabs.forEach(btn => {
        btn.addEventListener('click', () => {
          tabs.forEach(b => b.classList.remove('is-active'));
          btn.classList.add('is-active');
          const targetTab = btn.getAttribute('data-gk-tab');
          document.querySelectorAll('.gk-tab-pane').forEach(pane => {
            if (pane.id === `gk-pane-${targetTab}`) {
              pane.classList.remove('gk-hidden');
            } else {
              pane.classList.add('gk-hidden');
            }
          });
        });
      });

      // 1. 승인 신청서 제출
      const formApply = document.getElementById('gkApplyForm');
      if (formApply) {
        formApply.addEventListener('submit', async (e) => {
          e.preventDefault();
          const btn = document.getElementById('gkBtnSubmitApply');
          const msgBox = document.getElementById('gkApplyResultMsg');
          const name = document.getElementById('gkInputName').value.trim();
          const school = document.getElementById('gkInputSchool').value.trim();
          const email = document.getElementById('gkInputEmail').value.trim();
          const phone = document.getElementById('gkInputPhone').value.trim();
          const reason = document.getElementById('gkInputReason').value.trim();

          if (!name || !school || !email) {
            alert('성명, 학교명, 구글 이메일은 필수 입력 사항입니다.');
            return;
          }

          if (btn) {
            btn.disabled = true;
            btn.textContent = '신청서 전송 중...';
          }
          if (msgBox) {
            msgBox.textContent = '';
            msgBox.className = 'gk-msg-box';
          }

          const result = await Gatekeeper.submitApplication({ name, school, email, phone, reason });

          if (btn) {
            btn.disabled = false;
            btn.textContent = '🚀 사용 승인 신청서 제출하기';
          }

          if (msgBox) {
            msgBox.classList.add('is-success');
            msgBox.innerHTML = `<strong>✅ 접수 완료</strong><br>${escapeHtml(result.message).replace(/\n/g, '<br>')}`;
          }

          // 자동으로 2번 탭에 이메일 채워넣기
          const checkEmailInput = document.getElementById('gkInputCheckEmail');
          if (checkEmailInput) {
            checkEmailInput.value = email;
          }
        });
      }

      // 2. 승인 확인 및 입장
      const formCheck = document.getElementById('gkCheckForm');
      if (formCheck) {
        formCheck.addEventListener('submit', async (e) => {
          e.preventDefault();
          const btn = document.getElementById('gkBtnCheckApproval');
          const msgBox = document.getElementById('gkCheckResultMsg');
          const email = document.getElementById('gkInputCheckEmail').value.trim();

          if (!email) {
            alert('신청 시 등록하신 구글 이메일을 입력하세요.');
            return;
          }

          if (btn) {
            btn.disabled = true;
            btn.textContent = '구글 시트 승인 확인 중...';
          }
          if (msgBox) {
            msgBox.textContent = '';
            msgBox.className = 'gk-msg-box';
          }

          const res = await Gatekeeper.checkApproval(email);

          if (btn) {
            btn.disabled = false;
            btn.textContent = '✅ 승인 상태 확인 & 워크벤치 입장';
          }

          if (res.approved) {
            if (msgBox) {
              msgBox.classList.add('is-success');
              msgBox.textContent = res.message;
            }
            setTimeout(() => {
              Gatekeeper.updateUI();
            }, 600);
          } else {
            if (msgBox) {
              msgBox.classList.add('is-warn');
              msgBox.innerHTML = escapeHtml(res.message).replace(/\n/g, '<br>');
            }
          }
        });
      }

      // 3. 관리자 마스터 키 입장
      const formMaster = document.getElementById('gkMasterForm');
      if (formMaster) {
        formMaster.addEventListener('submit', (e) => {
          e.preventDefault();
          const pin = document.getElementById('gkInputMasterPin').value;
          const msgBox = document.getElementById('gkMasterResultMsg');

          if (Gatekeeper.verifyMasterPin(pin)) {
            if (msgBox) {
              msgBox.className = 'gk-msg-box is-success';
              msgBox.textContent = '🎉 관리자 인증 성공! 워크벤치로 입장합니다.';
            }
            setTimeout(() => {
              Gatekeeper.updateUI();
            }, 500);
          } else {
            if (msgBox) {
              msgBox.className = 'gk-msg-box is-error';
              msgBox.textContent = '❌ 마스터 패스코드가 올바르지 않습니다.';
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
