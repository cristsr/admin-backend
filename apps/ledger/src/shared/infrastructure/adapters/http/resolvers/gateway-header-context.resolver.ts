import { Injectable } from '@nestjs/common';
import { Nullable } from '@shared';
import { LedgerContextResolver, RequestHeaders } from '@ledger/shared/application/ports/ledger-context-resolver';
import { LedgerContext } from '@ledger/shared/domain/context/ledger-context';

/** Header names a trusted gateway injects after authenticating the caller. */
export const GATEWAY_CONTEXT_HEADER = {
  userId: 'x-user-id',
  clientId: 'x-client-id',
} as const;

/**
 * Default development adapter: a trusted gateway authenticates upstream and
 * forwards the identity as headers. Reads a single well-formed string per header;
 * anything missing or repeated (array) yields no context and the guard answers 401.
 */
@Injectable()
export class GatewayHeaderContextResolver extends LedgerContextResolver {
  resolve(headers: RequestHeaders): Nullable<LedgerContext> {
    const userId = this.single(headers[GATEWAY_CONTEXT_HEADER.userId]);
    const clientId = this.single(headers[GATEWAY_CONTEXT_HEADER.clientId]);

    if (!userId || !clientId) return null;

    return { userId, clientId };
  }

  /** A trusted header must be exactly one string; reject duplicates and blanks. */
  private single(value: string | string[] | undefined): Nullable<string> {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed;
  }
}
