import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  SubcategoriesInputDto,
  SubcategoryInputDto,
  SubcategoryOutputDto,
} from '@app/category/application/dto';
import { SubcategoryMapper } from '@app/category/application/mappers';
import {
  FindSubcategoriesByCategoryUsecase,
  FindSubcategoryUsecase,
  RemoveSubcategoryUsecase,
  SaveManySubcategoriesUsecase,
  SaveSubcategoryUsecase,
} from '@app/category/application/usecases';

@ApiTags('subcategories')
@ApiBearerAuth()
@Controller('subcategories')
export class SubcategoryController {
  constructor(
    private readonly findSubcategoryUsecase: FindSubcategoryUsecase,
    private readonly findSubcategoriesByCategoryUsecase: FindSubcategoriesByCategoryUsecase,
    private readonly saveSubcategoryUsecase: SaveSubcategoryUsecase,
    private readonly saveManySubcategoriesUsecase: SaveManySubcategoriesUsecase,
    private readonly removeSubcategoryUsecase: RemoveSubcategoryUsecase,
  ) {}

  @Get(':id')
  async findOne(@Param('id') id: number): Promise<SubcategoryOutputDto> {
    const subcategory = await this.findSubcategoryUsecase.execute(id);
    return subcategory && SubcategoryMapper.toOutput(subcategory);
  }

  @Get('category/:id')
  async findByCategory(
    @Param('id') id: number,
  ): Promise<SubcategoryOutputDto[]> {
    const subcategories =
      await this.findSubcategoriesByCategoryUsecase.execute(id);
    return subcategories.map(SubcategoryMapper.toOutput);
  }

  @Post()
  async save(
    @Body() input: SubcategoryInputDto,
  ): Promise<SubcategoryOutputDto> {
    const subcategory = await this.saveSubcategoryUsecase.execute(input);
    return SubcategoryMapper.toOutput(subcategory);
  }

  @Post('batch')
  async saveMany(
    @Body() input: SubcategoriesInputDto,
  ): Promise<{ status: boolean }> {
    const status = await this.saveManySubcategoriesUsecase.execute(input);
    return { status };
  }

  @Delete(':id')
  async remove(@Param('id') id: number): Promise<{ status: boolean }> {
    const status = await this.removeSubcategoryUsecase.execute(id);
    return { status };
  }
}
