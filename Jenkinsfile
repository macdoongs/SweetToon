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
                        powershell '''
                            $ErrorActionPreference = "Stop"
                            & "$env:WORKSPACE/scripts/verify-web.ps1"
                        '''
                    }
                }

                stage('Server') {
                    steps {
                        powershell '''
                            $ErrorActionPreference = "Stop"
                            & "$env:WORKSPACE/scripts/verify-server.ps1"
                        '''
                    }
                }
            }
        }

        stage('Docker integration') {
            steps {
                powershell '''
                    $ErrorActionPreference = "Stop"
                    & "$env:WORKSPACE/scripts/smoke-compose.ps1" `
                        -ProjectName $env:COMPOSE_PROJECT_NAME
                '''
            }
        }

        stage('Browser E2E') {
            steps {
                powershell '''
                    $ErrorActionPreference = "Stop"
                    & "$env:WORKSPACE/scripts/verify-e2e.ps1" `
                        -ProjectName $env:COMPOSE_PROJECT_NAME `
                        -SkipBuild `
                        -SkipInstall
                '''
            }
        }

        stage('Deploy dev') {
            when {
                expression {
                    env.GIT_BRANCH == 'origin/dev' || env.BRANCH_NAME == 'dev'
                }
            }
            steps {
                build job: 'SweetToon-Deploy-Dev',
                    parameters: [
                        string(name: 'EXPECTED_COMMIT', value: env.GIT_COMMIT)
                    ],
                    propagate: true,
                    wait: true
            }
        }
    }

    post {
        always {
            archiveArtifacts artifacts: 'web/playwright-report/**,web/test-results/**',
                allowEmptyArchive: true
            cleanWs()
        }
    }
}
