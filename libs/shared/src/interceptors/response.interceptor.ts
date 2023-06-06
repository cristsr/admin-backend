import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map, Observable, tap } from 'rxjs';
import { instanceToPlain } from 'class-transformer';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      // return always an object to send via grpc
      map((data) => (data ? (Array.isArray(data) ? { data } : data) : {})),
      tap(console.log),
      map((res) => instanceToPlain(res))
    );
  }
}
