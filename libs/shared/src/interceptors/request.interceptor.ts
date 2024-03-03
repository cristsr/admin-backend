import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { isArray, isEmpty } from 'lodash';
import { Observable, map } from 'rxjs';

@Injectable()
export class RequestInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next
      .handle()
      .pipe(
        map((result) =>
          !isArray(result) && isEmpty(result)
            ? null
            : result
            ? isArray(result.data)
              ? result.data
              : result
            : null
        )
      );
  }
}
