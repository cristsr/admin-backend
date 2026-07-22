import { Nullable, PropertiesOnly } from '@shared';

export class User {
  id: number;

  createdAt: Date;

  updatedAt: Date;

  name: string;

  lastName: string;

  email: string;

  /** Stable subject issued by the identity provider; absent until linked. */
  externalId: Nullable<string>;

  private constructor(payload?: Partial<User>) {
    Object.assign(this, payload);
  }

  static create(payload: PropertiesOnly<User>): User {
    return new User(payload);
  }
}
