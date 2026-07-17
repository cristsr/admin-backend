import { IsNotEmpty, IsOptional, Min } from 'class-validator';

export class TransferInputDto {
  /** Account the money leaves. */
  @Min(1)
  from: number;

  /** Account the money arrives at. */
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
