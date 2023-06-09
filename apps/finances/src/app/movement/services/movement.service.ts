import { Body, NotFoundException } from '@nestjs/common';
import {
  BaseRpcContext,
  Ctx,
  GrpcMethod,
  GrpcService,
  Payload,
} from '@nestjs/microservices';
import { defer, forkJoin, map, Observable, of, switchMap, tap } from 'rxjs';
import { Between, DeleteResult, In, Raw } from 'typeorm';
import { DateTime, Interval } from 'luxon';
import {
  MovementInput,
  Id,
  Movement,
  MovementFilter,
  MovementGrpc,
  Status,
  Period,
} from '@admin-back/grpc';
import { AccountRepository } from 'app/account/repositories';
import { MovementRepository } from 'app/movement/repositories';
import { CategoryRepository } from 'app/category/repositories';
import { SubcategoryRepository } from 'app/subcategory/repositories';
import { Context, CurrentUser, Match, metaToPlain } from '@admin-back/shared';
import { Metadata, ServerUnaryCall } from '@grpc/grpc-js';

@GrpcService('finances')
export class MovementService implements MovementGrpc {
  constructor(
    private movementRepository: MovementRepository,
    private categoryRepository: CategoryRepository,
    private subcategoryRepository: SubcategoryRepository,
    private accountRepository: AccountRepository
  ) {}

  @GrpcMethod()
  findAll(
    @Body() filter: MovementFilter,
    // @Ctx() context: BaseRpcContext,
    @CurrentUser() headers: any
  ): Observable<Movement[]> {
    // console.log(filter);
    // console.log(headers);
    // // const { clientTimeZone } = metaToPlain(metadata);
    const clientTimeZone = 'America/Bogota';

    // console.log(clientTimeZone);

    const periodMatch: Match<Period> = {
      DAILY: () => {
        const date = DateTime.fromFormat(filter.date, 'yyyy-MM-dd').setZone(
          clientTimeZone
        );

        return Between(
          date.startOf('day').toJSDate(),
          date.endOf('day').toJSDate()
        );
      },

      WEEKLY: () => {
        const { start, end } = Interval.fromISO(filter.date);
        return Between(start.toSQLDate(), end.toSQLDate());
      },

      MONTHLY: () => {
        return Raw((alias) => `to_char(${alias}, 'YYYY-MM') = :date`, {
          date: filter.date,
        });
      },

      YEARLY: () => {
        return Raw((alias) => `to_char(${alias}, 'YYYY') = :date`, {
          date: filter.date,
        });
      },

      CUSTOM: () => {
        const { start, end } = Interval.fromISO(filter.date);
        return Between(start.toSQLDate(), end.toSQLDate());
      },
    };

    // Execute query
    return defer(() =>
      this.movementRepository.find({
        where: {
          date: periodMatch[filter.period](),
          category: { id: filter.category },
          account: { id: filter.account },
          type: filter.type?.length ? In(filter.type) : null,
        },
        order: {
          date: 'DESC',
          createdAt: 'DESC',
        },
        relations: ['category', 'subcategory'],
      })
    );
  }

  @GrpcMethod()
  findOne(movementId: Id): Observable<Movement> {
    return defer(() =>
      this.movementRepository.findOne({
        where: movementId,
        relations: ['category', 'subcategory'],
      })
    );
  }

  @GrpcMethod()
  save(data: MovementInput): Observable<Movement> {
    console.log('Date due', data.date);

    const movement = defer(() =>
      this.movementRepository.findOne({
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
          category: {
            id: data.category,
          },
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

    // Do search in parallel
    const source$ = forkJoin({
      movement: data.id ? movement : of(null),
      category,
      subcategory,
      account,
    });

    return source$.pipe(
      tap((e) => {
        if (data.id && !e.movement) {
          throw new NotFoundException(`Movement not found`);
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
        this.movementRepository.save({
          ...e.movement,
          ...data,
          category: e.category,
          subcategory: e.subcategory,
          account: e.account,
        })
      ),
      map((m) => new Movement(m))
    );
  }

  @GrpcMethod()
  remove(movement: Id): Observable<Status> {
    return defer(() => this.movementRepository.delete(movement.id)).pipe(
      map((data: DeleteResult) => ({
        status: !!data.affected,
      }))
    );
  }

  @GrpcMethod()
  removeAll() {
    return defer(() => this.movementRepository.clear()).pipe(
      map(() => ({
        status: true,
      }))
    );
  }
}
