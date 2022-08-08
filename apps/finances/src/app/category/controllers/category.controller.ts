import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Put,
  ParseIntPipe,
  ParseArrayPipe,
} from '@nestjs/common';
import { CategoryService } from 'app/category/services';
import { CreateSubcategoryPipe } from 'app/category/pipes';
import {
  CreateCategoryDto,
  CreateSubcategoryDto,
  UpdateCategoryDto,
} from 'app/category/dto';

@Controller({
  path: 'categories',
  version: '1',
})
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Post()
  create(
    @Body()
    createCategoryDto: CreateCategoryDto
  ) {
    return this.categoryService.create(createCategoryDto);
  }

  @Post('bulk')
  createMany(
    @Body(
      new ParseArrayPipe({
        items: CreateCategoryDto,
      })
    )
    createCategoryDto: CreateCategoryDto[]
  ) {
    return this.categoryService.createMany(createCategoryDto);
  }

  @Get()
  findAll() {
    return this.categoryService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.categoryService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCategoryDto: UpdateCategoryDto
  ): any {
    return this.categoryService.update(id, updateCategoryDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.categoryService.remove(id);
  }

  @Delete()
  removeAll(): any {
    return this.categoryService.removeAll();
  }

  @Post('/:id/subcategories')
  createSubcategory(
    @Param('id', ParseIntPipe) category: number,
    @Body(CreateSubcategoryPipe)
    createSubcategoryDto: CreateSubcategoryDto[]
  ) {
    return this.categoryService.createSubcategories(
      category,
      createSubcategoryDto
    );
  }

  @Get(':id/subcategories')
  findSubcategories(@Param('id', ParseIntPipe) id: number) {
    return this.categoryService.findSubcategories(id);
  }

  @Get(':id/subcategories/:idSub')
  findSubcategory(
    @Param('id', ParseIntPipe) category: number,
    @Param('idSub', ParseIntPipe) subcategory: number
  ) {
    return this.categoryService.findSubcategory(category, subcategory);
  }

  @Put(':id/subcategories/:idSub')
  updateSubcategory(
    @Param('id', ParseIntPipe) category: number,
    @Param('idSub', ParseIntPipe) subcategory: number,
    @Body() updateSubcategoryDto: UpdateCategoryDto
  ) {
    return this.categoryService.updateSubcategory(
      category,
      subcategory,
      updateSubcategoryDto
    );
  }

  @Delete(':id/subcategories/:idSub')
  removeSubcategory(
    @Param('id', ParseIntPipe) category: number,
    @Param('idSub', ParseIntPipe) subcategory: number
  ) {
    return this.categoryService.removeSubcategory(category, subcategory);
  }
}
