import { isObject } from 'class-validator';
import { HttpException } from '@nestjs/common';

export const createHttpExceptionBody = (
  message: object | string,
  error?: string,
  statusCode?: number
) => {
  if (!message) {
    return { statusCode, error };
  }
  return isObject(message) && !Array.isArray(message)
    ? message
    : {
        statusCode,
        error,
        message,
      };
};

export const createHttpException = (status: number, defaultError = ''): any => {
  class CustomHttpException extends HttpException {
    public constructor(message?: string | object | any, error = defaultError) {
      super(createHttpExceptionBody(message, error, status), status);
    }
  }
  return CustomHttpException;
};
