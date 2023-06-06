export const periods = [
  'daily',
  'weekly',
  'monthly',
  'yearly',
  'custom',
  'all',
] as const;

export type Period = typeof periods[number];

export enum PeriodEnum {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
  CUSTOM = 'CUSTOM',
}
