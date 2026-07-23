import { Nullable } from '@shared';
import { AuthenticatedContext } from '@ledger/shared/ep1-ep2-contracts.assumed';

/** Declares a balance assertion (RF-17). Idempotent by `externalRef`. */
export class AssertBalanceCommand {
  constructor(
    readonly context: AuthenticatedContext,
    readonly externalRef: Nullable<string>,
    readonly accountId: string,
    readonly date: string,
    readonly occurredAt: Nullable<string>,
    readonly expectedAmount: string,
    readonly currency: string,
    readonly tolerance: string,
  ) {}
}
