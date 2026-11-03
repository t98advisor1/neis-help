@echo off
setlocal
chcp 65001 > nul
title 생기부 올인원 도우미 - 데스크톱

pushd "%~dp0"

echo [1/3] 로컬 서버 확인 중...
powershell -NoProfile -Command "try { Invoke-WebRequest -Uri 'http://localhost:3000/preview.html' -TimeoutSec 1 -UseBasicParsing | Out-Null; exit 0 } catch { exit 1 }" > nul 2>&1
if %errorlevel% neq 0 (
    echo       로컬 서버를 시작합니다...
    start /min "SangibuServer" node server.mjs
    timeout /t 2 /nobreak > nul
)

:: AI 로그인 상태를 유지하기 위한 전용 프로필 (보안 기능은 그대로 유지)
set "PROFILE_DIR=%LOCALAPPDATA%\SangibuOfficeProfile2"
if not exist "%PROFILE_DIR%" mkdir "%PROFILE_DIR%"
echo [2/3] 로그인 유지용 프로필 준비 완료.

set "EDGE="
if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" set "EDGE=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if exist "C:\Program Files\Microsoft\Edge\Application\msedge.exe" set "EDGE=C:\Program Files\Microsoft\Edge\Application\msedge.exe"

echo [3/3] 앱 창을 엽니다...
if defined EDGE (
    start "" "%EDGE%" --app="http://localhost:3000/preview.html" --user-data-dir="%PROFILE_DIR%" --window-position=0,0 --window-size=1000,900
) else (
    start http://localhost:3000/preview.html
)

popd
timeout /t 2 /nobreak > nul
exit
