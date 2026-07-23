import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsOptional, ValidateNested } from 'class-validator';
import { PostingDto } from './posting.dto';

/**
 * Body of `POST /transactions/{id}/amend`. Economic change, valid only while the
 * transaction is `PENDING` (INV-6) — the aggregate enforces the state rule.
 */
export class AmendTransactionRequestDto {
  @ApiPropertyOptional({ type: [PostingDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => PostingDto)
  readonly postings?: PostingDto[];

  @ApiPropertyOptional({ example: '2026-07-20', description: 'Plain accounting date (RNF-7).' })
  @IsOptional()
  @IsDateString()
  readonly date?: string;
}
