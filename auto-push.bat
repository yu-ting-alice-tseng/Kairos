@echo off
chcp 65001 > nul
cd /d "%~dp0"
setlocal enabledelayedexpansion
set LOCKWAIT=0
set PULLTICK=0

echo ===================================================
echo [SYNC] Two-way auto-sync is running.
echo Local edits go up, remote changes come down.
echo Please do not close this window.
echo ===================================================

:loop

rem Someone else holds the index right now - you on the command line, or your
rem editor's git integration. Skip the cycle instead of racing them: two git
rem processes writing the index is what leaves index.lock behind and wedges
rem every later git command. Only a lock still sitting there a minute later is
rem treated as stale and removed.
if exist ".git\index.lock" (
    set /a LOCKWAIT+=1
    if !LOCKWAIT! geq 6 (
        echo [%time:~0,8%] index.lock stale for 60s - removing it.
        del /f /q ".git\index.lock"
        set LOCKWAIT=0
    ) else (
        echo [%time:~0,8%] git is busy elsewhere - skipping this cycle.
    )
    goto wait
)
set LOCKWAIT=0

rem Work on whatever branch is checked out. Hardcoding main quietly pushed
rem nothing whenever work was happening on a feature branch.
for /f "delims=" %%b in ('git rev-parse --abbrev-ref HEAD') do set BRANCH=%%b

git add -A
git diff-index --quiet HEAD --
if errorlevel 1 (
    git commit -q -m "Auto-update: File changed"
    echo [%time:~0,8%] committed local changes
)

rem Pull on a slow cadence so remote work arrives on its own, and always right
rem before pushing so the push cannot be rejected as non-fast-forward.
call :count_ahead
set /a PULLTICK+=1
if !PULLTICK! geq 6 set DOPULL=1
if not "!AHEAD!"=="0" set DOPULL=1
if defined DOPULL (
    set PULLTICK=0
    set "DOPULL="
    git pull --rebase --quiet origin !BRANCH!
    if errorlevel 1 goto conflict
    call :count_ahead
)

if not "!AHEAD!"=="0" (
    git push --quiet origin !BRANCH!
    if errorlevel 1 (
        rem Someone pushed between our pull and our push - take theirs, retry once.
        git pull --rebase --quiet origin !BRANCH!
        if errorlevel 1 goto conflict
        git push --quiet origin !BRANCH!
    )
    echo [%time:~0,8%] synced !BRANCH! with GitHub
)

:wait
timeout /t 10 > nul
goto loop

:count_ahead
set AHEAD=0
for /f "delims=" %%c in ('git rev-list --count origin/!BRANCH!..HEAD 2^>nul') do set AHEAD=%%c
exit /b

rem A rebase that cannot be replayed is the one case this script will not guess
rem at. Put the repository back the way it was and stop, so nothing is left
rem half-finished for the next cycle to trip over.
:conflict
git rebase --abort >nul 2>&1
echo.
echo *** CONFLICT: a remote change touches the same lines as yours.
echo *** The repository was put back the way it was - nothing is lost.
echo *** Resolve it by hand, then start this script again.
echo.
pause
exit /b 1
