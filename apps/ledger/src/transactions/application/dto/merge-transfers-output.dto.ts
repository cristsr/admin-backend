/** Result of a merge: the confirmed transfer and the two voided legs. */
export interface MergeTransfersOutputDto {
  readonly transferTransactionId: string;
  readonly voidedTransactionIds: readonly [string, string];
}
