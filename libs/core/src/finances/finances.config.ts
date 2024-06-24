import { join } from 'path';
import { InjectionToken } from '@shared';
import { CoreAssetsPath } from '../core.constants';

export const FinancesPackageName = 'finances';

export const FinancesAssetsPath = join(CoreAssetsPath, FinancesPackageName);

const packages = [
  'admin.shared',
  'admin.finances.account',
  'admin.finances.category',
  'admin.finances.subcategory',
  'admin.finances.movement',
  'admin.finances.summary',
  'admin.finances.budget',
  'admin.finances.scheduled',
];

export const FinancesConfig = {
  url: 'localhost:5003',
  package: packages,
  protoPath: join(CoreAssetsPath, 'admin.proto'),
  loader: {
    keepCase: true,
    oneofs: true,
    arrays: true,
  },
};

export const FINANCES_GRPC_CLIENT = InjectionToken('FINANCES_GRPC_CLIENT');
