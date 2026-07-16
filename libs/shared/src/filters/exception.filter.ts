import {
  ArgumentsHost,
  Catch,
  HttpException,
  ExceptionFilter as IExceptionFilter,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { DomainException } from '../exceptions';
import { getExceptionResponse } from '../functions';

@Catch()
export class ExceptionFilter implements IExceptionFilter {
  #logger = new Logger(ExceptionFilter.name);

  catch(exception: Error, host: ArgumentsHost): void {
    this.#logger.error(`${exception.name}: ${exception.message}`);

    const httpException = this.toHttpException(exception);

    const response = host.switchToHttp().getResponse();
    response
      .status(httpException.getStatus())
      .json(getExceptionResponse(httpException));
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
}
