import { Observable } from 'rxjs';
import {
  User,
  RegisterReq,
  LoginReq,
  LoginRes,
  AccessToken,
} from './auth.types';

export interface AuthGrpc {
  register(data: RegisterReq): Observable<User>;

  login(data: LoginReq): Observable<LoginRes>;

  getUserFromToken(accessToken: AccessToken): Observable<User>;

  recovery(data: any): any;
}
