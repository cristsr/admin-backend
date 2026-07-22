import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Nullable } from '@shared';
import { Repository } from 'typeorm';
import { ExchangeRate, ExchangeRateRepository } from '@app/exchange/domain';
import { TypeOrmExchangeRateEntity } from './typeorm-exchange-rate.entity';
import { TypeOrmExchangeRateMapper } from './typeorm-exchange-rate.mapper';

@Injectable()
export class TypeOrmExchangeRateRepository implements ExchangeRateRepository {
  constructor(
    @InjectRepository(TypeOrmExchangeRateEntity)
    private readonly repository: Repository<TypeOrmExchangeRateEntity>,
  ) {}

  async findRate(from: string, to: string, date: Date): Promise<Nullable<ExchangeRate>> {
    const entity = await this.repository.findOne({
      where: { from, to, date },
    });

    if (!entity) return null;

    return TypeOrmExchangeRateMapper.toDomain(entity);
  }

  async save(rate: ExchangeRate): Promise<ExchangeRate> {
    const saved = await this.repository.save(TypeOrmExchangeRateMapper.toEntity(rate));

    return TypeOrmExchangeRateMapper.toDomain(saved as TypeOrmExchangeRateEntity);
  }
}
