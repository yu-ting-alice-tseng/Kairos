param([string]$msg = "auto: $(Get-Date -Format 'yyyy-MM-dd HH:mm')")
git add -A
git commit -m $msg
git push
