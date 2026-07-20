import {
  ArgumentsHost,
  Catch,
  HttpException,
  ExceptionFilter as IExceptionFilter,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { DomainException } from '../exceptions';
import { ObjectLiteral } from '../types';
import { ErrorResponseBody } from './error-response-body.type';

/** Turns any thrown error into the standard HTTP error body. */
@Catch()
export class ExceptionFilter implements IExceptionFilter {
  #logger = new Logger(ExceptionFilter.name);

  catch(exception: Error, host: ArgumentsHost): void {
    this.#logger.error(`${exception.name}: ${exception.message}`);

    const httpException = this.toHttpException(exception);
    const http = host.switchToHttp();

    const body: ErrorResponseBody = {
      statusCode: httpException.getStatus(),
      error: exception.name,
      message: httpException.message,
      code: exception instanceof DomainException ? exception.code : undefined,
      path: http.getRequest()?.url,
      timestamp: new Date().toISOString(),
    };

    http.getResponse().status(body.statusCode).json(this.compact(body));
  }

  // Domain exceptions carry their own HTTP status; otherwise they became 500.
  private toHttpException(exception: Error): HttpException {
    if (exception instanceof HttpException) {
      return exception;
    }

    if (exception instanceof DomainException) {
      return new HttpException(exception.message, exception.status);
    }

    return new InternalServerErrorException(exception.message);
  }

  private compact(body: ErrorResponseBody): ObjectLiteral {
    return Object.fromEntries(
      Object.entries(body).filter(([, value]) => value !== undefined),
    );
  }
}
