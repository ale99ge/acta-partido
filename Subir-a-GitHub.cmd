@echo off
chcp 65001 >nul
title Subir Acta de Partido a GitHub
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0subir-a-github.ps1"
if errorlevel 1 (
  echo.
  echo   El script ha terminado con errores. Copia el mensaje de arriba.
)
echo.
pause
