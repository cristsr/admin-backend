import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CategoryEntity } from 'app/category/entities';
import {
  Categories,
  Category,
  CreateCategory,
  Status,
  UpdateCategory,
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
import { SubcategoryEntity } from 'app/subcategory/entities';

@Injectable()
export class CategoryHandler {
  constructor(
    @InjectRepository(CategoryEntity)
    private categoryRepository: Repository<CategoryEntity>,

    @InjectRepository(SubcategoryEntity)
    private subcategoryRepository: Repository<SubcategoryEntity>
  ) {}

  create(data: CreateCategory): Observable<Category> {
    const category = this.categoryRepository
      .save({
        name: data.name,
        icon: data.icon,
        color: data.color,
      })
      .catch((err) => {
        throw new InternalServerErrorException(err);
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

        // TODO: refactor in order to return promise instead of observable
        return from(this.subcategoryRepository.save(records)).pipe(
          map((subcategories) => ({
            ...category,
            subcategories,
          }))
        );
      })
    );
  }

  createMany(categories: CreateCategory[]): Observable<Status> {
    const query = categories.map((category) => this.create(category));

    return forkJoin(query).pipe(
      map(() => ({ status: true })),
      catchError(() => of({ status: false }))
    );
  }

  findAll(): Observable<Categories> {
    const categories = this.categoryRepository.find({
      relations: ['subcategories'],
    });

    return from(categories).pipe(map((data) => ({ data })));
  }

  findOne(id: number): Observable<Category> {
    const category = this.categoryRepository.findOneOrFail({
      relations: ['subcategories'],
      where: { id },
    });

    return from(category);
  }

  update(data: UpdateCategory): Observable<Category> {
    if (!this.categoryRepository.findOneByOrFail({ id: data.id })) {
      throw new NotFoundException('Category not found');
    }

    return from(this.categoryRepository.save(data));
  }

  remove(id: number): Observable<Status> {
    const query = this.categoryRepository.delete(id).then((result) => ({
      status: !!result.affected,
    }));

    return from(query);
  }

  removeAll(): Observable<Status> {
    return from(this.categoryRepository.delete({})).pipe(
      map(() => ({ status: true })),
      catchError(() => of({ status: false }))
    );
  }
}
