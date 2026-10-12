# Removes the "Kairos Auto Sync" scheduled task and stops the running watcher.

$taskName = 'Kairos Auto Sync'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$watchScript = Join-Path $root 'auto-watch.ps1'

if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
    try {
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction Stop
        Write-Host "Removed scheduled task '$taskName'." -ForegroundColor Green
    } catch {
        Write-Host "ERROR: could not remove '$taskName': $($_.Exception.Message)" -ForegroundColor Red
        Write-Host 'Right-click uninstall-auto-sync.bat, choose "Run as administrator", and try again.' -ForegroundColor Yellow
    }
} else {
    Write-Host "Scheduled task '$taskName' was not installed."
}

# Match this folder's auto-watch.ps1 by full path, so watchers that other
# projects run from their own auto-watch.ps1 are left alone.
$stopped = 0
Get-CimInstance Win32_Process | Where-Object {
    $_.ProcessId -ne $PID -and $_.CommandLine -and
    $_.CommandLine.IndexOf($watchScript, [StringComparison]::OrdinalIgnoreCase) -ge 0
} | ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    $stopped++
}
Write-Host "Stopped $stopped running watcher process(es)."
