import { IsEmail, IsEnum, IsString } from 'class-validator';
import { PickType } from '@nestjs/mapped-types';
import { RegisterType } from 'auth/types';

export class AuthReq {}

export class RegisterReq extends AuthReq {
  @IsString()
  username: string;

  @IsEmail()
  email: string;

  @IsString()
  password: string;

  @IsEnum(RegisterType)
  type: RegisterType;
}

export class LoginReq extends PickType(RegisterReq, [
  'email',
  'password',
  'type',
]) {}

export class RecoveryReq extends PickType(RegisterReq, ['email']) {}
