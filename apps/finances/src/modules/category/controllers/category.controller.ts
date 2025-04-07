import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { CategoriesInput, Category, CategoryInput, Status } from '@core';
import { Observable } from 'rxjs';
import { CategoryService } from 'app/modules/category/services';

@Controller('categories')
export class CategoryController {
  constructor(private categoryService: CategoryService) {}

  @Get(':id')
  findOne(@Param('id') id: number) {
    return this.categoryService.findOne({ id });
  }

  @Get()
  findAll() {
    return this.categoryService.findAll();
  }

  @Post()
  save(@Body() input: CategoryInput): Observable<Category> {
    return this.categoryService.save(input);
  }

  @Post('batch')
  saveMany(@Body() input: CategoriesInput): Observable<Status> {
    return this.categoryService.saveMany(input);
  }

  @Delete(':id')
  remove(@Param('id') id: number) {
    return this.categoryService.remove({ id });
  }

  @Delete()
  removeAll() {
    return this.categoryService.removeAll();
  }
}
