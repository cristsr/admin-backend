# design: hu-0025

## Decisiones de Diseño

- **AC-6 — retry-once de `OptimisticConcurrencyPolicy`:** se **mantiene** como hoy
  (`MAX_RETRIES = 1` con reload del agregado contra el head fresco). "Se sigue propagando
  al cliente como hoy" es literal; AC-6 solo prohíbe que la **nueva** `RetryPolicy`
  capture `CONCURRENCY_CONFLICT`, y no lo captura porque solo maneja
  `TransientPersistenceException`.
- **AC-8 — métrica de reintentos:** puerto mínimo `RetryCounter` (application) + adapter
  `OtelRetryCounter` (infra, `@opentelemetry/api`) cableado en `ledger-core.module.ts` —
  la cuarta métrica de RNF-12 se implementa sin arrastrar hu-0022 (backlog).
- **Transporte de `dryRun`:** campo del body (AC-4, resuelto en `/clarify`) que el
  controller transporta en el **`AuthContext`**, no en el `Command` — queda excluido del
  hash de idempotencia por construcción (patrón `externalRef`/`externalRefHash`). Ver
  rationale completo en `docs/research.md`.
- **Primitiva de rollback:** `EventStore.withTransaction(work, { rollback: true })` +
  `PostgresReadModelStore` pasando a escribir por el mismo `AsyncLocalStorage` del scope
  (hoy escribe fuera de la transacción — gap del scan). In-memory: snapshot/restore.
- **Detección de transitorios:** `PostgresEventStore.translate()` traduce `40P01`/`40001`
  → `TransientPersistenceException` (patrón existente de `23505`); la policy solo conoce
  tipos de dominio (Artículo 1).
- **Orden de la cadena:** `[Authenticated, Retry, Idempotency, OptimisticConcurrency,
  DryRun]` — Retry fuera de idempotencia (re-corre el pre-check) y fuera de la
  transacción del dry-run (una transacción PG queda aborted tras un error); DryRun como
  la más interna (su transacción envuelve el handler; los appends se unen al scope).
- **Ids en dry-run (AC-3):** sin cambio de código — `UuidIdGenerator` (UUID v4) no es
  secuencial; los huecos de `global_position` tras rollback son inocuos para el catch-up
  (`>` sobre posiciones).

## Resumen del flujo

Las políticas transversales del command bus pasan de 3 a 5: se agregan `DryRunPolicy`
(preview: ejecuta completo y revierte) y `RetryPolicy` (reintenta deadlocks/serialization
con 3 intentos y backoff exponencial con jitter, `PERSISTENCE_CONFLICT` al agotar). El
cambio es transversal: 15 endpoints de escritura modificados + 3 endpoints que entran al
contrato (record-opening-balance, merge-transfers, register-currency — gaps de docs del
scan). Diagramas de flujo: `docs/model.delta.c4` (4 dynamic views) y semántica por
caso de uso en `docs/flows/` (4 flujos nuevos + 17 modificados).

## Componentes del módulo

Componentes nuevos en `admin.ledger.shared`: `DryRunPolicy`, `RetryPolicy`,
`TransientPersistenceException`, `PersistenceConflictException`, `RetryCounter` (port),
`OtelRetryCounter` (adapter); `commandBus` y `IdempotencyPolicy` se marcan modificadas
(chain 3→5). Modelo completo: `docs/model.delta.c4`.

## Impacto en Arquitectura Global

**¿Toca arquitectura global?** No.

Los cambios viven dentro de los componentes internos del módulo `Shared Kernel`
(policies del command bus en `libs/cqrs`, wiring en `apps/ledger`) y de los request DTOs
de los módulos existentes — no hay app/módulo nuevo, ni integración nueva con sistemas
externos, ni actores nuevos. Nivel C4: 3 (componentes), gestionado por los `.c4` de
módulo, no por `docs/architecture/`.

## Contratos por microservicio

### apps/ledger (todos los módulos — tag `shared`/`accounts`/`transactions`/`reconciliation`/`reference`)

| Método | Ruta | Descripción de negocio |
|--------|------|-------------------------|
| POST | /ledger/initialize | Inicializa el ledger y crea las cuentas técnicas (modificado: `dryRun`) |
| POST | /accounts | Abre una cuenta (modificado: `dryRun`) |
| POST | /accounts/{id}/rename | Renombra una cuenta (modificado: `dryRun`) |
| POST | /accounts/{id}/close | Cierra una cuenta (modificado: `dryRun`) |
| POST | /accounts/{id}/opening-balance | Registra saldo inicial (nuevo en contrato: `dryRun`) |
| PUT | /v1/ledger/settings | Reemplaza moneda de presentación/timezone (modificado: `dryRun`) |
| POST | /transactions | Registra una transacción (modificado: `dryRun`) |
| POST | /transactions/{id}/confirm | Confirma una PENDING (modificado: `dryRun`) |
| POST | /transactions/{id}/amend | Modifica postings/fecha de una PENDING (modificado: `dryRun`) |
| POST | /transactions/{id}/annotate | Adjunta metadatos descriptivos (modificado: `dryRun`) |
| POST | /transactions/{id}/void | Anula una PENDING (modificado: `dryRun`) |
| POST | /transactions/{id}/reverse | Revoca una CONFIRMED con reversa (modificado: `dryRun`) |
| POST | /transfers/merge | Fusiona las dos patas de una transferencia (nuevo en contrato: `dryRun`) |
| POST | /v1/currencies | Registra una moneda (nuevo en contrato: `dryRun`) |
| POST | /v1/balance-assertions | Crea una assertion de saldo (modificado: `dryRun`) |
| POST | /v1/balance-assertions/{id}/revoke | Revoca una assertion (modificado: `dryRun`) |
| POST | /v1/balance-assertions/{id}/resolve | Cierra una discrepancia con ajuste (modificado: `dryRun`) |

> Todas las escrituras ganan además el error `409 PERSISTENCE_CONFLICT` (AC-5). Schemas de
> request/response, validaciones y códigos completos: `docs/api.delta.yaml`.

## Validación de Quality Gates

| Gate | Resultado | Justificación |
|------|-----------|---------------|
| Simplicity | ✅ | No se agregan capas ni abstracciones sin caso de uso: las dos policies usan el mecanismo `CommandPolicy` que ya existía (F-22 ya resuelto en el código); el único puerto nuevo (`RetryCounter`) es la firma mínima que AC-8 exige, con un solo adapter. |
| Anti-Abstraction | ✅ | OTel se usa directo en el adapter (sin wrapper propio); el rollback usa el `AsyncLocalStorage`/`QueryRunner` nativos; no se envuelve nada que el framework ya resuelva. |
| Integration-First | ✅ | `api.delta.yaml` define `dryRun` y `PERSISTENCE_CONFLICT` antes de que exista código; los contract tests (event-store.contract, idempotency.policy.spec, error-code-mapping.spec) se extienden antes de los adaptadores en `/plan`. |
| Test-First | ✅ | `/plan` generará los specs (rollback del contract test, retry policy, translate de 40P01/40001, mapping de `PERSISTENCE_CONFLICT`) antes del código de producción — Artículo 4. |

## Notas para /sync y /plan

- **C4:** el delta referencia `admin.ledger.shared.optimisticConcurrencyPolicy` y
  `admin.ledger.shared.synchronousDispatcher`, definidos en los `.c4` vivos — /sync debe
  confirmar los ids exactos al reconciliar; las relaciones del delta están dentro del
  bloque `extend`.
- **API:** `/sync` correrá `oasdiff` contra los api.yamls de accounts/transactions/
  reconciliation (modificados) y **creará** `reference/api.yaml` (nuevo). Los 3 paths
  nuevos entran como `create` y deben declarar el parámetro `X-External-Ref`
  (`../shared/api.yaml#/components/parameters/ExternalRefHeader`) que el delta omite
  para no fragmentar la ruta de $ref — es el mismo parámetro de las operaciones vivas.
- **Decisiones post-clarify preservadas:** `dryRun` en todos los endpoints (AC-4),
  campo del body default `false`, solo `40P01`/`40001` como transitorios, 3 intentos
  totales con jitter, `PERSISTENCE_CONFLICT` como código estable.
- **Gaps del scan sin tocar:** métricas RNF-12 restantes (hu-0022 backlog), epic
  `work/ledger/EP-6-formance.md` inexistente (referencia rota del hu).
