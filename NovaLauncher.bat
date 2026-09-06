@echo off
REM PD-SAAS-FORK: 转发到无窗口 VBS；双击 .bat 仍可能闪一下 CMD，请优先双击 NovaLauncher.vbs
if /i "%~1"=="--debug" goto :debug
wscript.exe //Nologo //B "%~dp0NovaLauncher.vbs"
exit /b 0

:debug
cd /d "%~dp0"
set "NOVA_REPO_ROOT=%~dp0"
if "%NOVA_REPO_ROOT:~-1%"=="\" set "NOVA_REPO_ROOT=%NOVA_REPO_ROOT:~0,-1%"
where node >nul 2>&1
if errorlevel 1 (
  echo [Nova Dev Console] 未找到 node，请先安装 Node.js 20+
  pause
  exit /b 1
)
node "tools\nova-launcher\scripts\start-hidden.mjs"
if errorlevel 1 pause
exit /b %ERRORLEVEL%
