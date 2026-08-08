@echo off
chcp 65001 > nul
cd /d "%~dp0"
setlocal enabledelayedexpansion
set LOCKWAIT=0
echo ===================================================
echo [MONITORING] Auto-upload radar is active...
echo Please do not close this window!
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
        echo [%date% %time%] index.lock stale for 60s - removing it.
        del /f /q ".git\index.lock"
        set LOCKWAIT=0
    ) else (
        echo [%date% %time%] git is busy elsewhere - skipping this cycle.
    )
    goto wait
)
set LOCKWAIT=0

git add -A

rem Nothing changed - nothing to do.
git diff-index --quiet HEAD --
if not errorlevel 1 goto wait

git commit -m "Auto-update: File changed"
if errorlevel 1 goto wait

rem Push the branch that is actually checked out. Hardcoding main quietly
rem pushed nothing whenever work was happening on a feature branch.
for /f "delims=" %%b in ('git rev-parse --abbrev-ref HEAD') do set BRANCH=%%b
git push origin !BRANCH!
if errorlevel 1 (
    echo [%date% %time%] Push failed - will retry next cycle.
) else (
    echo [%date% %time%] Changes detected! Synced !BRANCH! to GitHub.
)

:wait
timeout /t 10 > nul
goto loop
