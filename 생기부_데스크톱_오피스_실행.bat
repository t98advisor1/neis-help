@echo off
setlocal
chcp 65001 > nul

echo ======================================================================
echo    Sangibu All-in-One Desktop Office (Ieum Style Dual-Pane Workspace)
echo    생기부 올인원 도우미 데스크톱 오피스
echo ======================================================================
echo.

pushd "%~dp0"

:: 1. Check & start local server if needed
echo [1/3] 로컬 서버 확인 중...
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:3000/preview.html' -TimeoutSec 1 -UseBasicParsing; exit 0 } catch { exit 1 }" > nul 2>&1
if %errorlevel% neq 0 (
    echo       로컬 생기부 엔진을 시작합니다...
    start /min "SangibuServer" node server.mjs
    timeout /t 2 /nobreak > nul
) else (
    echo       로컬 생기부 엔진이 이미 정상 동작 중입니다.
)

:: 2. Setup isolated user profile for permanent AI subscription sessions
set "PROFILE_DIR=%LOCALAPPDATA%\SangibuOfficeProfile"
if not exist "%PROFILE_DIR%" mkdir "%PROFILE_DIR%"
echo [2/3] AI 구독 로그인 세션 저장소 준비 완료.

:: 3. Launch standalone desktop app window via Microsoft Edge
echo [3/3] 생기부 데스크톱 앱 창을 실행합니다...
set "EDGE="
if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" set "EDGE=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if exist "C:\Program Files\Microsoft\Edge\Application\msedge.exe" set "EDGE=C:\Program Files\Microsoft\Edge\Application\msedge.exe"
if exist "%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe" set "EDGE=%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe"

if defined EDGE (
    start "" "%EDGE%" --app="http://localhost:3000/desktop.html" --user-data-dir="%PROFILE_DIR%" --disable-web-security --disable-features=IsolateOrigins,site-per-process --window-size=1560,940
) else (
    start http://localhost:3000/desktop.html
)

popd
timeout /t 2 /nobreak > nul
exit
