import { HttpService } from '@nestjs/axios';
import { Inject } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Status } from '@core';
import { Observable, map } from 'rxjs';
import {
  CategoriesInputImp,
  CategoryImp,
  CategoryInputImp,
} from 'app/modules/finances/category/dto/category.dto';
import { FINANCES_API } from 'app/modules/finances/constants';

@Resolver(CategoryImp)
export class CategoryResolver {
  constructor(
    @Inject(FINANCES_API)
    private http: HttpService,
  ) {}

  @Query(() => CategoryImp)
  category(user, @Args('id') id: number) {
    return this.http
      .get<CategoryImp>(`/categories/${id}`)
      .pipe(map((response) => response.data));
  }

  @Query(() => [CategoryImp])
  categories(): Observable<CategoryImp[]> {
    return this.http
      .get<CategoryImp[]>(`/categories`)
      .pipe(map((response) => response.data));
  }

  @Mutation(() => CategoryImp)
  saveCategory(
    @Args('category')
    category: CategoryInputImp,
  ): Observable<CategoryImp> {
    return this.http
      .post<CategoryImp>(`/categories`, category)
      .pipe(map((response) => response.data));
  }

  @Mutation(() => Status)
  saveCategories(
    @Args('categories')
    categories: CategoriesInputImp,
  ): Observable<Status> {
    return this.http
      .post<Status>(`/categories/batch`, categories)
      .pipe(map((response) => response.data));
  }

  // TODO: update status
  @Mutation(() => Status)
  removeCategory(@Args('id') id: number): Observable<Status> {
    return this.http
      .delete<Status>(`/categories/${id}`)
      .pipe(map((response) => response.data));
  }

  @Mutation(() => Status)
  removeCategories(): Observable<Status> {
    return this.http
      .delete<Status>(`/categories`)
      .pipe(map((response) => response.data));
  }
}
