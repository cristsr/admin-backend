import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { Nullable } from '@shared';
import { Request } from 'express';

/** Header carrying the idempotency key; preferred over the body for automated clients. */
export const EXTERNAL_REF_HEADER = 'x-external-ref';

/**
 * Pure extraction of the `external_ref` idempotency key (INV-10): the
 * `X-External-Ref` header wins, falling back to `external_ref` in the body, and
 * `null` when neither is a non-blank string. Exported for direct unit testing.
 */
export function extractExternalRef(ctx: ExecutionContext): Nullable<string> {
  const request = ctx.switchToHttp().getRequest<Request>();

  const header = request.headers[EXTERNAL_REF_HEADER];
  if (typeof header === 'string' && header.trim()) return header.trim();

  const body = request.body as Nullable<{ external_ref?: unknown }>;
  const fromBody = body?.external_ref;
  if (typeof fromBody === 'string' && fromBody.trim()) return fromBody.trim();

  return null;
}

/**
 * Extracts the `external_ref` idempotency key uniformly. The controller only
 * transports it to the command; the `EventStore` owns the idempotency semantics.
 */
export const ExternalRef = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Nullable<string> => extractExternalRef(ctx),
);
