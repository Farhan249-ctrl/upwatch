// Written, not yet run on a Jenkins server.
pipeline {
    agent any

    options {
        timeout(time: 30, unit: 'MINUTES')
        ansiColor('xterm')
        disableConcurrentBuilds()
    }

    parameters {
        booleanParam(
            name: 'PUSH_IMAGES',
            defaultValue: false,
            description: 'Push built Docker images to Docker Hub registry'
        )
        booleanParam(
            name: 'DEPLOY_STACK',
            defaultValue: false,
            description: 'Deploy or update the UpWatch Docker Compose stack'
        )
    }

    environment {
        DOCKERHUB_CREDENTIALS_ID = 'dockerhub-creds'
        DOCKER_REGISTRY = 'docker.io'
        IMAGE_NAMESPACE = 'farhan14031'
        IMAGE_TAG = "v${env.BUILD_NUMBER ?: '1'}"
    }

    stages {
        stage('Checkout') {
            steps {
                echo 'Checking out source repository...'
                checkout scm
            }
        }

        stage('Backend Test') {
            steps {
                script {
                    echo 'Starting throwaway MongoDB container for test suite...'
                    sh '''
                        docker run -d --name throwaway-test-mongo \
                            -p 27018:27017 \
                            -e MONGO_INITDB_ROOT_USERNAME=upwatch_admin \
                            -e MONGO_INITDB_ROOT_PASSWORD=throwaway_test_password \
                            -e MONGO_INITDB_DATABASE=upwatch_test \
                            mongo:7.0

                        # Wait for MongoDB to become ready
                        attempts=0
                        until docker exec throwaway-test-mongo mongosh --eval "db.adminCommand({ ping: 1 })" --quiet >/dev/null 2>&1 || [ $attempts -ge 15 ]; do
                            sleep 1
                            attempts=$((attempts + 1))
                        done

                        if [ $attempts -ge 15 ]; then
                            echo "Throwaway MongoDB failed to become healthy"
                            docker logs throwaway-test-mongo
                            exit 1
                        fi

                        echo "Throwaway MongoDB is healthy on port 27018"
                    '''

                    echo 'Running backend test suite...'
                    sh '''
                        cd backend
                        npm ci
                        MONGO_ROOT_USER=upwatch_admin \
                        MONGO_ROOT_PASSWORD=throwaway_test_password \
                        MONGO_PORT=27018 \
                        MONGO_DB=upwatch_test \
                        JWT_SECRET=super_secret_test_jwt_key_with_at_least_32_characters \
                        NODE_ENV=test \
                        npm test
                    '''
                }
            }
            post {
                always {
                    echo 'Cleaning up throwaway MongoDB container...'
                    sh 'docker rm -f throwaway-test-mongo || true'
                }
            }
        }

        stage('Frontend Build') {
            steps {
                echo 'Building frontend distribution assets...'
                sh '''
                    cd frontend
                    npm ci
                    npm run build
                '''
            }
        }

        stage('Build Images') {
            steps {
                echo 'Building production Docker images...'
                sh '''
                    docker compose build
                '''
            }
        }

        stage('Push to Registry') {
            when {
                expression { return params.PUSH_IMAGES }
            }
            steps {
                echo 'Logging in to Docker Hub and pushing images...'
                withCredentials([usernamePassword(
                    credentialsId: env.DOCKERHUB_CREDENTIALS_ID,
                    usernameVariable: 'DOCKER_USER',
                    passwordVariable: 'DOCKER_PASS'
                )]) {
                    sh '''
                        echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin
                        docker push "${IMAGE_NAMESPACE}/upwatch-api:v1"
                        docker push "${IMAGE_NAMESPACE}/upwatch-worker:v1"
                        docker push "${IMAGE_NAMESPACE}/upwatch-frontend:v1"
                        docker logout
                    '''
                }
            }
        }

        stage('Deploy Stack') {
            when {
                expression { return params.DEPLOY_STACK }
            }
            steps {
                echo 'Deploying UpWatch Docker Compose stack...'
                sh '''
                    # Generate certificates if missing
                    if [ ! -f "nginx/certs/selfsigned.crt" ]; then
                        powershell.exe -ExecutionPolicy Bypass -File scripts/gen-cert.ps1 || \
                        ./scripts/gen-cert.sh || true
                    fi
                    docker compose up -d
                '''
            }
        }
    }

    post {
        success {
            echo "Pipeline completed successfully."
        }
        failure {
            echo "Pipeline failed."
        }
    }
}
