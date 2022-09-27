import { join } from 'path';

export const UserConfig = {
  url: 'localhost:5004',
  package: ['user'],
  protoPath: 'user.proto',
  loader: {
    includeDirs: [join(__dirname, 'assets', 'user')],
    keepCase: true,
    oneofs: true,
    arrays: true,
  },
};
