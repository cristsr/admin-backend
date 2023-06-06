import { NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { GrpcMethod, GrpcService } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { defer, forkJoin, map, Observable, of, switchMap, tap } from 'rxjs';
import { Between, DeleteResult, In, Raw, Repository } from 'typeorm';
import { Interval } from 'luxon';
import {
  MovementInput,
  Id,
  Movement,
  MovementFilter,
  MovementGrpc,
  Status,
} from '@admin-back/grpc';
import { CategoryEntity } from 'app/category/entities';
import { MovementEntity } from 'app/movement/entities';
import { SubcategoryEntity } from 'app/subcategory/entities';
import { AccountEntity } from 'app/account/entities';
import { SaveMovement } from 'app/constants';

@GrpcService('finances')
export class MovementService implements MovementGrpc {
  constructor(
    @InjectRepository(MovementEntity)
    private movementRepository: Repository<MovementEntity>,

    @InjectRepository(CategoryEntity)
    private categoryRepository: Repository<CategoryEntity>,

    @InjectRepository(SubcategoryEntity)
    private subcategoryRepository: Repository<SubcategoryEntity>,

    @InjectRepository(AccountEntity)
    private accountRepository: Repository<AccountEntity>,

    private eventEmitter: EventEmitter2
  ) {}

  @GrpcMethod()
  findAll(filter: MovementFilter): Observable<Movement[]> {
    const dateMap: Record<string, any> = {
      daily: () => filter.date,

      weekly: () => {
        const interval = Interval.fromISO(filter.date);
        return Between(interval.start.toSQLDate(), interval.end.toSQLDate());
      },

      monthly: () => {
        return Raw((alias) => `to_char(${alias}, 'YYYY-MM') = :date`, {
          date: filter.date,
        });
      },

      yearly: () => {
        return Raw((alias) => `to_char(${alias}, 'YYYY') = :date`, {
          date: filter.date,
        });
      },
    };

    // Execute query
    return defer(() =>
      this.movementRepository.find({
        where: {
          date: dateMap[filter.period](),
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
        defer(() =>
          this.movementRepository.save({
            ...e.movement,
            ...data,
            category: e.category,
            subcategory: e.subcategory,
            account: e.account,
          })
        ).pipe(
          tap((movement) => {
            this.eventEmitter.emit(SaveMovement, {
              previous: e.movement,
              current: movement,
            });
          })
        )
      )
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
