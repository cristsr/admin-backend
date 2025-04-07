import { join } from 'path';
import { GrpcServiceNameExtractor, InjectionToken } from '@shared';
import { CoreAssetsPath } from '../core.constants';

export const UserPackageName = 'user';

export const UsersAssetsPath = join(CoreAssetsPath, UserPackageName);

export const UserConfig = {
  url: 'localhost:5004',
  package: ['admin.shared', 'admin.user'],
  protoPath: join(CoreAssetsPath, 'admin.proto'),
  loader: {
    keepCase: true,
    oneofs: true,
    arrays: true,
  },
};

export const USER_HANDLER = GrpcServiceNameExtractor(
  UsersAssetsPath,
  'user.proto',
);

export const USER_GRPC_CLIENT = InjectionToken('USER_GRPC_CLIENT');
