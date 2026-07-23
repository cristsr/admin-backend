import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/** Body of `POST /accounts/{id}/rename`. */
export class RenameAccountRequestDto {
  @ApiProperty({ example: 'Assets:Bancolombia:Checking' })
  @IsString()
  @IsNotEmpty()
  readonly newName: string;
}
