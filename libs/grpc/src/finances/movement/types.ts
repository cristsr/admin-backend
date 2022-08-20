export const movementTypes = ['income', 'expense'] as const;
export type MovementType = typeof movementTypes[number];

export const periods = ['day', 'week', 'month', 'year'] as const;
export type Period = typeof periods[number];
