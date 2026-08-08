import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/**
 * Body of `POST /transactions/{id}/reverse`. Valid only on a `CONFIRMED`
 * transaction; the response carries the id of the newly created reversal.
 */
export class ReverseTransactionRequestDto {
  @ApiPropertyOptional({ example: 'Refunded by the merchant' })
  @IsOptional()
  @IsString()
  readonly reason?: string;
}
