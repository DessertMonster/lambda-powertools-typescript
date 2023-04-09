import middy from '@middy/core';
import { SQSEvent, SQSRecord } from 'aws-lambda';
import { Logger, injectLambdaContext } from '@aws-lambda-powertools/logger';
import { CustomErrorFormatter } from './CustomLogFormatter';

const logger = new Logger({
  logFormatter: new CustomErrorFormatter(),
});

const lambdaHandler = async ({ Records }: SQSEvent): Promise<void> => {
  try {
    logSqsMessages(Records);
    throw new Error('Sample message thrown');
  } catch (error) {
    if (error instanceof Error) {
      logger.debug(`${error.message}`, error);
      logger.warn(`${error.message}`, error);
      logger.error(`${error.message}`, error);
      logger.critical(`${error.message}`, error);
      logger.critical(`${error.message} with custom key`, { critical: error });
    }
  }
};

const logSqsMessages = (Records: SQSRecord[]) => {
  const batchedMessages: { messageId: string; body: string }[] = [];
  Records.forEach(({ body, messageId }: SQSRecord) => {
    batchedMessages.push({ messageId, body });
  });
  logger.info(`${Records.length} SQS messages received.`, { sqsEvents: batchedMessages });
};

export const handler = middy(lambdaHandler).use(injectLambdaContext(logger, { logEvent: true }));
