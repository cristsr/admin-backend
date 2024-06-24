import { GrpcServiceNameExtractor } from '@shared';
import { FinancesAssetsPath } from '../finances.config';

export const ACCOUNT_HANDLER = GrpcServiceNameExtractor(
  FinancesAssetsPath,
  'account',
  'account.proto'
);
