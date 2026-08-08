import { Module } from '@nestjs/common';
import { AccountsHttpModule } from './infrastructure/adapters/http';

/**
 * The accounts module.
 *
 * It declares no providers of its own: every account command and query handler
 * is composed in the application's `bootstrap/` root and reached through the
 * shared buses, the same way the HTTP adapter reaches them. This file exists so
 * the module has one entry point rather than being assembled from three places,
 * and it is where a provider this context owns would be bound.
 */
@Module({
  imports: [AccountsHttpModule],
})
export class AccountsModule {}
