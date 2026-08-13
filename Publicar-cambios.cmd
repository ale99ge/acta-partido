@echo off
chcp 65001 >nul
title Publicar cambios en GitHub
cd /d "%~dp0"

echo.
echo   PUBLICAR CAMBIOS EN GITHUB
echo   --------------------------
echo.

git rev-parse --git-dir >nul 2>&1
if errorlevel 1 (
  echo   Aqui no hay repositorio de Git.
  echo.
  pause
  exit /b 1
)

echo   Cambios pendientes:
git status --short
echo.

for /f %%i in ('git status --porcelain 2^>nul ^| find /c /v ""') do set PEND=%%i
if not "%PEND%"=="0" (
  set /p MSG=  Mensaje del commit [cambios locales]:
  if "%MSG%"=="" set MSG=chore: cambios locales
  git add -A
  git commit -m "%MSG%"
  echo.
)

echo   Subiendo a GitHub...
echo.
git push

if errorlevel 1 (
  echo.
  echo   El push ha fallado. Revisa el mensaje de arriba.
) else (
  echo.
  echo   LISTO. Los workflows arrancan en unos segundos:
  echo   https://github.com/ale99ge/acta-partido/actions
  echo.
  echo   Cuando terminen:
  echo    - App web:  https://ale99ge.github.io/acta-partido/
  echo    - APK:      artefacto acta-partido-apk en la ejecucion de Actions
)

echo.
pause
