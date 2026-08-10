import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import {  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

/** Body of `POST /transactions/{id}/void`. Valid only while `PENDING` (INV-6). */
export class VoidTransactionRequestDto {
  @ApiProperty({ example: 'Duplicated capture' })
  @IsString()
  @IsNotEmpty()
  readonly reason: string;
  @ApiPropertyOptional({ default: false, description: 'Preview mode (hu-0025): execute the command fully inside the transaction and roll back, returning the result the real run would have produced.' })
  @IsOptional()
  @IsBoolean()
  readonly dryRun?: boolean;
}
