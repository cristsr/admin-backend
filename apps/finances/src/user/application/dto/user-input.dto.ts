import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UserInputDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  lastName: string;

  @IsEmail()
  email: string;

  /** Identity-provider subject; the account may be created before it is linked. */
  @IsOptional()
  @IsString()
  auth0Id?: string;
}
