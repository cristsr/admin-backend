# context: refactor-module-boundaries

Relevamiento de las fronteras entre los cinco módulos de `apps/ledger`. Todo lo de acá está
verificado leyendo el archivo, no inferido de un grep. Los `archivo:línea` son de la tercera
pasada de auditoría (2026-08-08, rama `feat/core`).

## Apps afectadas

- `apps/ledger` — los 5 módulos, más `bootstrap/` y `tooling/`.
- `libs/cqrs` — **sin cambios**. Ningún hallazgo lo toca.
- `apps/finances` — congelado, fuera de alcance.

---

## Lo que ya está cerrado (no reabrir)

La auditoría confirma que estas reglas se cumplen y están **verificadas por test**, no por
convención. El refactor no puede romperlas:

- Cero decoradores de framework en `domain/` y `application/`.
- Cero puertos declarados como `interface` — los 17 son `abstract class`.
- Cero lecturas de configuración arriba de `infrastructure/`.
- Cero imports de `read-model-store` o `Criteria` desde `application/`.

El guard es `apps/ledger/src/hexagonal-isolation.spec.ts`, con tres casos
(`frameworkViolations`, `layerViolations`, `readModelViolations`). **Su punto ciego es
exactamente este refactor:** `layerOf()` clasifica por capa (`domain`/`application`) y
`FORBIDDEN_LAYERS` compara capas, nunca módulos. Un import
`accounts/application → transactions/domain` tiene dirección correcta y pasa los tres casos.
Por eso AC-2 pide un cuarto detector, no un ajuste de los existentes.

---

## Cruce 1 — imports del `domain/` de otro módulo (AC-1)

Seis archivos productivos. Los dos tipos involucrados son siempre los mismos:

| Archivo | Línea | Importa | De |
|---|---|---|---|
| `accounts/application/services/account-validation.service.ts` | 19 | `PostingLine` | `transactions/domain/posting` |
| `accounts/…/record-opening-balance/record-opening-balance.handler.ts` | 10 | `TransactionStatus` | `transactions/domain/transaction` |
| `reconciliation/…/resolve-discrepancy/resolve-discrepancy.handler.ts` | 14, 15 | ambos | `transactions/domain` |
| `reconciliation/domain/ports/assertion-posting-reader.port.ts` | 4 | `TransactionStatus` | `transactions/domain/transaction` |
| `reconciliation/domain/services/adjustment.factory.ts` | 3 | `PostingLine` | `transactions/domain/posting` |
| `reconciliation/infrastructure/adapters/persistence/read-model-assertion-posting-reader.ts` | 12 | `TransactionStatus` | `transactions/domain/transaction` |
| `reconciliation/infrastructure/adapters/persistence/in-memory/in-memory-assertion-posting-reader.ts` | 8 | `TransactionStatus` | `transactions/domain/transaction` |

Origen actual de los dos tipos:

- `apps/ledger/src/transactions/domain/posting/posting-line.ts`
- `apps/ledger/src/transactions/domain/transaction/transaction-status.ts`

Destino propuesto: `apps/ledger/src/shared/domain/`, donde **ya vive `PostingOrigin`**
(`shared/domain/value-objects/posting-origin.ts`) — el tercer concepto de la misma familia,
movido ahí por esta misma razón en un refactor previo. El precedente existe y es del mismo
autor del código.

Ojo al mover: `posting-line.ts` tiene su `posting-line.spec.ts` y `posting.serializer.ts`
en la misma carpeta; el serializer se queda en `transactions` (es infraestructura de evento),
solo cruza el value object.

### Caso aparte: `ledger-event-registry.factory.ts`

`ledger/application/factories/ledger-event-registry.factory.ts:5-25` importa los eventos de
`accounts`, `reference` y `transactions`. Es un registro global de deserializadores: por
definición conoce el catálogo de eventos de todos los módulos. **No es el mismo defecto** —
es una composición que quedó en `application/` de un módulo en lugar de en `bootstrap/`.
Se resuelve solo si AC-4 mueve la composición; si no, es la excepción declarada de AC-2.

---

## Cruce 2 — imports de la `infrastructure/` de otro módulo (AC-7, AC-8)

Cuatro archivos, todos leyendo el `*.schema.ts` de una proyección ajena:

| Archivo | Línea | Lee el schema de |
|---|---|---|
| `accounts/…/persistence/read-model-account-balance-finder.ts` | 13 | `transactions/…/account-balances.schema` |
| `transactions/…/persistence/read-model-account-lookup.ts` | 7 | `accounts/…/account-tree.schema` |
| `transactions/infrastructure/projections/transaction-list.projector.ts` | 8 | `accounts/…/account-tree.schema` |
| `reconciliation/…/persistence/read-model-assertion-posting-reader.ts` | 11 | `transactions/…/transaction-list.schema` |

**El primero está justificado y documentado**: `account-balances.schema.ts:6-13` explica por
qué `transactions` escribe `proj_balances` y `accounts` lo consulta. Esa asimetría queda
como está (fuera de alcance en `hu.md`).

**Lo que sí se corrige** es la dirección inversa que nadie defendió:
`account-balances.schema.ts:1` importa `BalanceView` de `accounts/application/views/` para
construirlo en `toBalanceView` (`:29-36`). El ciclo resultante es
`accounts/infra → transactions/infra → accounts/application`. El consumidor
—`read-model-account-balance-finder.ts:39`— ya importa `BalanceRow` y ya conoce `BalanceView`,
así que mover el mapper ahí no agrega ningún import nuevo.

Los otros tres no tienen JSDoc de contrato: son los de AC-8.

---

## Cruce 3 — `InitializeLedger` escribe el agregado de `accounts` (AC-3)

`ledger/application/usecases/initialize-ledger/initialize-ledger.handler.ts`:

- `:8` importa `Account`, `:7` importa `AccountRepository`.
- `:87-98` — `openSystemAccount()` llama `Account.open({ …, isSystem: true }, idGenerator)`.
- `:65-74` — los tres `save` corren dentro de `eventStore.withTransaction`.
- `:78` — `dispatcher.dispatch` queda **fuera** del scope, con el motivo comentado en `:76-77`.
- `:60-61` — `LedgerSettings.initialize` necesita los dos `account.id` **antes** de guardarse,
  así que el orden es: construir cuentas → construir settings → abrir transacción.

### Por qué el fix no es un reemplazo directo

Verificado en el módulo `accounts`:

- `open-account.command.ts:7-14` — `OpenAccountCommand(name, currencies, openedOn, isBankMirror)`.
  **No tiene `isSystem`.**
- `open-account.handler.ts:40` — el handler fija `isSystem: false` hardcodeado.
- `open-account.handler.ts:32` — llama `names.ensureAvailable`, que lee `proj_accounts`; en
  una inicialización esa proyección todavía está vacía, así que el chequeo pasa pero depende
  de un read model recién creado.
- `open-account.handler.ts:45` — despacha proyecciones por su cuenta. Despacharlo desde dentro
  del `withTransaction` de `InitializeLedger` metería el dispatch en el scope transaccional,
  que es justo lo que `:76-77` evita a propósito.

El precedente de cruce por bus existe y funciona —`record-opening-balance.handler.ts:45`
despacha `RecordTransactionCommand` y protege la cuenta técnica con `PostingOrigin.SYSTEM`
(`:69`)— pero ahí el handler destino no abre transacción ni necesita devolver un id que se
consuma antes del commit. Las tres opciones están planteadas en `hu.md` §Decisiones abiertas.

---

## Cruce 4 — dos raíces de composición (AC-4, AC-5, AC-6)

### Estado actual

Hay **dos** lugares donde los puertos se atan a adapters:

1. `apps/ledger/src/bootstrap/read-side-ports.factory.ts` — `createQueryPorts(readModel)`
   (`:57-66`) y `createWriteSideReadPorts(readModel)` (`:82-88`). Instancian los adapters con
   `new`. **Esta es la que corre**: los handlers se componen a mano en
   `bootstrap/ledger-application.factory.ts` y `bootstrap/query-bus.factory.ts`.
2. Los `@Module` de Nest: `accounts.module.ts:24-27`, `reference.module.ts:23`,
   `ledger-core.module.ts:51-53`.

### Qué se resuelve por dónde (verificado consumidor por consumidor)

| Puerto | Bindeado en | ¿Alguien lo inyecta por Nest? |
|---|---|---|
| `AccountTreeFinder` | `accounts.module.ts:24` + factory | **No** |
| `AccountBalanceFinder` | `accounts.module.ts:25` + factory | **No** |
| `AccountConstraintsReader` | `accounts.module.ts:26` + factory | **No** |
| `AccountNameReader` | `accounts.module.ts:27` + factory | **No** |
| `CurrencyCatalogFinder` | `reference.module.ts:23` + factory | **No** |
| `LedgerSettingsFinder` | `ledger-core.module.ts:51` + factory | **No** |
| `SystemAccountLookup` | `ledger-core.module.ts:53` + factory | **Sí** — `reconciliation.module.ts:142` |
| `LedgerTimezoneReader` | `ledger-core.module.ts:52` | **Sí** — `reconciliation.module.ts:111` |
| `TransactionFinder` | `transactions.module.ts:42` (SQL) + factory (twin) | sustitución deliberada, R7 |

Los seis primeros son providers muertos. Los dos siguientes tienen las dos copias vivas: el
write side recibe la instancia de la factory y `reconciliation` recibe la de Nest.

`AccountsController` (`accounts.controller.ts:44-47`) y `AccountsHttpModule` confirman el
diagnóstico: los controllers solo inyectan `CommandBus` y `QueryBus`.

`TransactionFinder` es el único caso donde la doble declaración es intencional y está
documentada (`transactions.module.ts:38-42` y `read-side-ports.factory.ts:68-80`): el adapter
SQL sustituye al gemelo store-backed, y un contract test prueba que son equivalentes. Ese
mecanismo se conserva.

### El composition root mal ubicado

`ledger/ledger-core.module.ts:26-28` se autodeclara *"Composition root that mounts the real
write and read buses into Nest DI"*, pero vive dentro del módulo de negocio `ledger`
(settings). Consecuencias verificadas:

- `:21` importa `ReadModelCurrencyCatalog` desde `reference/infrastructure/adapters/`.
- `:38-43` lo instancia y lo aliasa a `CurrencyCatalog`.
- `reference.module.ts:30` inyecta esa clase concreta, que **su propio módulo no provee**.

Es la única dependencia circular entre módulos del proyecto. `bootstrap/` ya existe y ya
contiene las tres factories de composición, así que el destino es obvio y el diff es un
`git mv` más el import de `app.module.ts:9`.

---

## Cruce 5 — topología y nombres (AC-9, AC-10, AC-11)

| Qué | Dónde está | Dónde va |
|---|---|---|
| `ReadModelCurrencyCatalog` | `reference/infrastructure/adapters/read-model-currency-catalog.ts` (suelto) | `…/adapters/persistence/` |
| `StaticCurrencyCatalogCache` | `reference/application/ports/currency-catalog.cache.ts:21` | junto a su único consumidor, `bootstrap/ledger-application.factory.ts:181` |
| `PageRequest` | `transactions/application/ports/page-request.type.ts` | `transactions/application/types/` (ya existe, con `posting-input.type.ts`) |
| `NotATransferPair` / `PendingLegNotFound` | `transactions/domain/exceptions/transfer.exception.ts` | junto a `domain/services/transfer-pair.rule.ts` |

Puertos sin sufijo `.port.ts` (2 de 17):
`shared/application/ports/ledger-context-resolver.ts`,
`reference/application/ports/currency-catalog.cache.ts`.

Barrels: 6 `index.ts` de puertos/servicios contra ~90 carpetas con contenido.
`transactions/application/ports/index.ts` exporta 2 de 4 (`account-lookup`, `posting-validator`;
faltan `transaction-finder`, `pending-review-finder`) y `transactions.module.ts:9-10` importa
por ruta profunda igual. Los `http/dto/index.ts` y `domain/*/events/index.ts` sí están
completos y se usan — el problema es solo el nivel de puertos.

---

## Testing existente a preservar

- `apps/ledger/src/hexagonal-isolation.spec.ts` — el guard de fronteras; gana el cuarto caso
  (AC-2). Su helper `sourceFiles()` ya recorre todo el árbol, así que el detector nuevo
  reusa la infraestructura que hay.
- `apps/ledger/src/app.wiring.spec.ts` — monta el `AppModule` completo con un `DataSource`
  inerte (`:29-45`). Es el lugar natural del test de doble binding (AC-6).
- `bootstrap/ledger-application.spec.ts`, `bootstrap/query-bus.spec.ts` — verifican la
  composición in-memory; ambas van a cambiar de firma si cambia la composición.
- `shared/testing/fixed-ledger-doubles.ts` — dobles de las composiciones in-memory; incluye
  `FixedSystemAccountLookup`.
- Contract tests: `transactions/infrastructure/testing/transaction-finder.contract.ts`,
  `reconciliation/infrastructure/testing/{adjustment-audit-reader,assertion-status-reader}.contract.ts`.
- e2e: `accounts-api.e2e.spec.ts`, `transactions-api.e2e.spec.ts`,
  `reconciliation.discrepancy.e2e.spec.ts`, `transactions.merge-transfers.e2e.spec.ts`,
  `ledger-context.e2e.spec.ts`.
- Rebuild/consistencia: `tooling/projection-rebuilder.integration.spec.ts`,
  `tooling/consistency-verifier.spec.ts`.

Nota de configuración detectada al revisar `jest.config.ts:23`: `testMatch` agrega
`**/*.e2e-spec.ts`, pero los cinco e2e del proyecto se llaman `*.e2e.spec.ts` (con punto).
Corren igual por el patrón `**/*.spec.ts`, así que ese entry no matchea nada. Es inocuo —
lo anoto para que no se lea como cobertura que no existe.

---

## Riesgos verificados

1. **`tooling/` depende de los schemas que se van a mover.** `consistency-verifier.ts:13`,
   `rebuild.command.ts:26` y tres specs importan `PROJ_BALANCES` desde
   `transactions/…/account-balances.schema`. Si el schema se mueve, se mueven con él. AC-7
   solo saca `toBalanceView`, no la constante — pero conviene tenerlo presente.
2. **`ledger-core.module.ts` es `@Global()`** (`:30`). Al moverlo a `bootstrap/`, verificar
   que los siete módulos que heredan sus providers (buses, `Clock`, `IdGenerator`,
   `EventStore`, `ReadModelStore`, `CurrencyCatalog`) siguen resolviéndolos. `app.wiring.spec.ts`
   lo cubre.
3. **Quitar los providers muertos de `accounts.module.ts` lo deja sin `providers`**, igual que
   `AccountsHttpModule`. Es correcto, pero el módulo queda como pura declaración de imports;
   confirmar que sigue teniendo razón de existir o fusionarlo con su http module.
4. **`ensureAvailable` sobre proyección vacía** en el camino de inicialización (AC-3): si el
   diseño elige despachar `OpenAccountCommand`, las dos cuentas técnicas pasan por el chequeo
   de unicidad de nombre contra `proj_accounts`, que en ese momento aún no recibió el
   dispatch de la primera. Verificar que el orden no genere un falso positivo de disponibilidad.
