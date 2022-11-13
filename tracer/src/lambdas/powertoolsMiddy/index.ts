const { SPFDefaultParams, SensitiveParamFilter } = require('@amaabca/sensitive-param-filter');
import axios from 'axios';
import middy from '@middy/core';
import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { API_KEY_SECRET_ID, getBodyMessage, MessageType, REGION } from '../../common';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { Tracer, captureLambdaHandler } from '@aws-lambda-powertools/tracer';
import { getAxiosError } from '../../../shared/getAxiosError';

export type PowertoolsMiddyEvent = Pick<APIGatewayProxyEventV2, 'body' | 'headers'>;

const tracer = new Tracer();

const paramFilter = new SensitiveParamFilter({
  params: SPFDefaultParams.concat(['apiKey', 'x-api-key']),
});

const ssmClient = new SSMClient({ region: REGION });
const ssmCommand = new GetParameterCommand({ Name: '/lambda-powertools-typescript/API_URL' });
const apiUrlParameter = ssmClient.send(ssmCommand);

const secretsManagerClient = new SecretsManagerClient({ region: REGION });
const secretsManagerCommand = new GetSecretValueCommand({ SecretId: API_KEY_SECRET_ID });
const apiKeySecret = secretsManagerClient.send(secretsManagerCommand);

const lambdaHandler = async (event: PowertoolsMiddyEvent): Promise<APIGatewayProxyResultV2> => {
  console.info(paramFilter.filter(event));
  console.info('🔌 🛠 Powertools for TypeScript w/ Middy instrumentation');

  let response;

  try {
    const apiUrl = (await apiUrlParameter).Parameter?.Value;
    const apiKey = (await apiKeySecret).SecretString;

    if (apiUrl == null || apiKey == null) {
      throw new Error('Failed to get SSM parameter and/or Secrets Manager secret.');
    }

    const httpResponses = await Promise.allSettled([
      axios.get('https://httpbin.org/base64/TXIuIEVwaWMgc2F5cyBoaSDwn5Go8J+Pu+KAjfCfkrs='),
      axios.get('https://httpbin.org/uuid'),
      axios.get('https://httpbin.org/status/418'),
    ]);
    const [message, { uuid }] = httpResponses.map((result, index) => {
      if (result.status === 'fulfilled') {
        const { headers, data } = result.value;
        console.info(
          `✅ Result of call ${index + 1}:\n--Headers: ${headers['content-type']}\n--Status: ${
            result.status
          }\n--Response: ${JSON.stringify(data, null, 2)}\n\n`
        );
        return data;
      }
      const rootTraceId = tracer.getRootXrayTraceId();
      console.error(
        `🛑 Error of call ${index + 1}:\n--Status: ${result.status}\n--Reason: ${
          result.reason
        }\n--Trace ID: ${rootTraceId}\n\n`
      );
      tracer.putMetadata('apiFailureReason', result.reason);
      return result.reason;
    });

    const postResponse = await axios.post(
      `${apiUrl}middy/message`,
      {
        createdAt: Date.now(),
        id: uuid,
        message,
      },
      {
        headers: {
          'X-API-Key': apiKey,
        },
      }
    );

    response = {
      body: JSON.stringify({
        message:
          postResponse.status === 200
            ? getBodyMessage(MessageType.Success)
            : getBodyMessage(MessageType.Failure),
      }),
      statusCode: postResponse.status,
    };
  } catch (error) {
    console.error('🛑 ', error as Error);
    response = getAxiosError(error);
  }

  return response;
};

export const handler = middy(lambdaHandler).use(captureLambdaHandler(tracer));
