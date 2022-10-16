export const periods = [
  'daily',
  'weekly',
  'monthly',
  'yearly',
  'custom',
  'all',
] as const;

export type Period = typeof periods[number];
