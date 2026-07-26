---
use_case: rebuild-all
module: shared-kernel
trigger: cli
entrypoint: nx run ledger:rebuildAll
command: ProjectionRebuilder.rebuildAll()
view: shared_kernel_rebuild_all
invariants: [AC-3, AC-6, INV-12]
introduced_by: hu-0008
last_modified_by: hu-0008
status: active
---

# Rebuild all projections

Reconstruye todas las proyecciones registradas en `ProjectionRegistry` una por
una, y devuelve un `RebuildReport` por cada una indicando éxito o fallo y el
número de eventos aplicados. Cada checkpoint queda en la última posición del
stream.

**Diagrama:** dynamic view `shared_kernel_rebuild_all` en
[`../shared-kernel.c4`](../../../apps/ledger/docs/shared-kernel/shared-kernel.c4).

## Reglas

- **AC-3:** Itera sobre todas las proyecciones registradas (`registry.names()`).
  Cada una se reconstruye con la misma lógica de `rebuild(projectionName)`. El
  resultado es un array de `RebuildReport`.
- **AC-6:** Solo lee del EventStore; nunca escribe.
- **INV-12:** El stream no se modifica.

## Errores

| Condición | Excepción | Comportamiento |
|---|---|---|
| Una proyección falla durante `rebuild` | Error capturado por `try/catch` | El `RebuildReport` de esa proyección tiene `success: false` y `error`. Las demás proyecciones continúan. |
| `ProjectionRegistry` sin proyecciones registradas | — | `rebuildAll()` retorna array vacío; el CLI imprime "No projections registered". |

## Respuesta

El CLI imprime una tabla con el resultado por proyección: nombre, éxito/fallo,
eventos aplicados y mensaje de error si aplica.
