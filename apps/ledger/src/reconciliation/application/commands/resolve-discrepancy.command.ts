import { Nullable } from '@shared';
import { AuthenticatedContext } from '@ledger/shared/ep1-ep2-contracts.assumed';

/** Resolves a confirmed discrepancy with a system adjustment (RF-20). Idempotent by `externalRef`. */
export class ResolveDiscrepancyCommand {
  constructor(
    readonly context: AuthenticatedContext,
    readonly externalRef: Nullable<string>,
    readonly assertionId: string,
  ) {}
}
