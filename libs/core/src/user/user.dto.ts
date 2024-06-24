import { ListMixin } from '@shared';

export class User {
  id: number;

  name: string;

  lastName: string;

  email: string;

  createdAt: string;

  updatedAt: string;

  auth0Id: string;
}

export class Users implements ListMixin<User> {
  data: User[];
}

export class UserInput implements Omit<User, 'id' | 'createdAt' | 'updatedAt'> {
  auth0Id: string;

  lastName: string;

  name: string;

  email: string;
}

export class UserQuery {
  id?: number;
  email?: string;
  auth0Id?: string;
}
