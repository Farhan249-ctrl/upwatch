# scripts/gen-cert.ps1 - Generate self-signed TLS certificates for local Nginx edge
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$certsDir = Join-Path $repoRoot "nginx\certs"

if (-not (Test-Path $certsDir)) {
    New-Item -ItemType Directory -Path $certsDir -Force | Out-Null
}

$certFile = Join-Path $certsDir "selfsigned.crt"
$keyFile = Join-Path $certsDir "selfsigned.key"

Write-Host "Checking for existing TLS certificates in $certsDir..."
if ((Test-Path $certFile) -and (Test-Path $keyFile) -and ((Get-Item $certFile).Length -gt 0) -and ((Get-Item $keyFile).Length -gt 0)) {
    Write-Host "Certificates already exist: $certFile and $keyFile"
    exit 0
}

Write-Host "Generating self-signed TLS certificate for localhost / 127.0.0.1..."

$opensslCmd = Get-Command openssl -ErrorAction SilentlyContinue

if ($opensslCmd) {
    Write-Host "Using host openssl binary: $($opensslCmd.Source)"
    & openssl req -x509 -nodes -days 365 -newkey rsa:2048 `
        -keyout $keyFile `
        -out $certFile `
        -subj "/CN=localhost" `
        -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
} else {
    Write-Host "Host openssl not found. Using lightweight container (alpine:3.21)..."
    # Docker on Windows requires Linux-style forward slashes for volume mounting
    $posixCertsDir = ($certsDir -replace '\\', '/').Replace('C:', '/c').Replace('c:', '/c')
    docker run --rm `
        -v "${certsDir}:/certs" `
        alpine:3.21 `
        sh -c "apk add --no-cache openssl >/dev/null 2>&1 && openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout /certs/selfsigned.key -out /certs/selfsigned.crt -subj '/CN=localhost' -addext 'subjectAltName=DNS:localhost,IP:127.0.0.1'"
}

if ((Test-Path $certFile) -and (Test-Path $keyFile)) {
    Write-Host "TLS certificate generated successfully:"
    Write-Host "  Certificate: $certFile ($((Get-Item $certFile).Length) bytes)"
    Write-Host "  Private Key: $keyFile ($((Get-Item $keyFile).Length) bytes)"
} else {
    throw "Failed to generate certificates"
}
