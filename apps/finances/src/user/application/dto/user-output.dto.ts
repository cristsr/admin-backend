import { Nullable } from '@shared';

export class UserOutputDto {
  id: number;

  name: string;

  lastName: string;

  email: string;

  auth0Id: Nullable<string>;

  createdAt: Date;

  updatedAt: Date;
}
