import { GrpcServiceNameExtractor } from '@shared';
import { FinancesAssetsPath } from '../finances.config';

export const BUDGET_HANDLER = GrpcServiceNameExtractor(
  FinancesAssetsPath,
  'budget',
  'budget.proto'
);
