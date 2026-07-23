/** Stable event-type name for a discrepancy resolution (spec §3.4). */
export const DISCREPANCY_RESOLVED = 'DiscrepancyResolved';

/** Payload linking a resolved assertion to the adjustment transaction (EP-3.5). */
export class DiscrepancyResolved {
  constructor(
    readonly assertionId: string,
    readonly adjustmentTransactionId: string,
  ) {}
}
