export const MovementSaved = 'movement.saved';

export interface MovementSavedPayload {
  categoryId: number;
  accountId: number;
  date: Date;
  amount: number;
  user: number;
}
