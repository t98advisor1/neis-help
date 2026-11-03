@echo off
chcp 65001 > nul
title 깃허브(neis-solution) 및 버셀 자동 배포 도구
echo ========================================================
echo   [학생부 올인원 도우미] GitHub 푸시 및 Vercel 배포
echo ========================================================
echo.
cd /d "%~dp0"

git add -A
git commit -m "Complete 2026 NEIS all-in-one solution (draft maker + file checker)" 2>nul

echo [안내] GitHub(https://github.com/t98advisor1/neis-solution.git)로 업로드를 시작합니다.
echo 로그인 창이 뜨면 GitHub 계정으로 로그인해 주세요...
echo.
git push -u origin main --force

if %errorlevel% equ 0 (
    echo.
    echo ========================================================
    echo ✅ 깃허브 업로드 성공! 연결된 Vercel에서 자동 배포가 시작됩니다.
    echo ========================================================
) else (
    echo.
    echo ⚠️ 자동 푸시에 실패했습니다. GitHub 로그인 권한을 확인해 주세요.
)
echo.
pause
