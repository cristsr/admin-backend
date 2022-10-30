import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '@admin-back/shared';

@Controller('auth')
export class AuthController {
  @Get('profile')
  profile(@CurrentUser() user) {
    return user;
  }
}
