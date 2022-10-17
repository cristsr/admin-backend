import { MovementHandler } from 'app/movement/handlers';
import { GrpcMethod, GrpcService } from '@nestjs/microservices';
import { forkJoin, from, Observable, switchMap } from 'rxjs';
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
import { NotFoundException } from '@nestjs/common';
import { CategoryEntity } from 'app/category/entities';
import { InjectRepository } from '@nestjs/typeorm';
import { MovementEntity } from 'app/movement/entities';
import { Repository } from 'typeorm';
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
    return from(this.movementHandler.findAll(filters));
  }

  @GrpcMethod()
  findOne(movement: Id): Observable<Movement> {
    return from(this.movementHandler.findOne(movement.id));
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

    const subcategory = this.subcategoryRepository
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

    const account = this.accountRepository
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
  update(movement: UpdateMovement): Observable<Movement> {
    return from(this.movementHandler.update(movement));
  }

  @GrpcMethod()
  remove(movement: Id): Observable<Status> {
    return from(this.movementHandler.remove(movement.id));
  }

  @GrpcMethod()
  removeAll() {
    return from(this.movementHandler.removeAll());
  }
}
