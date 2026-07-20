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
 * AC-3 (sm-0003) — makes a user write idempotent. On the first use of a key it
 * runs the handler and stores the response; a replay of the same key + body
 * returns the stored response, a different body is rejected (422), and a key
 * still in progress is rejected (409). Requests without the header pass through.
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

      // COMPLETED: replay the stored response verbatim.
      response.status(row.responseStatus);
      return row.responseBody;
    }

    return this.runAndStore(next, row.id, response);
  }

  /**
   * A failed handler must give the key back. Its work was rolled back, so
   * nothing is left to replay — and holding the reservation would answer every
   * retry of that key with 409 until the record expired a day later.
   */
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

  /**
   * Releasing is best-effort: it must never replace the failure the caller is
   * about to receive with one about our own bookkeeping. The expiry sweep
   * removes the row anyway if this does not.
   */
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
