# context: hu-0016

## Historia resumida

**Como** usuario que concilia sus cuentas contra el extracto bancario
**Quiero** que una aserción se vuelva a evaluar sola cuando anulo, reverso o confirmo una
transacción anterior a su fecha de corte
**Para** que el veredicto no me quede en verde cuando dejó de ser cierto (RF-18)

## Apps afectadas

- `apps/ledger`, módulo `reconciliation` (y una lectura nueva sobre `proj_postings`, que
  mantiene `transactions`)

> **Base:** hu-0015 acaba de cerrar (commits `23a44c2`, `1cf9937`, `d499b60`) y dejó los
> projectors sobre el contrato `Projector`, la persistencia en Postgres y
> `ReconciliationPump` con checkpoint persistido. Esta historia construye encima.

---

## apps/ledger

### El hueco a cerrar

**Archivo:** `src/reconciliation/application/reactors/reevaluate-assertions.reactor.ts`

```typescript
const REEVALUATION_TRIGGERS: ReadonlySet<string> = new Set([
  'TransactionRecorded',
  'TransactionAmended',
]);
```

El comentario sobre esa constante declara el hueco textualmente: *"Real EP-1 status events
(`TransactionConfirmed`/`Voided`/`Reversed`) omit postings; re-evaluating on those would
need a transaction lookup — TODO(reactor): balance-decreasing voids are not yet
re-evaluated."*

`touchedAccounts(event)` lee `payload.postings` y `payload.date` del evento. Para los tres
eventos que faltan, ese payload no existe.

### Payload real de los tres eventos a agregar

| Evento | `toPayload()` |
|---|---|
| `TransactionVoided` | `{ reason }` |
| `TransactionConfirmed` | `{ confirmedAt }` |
| `TransactionReversed` | `{ reversalTransactionId }` |

Ninguno lleva `postings` ni `date` — de ahí la decisión de AC-3.

Los seis `eventType` de transacciones son literales de string en cada clase de evento
(`'TransactionRecorded'`, `'TransactionAmended'`, `'TransactionAnnotated'`,
`'TransactionConfirmed'`, `'TransactionVoided'`, `'TransactionReversed'`); **no hay
constantes exportadas** como sí las tiene `reconciliation`
(`BALANCE_ASSERTED`, etc.). El reactor las escribe hoy como literales.

### La proyección de la que se leerán las cuentas (AC-3)

**Tabla:** `proj_postings`, declarada en
`src/transactions/infrastructure/projections/transaction-list.projector.ts:12`

Columnas relevantes: `posting_id`, `transaction_id`, `account_id`, `amount`,
`currency_code`, `status`, `date`.

`transaction_id` es el `aggregateId` del evento, así que la consulta del reactor es directa:
filtrar por `transaction_id` y quedarse con `account_id` + `date`.

**Por qué no hay problema de lag:** `transaction_list` (y con él `proj_postings`) es una
proyección **síncrona**, escrita en la transacción del command — §8.1 la clasifica así,
frente a `assertion_status`/`adjustment_audit` que son asíncronas. Cuando
`ReconciliationPump` alcanza el evento, `proj_postings` ya está al día. Sumado a la
garantía de hu-0015 (el pump proyecta antes de alimentar al reactor), el reactor siempre
lee consistente.

### Puertos existentes del reactor

**`AssertionLookupPort`** (`src/reconciliation/domain/ports/assertion-lookup.port.ts`)
`onAccountFrom(userId, accountId, affectedFrom: LedgerDate): Promise<readonly string[]>`

Implementado por `StoreBackedAssertionLookup`, que delega en
`AssertionStatusStore.nonRevokedOnAccountFrom` — el filtro de revocadas ya vive ahí, así
que **AC-5 se cumple sin escribir código nuevo**: cualquier disparador nuevo hereda la
exclusión.

**`AssertionPostingReader`** (`src/reconciliation/domain/ports/assertion-posting-reader.port.ts`)
Ya existe un puerto del módulo que lee postings, implementado por
`ReadModelAssertionPostingReader` — conviene revisarlo antes de crear uno nuevo: puede que
la lectura por `transaction_id` encaje ahí en vez de en un puerto aparte.

### Dónde se ejecuta el reactor

`src/reconciliation/infrastructure/adapters/events/reconciliation.pump.ts` (hu-0015):
proyecta con ambos projectors y después llama `reactor.on(event)`, avanzando un checkpoint
persistido por evento. El reactor no necesita cambiar su punto de invocación.

### Cobertura actual

`src/reconciliation/application/reactors/reevaluate-assertions.reactor.spec.ts` — los casos
existentes cubren `TransactionRecorded`/`TransactionAmended`. Hay que agregar uno por
disparador nuevo (AC-6).

---

## Gaps detectados

1. **Los `eventType` de `transactions` no están exportados como constantes.** El reactor
   los usa como literales de string. Si esta historia agrega tres más, conviene exportarlas
   desde `transactions/domain/transaction/events/` como ya hace `reconciliation`, para que
   un typo no pase silencioso. Cambio chico, mejora real.

2. **`AssertionPostingReader` podría solaparse con la lectura nueva.** Antes de crear un
   puerto para leer `proj_postings` por `transaction_id`, revisar si el existente ya cubre
   el caso o admite extenderse — evita duplicar el acceso a la misma tabla (DRY).

3. **`TransactionReversed` apunta a la transacción de reversa, no a la original.** Su
   payload lleva `reversalTransactionId`. Hay que decidir en diseño cuál de las dos
   transacciones se consulta en `proj_postings`: la reversa nueva ya genera su propio
   `TransactionRecorded` (que el reactor **ya** procesa hoy), así que reaccionar también a
   `TransactionReversed` podría ser redundante. Verificarlo en `/design` para no
   re-evaluar dos veces lo mismo — es idempotente, pero es trabajo al pedo.

4. **`TransactionConfirmed` mueve saldo de pendiente a confirmado.** Si la aserción evalúa
   contra saldo confirmado, una confirmación sí cambia el veredicto; si evalúa contra
   ambos, no. Confirmar contra `AssertionEvaluator` en diseño para justificar el disparador.
