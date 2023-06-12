import { GrpcMethod, GrpcService } from '@nestjs/microservices';
import {
  defer,
  forkJoin,
  from,
  map,
  Observable,
  of,
  switchMap,
  tap,
} from 'rxjs';
import {
  ScheduledInput,
  Id,
  Scheduled,
  ScheduledFilter,
  ScheduledGrpc,
  Status,
} from '@admin-back/grpc';
import { Logger, NotFoundException } from '@nestjs/common';
import { AccountRepository } from 'app/account/repositories';
import { CategoryRepository } from 'app/category/repositories';
import { SubcategoryRepository } from 'app/subcategory/repositories';
import { ScheduledRepository } from 'app/scheduled/repositories';
import { DateTime } from 'luxon';
import { Between } from 'typeorm';
import { MovementRepository } from 'app/movement/repositories';

@GrpcService('finances')
export class ScheduledService implements ScheduledGrpc {
  #logger = new Logger(ScheduledService.name);

  constructor(
    private categoryRepository: CategoryRepository,
    private subcategoryRepository: SubcategoryRepository,
    private scheduledRepository: ScheduledRepository,
    private movementRepository: MovementRepository,
    private accountRepository: AccountRepository
  ) {}

  @GrpcMethod()
  findOne(scheduledId: Id): Observable<Scheduled> {
    return from(
      this.scheduledRepository.findOne({
        where: scheduledId,
        relations: ['category', 'subcategory'],
      })
    );
  }

  @GrpcMethod()
  findAll(filter: ScheduledFilter): Observable<Scheduled[]> {
    return defer(() =>
      this.scheduledRepository.find({
        where: {
          account: { id: filter.account },
          active: filter.active,
        },
        relations: ['category', 'subcategory'],
      })
    );
  }

  @GrpcMethod()
  save(data: ScheduledInput): Observable<Scheduled> {
    const scheduled = defer(() =>
      this.scheduledRepository.findOne({
        where: {
          id: data.id,
        },
      })
    );

    const category = defer(() =>
      this.categoryRepository.findOne({
        where: {
          id: data.category,
        },
      })
    );

    const subcategory = defer(() =>
      this.subcategoryRepository.findOne({
        where: {
          id: data.subcategory,
        },
      })
    );

    const account = defer(() =>
      this.accountRepository.findOne({
        where: {
          id: data.account,
        },
      })
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
        })
      ),
      map((v) => new Scheduled(v))
    );
  }

  @GrpcMethod()
  remove(scheduledId: Id): Observable<Status> {
    return from(this.scheduledRepository.delete(scheduledId)).pipe(
      map((res) => ({ status: !!res.affected }))
    );
  }

  async generateMovements(): Promise<void> {
    this.#logger.log(`Generating movements`);

    const utc = DateTime.utc();

    const records = await this.scheduledRepository.find({
      where: {
        date: Between(
          utc.startOf('minute').toJSDate(),
          utc.endOf('minute').toJSDate()
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
