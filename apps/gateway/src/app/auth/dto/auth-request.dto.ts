import { IsBoolean, IsEmail, IsString } from 'class-validator';
import { PickType } from '@nestjs/mapped-types';

export class UserDto {
  id: number;

  @IsString()
  username: string;

  @IsEmail()
  email: string;

  @IsString()
  password: string;

  @IsString()
  type: string;

  @IsString()
  name: string;

  @IsBoolean()
  verified: string;
}

export class LoginReq extends PickType(UserDto, ['email', 'password']) {
  type: string;
}

export class RecoveryReq extends PickType(UserDto, ['email']) {}
