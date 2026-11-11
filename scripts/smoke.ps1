# scripts/smoke.ps1 - End-to-end smoke test for UpWatch
$ErrorActionPreference = "Stop"
[System.Net.WebRequest]::DefaultWebProxy = [System.Net.GlobalProxySelection]::GetEmptyWebProxy()

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
}

$apiPort = if ($env:API_PORT) { $env:API_PORT } else { "4000" }
$baseUrl = "http://127.0.0.1:$apiPort"
$apiProc = $null
$workerProc = $null
$token = $null
$monitorId = $null

try {
    # Check if API server is already running, otherwise start it
    Write-Host "`n[Check API] Probing $baseUrl/api/health..."
    $apiRunning = $false
    try {
        $res = Invoke-RestMethod -Uri "$baseUrl/api/health" -Method Get -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($res.status -eq "ok") {
            $apiRunning = $true
            Write-Host "API server is already running on port $apiPort."
        }
    } catch {
        $apiRunning = $false
    }

    if (-not $apiRunning) {
        Write-Host "Starting API server in the background..."
        $indexScript = Join-Path $repoRoot "backend/src/index.js"
        $backendDir = Join-Path $repoRoot "backend"
        $apiProc = Start-Process -FilePath "node" -ArgumentList "`"$indexScript`"" -WorkingDirectory $backendDir -PassThru
        Start-Sleep -Seconds 2

        $attempts = 0
        $started = $false
        while ($attempts -lt 15) {
            try {
                $res = Invoke-RestMethod -Uri "$baseUrl/api/health" -Method Get -TimeoutSec 2 -ErrorAction Stop
                if ($res.status -eq "ok") {
                    Write-Host "API server started successfully on port $apiPort."
                    $started = $true
                    break
                }
            } catch {
                Start-Sleep -Seconds 1
                $attempts++
            }
        }
        if (-not $started) {
            throw "Failed to start or connect to UpWatch API on port $apiPort"
        }
    }

    # Step 1: Register fresh user
    $uniqueId = [Guid]::NewGuid().ToString().Substring(0, 8)
    $email = "smoke_$uniqueId@example.com"
    $password = "SmokePass123!"
    Write-Host "`n[1/6] Registering fresh user: $email..."
    $registerBody = @{
        name = "Smoke Tester"
        email = $email
        password = $password
    } | ConvertTo-Json

    $registerRes = Invoke-RestMethod -Uri "$baseUrl/api/auth/register" -Method Post -Body $registerBody -ContentType "application/json"
    $token = $registerRes.token
    if (-not $token) {
        throw "Failed to obtain auth token from registration"
    }
    Write-Host "User registered successfully. User ID: $($registerRes.user.id)"

    # Step 2: Create monitor targeting /api/health with 15-second interval
    Write-Host "`n[2/6] Creating monitor targeting $baseUrl/api/health (15s interval)..."
    $headers = @{ Authorization = "Bearer $token" }
    $monitorBody = @{
        name = "Smoke Health Check"
        url = "$baseUrl/api/health"
        intervalSeconds = 15
        timeoutMs = 5000
    } | ConvertTo-Json

    $monitorRes = Invoke-RestMethod -Uri "$baseUrl/api/monitors" -Method Post -Headers $headers -Body $monitorBody -ContentType "application/json"
    $monitorId = if ($monitorRes._id) { $monitorRes._id } else { $monitorRes.id }
    Write-Host "Monitor created successfully. Monitor ID: $monitorId, State: $($monitorRes.state)"

    # Step 3: Start worker process in the background
    Write-Host "`n[3/6] Starting background worker process..."
    $workerScript = Join-Path $repoRoot "backend/src/worker/index.js"
    $workerProc = Start-Process -FilePath "node" -ArgumentList "`"$workerScript`"" -WorkingDirectory $backendDir -PassThru
    Write-Host "Worker process started (PID: $($workerProc.Id))."

    # Step 4: Wait for two ticks (at least 18-20 seconds for two 15s checks)
    Write-Host "`n[4/6] Waiting 20 seconds for worker to execute 2 checks..."
    for ($i = 1; $i -le 20; $i++) {
        Start-Sleep -Seconds 1
        Write-Host -NoNewline "."
    }
    Write-Host " Done."

    # Step 5: Verify checks and incident endpoints report real data
    Write-Host "`n[5/6] Verifying check, stats, overview, and incident endpoints..."
    
    # 5a. Checks endpoint
    $checks = Invoke-RestMethod -Uri "$baseUrl/api/monitors/$monitorId/checks?limit=50" -Method Get -Headers $headers
    Write-Host "Recent checks recorded: $($checks.Count)"
    if ($checks.Count -lt 2) {
        throw "Expected at least 2 checks recorded by worker, but found $($checks.Count)"
    }
    foreach ($c in $checks) {
        Write-Host "  -> Check: ts=$($c.ts), statusCode=$($c.statusCode), responseMs=$($c.responseMs)ms, ok=$($c.ok)"
    }

    # 5b. Stats endpoint
    $stats = Invoke-RestMethod -Uri "$baseUrl/api/monitors/$monitorId/stats?range=24h" -Method Get -Headers $headers
    Write-Host "Stats: uptimePercent=$($stats.uptimePercent)%, totalChecks=$($stats.totalChecks), avgResponseMs=$($stats.avgResponseMs)ms"
    if ($stats.uptimePercent -ne 100) {
        throw "Expected 100% uptime, got $($stats.uptimePercent)"
    }

    # 5c. Incidents endpoint
    $incidents = Invoke-RestMethod -Uri "$baseUrl/api/monitors/$monitorId/incidents" -Method Get -Headers $headers
    Write-Host "Incidents for monitor: $($incidents.Count) (expected 0 for healthy target)"

    # 5d. Overview endpoint
    $overview = Invoke-RestMethod -Uri "$baseUrl/api/overview?range=24h" -Method Get -Headers $headers
    $mon = $overview.monitors | Where-Object { ($_.id -eq $monitorId) -or ($_._id -eq $monitorId) }
    if ($mon) {
        Write-Host "Overview report: Monitor is state=$($mon.state), strip buckets count=$($mon.strip.Count)"
    } else {
        throw "Monitor not found in overview response"
    }

    Write-Host "`n======================================================="
    Write-Host "  SMOKE TEST PASSED: All real checks & endpoints OK!   "
    Write-Host "======================================================="

} finally {
    # Step 6: Cleanup
    Write-Host "`n[6/6] Cleaning up test data and background processes..."
    if ($token -and $monitorId) {
        try {
            Write-Host "Deleting smoke test monitor $monitorId..."
            Invoke-RestMethod -Uri "$baseUrl/api/monitors/$monitorId" -Method Delete -Headers @{ Authorization = "Bearer $token" } | Out-Null
            Write-Host "Smoke monitor deleted."
        } catch {
            Write-Warning "Could not delete smoke test monitor: $_"
        }
    }

    if ($workerProc -and -not $workerProc.HasExited) {
        Write-Host "Stopping worker process (PID: $($workerProc.Id))..."
        Stop-Process -Id $workerProc.Id -Force
        Write-Host "Worker process stopped."
    }

    if ($apiProc -and -not $apiProc.HasExited) {
        Write-Host "Stopping API process (PID: $($apiProc.Id))..."
        Stop-Process -Id $apiProc.Id -Force
        Write-Host "API process stopped."
    }
}
