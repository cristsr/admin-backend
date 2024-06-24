import { GrpcServiceNameExtractor } from '@shared';
import { FinancesAssetsPath } from '../finances.config';

export const SUMMARY_HANDLER = GrpcServiceNameExtractor(
  FinancesAssetsPath,
  'summary',
  'summary.proto'
);
