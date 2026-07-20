import { Injectable } from '@nestjs/common';
import { Nullable } from '@shared';
import { Balance, SummaryRepository } from '@app/summary/domain/summary';
import { BalanceFilterDto } from '../dto/balance-filter.dto';

@Injectable()
export class GetBalanceUsecase {
  constructor(private readonly summaryRepository: SummaryRepository) {}

  async execute(
    filter: BalanceFilterDto,
    user: number,
  ): Promise<Nullable<Balance>> {
    return this.summaryRepository.balance({ ...filter, user });
  }
}
