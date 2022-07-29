import { Observable } from 'rxjs';

export interface AuthService {
  login(data: LoginReq): Observable<LoginRes>;
  getUserFromToken(accessToken: AccessToken): Observable<User>;
  register(user: User): Observable<any>;
  recovery(data: any): any;
}

export interface LoginReq {
  email: string;
  password: string;
}

export interface LoginRes {
  user: User;
  credentials: Credentials;
}

export interface User {
  id: number;
  name: string;
  username: string;
  email: string;
  password: string;
  verified: string;
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
