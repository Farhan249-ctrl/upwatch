# scripts/k8s-secrets.ps1
# Creates Kubernetes secret 'upwatch-secrets' from .env file
# Adheres strictly to security rule: NEVER print or log secret values.
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $repoRoot ".env"

if (-not (Test-Path $envFile)) {
    Write-Error ".env file not found at $envFile. Cannot generate Kubernetes secret."
    exit 1
}

$requiredKeys = @("MONGO_ROOT_USER", "MONGO_ROOT_PASSWORD", "JWT_SECRET", "TELEGRAM_BOT_TOKEN")
$secretMap = [ordered]@{}

Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
        $parts = $line.Split("=", 2)
        $key = $parts[0].Trim()
        $val = $parts[1].Trim()
        if ($requiredKeys -contains $key) {
            if (($val.StartsWith('"') -and $val.EndsWith('"')) -or ($val.StartsWith("'") -and $val.EndsWith("'"))) {
                $val = $val.Substring(1, $val.Length - 2)
            }
            $secretMap[$key] = $val
        }
    }
}

foreach ($key in @("MONGO_ROOT_USER", "MONGO_ROOT_PASSWORD", "JWT_SECRET")) {
    if (-not $secretMap.Contains($key) -or [string]::IsNullOrEmpty($secretMap[$key])) {
        Write-Error "Required key '$key' missing or empty in $envFile"
        exit 1
    }
}
if (-not $secretMap.Contains("TELEGRAM_BOT_TOKEN")) {
    $secretMap["TELEGRAM_BOT_TOKEN"] = ""
}

# Ensure namespace upwatch exists
kubectl create namespace upwatch --dry-run=client -o yaml | kubectl apply -f - | Out-Null

# Build command argument list for kubectl create secret
$cmdArgs = @("create", "secret", "generic", "upwatch-secrets", "--namespace", "upwatch")
foreach ($k in $secretMap.Keys) {
    $v = $secretMap[$k]
    $cmdArgs += "--from-literal=$k=$v"
}
$cmdArgs += @("--dry-run=client", "-o", "yaml")

# Apply secret via pipe to kubectl apply
& kubectl @cmdArgs | kubectl apply -f - | Out-Null

Write-Host "Created/Updated Secret 'upwatch-secrets' in namespace 'upwatch' with keys:"
foreach ($k in $secretMap.Keys) {
    Write-Host "  - $k"
}
