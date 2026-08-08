import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, ValidateNested } from 'class-validator';
import { PostingDto } from './posting.dto';

/**
 * Body of `POST /transactions/{id}/amend`. Economic change, valid only while the
 * transaction is `PENDING` (INV-6) — the aggregate enforces the state rule.
 *
 * Both fields are required: `LedgerTransaction.amend` replaces the postings and
 * the date wholesale, so a partial amend has no representation in the domain.
 */
export class AmendTransactionRequestDto {
  @ApiProperty({ type: [PostingDto] })
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => PostingDto)
  readonly postings!: PostingDto[];

  @ApiProperty({ example: '2026-07-20', description: 'Plain accounting date.' })
  @IsDateString()
  readonly date!: string;
}
