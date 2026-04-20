@echo off
setlocal

rem NOTE: CMD does not support UNC paths as current directory.
rem `pushd` maps a temporary drive letter for UNC locations.
pushd "%~dp0"

where docker >nul 2>&1
if errorlevel 1 (
  echo [ERROR] docker command not found. Install Docker Desktop.
  echo.
  echo Press Enter to close...
  pause >nul
  popd
  exit /b 1
)

docker info >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Docker engine is not responding. Start Docker Desktop first.
  echo.
  echo Press Enter to close...
  pause >nul
  popd
  exit /b 1
)

echo [INFO] Stopping IS_01 (docker compose)...
docker compose down
if errorlevel 1 (
  echo [ERROR] docker compose down failed.
  echo.
  echo Press Enter to close...
  pause >nul
  popd
  exit /b 1
)

echo [OK] Stopped.
echo.
echo Press Enter to close...
pause >nul
popd
exit /b 0
