import { CallHandler, ExecutionContext, HttpStatus, Injectable, NestInterceptor } from '@nestjs/common';
import { CommandResult } from '@cqrs/application/command-bus/command-result.type';
import { Nullable } from '@shared';
import { Response } from 'express';
import { Observable, map } from 'rxjs';
import { CommandAcceptedDto } from './dto/command-accepted.dto';

/** Response header exposing the stream position a write reached. */
export const STREAM_POSITION_HEADER = 'X-Ledger-Stream-Position';

/** Response header present, and only present, when the write was an idempotent replay (AC-7). */
export const IDEMPOTENCY_HIT_HEADER = 'Idempotency-Hit';

/**
 * Structural guard: a value is a command result when it carries a `bigint`
 * stream position and the replay flag. `streamPosition` is a `bigint` in the
 * real core to avoid precision loss on large streams.
 */
function isCommandResult(value: unknown): value is CommandResult {
  const candidate = value as Nullable<CommandResult>;
  return typeof candidate?.streamPosition === 'bigint' && typeof candidate?.idempotentReplay === 'boolean';
}

/**
 * Turns the {@link CommandResult} a write handler returns into the standard
 * {@link CommandAcceptedDto}, and applies the two read-your-writes concerns
 * transversally: it stamps the stream position onto the response header
 * and downgrades an idempotent replay (INV-10) to `200`, since a replay creates
 * nothing new. Read handlers return projections, not command results, so they
 * pass through untouched.
 */
@Injectable()
export class CommandResultInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((value) => this.finalize(value, context)));
  }

  private finalize(value: unknown, context: ExecutionContext): unknown {
    if (!isCommandResult(value)) return value;

    const response = context.switchToHttp().getResponse<Response>();
    response.setHeader(STREAM_POSITION_HEADER, String(value.streamPosition));

    if (value.idempotentReplay) {
      response.setHeader(IDEMPOTENCY_HIT_HEADER, 'true');
      response.status(HttpStatus.OK);
    }

    return CommandAcceptedDto.from(value);
  }
}
