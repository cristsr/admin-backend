import { GrpcMethod, GrpcService } from '@nestjs/microservices';
import { defer, forkJoin, map, Observable, of, switchMap, tap } from 'rxjs';
import {
  SubcategoryGrpc,
  SubcategoryInput,
  CreateSubcategories,
  Status,
  Subcategory,
  Subcategories,
  Id,
} from '@admin-back/grpc';
import { InjectRepository } from '@nestjs/typeorm';
import { CategoryEntity } from 'app/category/entities';
import { Repository } from 'typeorm';
import { SubcategoryEntity } from 'app/subcategory/entities';
import { NotFoundException } from '@nestjs/common';

@GrpcService('finances')
export class SubcategoryService implements SubcategoryGrpc {
  constructor(
    @InjectRepository(CategoryEntity)
    private categoryRepository: Repository<CategoryEntity>,

    @InjectRepository(SubcategoryEntity)
    private subcategoryRepository: Repository<SubcategoryEntity>
  ) {}

  @GrpcMethod()
  findOne(subcategoryId: Id): Observable<Subcategory> {
    return defer(() => this.subcategoryRepository.findOneBy(subcategoryId));
  }

  @GrpcMethod()
  findByCategory(categoryId: Id): Observable<Subcategories> {
    console.log('findByCategory', categoryId);
    const query$ = defer(() => {
      return this.subcategoryRepository.find({
        where: {
          category: categoryId,
        },
      });
    });

    return query$.pipe(map((data) => ({ data })));
  }

  @GrpcMethod()
  save(data: SubcategoryInput): Observable<Subcategory> {
    const subcategory = defer(() =>
      this.subcategoryRepository.findOne({
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

    const source$ = forkJoin({
      subcategory: data.id ? subcategory : of(null),
      category,
    });

    return source$.pipe(
      tap((e) => {
        if (data.id && !e.subcategory) {
          throw new NotFoundException('Subcategory not found');
        }

        if (!e.category) {
          throw new NotFoundException('Category not found');
        }
      }),
      switchMap((e) =>
        this.subcategoryRepository.save({
          ...e.subcategory,
          name: data.name,
          category: e.category,
        })
      )
    );
  }

  @GrpcMethod()
  saveMany(data: CreateSubcategories): Observable<Status> {
    const records = data.data.map((subcategory) => ({
      ...subcategory,
      category: { id: data.category },
    }));

    return defer(() => this.subcategoryRepository.insert(records)).pipe(
      map(() => ({ status: true }))
    );
  }

  @GrpcMethod()
  remove(subcategoryId: Id): Observable<Status> {
    return defer(() => this.subcategoryRepository.delete(subcategoryId)).pipe(
      map((res) => {
        if (res.affected) {
          return {
            status: true,
          };
        }

        return {
          status: false,
        };
      })
    );
  }
}
