import { Request } from 'express';
import { LedgerContext } from '@ledger/shared/domain/context/ledger-context';

/**
 * An Express request after the context guard has run: it carries the resolved
 * {@link LedgerContext} the `@Context()` decorator reads back in the handler.
 */
export type ContextCarryingRequest = Request & {
  ledgerContext?: LedgerContext;
};
