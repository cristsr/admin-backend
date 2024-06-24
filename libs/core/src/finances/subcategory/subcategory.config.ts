import { GrpcServiceNameExtractor } from '@shared';
import { FinancesAssetsPath } from '../finances.config';

export const SUBCATEGORY_HANDLER = GrpcServiceNameExtractor(
  FinancesAssetsPath,
  'subcategory',
  'subcategory.proto'
);
