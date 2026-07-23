import { Nullable } from '@shared';

/**
 * Declares a balance assertion (RF-17). Idempotent by the `externalRef` carried
 * on the {@link AuthContext}, not on the command.
 */
export class AssertBalanceCommand {
  constructor(
    readonly accountId: string,
    readonly date: string,
    readonly occurredAt: Nullable<string>,
    readonly expectedAmount: string,
    readonly currency: string,
    readonly tolerance: string,
  ) {}
}
