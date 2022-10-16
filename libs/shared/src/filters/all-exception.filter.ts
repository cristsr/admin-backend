import { ArgumentsHost, Catch, HttpException, Logger } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';

@Catch()
export class AllExceptionFilter extends BaseExceptionFilter {
  #logger = new Logger(AllExceptionFilter.name);

  catch(exception: any, host: ArgumentsHost) {
    this.#logger.debug('Host type: ' + host.getType());

    console.debug(exception);
    console.debug(exception.constructor);

    // Handling http exception
    if (exception instanceof HttpException) {
      return super.catch(exception, host);
    }

    // const Exception =
    //   GrpcToHttpExceptionMap[exception.code] ?? InternalServerErrorException;

    return super.catch(exception, host);
  }
}
