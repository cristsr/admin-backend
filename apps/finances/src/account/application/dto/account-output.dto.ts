export class AccountOutputDto {
  id: number;

  createdAt: Date;

  updatedAt: Date;

  name: string;

  initialBalance: number;

  currency: string;

  allowNegativeBalance: boolean;

  /** Live balance; present only on reads that compute it. */
  balance?: number;

  user: number;
}
