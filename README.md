# NEIS Helper — 생기부 금지어 탐색기 (학교 배포판)

학교생활기록부(엑셀/PDF)를 올리면 기재요령 위반 표현을 자동으로 찾아주는 웹앱입니다.
업로드한 파일은 **서버로 전송되지 않고 브라우저 안에서만 처리**됩니다.

## 접속
로그인 없이 누구나 열 수 있습니다. 업로드한 파일은 서버로 전송되지 않고 브라우저 안에서만 처리됩니다.
접속 제한(아이디/비밀번호 → 구글 계정 로그인)을 두었던 `middleware.js`는 제거했습니다.
다시 필요하면 git 기록(`claude/zen-heisenberg-gi7spu` 브랜치의 이전 커밋)에서 되살릴 수 있습니다.
이때 구글 로그인에는 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_SECRET`, `ALLOWED_EMAILS`/`ALLOWED_DOMAINS` 환경변수가 필요합니다.

## 구성
- `index.html`, `styles.css`, `app.js`, `rules.js` — 웹앱 본체(검사 화면·검사 규칙)
- `onepage.css`, `onepage.js` — 한 페이지 구성: 소개 → 메뉴 선택 → 내용 화면이 한 화면씩 걸리며 넘어가는 스크롤(css scroll-snap + 휠 보강)
- `usage-section.css/js` — 사용법·검사 규칙 메뉴, `guide.html` — 기재요령 검색 메뉴(메인 안에 삽입됨; `usage.html`·`prompts.html`은 메인의 해당 메뉴로 연결만 한다)
- `api/visit.js` — 방문자 수 카운터 (Upstash Redis, 환경변수 `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`)
- `vercel.json` — 정적 서빙 설정
- 엑셀/PDF 라이브러리는 cdnjs에서 로드 (SheetJS 0.18.5, pdf.js 3.11.174)


