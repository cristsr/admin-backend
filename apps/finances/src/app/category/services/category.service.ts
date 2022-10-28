import { GrpcMethod, GrpcService } from '@nestjs/microservices';
import { NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  catchError,
  defer,
  finalize,
  from,
  map,
  Observable,
  of,
  switchMap,
  tap,
} from 'rxjs';
import {
  CategoryGrpc,
  Categories,
  Category,
  CategoriesInput,
  CategoryInput,
  Status,
  Id,
} from '@admin-back/grpc';
import { CategoryEntity } from 'app/category/entities';
import { SubcategoryEntity } from 'app/subcategory/entities';

@GrpcService('finances')
export class CategoryService implements CategoryGrpc {
  constructor(
    @InjectRepository(CategoryEntity)
    private categoryRepository: Repository<CategoryEntity>,

    @InjectRepository(SubcategoryEntity)
    private subcategoryRepository: Repository<SubcategoryEntity>,

    private dataSource: DataSource
  ) {}

  @GrpcMethod()
  findOne(categoryId: Id): Observable<Category> {
    return defer(() => this.categoryRepository.findOne({ where: categoryId }));
  }

  @GrpcMethod()
  findAll(): Observable<Categories> {
    const categories$ = defer(() =>
      this.categoryRepository.find({
        relations: ['subcategories'],
      })
    );

    return categories$.pipe(map((data) => ({ data })));
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
        if (!category) {
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
