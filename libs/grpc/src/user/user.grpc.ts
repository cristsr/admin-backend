import { Observable } from 'rxjs';
import { Id, Status } from '../shared';
import { User, UserInput, UserQuery, Users } from '../user';

export interface UserGrpc {
  findAll(): Observable<Users>;

  findOne(queryUser: UserQuery): Observable<User>;

  save(user: UserInput): Observable<User>;

  remove(id: Id): Observable<Status>;
}
