import { GrpcServiceNameExtractor } from '@shared';
import { FinancesAssetsPath } from '../finances.config';

export const CATEGORY_HANDLER = GrpcServiceNameExtractor(
  FinancesAssetsPath,
  'category',
  'category.proto'
);
