import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsObject, IsOptional, IsString, IsUrl } from 'class-validator';

/**
 * Body of `POST /transactions/{id}/annotate`. Non-economic changes, allowed in
 * any non-`VOIDED` state (INV-6). Every field is optional; the aggregate decides
 * what a given state accepts.
 */
export class AnnotateTransactionRequestDto {
  @ApiPropertyOptional({ example: 'Netflix' })
  @IsOptional()
  @IsString()
  readonly payee?: string;

  @ApiPropertyOptional({ example: 'Corrected description' })
  @IsOptional()
  @IsString()
  readonly description?: string;

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
