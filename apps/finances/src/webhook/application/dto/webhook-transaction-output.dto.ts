export class WebhookTransactionOutputDto {
  movementId: number;

  externalReference: string;

  /** True when this call was a no-op because the reference was already processed. */
  duplicate: boolean;
}
