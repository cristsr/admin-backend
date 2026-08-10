import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import {  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

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
  @ApiPropertyOptional({ default: false, description: 'Preview mode (hu-0025): execute the command fully inside the transaction and roll back, returning the result the real run would have produced.' })
  @IsOptional()
  @IsBoolean()
  readonly dryRun?: boolean;
}
