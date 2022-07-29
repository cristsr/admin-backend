import { SetMetadata } from '@nestjs/common';
import { IS_PUBLIC } from 'app/auth/const';

export const Public = () => SetMetadata(IS_PUBLIC, true);
