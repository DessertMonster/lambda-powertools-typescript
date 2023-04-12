# AWS Lambda Powertools for TypeScript - Logger Demo

This is a CDK app that deploys a AWS Lambda function that demonstrates the usage of the Logger utility of AWS Lambda Powertools for TypeScript.

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

### 4. Send the sample SQS messages to see structured logs in CloudWatch

```bash
aws sqs list-queues --profile AWS_PROFILE_NAME | \
jq '.QueueUrls[0]' | \
xargs -I {} aws sqs send-message-batch --queue-url {} --entries file://sample-sqs-messages.json --profile AWS_PROFILE_NAME
```
