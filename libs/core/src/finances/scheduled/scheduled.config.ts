import { GrpcServiceNameExtractor } from '@admin-back/shared';
import { FinancesAssetsPath } from '../finances.config';

export const SCHEDULED_HANDLER = GrpcServiceNameExtractor(
  FinancesAssetsPath,
  'scheduled',
  'scheduled.proto'
);
