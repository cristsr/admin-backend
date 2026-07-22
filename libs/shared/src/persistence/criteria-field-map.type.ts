/**
 * Maps each domain field to its TypeORM property path. Total on purpose: an
 * unmapped field fails compilation instead of reaching the database.
 */
export type CriteriaFieldMap<TField extends string> = Readonly<Record<TField, string>>;
