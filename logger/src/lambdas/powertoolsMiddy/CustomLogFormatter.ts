import { LogFormatter } from '@aws-lambda-powertools/logger';
import {
  LogAttributes,
  LogLevel,
  UnformattedAttributes,
} from '@aws-lambda-powertools/logger/lib/types';

type LogAttributesWithContext = LogAttributes & {
  awsRegion: string;
  timestamp: string;
  serviceName: string;
  logLevel: LogLevel;
  lambda: {
    awsRequestId: string;
    name: string;
    coldStart: boolean;
  };
  message: string;
};

enum logLevelIcon {
  DEBUG = '🐛',
  INFO = 'ℹ️',
  WARN = '⚠️',
  ERROR = '🚨',
  CRITICAL = '🔥',
  SILENT = '',
}

class CustomErrorFormatter extends LogFormatter {
  public formatAttributes(attributes: UnformattedAttributes): LogAttributesWithContext {
    const uppercaseLogLevel = attributes.logLevel
      .toString()
      .toUpperCase() as keyof typeof logLevelIcon;
    return {
      awsRegion: attributes.awsRegion,
      timestamp: this.formatTimestamp(attributes.timestamp),
      serviceName: attributes.serviceName,
      logLevel: attributes.logLevel,
      lambda: {
        awsRequestId: attributes.lambdaContext!.awsRequestId,
        name: attributes.lambdaContext!.functionName,
        coldStart: attributes.lambdaContext!.coldStart,
      },
      message: `${logLevelIcon[uppercaseLogLevel]} ${uppercaseLogLevel}: ${attributes.message}`,
    };
  }
}

export { CustomErrorFormatter };
