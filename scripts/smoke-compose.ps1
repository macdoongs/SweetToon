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
          const base = 'http://localhost:3000'
          async function json(path, options) {
            const response = await fetch(base + path, options)
            if (!response.ok) {
              throw new Error(path + ' returned ' + response.status)
            }
            return response.json()
          }
          async function verifyOrderFlow() {
            const list = await json('/api/series')
            let selected
            for (const item of list.items) {
              const detail = await json(
                '/api/series/' + encodeURIComponent(item.slug)
              )
              const season = detail.seasons.find(
                candidate => candidate.status === 'completed'
              )
              if (season) {
                selected = { detail, season }
                break
              }
            }
            if (!selected) throw new Error('completed season not found')

            const specification = {
              seasonId: selected.season.id,
              volumeNumber: 1,
              bookSize: 'A5',
              coverType: 'softcover',
              quantity: 1
            }
            const headers = {
              'Content-Type': 'application/json',
              Accept: 'application/json'
            }
            const quote = await json('/api/print-quotes', {
              method: 'POST',
              headers,
              body: JSON.stringify(specification)
            })
            if (quote.pageCount < 1 || quote.totalPrice < 1) {
              throw new Error('invalid print quote')
            }
            const candyWalletToken = crypto.randomUUID()
            const orderRequest = {
              ...specification,
              requestKey: crypto.randomUUID(),
              candyWalletToken,
              ordererName: 'SmokeTest'
            }
            const order = await json('/api/orders', {
              method: 'POST',
              headers,
              body: JSON.stringify(orderRequest)
            })
            const repeatedOrder = await json('/api/orders', {
              method: 'POST',
              headers,
              body: JSON.stringify(orderRequest)
            })
            const persisted = await json(
              '/api/orders/' + encodeURIComponent(order.id)
            )
            const candyWallet = await json(
              '/api/candy-wallets/' + encodeURIComponent(candyWalletToken)
            )
            const eventStatuses = persisted.events.map(event => event.status)
            if (
              repeatedOrder.id !== order.id ||
              persisted.status !== 'processing' ||
              eventStatuses.join(',') !== 'pending,processing' ||
              !persisted.providerOrderId ||
              persisted.candyBonus !== 5 ||
              candyWallet.balance !== 5 ||
              candyWallet.unitPrice !== 100
            ) {
              throw new Error('persistent order verification failed')
            }
            console.log('order=' + persisted.id)
          }
          verifyOrderFlow().catch(error => {
            console.error(error)
            process.exit(1)
          })
        "
    } "mock quote and persistent order flow"

    Invoke-Checked {
        docker compose exec -T web node -e "
          Promise.all([
            fetch('http://localhost:3000/openapi.json'),
            fetch('http://localhost:3000/api-docs/')
          ])
            .then(async ([contractResponse, docsResponse]) => {
              if (!contractResponse.ok || !docsResponse.ok) process.exit(1)
              const contract = await contractResponse.json()
              const docs = await docsResponse.text()
              if (
                contract.openapi !== '3.1.0' ||
                !docs.includes('SweetToon API')
              ) {
                process.exit(1)
              }
              console.log('openapi and swagger ok')
            })
            .catch(error => {
              console.error(error)
              process.exit(1)
            })
        "
    } "OpenAPI and Swagger proxy check"

    Invoke-Checked {
        docker compose exec -T server node -e "
          const AdmZip = require('adm-zip')
          const base = 'http://localhost:4000'
          async function json(path, options) {
            const response = await fetch(base + path, options)
            if (!response.ok) {
              const body = await response.text()
              throw new Error(path + ' returned ' + response.status + ': ' + body)
            }
            return response.json()
          }
          async function verifyStudioFlow() {
            const list = await json('/api/series')
            let selected
            for (const item of list.items) {
              const detail = await json(
                '/api/series/' + encodeURIComponent(item.slug)
              )
              const season = detail.seasons.find(
                candidate => candidate.status === 'ongoing'
              )
              if (season) {
                selected = { detail, season }
                break
              }
            }
            if (!selected) throw new Error('ongoing season not found')
            const episodeNumber =
              Math.max(0, ...selected.season.episodes.map(item => item.number)) +
              1
            await json(
              '/api/studio/series/' +
                encodeURIComponent(selected.detail.id) +
                '/access-policy',
              {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                  Accept: 'application/json'
                },
                body: JSON.stringify({
                  freeVolumeCount: 20,
                  previewEpisodeCount: 0
                })
              }
            )

            const png = Buffer.from(
              'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
              'base64'
            )
            const zip = new AdmZip()
            zip.addFile('10.png', png)
            zip.addFile('2.png', png)
            zip.addFile('1.png', png)
            const form = new FormData()
            form.append(
              'archive',
              new Blob([zip.toBuffer()], { type: 'application/zip' }),
              'smoke.zip'
            )
            const preview = await json('/api/studio/uploads', {
              method: 'POST',
              body: form
            })
            const names = preview.pages.map(page => page.originalName).join(',')
            if (names !== '1.png,2.png,10.png') {
              throw new Error('natural page order failed: ' + names)
            }

            const created = await json('/api/studio/episodes', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json'
              },
              body: JSON.stringify({
                sessionId: preview.sessionId,
                seasonId: selected.season.id,
                number: episodeNumber,
                title: 'Smoke Episode',
                pageIds: preview.pages.map(page => page.id)
              })
            })
            const episode = await json(
              '/api/episodes/' + encodeURIComponent(created.episodeId)
            )
            if (episode.pages.length !== 3) {
              throw new Error('studio episode pages were not persisted')
            }
            const imageResponse = await fetch(base + episode.pages[0].imageUrl)
            if (!imageResponse.ok) {
              throw new Error('published studio image is unavailable')
            }
            console.log('studio-episode=' + created.episodeId)
          }
          verifyStudioFlow().catch(error => {
            console.error(error)
            process.exit(1)
          })
        "
    } "studio ZIP preview and episode publication"

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
