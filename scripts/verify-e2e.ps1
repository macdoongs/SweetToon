[CmdletBinding()]
param(
    [string]$ProjectName = "sweettoon-e2e-$PID",
    [switch]$SkipBuild,
    [switch]$SkipInstall,
    [switch]$SkipBrowserInstall
)

$ErrorActionPreference = "Stop"

if ($ProjectName -notmatch "^sweettoon-(e2e|ci)-[a-z0-9-]+$") {
    throw "ProjectName must match sweettoon-e2e-* or sweettoon-ci-*."
}

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
$managedEnvironment = @(
    "CI",
    "COMPOSE_PROJECT_NAME",
    "DB_PORT",
    "SERVER_PORT",
    "WEB_PORT",
    "E2E_BASE_URL"
)
$previousEnvironment = @{}

foreach ($name in $managedEnvironment) {
    $previousEnvironment[$name] = [Environment]::GetEnvironmentVariable(
        $name,
        "Process"
    )
}

$env:CI = "true"
$env:COMPOSE_PROJECT_NAME = $ProjectName
$env:DB_PORT = "0"
$env:SERVER_PORT = "0"
$env:WEB_PORT = "0"
$composeTouched = $false

Push-Location $repositoryRoot
try {
    Invoke-Checked {
        docker compose config --quiet
    } "Docker Compose configuration"

    $composeTouched = $true
    if (-not $SkipBuild) {
        Invoke-Checked { docker compose build } "Docker Compose build"
    }

    Invoke-Checked {
        docker compose up -d --wait --wait-timeout 120
    } "Docker Compose startup"

    $portOutput = docker compose port web 3000
    $portExitCode = $LASTEXITCODE
    $portMapping = $portOutput | Select-Object -First 1
    $portMatch = [regex]::Match(
        [string]$portMapping,
        ":(?<port>[0-9]+)\s*$"
    )
    if ($portExitCode -ne 0 -or -not $portMatch.Success) {
        throw "Could not resolve the Compose web port: $portMapping"
    }
    $env:E2E_BASE_URL = "http://127.0.0.1:$(
        $portMatch.Groups["port"].Value
    )"

    Push-Location $webRoot
    try {
        if (-not $SkipInstall) {
            Invoke-Checked { npm ci } "web npm ci"
        }
        if (-not $SkipBrowserInstall) {
            Invoke-Checked {
                npx playwright install chromium
            } "Playwright Chromium install"
        }
        Invoke-Checked { npm run test:e2e } "Playwright browser E2E"
    }
    finally {
        Pop-Location
    }
}
catch {
    if ($composeTouched) {
        docker compose logs --no-color --tail 200
    }
    throw
}
finally {
    if ($composeTouched) {
        docker compose down --volumes --remove-orphans
    }

    foreach ($name in $managedEnvironment) {
        $previousValue = $previousEnvironment[$name]
        if ($null -eq $previousValue) {
            Remove-Item "Env:$name" -ErrorAction SilentlyContinue
        }
        else {
            Set-Item "Env:$name" $previousValue
        }
    }
    Pop-Location
}
