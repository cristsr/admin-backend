import {
  ArgumentsHost,
  Catch,
  HttpException,
  ExceptionFilter as IExceptionFilter,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { getExceptionResponse } from '../functions';

@Catch()
export class ExceptionFilter implements IExceptionFilter {
  #logger = new Logger(ExceptionFilter.name);

  catch(exception: Error, host: ArgumentsHost): void {
    this.#logger.error(`${exception.name}: ${exception.message}`);

    const httpException =
      exception instanceof HttpException
        ? exception
        : new InternalServerErrorException(exception.message);

    const response = host.switchToHttp().getResponse();
    response
      .status(httpException.getStatus())
      .json(getExceptionResponse(httpException));
  }
}
