#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { LambdaPowertoolsTypescriptLoggerStack } from '../lib/lambda-powertools-typescript-logger-stack';

const app = new cdk.App();
new LambdaPowertoolsTypescriptLoggerStack(app, 'LambdaPowertoolsTypescriptLoggerStack', {
  tags: {
    // Change environment to 'production' to only show 'warn', 'error', and 'critical' items
    environment: 'staging',
  },
});
