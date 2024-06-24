import { GrpcServiceNameExtractor } from '@admin-back/shared';
import { FinancesAssetsPath } from '../finances.config';

export const CATEGORY_HANDLER = GrpcServiceNameExtractor(
  FinancesAssetsPath,
  'category',
  'category.proto'
);
