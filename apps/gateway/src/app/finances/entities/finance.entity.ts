import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
export class Finance {
  @Field(() => Int, { description: 'Example field (placeholder)' })
  exampleField: number;
}
