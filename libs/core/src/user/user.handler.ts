import { Observable } from 'rxjs';
import { Id, Status } from '../shared';
import { User, UserInput, UserQuery, Users } from '../user';

export abstract class UserHandler {
  abstract findAll(): Observable<Users>;

  abstract findOne(queryUser: UserQuery): Observable<User>;

  abstract save(user: UserInput): Observable<User>;

  abstract remove(id: Id): Observable<Status>;
}
