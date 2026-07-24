[CmdletBinding()]
param(
    [string]$ProjectName = "sweettoon-verify-$PID",
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

if ($ProjectName -notmatch "^sweettoon-(verify|ci)-[a-z0-9-]+$") {
    throw "ProjectName must match sweettoon-verify-* or sweettoon-ci-*."
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
$managedEnvironment = @(
    "COMPOSE_PROJECT_NAME",
    "DB_PORT",
    "SERVER_PORT",
    "WEB_PORT"
)
$previousEnvironment = @{}

foreach ($name in $managedEnvironment) {
    $previousEnvironment[$name] = [Environment]::GetEnvironmentVariable(
        $name,
        "Process"
    )
}

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
    Invoke-Checked { docker compose ps } "Docker Compose status"

    Invoke-Checked {
        docker compose exec -T server node -e "
          fetch('http://localhost:4000/health')
            .then(r => r.ok ? r.json() : Promise.reject(new Error(r.status)))
            .then(body => {
              if (body.ok !== true || body.printProvider !== 'mock') {
                process.exit(1)
              }
              console.log(JSON.stringify(body))
            })
            .catch(error => {
              console.error(error)
              process.exit(1)
            })
        "
    } "server health and mock provider check"

    Invoke-Checked {
        docker compose exec -T web node -e "
          fetch('http://localhost:3000/api/series')
            .then(r => r.ok ? r.json() : Promise.reject(new Error(r.status)))
            .then(body => {
              if (!Array.isArray(body.items) || body.items.length === 0) {
                process.exit(1)
              }
              console.log('series=' + body.items.length)
            })
            .catch(error => {
              console.error(error)
              process.exit(1)
            })
        "
    } "web to API proxy and seed check"

    Invoke-Checked {
        docker compose exec -T web node -e "
          fetch('http://localhost:3000')
            .then(r => r.ok ? r.text() : Promise.reject(new Error(r.status)))
            .then(html => {
              if (!html.includes('SweetToon')) {
                process.exit(1)
              }
              console.log('web SSR ok')
            })
            .catch(error => {
              console.error(error)
              process.exit(1)
            })
        "
    } "web SSR check"
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
