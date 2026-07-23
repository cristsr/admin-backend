import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/** Body of `POST /transactions/{id}/void`. Valid only while `PENDING` (INV-6). */
export class VoidTransactionRequestDto {
  @ApiProperty({ example: 'Duplicated capture' })
  @IsString()
  @IsNotEmpty()
  readonly reason: string;
}
