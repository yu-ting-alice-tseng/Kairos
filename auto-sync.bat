@echo off
rem One sync pass for Kairos: commit local edits, then pull new remote commits.
rem This script never pushes. Pushing to main deploys to production on Vercel,
rem so publishing is a deliberate step: double-click push-now.bat.
chcp 65001 > nul
setlocal
cd /d "%~dp0"
set "LOG=%~dp0auto-sync.log"
set GIT_TERMINAL_PROMPT=0

call :log "----- sync start -----"

rem OneDrive / Google Drive drop desktop.ini into every folder, including the
rem ones inside .git, where git reads it as a broken ref and fails with
rem "bad object refs/desktop.ini". .gitignore cannot help there.
for /r ".git" %%f in (desktop.ini) do if exist "%%f" del /f /q /a "%%f"

rem Background gc could run while the cloud client is syncing pack files.
git config gc.auto 0

for /f "delims=" %%b in ('git rev-parse --abbrev-ref HEAD') do set "BRANCH=%%b"
if /i not "%BRANCH%"=="main" (
    call :log "On branch %BRANCH%, switching to main"
    git checkout main >> "%LOG%" 2>&1
    if errorlevel 1 (
        call :log "ERROR: could not check out main. Sync aborted."
        exit /b 1
    )
)

git add -A >> "%LOG%" 2>&1
git diff --cached --quiet
if errorlevel 1 (
    git commit -q -m "Auto-update: %date% %time%" >> "%LOG%" 2>&1
    if errorlevel 1 (
        call :log "ERROR: commit failed. Sync aborted."
        exit /b 1
    )
    call :log "Committed local changes"
) else (
    call :log "No local changes to commit"
)

rem A rebase that cannot be replayed is never guessed at: put everything back
rem the way it was and stop, so nothing half-finished is left behind.
git pull --rebase --autostash origin main >> "%LOG%" 2>&1
if errorlevel 1 (
    git rebase --abort >> "%LOG%" 2>&1
    call :log "ERROR: pull --rebase failed (conflict or network). Rebase aborted, local work is intact."
    exit /b 1
)
call :log "Pulled origin/main"

set AHEAD=0
for /f "delims=" %%c in ('git rev-list --count origin/main..HEAD 2^>nul') do set "AHEAD=%%c"
if not "%AHEAD%"=="0" call :log "%AHEAD% local commit(s) not pushed yet. Run push-now.bat to publish."

call :log "----- sync done -----"
exit /b 0

:log
echo [%date% %time%] %~1 >> "%LOG%"
exit /b 0
