/**
 * Umbral de gasto de un presupuesto. Enum-like guardado como varchar; los
 * valores permitidos viven en la capa de aplicación/dominio, no en la DB.
 */
export enum BudgetThreshold {
  WARNING = 'WARNING',
  EXCEEDED = 'EXCEEDED',
}
