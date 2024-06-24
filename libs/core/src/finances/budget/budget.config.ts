import { GrpcServiceNameExtractor } from '@admin-back/shared';
import { FinancesAssetsPath } from '../finances.config';

export const BUDGET_HANDLER = GrpcServiceNameExtractor(
  FinancesAssetsPath,
  'budget',
  'budget.proto'
);
