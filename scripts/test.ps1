# scripts/test.ps1 - Load .env and run backend test suite against real MongoDB
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $repoRoot ".env"

if (Test-Path $envFile) {
    Write-Host "Loading environment variables from $envFile..."
    Get-Content $envFile | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
            $parts = $line.Split("=", 2)
            $name = $parts[0].Trim()
            $value = $parts[1].Trim()
            [System.Environment]::SetEnvironmentVariable($name, $value, [System.EnvironmentVariableTarget]::Process)
        }
    }
} else {
    Write-Warning ".env file not found at $envFile; relying on existing environment variables."
}

# Enforce test environment, separate test database, and Node VM modules for Jest
$env:NODE_ENV = "test"
$env:MONGO_DB = "upwatch_test"
$env:NODE_OPTIONS = "--experimental-vm-modules"

$backendDir = Join-Path $repoRoot "backend"
Push-Location $backendDir

try {
    Write-Host "Running backend Jest test suite..."
    npm test
    $exitCode = $LASTEXITCODE
} finally {
    Pop-Location
}

if ($exitCode -ne 0) {
    exit $exitCode
}
