import { Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { getResponse } from '../functions';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  #logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException): Observable<never> | void {
    this.#logger.error(`${exception.name}: ${exception.message}`);
    return throwError(() => getResponse(exception));
  }
}
