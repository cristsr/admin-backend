export type Empty = Record<string, never>;

export interface List<T> {
  data: T[];
}

export interface Id {
  id: number;
}
