import { Observable } from 'rxjs';
import { Status, Id } from '@admin-back/grpc';
import { CreateRol, Rol, Roles, UpdateRol } from './rol.dto';

export interface RolGrpc {
  findAll(): Observable<Roles>;

  findOne(id: Id): Observable<Rol>;

  create(rol: CreateRol): Observable<Rol>;

  update(rol: UpdateRol): Observable<Rol>;

  remove(id: Id): Observable<Status>;
}
