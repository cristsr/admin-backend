import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { FinancesService } from '../services/finances.service';
import { Finance } from '../entities/finance.entity';
import { CreateFinanceInput } from '../dto/create-finance.input';
import { UpdateFinanceInput } from '../dto/update-finance.input';

@Resolver(() => Finance)
export class FinancesResolver {
  constructor(private readonly financesService: FinancesService) {}

  @Mutation(() => Finance)
  createFinance(
    @Args('createFinanceInput') createFinanceInput: CreateFinanceInput
  ) {
    return this.financesService.create(createFinanceInput);
  }

  @Query(() => [Finance], { name: 'finances' })
  findAll() {
    return this.financesService.findAll();
  }

  @Query(() => Finance, { name: 'finance' })
  findOne(@Args('id', { type: () => Int }) id: number) {
    return this.financesService.findOne(id);
  }

  @Mutation(() => Finance)
  updateFinance(
    @Args('updateFinanceInput') updateFinanceInput: UpdateFinanceInput
  ) {
    return this.financesService.update(
      updateFinanceInput.id,
      updateFinanceInput
    );
  }

  @Mutation(() => Finance)
  removeFinance(@Args('id', { type: () => Int }) id: number) {
    return this.financesService.remove(id);
  }
}
