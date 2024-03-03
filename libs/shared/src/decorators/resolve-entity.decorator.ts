import { SetMetadata } from '@nestjs/common';
import { RESOLVE_ENTITY } from '../constants';

export const ResolveEntity = () => SetMetadata(RESOLVE_ENTITY, true);
