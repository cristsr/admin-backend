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

### AC-3: El puerto expone `withTransaction(fn)`

`EventStore` gana un scope transaccional: los `append` que ocurren dentro de la función
comparten una transacción y se confirman o se revierten juntos.

```typescript
abstract withTransaction<T>(work: () => Promise<T>): Promise<T>;
```

Se eligió esta forma sobre `appendMany(batches)` porque **conserva el reuso de commands**.
Los dos handlers afectados despachan `RecordTransaction` y `VoidPendingTransaction` por el
`CommandBus` (3 dispatches en `merge`, 1 en `resolve`); con `appendMany` tendrían que dejar
de usar el bus y orquestar los agregados a mano para juntar los envelopes, duplicando lógica
que hoy vive en `RecordTransactionHandler`. Con `withTransaction` solo se envuelve la
operación.

El dominio no conoce la transacción de Postgres: entra por el puerto (RNF-11, Artículo 1) y
los handlers no importan `typeorm`.

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
