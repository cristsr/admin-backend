import { join } from 'path';

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
  protoPath: join(__dirname, 'assets', 'grpc', 'admin.proto'),
  loader: {
    keepCase: true,
    oneofs: true,
    arrays: true,
  },
};
