import { IsNotEmpty, IsOptional, Min } from 'class-validator';

export class TransferInputDto {
  @Min(1)
  from: number;

  @Min(1)
  to: number;

  @Min(0.01)
  amount: number;

  @IsNotEmpty()
  currency: string;

  date: Date;

  @IsOptional()
  description?: string;
}
