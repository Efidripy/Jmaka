param()

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$installPath = Join-Path $repoRoot "deploy\ubuntu24\install.sh"
$updatePath = Join-Path $repoRoot "deploy\ubuntu24\update-instance.sh"
$nginxPath = Join-Path $repoRoot "deploy\ubuntu24\nginx.examples.conf"
$scripts = @($installPath, $updatePath)

foreach ($path in $scripts) {
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Missing deploy script: $path"
    }

    $bytes = [System.IO.File]::ReadAllBytes($path)
    if ($bytes -contains 13) {
        throw "Linux deploy script contains CR/CRLF bytes: $path"
    }

    & shellcheck $path
    if ($LASTEXITCODE -ne 0) {
        throw "shellcheck failed: $path"
    }
}

$install = Get-Content -Raw -LiteralPath $installPath
$update = Get-Content -Raw -LiteralPath $updatePath
$nginx = Get-Content -Raw -LiteralPath $nginxPath

$requiredInstall = @(
    'safe_extract_bundle',
    'verify_bundle_checksum',
    'EnvironmentFile=',
    'ProtectSystem=strict',
    'ReadWritePaths=',
    'rollback_install',
    'wait_for_application'
)
$requiredUpdate = @(
    'validate_app_dir',
    'safe_extract_bundle',
    'verify_bundle_checksum',
    'rollback_instance',
    'wait_for_application',
    'JMAKA_AUTH_PASSWORD'
)

foreach ($marker in $requiredInstall) {
    if (-not $install.Contains($marker)) {
        throw "install.sh missing safety marker: $marker"
    }
}
foreach ($marker in $requiredUpdate) {
    if (-not $update.Contains($marker)) {
        throw "update-instance.sh missing safety marker: $marker"
    }
}
if (-not $nginx.Contains('client_max_body_size 1600m')) {
    throw "nginx examples do not permit the documented 1.5 GiB video upload contract"
}

Write-Host "Deploy safety contract PASS"
