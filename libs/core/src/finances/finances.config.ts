import { join } from 'path';
import { InjectionToken } from '@admin-back/shared';
import { CorePackageName } from '../core.constants';

const FinancesPackageName = 'finances';

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
  protoPath: join(__dirname, 'assets', 'core', 'admin.proto'),
  loader: {
    keepCase: true,
    oneofs: true,
    arrays: true,
  },
};

export const FINANCES_GRPC_CLIENT = InjectionToken('FINANCES_GRPC_CLIENT');

export const FinancesAssetsPath = join(
  __dirname,
  'assets',
  CorePackageName,
  FinancesPackageName
);
