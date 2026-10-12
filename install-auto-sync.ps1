# Registers the "Kairos Auto Sync" scheduled task, which starts the hidden
# folder watcher (auto-watch-hidden.vbs -> auto-watch.ps1) at logon and
# re-launches it every 30 minutes as a safety net. A second copy exits at
# once because of the watcher's mutex, so the repeat never doubles it up.

$ErrorActionPreference = 'Stop'
$taskName = 'Kairos Auto Sync'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$vbs = Join-Path $root 'auto-watch-hidden.vbs'
$user = "$env:USERDOMAIN\$env:USERNAME"

try {
    if (-not (Test-Path -LiteralPath $vbs)) { throw "Missing file: $vbs" }

    $action = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument "//B `"$vbs`"" -WorkingDirectory $root
    $atLogon = New-ScheduledTaskTrigger -AtLogOn -User $user
    $every30 = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 30)
    $settings = New-ScheduledTaskSettingsSet `
        -AllowStartIfOnBatteries `
        -DontStopIfGoingOnBatteries `
        -StartWhenAvailable `
        -MultipleInstances IgnoreNew `
        -ExecutionTimeLimit ([TimeSpan]::Zero)
    $principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited

    Register-ScheduledTask -TaskName $taskName `
        -Action $action `
        -Trigger @($atLogon, $every30) `
        -Settings $settings `
        -Principal $principal `
        -Description 'Kairos: commit local edits and pull from GitHub automatically (never pushes).' `
        -Force | Out-Null

    Start-ScheduledTask -TaskName $taskName

    Write-Host ''
    Write-Host "OK: scheduled task '$taskName' is installed and running." -ForegroundColor Green
    Write-Host '  - Local edits are committed 60 seconds after you stop editing.'
    Write-Host '  - New commits from GitHub are pulled every 30 minutes.'
    Write-Host '  - Nothing is pushed automatically. Run push-now.bat to publish.'
    Write-Host "  - Log: $(Join-Path $root 'auto-sync.log')"
    Write-Host ''
} catch {
    Write-Host ''
    Write-Host "ERROR: could not install '$taskName'." -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ''
    Write-Host 'Right-click install-auto-sync.bat, choose "Run as administrator", and try again.' -ForegroundColor Yellow
    Write-Host ''
    exit 1
}
