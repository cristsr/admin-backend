import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { ListObject } from '@admin-back/shared';
import { Movement, CreateMovement, UpdateMovement } from '../movement';

@ObjectType()
export class Scheduled extends Movement {
  @Field()
  recurrent: string;
}

@ObjectType()
export class Scheduleds extends ListObject(Scheduled) {}

@InputType()
export class CreateScheduled extends CreateMovement {
  @Field()
  recurrent: string;
}

@InputType()
export class UpdateScheduled extends UpdateMovement {
  @Field()
  recurrent: string;
}
