import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
import { AccountType } from '@ledger/shared-kernel/domain/value-objects';

/**
 * Body of `POST /accounts`. Validates shape only — hierarchy, name collision,
 * single-currency rule for real accounts and system-account protection are
 * domain invariants the `Account` aggregate (EP-1) owns, not this DTO.
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

  @ApiProperty({ example: '2026-07-20', description: 'Plain accounting date, no timezone (RNF-7).' })
  @IsDateString()
  readonly openedOn: string;

  @ApiProperty({ description: 'True when this account mirrors a real bank account or wallet.' })
  @IsBoolean()
  readonly isBankMirror: boolean;
}
