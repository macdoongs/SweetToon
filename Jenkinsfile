pipeline {
    agent { label 'windows-build' }

    options {
        disableConcurrentBuilds()
        timestamps()
        timeout(time: 20, unit: 'MINUTES')
    }

    environment {
        COMPOSE_PROJECT_NAME = "sweettoon-ci-${BUILD_NUMBER}"
        DB_PORT = "0"
        SERVER_PORT = "0"
        WEB_PORT = "0"
    }

    stages {
        stage('Install and verify') {
            parallel {
                stage('Web') {
                    steps {
                        dir('web') {
                            powershell '''
                                $ErrorActionPreference = "Stop"
                                npm ci
                                npm audit --omit=dev --audit-level=high
                                npm run lint
                                npm run build
                            '''
                        }
                    }
                }

                stage('Server') {
                    steps {
                        dir('server') {
                            powershell '''
                                $ErrorActionPreference = "Stop"
                                $env:DATABASE_URL = "postgresql://sweettoon:sweettoon@localhost:5432/sweettoon"
                                npm ci
                                npm audit --omit=dev --audit-level=high
                                npx prisma validate
                                npm run build
                                npm run test --if-present
                            '''
                        }
                    }
                }
            }
        }

        stage('Docker integration') {
            steps {
                powershell '''
                    $ErrorActionPreference = "Stop"
                    docker compose config --quiet
                    docker compose build
                    docker compose up -d --wait --wait-timeout 120
                    docker compose ps
                    docker compose exec -T server node -e "fetch('http://localhost:4000/health').then(async r => { if (!r.ok) process.exit(1); console.log(await r.text()) }).catch(() => process.exit(1))"
                    docker compose exec -T web node -e "fetch('http://localhost:3000').then(r => { if (!r.ok) process.exit(1); console.log('web ok') }).catch(() => process.exit(1))"
                '''
            }
        }
    }

    post {
        unsuccessful {
            powershell 'docker compose logs --no-color --tail 200'
        }
        always {
            powershell 'docker compose down --volumes --remove-orphans'
            cleanWs()
        }
    }
}
