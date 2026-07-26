# hu-0016: Re-evaluación de aserciones ante anulaciones, reversas y confirmaciones

## Historia de Usuario

**Como** usuario que concilia sus cuentas contra el extracto bancario
**Quiero** que una aserción de saldo se vuelva a evaluar sola cuando anulo, reverso o
confirmo una transacción anterior a su fecha de corte
**Para** que el veredicto `MATCHED`/`MISMATCHED` refleje siempre el saldo real y no me
quede una conciliación en verde que ya dejó de ser cierta (RF-18)

## Criterios de Aceptación

### AC-1: Las anulaciones disparan re-evaluación

`ReevaluateAssertionsReactor` reacciona a `TransactionVoided` además de a
`TransactionRecorded` y `TransactionAmended`. Hoy `REEVALUATION_TRIGGERS`
(`reevaluate-assertions.reactor.ts:15-18`) solo contiene los dos últimos, con un
`TODO(reactor)` que declara el hueco: *"balance-decreasing voids are not yet
re-evaluated"*.

### AC-2: Las reversas y confirmaciones también disparan re-evaluación

`TransactionReversed` y `TransactionConfirmed` disparan el mismo flujo: ambos alteran el
saldo proyectado de las cuentas involucradas y, por lo tanto, pueden invalidar el
veredicto de una aserción cuyo corte sea posterior.

### AC-3: El reactor resuelve las cuentas tocadas sin depender del payload del evento

Los eventos de cambio de estado (`TransactionVoided`, `TransactionConfirmed`,
`TransactionReversed`) **no llevan postings en su payload**, a diferencia de
`TransactionRecorded`/`TransactionAmended`. El reactor obtiene las cuentas afectadas y la
fecha contable de la transacción por otra vía, sin volverse un lector del event store
(RNF-10: los reactors solo despachan commands).

[NEEDS CLARIFICATION: ¿el reactor resuelve las cuentas tocadas leyendo `proj_postings`
(proyección, consistente con RNF-10 pero sujeta al lag del pump), o se enriquece el
payload de los tres eventos de estado para que carguen `postings` y `date` como ya hacen
`TransactionRecorded`/`TransactionAmended`? Lo segundo cambia el esquema de eventos y
exige `schema_version` + upcasting (RNF-6).]

### AC-4: Re-evaluar es idempotente

Reprocesar el mismo evento no produce eventos nuevos si el veredicto no cambió: el
agregado `BalanceAssertion` permanece en silencio ante un veredicto idéntico (RNF-4). El
comportamiento actual ya lo garantiza y debe seguir garantizándolo con los tres eventos
nuevos.

### AC-5: Las aserciones revocadas nunca se re-evalúan

Una aserción revocada queda fuera del alcance de `AssertionLookupPort.onAccountFrom`,
cualquiera sea el evento disparador.

### AC-6: Atomicidad cross-stream de `ResolveDiscrepancy` y `MergePendingTransfers`

Se resuelve el `TODO(atomicity)` presente en `resolve-discrepancy.handler.ts:27` y
`merge-pending-transfers.handler.ts`: ambos handlers hacen varios appends a streams
distintos que hoy no son una sola operación atómica. Si el proceso muere entre el primer
append y el último, el ledger queda en un estado intermedio (por ejemplo: una pendiente
anulada sin la transferencia que la reemplaza).

[NEEDS CLARIFICATION: ¿se implementa un adaptador de transacción compartida sobre el
`EventStore` (una transacción de Postgres que abarque los appends de varios streams), o se
acepta el append-per-stream documentando el riesgo, dado que estamos en fase de desarrollo
sin datos reales? La pregunta quedó abierta en `work/ledger/INTEGRATION.md` etapa 5 y
nunca se cerró.]

### AC-7: Cobertura de test de los flujos nuevos

Cada disparador nuevo (`Voided`, `Confirmed`, `Reversed`) tiene un test que verifica que
una aserción `MATCHED` previa pasa a `MISMATCHED` cuando el evento altera el saldo por
debajo de su fecha de corte, y que una aserción con corte anterior a la transacción no se
toca.

## Reglas de Negocio

- Los reactors solo despachan commands: nunca escriben eventos ni proyecciones
  directamente (§3.2, RNF-10).
- Un reactor que falla en silencio rompe la conciliación sin síntoma visible — por eso
  RNF-12 exige exponer sus errores como métrica (ver hu-0022).
- La semántica temporal de la evaluación es la de §2.4: `occurred_at` frente al cierre del
  día en la zona horaria de `LedgerSettings`, con resultado `INDETERMINATE` cuando no se
  puede decidir.

## Fuera de Alcance

- La persistencia Postgres de las proyecciones de conciliación — es hu-0015.
- La documentación del módulo — es hu-0017.
