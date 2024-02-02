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

  @Field()
  period: string;

  @Field()
  startDate: string;

  @Field()
  endDate: string;

  @Field({ nullable: true })
  category?: number;

  @Field(() => [String], { nullable: true })
  type?: string[];

  @Field({ nullable: true })
  order?: string;
}
