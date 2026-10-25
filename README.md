# NEIS Helper — 생기부 금지어 탐색기 (학교 배포판)

학교생활기록부(엑셀/PDF)를 올리면 기재요령 위반 표현을 자동으로 찾아주는 웹앱입니다.
업로드한 파일은 **서버로 전송되지 않고 브라우저 안에서만 처리**됩니다.

## 접속 제한 (구글 계정 로그인)
`middleware.js`가 모든 요청 앞단에서 구글 로그인 여부를 확인합니다. 아이디/비밀번호 방식은 없앴습니다.
허용 계정은 코드가 아니라 Vercel 환경변수에 넣습니다.

| 환경변수 | 내용 |
|---|---|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Cloud Console → API 및 서비스 → 사용자 인증 정보 → OAuth 클라이언트 ID(웹 애플리케이션) |
| `AUTH_SECRET` | 쿠키 위조 방지용 임의의 긴 문자열 |
| `ALLOWED_EMAILS` | 들어올 수 있는 이메일, 쉼표 구분 (예: `a@school.hs.kr,b@gmail.com`) |
| `ALLOWED_DOMAINS` | 들어올 수 있는 이메일 도메인, 쉼표 구분 (예: `school.hs.kr`) |
| `GOOGLE_REDIRECT_URI` | (선택) 기본값은 `접속주소/__callback` |

`ALLOWED_EMAILS`와 `ALLOWED_DOMAINS` 중 하나는 반드시 있어야 하며, 둘 다 없으면 아무도 들어오지 못합니다.
OAuth 클라이언트의 **승인된 리디렉션 URI**에 `https://배포주소/__callback`을 등록하세요.
환경변수를 고친 뒤에는 Redeploy 해야 반영됩니다.

## 구성
- `index.html`, `styles.css`, `app.js`, `rules.js` — 웹앱 본체(검사 화면·검사 규칙)
- `onepage.css`, `onepage.js` — 한 페이지 구성: 소개 → 메뉴 선택 → 내용 화면이 한 화면씩 걸리며 넘어가는 스크롤(css scroll-snap + 휠 보강)
- `usage-section.css/js` — 사용법·검사 규칙 메뉴, `guide.html` — 기재요령 검색 메뉴(메인 안에 삽입됨; `usage.html`·`prompts.html`은 메인의 해당 메뉴로 연결만 한다)
- `middleware.js` — 로그인 게이트 (Vercel Edge Middleware)
- `vercel.json` — 정적 서빙 설정
- 엑셀/PDF 라이브러리는 cdnjs에서 로드 (SheetJS 0.18.5, pdf.js 3.11.174)


