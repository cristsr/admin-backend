import { NotFoundException } from '@nestjs/common';
import { GrpcMethod, GrpcService } from '@nestjs/microservices';
import {
  Observable,
  catchError,
  defer,
  finalize,
  from,
  map,
  of,
  switchMap,
  tap,
} from 'rxjs';
import { DataSource } from 'typeorm';
import {
  CategoriesInput,
  Category,
  CategoryGrpc,
  CategoryInput,
  Id,
  Status,
} from '@admin-back/grpc';
import { CategoryEntity } from 'app/category/entities';
import { CategoryRepository } from 'app/category/repositories';
import { SubcategoryRepository } from 'app/subcategory/repositories';

@GrpcService('finances')
export class CategoryService implements CategoryGrpc {
  constructor(
    private categoryRepository: CategoryRepository,
    private subcategoryRepository: SubcategoryRepository,
    private dataSource: DataSource
  ) {}

  @GrpcMethod()
  findOne(categoryId: Id): Observable<Category> {
    console.log('categoryId', categoryId);
    return defer(() =>
      this.categoryRepository.findOne({ where: categoryId }).then((v) => {
        console.log('category', v);
        return v;
      })
    );
  }

  @GrpcMethod()
  findAll(): Observable<Category[]> {
    return defer(() =>
      this.categoryRepository.find({
        relations: ['subcategories'],
      })
    );
  }

  @GrpcMethod()
  save(data: CategoryInput): Observable<Category> {
    const category$ = defer(() =>
      this.categoryRepository.findOneOrFail({
        where: {
          id: data.id,
        },
        relations: ['subcategories'],
      })
    );

    const source$ = data.id ? category$ : of(null);

    return source$.pipe(
      tap((category) => {
        if (data.id && !category) {
          throw new NotFoundException('Category not found');
        }
      }),
      switchMap((category: CategoryEntity) =>
        this.categoryRepository.save({
          ...category,
          name: data.name,
          icon: data.icon,
          color: data.color,
        })
      ),
      switchMap((category: CategoryEntity) => {
        if (data.id) {
          return of(category);
        }

        if (!data.subcategories?.length) {
          return of(category);
        }

        // Save subcategories
        const records = data.subcategories.map((v) => ({
          ...v,
          category,
        }));

        return this.subcategoryRepository
          .save(records)
          .then((subcategories) => ({
            ...category,
            subcategories,
          }));
      })
    );
  }

  @GrpcMethod()
  saveMany({ data }: CategoriesInput): Observable<Status> {
    const queryRunner = this.dataSource.createQueryRunner();

    return defer(() => queryRunner.connect()).pipe(
      switchMap(() => queryRunner.startTransaction()),
      switchMap(() =>
        queryRunner.manager.save(
          data.map((v) =>
            this.categoryRepository.create({
              name: v.name,
              icon: v.icon,
              color: v.color,
            })
          )
        )
      ),
      switchMap((categories) =>
        queryRunner.manager.save(
          data
            .map((d) => d.subcategories)
            .map((s, i) =>
              s.map((v) =>
                this.subcategoryRepository.create({
                  name: v.name,
                  category: categories[i],
                })
              )
            )
            .flat()
        )
      ),
      switchMap(() => queryRunner.commitTransaction()),
      map(() => ({ status: true })),
      catchError(() =>
        from(queryRunner.rollbackTransaction()).pipe(
          map(() => ({ status: false }))
        )
      ),
      finalize(() => queryRunner.release())
    );
  }

  @GrpcMethod()
  remove(category: Id): Observable<Status> {
    return defer(() => this.categoryRepository.delete(category.id)).pipe(
      map((result) => ({
        status: !!result.affected,
      }))
    );
  }

  @GrpcMethod()
  removeAll(): Observable<Status> {
    return defer(() => this.categoryRepository.clear()).pipe(
      map(() => ({ status: true })),
      catchError(() => of({ status: false }))
    );
  }
}
