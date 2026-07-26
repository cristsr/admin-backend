---
use_case: run-reconciliation-pump
module: reconciliation
trigger: cron
entrypoint: ReconciliationPump.pump() — @Interval
command: EvaluateAssertion (vía el reactor)
view: runReconciliationPump
invariants: [AC-1, AC-8, RNF-4, RNF-5, RNF-10, RNF-12, Artículo 10]
introduced_by: hu-0015
last_modified_by: hu-0015
status: active
---

# Bombear el stream de conciliación

El pump es el motor asíncrono del módulo: lee el stream global desde su checkpoint
persistido, aplica los dos projectors de conciliación y recién después alimenta al reactor
de re-evaluación. La spec §8.1 clasifica `assertion_status` y `adjustment_audit` como
proyecciones asíncronas servidas por «poller propio con checkpoint», a diferencia de
`transaction_list` y `account_balances`, que se proyectan en la transacción del command.

**El orden proyectar-antes-de-reaccionar es una garantía de correctitud, no una
casualidad.** `ReevaluateAssertionsReactor` consulta `assertion_status` para saber qué
aserciones toca re-evaluar; si el reactor corriera con un checkpoint propio podría
adelantarse a los projectors y leer un estado viejo. Un único bucle con un único checkpoint
lo hace imposible.

Antes de esta historia el pump existía pero **no lo invocaba nadie**: estaba registrado
como provider y su checkpoint vivía en una propiedad en memoria. Esta historia lo cablea a
un disparador periódico y le da un checkpoint persistente.

**Diagrama:** dynamic view `runReconciliationPump` en [`../reconciliation.c4`](../reconciliation.c4).

## Reglas

- **Checkpoint persistente (AC-1):** la posición se lee y se avanza por
  `ProjectionCheckpointRepository` sobre `projection_checkpoints`, con el nombre de
  proyección `reconciliation`. Al reiniciar, el pump reanuda donde quedó en vez de
  reprocesar el stream completo.
- **Avance sólo en éxito:** el checkpoint avanza evento por evento, después de que
  projectors y reactor terminaron. Si algo lanza, el bucle se detiene y el evento se
  reintenta en el próximo tick — nunca se saltea.
- **Entrega al-menos-una-vez (RNF-4):** el reproceso es seguro porque los upserts son
  idempotentes por clave y `EvaluateAssertion` no emite evento cuando el veredicto no
  cambia.
- **El reactor no escribe (Artículo 10, RNF-10):** sólo despacha `EvaluateAssertion` por el
  `CommandBus`.
- **Lote de 100 eventos** por `readAll`, drenando hasta alcanzar la cabeza del stream.
- **Observabilidad (RNF-12):** un pump que falla en silencio rompe la conciliación sin
  síntoma visible; el fallo se loguea con la posición global. La métrica de lag queda para
  hu-0022.

## Errores

| Condición | Excepción | HTTP |
|---|---|---|
| Falla un projector o el reactor | propaga; se loguea con `globalPosition` | — |
| Checkpoint no encontrado | arranca en `0n` (primer arranque) | — |

## Respuesta

Sin respuesta HTTP. El efecto observable es doble: `proj_assertions` y
`proj_adjustment_audit(_entries)` al día respecto del stream, y `projection_checkpoints`
con la posición de la proyección `reconciliation` avanzando.
