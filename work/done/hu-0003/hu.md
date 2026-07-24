# hu-0003: Agregados `Account` y `LedgerTransaction`

## Historia de Usuario

**Como** desarrollador del núcleo del ledger (`apps/ledger`)
**Quiero** los agregados event-sourced `Account` (apertura, renombre, cierre) y
`LedgerTransaction` (registro, enmienda, anotación, confirmación, anulación, reversa) con sus
invariantes de dominio protegidas
**Para** tener el ciclo de vida contable completo modelado en el dominio puro, probado sobre
`InMemoryEventStore`, antes de exponerlo a través de commands (§9.4)

> Corresponde a **EP-1.6 + EP-1.7** del [roadmap del ledger](../../../ledger-roadmap.md), en
> el orden de dependencias del Apéndice B de `work/ledger/EP-1-nucleo.md` (paso 3: agregados
> sobre in-memory, antes del command bus). Detalle técnico: `work/ledger/EP-1-nucleo.md`
> (secciones EP-1.6 y EP-1.7). Depende de `hu-0001` (value objects, envelope) y `hu-0002`
> (`EventStore`, `AggregateRoot` base implícita en el puerto).

## Criterios de Aceptación

### AC-1: `AggregateRoot` como base común de los dos agregados

Existe una base `AggregateRoot<TId>` con `version`, `pullChanges()` (devuelve y limpia los
eventos no confirmados), `loadFromHistory(events)` (rehidrata aplicando cada evento) y los
métodos protegidos `raise(event)` (registra + aplica) y `apply(event)` (abstracto, muta solo
estado).

### AC-2: `Account.open` exige exactamente una moneda para cuentas reales

Abrir una cuenta real (`ASSETS`/`LIABILITIES`) con más de una moneda declarada rechaza la
construcción. Una cuenta nominal (`INCOME`/`EXPENSES`/`EQUITY`) admite varias monedas. `open`
emite `AccountOpened`.

### AC-3: `Account.rename` conserva el tipo raíz y protege cuentas de sistema (INV-13/14)

`rename` emite `AccountRenamed` y conserva el `type` de la cuenta; un intento de cambiar de
raíz rechaza con `RootTypeImmutableException` (INV-14). `rename`/`close` sobre una cuenta
marcada `isSystem` rechazan con `SystemAccountProtectedException` (code
`SYSTEM_ACCOUNT_PROTECTED`, INV-13). La propagación del nuevo
nombre a las cuentas descendientes **no** ocurre en el agregado — es responsabilidad de la
proyección `account_tree` (`hu-0004`).

### AC-4: `Account.close` y validaciones de fecha/moneda (INV-3 parcial, INV-4)

`close(closedOn)` emite `AccountClosed`. `ensureOpenOn(date)` valida que la fecha esté entre
apertura y cierre (o sin cierre); `ensureAcceptsCurrency(code)` valida que la moneda esté
entre las monedas permitidas de la cuenta. Ambas se usan luego por los handlers de
transacciones (`hu-0005`) para validar postings contra la cuenta.

### AC-5: `LedgerTransaction.record` exige balanceo por moneda y ≥2 postings (INV-1, INV-2, INV-11)

`record` rechaza con menos de 2 postings (INV-2). El balanceo se verifica a través de un
**único componente** `BalanceRule` (INV-11): la suma firmada de los montos, por cada moneda
presente, debe ser exactamente cero (INV-1, sin tolerancia). Una transacción multi-moneda
balanceada por moneda es válida; una descuadrada en cualquier moneda rechaza. `record` admite
estado inicial `PENDING` o `CONFIRMED` (RF-3) y emite `TransactionRecorded`.

### AC-6: `amend` solo en `PENDING`, `annotate` en cualquier estado no `VOIDED` (INV-6)

`amend` (cambio económico: postings/fecha) solo se permite en estado `PENDING` y re-verifica
INV-1/INV-2; en `CONFIRMED` o `VOIDED` rechaza con `ImmutableTransactionException` (code
`IMMUTABLE_TRANSACTION`). `annotate`
(payee, description, invoice_url, tags, metadata) se permite en cualquier estado salvo
`VOIDED`, y nunca modifica postings.

### AC-7: Transiciones de estado del ciclo de vida

`confirm` mueve `PENDING → CONFIRMED` y congela los postings; un segundo `confirm` o un
`confirm` sobre `VOIDED` rechaza. `void(reason)` solo aplica sobre `PENDING`; anular una
`CONFIRMED` rechaza. `reverse(reversalId, clock)` solo aplica sobre `CONFIRMED`: emite
`TransactionReversed` sobre el agregado original y devuelve un `ReversalPlan` (postings
invertidos + `reverses_id`) que el handler (`hu-0005`) usa para registrar la transacción de
reversa vinculada en un único append atómico; `reverse` sobre `PENDING` rechaza.

### AC-8: Rehidratación completa desde el historial

Ambos agregados reconstruyen su estado completo (incluyendo el ciclo de vida entero de
`LedgerTransaction`: record → amend → confirm → annotate → reverse) a partir de
`loadFromHistory` sin depender de infraestructura.

## Reglas de Negocio

- El balanceo (INV-1/INV-11) vive en un único sitio: `BalanceRule`/`ZeroSumBalanceRule` — nunca
  se reimplementa en otro punto del código.
- La validación cruzada posting↔cuenta (INV-3/INV-4 respecto de otras cuentas, colisión de
  nombres) **no** vive en estos agregados: se resuelve en los handlers (`hu-0005`) contra la
  proyección `account_tree` (§3.5) — consistencia relajada, nunca corrupción de datos.
- `LedgerDate` es una fecha contable plana `YYYY-MM-DD` sin zona horaria (RNF-7).
- `domain/` libre de NestJS/TypeORM; agregados sin dependencia de infraestructura.
- TDD estricto: balanceo, transiciones de estado y rehidratación cubiertos por spec antes de
  cada implementación.

## Fuera de Alcance

- El command bus, sus políticas y los handlers que orquestan estos agregados (incluida la
  validación cruzada contra `account_tree` y el `ReversalPlan` orquestado) — `hu-0005`
  (EP-1.8).
- La proyección `account_tree` que resuelve la propagación de renombre — `hu-0004` (EP-1.9 +
  parte de EP-1.10).
- El derivador `derived_kind` y las proyecciones `transaction_list`/`account_balances` —
  `hu-0006` (resto de EP-1.10).

## Technical Context

### Microservicio objetivo
- `apps/ledger`

### Artefactos a reutilizar
- `AccountName`, `Payee`, `CurrencyCode`, `PostingLine` — de `hu-0001`
- `DomainEvent`, `EventEnvelope` — de `hu-0001`
- `EventSourcedRepository<TAggregate>`, `Clock`, `IdGenerator` — de `hu-0002`
- Jerarquía `DomainException` — de `@shared`

### Patrones obligatorios
- `domain/` libre de NestJS/TypeORM
- Agregados construidos por factories estáticas (`Account.open`, `LedgerTransaction.record`),
  nunca constructores públicos
- `BalanceRule` como único punto de balanceo (INV-11), probado en aislamiento
- TDD estricto

### Restricciones técnicas
- El agregado `Account` no propaga renombres a descendientes (ocurre en la proyección)
- `LedgerTransaction` no conoce tipos de cuenta (no puede derivar `derived_kind` — eso vive en
  la proyección, `hu-0006`)
- La reversa cruza dos agregados; el agregado solo devuelve el `ReversalPlan`, nunca escribe
  directamente la transacción de reversa

### Deuda técnica relevante
- Ninguna — depende de `hu-0001`/`hu-0002` ya construidas en este mismo flujo
