# hu-0015: Persistencia Postgres de las proyecciones de conciliación

## Historia de Usuario

**Como** desarrollador del núcleo del ledger (`apps/ledger`)
**Quiero** que las proyecciones de conciliación (`assertion_status`, `adjustment_audit`)
persistan en Postgres a través del `ReadModelStore` real, igual que el resto del núcleo
**Para** que el estado de conciliación sobreviva a un reinicio del proceso y sea
reconstruible por replay (RNF-5), en vez de vivir en stores in-memory a medida que se
vacían en cada arranque

## Criterios de Aceptación

### AC-1: Los stores de conciliación se sirven desde el `ReadModelStore` real

`AssertionStatusStore` y `AdjustmentAuditStore` tienen adaptadores que escriben y leen a
través del `ReadModelStore` del `shared-kernel` (el mismo puerto que usan `account_tree`,
`transaction_list` y `account_balances`), en lugar de las implementaciones bespoke
`InMemoryAssertionStatusStore` e `InMemoryAdjustmentAuditStore`.

### AC-2: `ReconciliationModule` deja de cablear dobles in-memory

`reconciliation.module.ts` provee los adaptadores reales y ya no contiene el comentario
`TODO(persistence)`. Los dobles in-memory se conservan únicamente como apoyo de tests, o
se eliminan si los contract tests cubren ambos adaptadores.

### AC-3: Los contract tests corren contra ambos adaptadores

La suite `assertion-status-store.contract.ts` corre idéntica contra el adaptador in-memory
y contra el de Postgres (RNF-11), siguiendo el patrón de `describeEventStoreContract` y
`describeReadModelStoreContract`. Si `AdjustmentAuditStore` no tiene contract suite, se
crea una equivalente.

### AC-4: La migración de conciliación se ordena después del event store

La migración `1784160000010-CreateReconciliationProjections` se renumera a un timestamp
posterior a `1790000000004`. Hoy su prefijo (`1784…`) la ordena **antes** de
`1790000000001-CreateEventStore`, así que corre contra un esquema que todavía no existe.

### AC-5: La migración deja de crear `proj_transfer_candidates`

Se eliminan de la migración la tabla `proj_transfer_candidates` y sus índices
(`idx_transfer_candidates_user`, `idx_transfer_candidates_legs`): quedaron huérfanos al
retirar RF-15 del alcance (ver `docs/decisions.md`, entrada del 2026-07-25).

### AC-6: Las proyecciones de conciliación se registran en el tooling de rebuild

`rebuild.command.ts` registra `assertion_status` y `adjustment_audit` en el
`ProjectionRegistry` junto a `account_tree`, `transaction_list`, `account_balances` y
`ledger_settings`, de modo que `nx run ledger:rebuild` y `:rebuildAll` las reconstruyan
desde el stream (RNF-5). Hoy no están registradas.

### AC-7: El esquema de las tablas coincide con lo que los proyectores escriben

Las columnas de `proj_assertions`, `proj_adjustment_audit` y
`proj_adjustment_audit_entries` coinciden exactamente con las filas que emiten
`AssertionStatusProjector` y `AdjustmentAuditProjector`. Se verifica columna por columna,
igual que se hizo con `proj_ledger_settings` en el commit `ba18de3`.

### AC-8: Un rebuild completo reproduce el estado de conciliación

Partiendo de un stream con aserciones evaluadas, revocadas y con discrepancias resueltas,
un `rebuildAll` desde cero deja `proj_assertions` y el audit de ajustes en el mismo estado
que tenían antes del rebuild.

## Reglas de Negocio

- El event stream es la única fuente de verdad; estas tablas son derivadas y
  reconstruibles (principio de diseño #2, RNF-5).
- Sin constraints de negocio en las tablas de proyección: un bug se corrige con rebuild,
  no con constraints (§6.3).
- Las columnas tipo enum son `TEXT`, nunca enums de base de datos.
- Los montos se materializan en `NUMERIC(20,6)`; la aritmética exacta vive en `Money`
  (INV-8, RNF-2).

## Fuera de Alcance

- La atomicidad cross-stream de `ResolveDiscrepancy` (`TODO(atomicity)`) — es hu-0016.
- La re-evaluación de aserciones ante anulaciones (`TODO(reactor)`) — es hu-0016.
- La documentación del módulo `reconciliation` — es hu-0017.
