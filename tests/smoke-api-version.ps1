param(
    [int]$StartupTimeoutSec = 45
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path $PSScriptRoot -Parent
$projectPath = Join-Path $repoRoot "src\Jmaka.Api\Jmaka.Api.csproj"
$smokeRoot = Join-Path $repoRoot ".tmp\smoke-api-version"
$stdoutPath = Join-Path $smokeRoot "app.stdout.log"
$stderrPath = Join-Path $smokeRoot "app.stderr.log"

New-Item -ItemType Directory -Path $smokeRoot -Force | Out-Null

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
$listener.Start()
$port = ([System.Net.IPEndPoint]$listener.LocalEndpoint).Port
$listener.Stop()

$psi = [System.Diagnostics.ProcessStartInfo]::new()
$psi.FileName = "dotnet"
$psi.WorkingDirectory = $repoRoot
$psi.Arguments = "run --project `"$projectPath`" --no-launch-profile --urls http://127.0.0.1:$port"
$psi.UseShellExecute = $false
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.Environment["ASPNETCORE_ENVIRONMENT"] = "Development"
$psi.Environment["JMAKA_STORAGE_ROOT"] = $smokeRoot

$process = [System.Diagnostics.Process]::new()
$process.StartInfo = $psi

try {
    [void]$process.Start()
    $stdoutTask = $process.StandardOutput.ReadToEndAsync()
    $stderrTask = $process.StandardError.ReadToEndAsync()

    $baseUri = "http://127.0.0.1:$port"
    $versionUri = "$baseUri/api/version"
    $deadline = (Get-Date).AddSeconds($StartupTimeoutSec)
    $response = $null

    while ((Get-Date) -lt $deadline) {
        if ($process.HasExited) {
            throw "Jmaka exited before smoke endpoint became available."
        }

        try {
            $response = Invoke-RestMethod -Uri $versionUri -TimeoutSec 3
            break
        } catch {
            Start-Sleep -Milliseconds 500
        }
    }

    if ($null -eq $response) {
        throw "Timed out waiting for $versionUri"
    }

    if ([string]::IsNullOrWhiteSpace($response.version)) {
        throw "Smoke endpoint responded without a version payload."
    }

    Write-Host "Smoke PASS: /api/version -> $($response.version)"
} finally {
    if (-not $process.HasExited) {
        try {
            $childIds = @(Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq $process.Id } | Select-Object -ExpandProperty ProcessId)
            if ($childIds.Count -gt 0) {
                Stop-Process -Id $childIds -Force -ErrorAction SilentlyContinue
            }
        } catch {
        }

        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
        $null = $process.WaitForExit(5000)
    }

    $stdout = $stdoutTask.GetAwaiter().GetResult()
    $stderr = $stderrTask.GetAwaiter().GetResult()

    $stdout | Set-Content -Path $stdoutPath -Encoding UTF8
    $stderr | Set-Content -Path $stderrPath -Encoding UTF8
}
