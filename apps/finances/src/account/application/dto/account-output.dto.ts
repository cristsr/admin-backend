export class AccountOutputDto {
  id: number;

  createdAt: Date;

  updatedAt: Date;

  name: string;

  initialBalance: number;

  currency: string;

  /** AC-1 (sm-0003) — whether this account may hold a negative balance. */
  allowNegativeBalance: boolean;

  /**
   * Live balance = initialBalance + signed sum of movements. Attached when
   * listing/reading accounts; absent in responses that don't compute it
   * (e.g. creation).
   */
  balance?: number;

  user: number;
}
