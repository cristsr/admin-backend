import { join } from 'path';

export const AuthConfig = {
  url: 'localhost:5002',
  package: 'auth',
  protoPath: join(__dirname, 'assets', 'auth', 'auth.proto'),
};
