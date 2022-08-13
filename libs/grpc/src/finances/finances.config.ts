import { join } from 'path';

const packages = [
  'finances.category',
  'finances.subcategory',
  'finances.budget',
];

export const FinancesConfig = {
  package: packages,
  protoPath: 'finances.proto',
  loader: {
    includeDirs: [join(__dirname, 'assets', 'finances')],
    keepCase: true,
  },
};
