import { Nullable } from '@shared';

/** HTTP body for declaring a balance assertion (POST /balance-assertions). */
export interface AssertBalanceInputDto {
  readonly accountId: string;
  readonly date: string;
  readonly occurredAt: Nullable<string>;
  readonly expectedAmount: string;
  readonly currency: string;
  readonly tolerance?: string;
}
