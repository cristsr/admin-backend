import { ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class AuthGuard {
  /**
   * @override
   * @param context
   */
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();

    const user = request.headers.user;

    if (user) {
      // todo: fetch user from db calling the user service
      request.user = {
        id: user.id,
      };
    }

    return true;
  }
}
