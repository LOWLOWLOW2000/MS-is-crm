@echo off
REM IS_01: Web + API dev (npm run start:dev) on WSL.
REM Mixes the reliable pattern: child CMD with explicit script path (avoids UNC cwd -> C:\Windows -> npm ENOENT).
REM Safe to pin to Start menu or double-click from \\wsl$\... Explorer.

if /i not "%~1"=="_INNER" (
  cmd /c ""%~f0" _INNER"
  exit /b %ERRORLEVEL%
)

setlocal
REM Edit if your clone path in WSL differs.
set "LINUX_REPO_ROOT=/home/mg_ogawa/DevelopmentRoom/my-dev-room/apps/IS_01"
if defined IS01_LINUX_ROOT set "LINUX_REPO_ROOT=%IS01_LINUX_ROOT%"

set "WSL_DISTRO=Ubuntu"
if defined WSL_DISTRO_NAME set "WSL_DISTRO=%WSL_DISTRO_NAME%"

wsl -d "%WSL_DISTRO%" -e bash -lc "cd '%LINUX_REPO_ROOT%' && npm run start:dev"
exit /b %ERRORLEVEL%
