import axios from 'axios';
import { getBodyMessage, MessageType } from '.';

let response = {
  body: 'This is the default error message.',
  statusCode: 500,
};

export const getAxiosError = (error: unknown) => {
  if (!axios.isAxiosError(error)) {
    return response;
  }

  const errorToShow = error.response?.statusText ?? error.message;
  const statusCode = error.response?.status ?? 500;
  return {
    body: JSON.stringify({
      message: getBodyMessage(MessageType.Failure, errorToShow),
    }),
    statusCode,
  };
};
