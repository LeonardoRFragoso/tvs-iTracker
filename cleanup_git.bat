@echo off
echo Cleaning up Git repository from wrong directory...

REM Remove the .git directory from migrations folder
if exist "backend\migrations\.git" (
    echo Removing .git from backend\migrations\...
    rmdir /s /q "backend\migrations\.git"
    echo Done!
) else (
    echo No .git directory found in backend\migrations\
)

REM Remove the README.md that was created in migrations
if exist "backend\migrations\README.md" (
    echo Removing README.md from backend\migrations\...
    del "backend\migrations\README.md"
    echo Done!
)

REM Remove uploads directory if empty
if exist "backend\migrations\uploads" (
    echo Removing empty uploads directory from backend\migrations\...
    rmdir "backend\migrations\uploads" 2>nul
)

echo.
echo Cleanup complete! Now you can initialize Git in the correct directory.
echo Run the following commands:
echo   git init
echo   git add .
echo   git commit -m "Initial commit - TVS Digital Signage Platform"
echo   git branch -M main
echo   git remote add origin https://github.com/LeonardoRFragoso/tvs-iTracker.git
echo   git push -u origin main --force
pause
