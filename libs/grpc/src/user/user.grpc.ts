import { Observable } from 'rxjs';
import {
  Id,
  CreateUser,
  Status,
  QueryUser,
  UpdateUser,
  User,
  Users,
} from '@admin-back/grpc';

export interface UserGrpc {
  findAll(): Observable<Users>;

  findOne(queryUser: QueryUser): Observable<User>;

  create(user: CreateUser): Observable<User>;

  update(user: UpdateUser): Observable<User>;

  remove(id: Id): Observable<Status>;
}
