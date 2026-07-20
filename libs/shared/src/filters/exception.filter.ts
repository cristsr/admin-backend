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

/** The body every failed request answers with, whatever went wrong. */
export interface ErrorResponseBody {
  statusCode: number;
  /** Class of the failure, e.g. `AccountNotFoundException`. */
  error: string;
  message: string;
  /** Domain code, when the failure carries one, so clients can branch on it. */
  code?: string;
  path: string;
  timestamp: string;
}

/**
 * Turns anything thrown into a single HTTP error shape. It used to emit a gRPC
 * status envelope (`{ code: 10, metadata }`) left over from when these services
 * spoke gRPC — so every HTTP failure, a 404 included, answered with gRPC's
 * ABORTED code.
 */
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

  // Domain exceptions carry their own HTTP status; without this they fell
  // through to a generic 500 (a "not found" answered 500 instead of 404).
  private toHttpException(exception: Error): HttpException {
    if (exception instanceof HttpException) {
      return exception;
    }

    if (exception instanceof DomainException) {
      return new HttpException(exception.message, exception.status);
    }

    return new InternalServerErrorException(exception.message);
  }

  /** Keeps optional fields out of the payload entirely when they are absent. */
  private compact(body: ErrorResponseBody): ObjectLiteral {
    return Object.fromEntries(
      Object.entries(body).filter(([, value]) => value !== undefined),
    );
  }
}
