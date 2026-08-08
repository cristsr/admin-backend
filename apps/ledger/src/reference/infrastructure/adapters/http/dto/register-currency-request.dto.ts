import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, Matches, Max, Min } from 'class-validator';

/** Body of a currency registration. */
export class RegisterCurrencyRequestDto {
  @ApiProperty({ example: 'CLF', description: 'ISO-4217 code.' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z]{3}$/, { message: 'code must be a 3-letter ISO-4217 code' })
  readonly code: string;

  @ApiProperty({ example: 4, minimum: 0, maximum: 4, description: 'Decimal places (ISO-4217).' })
  @IsInt()
  @Min(0)
  @Max(4)
  readonly minorUnits: number;

  @ApiProperty({ example: 'Unidad de Fomento' })
  @IsString()
  @IsNotEmpty()
  readonly name: string;
}
