import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { catchError, map, tap } from 'rxjs';
import { Reflector } from '@nestjs/core';
import { AUTH_SERVICE, IS_PUBLIC } from 'app/auth/const';
import { AuthService } from '@admin-back/shared';
import { GqlExecutionContext } from '@nestjs/graphql';

@Injectable()
export class AuthGuard implements CanActivate {
  #logger = new Logger(AuthGuard.name);

  constructor(
    @Inject(AUTH_SERVICE)
    private authService: AuthService,

    private reflector: Reflector
  ) {}

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getClass(),
      context.getHandler(),
    ]);

    if (isPublic) {
      return true;
    }

    const contextType = context.getType();

    const contextTypeMap = {
      http: () => context.switchToHttp().getRequest(),
      graphql: () => GqlExecutionContext.create(context).getContext().req,
    };

    const request = contextTypeMap[contextType]();

    return this.validateUser(request);
  }

  validateUser(request) {
    const token = request.headers.authorization;

    if (!token) {
      throw new UnauthorizedException('Access token is required');
    }

    return this.authService.getUserFromToken({ token }).pipe(
      tap((user) => (request.user = user)),
      tap((user) => this.#logger.log(user)),
      map((user) => !!user),
      catchError((err) => {
        throw new UnprocessableEntityException(err.details);
      })
    );
  }
}
