' Starts auto-watch.ps1 with no visible window. Run by the "Kairos Auto Sync"
' scheduled task through: wscript.exe //B "auto-watch-hidden.vbs"
Option Explicit
Dim fso, shell, dir, cmd
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = dir
cmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & dir & "\auto-watch.ps1"""
shell.Run cmd, 0, False
