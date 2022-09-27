import { Observable } from 'rxjs';
import {
  User2,
  RegisterReq,
  LoginReq,
  LoginRes,
  AccessToken,
} from './auth.types';

export interface AuthGrpc {
  register(data: RegisterReq): Observable<User2>;

  login(data: LoginReq): Observable<LoginRes>;

  getUserFromToken(accessToken: AccessToken): Observable<User2>;

  recovery(data: any): any;
}
