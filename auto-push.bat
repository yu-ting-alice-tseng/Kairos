@echo off
chcp 65001 > nul
cd /d "%~dp0"
echo ===================================================
echo [MONITORING] Auto-upload radar is active...
echo Please do not close this window!
echo ===================================================

:loop
git add .
:: Check if there are any changes to commit
git diff-index --quiet HEAD --
if %errorlevel% neq 0 (
    git commit -m "Auto-update: File changed"
    git push origin main
    echo [%date% %time%] Changes detected! Successfully synced to GitHub.
)

:: Checks for updates in the background every 10 seconds
timeout /t 10 > nul
goto loop
