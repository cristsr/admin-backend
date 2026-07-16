import { IsNotEmpty, IsOptional, Min } from 'class-validator';

export class AccountInputDto {
  @IsOptional()
  @Min(0)
  id?: number;

  name: string;

  initialBalance: number;

  @IsNotEmpty()
  currency: string;
}
