import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { Public } from '@shared';
import {
  CategoriesInputDto,
  CategoryFilterDto,
  CategoryInputDto,
  CategoryOutputDto,
  TaxonomyOutputDto,
} from '../../../application/dto';
import { CategoryMapper } from '../../../application/mappers';
import {
  FindAllCategoriesUsecase,
  FindCategoryUsecase,
  GetTaxonomyUsecase,
  RemoveCategoryUsecase,
  SaveCategoryUsecase,
  SaveManyCategoriesUsecase,
} from '../../../application/usecases';

@Controller('categories')
export class CategoryController {
  constructor(
    private readonly findCategoryUsecase: FindCategoryUsecase,
    private readonly findAllCategoriesUsecase: FindAllCategoriesUsecase,
    private readonly saveCategoryUsecase: SaveCategoryUsecase,
    private readonly saveManyCategoriesUsecase: SaveManyCategoriesUsecase,
    private readonly removeCategoryUsecase: RemoveCategoryUsecase,
    private readonly getTaxonomyUsecase: GetTaxonomyUsecase,
  ) {}

  /**
   * Consumed by the Rust ingestion pipeline's `CategoryProvider` — must stay
   * registered before `:id` so it isn't swallowed by that route.
   */
  @Public()
  @Get('taxonomy')
  async taxonomy(): Promise<TaxonomyOutputDto> {
    const categories = await this.getTaxonomyUsecase.execute();
    return { categories };
  }

  @Get(':id')
  async findOne(@Param('id') id: number): Promise<CategoryOutputDto> {
    const category = await this.findCategoryUsecase.execute(id);
    return category && CategoryMapper.toOutput(category);
  }

  @Get()
  async findAll(
    @Query() filter: CategoryFilterDto,
  ): Promise<CategoryOutputDto[]> {
    const categories = await this.findAllCategoriesUsecase.execute(filter);
    return categories.map(CategoryMapper.toOutput);
  }

  @Post()
  async save(@Body() input: CategoryInputDto): Promise<CategoryOutputDto> {
    const category = await this.saveCategoryUsecase.execute(input);
    return CategoryMapper.toOutput(category);
  }

  @Post('batch')
  async saveMany(
    @Body() input: CategoriesInputDto,
  ): Promise<{ status: boolean }> {
    const status = await this.saveManyCategoriesUsecase.execute(input);
    return { status };
  }

  @Delete(':id')
  async remove(@Param('id') id: number): Promise<{ status: boolean }> {
    const status = await this.removeCategoryUsecase.execute(id);
    return { status };
  }
}
