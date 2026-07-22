import { Type } from '@nestjs/common';
import { IdentityResolver } from '../resolvers/identity-resolver';

export interface AuthModuleExtras {
  identityResolver?: Type<IdentityResolver>;
}
