export interface MovementSavedPayload {
  categoryId: number;
  accountId: number;
  date: Date;
  amount: number;
  user: number;
  correlationId?: string;
}
