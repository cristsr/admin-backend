/** Result of resolving a discrepancy: the assertion and its adjustment transaction. */
export interface ResolveDiscrepancyOutputDto {
  readonly assertionId: string;
  readonly adjustmentTransactionId: string;
  readonly streamPosition: number;
}
