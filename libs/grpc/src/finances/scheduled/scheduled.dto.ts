import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Movement, MovementInput } from '../movement';

@ObjectType()
export class Scheduled extends Movement {
  @Field()
  recurrent: string;
}

@InputType()
export class ScheduledInput extends MovementInput {
  @Field()
  recurrent: string; // TODO: replace to bool
}

@InputType()
export class UpdateScheduled extends ScheduledInput {
  @Field()
  recurrent: string;
}

@InputType()
export class ScheduledFilter {
  @Field({ nullable: true })
  account: number;
}
