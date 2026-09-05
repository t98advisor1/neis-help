/**
 * 접속 인증 미들웨어 (Vercel Edge Middleware)
 *
 * 흐름:
 *  1) 로그인 쿠키가 유효하면 → 통과(앱 정적 파일을 그대로 내려줌)
 *  2) 없거나 만료면 → 예쁜 로그인 화면(HTML)을 보여줌
 *  3) 로그인 폼 제출(POST /__login) → 아이디/비밀번호 검증 →
 *     맞으면 하루짜리 서명 쿠키 발급 후 앱으로, 틀리면 로그인 화면에 오류 표시
 *  4) 로그아웃(GET /__logout) → 쿠키 삭제 후 로그인 화면으로
 *
 * 계정: 환경변수 APP_CREDENTIALS = "아이디1:비밀번호1,아이디2:비밀번호2,..."
 * 쿠키 위조 방지 서명키: 환경변수 AUTH_SECRET (아무 긴 임의 문자열)
 *   - AUTH_SECRET 이 없으면 APP_CREDENTIALS 를 대신 키로 써서 최소한의 서명은 건다.
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

// 쿠키 값 = "만료시각.서명"  (사용자명은 넣지 않아도 되지만 로그아웃 표시용으로 넣는다)
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

function loginPage(errorMsg) {
  const err = errorMsg
    ? `<p class="err">${errorMsg}</p>`
    : '<p class="hint">배부받은 아이디와 비밀번호를 입력해 주세요.</p>';
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
  .sub{text-align:center;color:var(--muted);font-size:13px;margin:0 0 24px}
  label{display:block;font-size:13px;color:var(--muted);margin:14px 0 6px}
  input{width:100%;padding:12px 14px;border:1px solid var(--line);border-radius:10px;font-size:15px}
  input:focus{outline:none;border-color:var(--rausch)}
  button{width:100%;margin-top:22px;padding:13px;border:none;border-radius:10px;
    background:var(--rausch);color:#fff;font-size:15px;font-weight:600;cursor:pointer}
  button:hover{background:#e11d48}
  .hint{text-align:center;color:var(--muted);font-size:12px;margin:16px 0 0}
  .err{text-align:center;color:var(--rausch);font-size:13px;margin:16px 0 0;font-weight:600}
  .foot{text-align:center;color:#aaa;font-size:11px;margin:22px 0 0;line-height:1.5}
</style></head>
<body>
  <form class="card" method="POST" action="/__login">
    <div class="logo"><svg viewBox="0 0 32 32"><path d="M9 10h14M9 16h14M9 22h9" stroke="#fff" stroke-width="2.4" stroke-linecap="round" fill="none"/></svg></div>
    <h1>학교생활기록부 점검 도우미</h1>
    <p class="sub">교내 접속용 · 로그인이 필요합니다</p>
    <label for="u">아이디</label>
    <input id="u" name="username" autocomplete="username" autofocus required>
    <label for="p">비밀번호</label>
    <input id="p" name="password" type="password" autocomplete="current-password" required>
    <button type="submit">로그인</button>
    ${err}
    <p class="foot">업로드한 파일은 이 브라우저 안에서만 처리되며,<br>외부로 전송되지 않습니다.</p>
  </form>
</body></html>`;
}

function htmlResponse(body, status, extraHeaders) {
  return new Response(body, {
    status: status || 200,
    headers: Object.assign({ 'content-type': 'text/html; charset=utf-8' }, extraHeaders || {}),
  });
}

export default async function middleware(request) {
  const url = new URL(request.url);
  const credentialsEnv = process.env.APP_CREDENTIALS || '';
  const secret = process.env.AUTH_SECRET || credentialsEnv || 'fallback-secret';
  const validPairs = new Set(
    credentialsEnv.split(',').map((s) => s.trim()).filter(Boolean)
  );

  // 계정 미설정 → 전부 막고 안내(보안상 통과시키지 않는다)
  if (validPairs.size === 0) {
    return htmlResponse(
      '<meta charset="utf-8"><p style="font-family:sans-serif;padding:40px">' +
      '접속 계정이 아직 설정되지 않았습니다. Vercel 설정에서 APP_CREDENTIALS 환경변수를 등록한 뒤 다시 배포해 주세요.</p>',
      503
    );
  }

  const cookies = parseCookies(request.headers.get('cookie'));

  // 로그아웃
  if (url.pathname === '/__logout') {
    return new Response(null, {
      status: 302,
      headers: {
        'location': '/',
        'set-cookie': 'sr_auth=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax',
      },
    });
  }

  // 로그인 폼 제출
  if (url.pathname === '/__login' && request.method === 'POST') {
    const form = await request.formData();
    const user = (form.get('username') || '').toString().trim();
    const pass = (form.get('password') || '').toString();
    if (validPairs.has(`${user}:${pass}`)) {
      const token = await makeToken(user, secret);
      return new Response(null, {
        status: 302,
        headers: {
          'location': '/',
          'set-cookie': `sr_auth=${encodeURIComponent(token)}; Path=/; Max-Age=${DAY}; HttpOnly; Secure; SameSite=Lax`,
        },
      });
    }
    // 실패
    return htmlResponse(loginPage('아이디 또는 비밀번호가 올바르지 않습니다.'), 401);
  }

  // 이미 로그인돼 있으면 통과
  const auth = await verifyToken(cookies['sr_auth'], secret);
  if (auth) return; // 통과

  // 그 외 모든 요청 → 로그인 화면
  return htmlResponse(loginPage(''), 401);
}
