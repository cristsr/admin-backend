import { BudgetThreshold } from './budget-threshold.enum';

/** Datos que viajan cuando un presupuesto cruza un umbral de gasto. */
export interface BudgetThresholdExceededPayload {
  budgetId: number;
  percentage: number;
  threshold: BudgetThreshold;
  user: number;
}

/**
 * Publica la alerta de umbral de presupuesto en un canal que un consumidor
 * externo (front / servicio de notificaciones) lee. Reemplaza el log
 * placeholder: conectar un canal real es implementar este puerto (AC-1).
 */
export abstract class BudgetNotificationPublisher {
  abstract publish(payload: BudgetThresholdExceededPayload): Promise<void>;
}
