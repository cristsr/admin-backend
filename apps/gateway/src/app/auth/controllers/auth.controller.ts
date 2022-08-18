import { Controller, Get } from '@nestjs/common';
import { UserDto } from 'app/auth/dto';
import { CurrentUser } from 'core/decorators';

@Controller('auth')
export class AuthController {
  @Get('profile')
  profile(@CurrentUser() user: UserDto) {
    return user;
  }
}
