import { Injectable } from '@nestjs/common';
import { CreateFinanceInput } from './dto/create-finance.input';
import { UpdateFinanceInput } from './dto/update-finance.input';

@Injectable()
export class FinancesService {
  create(createFinanceInput: CreateFinanceInput) {
    return 'This action adds a new finance';
  }

  findAll() {
    return `This action returns all finances`;
  }

  findOne(id: number) {
    return `This action returns a #${id} finance`;
  }

  update(id: number, updateFinanceInput: UpdateFinanceInput) {
    return `This action updates a #${id} finance`;
  }

  remove(id: number) {
    return `This action removes a #${id} finance`;
  }
}
