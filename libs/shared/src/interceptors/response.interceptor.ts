import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { instanceToPlain } from 'class-transformer';
import { Observable, map } from 'rxjs';

/** gRPC payloads must be objects: empty becomes `{}`, lists wrap under `data`. */
function toGrpcObject(data: any): object {
  if (!data) return {};
  if (Array.isArray(data)) return { data };

  return data;
}

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((res) => instanceToPlain(res)),
      map(toGrpcObject),
    );
  }
}
