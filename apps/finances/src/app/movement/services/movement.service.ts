import { NotFoundException } from '@nestjs/common';
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
  Movements,
  Status,
} from '@admin-back/grpc';
import { CategoryEntity } from 'app/category/entities';
import { MovementEntity } from 'app/movement/entities';
import { SubcategoryEntity } from 'app/subcategory/entities';
import { AccountEntity } from 'app/account/entities';

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
    private accountRepository: Repository<AccountEntity>
  ) {}

  @GrpcMethod()
  findAll(filters: MovementFilter): Observable<Movements> {
    const dateMap: Record<string, any> = {
      daily: () => filters.date,

      weekly: () => {
        const interval = Interval.fromISO(filters.date);
        return Between(interval.start.toSQLDate(), interval.end.toSQLDate());
      },

      monthly: () => {
        return Raw((alias) => `to_char(${alias}, 'YYYY-MM') = :date`, {
          date: filters.date,
        });
      },

      yearly: () => {
        return Raw((alias) => `to_char(${alias}, 'YYYY') = :date`, {
          date: filters.date,
        });
      },
    };

    // Execute query
    const movements = defer(() =>
      this.movementRepository.find({
        where: {
          date: dateMap[filters.period](),
          category: { id: filters.category },
          account: { id: filters.account },
          type: filters.type?.length ? In(filters.type) : null,
        },
        order: {
          date: 'DESC',
          createdAt: 'DESC',
        },
        relations: ['category', 'subcategory'],
      })
    );

    return movements.pipe(map((data: MovementEntity[]) => ({ data })));
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
        this.movementRepository.save({
          ...e.movement,
          ...data,
          category: e.category,
          subcategory: e.subcategory,
          account: e.account,
        })
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
