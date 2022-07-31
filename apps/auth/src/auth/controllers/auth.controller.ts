import { Controller, Logger } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { AccessToken, LoginReq, RegisterReq } from '@admin-back/shared';
import { AuthService } from 'auth/services';
import { UserEntity } from 'auth/entities';

@Controller()
export class Auth {
  #logger = new Logger(Auth.name);

  constructor(private readonly authService: AuthService) {}

  @GrpcMethod()
  register(data: RegisterReq) {
    this.#logger.debug(data);
    return this.authService.register(data);
  }

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
