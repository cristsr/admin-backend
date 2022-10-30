import { join } from 'path';

export const UserConfig = {
  url: 'localhost:5004',
  package: ['admin.shared', 'admin.user'],
  protoPath: join(__dirname, 'assets', 'grpc', 'admin.proto'),
  loader: {
    keepCase: true,
    oneofs: true,
    arrays: true,
  },
};
