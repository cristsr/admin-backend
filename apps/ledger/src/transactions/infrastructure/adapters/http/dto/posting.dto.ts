import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumberString, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

/**
 * One leg of a transaction. The amount is an exact decimal string, never a
 * number (INV-8: a TS `number` is a float and would lose cents); `Money`
 * reconstructs it in the domain. Zero-sum balancing (INV-1) is a domain
 * invariant, not validated here.
 */
export class PostingDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  readonly accountId: string;

  @ApiProperty({ example: '-31900', description: 'Exact decimal string; positive debits, negative credits.' })
  @IsNumberString()
  readonly amount: string;

  @ApiProperty({ example: 'COP' })
  @IsString()
  @IsNotEmpty()
  readonly currency: string;

  @ApiPropertyOptional({ type: Object, description: 'Free-form per-posting metadata.' })
  @IsOptional()
  @IsObject()
  readonly metadata?: Record<string, unknown>;
}
