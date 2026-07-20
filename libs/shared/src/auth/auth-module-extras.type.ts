import { Type } from '@nestjs/common';
import { IdentityResolver } from './identity-resolver';

export interface AuthModuleExtras {
  identityResolver?: Type<IdentityResolver>;
}
