# hu-0016: Re-evaluación de aserciones ante anulaciones, reversas y confirmaciones

## Historia de Usuario

**Como** usuario que concilia sus cuentas contra el extracto bancario
**Quiero** que una aserción de saldo se vuelva a evaluar sola cuando anulo una transacción
anterior a su fecha de corte
**Para** que el veredicto `MATCHED`/`MISMATCHED` refleje siempre el saldo real y no me
quede una conciliación en verde que ya dejó de ser cierta (RF-18)

## Criterios de Aceptación

### AC-1: Las anulaciones disparan re-evaluación

`ReevaluateAssertionsReactor` reacciona a `TransactionVoided` además de a
`TransactionRecorded` y `TransactionAmended`. Hoy `REEVALUATION_TRIGGERS`
(`reevaluate-assertions.reactor.ts:15-18`) solo contiene los dos últimos, con un
`TODO(reactor)` que declara el hueco: *"balance-decreasing voids are not yet
re-evaluated"*.

### AC-2: Confirmaciones y reversas no necesitan disparador propio, y hay tests que lo prueban

Verificado contra el código durante el diseño: de los tres eventos de estado, **solo
`TransactionVoided` puede cambiar un veredicto**.

- `AssertionPostingReader.byAccountUpToDate` devuelve los postings `CONFIRMED` **y**
  `PENDING`, y nunca los `VOIDED`.
- `AssertionEvaluator` suma la población incluida sin discriminar por estado: su partición
  es puramente temporal (intradía vs cierre de día, §2.4).

De ahí:

- **`TransactionConfirmed`** no altera el saldo evaluado: el posting ya contaba como
  `PENDING` y sigue contando como `CONFIRMED`, por el mismo monto.
- **`TransactionReversed`** ya está cubierto: la reversa emite su propio
  `TransactionRecorded`, que **sí** lleva postings y fecha en el payload y que el reactor
  procesa desde siempre.

Esta historia no agrega esos dos disparadores. En su lugar deja **tests que documentan el
porqué**: uno que confirma una transacción y verifica que el veredicto de una aserción
previa no cambia, y otro que reversa una confirmada y verifica que la re-evaluación ocurre
igual, disparada por el `TransactionRecorded` de la reversa.

### AC-3: El reactor resuelve las cuentas tocadas leyendo `proj_postings`

Los eventos de cambio de estado (`TransactionVoided`, `TransactionConfirmed`,
`TransactionReversed`) **no llevan postings en su payload**, a diferencia de
`TransactionRecorded`/`TransactionAmended`. Para esos tres, el reactor obtiene las cuentas
afectadas y la fecha contable consultando `proj_postings` por `transaction_id`, mediante un
puerto de lectura del módulo — nunca cargando el agregado desde el event store (RNF-10).

No hay problema de lag: `proj_postings` se escribe de forma **síncrona** en la transacción
del command (§8.1 clasifica `transaction_list` como proyección síncrona), así que para
cuando el pump alcanza el evento la proyección ya está al día. Sumado a la garantía que
hu-0015 dejó establecida —el pump proyecta antes de alimentar al reactor— el reactor
siempre lee un estado consistente con el evento que está procesando.

El esquema de eventos **no cambia**: no hace falta `schema_version` 2 ni upcasting, y los
eventos ya escritos siguen siendo válidos tal cual.

### AC-4: Re-evaluar es idempotente

Reprocesar el mismo evento no produce eventos nuevos si el veredicto no cambió: el
agregado `BalanceAssertion` permanece en silencio ante un veredicto idéntico (RNF-4). El
comportamiento actual ya lo garantiza y debe seguir garantizándolo con los tres eventos
nuevos.

### AC-5: Las aserciones revocadas nunca se re-evalúan

Una aserción revocada queda fuera del alcance de `AssertionLookupPort.onAccountFrom`,
cualquiera sea el evento disparador.

### AC-6: Cobertura de test de los flujos nuevos

`TransactionVoided` tiene un test que verifica que una aserción `MATCHED` previa pasa a
`MISMATCHED` cuando la anulación reduce el saldo por debajo de su fecha de corte, y que una
aserción con corte anterior a la transacción no se toca.

Se suman los dos tests de AC-2 que documentan por qué `Confirmed` y `Reversed` no llevan
disparador propio.

## Reglas de Negocio

- Los reactors solo despachan commands: nunca escriben eventos ni proyecciones
  directamente (§3.2, RNF-10).
- Un reactor que falla en silencio rompe la conciliación sin síntoma visible — por eso
  RNF-12 exige exponer sus errores como métrica (ver hu-0022).
- La semántica temporal de la evaluación es la de §2.4: `occurred_at` frente al cierre del
  día en la zona horaria de `LedgerSettings`, con resultado `INDETERMINATE` cuando no se
  puede decidir.

## Fuera de Alcance

- La persistencia Postgres de las proyecciones de conciliación — es hu-0015 (ya cerrada).
- La documentación del módulo — es hu-0017.
- **La atomicidad cross-stream** (`TODO(atomicity)` en `resolve-discrepancy.handler.ts` y
  `merge-pending-transfers.handler.ts`) — es **hu-0023**. Es integridad transaccional, un
  problema distinto de la re-evaluación, y alcanza también a `MergePendingTransfers`, que
  no forma parte de esta historia.
