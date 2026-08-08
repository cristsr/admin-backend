import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  ValidateNested,
} from 'class-validator';
import { TransactionStatus } from '@ledger/transactions/domain/transaction/transaction-status';
import { PostingDto } from './posting.dto';

/** Statuses a transaction may be recorded in; `VOIDED` is never a creation target. */
const RECORDABLE_STATUSES = [TransactionStatus.PENDING, TransactionStatus.CONFIRMED] as const;

/**
 * Body of `POST /transactions`. Validates shape only: `ArrayMinSize(2)` is an
 * early mesh hint for INV-2, but zero-sum balancing (INV-1), currency
 * allowance (INV-4) and account state (INV-3) are the aggregate's authority.
 */
export class RecordTransactionRequestDto {
  @ApiProperty({ example: '2026-07-20', description: 'Plain accounting date.' })
  @IsDateString()
  readonly date: string;

  @ApiPropertyOptional({
    example: '2026-07-20T14:03:11.000Z',
    description:
      'UTC instant the movement actually happened, when the source knows it (a bank ' +
      'notification does; a manually entered expense does not). Omit when unknown — ' +
      'an intraday balance assertion then reports INDETERMINATE instead of guessing ' +
      'the order.',
  })
  @IsOptional()
  @IsDateString()
  readonly occurredAt?: string;

  @ApiPropertyOptional({ example: 'Netflix' })
  @IsOptional()
  @IsString()
  readonly payee?: string;

  @ApiProperty({ example: 'Monthly subscription' })
  @IsString()
  @IsNotEmpty()
  readonly description: string;

  @ApiProperty({ enum: RECORDABLE_STATUSES })
  @IsIn(RECORDABLE_STATUSES)
  readonly status: TransactionStatus;

  @ApiProperty({ type: [PostingDto] })
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => PostingDto)
  readonly postings: PostingDto[];

  @ApiPropertyOptional({ format: 'url' })
  @IsOptional()
  @IsUrl()
  readonly invoiceUrl?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  readonly tags?: string[];

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  readonly metadata?: Record<string, unknown>;
}
