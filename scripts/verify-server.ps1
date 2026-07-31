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

function Normalize-LineEndings {
    param(
        [Parameter(Mandatory)]
        [string]$Value
    )

    return $Value.Replace("`r`n", "`n").Replace("`r", "`n")
}

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$serverRoot = Join-Path $repositoryRoot "server"
$dbmlPath = Join-Path $repositoryRoot "docs/database/schema.dbml"
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
    if (-not (Test-Path -LiteralPath $dbmlPath)) {
        throw "Tracked DBML documentation is missing: $dbmlPath"
    }
    $dbmlBytesBefore = [System.IO.File]::ReadAllBytes($dbmlPath)
    $dbmlContentBefore = Normalize-LineEndings(
        [System.IO.File]::ReadAllText($dbmlPath)
    )
    Invoke-Checked { npm run db:docs } "Prisma DBML generation"
    $dbmlContentAfter = Normalize-LineEndings(
        [System.IO.File]::ReadAllText($dbmlPath)
    )
    if ($dbmlContentBefore -cne $dbmlContentAfter) {
        throw "Prisma DBML documentation drifted. Commit the regenerated docs/database/schema.dbml file."
    }
    Invoke-Checked { npm run build } "server TypeScript build"
    # Both db:docs and build run prisma generate, whose DBML generator follows
    # the host newline convention. Preserve the tracked bytes after the final
    # generation when only line endings changed so verification stays clean.
    [System.IO.File]::WriteAllBytes($dbmlPath, $dbmlBytesBefore)
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
