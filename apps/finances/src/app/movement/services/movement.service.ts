import { NotFoundException } from '@nestjs/common';
import { GrpcMethod, GrpcService } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { forkJoin, from, map, Observable, switchMap } from 'rxjs';
import { Between, DeleteResult, In, Raw, Repository } from 'typeorm';
import { Interval } from 'luxon';
import {
  CreateMovement,
  Id,
  Movement,
  MovementFilter,
  MovementGrpc,
  Movements,
  Status,
  UpdateMovement,
} from '@admin-back/grpc';
import { MovementHandler } from 'app/movement/handlers';
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
    private accountRepository: Repository<AccountEntity>,

    private readonly movementHandler: MovementHandler
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
    const movements: Promise<MovementEntity[]> = this.movementRepository.find({
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
    });

    return from(movements).pipe(map((data: MovementEntity[]) => ({ data })));
  }

  @GrpcMethod()
  findOne(movementId: Id): Observable<Movement> {
    const movement: Promise<MovementEntity> = this.movementRepository.findOne({
      where: movementId,
      relations: ['category', 'subcategory'],
    });

    return from(movement);
  }

  @GrpcMethod()
  create(data: CreateMovement): Observable<Movement> {
    const category: Promise<CategoryEntity> = this.categoryRepository
      .findOneOrFail({
        where: {
          id: data.category,
        },
      })
      .catch(() => {
        throw new NotFoundException(`Category not found`);
      });

    const subcategory: Promise<SubcategoryEntity> = this.subcategoryRepository
      .findOneOrFail({
        where: {
          id: data.subcategory,
          category: {
            id: data.category,
          },
        },
      })
      .catch(() => {
        throw new NotFoundException(`Subcategory not found`);
      });

    const account: Promise<AccountEntity> = this.accountRepository
      .findOneOrFail({
        where: {
          id: data.account,
        },
      })
      .catch(() => {
        throw new NotFoundException(`Account not found`);
      });

    // Do search in parallel
    const source$ = forkJoin({
      category,
      subcategory,
      account,
    });

    return source$.pipe(
      switchMap(({ category, subcategory, account }) => {
        return this.movementRepository.save({
          ...data,
          category,
          subcategory,
          account,
        });
      })
    );
  }

  @GrpcMethod()
  update(data: UpdateMovement): Observable<Movement> {
    return from(this.movementHandler.update(data));
  }

  @GrpcMethod()
  remove(movement: Id): Observable<Status> {
    const result: Promise<DeleteResult> = this.movementRepository.delete(
      movement.id
    );

    return from(result).pipe(
      map((data: DeleteResult) => ({
        status: !!data.affected,
      }))
    );
  }

  @GrpcMethod()
  removeAll() {
    return from(this.movementRepository.clear()).pipe(
      map(() => ({
        status: true,
      }))
    );
  }
}
