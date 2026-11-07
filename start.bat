@echo off
title Discord Anime Music & Server Manager Bot
echo ========================================================
echo   Dang cai dat thu vien va khoi dong Discord Bot...
echo   Web Dashboard: http://localhost:3000
echo ========================================================
call npm install --legacy-peer-deps
call npx tsx server.ts
pause
