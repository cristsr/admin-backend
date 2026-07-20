export type PropertiesOnly<T> = Pick<
  T,
  {
    [K in keyof T]: T[K] extends (...args: never[]) => unknown ? never : K;
  }[keyof T]
>;
