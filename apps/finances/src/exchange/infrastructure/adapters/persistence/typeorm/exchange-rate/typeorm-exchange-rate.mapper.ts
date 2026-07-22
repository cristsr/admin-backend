import { ExchangeRate } from '@app/exchange/domain';
import { TypeOrmExchangeRateEntity } from './typeorm-exchange-rate.entity';

export class TypeOrmExchangeRateMapper {
  static toDomain(entity: TypeOrmExchangeRateEntity): ExchangeRate {
    return ExchangeRate.create({
      id: entity.id,
      from: entity.from,
      to: entity.to,
      rate: entity.rate,
      date: entity.date,
    });
  }

  static toEntity(rate: ExchangeRate): Partial<TypeOrmExchangeRateEntity> {
    return {
      id: rate.id,
      from: rate.from,
      to: rate.to,
      rate: rate.rate,
      date: rate.date,
    };
  }
}
