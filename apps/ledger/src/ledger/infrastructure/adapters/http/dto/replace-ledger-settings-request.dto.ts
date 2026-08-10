import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import {  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

/**
 * Full replacement of the ledger's presentation settings. Both fields are
 * required: `PUT` states the resulting configuration, not a delta.
 */
export class ReplaceLedgerSettingsRequestDto {
  @ApiProperty({
    example: 'COP',
    description: 'ISO-4217 code the balances are presented in.',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z]{3}$/, { message: 'presentationCurrency must be a 3-letter ISO-4217 code' })
  readonly presentationCurrency: string;

  @ApiProperty({
    example: 'America/Bogota',
    description:
      'IANA timezone. Drives the close-of-day cutoff for balance assertions.',
  })
  @IsString()
  @IsNotEmpty()
  readonly timezone: string;
  @ApiPropertyOptional({ default: false, description: 'Preview mode (hu-0025): execute the command fully inside the transaction and roll back, returning the result the real run would have produced.' })
  @IsOptional()
  @IsBoolean()
  readonly dryRun?: boolean;
}
