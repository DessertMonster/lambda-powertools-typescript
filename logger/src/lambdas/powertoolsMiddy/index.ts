import middy from '@middy/core';
import { Logger, injectLambdaContext } from '@aws-lambda-powertools/logger';
import { SQSEvent, SQSRecord } from 'aws-lambda';
import { CustomErrorFormatter } from './CustomLogFormatter';

const logger = new Logger({
  logFormatter: new CustomErrorFormatter(),
});

const lambdaHandler = async ({ Records }: SQSEvent): Promise<string> => {
  let result = '';
  try {
    logger.debug('This is a debugging message which only shows in staging.');
    logger.info('Logger utility reporting for duty.');
    logger.warn('This is a warning.');
    logger.critical('Something critical happened');
    // Uncomment next line to skip processing SQS messages and throw an error
    // throw new Error('Sample message thrown');
    logSqsMessages(Records);
    result = `✅ ${Records.length} SQS records processed.`;
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`${error.message} with a custom key`, { customKey: error });
    }
    result = '❌ No SQS record processed.';
  } finally {
    result.charAt(0) === '✅' ? logger.info(result) : logger.error(result);
    return result;
  }
};

const logSqsMessages = (Records: SQSRecord[]) => {
  const batchedMessages: { messageId: string; body: string }[] = [];
  Records.forEach(({ body, messageId }: SQSRecord) => {
    batchedMessages.push({ messageId, body });
  });
  logger.debug(`${Records.length} SQS messages received.`, { sqsEvents: batchedMessages });
};

export const handler = middy(lambdaHandler).use(injectLambdaContext(logger, { logEvent: true }));
