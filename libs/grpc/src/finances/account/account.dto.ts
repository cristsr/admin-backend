import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Relation } from 'typeorm';
import { ListObject } from '@admin-back/shared';

@ObjectType()
export class Account {
  @Field()
  id: number;

  @Field()
  name: string;

  @Field(() => Balance)
  balance: Relation<Balance>;

  @Field()
  active: boolean;

  @Field()
  createdAt: string;

  @Field({ nullable: true })
  updatedAt: string;

  @Field({ nullable: true })
  closedAt: string;

  user: number;
}

@ObjectType()
export class Balance {
  @Field()
  id: number;

  @Field()
  balance: number;

  @Field()
  active: boolean;

  @Field()
  createdAt: string;

  account: Account;
}

export class Accounts extends ListObject(Account) {}

@InputType()
export class CreateAccount {
  @Field()
  name: string;

  @Field()
  balance: number;

  user: number;
}

@InputType()
export class UpdateAccount extends CreateAccount {
  @Field()
  id: number;
}
