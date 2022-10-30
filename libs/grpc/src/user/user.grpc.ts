import { Observable } from 'rxjs';
import {
  Id,
  UserInput,
  Status,
  UserQuery,
  User,
  Users,
} from '@admin-back/grpc';

export interface UserGrpc {
  findAll(): Observable<Users>;

  findOne(queryUser: UserQuery): Observable<User>;

  save(user: UserInput): Observable<User>;

  remove(id: Id): Observable<Status>;
}
