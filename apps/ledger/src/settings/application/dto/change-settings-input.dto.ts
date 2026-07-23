import { IsOptional, IsString } from 'class-validator';

/**
 * Request DTO to change ledger settings.
 */
export class ChangeSettingsInputDto {
  @IsOptional()
  @IsString()
  presentationCurrency?: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}
