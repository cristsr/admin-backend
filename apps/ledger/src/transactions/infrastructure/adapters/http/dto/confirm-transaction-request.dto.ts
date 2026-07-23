import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsOptional, ValidateNested } from 'class-validator';
import { PostingDto } from './posting.dto';

/**
 * Body of `POST /transactions/{id}/confirm`. Optional final postings let a
 * confirmation adjust a pending estimate before freezing it (§7.1).
 */
export class ConfirmTransactionRequestDto {
  @ApiPropertyOptional({ type: [PostingDto], description: 'Final postings; omit to confirm as-is.' })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => PostingDto)
  readonly postings?: PostingDto[];
}
