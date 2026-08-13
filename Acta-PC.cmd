@echo off
title Acta de Partido
echo.
echo   ACTA DE PARTIDO
echo   ---------------
echo   Abriendo la aplicacion en el navegador...
echo   Deja esta ventana abierta mientras la uses. Cierrala para salir.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0servidor.ps1"
if errorlevel 1 (
  echo.
  echo   No se ha podido arrancar el servidor local.
  echo   Alternativa: abre la carpeta www y haz doble clic en index.html
  echo   ^(el dictado por voz puede quedar bloqueado en ese modo^).
  pause
)
