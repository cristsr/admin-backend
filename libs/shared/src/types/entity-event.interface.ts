export interface EntityEvent<T = any> {
  entity: T;
  databaseEntity?: T;
}
