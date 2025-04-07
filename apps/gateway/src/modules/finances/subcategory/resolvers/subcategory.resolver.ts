import { HttpService } from '@nestjs/axios';
import { Inject } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Status } from '@core';
import { Observable, map } from 'rxjs';
import { FINANCES_API } from 'app/modules/finances/constants';
import {
  SubcategoriesInputImp,
  SubcategoryImp,
  SubcategoryInputImp,
} from 'app/modules/finances/subcategory/dto';

@Resolver(SubcategoryImp)
export class SubcategoryResolver {
  constructor(
    @Inject(FINANCES_API)
    private http: HttpService,
  ) {}

  @Query(() => SubcategoryImp)
  subcategory(@Args('id') id: number): Observable<SubcategoryImp> {
    return this.http
      .get<SubcategoryImp>(`/subcategories/${id}`)
      .pipe(map((response) => response.data));
  }

  @Query(() => [SubcategoryImp])
  subcategories(
    @Args('category') category: number,
  ): Observable<SubcategoryImp[]> {
    return this.http
      .get<SubcategoryImp[]>(`/subcategories/category/${category}`)
      .pipe(map((response) => response.data));
  }

  @Mutation(() => SubcategoryImp)
  saveSubcategory(
    @Args('subcategory')
    subcategory: SubcategoryInputImp,
  ): Observable<SubcategoryImp> {
    return this.http
      .post<SubcategoryImp>(`/subcategories`, subcategory)
      .pipe(map((response) => response.data));
  }

  @Mutation(() => Status)
  saveSubcategories(
    @Args('subcategories')
    subcategories: SubcategoriesInputImp,
  ): Observable<Status> {
    return this.http
      .post<Status>(`/subcategories/batch`, subcategories)
      .pipe(map((response) => response.data));
  }

  //TODO: update status
  @Mutation(() => Status)
  removeSubcategory(@Args('id') id: number): Observable<Status> {
    return this.http
      .delete<Status>(`/subcategories/${id}`)
      .pipe(map((response) => response.data));
  }
}
