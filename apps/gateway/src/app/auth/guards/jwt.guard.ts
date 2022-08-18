import { ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC } from 'app/auth/const';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtGuard extends AuthGuard('jwt') {
  #logger = new Logger(JwtGuard.name);

  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getClass(),
      context.getHandler(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  getRequest(context: ExecutionContext) {
    const contextTypeMap = {
      http: () => context.switchToHttp().getRequest(),
      graphql: () => GqlExecutionContext.create(context).getContext().req,
    };

    const type = context.getType();
    return contextTypeMap[type]();
  }

  handleRequest(err, user, info, context) {
    if (!user) {
      this.#logger.error(info);
    }

    return super.handleRequest(err, user, info, context);
  }
}
