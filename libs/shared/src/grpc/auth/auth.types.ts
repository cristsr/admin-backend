export interface User {
  id: number;
  name: string;
  username: string;
  email: string;
  verified: string;
}

export enum RegisterType {
  Local = 'local',
  Google = 'google',
  Facebook = 'facebook',
}

/**
 * Register
 */
export interface RegisterReq extends Omit<User, 'id' | 'verified'> {
  password: string;
  type: RegisterType;
}

/**
 * Login
 *
 */
export interface LoginReq {
  email: string;
  password: string;
  // TODO: remove type
  type: RegisterType;
}

export interface LoginRes {
  user: User;
  credentials: Credentials;
}

export interface Credentials {
  accessToken: Credential;
  refreshToken: Credential;
}

export interface Credential {
  value: string;
  expires: number;
}

export interface AccessToken {
  token: string;
}
