import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Machine-to-machine guard for the webhook receiver — separate from the
 * user-facing JWT guard, since callers here (e.g. the Rust ingestion
 * pipeline) don't hold an end-user token. A shared API key is the simplest
 * contract that works regardless of which identity provider users
 * authenticate through.
 */
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
