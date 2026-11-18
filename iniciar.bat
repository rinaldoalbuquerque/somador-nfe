@echo off
chcp 65001 > nul
title Somador de Notas - NF-e e DANFE
echo ========================================================
echo   SOMADOR DE NOTAS - Sistema de Importacao e Conferencia
echo ========================================================
echo.
echo Iniciando servidor web local seguro...
echo Abrindo navegador em http://localhost:8080/
echo.

start "" "http://localhost:8080/"
powershell -ExecutionPolicy Bypass -File "%~dp0server.ps1"

pause
