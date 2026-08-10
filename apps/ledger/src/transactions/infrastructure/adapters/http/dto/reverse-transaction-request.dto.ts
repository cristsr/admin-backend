import {
  ApiPropertyOptional,
} from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
} from 'class-validator';

/**
 * Body of `POST /transactions/{id}/reverse`. Valid only on a `CONFIRMED`
 * transaction; the response carries the id of the newly created reversal.
 */
export class ReverseTransactionRequestDto {
  @ApiPropertyOptional({ example: 'Refunded by the merchant' })
  @IsOptional()
  @IsString()
  readonly reason?: string;
  @ApiPropertyOptional({ default: false, description: 'Preview mode (hu-0025): execute the command fully inside the transaction and roll back, returning the result the real run would have produced.' })
  @IsOptional()
  @IsBoolean()
  readonly dryRun?: boolean;
}
