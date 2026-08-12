@echo off
chcp 65001 > nul
echo [1/2] Copying updated files to server...
set SERVER_SSH=root@10.100.8.130
scp backend\src\routes\jiraSettings.js %SERVER_SSH%:/appserver/amani/JiraDashboard/backend/src/routes/jiraSettings.js
scp backend\src\services\cacheService.js %SERVER_SSH%:/appserver/amani/JiraDashboard/backend/src/services/cacheService.js
scp frontend\src\services\api.js %SERVER_SSH%:/appserver/amani/JiraDashboard/frontend/src/services/api.js
for %%f in (frontend\dist\assets\*.js frontend\dist\assets\*.css frontend\dist\index.html) do scp %%f %SERVER_SSH%:/appserver/amani/JiraDashboard/%%f
echo [2/2] Restarting backend container...
ssh %SERVER_SSH% "cd /appserver/amani/JiraDashboard && (docker compose restart backend 2>/dev/null || docker-compose restart backend)"
echo Done! & pause
