@echo off
setlocal EnableDelayedExpansion

rem Docker Compose launcher (Windows). For dev without Docker, use scripts\windows\start-is01-dev.bat + WSL npm.
rem Optional: set IS01_DOCKER_DESKTOP=C:\full\path\Docker Desktop.exe if auto-detect fails.

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
  echo [INFO] Docker engine is not ready. Trying to start Docker Desktop...

  set "DOCKER_DESKTOP_EXE="
  call :resolve_docker_desktop_exe

  rem NOTE: `if defined VAR` treats empty-string as defined. Use explicit emptiness check.
  if not "%DOCKER_DESKTOP_EXE%"=="" (
    echo [INFO] Launching: "%DOCKER_DESKTOP_EXE%"
    start "" "%DOCKER_DESKTOP_EXE%"
  ) else (
    echo [ERROR] Docker Desktop.exe could not be located automatically.
    echo [HINT] Install Docker Desktop, or start it manually, then rerun this script.
    echo [HINT] If Docker Desktop is installed in a non-standard folder, create a shortcut to Docker Desktop.exe and start it once.
    echo.
    echo Press Enter to close...
    pause >nul
    popd
    exit /b 1
  )
)

call :wait_for_docker_engine
if errorlevel 1 (
  echo.
  echo Press Enter to close...
  pause >nul
  popd
  exit /b 1
)

echo [OK] Docker engine is ready.
goto is01_main

:wait_for_docker_engine
docker info >nul 2>&1
if not errorlevel 1 exit /b 0

echo [INFO] Waiting for Docker engine...
set /a __is01_wait=0

:wait_docker
docker info >nul 2>&1
if not errorlevel 1 exit /b 0

set /a __is01_wait+=1
if %__is01_wait% GEQ 90 (
  echo [ERROR] Timed out waiting for Docker engine.
  echo [HINT] Open Docker Desktop and wait until it shows Running, then rerun.
  echo.
  echo Press Enter to close...
  pause >nul
  exit /b 1
)

rem ~2 seconds per iteration (timeout prints a line; hide it)
>nul timeout /t 2 /nobreak
goto wait_docker

goto :eof

:resolve_docker_desktop_exe
rem 0) Overrides (do not clear DOCKER_DESKTOP_EXE before these — user env may set it).
if defined IS01_DOCKER_DESKTOP (
  if exist "%IS01_DOCKER_DESKTOP%" (
    set "DOCKER_DESKTOP_EXE=%IS01_DOCKER_DESKTOP%"
    goto :eof
  )
)
if defined DOCKER_DESKTOP_EXE if exist "%DOCKER_DESKTOP_EXE%" goto :eof
set "DOCKER_DESKTOP_EXE="
rem Try common install locations (Docker Desktop path varies by edition/channel).
if exist "%ProgramFiles%\Docker\Docker\Docker Desktop.exe" set "DOCKER_DESKTOP_EXE=%ProgramFiles%\Docker\Docker\Docker Desktop.exe" & goto :eof
if exist "%ProgramFiles(x86)%\Docker\Docker\Docker Desktop.exe" set "DOCKER_DESKTOP_EXE=%ProgramFiles(x86)%\Docker\Docker\Docker Desktop.exe" & goto :eof
if exist "C:\Program Files\Docker\Docker\Docker Desktop.exe" set "DOCKER_DESKTOP_EXE=C:\Program Files\Docker\Docker\Docker Desktop.exe" & goto :eof
if exist "C:\Program Files (x86)\Docker\Docker\Docker Desktop.exe" set "DOCKER_DESKTOP_EXE=C:\Program Files (x86)\Docker\Docker\Docker Desktop.exe" & goto :eof
if exist "%LocalAppData%\Docker\Docker Desktop.exe" set "DOCKER_DESKTOP_EXE=%LocalAppData%\Docker\Docker Desktop.exe" & goto :eof
if exist "%ProgramW6432%\Docker\Docker\Docker Desktop.exe" set "DOCKER_DESKTOP_EXE=%ProgramW6432%\Docker\Docker\Docker Desktop.exe" & goto :eof
if exist "%LocalAppData%\Programs\Docker\Docker\Docker Desktop.exe" set "DOCKER_DESKTOP_EXE=%LocalAppData%\Programs\Docker\Docker\Docker Desktop.exe" & goto :eof
if exist "%UserProfile%\scoop\apps\docker-desktop\current\Docker Desktop.exe" set "DOCKER_DESKTOP_EXE=%UserProfile%\scoop\apps\docker-desktop\current\Docker Desktop.exe" & goto :eof

rem Fallback: recursive search under Program Files (first match).
for /f "delims=" %%I in ('where /R "%ProgramFiles%" "Docker Desktop.exe" 2^>nul') do (
  set "DOCKER_DESKTOP_EXE=%%I"
  goto :eof
)
rem Last resort: LocalAppData\Programs (per-user installs).
for /f "delims=" %%I in ('where /R "%LocalAppData%\Programs" "Docker Desktop.exe" 2^>nul') do (
  set "DOCKER_DESKTOP_EXE=%%I"
  goto :eof
)
goto :eof

:is01_main
echo [INFO] Starting IS_01 (docker compose)...
docker compose up -d --build
if errorlevel 1 (
  echo [ERROR] docker compose up failed.
  echo.
  echo Press Enter to close...
  pause >nul
  popd
  exit /b 1
)

echo [INFO] docker compose ps:
docker compose ps

echo [INFO] Published port mapping (web, best-effort):
docker compose port web 3000 2>nul

echo [INFO] Waiting until the web container is serving HTTP...
set /a __is01_http_wait=0
:is01_wait_http
docker compose exec -T web node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >nul 2>&1
if not errorlevel 1 goto is01_wait_host_http

set /a __is01_http_wait+=1
if !__is01_http_wait! GEQ 120 (
  echo [ERROR] Web container did not start serving HTTP in time (internal check failed).
  echo [INFO] docker compose ps:
  docker compose ps
  echo [INFO] web logs (tail):
  docker compose logs --tail=200 web
  echo.
  echo Press Enter to close...
  pause >nul
  popd
  exit /b 1
)

>nul timeout /t 1 /nobreak
goto is01_wait_http

:is01_wait_host_http
echo [OK] Web container internal HTTP check passed.

echo [INFO] Verifying host port mapping (Windows -^> container) ...
set /a __is01_host_wait=0
:is01_wait_host_http_loop
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:3000/' -TimeoutSec 2; if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if not errorlevel 1 goto is01_http_ready

set /a __is01_host_wait+=1
if !__is01_host_wait! GEQ 60 (
  echo [ERROR] Container is up, but Windows cannot reach http://127.0.0.1:3000/ (port publish/proxy/firewall suspected).
  echo [INFO] Published ports (compose):
  docker compose port web 3000
  echo [INFO] docker compose ps:
  docker compose ps
  echo [INFO] web logs (tail):
  docker compose logs --tail=200 web
  echo.
  echo Press Enter to close...
  pause >nul
  popd
  exit /b 1
)

>nul timeout /t 1 /nobreak
goto is01_wait_host_http_loop

:is01_http_ready
echo [OK] Host HTTP check passed (Windows can reach http://127.0.0.1:3000/).

start "" "http://127.0.0.1:3000/"
echo [OK] Started. Web: http://127.0.0.1:3000/
echo.
echo Press Enter to close...
pause >nul
popd
exit /b 0
