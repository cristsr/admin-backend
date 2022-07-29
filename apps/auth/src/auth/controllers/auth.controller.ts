import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { AccessToken } from '@admin-back/shared';
import { AuthService } from 'auth/services';
import { LoginReq, RecoveryReq, RegisterReq } from 'auth/dto';
import { UserEntity } from 'auth/entities';

@Controller()
export class Auth {
  constructor(private readonly authService: AuthService) {}

  // @Post('register')
  // register(@Body() data: RegisterReq) {
  //   return this.authService.register(data);
  // }

  @GrpcMethod()
  login(data: LoginReq) {
    return this.authService.login(data);
  }

  @GrpcMethod()
  getUserFromToken(data: AccessToken): Promise<UserEntity> {
    return this.authService.getUserFromToken(data);
  }

  // @Post('recovery-account')
  // recovery(@Body() data: RecoveryReq) {
  //   return this.authService.recovery(data);
  // }
  //
  // @Get(':id')
  // profile(@Req() req: Request) {
  //   console.log(req.cookies);
  //   return {};
  // }
}
