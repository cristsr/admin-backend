import { Nullable } from '@shared';
import { AuthenticatedContext } from '@ledger/shared/ep1-ep2-contracts.assumed';

/** Revokes an erroneous assertion with an audited reason (RF-19). */
export class RevokeAssertionCommand {
  constructor(
    readonly context: AuthenticatedContext,
    readonly externalRef: Nullable<string>,
    readonly assertionId: string,
    readonly reason: string,
  ) {}
}
