import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { ListObject, OmitInputType } from '@admin-back/shared';
// Short import to prevent undefined import error
import { Movement, CreateMovement, UpdateMovement } from '../movement';

@ObjectType()
export class Scheduled extends Movement {
  @Field()
  recurrent: string;
}

@ObjectType()
export class Scheduleds extends ListObject(Scheduled) {}

@InputType()
export class CreateScheduled extends OmitInputType(CreateMovement, []) {
  @Field()
  recurrent: string;
}

@InputType()
export class UpdateScheduled extends OmitInputType(UpdateMovement, []) {
  @Field()
  recurrent: string;
}
