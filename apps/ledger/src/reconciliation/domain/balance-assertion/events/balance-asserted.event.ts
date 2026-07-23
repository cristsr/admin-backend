import { Nullable } from '@shared';

/** Stable event-type name for the assertion declaration (spec §3.4). */
export const BALANCE_ASSERTED = 'BalanceAsserted';

/** Payload of a newly declared checkpoint. Amounts are decimal strings (RNF-2). */
export class BalanceAsserted {
  constructor(
    readonly accountId: string,
    readonly date: string,
    readonly occurredAt: Nullable<string>,
    readonly expectedAmount: string,
    readonly currency: string,
    readonly tolerance: string,
  ) {}
}
