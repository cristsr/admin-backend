---
use_case: revoke-assertion
module: reconciliation
trigger: rest
entrypoint: POST /v1/balance-assertions/{id}/revoke
command: RevokeAssertionCommand
view: revokeAssertion
invariants: [RF-19, INV-10]
introduced_by: hu-0017
last_modified_by: hu-0017
status: active
---

# Revocar una aserción errónea

Cuando la aserción estaba mal —se leyó mal el extracto, se eligió la cuenta equivocada— se
revoca con un motivo auditado. No se corrige ni se borra: el evento original queda en el
stream y la revocación es otro evento encima (principio de diseño #5).

La revocación es **terminal**. Una aserción revocada sale del alcance de la re-evaluación
para siempre, incluso tras un rebuild completo de proyecciones: el filtro vive en
`AssertionStatusStore.nonRevokedOnAccountFrom`, del lado de la lectura, así que ningún
disparador que se agregue en el futuro puede resucitarla por accidente.

**Diagrama:** dynamic view `revokeAssertion` en [`../reconciliation.c4`](../reconciliation.c4).

## Reglas

- **RF-19:** el motivo es obligatorio y queda en el stream para auditoría.
- **Terminal:** revocar dos veces la misma aserción se rechaza.
- Una aserción revocada **nunca** se re-evalúa — verificado por test en hu-0016.
- El veredicto previo no se borra: la fila conserva su `difference` y su `checkedAt`, y
  pasa a `status = REVOKED`.

## Errores

| Condición | Excepción | HTTP |
|---|---|---|
| La aserción no existe para este usuario | `AssertionNotFoundException` | 404 |
| Ya estaba revocada | `AssertionAlreadyRevokedException` | 422 |
| Sin contexto autenticado | — (guard, RF-26) | 401 |

## Respuesta

`200 OK` con `RevokeAssertionResponse` (`assertionId`, `streamPosition`) y el header
`X-Ledger-Stream-Position`.
