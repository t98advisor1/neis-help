@echo off
setlocal
cd /d "%~dp0"

git config --global --add safe.directory "%CD:\=/%" >nul 2>&1
git remote set-url origin https://github.com/t98advisor1/neis-help.git >nul 2>&1

echo ========================================================
echo   [GitHub Deploy] neis-help -^> Vercel
echo ========================================================
echo.
echo   Uploading to https://github.com/t98advisor1/neis-help.git ...
echo.

git push -u origin main
if errorlevel 1 goto FAIL

echo.
echo ========================================================
echo   [SUCCESS] Upload complete!
echo   Vercel automatic deployment will finish in 1-2 minutes.
echo   Check: https://neis-help-one.vercel.app/
echo ========================================================
echo.
pause
exit /b 0

:FAIL
echo.
echo ========================================================
echo   [ERROR] Push failed.
echo   Please check the error message above.
echo ========================================================
echo.
pause
exit /b 1
