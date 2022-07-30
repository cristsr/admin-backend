import {
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { status } from '@grpc/grpc-js';
import { Observable, throwError } from 'rxjs';
import { HttpToGrpcExceptionMap } from '../exceptions';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException): Observable<never> | void {
    const httpStatus = exception.getStatus();
    const httpRes = exception.getResponse() as { details?: unknown };

    return throwError(() => ({
      code: HttpToGrpcExceptionMap[httpStatus] ?? status.UNKNOWN,
      message: exception.message,
      details: Array.isArray(httpRes.details) ? httpRes.details : [httpRes],
    }));
  }
}
