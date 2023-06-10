import {
  Catch,
  ExceptionFilter as IExceptionFilter,
  HttpException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { getExceptionResponse } from '../functions';

@Catch()
export class ExceptionFilter implements IExceptionFilter {
  #logger = new Logger(ExceptionFilter.name);

  catch(exception: Error): Observable<never> | void {
    console.log(exception);
    console.log(exception.stack);
    this.#logger.error(`${exception.name}: ${exception.message}`);

    return throwError(() => {
      if (exception instanceof HttpException) {
        return getExceptionResponse(exception);
      }

      return getExceptionResponse(
        new InternalServerErrorException(exception.message)
      );
    });
  }
}
