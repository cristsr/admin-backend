import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import {  IsBoolean,
  IsDateString,
  IsOptional,
} from 'class-validator';

/** Body of `POST /accounts/{id}/close`. */
export class CloseAccountRequestDto {
  @ApiProperty({ example: '2026-07-20', description: 'Plain accounting date the account closes on.' })
  @IsDateString()
  readonly closedOn: string;
  @ApiPropertyOptional({ default: false, description: 'Preview mode (hu-0025): execute the command fully inside the transaction and roll back, returning the result the real run would have produced.' })
  @IsOptional()
  @IsBoolean()
  readonly dryRun?: boolean;
}
