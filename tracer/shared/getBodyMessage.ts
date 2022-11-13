import { dateFormatter } from './dateFormatter';

export enum MessageType {
  Failure = 'Failure',
  Success = 'Success',
}

export const getBodyMessage = (type: MessageType, response: string = '') => {
  const now = dateFormatter.format(Date.now());
  const httpResponse = response.length ? ` The HTTP response was ${response}.` : '';
  if (type === MessageType.Failure) {
    return `Powertools Lambda w/ Middy instrumentation failed at: ${now}.${httpResponse}`;
  }
  return `Powertools Lambda w/ Middy instrumentation successfuly invoked at: ${now}.${httpResponse}`;
};
