/**
 * 접속 인증 미들웨어 (Vercel Edge Middleware) — 구글 계정 로그인
 *
 * 흐름:
 *  1) 로그인 쿠키(sr_auth)가 유효하면 → 통과(앱 정적 파일을 그대로 내려줌)
 *  2) 없거나 만료면 → 로그인 화면(「Google 계정으로 로그인」 버튼)을 보여줌
 *  3) 버튼(GET /__login) → 구글 로그인 창으로 보냄(OAuth 2.0 authorization code)
 *  4) 구글이 돌려보내면(GET /__callback) → code 를 id_token 으로 바꿔 이메일을 확인하고,
 *     허용 목록에 있으면 하루짜리 서명 쿠키를 발급해 앱으로 보냄
 *  5) 로그아웃(GET /__logout) → 쿠키 삭제 후 로그인 화면으로
 *
 * 환경변수(Vercel → Settings → Environment Variables)
 *   GOOGLE_CLIENT_ID      구글 클라우드 콘솔의 OAuth 클라이언트 ID
 *   GOOGLE_CLIENT_SECRET  같은 곳의 클라이언트 보안 비밀번호
 *   AUTH_SECRET           쿠키 위조 방지 서명키(아무 긴 임의 문자열)
 *   ALLOWED_EMAILS        들어올 수 있는 이메일, 쉼표로 구분 (예: a@school.hs.kr,b@gmail.com)
 *   ALLOWED_DOMAINS       들어올 수 있는 이메일 도메인, 쉼표로 구분 (예: school.hs.kr)
 *   GOOGLE_REDIRECT_URI   (선택) 기본값은 "<접속 주소>/__callback"
 *  ALLOWED_EMAILS 와 ALLOWED_DOMAINS 중 하나는 반드시 있어야 한다. 둘 다 없으면 아무도 들어오지 못한다
 *  (구글 계정이 있는 누구나 들어오는 것을 막기 위해서다).
 */

export const config = {
  // 정적 자원(_next 등은 없지만) 포함 모든 경로에 적용. 파비콘 정도만 통과시킨다.
  matcher: ['/((?!favicon.ico).*)'],
};

const DAY = 60 * 60 * 24; // 하루(초)

function parseCookies(header) {
  const out = {};
  (header || '').split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > -1) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

function b64url(bytes) {
  let s = btoa(String.fromCharCode(...new Uint8Array(bytes)));
  return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sign(msg, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg));
  return b64url(sig);
}

// 쿠키 값 = "이메일|만료시각" 과 그 서명
async function makeToken(user, secret) {
  const exp = Math.floor(Date.now() / 1000) + DAY;
  const payload = `${user}|${exp}`;
  const sig = await sign(payload, secret);
  return `${btoa(payload).replace(/=+$/,'')}.${sig}`;
}

async function verifyToken(token, secret) {
  if (!token || token.indexOf('.') < 0) return null;
  const [p, sig] = token.split('.');
  let payload = '';
  try { payload = atob(p); } catch (e) { return null; }
  const expect = await sign(payload, secret);
  if (sig !== expect) return null;              // 서명 불일치 = 위조
  const [user, expStr] = payload.split('|');
  const exp = parseInt(expStr, 10);
  if (!exp || Math.floor(Date.now() / 1000) > exp) return null; // 만료
  return { user };
}

const CALLBACK_PATH = '/__callback';
const STATE_COOKIE = 'sr_state';

function loginPage(errorMsg) {
  const err = errorMsg ? `<p class="err">${errorMsg}</p>` : '';
  return `<!doctype html><html lang="ko"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>학교생활기록부 점검 도우미 — 로그인</title>
<style>
  :root{--rausch:#FF385C;--ink:#222;--muted:#6a6a6a;--line:#e5e5e5;--bg:#f7f7f7;}
  *{box-sizing:border-box}
  body{margin:0;font-family:'Malgun Gothic','Apple SD Gothic Neo',system-ui,sans-serif;
    background:var(--bg);color:var(--ink);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
  .card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:40px 32px;
    width:100%;max-width:380px;box-shadow:0 6px 24px rgba(0,0,0,.06)}
  .logo{width:48px;height:48px;border-radius:12px;background:var(--rausch);margin:0 auto 20px;
    display:flex;align-items:center;justify-content:center}
  .logo svg{width:28px;height:28px}
  h1{font-size:20px;text-align:center;margin:0 0 6px;color:var(--rausch)}
  .sub{text-align:center;color:var(--muted);font-size:13px;margin:0 0 28px}
  .gbtn{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:12px 14px;
    border:1px solid #dadce0;border-radius:10px;background:#fff;color:#3c4043;font-size:15px;font-weight:600;
    text-decoration:none}
  .gbtn:hover{background:#f8f9fa;border-color:#c6c9cc}
  .gbtn svg{width:20px;height:20px;flex:none}
  .hint{text-align:center;color:var(--muted);font-size:12px;margin:16px 0 0}
  .err{text-align:center;color:var(--rausch);font-size:13px;margin:16px 0 0;font-weight:600;line-height:1.5}
  .foot{text-align:center;color:#aaa;font-size:11px;margin:22px 0 0;line-height:1.5}
</style></head>
<body>
  <div class="card">
    <div class="logo"><svg viewBox="0 0 32 32"><path d="M9 10h14M9 16h14M9 22h9" stroke="#fff" stroke-width="2.4" stroke-linecap="round" fill="none"/></svg></div>
    <h1>학교생활기록부 점검 도우미</h1>
    <p class="sub">교내 접속용 · 구글 계정으로 로그인해 주세요</p>
    <a class="gbtn" href="/__login">
      <svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
      Google 계정으로 로그인
    </a>
    ${err}
    <p class="hint">허용된 계정만 들어올 수 있습니다.</p>
    <p class="foot">업로드한 파일은 이 브라우저 안에서만 처리되며,<br>외부로 전송되지 않습니다.</p>
  </div>
</body></html>`;
}

function htmlResponse(body, status, extraHeaders) {
  return new Response(body, {
    status: status || 200,
    headers: Object.assign({ 'content-type': 'text/html; charset=utf-8' }, extraHeaders || {}),
  });
}

function csvSet(value) {
  return new Set((value || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean));
}

function isAllowed(email, emails, domains) {
  const e = email.toLowerCase();
  return emails.has(e) || domains.has(e.slice(e.lastIndexOf('@') + 1));
}

// 서버가 구글에서 직접(TLS) 받은 id_token 이므로 서명 검증 없이 payload 만 읽는다(구글 문서가 허용하는 방식).
function readIdToken(idToken) {
  try {
    const b = idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b), (c) => c.charCodeAt(0))));
  } catch (e) { return null; }
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const COOKIE_FLAGS = 'Path=/; HttpOnly; Secure; SameSite=Lax';

export default async function middleware(request) {
  const url = new URL(request.url);
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
  const secret = process.env.AUTH_SECRET || '';
  const emails = csvSet(process.env.ALLOWED_EMAILS);
  const domains = csvSet(process.env.ALLOWED_DOMAINS);

  // 설정이 모자라면 전부 막고 안내(보안상 통과시키지 않는다)
  const missing = [];
  if (!clientId) missing.push('GOOGLE_CLIENT_ID');
  if (!clientSecret) missing.push('GOOGLE_CLIENT_SECRET');
  if (!secret) missing.push('AUTH_SECRET');
  if (emails.size === 0 && domains.size === 0) missing.push('ALLOWED_EMAILS 또는 ALLOWED_DOMAINS');
  if (missing.length) {
    return htmlResponse(
      '<meta charset="utf-8"><p style="font-family:sans-serif;padding:40px;line-height:1.7">' +
      '로그인 설정이 아직 끝나지 않았습니다. Vercel 환경변수에 다음 값을 등록한 뒤 다시 배포해 주세요.<br><b>' +
      missing.join(', ') + '</b></p>',
      503
    );
  }

  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${url.origin}${CALLBACK_PATH}`;
  const cookies = parseCookies(request.headers.get('cookie'));

  // 로그아웃
  if (url.pathname === '/__logout') {
    return new Response(null, {
      status: 302,
      headers: { 'location': '/', 'set-cookie': `sr_auth=; Max-Age=0; ${COOKIE_FLAGS}` },
    });
  }

  // 로그인 버튼 → 구글 로그인 창
  if (url.pathname === '/__login') {
    const state = b64url(crypto.getRandomValues(new Uint8Array(16)));
    const q = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email',
      state,
      prompt: 'select_account',
    });
    return new Response(null, {
      status: 302,
      headers: {
        'location': `https://accounts.google.com/o/oauth2/v2/auth?${q}`,
        'set-cookie': `${STATE_COOKIE}=${state}; Max-Age=600; ${COOKIE_FLAGS}`,
      },
    });
  }

  // 구글에서 돌아옴
  if (url.pathname === CALLBACK_PATH) {
    const clearState = `${STATE_COOKIE}=; Max-Age=0; ${COOKIE_FLAGS}`;
    const fail = (msg, status) => htmlResponse(loginPage(msg), status || 401, { 'set-cookie': clearState });

    if (url.searchParams.get('error')) return fail('구글 로그인이 취소되었습니다. 다시 시도해 주세요.');
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    // state 가 쿠키와 다르면 남이 만든 로그인 요청(CSRF)일 수 있다
    if (!code || !state || state !== cookies[STATE_COOKIE]) {
      return fail('로그인 요청이 만료되었거나 올바르지 않습니다. 다시 시도해 주세요.');
    }

    let claims = null;
    try {
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code, client_id: clientId, client_secret: clientSecret,
          redirect_uri: redirectUri, grant_type: 'authorization_code',
        }),
      });
      if (res.ok) claims = readIdToken((await res.json()).id_token || '');
    } catch (e) { /* 아래에서 실패로 처리 */ }

    if (!claims || claims.aud !== clientId || !claims.email || claims.email_verified !== true ||
        !['https://accounts.google.com', 'accounts.google.com'].includes(claims.iss)) {
      return fail('구글 계정을 확인하지 못했습니다. 잠시 뒤 다시 시도해 주세요.');
    }
    if (!isAllowed(claims.email, emails, domains)) {
      return fail(`${escapeHtml(claims.email)} 계정은 접속이 허용되지 않았습니다.<br>허용된 계정으로 다시 로그인해 주세요.`, 403);
    }

    const token = await makeToken(claims.email, secret);
    const headers = new Headers({ 'location': '/' });
    headers.append('set-cookie', `sr_auth=${encodeURIComponent(token)}; Max-Age=${DAY}; ${COOKIE_FLAGS}`);
    headers.append('set-cookie', clearState);
    return new Response(null, { status: 302, headers });
  }

  // 이미 로그인돼 있으면 통과
  const auth = await verifyToken(cookies['sr_auth'], secret);
  if (auth) return; // 통과

  // 그 외 모든 요청 → 로그인 화면
  return htmlResponse(loginPage(''), 401);
}
