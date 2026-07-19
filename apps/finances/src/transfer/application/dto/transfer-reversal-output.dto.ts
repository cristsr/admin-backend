export class TransferReversalOutputDto {
  /** transferGroup of the original reversed transfer. */
  originalTransferGroup: string;

  /** transferGroup of the created compensating pair. */
  reversalTransferGroup: string;

  /** Compensating movement for the source leg. */
  fromMovementId: number;

  /** Compensating movement for the destination leg. */
  toMovementId: number;
}
