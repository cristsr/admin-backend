import { Observable } from 'rxjs';
import {
  Status,
  User,
  Users,
  Id,
  CreateUser,
  UpdateUser,
} from '@admin-back/grpc';

export interface UserGrpc {
  findAll(): Observable<Users>;

  findOne(id: Id): Observable<User>;

  create(user: CreateUser): Observable<User>;

  update(user: UpdateUser): Observable<User>;

  remove(id: Id): Observable<Status>;
}
