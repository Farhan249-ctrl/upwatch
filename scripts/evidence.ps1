# scripts/evidence.ps1 - Automated evidence collection for UpWatch Stage 3
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$docsDir = Join-Path $repoRoot "docs"
if (-not (Test-Path $docsDir)) {
    New-Item -ItemType Directory -Path $docsDir -Force | Out-Null
}
$evidenceFile = Join-Path $docsDir "evidence.txt"

# Helper for logging
function Log-Evidence($title, $content) {
    $timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    $header = "`n================================================================================"
    $header += "`n[TIMESTAMP: $timestamp] $title"
    $header += "`n================================================================================"
    Write-Host $header
    $header | Out-File -FilePath $evidenceFile -Append -Encoding utf8
    if ($content) {
        Write-Host $content
        $content | Out-File -FilePath $evidenceFile -Append -Encoding utf8
    }
}

# Clear previous evidence file
if (Test-Path $evidenceFile) {
    Remove-Item -Force $evidenceFile
}

Write-Host "Starting UpWatch Stage 3 Evidence Collection..."
Log-Evidence "UPWATCH STAGE 3 VERIFICATION EVIDENCE" "Stack: 5 containers (nginx, frontend, api, worker, mongo)"

# Verification 1: HTTPS on port 8444 returns 200
$code8444 = curl.exe -k -s -o NUL -w "%{http_code}" https://localhost:8444
Log-Evidence "VERIFICATION 1: HTTPS 8444 HTTP STATUS" "HTTP Code: $code8444"

# Verification 2: HTTP on port 8082 redirects to HTTPS
$redir8082 = curl.exe -s -o NUL -w "%{http_code} %{redirect_url}" http://localhost:8082
Log-Evidence "VERIFICATION 2: HTTP 8082 REDIRECT" "Redirect Result: $redir8082"

# Verification 3: Register, Login, Create Monitor via https://localhost:8444/api
$randUser = "evidence_user_$([Guid]::NewGuid().ToString().Substring(0,8))"
$email = "$randUser@upwatch.dev"
$regPayload = "{`"name`":`"Evidence User`",`"email`":`"$email`",`"password`":`"EvidencePassword123!`"}"
$regRes = $regPayload | curl.exe -k -s -X POST https://localhost:8444/api/auth/register -H "Content-Type: application/json" --data-binary "@-"
$regObj = $regRes | ConvertFrom-Json
$token = $regObj.token
$userId = $regObj.user.id

$loginPayload = "{`"email`":`"$email`",`"password`":`"EvidencePassword123!`"}"
$loginRes = $loginPayload | curl.exe -k -s -X POST https://localhost:8444/api/auth/login -H "Content-Type: application/json" --data-binary "@-"

$monPayload = "{`"name`":`"API Health Target`",`"url`":`"http://api:4000/api/health`",`"intervalSeconds`":15,`"timeoutMs`":5000}"
$monRes = $monPayload | curl.exe -k -s -X POST https://localhost:8444/api/monitors -H "Content-Type: application/json" -H "Authorization: Bearer $token" --data-binary "@-"
$monObj = $monRes | ConvertFrom-Json
$monitorId = $monObj._id

Log-Evidence "VERIFICATION 3: REGISTER, LOGIN, CREATE MONITOR" "Registered User ID: $userId`nMonitor ID: $monitorId`nMonitor Creation Response: $monRes"

# Verification 4: Mongo has no published port
$mongoPortOut = docker compose port mongo 27017 2>&1
$mongoPsOut = docker ps --filter "name=upwatch-db" --format "{{.Names}}: {{.Ports}}"
Log-Evidence "VERIFICATION 4: MONGO UNPUBLISHED PORT" "docker compose port mongo 27017 output: '$mongoPortOut'`ndocker ps port mapping: '$mongoPsOut'"

# Verification 5: Worker is checking: monitor going UP and checks recorded
Start-Sleep -Seconds 18
$monList = curl.exe -k -s https://localhost:8444/api/monitors -H "Authorization: Bearer $token"
$checksRes = curl.exe -k -s "https://localhost:8444/api/monitors/$monitorId/checks" -H "Authorization: Bearer $token"
$workerLogs = (docker logs upwatch-worker --tail 20 2>&1) | Out-String
Log-Evidence "VERIFICATION 5: WORKER CHECKING & MONITOR STATE" "Monitor Status: $monList`nRecent Checks: $checksRes`nWorker Logs Tail:`n$workerLogs"

# Verification 6: Persistence test
Write-Host "Running persistence verification: docker compose down (without -v)..."
docker compose down
Write-Host "Bringing stack back up..."
docker compose up -d
# Wait for health
$healthy = $false
for ($i = 0; $i -lt 15; $i++) {
    Start-Sleep -Seconds 2
    $psOut = docker compose ps --format json | ConvertFrom-Json
    $unhealthy = $psOut | Where-Object { $_.Health -ne "healthy" -and $_.State -ne "running" }
    if (-not $unhealthy -and $psOut.Count -ge 5) {
        $healthy = $true
        break
    }
}
$loginAfterRes = $loginPayload | curl.exe -k -s -X POST https://localhost:8444/api/auth/login -H "Content-Type: application/json" --data-binary "@-"
$monAfterRes = curl.exe -k -s https://localhost:8444/api/monitors -H "Authorization: Bearer $token"
Log-Evidence "VERIFICATION 6: PERSISTENCE (DOWN WITHOUT -V, UP AGAIN)" "Login After Restart: $loginAfterRes`nMonitors After Restart: $monAfterRes"

# Verification 7: Docker stats and 20 log lines per container
$oldEAP = $ErrorActionPreference
$ErrorActionPreference = "Continue"

$statsOut = (docker stats --no-stream 2>&1) | Out-String
$nginxLogs = (docker logs upwatch-nginx --tail 20 2>&1) | Out-String
$frontendLogs = (docker logs upwatch-frontend --tail 20 2>&1) | Out-String
$apiLogs = (docker logs upwatch-api --tail 20 2>&1) | Out-String
$workerLogsAfter = (docker logs upwatch-worker --tail 20 2>&1) | Out-String
$dbLogs = (docker logs upwatch-db --tail 20 2>&1) | Out-String

$ErrorActionPreference = $oldEAP
$logsCombined = "--- DOCKER STATS ---`n$statsOut`n`n--- NGINX LOGS ---`n$nginxLogs`n`n--- FRONTEND LOGS ---`n$frontendLogs`n`n--- API LOGS ---`n$apiLogs`n`n--- WORKER LOGS ---`n$workerLogsAfter`n`n--- DB LOGS ---`n$dbLogs"
Log-Evidence "VERIFICATION 7: DOCKER STATS & CONTAINER LOGS" $logsCombined

Write-Host "`nEvidence collection completed. File written to: $evidenceFile"
