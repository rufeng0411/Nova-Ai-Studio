@echo off
REM PD-SAAS-FORK: 无 CMD 链 — 优先 NovaLauncher.vbs；此处转发到仓库根 VBS
set "REPO_ROOT=%~dp0..\..\.."
wscript.exe //Nologo //B "%REPO_ROOT%NovaLauncher.vbs"
exit /b 0
