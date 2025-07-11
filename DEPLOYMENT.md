# Cloud Deployment Guide

This guide provides instructions for deploying the Resilient Email Service API to various cloud platforms.

## 🚀 Quick Start

### Local Development
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Test the API
node api-test.js
```

### Docker Deployment
```bash
# Build and run with Docker
docker-compose up --build

# Or build manually
docker build -t resilient-email-service .
docker run -p 3000:3000 resilient-email-service
```

## ☁️ Cloud Platform Deployments

### 1. Heroku Deployment

#### Prerequisites
- Heroku CLI installed
- Heroku account

#### Steps
```bash
# Login to Heroku
heroku login

# Create new app
heroku create your-app-name

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set MAX_RETRY_ATTEMPTS=3
heroku config:set INITIAL_RETRY_DELAY=1000
heroku config:set MAX_RETRY_DELAY=10000
heroku config:set RETRY_BACKOFF_MULTIPLIER=2
heroku config:set RATE_LIMIT_MAX_REQUESTS=10
heroku config:set RATE_LIMIT_TIME_WINDOW=60000
heroku config:set CIRCUIT_BREAKER_FAILURE_THRESHOLD=5
heroku config:set CIRCUIT_BREAKER_RECOVERY_TIMEOUT=30000
heroku config:set CIRCUIT_BREAKER_MONITORING_PERIOD=60000

# Deploy
git add .
git commit -m "Deploy to Heroku"
git push heroku main

# Open the app
heroku open
```

### 2. AWS Elastic Beanstalk

#### Prerequisites
- AWS CLI configured
- EB CLI installed

#### Steps
```bash
# Initialize EB application
eb init

# Create environment
eb create production

# Set environment variables
eb setenv NODE_ENV=production
eb setenv MAX_RETRY_ATTEMPTS=3
eb setenv INITIAL_RETRY_DELAY=1000
eb setenv MAX_RETRY_DELAY=10000
eb setenv RETRY_BACKOFF_MULTIPLIER=2
eb setenv RATE_LIMIT_MAX_REQUESTS=10
eb setenv RATE_LIMIT_TIME_WINDOW=60000
eb setenv CIRCUIT_BREAKER_FAILURE_THRESHOLD=5
eb setenv CIRCUIT_BREAKER_RECOVERY_TIMEOUT=30000
eb setenv CIRCUIT_BREAKER_MONITORING_PERIOD=60000

# Deploy
eb deploy

# Open the app
eb open
```

### 3. Google Cloud Run

#### Prerequisites
- Google Cloud CLI installed
- Docker installed

#### Steps
```bash
# Set project
gcloud config set project YOUR_PROJECT_ID

# Build and push image
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/resilient-email-service

# Deploy to Cloud Run
gcloud run deploy resilient-email-service \
  --image gcr.io/YOUR_PROJECT_ID/resilient-email-service \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production,MAX_RETRY_ATTEMPTS=3,INITIAL_RETRY_DELAY=1000,MAX_RETRY_DELAY=10000,RETRY_BACKOFF_MULTIPLIER=2,RATE_LIMIT_MAX_REQUESTS=10,RATE_LIMIT_TIME_WINDOW=60000,CIRCUIT_BREAKER_FAILURE_THRESHOLD=5,CIRCUIT_BREAKER_RECOVERY_TIMEOUT=30000,CIRCUIT_BREAKER_MONITORING_PERIOD=60000
```

### 4. Azure App Service

#### Prerequisites
- Azure CLI installed
- Azure account

#### Steps
```bash
# Login to Azure
az login

# Create resource group
az group create --name resilient-email-rg --location eastus

# Create app service plan
az appservice plan create --name resilient-email-plan --resource-group resilient-email-rg --sku B1 --is-linux

# Create web app
az webapp create --name resilient-email-service --resource-group resilient-email-rg --plan resilient-email-plan --runtime "NODE|18-lts"

# Set environment variables
az webapp config appsettings set --name resilient-email-service --resource-group resilient-email-rg --settings NODE_ENV=production MAX_RETRY_ATTEMPTS=3 INITIAL_RETRY_DELAY=1000 MAX_RETRY_DELAY=10000 RETRY_BACKOFF_MULTIPLIER=2 RATE_LIMIT_MAX_REQUESTS=10 RATE_LIMIT_TIME_WINDOW=60000 CIRCUIT_BREAKER_FAILURE_THRESHOLD=5 CIRCUIT_BREAKER_RECOVERY_TIMEOUT=30000 CIRCUIT_BREAKER_MONITORING_PERIOD=60000

# Deploy from local git
az webapp deployment source config-local-git --name resilient-email-service --resource-group resilient-email-rg
git remote add azure <git-url-from-previous-command>
git push azure main
```

### 5. DigitalOcean App Platform

#### Prerequisites
- DigitalOcean account
- doctl CLI installed

#### Steps
```bash
# Authenticate
doctl auth init

# Create app specification (app.yaml)
# Deploy using DigitalOcean console or CLI
doctl apps create --spec app.yaml
```

## 🔧 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |
| `NODE_ENV` | production | Environment mode |
| `MAX_RETRY_ATTEMPTS` | 3 | Maximum retry attempts |
| `INITIAL_RETRY_DELAY` | 1000 | Initial retry delay (ms) |
| `MAX_RETRY_DELAY` | 10000 | Maximum retry delay (ms) |
| `RETRY_BACKOFF_MULTIPLIER` | 2 | Exponential backoff multiplier |
| `RATE_LIMIT_MAX_REQUESTS` | 10 | Max requests per time window |
| `RATE_LIMIT_TIME_WINDOW` | 60000 | Rate limit time window (ms) |
| `CIRCUIT_BREAKER_FAILURE_THRESHOLD` | 5 | Circuit breaker failure threshold |
| `CIRCUIT_BREAKER_RECOVERY_TIMEOUT` | 30000 | Circuit breaker recovery timeout (ms) |
| `CIRCUIT_BREAKER_MONITORING_PERIOD` | 60000 | Circuit breaker monitoring period (ms) |
| `LOG_LEVEL` | INFO | Logging level |

## 📊 Monitoring & Health Checks

### Health Check Endpoint
```bash
GET /health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600,
  "version": "1.0.0",
  "services": {
    "emailService": true,
    "providers": {
      "ReliableProvider": true,
      "UnreliableProvider": true,
      "SlowProvider": true,
      "FailingProvider": false
    }
  }
}
```

### Service Statistics
```bash
GET /api/stats
```

## 🔒 Security Considerations

1. **Rate Limiting**: API endpoints are rate-limited to prevent abuse
2. **CORS**: Configured for cross-origin requests
3. **Helmet**: Security headers enabled
4. **Input Validation**: All inputs are validated
5. **Error Handling**: Comprehensive error handling without exposing internals

## 📈 Scaling Considerations

1. **Horizontal Scaling**: Stateless design allows horizontal scaling
2. **Load Balancing**: Use load balancers for multiple instances
3. **Database**: Consider persistent storage for production (Redis, PostgreSQL)
4. **Monitoring**: Implement proper monitoring and alerting
5. **Logging**: Centralized logging for distributed deployments

## 🧪 Testing the Deployment

After deployment, test the API:

```bash
# Health check
curl https://your-app-url/health

# Send email
curl -X POST https://your-app-url/api/emails \
  -H "Content-Type: application/json" \
  -d '{
    "to": "test@example.com",
    "from": "noreply@example.com",
    "subject": "Test Email",
    "body": "This is a test email"
  }'

# Get stats
curl https://your-app-url/api/stats
```

## 🚨 Troubleshooting

### Common Issues

1. **Port Issues**: Ensure PORT environment variable is set correctly
2. **Memory Issues**: Monitor memory usage, consider increasing limits
3. **Timeout Issues**: Adjust timeout settings for your cloud provider
4. **CORS Issues**: Configure CORS settings for your domain

### Logs
```bash
# Heroku
heroku logs --tail

# AWS EB
eb logs

# Google Cloud Run
gcloud logs tail

# Azure
az webapp log tail --name resilient-email-service --resource-group resilient-email-rg
```

## 📝 Production Checklist

- [ ] Environment variables configured
- [ ] Health checks passing
- [ ] Monitoring and alerting set up
- [ ] Logging configured
- [ ] SSL/TLS enabled
- [ ] Rate limiting configured
- [ ] Backup strategy in place
- [ ] Documentation updated
- [ ] Team access configured 