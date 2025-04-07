import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  Scheduled,
  ScheduledFilter,
  ScheduledHandler,
  ScheduledInput,
  Status,
} from '@core';
import { DateTime } from 'luxon';
import { Observable, defer, forkJoin, map, of, switchMap, tap } from 'rxjs';
import { Between } from 'typeorm';
import { AccountRepository } from 'app/modules/account/repositories';
import { CategoryRepository } from 'app/modules/category/repositories';
import { MovementRepository } from 'app/modules/movement/repositories';
import { ScheduledRepository } from 'app/modules/scheduled/repositories';
import { SubcategoryRepository } from 'app/modules/subcategory/repositories';

@Injectable()
export class ScheduledService implements ScheduledHandler {
  #logger = new Logger(ScheduledService.name);

  constructor(
    private categoryRepository: CategoryRepository,
    private subcategoryRepository: SubcategoryRepository,
    private scheduledRepository: ScheduledRepository,
    private movementRepository: MovementRepository,
    private accountRepository: AccountRepository,
  ) {}

  async findOne({ id, user }: any): Promise<Scheduled> {
    return this.scheduledRepository.findOne({
      where: {
        id,
        user,
      },
      relations: ['category', 'subcategory'],
    });
  }

  async findAll(filter: ScheduledFilter): Promise<Scheduled[]> {
    return this.scheduledRepository.find({
      where: {
        account: { id: filter.account },
        active: filter.active,
      },
      relations: ['category', 'subcategory'],
    });
  }

  save(data: ScheduledInput): Observable<Scheduled> {
    const scheduled = defer(() =>
      this.scheduledRepository.findOne({
        where: {
          id: data.id,
        },
      }),
    );

    const category = defer(() =>
      this.categoryRepository.findOne({
        where: {
          id: data.category,
        },
      }),
    );

    const subcategory = defer(() =>
      this.subcategoryRepository.findOne({
        where: {
          id: data.subcategory,
        },
      }),
    );

    const account = defer(() =>
      this.accountRepository.findOne({
        where: {
          id: data.account,
        },
      }),
    );

    const source$ = forkJoin({
      scheduled: data.id ? scheduled : of(null),
      category,
      subcategory,
      account,
    });

    return source$.pipe(
      tap((e) => {
        if (data.id && !e.scheduled) {
          throw new NotFoundException(`Scheduled not found`);
        }

        if (!e.category) {
          throw new NotFoundException(`Category not found`);
        }

        if (!e.subcategory) {
          throw new NotFoundException(`Subcategory not found`);
        }

        if (!e.account) {
          throw new NotFoundException(`Account not found`);
        }
      }),
      switchMap((e) =>
        this.scheduledRepository.save({
          ...data,
          account: e.account,
          category: e.category,
          subcategory: e.subcategory,
        }),
      ),
      map((v) => new Scheduled(v)),
    );
  }

  async remove({ id, user }: any): Promise<Status> {
    const res = await this.scheduledRepository.delete({
      id,
      user,
    });
    return { status: !!res.affected };
  }

  async generateMovements(): Promise<void> {
    this.#logger.log(`Generating movements`);

    const utc = DateTime.utc();

    const records = await this.scheduledRepository.find({
      where: {
        date: Between(
          utc.startOf('minute').toJSDate(),
          utc.endOf('minute').toJSDate(),
        ),
        active: true,
        repeat: true,
      },
    });

    for (const schedule of records) {
      // Create Budget for the month
      await this.movementRepository
        .save({
          description: schedule.description,
          amount: schedule.amount,
          type: schedule.type,
          date: schedule.date,
          category: schedule.category,
          subcategory: schedule.subcategory,
          account: schedule.account,
          user: schedule.user,
        })
        .catch((error) => {
          this.#logger.error(`Error creating movement ${error.message}`);
        });
    }

    this.#logger.log('Movements generated');
  }
}
