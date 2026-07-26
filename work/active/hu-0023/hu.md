# hu-0023: Atomicidad cross-stream de los commands multi-agregado

## Historia de Usuario

**Como** responsable de la integridad contable del ledger
**Quiero** que un command que escribe en varios streams los escriba todo o nada
**Para** que un proceso caído a mitad de una fusión o de una resolución de discrepancia no
deje el ledger en un estado intermedio — una pendiente anulada sin la transferencia que la
reemplaza, o una aserción resuelta sin su ajuste

## Criterios de Aceptación

### AC-1: `MergePendingTransfers` es atómico

El command emite `TransactionVoided` sobre las dos pendientes y `TransactionRecorded` de la
transferencia. Hoy son tres appends independientes a tres streams
(`merge-pending-transfers.handler.ts`, `TODO(atomicity)`): si el proceso muere después del
primer void, el usuario queda con una pendiente anulada y ninguna transferencia que la
reemplace. Tras esta historia, o se aplican los tres o no se aplica ninguno.

### AC-2: `ResolveDiscrepancy` es atómico

Mismo tratamiento para el ajuste contra `Equity:Adjustments` más el `DiscrepancyResolved`
sobre la aserción (`resolve-discrepancy.handler.ts:27`). Una discrepancia marcada como
resuelta sin su transacción de ajuste es peor que una sin resolver: afirma que el dinero
está explicado cuando no lo está.

### AC-3: El puerto `EventStore` expone la operación atómica

El puerto gana una forma de agrupar appends de varios streams en una unidad, sin que el
dominio conozca la transacción de Postgres que la implementa (RNF-11, Artículo 1). Los
handlers siguen sin importar `typeorm`.

[NEEDS CLARIFICATION: ¿la forma es un método `appendMany(batches)` en el puerto, o un
`withTransaction(fn)` que abarque varios `append` sucesivos? Lo primero es más simple de
verificar por contract test; lo segundo es más flexible pero acopla el orden de las
llamadas al scope de la transacción.]

### AC-4: El contract test cubre la atomicidad en ambos adaptadores

`describeEventStoreContract` gana casos que prueban que un fallo a mitad del lote no deja
eventos parciales. Corren idénticos contra `InMemoryEventStore` y `PostgresEventStore`
(RNF-11) — el in-memory tendrá que simular el rollback.

### AC-5: La concurrencia optimista sigue valiendo por stream

Agrupar los appends no relaja INV-9 ni el control de concurrencia: cada stream conserva su
verificación de versión esperada, y un conflicto en cualquiera de ellos aborta el lote
completo.

### AC-6: Los `TODO(atomicity)` desaparecen

Ambos comentarios se eliminan del código junto con la deuda que declaran.

## Reglas de Negocio

- El event store es append-only: la atomicidad es sobre la escritura del lote, nunca
  implica borrar o reescribir eventos ya persistidos (Artículo 3).
- Un command puede emitir cero o más eventos de forma atómica con control de concurrencia
  optimista (§3.5).
- El orden total por usuario (INV-9) se preserva: la posición global sigue siendo
  monótona.

## Fuera de Alcance

- La re-evaluación de aserciones ante anulaciones y reversas — es hu-0016.
- Transacciones distribuidas o sagas: todos los streams involucrados viven en la misma
  base de datos, así que alcanza con una transacción local.

## Origen

Separada de hu-0016 el 2026-07-26. La pregunta venía abierta desde
`work/ledger/INTEGRATION.md` (etapa 5, «Decisión de diseño abierta: atomicidad cross-stream
de commands multi-agregado»), donde se dejó explícitamente sin cerrar. Se saca a historia
propia porque es integridad transaccional —un problema distinto de la re-evaluación— y
porque alcanza a `MergePendingTransfers`, que no es parte de hu-0016.
