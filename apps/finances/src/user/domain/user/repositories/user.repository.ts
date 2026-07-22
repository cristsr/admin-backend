import { Nullable } from '@shared';
import { User } from '../entities/user.entity';

/** Persistence port for users. */
export abstract class UserRepository {
  abstract findAll(): Promise<User[]>;

  abstract findById(id: number): Promise<Nullable<User>>;

  /** Resolves the user linked to a verified token's subject. */
  abstract findByExternalId(externalId: string): Promise<Nullable<User>>;

  /** Either identifier already identifies a user; used to reject duplicates. */
  abstract findByEmailOrExternalId(email: string, externalId: Nullable<string>): Promise<Nullable<User>>;

  abstract save(user: User): Promise<User>;

  /** Whether a user was actually removed. */
  abstract remove(id: number): Promise<boolean>;
}
