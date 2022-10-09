import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MovementCreated, MovementUpdated } from '@admin-back/grpc';
import { EntityEvent } from '@admin-back/shared';
import { MovementEntity } from 'app/movement/entities';
import { BalanceEntity } from 'app/account/entities';

@Injectable()
export class MovementSubscriber {
  constructor(
    @InjectRepository(BalanceEntity)
    private balance: Repository<BalanceEntity>,

    @InjectRepository(MovementEntity)
    private movement: Repository<MovementEntity>
  ) {}

  @OnEvent(MovementCreated)
  afterInsert(event: EntityEvent<MovementEntity>): Promise<void> {
    return this.updateBalance(event.entity);
  }

  @OnEvent(MovementUpdated)
  afterUpdate(event: EntityEvent<MovementEntity>): Promise<void> {
    const prev = event.databaseEntity;
    const curr = event.entity;

    // Casos
    // No hay diferencias entre tipo y cantidad entre la version anterior y la nueva
    if (prev.amount === curr.amount && prev.type === curr.type) {
      return;
    }

    return this.updateBalance(curr);
  }

  async updateBalance(movement: MovementEntity): Promise<void> {
    const account = { id: movement.account.id };

    // Get current active balance
    const balance = await this.balance.findOne({
      where: {
        account,
        user: movement.user,
        active: true,
      },
    });

    console.log('Current balance', balance);

    // Disable latest balance
    await this.balance.save({
      id: balance.id,
      active: false,
    });

    // TODO add active field in movement
    const query = this.movement
      .createQueryBuilder()
      .select([
        "coalesce(sum(case when type = 'income'  then amount end)::real, 0) incomes",
        "coalesce(sum(case when type = 'expense' then amount end)::real, 0) expenses",
      ])
      .where('user_id = :user and account_id = :account', {
        user: movement.user,
        account: account.id,
      });

    const { incomes, expenses } = await query.getRawOne();

    console.log('incomes expenses', incomes, expenses);

    const total =
      movement.type === 'income'
        ? balance.balance + movement.amount
        : balance.balance - movement.amount;

    // Create new active balance
    await this.balance.save({
      balance: total,
      incomes,
      expenses,
      account,
      user: balance.user,
    });
  }
}
