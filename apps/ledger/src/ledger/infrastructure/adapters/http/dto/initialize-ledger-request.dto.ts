import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import {  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

/** Body of `POST /ledger/initialize`. Domain rules are enforced by the handler. */
export class InitializeLedgerRequestDto {
  @ApiProperty({ example: 'COP', description: 'ISO currency the ledger reports in.' })
  @IsString()
  @IsNotEmpty()
  readonly presentationCurrency: string;

  @ApiProperty({ example: 'America/Bogota', description: 'IANA timezone for accounting dates.' })
  @IsString()
  @IsNotEmpty()
  readonly timezone: string;
  @ApiPropertyOptional({ default: false, description: 'Preview mode (hu-0025): execute the command fully inside the transaction and roll back, returning the result the real run would have produced.' })
  @IsOptional()
  @IsBoolean()
  readonly dryRun?: boolean;
}
