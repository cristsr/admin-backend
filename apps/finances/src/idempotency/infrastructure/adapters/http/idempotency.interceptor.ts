import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, firstValueFrom, from } from 'rxjs';
import {
  IdempotencyConflictException,
  IdempotencyInProgressException,
  IdempotencyRepository,
  IdempotencyStatus,
} from '@app/idempotency/domain/idempotency-key';
import { hashRequestBody } from './idempotency-hash';

const IDEMPOTENCY_HEADER = 'idempotency-key';
const RETENTION_MS = 24 * 60 * 60 * 1000;

/**
 * Makes a write endpoint idempotent: replays the stored response for a repeated
 * key + body; rejects a different body (422) or a key still in progress (409).
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  #logger = new Logger(IdempotencyInterceptor.name);

  constructor(private readonly idempotencyRepository: IdempotencyRepository) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const key = request.headers?.[IDEMPOTENCY_HEADER];

    if (!key) {
      return next.handle();
    }

    return from(this.handleIdempotent(context, next, key));
  }

  private async handleIdempotent(
    context: ExecutionContext,
    next: CallHandler,
    key: string,
  ): Promise<unknown> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const requestHash = hashRequestBody(request.body);
    const endpoint = `${request.method} ${request.route?.path ?? request.url}`;

    const { created, row } = await this.idempotencyRepository.reserve({
      idempotencyKey: key,
      userId: request.user?.id,
      endpoint,
      requestHash,
      expiresAt: new Date(Date.now() + RETENTION_MS),
    });

    if (!created) {
      if (row.requestHash !== requestHash) {
        throw new IdempotencyConflictException(
          'Idempotency-Key already used with a different request body',
        );
      }

      if (row.status === IdempotencyStatus.PENDING) {
        throw new IdempotencyInProgressException(
          'A request with this Idempotency-Key is still in progress',
        );
      }

      response.status(row.responseStatus);
      return row.responseBody;
    }

    return this.runAndStore(next, row.id, response);
  }

  /** Gives the key back when the handler fails, so retries aren't stuck on 409. */
  private async runAndStore(
    next: CallHandler,
    rowId: number,
    response: { statusCode: number },
  ): Promise<unknown> {
    try {
      const body = await firstValueFrom(next.handle());
      await this.idempotencyRepository.complete(
        rowId,
        response.statusCode,
        body,
      );
      return body;
    } catch (error) {
      await this.release(rowId);
      throw error;
    }
  }

  /** Best-effort: never masks the original failure; the expiry sweep removes leftovers. */
  private async release(rowId: number): Promise<void> {
    try {
      await this.idempotencyRepository.release(rowId);
    } catch (error) {
      this.#logger.error(
        `Could not release idempotency reservation ${rowId}: ${
          (error as Error).message
        }`,
      );
    }
  }
}
