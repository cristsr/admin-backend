import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import {
  Status,
  SubcategoriesInput,
  Subcategory,
  SubcategoryInput,
} from '@core';
import { Observable } from 'rxjs';
import { SubcategoryService } from 'app/modules/subcategory/services';

@Controller('subcategories')
export class SubcategoryController {
  constructor(private subcategoryService: SubcategoryService) {}

  @Get(':id')
  findOne(@Param('id') id: number): Observable<Subcategory> {
    return this.subcategoryService.findOne({ id });
  }

  @Get('category/:id')
  findByCategory(@Param('id') id: number): Observable<Subcategory[]> {
    return this.subcategoryService.findByCategory({ id });
  }

  @Post()
  save(@Body() data: SubcategoryInput): Observable<Subcategory> {
    return this.subcategoryService.save(data);
  }

  @Post('batch')
  saveMany(@Body() input: SubcategoriesInput): Observable<Status> {
    return this.subcategoryService.saveMany(input);
  }

  @Delete(':id')
  remove(@Param('id') id: number): Observable<Status> {
    return this.subcategoryService.remove({ id });
  }
}
