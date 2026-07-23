import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { WebhookConfig, webhookConfig } from '@app/config/environment';

/** Machine-to-machine auth: webhook callers hold a shared API key, not a user JWT. */
@Injectable()
export class WebhookApiKeyGuard implements CanActivate {
  constructor(
    @Inject(webhookConfig.KEY) private readonly config: WebhookConfig,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];
    const expected = this.config.apiKey;

    if (!expected || apiKey !== expected) {
      throw new UnauthorizedException('Invalid webhook API key');
    }

    return true;
  }
}
