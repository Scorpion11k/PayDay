# build_release.ps1

Write-Host "Starting Release Build Process..." -ForegroundColor Green

# 1. Check prerequisites
if (-not (Test-Path "client\.env.production")) {
    Write-Error "client\.env.production is missing! Please create it first with VITE_API_BASE_URL set to your server IP."
    exit 1
}

# 2. Build Server
Write-Host "`n--- Building Server ---" -ForegroundColor Cyan
Push-Location server
try {
    npm install
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "Server build failed" }
    
    # Compile seed script for production use
    Write-Host "Compiling seed script..." -ForegroundColor Cyan
    & node_modules/.bin/tsc prisma/seed-templates.ts --outDir dist/prisma --module commonjs --target ES2020 --lib ES2020 --esModuleInterop --skipLibCheck --resolveJsonModule --moduleResolution node
    if ($LASTEXITCODE -ne 0) { Write-Warning "Seed script compilation failed, will rely on ts-node in production" }
}
catch {
    Write-Error $_
    Pop-Location
    exit 1
}
Pop-Location

# 3. Build Client
Write-Host "`n--- Building Client ---" -ForegroundColor Cyan
Push-Location client
try {
    npm install
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "Client build failed" }
}
catch {
    Write-Error $_
    Pop-Location
    exit 1
}
Pop-Location

# 4. Prepare Release Folder
Write-Host "`n--- Preparing Release Folder ---" -ForegroundColor Cyan
$releaseDir = "Release"
if (-not (Test-Path $releaseDir)) { New-Item -ItemType Directory -Path $releaseDir | Out-Null }

# 4a. Server Release
$serverRelease = "$releaseDir\server"
if (-not (Test-Path $serverRelease)) { New-Item -ItemType Directory -Path $serverRelease | Out-Null }

Write-Host "Copying Server files..."
Copy-Item -Recurse -Force "server\dist" "$serverRelease\"
Copy-Item -Force "server\package.json" "$serverRelease\"
Copy-Item -Force "server\package-lock.json" "$serverRelease\"
if (Test-Path "server\.env") { Copy-Item -Force "server\.env" "$serverRelease\" }
if (Test-Path "server\prisma") { Copy-Item -Recurse -Force "server\prisma" "$serverRelease\" }

# 4b. Client Release
$clientRelease = "$releaseDir\client"
if (-not (Test-Path $clientRelease)) { New-Item -ItemType Directory -Path $clientRelease | Out-Null }

Write-Host "Copying Client files..."
Copy-Item -Recurse -Force "client\dist" "$clientRelease\"
if (Test-Path "client\.env.production") { Copy-Item -Force "client\.env.production" "$clientRelease\" }

Write-Host "`nRelease build complete at: $PWD\$releaseDir" -ForegroundColor Green
Write-Host "You can now zip the '$releaseDir' folder or copy it to your production machine."
