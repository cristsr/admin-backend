import { GrpcMethod, GrpcService } from '@nestjs/microservices';
import {
  CategoryGrpc,
  Categories,
  Category,
  CreateCategories,
  CreateCategory,
  UpdateCategory,
  Status,
  Id,
} from '@admin-back/grpc';
import {
  catchError,
  forkJoin,
  from,
  map,
  Observable,
  of,
  switchMap,
} from 'rxjs';
import { InjectRepository } from '@nestjs/typeorm';
import { CategoryEntity } from 'app/category/entities';
import { Repository } from 'typeorm';
import { SubcategoryEntity } from 'app/subcategory/entities';
import { NotFoundException } from '@nestjs/common';

@GrpcService('finances')
export class CategoryService implements CategoryGrpc {
  constructor(
    @InjectRepository(CategoryEntity)
    private categoryRepository: Repository<CategoryEntity>,

    @InjectRepository(SubcategoryEntity)
    private subcategoryRepository: Repository<SubcategoryEntity>
  ) {}

  @GrpcMethod()
  findOne(categoryId: Id): Observable<Category> {
    const category = this.categoryRepository.findOneOrFail({
      where: categoryId,
    });

    return from(category);
  }

  @GrpcMethod()
  findAll(): Observable<Categories> {
    const categories = this.categoryRepository.find({
      relations: ['subcategories'],
    });

    return from(categories).pipe(map((data) => ({ data })));
  }

  @GrpcMethod()
  create(data: CreateCategory): Observable<Category> {
    const category = this.categoryRepository.save({
      name: data.name,
      icon: data.icon,
      color: data.color,
    });

    if (!data.subcategories?.length) {
      return from(category);
    }

    return from(category).pipe(
      switchMap((category) => {
        const records = data.subcategories.map((v) => {
          return this.subcategoryRepository.create({
            ...v,
            category,
          });
        });

        return from(this.subcategoryRepository.save(records)).pipe(
          map((subcategories: SubcategoryEntity[]) => ({
            ...category,
            subcategories,
          }))
        );
      })
    );
  }

  @GrpcMethod()
  createMany(categories: CreateCategories): Observable<Status> {
    const source$ = categories.data.map((category) => this.create(category));

    return forkJoin(source$).pipe(
      map(() => ({ status: true })),
      catchError(() => of({ status: false }))
    );
  }

  @GrpcMethod()
  update(data: UpdateCategory): Observable<Category> {
    this.categoryRepository.findOneByOrFail({ id: data.id }).catch(() => {
      throw new NotFoundException('Category not found');
    });

    return from(this.categoryRepository.save(data));
  }

  @GrpcMethod()
  remove(category: Id): Observable<Status> {
    const query = this.categoryRepository.delete(category.id);

    return from(query).pipe(
      map((result) => ({
        status: !!result.affected,
      }))
    );
  }

  @GrpcMethod()
  removeAll(): Observable<Status> {
    return from(this.categoryRepository.clear()).pipe(
      map(() => ({ status: true })),
      catchError(() => of({ status: false }))
    );
  }
}
