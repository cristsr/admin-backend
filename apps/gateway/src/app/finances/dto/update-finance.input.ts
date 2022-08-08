import { CreateFinanceInput } from './create-finance.input';
import { InputType, Field, Int, PartialType } from '@nestjs/graphql';

@InputType()
export class UpdateFinanceInput extends PartialType(CreateFinanceInput) {
  @Field(() => Int)
  id: number;
}
