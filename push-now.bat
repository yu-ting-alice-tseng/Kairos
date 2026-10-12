@echo off
rem Publish: commit and pull via auto-sync.bat, then push main to GitHub.
rem Vercel deploys main to production after every push.
chcp 65001 > nul
setlocal
cd /d "%~dp0"
set "LOG=%~dp0auto-sync.log"
set GIT_TERMINAL_PROMPT=0

echo Committing local changes and pulling origin/main ...
call "%~dp0auto-sync.bat"
if errorlevel 1 (
    echo.
    echo *** Sync failed, nothing was pushed. Last lines of auto-sync.log:
    powershell -NoProfile -Command "Get-Content -LiteralPath $env:LOG -Tail 15"
    echo.
    pause
    exit /b 1
)

echo Pushing main to GitHub ...
git push origin main
if errorlevel 1 (
    echo [%date% %time%] ERROR: push to origin/main failed >> "%LOG%"
    echo.
    echo *** Push failed. Details are above and in auto-sync.log.
) else (
    echo [%date% %time%] Pushed main to origin, Vercel will deploy it >> "%LOG%"
    echo.
    echo Pushed. Vercel will deploy the new version in a few minutes.
)
echo.
pause
