@echo off
chcp 65001 > nul
title GitHub 업로드 및 Vercel 배포
echo ========================================================
echo   [학생부 올인원 도우미] GitHub 업로드 및 Vercel 배포
echo ========================================================
echo.
cd /d "%~dp0"

:: 폴더 소유자가 관리자 계정이라 git이 거부하는 문제 방지
git config --global --add safe.directory "%CD:\=/%" 2>nul

git add -A
git commit -m "Update 생기부 올인원 도우미" 2>nul

echo [안내] https://github.com/t98advisor1/neis-solution.git 로 업로드합니다.
echo        로그인 창이 뜨면 GitHub 계정으로 로그인해 주세요...
echo.
git push -u origin main

if %errorlevel% equ 0 (
    echo.
    echo ========================================================
    echo   업로드 성공! Vercel에서 1~2분 안에 자동 배포됩니다.
    echo   확인: https://neis-help-one.vercel.app/
    echo ========================================================
) else (
    echo.
    echo [실패] 업로드하지 못했습니다. 위의 영어 메시지를 복사해서 알려 주세요.
    echo        rejected 라는 말이 있으면 GitHub 쪽에 다른 변경이 있다는 뜻입니다.
    echo        이 경우 덮어쓰기 전에 꼭 확인이 필요합니다.
)
echo.
pause
