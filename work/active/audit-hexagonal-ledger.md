# Auditoría de Arquitectura Hexagonal — `apps/ledger`

**Alcance:** `apps/ledger/src/` (verificado también `libs/cqrs/src/` como kernel de apoyo)
**Fecha:** 2026-08-07 · **Rama:** `feat/core`
**Score:** 26/36 → **36/36**

> **Estado (2026-08-07): cerrado.** Los 14 hallazgos están aplicados, más el `total`
> de `GET /transactions` que se había dejado como HU aparte. Suites verdes:
> **482 tests** en `ledger` (25 nuevos) y **110** en `cqrs`; 4 suites skipped en
> total, las que exigen una Postgres viva. `tsc` limpio en los tres tsconfig.
> El detalle de cada fix está en la nota `✅ Resuelto` bajo el hallazgo.

## Resumen

El núcleo está bien construido: los agregados son ricos y protegen sus propios
invariantes, **ningún** archivo de `domain/` o `application/` importa NestJS, TypeORM
o un driver — y hay un test (`hexagonal-isolation.spec.ts`) que lo congela —, todos
los puertos son `abstract class`, el cableado vive en los módulos con factories
explícitas, y `app.wiring.spec.ts` verifica que cada comando del catálogo tenga
handler registrado. Es una base sólida y poco común.

La debilidad dominante es una sola, y es sistemática: **`application/` importa
`infrastructure/`**. Doce archivos de producción leen constantes `PROJ_*` y tipos
`*Row` directamente de los projectors. De ahí se derivan dos consecuencias más: el
composition root del núcleo (`ledger-application.factory.ts`) vive dentro de la capa
de aplicación de un módulo de negocio y arrastra los projectors de los otros cuatro,
y el módulo `accounts` orquesta el `application/` y el `domain/` de `transactions`
sin capa anticorrupción. El test de aislamiento no lo detectó porque sólo prohíbe
paquetes externos (`@nestjs/`, `typeorm`, `pg`, `express`), no la dirección de
dependencias entre capas.

La segunda debilidad es el aislamiento de mapeo: los controllers declaran DTOs en
Swagger y devuelven las filas `snake_case` del read model. Ya está reconocido con
`FIXME` en el código, así que se reporta como deuda conocida, no como sorpresa.

## Scores por dimensión

| # | Dimensión | Antes | Ahora | Nota |
|---|---|---|---|---|
| 1 | Dependency direction | 1/3 | **3/3** | ningún archivo de `domain/`/`application/` alcanza `infrastructure/`; congelado por test |
| 2 | Module boundaries | 2/3 | **3/3** | composition root fuera de los módulos de negocio; queda L-3 (hygiene) |
| 3 | Domain richness | 3/3 | 3/3 | agregados con invariantes, VOs, `Money` sin float; una duplicación de INV-3/INV-4 |
| 4 | Ports & bindings | 2/3 | **3/3** | repositorios y puertos alineados; buses simétricos en lectura y escritura |
| 5 | Use case granularity | 3/3 | 3/3 | un handler = un `execute()`, sin excepción |
| 6 | Adapter thinness | 3/3 | 3/3 | controllers y pump sólo adaptan; el pump además maneja error y reentrada |
| 7 | Mapping isolation | 1/3 | **3/3** | fila ≠ vista ≠ DTO, unidas por mappers; el DTO `implements` la vista |
| 8 | Error handling | 3/3 | 3/3 | jerarquía tipada, catálogo de códigos congelado por test de contrato |
| 9 | Naming consistency | 2/3 | **3/3** | `reference` alineado con los otros cuatro; la convención de imports queda en el Art. 13 |
| 10 | Shared kernel hygiene | 2/3 | **3/3** | cada excepción con su agregado; la transversal, una sola vez en `shared/` |
| 11 | Cross-module coupling | 1/3 | **3/3** | la colaboración entre módulos pasa por comandos y read models de `application/` |
| 12 | Testability | 3/3 | 3/3 | handlers construibles con dobles, contract tests, wiring test, isolation test |

---

## Hallazgos

### [HIGH] H-1 · `application/` importa `infrastructure/` en 12 archivos de producción

- **Dónde:**
  - `apps/ledger/src/accounts/application/account-name.registry.ts:4`
  - `apps/ledger/src/accounts/application/account-validation.service.ts:9`
  - `apps/ledger/src/accounts/application/get-account-tree/get-account-tree.handler.ts:7`
  - `apps/ledger/src/accounts/application/get-account-by-id/get-account-by-id.handler.ts:7`
  - `apps/ledger/src/accounts/application/get-account-balances/get-account-balances.handler.ts:7-8`
  - `apps/ledger/src/accounts/application/record-opening-balance/record-opening-balance.handler.ts:11-14`
  - `apps/ledger/src/transactions/application/list-transactions/list-transactions.handler.ts:10`
  - `apps/ledger/src/transactions/application/list-pending-review/list-pending-review.handler.ts:7`
  - `apps/ledger/src/transactions/application/get-transaction-by-id/get-transaction-by-id.handler.ts:7`
  - `apps/ledger/src/ledger/application/get-ledger-settings/get-ledger-settings.handler.ts:10`
  - `apps/ledger/src/ledger/application/get-ledger-settings/get-ledger-settings.query.ts:3`
  - `apps/ledger/src/reference/application/list-currencies.query.ts:5`
- **Regla rota:** *Dependencies point inward only* — `application` MUST NOT import
  `infrastructure/*`. También `docs/rules.md` Artículo 1 en espíritu: "todo acceso a
  infraestructura entra por puertos".
- **Por qué duele:** las constantes `PROJ_ACCOUNTS`, `PROJ_TRANSACTIONS`,
  `PROJ_LEDGER_SETTINGS`… y los tipos `AccountTreeRow`, `LedgerSettingsRow`,
  `TransactionListRow` son el **nombre físico de una tabla y su forma
  `snake_case`**. Hoy el read side de la aplicación no puede compilarse ni testearse
  sin el paquete de projectors, y renombrar una proyección o mover un projector
  rompe la capa de aplicación de tres módulos. Es exactamente el acoplamiento que el
  Artículo 1 declara no negociable, sólo que hacia adentro del propio código en vez
  de hacia un driver.
- **Fix:** mover los identificadores de proyección y sus tipos de fila a la capa que
  los consume — p. ej. `<module>/application/read-models/<name>.read-model.ts`
  exportando `PROJ_X` y `XRow` — y que el projector de infraestructura **importe de
  ahí** en vez de exportarlos. Es una inversión de import: ~12 archivos tocados, cero
  cambio de comportamiento, y el projector sigue siendo el único escritor (Art. 10
  intacto).
- **✅ Resuelto.** Seis módulos de read-model nuevos en `application/read-models/`:
  `accounts/…/account-tree`, `transactions/…/{transaction-list, account-balances,
  pending-review}`, `ledger/…/ledger-settings` (con `LedgerSettingsRow`, el único
  tipo que cruzaba) y `reference/…/currencies`. Los seis projectors ya no declaran
  su nombre de tabla: lo importan. 34 archivos con imports reescritos, ningún cambio
  de comportamiento.

### [HIGH] H-2 · El composition root del núcleo vive dentro de `ledger/application/`

- **Dónde:** `apps/ledger/src/ledger/application/ledger-application.factory.ts:11,23,29,37,53-55`
  (y `query-bus.factory.ts:3-18` con el mismo patrón, sin el problema de infraestructura).
- **Regla rota:** *Bindings live only in the composition root* + *dependency
  direction*. `ledger` es un módulo de negocio (settings del libro), no la raíz de
  composición de la app.
- **Por qué duele:** el archivo instancia `SynchronousProjectionDispatcher`
  (`@cqrs/infrastructure`) y los seis projectors de `accounts`, `transactions`,
  `ledger` y `reference` desde dentro de una capa de aplicación. Efecto práctico:
  `ledger/application/` no se puede compilar sin la infraestructura de los otros
  cuatro módulos, y cualquier módulo nuevo obliga a editar la capa de aplicación de
  `ledger`. `LedgerCoreModule` ya es el composition root real (`ledger-core.module.ts`)
  y sólo delega en este factory.
- **Fix:** mover ambos factories fuera del módulo `ledger`, a una raíz neutral
  (`apps/ledger/src/bootstrap/` o junto a `LedgerCoreModule`). Es un movimiento de
  archivo más el ajuste de imports; H-1 resuelto reduce además lo que el factory
  necesita conocer.
- **✅ Resuelto.** `ledger-application.factory.ts` y `query-bus.factory.ts` (con sus
  specs) movidos con `git mv` a `apps/ledger/src/bootstrap/`. `ledger/application/`
  queda con lo que le pertenece: sus casos de uso, su repositorio y el registro de
  eventos. `createLedgerEventRegistry` se dejó en `ledger/application/` a propósito:
  no importa infraestructura, y moverlo no arreglaba nada (Simplicity Gate).

### [HIGH] H-3 · `accounts` orquesta el `application/` y el `domain/` de `transactions` sin ACL

- **Dónde:** `apps/ledger/src/accounts/application/record-opening-balance/record-opening-balance.handler.ts:10-25`
  — importa `LedgerTransactionRepository` y `toPostingLines` de
  `transactions/application`, `BalanceRule`, `LedgerTransaction` y
  `TransactionStatus` de `transactions/domain`, `LedgerNotInitializedException` de
  `ledger/domain` y `PROJ_LEDGER_SETTINGS` de `ledger/infrastructure`.
  Secundario: `accounts/application/get-account-balances/get-account-balances.handler.ts:8`
  lee `PROJ_BALANCES` de `transactions/infrastructure`.
- **Regla rota:** *Cross-module access goes through the other module's exported use
  cases or through events — never its domain entities, repositories or adapters.*
- **Por qué duele:** el contexto `accounts` construye agregados de `transactions` a
  mano y los persiste con el repositorio ajeno. Los dos módulos ya no se pueden
  separar, y cualquier cambio de invariante en `LedgerTransaction.record` tiene un
  segundo llamador fuera de su módulo que nadie recuerda al modificarlo.
- **Fix:** el handler ya tiene el `CommandBus` disponible en la composición —
  `MergePendingTransfersHandler` y `ResolveDiscrepancyHandler` **ya resuelven esto
  bien**, despachando `RecordTransactionCommand` por el bus. Alinear
  `RecordOpeningBalance` con ese patrón: despachar el comando con
  `PostingOrigin.SYSTEM` en vez de instanciar el agregado. Elimina de un golpe seis
  imports cross-module y unifica el camino de escritura.
- **✅ Resuelto.** `RecordOpeningBalanceHandler` pasó de siete dependencias
  (repositorio, validación, balance, `IdGenerator`, dispatcher…) a tres
  (`CommandBus`, `ReadModelStore`, `CurrencyCatalog`), y despacha
  `RecordTransactionCommand` con `PostingOrigin.SYSTEM`. Balanceo, precisión y las
  validaciones INV-3/INV-4 quedan en un solo sitio. Efecto colateral bueno: ahora
  propaga el `CommandResult` real del comando interno en vez de forzar
  `idempotentReplay: false`. El spec se reescribió contra el comando despachado
  (usando el `RecordingCommandBus` que ya existía) y suma un caso que antes no
  estaba: que el origen sea `SYSTEM` (INV-13).

### [MEDIUM] M-1 · El test de aislamiento no cubre la dirección entre capas

- **Dónde:** `apps/ledger/src/hexagonal-isolation.spec.ts:8`
- **Regla rota:** ninguna por sí mismo — es la razón por la que H-1 lleva 12
  archivos sin que nadie lo note.
- **Por qué duele:** `FORBIDDEN_IMPORTS` lista sólo `@nestjs/`, `typeorm`, `pg`,
  `express`. Un import a `infrastructure/` pasa verde. El test da una sensación de
  frontera vigilada que hoy no corresponde a lo que verifica.
- **Fix:** agregar un segundo caso al mismo `describe` que recorra los archivos de
  `application/` y falle ante cualquier import que contenga `/infrastructure/`; y
  otro para `domain/` que además prohíba `/application/`. Son ~15 líneas reusando
  `sourceFiles()` e `IMPORT_SOURCE` que ya están escritos. **Hacer esto primero, en
  rojo, antes de H-1** (Artículo 4: TDD estricto).
- **✅ Resuelto.** Segundo caso en el mismo `describe`: `domain/` no puede alcanzar
  `application/` ni `infrastructure/`, y `application/` no puede alcanzar
  `infrastructure/`. La comparación es **por segmento de ruta**, no por substring,
  para que `@cqrs/application/...` cuente y un archivo llamado `application.ts` no.
  Se escribió primero y falló con 22 violaciones — los tres HIGH exactos más el
  repositorio de M-6. Hoy está en verde.

### [MEDIUM] M-2 · Los controllers devuelven filas del read model, no los DTOs que documentan

- **Dónde:** `apps/ledger/src/accounts/infrastructure/adapters/http/accounts.controller.ts:71-106`
  (`FIXME` presente), `apps/ledger/src/transactions/infrastructure/adapters/http/transactions.controller.ts:89-140`
  (dos `FIXME`).
- **Regla rota:** *Outputs are output DTOs from an application mapper — never
  internal shapes to HTTP.*
- **Por qué duele:** `@ApiOkResponse({ type: AccountTreeDto })` promete un envelope
  camelCase y sale `account_id`/`opened_on`. El contrato OpenAPI publicado miente:
  todo cliente generado desde `api.yaml` falla en runtime, y `total` de
  `TransactionListDto` no tiene fuente. Además es la vía por la que los tipos `*Row`
  de infraestructura llegan a la firma pública.
- **Fix:** un mapper de aplicación por lectura (`toDTO(row): XDto`) y que el handler
  de query devuelva el DTO. Se resuelve naturalmente junto con H-1, porque el tipo
  de fila ya habrá bajado a `application/`. Los `FIXME` documentan que `total` exige
  una count query — esa parte es trabajo aparte y conviene dejarla explícita en la
  HU correspondiente.
- **✅ Resuelto.** Tres formas distintas donde antes había una: `XRow` (storage,
  `snake_case`), `XView` (lo que va por el cable, camelCase) y `XDto` (el contrato
  Swagger). El handler de query devuelve la vista; el DTO **`implements` la vista**,
  así que un campo agregado a la vista sin su `@ApiProperty` deja de compilar — el
  contrato ya no puede desincronizarse en silencio. El DTO no puede vivir en
  `application/` (lleva decoradores de Swagger, que son infraestructura), y esta es
  la razón por la que la vista existe como tipo intermedio.

  Siete lecturas migradas: las tres de `accounts`, las tres de `transactions` y la de
  `ledger`. `reference` ya lo hacía bien con `CurrencyView` — fue el modelo a seguir.
  17 tests nuevos sobre los mappers, incluidos los casos que rompen en producción y
  no en desarrollo: `posting_count` que el driver de Postgres devuelve como string, y
  columnas ausentes en filas viejas que llegaban como `undefined`.

  **Tres decisiones de contrato**, todas por el mismo criterio — el contrato declara
  lo que existe:
  - `GET /transactions` devuelve la lista, sin el envelope `{ items, total }`.
    `total` necesita un `count` que `ReadModelStore` no expone; inventarlo por
    request escanearía la proyección entera. La paginación por `limit`/`offset`
    sigue igual. **Sigue pendiente** y merece su propia HU.
  - `GET /accounts` devuelve la lista plana con `parentId`; se fueron el envelope
    `AccountTreeDto` y el parámetro `?view=tree|flat`, que el controller ignoraba
    (tenía un `TODO(read-shape)`). Un parámetro que no hace nada es la misma clase
    de mentira que un DTO que no corresponde.
  - `?currency` en `/accounts/:id/balance` también se ignoraba, pero costaba tres
    líneas: ahora filtra de verdad.

  Dos ganancias que no estaban en el hallazgo: `GET /transactions/:id` ahora sí
  devuelve sus `postings` (los legs viven en `proj_postings` y nadie los leía, aunque
  el DTO los prometía), y ni `user_id` ni los ids de las cuentas de sistema salen ya
  por el cable — están cubiertos por tests (INV-9, INV-13).

### [MEDIUM] M-3 · `BalanceAssertionController` inyecta los query handlers en vez del `QueryBus`

- **Dónde:** `apps/ledger/src/reconciliation/infrastructure/adapters/http/balance-assertion.controller.ts:44-45,90-98`
- **Regla rota:** consistencia del composition root — los otros tres controllers
  (`accounts`, `transactions`, `currencies`) resuelven lecturas por `QueryBus`.
- **Por qué duele:** `GetAssertionStatusQuery` y `ListAssertionsQuery` reciben
  `context.userId` como **argumento de la query**, mientras el resto lo pasa por
  `QueryContext`. Son dos contratos de lectura distintos en la misma API: el
  aislamiento por usuario (Artículo 5) se garantiza de dos formas diferentes, y una
  de ellas depende de que el controller no se olvide de pasarlo. Estos dos métodos
  tampoco declaran tipo de retorno ni decoradores Swagger, a diferencia de todos los
  demás.
- **Fix:** registrar ambos handlers en `createQueryBus` y hacer que el controller
  despache por el bus con `QueryContext`, moviendo `userId` fuera de la query.
- **✅ Resuelto, pero no como decía el fix.** Registrarlos en `createQueryBus` no se
  podía: ese factory sólo recibe el `ReadModelStore`, y estos handlers dependen de
  `AssertionStatusStore`, que se bindea en `ReconciliationModule`. Inyectarlo en la
  raíz de composición habría hecho que el núcleo conociera un módulo de negocio —
  cambiar un acoplamiento por otro peor.

  La salida ya estaba escrita en el lado de escritura: el módulo registra sus
  propios handlers en `onModuleInit` sobre el bus compartido. Para eso `QueryBus`
  (abstracto, sólo `ask`) no alcanzaba, así que el core provee ahora el
  `RegistryQueryBus` concreto y aliasea `QueryBus` sobre él — exactamente la forma
  que `PolicyCommandBus`/`CommandBus` ya tenían. Las dos lecturas entran por el
  mismo bus que el resto sin que la raíz sepa que `reconciliation` existe.

  Con eso, `userId` sale de las queries y viaja en el `QueryContext`: el aislamiento
  por usuario (Art. 5) es ahora el contrato del bus para **todas** las lecturas, y no
  algo que cada query recuerde declarar. Las queries pasan a extender `Query<T>` y
  los handlers `QueryHandler<T>`, así que el tipo de retorno lo fija la query.

  De paso se aplicó M-2 aquí: `AssertionStatusView` + `AssertionStatusDto`. El tipo
  del puerto exponía `userId` y devolvía `Date` en `checkedAt`/`createdAt`, donde el
  resto de la API usa strings ISO.

  **`app.wiring.spec.ts` gana el caso espejo del de comandos**: un handler que no se
  registra no falla al arrancar, sólo cuando llega el request. Ahora las diez queries
  del catálogo están fijadas.

### [MEDIUM] M-4 · `LedgerNotInitializedException` existe dos veces con el mismo `code`

- **Dónde:** `apps/ledger/src/ledger/domain/settings/exceptions/ledger.exception.ts:17`
  y `apps/ledger/src/reconciliation/domain/balance-assertion/exceptions/balance-assertion.exception.ts:46`
  — ambas `DomainUnprocessableException` con `code = 'LEDGER_NOT_INITIALIZED'`.
- **Regla rota:** DRY sobre la jerarquía de excepciones; el código de error es un
  contrato público único (`shared/domain/errors/ledger-error-code.ts`).
- **Por qué duele:** `ledger-error-code-mapping.spec.ts:14` importa la de
  `reconciliation` para congelar el status HTTP; la de `ledger` no está cubierta por
  ese contrato. Si alguna vez divergen en clase base, el mismo `code` devolverá dos
  status distintos según qué módulo lo lance, y el test seguirá verde.
- **Fix:** dejar una sola, en `shared/domain/errors/`, y que ambos módulos la
  importen. Es la excepción de una condición transversal ("el ledger del usuario no
  existe"), no de un agregado.
- **✅ Resuelto.** Declarada una sola vez en `shared/domain/errors/ledger.exception.ts`,
  tomando su `code` de `LEDGER_ERROR_CODE` en vez de repetir el literal. Los tres
  módulos que reportan la condición la importan de ahí. El `ledger.exception.ts` del
  módulo `ledger` queda sólo con `LedgerAlreadyInitializedException`, y el de
  `reconciliation` lleva un comentario que explica por qué la suya ya no está.

### [MEDIUM] M-5 · INV-3 e INV-4 están implementados dos veces

- **Dónde:** `apps/ledger/src/accounts/domain/account/account.aggregate.ts:137-160`
  (`ensureOpenOn`, `ensureAcceptsCurrency`) y
  `apps/ledger/src/accounts/application/account-validation.service.ts:93-113`
  (`ensureOpenOn`, `ensureAcceptsCurrency`) — misma lógica, mismas excepciones,
  distinta fuente de datos (agregado vs. proyección).
- **Regla rota:** *Entity owns its behavior* — la regla vive en dos capas.
- **Por qué duele:** el comentario del agregado (líneas 32-38) explica bien por qué
  la validación cross-aggregate no puede cargar N agregados, y esa decisión es
  correcta. Lo que no es correcto es reescribir el predicado: si mañana INV-4 admite
  multi-moneda con lista, hay que acordarse de tocar los dos, y sólo uno tiene
  cobertura del agregado. Nótese que `Account.ensureOpenOn`/`ensureAcceptsCurrency`
  hoy **no tienen ningún llamador** — el camino real es siempre el service.
- **Fix (el más chico):** extraer los dos predicados a funciones puras en
  `accounts/domain/` que reciban los datos ya leídos (`{ openedOn, closedOn }`,
  `{ currencies }`) y que tanto el agregado como el service las invoquen. Si se
  confirma que los métodos del agregado son código muerto, borrarlos también es una
  opción válida — pero decidirlo, no dejarlo.
  *(Análisis de duplicación: ver skill `design-principles`.)*
- **✅ Resuelto extrayendo, no borrando.** Los métodos del agregado no tenían ningún
  llamador de producción — sólo su propio spec —, así que borrarlos era tentador. Pero
  el service **sí** necesita la regla, y borrarlos habría dejado la única
  implementación en la capa de aplicación: peor que la duplicación.

  Las dos reglas viven ahora en `accounts/domain/account/account-availability.ts` como
  funciones puras, y las llaman tanto el agregado (con sus VOs) como el service (con
  una fila de proyección). Dos fuentes de estado, una implementación. Al unificarlas
  quedó a la vista que los mensajes diferían: el agregado nombraba la cuenta y el
  service no.

### [MEDIUM] M-6 · El placement de puertos y repositorios difiere entre módulos

- **Dónde:**
  - Repositorios: `reconciliation/domain/balance-assertion/balance-assertion.repository.ts`
    vs. `accounts/application/account.repository.ts`,
    `transactions/application/ledger-transaction.repository.ts`,
    `ledger/application/ledger-settings.repository.ts`.
  - Puertos: `reconciliation/domain/ports/` contiene siete puertos, pero sólo
    `assertion-posting-reader.port.ts` y `day-boundary.resolver.ts` son invocados por
    un domain service (`AssertionEvaluator`). `adjustment-audit-store.port.ts`,
    `assertion-status-store.port.ts`, `assertion-lookup.port.ts`,
    `ledger-settings-reader.port.ts` y `system-account-lookup.port.ts` sólo los
    consumen handlers y el reactor de `application/`. Mismo caso en
    `transactions/domain/ports/account-lookup.port.ts`, consumido únicamente por
    `MergePendingTransfersHandler`.
- **Regla rota:** *Where does a port live* — 1) lo llama un domain service →
  `domain/`; 2) sólo casos de uso → `application/ports/`. Y *within one module,
  apply the same rule to every aggregate*.
- **Por qué duele:** no rompe nada hoy, pero borra la señal. Un lector ya no puede
  deducir de la ubicación si un puerto pertenece a una invariante del dominio o es
  una necesidad de orquestación, que es justamente para lo que sirve la separación.
- **Fix:** mover a `application/ports/` los seis puertos sin consumidor de dominio, y
  elegir un solo lado para los repositorios (los cuatro son `EventSourcedRepository`;
  `application/` es donde están tres de cuatro, así que mover el de `reconciliation`
  es el diff menor).
- **✅ Resuelto a medias — repositorios sí, puertos no.**
  `balance-assertion.repository.ts` movido a `reconciliation/application/` y quitado
  del barrel de `domain/balance-assertion/`. No fue opcional: extendía
  `EventSourcedRepository` de `@cqrs/application`, así que era también una violación
  `domain → application` que el guard de M-1 marcaba en rojo. Los cuatro
  repositorios viven ahora en `application/`. **Los seis puertos siguen pendientes**
  — es un movimiento de archivos sin riesgo, pero no lo exigía ningún test en rojo.

### [LOW] L-1 · `AccountNotFoundException` vive en el módulo `ledger`

- **Dónde:** `apps/ledger/src/ledger/domain/settings/exceptions/ledger.exception.ts:22`,
  usada desde `accounts/application/account-validation.service.ts:10`,
  `rename-account.handler.ts`, `close-account.handler.ts`.
- **Regla rota:** cohesión de módulo — la excepción de un agregado vive con el agregado.
- **Por qué duele:** obliga a `accounts` a importar `ledger/domain` para lanzar su
  propia excepción, e infla artificialmente el acoplamiento medido en H-3.
- **Fix:** moverla a `accounts/domain/account/exceptions/account.exception.ts`, junto
  a las otras siete de cuenta.
- **✅ Resuelto.** Movida junto a las otras siete excepciones de cuenta. `accounts` ya
  no importa `ledger/domain` para lanzar su propia excepción.

### [LOW] L-2 · El módulo `reference` no sigue el layout de los otros cuatro

- **Dónde:** `apps/ledger/src/reference/application/` — sin subcarpeta por caso de
  uso; `list-currencies.query.ts` contiene la query, el tipo de fila **y** el handler
  en un archivo; `reference/infrastructure/adapters/http/currencies.controller.ts:23-40`
  define `RegisterCurrencyRequestDto` dentro del archivo del controller, mientras los
  otros módulos tienen `dto/` con barrel.
- **Regla rota:** *Naming consistency* y layout canónico.
- **Fix:** `application/register-currency/` y `application/list-currencies/` con
  `.command.ts`/`.query.ts`/`.handler.ts` separados, y `infrastructure/adapters/http/dto/`.
- **✅ Resuelto.** Una carpeta por caso de uso, la query separada de su handler, y
  `dto/` con barrel: `RegisterCurrencyRequestDto` sale del archivo del controller y
  aparece `CurrencyDto`, que documenta el `CurrencyView` que ya existía sin contrato
  declarado. `reference` deja de ser el módulo distinto.

### [LOW] L-3 · `accounts` no tiene módulo raíz

- **Dónde:** existe `accounts/infrastructure/adapters/http/accounts-http.module.ts`
  pero no `accounts/accounts.module.ts`. El cableado del módulo está repartido entre
  `ledger-application.factory.ts` (escritura), `query-bus.factory.ts` (lectura) y ese
  http module.
- **Regla rota:** *`<module>.module.ts` at the module ROOT*.
- **Por qué duele:** para saber qué compone `accounts` hay que leer tres archivos, dos
  de ellos en otro módulo. Se resuelve en gran parte con H-2.
- **Fix:** una vez movidos los factories (H-2), dar a `accounts` su módulo raíz que
  importe el http module y registre sus handlers, como ya hacen `transactions` y
  `reconciliation` con `onModuleInit`.
- **✅ Resuelto.** `accounts/accounts.module.ts` importa su módulo HTTP y es el punto
  de entrada del contexto. No declara providers: los handlers de cuentas se componen
  en `bootstrap/` y se alcanzan por los buses. El JSDoc lo dice, para que un módulo
  vacío no se lea como un olvido.

### [LOW] L-4 · Barrels prácticamente ausentes; los imports son deep paths

- **Dónde:** 24 `index.ts` en todo `apps/ledger/src`, contra ~70 carpetas con
  contenido. Todos los imports usan la ruta completa
  (`@ledger/accounts/application/open-account/open-account.command`).
- **Regla rota:** *Every folder with content ships an `index.ts`; import through the
  barrel.*
- **Nota:** es una desviación **consistente** en todo el proyecto y no compromete la
  dirección de dependencias — se reporta como convención a documentar, no como
  defecto. La ruta profunda además es legible con el alias `@ledger/*`.
- **Fix:** decidir explícitamente y anotarlo en `docs/rules.md` o en el README del
  app. Si se adopta barrels, hacerlo por módulo y de una sola vez; si no, dejar
  constancia para que el criterio no se reabra en cada review.
- **✅ Resuelto documentando, que era el fix.** `docs/rules.md` gana el **Artículo 13**
  (constitución a 1.1.0): imports por ruta completa, con las cuatro excepciones donde
  el barrel sí aplica. La razón registrada es concreta y no estética: la ruta dice en
  qué capa y en qué caso de uso vive lo importado — que es lo que una revisión de
  fronteras necesita ver — y el guard de `hexagonal-isolation.spec.ts` compara
  segmentos de ruta, así que un barrel intermedio le quitaría precisión.

### [LOW] L-5 · Un spec de contrato HTTP vive en `shared/domain/errors/`

- **Dónde:** `apps/ledger/src/shared/domain/errors/ledger-error-code-mapping.spec.ts:1`
  — importa `@nestjs/common` y ejercita el `ExceptionFilter`.
- **Regla rota:** placement. El test es valioso y correcto; su ubicación no.
  `isCoreFile()` de `hexagonal-isolation.spec.ts` lo excluye por ser `.spec.ts`, así
  que no rompe el guard, pero es la única aparición de `@nestjs` bajo `domain/`.
- **Fix:** moverlo junto al filtro que prueba, en
  `shared/infrastructure/adapters/http/`. El catálogo puro
  (`ledger-error-code-catalogue.spec.ts`) sí pertenece a `domain/`.
- **✅ Resuelto.** Movido a `shared/infrastructure/adapters/http/`. `domain/errors/`
  queda sin una sola referencia a `@nestjs`.

---

## Plan priorizado

Ejecutado completo, en este orden. Cada paso dejó el siguiente más barato, y el
primero fue el test que define a los demás (Artículo 4).

1. ~~**M-1** — el guard de dirección entre capas.~~ ✅ *(rojo con 22 violaciones)*
2. ~~**H-1** — invertir el import de los read models.~~ ✅
3. ~~**H-3** — `RecordOpeningBalance` despacha por el `CommandBus`.~~ ✅
4. ~~**H-2** — los factories a una raíz de composición neutral.~~ ✅
5. ~~**M-2** — mappers de salida por lectura.~~ ✅
6. ~~**M-3** — las lecturas de `reconciliation` por el `QueryBus`.~~ ✅
7. ~~**M-6** — puertos y repositorios donde manda su consumidor.~~ ✅
8. ~~**M-4, M-5, L-1 … L-5**~~ ✅
9. ~~**`total` en `GET /transactions`**~~ ✅ — no era un fix de arquitectura y se
   había dejado como HU aparte; entró al cerrar porque el resto ya estaba.

### `total`: lo que costó de verdad

`ReadModelStore` gana `count(table, criteria)`, implementado en los dos adaptadores
y **fijado por el contract test**, que es donde estaba el riesgo: el caso que
importa es que `count` ignore la paginación, porque un total sacado de la criteria
paginada sería el tamaño de página y el cliente nunca sabría que hay una segunda.
Hay test para eso en el contrato y otro en el handler.

Postgres devuelve `COUNT` como bigint y el driver lo entrega como string; el
adaptador lo convierte y el contrato lo exige (`typeof === 'number'`). Es el mismo
error que ya había aparecido con `posting_count` en M-2 — dos veces la misma clase
de bug es señal de que el contrato tenía que cubrirlo.

`GET /transactions` vuelve a tener su envelope `{ items, total, limit, offset }`,
ahora con fuente real.

## Verificación

```
npx tsc -p apps/ledger/tsconfig.app.json  --noEmit    # limpio
npx tsc -p apps/ledger/tsconfig.spec.json --noEmit    # limpio
npx jest --config apps/ledger/jest.config.ts --rootDir apps/ledger
#   Test Suites: 2 skipped, 80 passed, 82 total
#   Tests:       2 skipped, 482 passed, 484 total
npx jest --config libs/cqrs/jest.config.ts --rootDir libs/cqrs
#   Test Suites: 2 skipped, 21 passed, 23 total
#   Tests:       2 skipped, 110 passed, 112 total
```

Las 4 suites skipped exigen una Postgres viva y ya lo estaban antes. `eslint` deja
sólo lo preexistente: los `no-console` de `tooling/rebuild.command.ts` (es un CLI) y
tres `no-empty-function` en specs de `libs/cqrs`. Ninguno introducido aquí.

## Sigue abierto

Nada de la auditoría. Dos cosas quedaron anotadas al pasar, ninguna es un defecto
de arquitectura:

- **`AccountTreeView` (`?view=tree|flat`)** — se retiró del contrato porque el
  controller lo ignoraba. Si el árbol anidado se quiere de verdad, es una HU con su
  propio diseño (forma recursiva en OpenAPI incluida), no un fix.
- **`strict: false` en `tsconfig.base.json`** — ya documentado en el propio archivo
  como cambio pendiente y deliberado.

## Fuera de alcance de esta skill

- Sintaxis y tipos (`string | null` vs `Nullable<T>` en cuatro projectors) → skill
  `typescript`.
