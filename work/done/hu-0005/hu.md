# hu-0005: Command bus + políticas transversales + handlers núcleo

## Historia de Usuario

**Como** desarrollador del núcleo del ledger (`apps/ledger`)
**Quiero** un command bus con políticas transversales (contexto autenticado, idempotencia,
concurrencia optimista) y los 8 handlers núcleo (`InitializeLedger`, `OpenAccount`,
`RecordTransaction`, `ConfirmTransaction`, `AmendPendingTransaction`, `AnnotateTransaction`,
`VoidPendingTransaction`, `ReverseConfirmedTransaction`)
**Para** poder inicializar un ledger, abrir cuentas y registrar/confirmar transacciones
balanceadas end-to-end por código, con errores de dominio estables, antes de exponer nada por
HTTP (EP-2)

> Corresponde a **EP-1.8** del [roadmap del ledger](../../../ledger-roadmap.md), paso 5 del
> Apéndice B de `work/ledger/EP-1-nucleo.md` (command bus después de tener `account_tree`
> disponible para la validación cruzada). Detalle técnico: `work/ledger/EP-1-nucleo.md`
> (sección EP-1.8). Depende de `hu-0002` (`EventStore`), `hu-0003` (agregados `Account`/
> `LedgerTransaction`) y `hu-0004` (proyección `account_tree`).

## Criterios de Aceptación

### AC-1: Un command retorna solo identificadores, nunca lecturas (RNF-10)

`CommandResult` contiene únicamente `aggregateId`, `streamPosition` (para read-your-writes,
RNF-9) e `idempotentReplay: boolean`. Ningún handler retorna datos de un read model.

### AC-2: `AuthenticatedContextPolicy` rechaza sin contexto válido (RF-26)

Todo command sin `userId`/`clientId` válidos en su `AuthContext` rechaza con
`MissingAuthContextException` **antes** de tocar el dominio — es la primera política de la
cadena.

### AC-3: `IdempotencyPolicy` corta en replay sin ejecutar el handler (INV-10)

Si `ctx.externalRef` está presente y `EventStore.findByExternalRef` encuentra un evento ancla
previo del mismo usuario, la política **corta la cadena** y devuelve el `CommandResult`
original con `idempotentReplay: true`, sin invocar el handler ni producir efectos nuevos.

### AC-4: `OptimisticConcurrencyPolicy` traduce el conflicto a un error estable (INV-7)

Un `ConcurrencyConflictException` propagado desde el `EventStore` se traduce a un error de
dominio con código estable `CONCURRENCY_CONFLICT`.

### AC-5: `InitializeLedger` crea las cuentas técnicas y la configuración inicial (INV-13, RF-2)

`InitializeLedger` crea exactamente dos cuentas de sistema (`isSystem: true`):
`Equity:OpeningBalances` y `Equity:Adjustments`, y registra `presentation_currency`/
`timezone` iniciales mediante `LedgerInitialized`. Reintentar con el **mismo** `external_ref`
es idempotente vía `IdempotencyPolicy` (AC-3). Invocar `InitializeLedger` sobre un ledger ya
inicializado con un `external_ref` **distinto** rechaza con una excepción de dominio
específica (`LEDGER_ALREADY_INITIALIZED`) — un chequeo explícito, no delegado a la colisión de
nombre de `OpenAccount`. Nunca se crean cuentas técnicas duplicadas.

### AC-6: `OpenAccount` valida colisión de nombre contra `account_tree`

`OpenAccount` abre una cuenta vía `Account.open` (`hu-0003`). Un nombre ya existente para el
usuario rechaza con `NAME_COLLISION`, validado contra la proyección `account_tree`
(`hu-0004`).

### AC-7: `RecordTransaction` valida balanceo, cuenta cerrada y moneda no permitida

`RecordTransaction` registra una transacción balanceada en `PENDING` o `CONFIRMED`.
Desbalanceada en alguna moneda rechaza con `UNBALANCED_TRANSACTION`. Un posting contra una
cuenta cerrada en la fecha contable rechaza con `ACCOUNT_CLOSED`. Un posting con una moneda no
aceptada por la cuenta rechaza con `CURRENCY_NOT_ALLOWED`. Estas dos últimas validaciones
usan `AccountValidationService` contra `account_tree` (INV-3/INV-4 cruzado, consistencia
relajada: el fallo de esta validación degrada a discrepancia detectable, nunca a corrupción
del stream).

### AC-8: `Confirm`/`Amend`/`Annotate`/`Void` respetan las transiciones de `LedgerTransaction`

Cada handler delega en el método correspondiente del agregado (`hu-0003`) y propaga sus
errores de transición de estado (`IMMUTABLE_TRANSACTION`, etc.) sin lógica de negocio
adicional en el handler.

### AC-9: `ReverseConfirmedTransaction` orquesta la reversa en un único append atómico

`ReverseConfirmedTransaction` invoca `LedgerTransaction.reverse` (que devuelve el
`ReversalPlan`) y persiste, en **un único append atómico**, tanto `TransactionReversed` sobre
la transacción original como `TransactionRecorded`(+`Confirmed`) de la transacción de
reversa vinculada (`metadata.reverses_id`). Un reintento con el mismo `external_ref` no
duplica la reversa (valida en la práctica la decisión de idempotencia anchor-only de
`hu-0002`).

## Reglas de Negocio

- Orden fijo de políticas: `AuthenticatedContextPolicy` → `IdempotencyPolicy` →
  `OptimisticConcurrencyPolicy` — nunca se invierte ni se omite ninguna.
- Los códigos de error de dominio (`UNBALANCED_TRANSACTION`, `ACCOUNT_CLOSED`,
  `CURRENCY_NOT_ALLOWED`, `NAME_COLLISION`, `CONCURRENCY_CONFLICT`,
  `SYSTEM_ACCOUNT_PROTECTED`) son estables — no cambian de valor entre versiones (RF-14; se
  exponen tal cual en EP-2).
- Todo evento persistido por un handler lleva `userId` propagado desde el `AuthContext`
  (INV-9) — ningún evento se crea sin él.
- `RNF-12`: trazas y métricas del bus viven en decoradores alrededor de las políticas, nunca
  dentro del dominio.
- `application/` de este alcance libre de NestJS/TypeORM (los handlers son núcleo; NestJS solo
  materializa los tokens de inyección en el módulo).
- TDD estricto, con `InMemoryEventStore` + `Clock`/`IdGenerator` deterministas (de `hu-0002`)
  para toda la suite.

## Resolución de Ambigüedades

- **AC-5:** ¿Qué pasa si `InitializeLedger` se reintenta con `external_ref` distinto sobre un
  ledger ya inicializado? → Rechaza con una excepción de dominio específica
  `LEDGER_ALREADY_INITIALIZED` (chequeo explícito, no delegado a `NAME_COLLISION`).

## Fuera de Alcance

- El adaptador HTTP que expone estos commands — EP-2 (fuera del alcance de EP-1).
- Las proyecciones `transaction_list`/`account_balances` y el query bus — `hu-0006` (resto de
  EP-1.10 + EP-1.11).
- El adaptador `PostgresEventStore` — `hu-0007` (EP-1.5).

## Technical Context

### Microservicio objetivo
- `apps/ledger`

### Artefactos a reutilizar
- `Account`, `LedgerTransaction`, `BalanceRule` — de `hu-0003`
- `EventStore`, `InMemoryEventStore`, `Clock`/`IdGenerator` deterministas — de `hu-0002`
- Proyección `account_tree` (vía `ReadModelStore.query`) — de `hu-0004`
- Jerarquía `DomainException` — de `@shared`

### Patrones obligatorios
- Políticas del bus como `CommandPolicy` (`abstract class`), cadena de responsabilidad con
  orden fijo
- `application/` libre de NestJS/TypeORM
- Un handler por acción (`*-command/*` — handler + args + spec), sin lógica de negocio fuera
  del agregado más allá de la orquestación y la validación cruzada contra proyecciones
- TDD estricto

### Restricciones técnicas
- Ningún handler retorna datos de un read model (RNF-10) — solo ids + posición de stream
- La validación posting↔cuenta contra `account_tree` es de **consistencia relajada**: un
  desfase entre el stream y la proyección nunca corrompe el stream, se detecta como
  discrepancia

### Deuda técnica relevante
- Ninguna — depende de `hu-0002`/`hu-0003`/`hu-0004` ya construidas en este mismo flujo
