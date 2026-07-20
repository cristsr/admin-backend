export interface IdempotencyReservation {
  idempotencyKey: string;
  userId: number;
  endpoint: string;
  requestHash: string;
  expiresAt: Date;
}
