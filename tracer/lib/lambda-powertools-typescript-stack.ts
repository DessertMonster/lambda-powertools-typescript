import * as path from 'path';
import { Construct } from 'constructs';
import { Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { AwsIntegration, LambdaIntegration, RestApi } from 'aws-cdk-lib/aws-apigateway';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { POWERTOOLS_SERVICE_NAME } from '../shared/constants';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Code, LayerVersion, Runtime, Tracing } from 'aws-cdk-lib/aws-lambda';
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Effect, Policy, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';

export class LambdaPowertoolsTypescriptStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const packageCodePath = path.resolve(__dirname, path.join('..', 'src', 'layers', 'packages'));
    const packagesLayer = new LayerVersion(this, 'packages-layer', {
      compatibleRuntimes: [Runtime.NODEJS_16_X],
      code: Code.fromAsset(packageCodePath),
      description: 'npm packages layer',
      layerVersionName: 'packages-layer',
      removalPolicy: RemovalPolicy.RETAIN,
    });
    const powertoolsLayer = LayerVersion.fromLayerVersionArn(
      this,
      'powertools-layer',
      `arn:aws:lambda:${Stack.of(this).region}:094274105915:layer:AWSLambdaPowertoolsTypeScript:5`
    );

    const lambdaPowertoolsMiddyFunction = new NodejsFunction(this, 'lambda-powertools-middy', {
      bundling: {
        externalModules: [
          '@amaabca/sensitive-param-filter',
          '@aws-lambda-powertools/commons',
          '@aws-lambda-powertools/logger',
          '@aws-lambda-powertools/metrics',
          '@aws-lambda-powertools/tracer',
          '@aws-sdk/client-secrets-manager',
          '@aws-sdk/client-ssm',
        ],
      },
      entry: path.join(__dirname, '/../src/lambdas/powertoolsMiddy/index.ts'),
      environment: {
        POWERTOOLS_SERVICE_NAME: POWERTOOLS_SERVICE_NAME.middy,
      },
      functionName: POWERTOOLS_SERVICE_NAME.middy,
      handler: 'handler',
      logRetention: RetentionDays.ONE_WEEK,
      memorySize: 128,
      runtime: Runtime.NODEJS_16_X,
      timeout: Duration.seconds(10),
      tracing: Tracing.ACTIVE,
      layers: [packagesLayer, powertoolsLayer],
    });

    const lambdaPowertoolsMiddyFunctionIntegration = new LambdaIntegration(
      lambdaPowertoolsMiddyFunction,
      {
        requestTemplates: { 'application/json': '{ "statusCode": "200" }' },
      }
    );

    const messagesDbTableName = 'messagesFromHttpBin';
    const messagesDbTable = new Table(this, `lambda-powertools-dynamodb`, {
      billingMode: BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: false,
      removalPolicy: RemovalPolicy.DESTROY,
      partitionKey: {
        name: 'id',
        type: AttributeType.STRING,
      },
      tableName: messagesDbTableName,
    });

    const putItemPolicy = new Policy(this, 'putItemPolicy', {
      statements: [
        new PolicyStatement({
          actions: ['dynamodb:PutItem'],
          effect: Effect.ALLOW,
          resources: [messagesDbTable.tableArn],
        }),
      ],
    });
    const putItemRole = new Role(this, 'putItemRole', {
      assumedBy: new ServicePrincipal('apigateway.amazonaws.com'),
    });
    putItemRole.attachInlinePolicy(putItemPolicy);

    const api = new RestApi(this, 'lambda-powertools-api', {
      description: 'This is the Lambda Powertools API Gateway.',
      deployOptions: {
        tracingEnabled: true,
      },
      restApiName: 'lambda-powertools-api',
    });
    api.applyRemovalPolicy(RemovalPolicy.DESTROY);

    const apiKeyName = 'PowertoolsApiKey';

    const apiKey = api.addApiKey('ApiKey', {
      apiKeyName,
    });

    const apiPlanName = 'PowertoolsApiUsagePlan';
    const plan = api.addUsagePlan(apiPlanName, { name: apiPlanName });
    plan.addApiStage({
      stage: api.deploymentStage,
    });
    plan.addApiKey(apiKey);

    new StringParameter(this, 'ApiUrl', {
      parameterName: `/lambda-powertools-typescript/API_URL`,
      stringValue: api.url,
    });

    const getSsmParameterPolicyStatement = new PolicyStatement({
      actions: ['secretsmanager:GetSecretValue', 'ssm:GetParameter'],
      effect: Effect.ALLOW,
      resources: [
        `arn:aws:secretsmanager:${props?.env?.region}:${props?.env?.account}:secret:PowertoolsApiKeySecret*`,
        `arn:aws:ssm:${props?.env?.region}:${props?.env?.account}:parameter/lambda-powertools-typescript/API_URL`,
      ],
    });

    lambdaPowertoolsMiddyFunction.addToRolePolicy(getSsmParameterPolicyStatement);

    const errorResponses = [
      {
        selectionPattern: '400',
        statusCode: '400',
        responseTemplates: {
          'application/json': `{
            "error": "Bad input"
          }`,
        },
      },
      {
        selectionPattern: '5\\d{2}',
        statusCode: '500',
        responseTemplates: {
          'application/json': `{
            "error": "Internal Service Error"
          }`,
        },
      },
    ];
    const integrationResponses = [
      {
        statusCode: '200',
        responseTemplate: {
          'application/json': `{
            "message": "The message was saved successfully"
          }`,
        },
      },
      ...errorResponses,
    ];

    const dynamoDbCreateIntegration = new AwsIntegration({
      action: 'PutItem',
      options: {
        credentialsRole: putItemRole,
        integrationResponses,
        requestTemplates: {
          'application/json': `{
              "Item": {
                "createdAt": {
                  "N": "$input.path('$.createdAt')"
                },
                "id": {
                  "S": "$input.path('$.id')"
                },
                "message": {
                  "S": "$input.path('$.message')"
                }
              },
              "TableName": "${messagesDbTableName}"
            }`,
        },
      },
      service: 'dynamodb',
    });

    const middyResource = api.root.addResource('middy');
    middyResource.addMethod('GET', lambdaPowertoolsMiddyFunctionIntegration, {
      apiKeyRequired: true,
    });

    const methodOptions = {
      apiKeyRequired: true,
      methodResponses: [{ statusCode: '200' }, { statusCode: '400' }, { statusCode: '500' }],
    };
    middyResource
      .addResource('message')
      .addMethod('POST', dynamoDbCreateIntegration, methodOptions);
  }
}
