import * as cdk from 'aws-cdk-lib';
import * as path from 'path';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Code, LayerVersion, Runtime } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { POWERTOOLS_SERVICE_NAME } from '../shared/constants';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';

type LoggerStackProps = cdk.StackProps & {
  tags: {
    environment: 'staging' | 'production';
  };
};

export class LambdaPowertoolsTypescriptLoggerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: LoggerStackProps) {
    super(scope, id, props);

    const env = props?.tags.environment ?? 'staging';

    const loggerQueue = new sqs.Queue(this, 'logger-queue', {
      queueName: 'logger-queue',
    });
    const loggerEventSource = new SqsEventSource(loggerQueue, {
      reportBatchItemFailures: true,
    });

    const powertoolsLayer = LayerVersion.fromLayerVersionArn(
      this,
      'powertools-layer',
      `arn:aws:lambda:${
        cdk.Stack.of(this).region
      }:094274105915:layer:AWSLambdaPowertoolsTypeScript:11`
    );

    const packageCodePath = path.resolve(__dirname, path.join('..', 'src', 'layers', 'packages'));
    const packagesLayer = new LayerVersion(this, 'logger-packages-layer', {
      compatibleRuntimes: [Runtime.NODEJS_16_X],
      code: Code.fromAsset(packageCodePath),
      description: 'npm packages layer',
      layerVersionName: 'logger-packages-layer',
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const lambdaPowertoolsMiddyFunction = new NodejsFunction(
      this,
      'lambda-powertools-middy-logger',
      {
        bundling: {
          externalModules: ['@aws-lambda-powertools/logger', '@middy/core'],
        },
        entry: path.join(__dirname, '/../src/lambdas/powertoolsMiddy/index.ts'),
        environment: {
          LOG_LEVEL: env === 'staging' ? 'DEBUG' : 'WARN',
          POWERTOOLS_LOGGER_LOG_EVENT: 'true',
          POWERTOOLS_SERVICE_NAME: `${POWERTOOLS_SERVICE_NAME.middy}-${env}`,
        },
        functionName: `${POWERTOOLS_SERVICE_NAME.middy}-logger-${env}`,
        handler: 'handler',
        layers: [packagesLayer, powertoolsLayer],
        logRetention: RetentionDays.ONE_WEEK,
        memorySize: 128,
        runtime: Runtime.NODEJS_16_X,
        timeout: Duration.seconds(30),
      }
    );
    lambdaPowertoolsMiddyFunction.addEventSource(loggerEventSource);
  }
}
