import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import {  IsBoolean,
  IsOptional,
  IsString,
} from 'class-validator';

/** Body of `POST /balance-assertions/{id}/revoke`. */
export class RevokeAssertionRequestDto {
  @ApiProperty({ example: 'Statement was corrected by the bank' })
  @IsString()
  readonly reason: string;
  @ApiPropertyOptional({ default: false, description: 'Preview mode (hu-0025): execute the command fully inside the transaction and roll back, returning the result the real run would have produced.' })
  @IsOptional()
  @IsBoolean()
  readonly dryRun?: boolean;
}
