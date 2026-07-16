import { SubcategoryOutputDto } from './subcategory-output.dto';

export class CategoryOutputDto {
  id: number;

  active: boolean;

  createdAt: Date;

  updatedAt: Date;

  name: string;

  icon: string;

  color: string;

  subcategories?: SubcategoryOutputDto[];
}
