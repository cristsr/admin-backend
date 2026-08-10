---
use_case: retry-on-deadlock
module: shared
trigger: rest
entrypoint: POST /api/v1/* (cualquier escritura durante la persistencia)
command: varies (todos los commands de escritura)
view: shared_http_retry_deadlock
invariants: [AC-5, AC-6, AC-7, AC-8, F-14, RNF-11, RNF-12]
introduced_by: hu-0025
last_modified_by: hu-0025
status: active
---

# Reintento automático ante fallos transitorios del motor

Cuando el adaptador de persistencia falla por un deadlock de PostgreSQL (`40P01
deadlock_detected`) o un serialization failure (`40001 serialization_failure`)
—los únicos dos errores transitorios cubiertos—, `RetryPolicy` reintenta el
comando completo en vez de propagar el error al cliente. El comando era válido:
solo perdió una carrera de locks.

**Diagrama:** dynamic view `shared_http_retry_deadlock` en [`../shared.c4`](../../../apps/ledger/docs/shared/shared.c4).

## Reglas

- **AC-5 (CUANDO):** `PostgresEventStore.translate()` convierte `40P01` y `40001`
  en `TransientPersistenceException`; `RetryPolicy` la captura y reintenta el
  comando completo.
- **AC-5 (MIENTRAS):** backoff exponencial con jitter (~10–40 ms entre intentos),
  hasta un máximo de **3 intentos en total** (intento original + 2 reintentos).
- **AC-5 (SI):** al agotar los 3 intentos, responde con el código de dominio
  estable `PERSISTENCE_CONFLICT` (409), sin exponer el error crudo del motor.
- **AC-6:** `ConcurrencyConflictException` (`CONCURRENCY_CONFLICT`) **no** entra en
  el reintento automático: es otra clase, la captura la
  `OptimisticConcurrencyPolicy` existente (retry-once con reload del agregado, como
  hoy) y sigue propagándose al cliente. Repetir un conflicto de agregado sin
  recargar sería escribir sobre premisas viejas.
- **AC-7:** `DuplicateExternalRefException` no se reintenta ni se propaga: la
  atrapa `IdempotencyPolicy`, que relee el ancla y devuelve el resultado ya escrito
  (o `IDEMPOTENCY_INPUT_MISMATCH` si los inputs difieren, hu-0024 AC-6).
- **AC-8:** cada reintento por deadlock incrementa un contador con el tipo de
  comando como atributo (`RetryCounter`/`OtelRetryCounter`) — la cuarta métrica que
  RNF-12 nombra.
- **Regla de negocio:** un comando reintentado debe producir el mismo resultado que
  el original: el reintento se apoya en que los handlers son deterministas dado el
  mismo estado de partida.
- **RNF-11:** la instrumentación vive en la policy, ningún handler cambia.

## Errores

| Condición | Excepción | code | HTTP |
|---|---|---|---|
| Transitorio (40P01/40001) reintentado con éxito | — | — | el status de la operación real |
| **NUEVO** — transitorio agotó los 3 intentos | `PersistenceConflictException` | `PERSISTENCE_CONFLICT` | 409 |
| Conflicto de agregado (nunca reintentado por RetryPolicy) | `ConcurrencyConflictException` | `CONCURRENCY_CONFLICT` | 409 |
| Colisión de `external_ref` (la resuelve IdempotencyPolicy, AC-7) | replay / `IdempotencyInputMismatchException` | — / `IDEMPOTENCY_INPUT_MISMATCH` | 200 / 409 |

## Respuesta

- **Éxito tras reintento:** el status y el cuerpo de la operación real
  (`CommandAcceptedDto` + headers). Los reintentos son invisibles al cliente.
- **409 `PERSISTENCE_CONFLICT`:** `ErrorResponseBody` con `code: PERSISTENCE_CONFLICT`
  — contrato estable; antes de hu-0025 este fallo llegaba como `500` sin `code`.
