import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { instanceToPlain } from 'class-transformer';
import { Observable, map } from 'rxjs';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      // return always an object to send via grpc
      map((res) => instanceToPlain(res)),
      map((data) => (data ? (Array.isArray(data) ? { data } : data) : {}))
    );
  }
}
