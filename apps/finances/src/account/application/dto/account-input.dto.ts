import { IsBoolean, IsNotEmpty, IsOptional, Min } from 'class-validator';

export class AccountInputDto {
  @IsOptional()
  @Min(0)
  id?: number;

  name: string;

  initialBalance: number;

  @IsNotEmpty()
  currency: string;

  /**
   * AC-1 (sm-0003) — if true, the account may hold a negative balance. Defaults
   * to false when omitted.
   */
  @IsOptional()
  @IsBoolean()
  allowNegativeBalance?: boolean;
}
