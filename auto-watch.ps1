# Watches the Kairos folder and runs auto-sync.bat (commit + pull, never push).
#   - 60 seconds after the last change (each new change restarts the timer)
#   - every 30 minutes regardless, to bring down new remote commits
#   - once at startup
# Only one instance runs at a time (named mutex). Started hidden by
# auto-watch-hidden.vbs from the "Kairos Auto Sync" scheduled task.

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$syncBat = Join-Path $root 'auto-sync.bat'
$logFile = Join-Path $root 'auto-sync.log'
$debounceSeconds = 60
$forceSyncMinutes = 30
$maxLogBytes = 1MB

$ignoredDirs = @('.git', 'node_modules', '.next')
$ignoredNames = @('auto-sync.log', 'desktop.ini')
$ignoredPatterns = @('~$*', '*.tmp', '*.swp', '*.crdownload')

function Write-Log([string]$message) {
    $line = '[{0}] watcher: {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $message
    try { [IO.File]::AppendAllText($logFile, $line + "`r`n") } catch { }
}

# Keep the log from growing forever: once it passes 1 MB keep the last 2000 lines.
function Limit-Log {
    try {
        if ((Test-Path -LiteralPath $logFile) -and (Get-Item -LiteralPath $logFile).Length -gt $maxLogBytes) {
            $tail = Get-Content -LiteralPath $logFile -Tail 2000
            [IO.File]::WriteAllLines($logFile, [string[]]$tail)
        }
    } catch { }
}

function Test-Ignored([string]$fullPath) {
    if ([string]::IsNullOrEmpty($fullPath)) { return $true }
    $rel = $fullPath
    if ($rel.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) {
        $rel = $rel.Substring($root.Length)
    }
    $parts = @($rel -split '[\\/]' | Where-Object { $_ -ne '' })
    if ($parts.Count -eq 0) { return $true }
    foreach ($part in $parts) {
        if ($ignoredDirs -contains $part) { return $true }
    }
    $name = $parts[-1]
    if ($ignoredNames -contains $name) { return $true }
    foreach ($pattern in $ignoredPatterns) {
        if ($name -like $pattern) { return $true }
    }
    return $false
}

function Invoke-Sync([string]$reason) {
    Write-Log "running auto-sync.bat ($reason)"
    try {
        # The doubled quotes survive cmd's quote stripping even when the path
        # has spaces or parentheses (for example "OneDrive - Personal").
        $proc = Start-Process -FilePath $env:ComSpec `
            -ArgumentList ('/c ""' + $syncBat + '""') `
            -WorkingDirectory $root -WindowStyle Hidden -PassThru -Wait
        if ($proc.ExitCode -ne 0) {
            Write-Log "auto-sync.bat exited with code $($proc.ExitCode)"
        }
    } catch {
        Write-Log "could not start auto-sync.bat: $($_.Exception.Message)"
    }
    $script:lastSync = Get-Date
    Limit-Log
}

$mutex = New-Object System.Threading.Mutex($false, 'Local\KairosAutoWatch')
$acquired = $false
try {
    $acquired = $mutex.WaitOne(0)
} catch [System.Threading.AbandonedMutexException] {
    # The previous instance died without releasing it; it is ours now.
    $acquired = $true
}
if (-not $acquired) { exit 0 }

$watcher = $null
try {
    Limit-Log
    Write-Log "started, watching $root"

    $watcher = New-Object System.IO.FileSystemWatcher $root
    $watcher.IncludeSubdirectories = $true
    $watcher.InternalBufferSize = 65536
    $watcher.NotifyFilter = [IO.NotifyFilters]'FileName, DirectoryName, LastWrite, Size'
    foreach ($name in 'Changed', 'Created', 'Deleted', 'Renamed', 'Error') {
        Register-ObjectEvent -InputObject $watcher -EventName $name -SourceIdentifier "KairosWatch.$name" | Out-Null
    }
    $watcher.EnableRaisingEvents = $true

    $lastChange = $null
    $script:lastSync = [datetime]::MinValue
    Invoke-Sync 'startup'

    while ($true) {
        Wait-Event -Timeout 5 | Out-Null
        foreach ($evt in @(Get-Event)) {
            if ($evt.SourceIdentifier -eq 'KairosWatch.Error') {
                # Buffer overflow: some events were lost, so assume something changed.
                $lastChange = Get-Date
            } elseif ($evt.SourceIdentifier -like 'KairosWatch.*') {
                $ea = $evt.SourceEventArgs
                $paths = @($ea.FullPath)
                if ($ea -is [IO.RenamedEventArgs]) { $paths += $ea.OldFullPath }
                foreach ($p in $paths) {
                    if (-not (Test-Ignored $p)) { $lastChange = Get-Date; break }
                }
            }
            Remove-Event -EventIdentifier $evt.EventIdentifier
        }

        $now = Get-Date
        if ($lastChange -and ($now - $lastChange).TotalSeconds -ge $debounceSeconds) {
            $lastChange = $null
            Invoke-Sync 'local changes'
        } elseif (($now - $script:lastSync).TotalMinutes -ge $forceSyncMinutes) {
            Invoke-Sync 'periodic'
        }
    }
} catch {
    Write-Log "stopped by error: $($_.Exception.Message)"
} finally {
    if ($watcher) { $watcher.EnableRaisingEvents = $false; $watcher.Dispose() }
    Get-EventSubscriber | Where-Object { $_.SourceIdentifier -like 'KairosWatch.*' } | Unregister-Event
    $mutex.ReleaseMutex()
    $mutex.Dispose()
}
