import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import {  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

/** Body of `POST /accounts/{id}/rename`. */
export class RenameAccountRequestDto {
  @ApiProperty({ example: 'Assets:Bancolombia:Checking' })
  @IsString()
  @IsNotEmpty()
  readonly newName: string;
  @ApiPropertyOptional({ default: false, description: 'Preview mode (hu-0025): execute the command fully inside the transaction and roll back, returning the result the real run would have produced.' })
  @IsOptional()
  @IsBoolean()
  readonly dryRun?: boolean;
}
