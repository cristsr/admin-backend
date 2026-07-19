export class CategorizationRuleOutputDto {
  id: number;

  pattern: string;

  categoryId: number;

  subcategoryId?: number;

  priority: number;

  createdAt: Date;
}
