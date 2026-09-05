# NEIS Helper — 생기부 금지어 탐색기 (학교 배포판)

학교생활기록부(엑셀/PDF)를 올리면 기재요령 위반 표현을 자동으로 찾아주는 웹앱입니다.
업로드한 파일은 **서버로 전송되지 않고 브라우저 안에서만 처리**됩니다.

## 접속 제한
`middleware.js`가 모든 요청 앞단에서 아이디/비밀번호를 확인합니다.
계정 목록은 코드가 아니라 Vercel 환경변수 `APP_CREDENTIALS`에 넣습니다.

형식: `아이디1:비밀번호1,아이디2:비밀번호2,...`

### 계정 추가/삭제/변경
Vercel 대시보드 → 프로젝트 → Settings → Environment Variables →
`APP_CREDENTIALS` 값을 고친 뒤 Redeploy 하면 됩니다. (코드 수정 불필요)

## 구성
- `index.html`, `styles.css`, `app.js`, `rules.js` — 웹앱 본체
- `middleware.js` — 로그인 게이트 (Vercel Edge Middleware)
- `vercel.json` — 정적 서빙 설정
- 엑셀/PDF 라이브러리는 cdnjs에서 로드 (SheetJS 0.18.5, pdf.js 3.11.174)


