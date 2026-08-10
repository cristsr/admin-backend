import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { 
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { AccountType } from '@ledger/shared/domain/value-objects';

/**
 * Body of `POST /accounts`. Validates shape only — hierarchy, name collision,
 * single-currency rule for real accounts and system-account protection are
 * domain invariants the `Account` aggregate owns, not this DTO.
 */
export class OpenAccountRequestDto {
  @ApiProperty({ enum: AccountType })
  @IsEnum(AccountType)
  readonly type: AccountType;

  @ApiProperty({ example: 'Assets:Bancolombia:Savings' })
  @IsString()
  @IsNotEmpty()
  readonly name: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Parent node; omitted for a root account.' })
  @IsOptional()
  @IsUUID()
  readonly parentId?: string;

  @ApiProperty({ type: [String], example: ['COP'] })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  readonly currencies: string[];

  @ApiProperty({ example: '2026-07-20', description: 'Plain accounting date, no timezone.' })
  @IsDateString()
  readonly openedOn: string;

  @ApiProperty({ description: 'True when this account mirrors a real bank account or wallet.' })
  @IsBoolean()
  readonly isBankMirror: boolean;
  @ApiPropertyOptional({ default: false, description: 'Preview mode (hu-0025): execute the command fully inside the transaction and roll back, returning the result the real run would have produced.' })
  @IsOptional()
  @IsBoolean()
  readonly dryRun?: boolean;
}
