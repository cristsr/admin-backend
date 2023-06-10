import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map, Observable, tap } from 'rxjs';
import { isArray, isEmpty } from 'lodash';

@Injectable()
export class RequestInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    console.log('RequestInterceptor');

    return next.handle().pipe(
      map((result) =>
        !isArray(result) && isEmpty(result)
          ? null
          : result
          ? isArray(result.data)
            ? result.data
            : result
          : null
      ),
      tap(console.log)
    );
  }
}
