import { GrpcServiceNameExtractor } from '@admin-back/shared';
import { FinancesAssetsPath } from '../finances.config';

export const ACCOUNT_HANDLER = GrpcServiceNameExtractor(
  FinancesAssetsPath,
  'account',
  'account.proto'
);
