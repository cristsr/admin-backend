export interface AuthModuleOptions {
  issuer: string;
  audience: string;
  usersServiceUrl: string;
  discoveryTtlMs?: number;
}
