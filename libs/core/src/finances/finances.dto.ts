import { registerEnumType } from '@nestjs/graphql';

export enum Period {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
  CUSTOM = 'CUSTOM',
}

registerEnumType(Period, { name: 'Period' });
