Option Explicit
' PD-SAAS-FORK: Zero-window launcher entry (double-click or desktop shortcut)
Dim shell, fso, repo, launcherDir, script, nodeExe, cmd

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

repo = fso.GetParentFolderName(WScript.ScriptFullName)
launcherDir = repo & "\tools\nova-launcher"
script = launcherDir & "\scripts\start-hidden.mjs"

nodeExe = ResolveNodeExe(fso, shell)
If Not fso.FileExists(nodeExe) And nodeExe = "node.exe" Then
  MsgBox "Node.js not found. Install Node.js 20+ from https://nodejs.org/", vbCritical, "Nova Dev Console"
  WScript.Quit 1
End If

If Not fso.FileExists(script) Then
  MsgBox "Missing launcher script: " & script, vbCritical, "Nova Dev Console"
  WScript.Quit 1
End If

shell.Environment("Process")("NOVA_REPO_ROOT") = repo
shell.CurrentDirectory = launcherDir
cmd = """" & nodeExe & """ """ & script & """"
shell.Run cmd, 0, False

Function ResolveNodeExe(fso, shell)
  Dim candidates, i, p
  candidates = Array( _
    shell.ExpandEnvironmentStrings("%ProgramFiles%\nodejs\node.exe"), _
    shell.ExpandEnvironmentStrings("%ProgramFiles(x86)%\nodejs\node.exe"), _
    shell.ExpandEnvironmentStrings("%LocalAppData%\Programs\nodejs\node.exe") _
  )
  For i = 0 To UBound(candidates)
    p = candidates(i)
    If fso.FileExists(p) Then
      ResolveNodeExe = p
      Exit Function
    End If
  Next
  ResolveNodeExe = "node.exe"
End Function
