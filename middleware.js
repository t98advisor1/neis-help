/**
 * 접속 인증 미들웨어 (Vercel Edge Middleware)
 *
 * 이 파일은 정적 파일(public/)이 브라우저에 도착하기 '전에' 실행된다.
 * Authorization 헤더에 담긴 아이디:비밀번호가 허용 목록에 있을 때만 통과시키고,
 * 없거나 틀리면 브라우저 표준 로그인 창(Basic Auth)을 띄운다.
 *
 * 계정 목록은 코드에 직접 적지 않고 Vercel 환경변수 APP_CREDENTIALS 에서 읽는다.
 * 형식: "아이디1:비밀번호1,아이디2:비밀번호2,..."
 * (Vercel 대시보드 → 프로젝트 → Settings → Environment Variables 에서 등록/교체)
 *
 * 개별 계정 하나만 정지시키고 싶으면, 이 목록에서 그 한 줄만 지우고 다시 배포하면 된다.
 */

export const config = {
  // api 경로 없이 전부 정적 파일이므로 모든 경로에 적용한다.
  matcher: '/:path*',
};

export default function middleware(request) {
  const credentialsEnv = process.env.APP_CREDENTIALS || '';
  const validPairs = new Set(
    credentialsEnv.split(',').map((s) => s.trim()).filter(Boolean)
  );

  // 환경변수를 아직 안 넣고 배포했을 때 "무조건 통과"가 되면 보안 구멍이므로,
  // 목록이 비어 있으면 전부 막고 이유를 알 수 있는 메시지를 보여준다.
  if (validPairs.size === 0) {
    return new Response(
      '접속 계정이 아직 설정되지 않았습니다.\n' +
      'Vercel 프로젝트 설정에서 APP_CREDENTIALS 환경변수를 등록한 뒤 다시 배포해 주세요.',
      { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } }
    );
  }

  const authHeader = request.headers.get('authorization') || '';
  const [scheme, encoded] = authHeader.split(' ');

  if (scheme === 'Basic' && encoded) {
    let decoded = '';
    try {
      decoded = atob(encoded);
    } catch (e) {
      decoded = '';
    }
    if (validPairs.has(decoded)) {
      return; // 통과 — 원래 요청대로 정적 파일을 내려준다.
    }
  }

  return new Response('아이디와 비밀번호를 입력해 주세요.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="생기부 금지어 탐색기", charset="UTF-8"',
      'content-type': 'text/plain; charset=utf-8',
    },
  });
}
