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
$webRoot = Join-Path $repositoryRoot "web"

Push-Location $webRoot
try {
    if (-not $SkipInstall) {
        Invoke-Checked { npm ci } "web npm ci"
    }
    if (-not $SkipAudit) {
        Invoke-Checked {
            npm audit --omit=dev --audit-level=high
        } "web production dependency audit"
    }

    Invoke-Checked { npm run lint } "web lint"
    Invoke-Checked { npm run build } "web production build"
}
finally {
    Pop-Location
}
