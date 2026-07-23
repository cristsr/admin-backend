import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

/** Query string of `GET /accounts/{id}/balance`: optional currency narrowing. */
export class AccountBalanceQueryDto {
  @ApiPropertyOptional({ example: 'COP', description: 'Restrict to a single currency; omit for all.' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  readonly currency?: string;
}
