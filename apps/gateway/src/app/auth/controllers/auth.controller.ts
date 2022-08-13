import { Body, Controller, Get, Inject, Post } from '@nestjs/common';
import { AuthService } from '@admin-back/grpc';
import { LoginReq, RecoveryReq, UserDto } from 'app/auth/dto';
import { AUTH_SERVICE } from 'app/auth/const';
import { Public, CurrentUser } from 'core/decorators';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AUTH_SERVICE)
    private authService: AuthService
  ) {}

  @Post('register')
  register(@Body() data: UserDto) {
    return this.authService.register(data);
  }

  @Public()
  @Post('login')
  login(@Body() data: LoginReq) {
    return this.authService.login(data);
  }

  @Public()
  @Post('recovery-account')
  recovery(@Body() data: RecoveryReq) {
    return this.authService.recovery(data);
  }

  @Get('profile')
  profile(@CurrentUser() user: UserDto) {
    return user;
  }
}
