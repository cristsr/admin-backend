---
use_case: dry-run-preview
module: shared
trigger: rest
entrypoint: POST /api/v1/* (cualquier escritura con body dryRun: true)
command: varies (todos los commands de escritura)
view: shared_http_dry_run
invariants: [AC-2, AC-3, AC-4, F-12, RNF-11]
introduced_by: hu-0025
last_modified_by: hu-0025
status: active
---

# Dry-run preview (ejecutar completo y revertir)

Toda escritura acepta `dryRun: boolean` (default `false`) en el body (AC-4). Con
`true`, `DryRunPolicy` —la política más interna del chain— envuelve la ejecución
del handler en `EventStore.withTransaction(work, { rollback: true })`: el comando
se ejecuta **completo** (validaciones, invariantes del agregado, generación de
eventos y proyecciones síncronas) dentro de la transacción, y al terminar se hace
rollback en vez de commit, devolviendo el `CommandResult` que la ejecución real
habría producido. El preview no puede divergir de la ejecución real porque es la
ejecución real (F-12).

**Diagrama:** dynamic view `shared_http_dry_run` en [`../shared.c4`](../../../apps/ledger/docs/shared/shared.c4).

## Reglas

- **AC-2:** el comando se ejecuta completo dentro de la transacción — validaciones,
  invariantes del agregado, generación de eventos y actualización de las proyecciones
  síncronas— y al terminar se hace **rollback** en vez de commit.
- **AC-2:** se devuelve el resultado que la ejecución real habría producido
  (`CommandAcceptedDto` idéntico, AC-4): mismo `id`, misma `streamPosition`.
- **AC-3:** ningún evento se persiste al stream. Los `withTransaction` internos de
  los handlers son re-entrantes y se unen al scope del preview (mismo
  `AsyncLocalStorage`), así que sus appends también se revierten.
- **AC-3:** ningún reactor (§3.2) se despacha: los reactors se alimentan del stream
  persistido (`reconciliation.pump`), y un preview no commitea nada — la exclusión
  es estructural, no un flag.
- **AC-3:** los ids no se queman: el `EnvelopeFactory` usa `UuidIdGenerator` (UUID
  v4), no secuencial. La única secuencia es `global_position` (IDENTITY): un
  rollback deja huecos, inocuos para el catch-up de proyecciones (`>` sobre
  posiciones).
- **AC-4:** el flag viaja en el body (`dryRun: boolean`, validado con
  `class-validator`); el controller lo transporta en el `AuthContext`, no en el
  `Command` — así queda excluido del hash de idempotencia por construcción.
- **RNF-11:** ningún command handler cambia por esta historia; la instrumentación
  vive en la policy.

## Errores

| Condición | Excepción | HTTP |
|---|---|---|
| Preview exitoso | — | 201 (o 200 si el resultado es un replay) con el resultado real revertido |
| Fallo de dominio durante el preview | `DomainException` (la propia del comando) | el de la operación real |
| Fallo transitorio durante el preview | se reintenta (RetryPolicy) y, al agotar, `PersistenceConflictException` | 409 `PERSISTENCE_CONFLICT` |

## Respuesta

Mismo esquema que la ejecución real (AC-4): `CommandAcceptedDto` + headers
`X-Ledger-Stream-Position` (e `Idempotency-Hit` solo en replay). Un preview
exitoso devuelve el `streamPosition` que la ejecución real **habría** alcanzado.
