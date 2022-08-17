import { Body, Controller, Get, Inject, Post } from '@nestjs/common';
import { AUTH_SERVICE, AuthGrpc } from '@admin-back/grpc';
import { LoginReq, RecoveryReq, UserDto } from 'app/auth/dto';
import { Public, CurrentUser } from 'core/decorators';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AUTH_SERVICE)
    private authService: AuthGrpc
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
