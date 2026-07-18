export class TransferReversalOutputDto {
  /** transferGroup de la transferencia original anulada. */
  originalTransferGroup: string;

  /** transferGroup del par compensatorio creado. */
  reversalTransferGroup: string;

  /** Movimiento compensatorio de la pata origen. */
  fromMovementId: number;

  /** Movimiento compensatorio de la pata destino. */
  toMovementId: number;
}
