import { registerEnumType } from '@nestjs/graphql';

export const movementTypes = ['INCOME', 'EXPENSE'] as const;

export type MovementTypeType = typeof movementTypes[number];

export enum MovementType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
}

registerEnumType(MovementType, { name: 'MovementType' });
