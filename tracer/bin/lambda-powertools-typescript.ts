#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { LambdaPowertoolsTypescriptStack } from '../lib/lambda-powertools-typescript-stack';
import { REGION } from '../shared';

const app = new cdk.App();
new LambdaPowertoolsTypescriptStack(app, 'LambdaPowertoolsTypescriptStack', {
  env: {
    region: process.env.CDK_DEFAULT_REGION ?? REGION,
    account: process.env.CDK_DEFAULT_ACCOUNT ?? '',
  },
});
