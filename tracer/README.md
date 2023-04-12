# AWS Lambda Powertools for TypeScript - Tracer Demo

This is a CDK app that deploys a AWS Lambda function that demonstrates the usage of the Tracer utility of AWS Lambda Powertools for TypeScript.

## Getting Started

### 1. Install CDK dependencies

```bash
npm install
```

### 2. Build the project

```bash
npm run build
```

### 3. Deploy CDK

```bash
npx cdk deploy --all --require-approval never --profile AWS_PROFILE_NAME
```

### 4. Get API Gateway API key to test API endpoints in Postman

```bash
aws apigateway get-api-keys --name-query PowertoolsApiKey --include-values --profile AWS_PROFILE_NAME
```

### 5. Save API key to Secrets Manager

```bash
aws apigateway get-api-keys --name-query PowertoolsApiKey --include-values --profile AWS_PROFILE_NAME | \
jq '.items[0].value' | \
xargs -I {} aws secretsmanager create-secret --name PowertoolsApiKeySecret --secret-string {} --profile AWS_PROFILE_NAME
```
