---
use_case: project-assertion-status
module: reconciliation
trigger: domain-event
entrypoint: BalanceAsserted | BalanceAssertionEvaluated | AssertionRevoked | DiscrepancyResolved
command: —
view: projectAssertionStatus
invariants: [AC-0, AC-1, AC-7, AC-8, RNF-5, RNF-10, Artículo 1, Artículo 10]
introduced_by: hu-0015
last_modified_by: hu-0015
status: active
---

# Proyectar `assertion_status`

`AssertionStatusProjector` materializa `proj_assertions` desde los cuatro eventos del
agregado `BalanceAssertion`. Es el único escritor de esa tabla (RNF-10, Artículo 10) y
escribe exclusivamente por el `ReadModelStore` compartido, igual que los projectors de
`accounts` y `transactions`, lo que hace la proyección reconstruible por replay (RNF-5).

Cada evento produce un `upsert` sobre la misma clave (`assertion_id`). El primero
(`BalanceAsserted`) inserta la fila completa; los tres siguientes actualizan sólo sus
columnas, apoyándose en que `ON CONFLICT … DO UPDATE SET` toca únicamente las columnas
provistas. Por eso el orden importa y por eso los eventos posteriores nunca corren sobre
una fila inexistente: el agregado garantiza que `BalanceAsserted` es siempre el primero de
su stream.

**Diagrama:** dynamic view `projectAssertionStatus` en [`../reconciliation.c4`](../reconciliation.c4).

## Reglas

- **AC-0:** el projector extiende `Projector`, declara `name = 'assertion_status'` y
  `consumes = [BalanceAsserted, BalanceAssertionEvaluated, AssertionRevoked, DiscrepancyResolved]`,
  e implementa `project(event: StoredEvent, store: ReadModelStore)`.
- **AC-1:** toda escritura pasa por `store.upsert(PROJ_ASSERTIONS, { assertion_id }, row)`.
  El projector no conoce Postgres ni TypeORM.
- **Artículo 1:** el archivo vive en `reconciliation/infrastructure/projections/` y no
  importa `@nestjs/*`.
- `BalanceAsserted` inserta la fila con `status = UNCHECKED`, `difference = null`,
  `resolved_by_txn = null`, `revoke_reason = null`, `checked_at = null`.
- `BalanceAssertionEvaluated` actualiza `status`, `difference` y `checked_at`.
- `AssertionRevoked` actualiza `status = REVOKED` y `revoke_reason`.
- `DiscrepancyResolved` actualiza `resolved_by_txn`.
- **Idempotencia (RNF-4):** reprocesar el mismo evento produce el mismo upsert sobre la
  misma clave; el replay desde un checkpoint anterior nunca duplica ni acumula.

## Errores

| Condición | Excepción | HTTP |
|---|---|---|
| Fallo de escritura en el read model | propaga la del adaptador | — (el pump detiene el avance del checkpoint) |

No hay errores de dominio: un projector no valida invariantes, sólo materializa (Artículo 10).

## Respuesta

Sin respuesta HTTP — el efecto observable es la fila de `proj_assertions` reflejando el
último veredicto de la aserción, legible por `GET /v1/balance-assertions/{id}`.
