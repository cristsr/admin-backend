import { Field, InputType, ObjectType } from '@nestjs/graphql';
import {
  MovementInput,
  Scheduled,
  ScheduledFilter,
  ScheduledInput,
} from '@admin-back/core';
import { MovementImp } from 'app/finances/movement/dto';

@ObjectType(Scheduled.name)
export class ScheduledImp extends MovementImp implements Scheduled {
  @Field()
  repeat: boolean;
}

@InputType(ScheduledInput.name)
export class ScheduledInputImp extends MovementInput implements ScheduledInput {
  @Field()
  repeat: boolean;
}

@InputType(ScheduledFilter.name)
export class ScheduledFilterImp implements ScheduledFilter {
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
