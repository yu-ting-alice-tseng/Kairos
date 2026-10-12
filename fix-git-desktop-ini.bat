@echo off
rem Manual repair for "bad object refs/desktop.ini" and similar errors caused by
rem OneDrive / Google Drive writing desktop.ini files inside .git.
chcp 65001 > nul
setlocal
cd /d "%~dp0"
set GIT_TERMINAL_PROMPT=0

echo Removing desktop.ini files from .git ...
for /r ".git" %%f in (desktop.ini) do if exist "%%f" (
    echo   %%f
    del /f /q /a "%%f"
)

echo.
echo Checking repository connectivity ...
git fsck --connectivity-only

echo.
echo Pulling origin/main ...
git pull --rebase --autostash origin main
if errorlevel 1 (
    git rebase --abort >nul 2>&1
    echo.
    echo *** Pull failed. The rebase was aborted, local work is intact.
) else (
    echo.
    echo Done.
)
echo.
pause
