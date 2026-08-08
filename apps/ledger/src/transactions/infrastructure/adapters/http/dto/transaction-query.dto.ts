import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { DEFAULT_TRANSACTION_PAGE_SIZE } from '@ledger/transactions/application/usecases/list-transactions/list-transactions.query';
import { DerivedKind } from '@ledger/transactions/domain/derivation/derived-kind';
import { TransactionStatus } from '@ledger/transactions/domain/transaction/transaction-status';

/** Largest page the `transaction_list` projection will return in one call. */
export const MAX_TRANSACTION_PAGE_SIZE = 200;

/**
 * Query string of `GET /transactions`. A typed contract over the
 * `transaction_list` projection filters — the query handler translates it; the
 * controller never builds SQL or domain criteria.
 */
export class TransactionQueryDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Only transactions touching this account.' })
  @IsOptional()
  @IsUUID()
  readonly account?: string;

  @ApiPropertyOptional({ example: '2026-07-01', description: 'Inclusive start accounting date.' })
  @IsOptional()
  @IsDateString()
  readonly from?: string;

  @ApiPropertyOptional({ example: '2026-07-31', description: 'Inclusive end accounting date.' })
  @IsOptional()
  @IsDateString()
  readonly to?: string;

  @ApiPropertyOptional({ enum: TransactionStatus })
  @IsOptional()
  @IsEnum(TransactionStatus)
  readonly status?: TransactionStatus;

  @ApiPropertyOptional({ enum: DerivedKind, description: 'Projector-derived classification.' })
  @IsOptional()
  @IsEnum(DerivedKind)
  readonly derivedKind?: DerivedKind;

  @ApiPropertyOptional({ example: 'Netflix' })
  @IsOptional()
  @IsString()
  readonly payee?: string;

  @ApiPropertyOptional({ description: 'Filter by the client that recorded the transaction.' })
  @IsOptional()
  @IsString()
  readonly clientId?: string;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: MAX_TRANSACTION_PAGE_SIZE,
    default: DEFAULT_TRANSACTION_PAGE_SIZE,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_TRANSACTION_PAGE_SIZE)
  readonly limit?: number;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  readonly offset?: number;
}
