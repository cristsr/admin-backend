import { join } from 'path';

const packages = [
  'finances.category',
  'finances.subcategory',
  'finances.movement',
  'finances.summary',
  'finances.budget',
  'finances.scheduled',
];

export const FinancesConfig = {
  url: 'localhost:5003',
  package: packages,
  protoPath: 'finances.proto',
  loader: {
    includeDirs: [join(__dirname, 'assets', 'finances')],
    keepCase: true,
    oneofs: true,
    arrays: true,
  },
};
