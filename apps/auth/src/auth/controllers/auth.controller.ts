import { Logger } from '@nestjs/common';
import { GrpcMethod, GrpcService } from '@nestjs/microservices';
import { AccessToken, LoginReq, RegisterReq } from '@admin-back/grpc';
import { AuthService } from 'auth/services';
import { UserEntity } from 'auth/entities';

@GrpcService()
export class Auth {
  #logger = new Logger(Auth.name);

  constructor(private readonly authService: AuthService) {}

  @GrpcMethod()
  register(data: RegisterReq) {
    this.#logger.debug('Register', data);
    return this.authService.register(data);
  }

  @GrpcMethod()
  login(data: LoginReq) {
    this.#logger.debug('Login', data);
    return this.authService.login(data);
  }

  @GrpcMethod()
  getUserFromToken(data: AccessToken): Promise<UserEntity> {
    this.#logger.debug('Get user', data);
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
