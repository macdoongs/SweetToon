[CmdletBinding()]
param(
    [switch]$SkipInstall,
    [switch]$SkipAudit
)

$ErrorActionPreference = "Stop"

function Invoke-Checked {
    param(
        [Parameter(Mandatory)]
        [scriptblock]$Command,
        [Parameter(Mandatory)]
        [string]$Label
    )

    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "$Label failed with exit code $LASTEXITCODE."
    }
}

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$serverRoot = Join-Path $repositoryRoot "server"
$previousDatabaseUrl = [Environment]::GetEnvironmentVariable(
    "DATABASE_URL",
    "Process"
)

Push-Location $serverRoot
try {
    if (-not $SkipInstall) {
        Invoke-Checked { npm ci } "server npm ci"
    }
    if (-not $SkipAudit) {
        Invoke-Checked {
            npm audit --omit=dev --audit-level=high
        } "server production dependency audit"
    }

    if ([string]::IsNullOrWhiteSpace($env:DATABASE_URL)) {
        $env:DATABASE_URL =
            "postgresql://sweettoon:sweettoon@localhost:5432/sweettoon"
    }

    Invoke-Checked { npx prisma validate } "Prisma schema validation"
    Invoke-Checked { npm run build } "server TypeScript build"
    Invoke-Checked { npm test } "server tests"
}
finally {
    if ($null -eq $previousDatabaseUrl) {
        Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
    }
    else {
        $env:DATABASE_URL = $previousDatabaseUrl
    }
    Pop-Location
}
