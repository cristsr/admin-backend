import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Movement, MovementInput } from '../movement';

@ObjectType()
export class Scheduled extends Movement {
  @Field()
  repeat: boolean;
}

@InputType()
export class ScheduledInput extends MovementInput {
  @Field()
  repeat: boolean;
}

@InputType()
export class ScheduledFilter {
  @Field()
  account: number;

  @Field()
  active: boolean;
}
