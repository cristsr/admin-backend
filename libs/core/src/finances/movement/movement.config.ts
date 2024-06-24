import { GrpcServiceNameExtractor } from '@shared';
import { FinancesAssetsPath } from '../finances.config';

export const MOVEMENT_HANDLER = GrpcServiceNameExtractor(
  FinancesAssetsPath,
  'movement',
  'movement.proto'
);
