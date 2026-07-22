import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Machine-to-machine auth: webhook callers hold a shared API key, not a user JWT. */
@Injectable()
export class WebhookApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];
    const expected = this.configService.get<string>('WEBHOOK_API_KEY');

    if (!expected || apiKey !== expected) {
      throw new UnauthorizedException('Invalid webhook API key');
    }

    return true;
  }
}
