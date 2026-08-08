import { Module } from '@nestjs/common';
import { AccountsHttpModule } from './infrastructure/adapters/http';

/**
 * The accounts module: its HTTP surface and nothing else.
 *
 * Its command and query handlers are composed in `bootstrap/`, and so are the
 * adapters behind its read ports — `read-side-ports.factory` is the single root
 * that chooses them. The four bindings that used to live here were resolved by
 * no one: the handlers reach their ports through the composed buses, so editing
 * a binding here changed nothing while looking like it did.
 */
@Module({
  imports: [AccountsHttpModule],
})
export class AccountsModule {}
