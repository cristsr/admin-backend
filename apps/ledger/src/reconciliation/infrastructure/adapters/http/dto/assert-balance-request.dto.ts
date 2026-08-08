import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Nullable } from '@shared';
import { IsISO8601, IsOptional, IsString, IsUUID } from 'class-validator';

/**
 * Body of `POST /balance-assertions`. Declares what the account's balance is
 * expected to be on a date, so the ledger can flag drift against it.
 */
export class AssertBalanceRequestDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  readonly accountId: string;

  @ApiProperty({ example: '2026-07-22' })
  @IsString()
  readonly date: string;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  @IsOptional()
  @IsISO8601()
  readonly occurredAt: Nullable<string>;

  @ApiProperty({ example: '125000.00' })
  @IsString()
  readonly expectedAmount: string;

  @ApiProperty({ example: 'COP' })
  @IsString()
  readonly currency: string;

  @ApiPropertyOptional({ example: '0', default: '0' })
  @IsOptional()
  @IsString()
  readonly tolerance?: string;
}
