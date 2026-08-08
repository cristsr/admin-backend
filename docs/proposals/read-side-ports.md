# Propuesta — Puertos de lectura tipados para el read side del ledger

> **Estado:** revisado — las cuatro decisiones abiertas quedaron cerradas (ver §10).
> **Alcance:** `apps/ledger` (los 5 módulos) + `libs/cqrs` (sin cambios de contrato).
> **Origen:** evaluación de la pregunta "¿modelar los read models como entidades
> de dominio con repositorio implementado por TypeORM?".

---

## 1. Problema

El read side del ledger tiene hoy **tres patrones conviviendo**:

| Patrón | Dónde | Módulos |
|---|---|---|
| A — Handler → `ReadModelStore` genérico | `application/usecases/*.handler.ts` | `accounts`, `transactions`, `ledger`, `reference` |
| B — Handler → puerto tipado → adapter | `application/ports/` + `infrastructure/adapters/persistence/` | `reconciliation`, y parcialmente `transactions` (`AccountLookup`) y `reference` (`CurrencyCatalogCache`) |
| C — Servicio de aplicación → `ReadModelStore` genérico | `application/services/` | `accounts` |

El patrón B es el correcto y ya funciona. La propuesta es **generalizarlo**, no
inventar nada nuevo.

### 1.1 Fuga 1 — el esquema físico llegó a `application`

`accounts/application/read-models/account-tree.read-model.ts:5-12` lo declara
explícitamente: el nombre de tabla se define en `application` *para no importar
`infrastructure`*. El resultado es que la capa de casos de uso conoce:

- el nombre físico de la tabla (`proj_accounts`, `proj_postings`, …);
- el `snake_case` de cada columna (usado como string en cada `Criteria`);
- la nulabilidad de columna (`AccountRow.currency_code: Nullable<string>`);
- el tipo de storage (`posting_count: number` que hay que pasar por `Number()`
  porque Postgres devuelve `bigint` como string).

`hexagonal-isolation.spec.ts` está verde porque sólo vigila **direcciones de
import**, no el contenido. El acoplamiento entró por la otra puerta.

### 1.2 Fuga 2 — el store genérico no expresa las queries reales

`Criteria` no tiene joins ni subqueries, así que las queries que los necesitan
se resuelven en memoria:

- **`get-account-balances.handler.ts:30`** — `query(PROJ_BALANCES, Criteria.none())`
  trae **toda la tabla de balances de todos los usuarios** y filtra por
  pertenencia en el heap de Node. `proj_balances` no tiene `user_id`.
- **`list-transactions.handler.ts:63`** — para filtrar por cuenta trae **todos**
  los postings de esa cuenta y arma un `Set` de ids en memoria, que después se
  inyecta como `IN (...)` sin cota.
- **`account-validation.service.ts:45`** — trae **todas** las cuentas del usuario
  para validar 2 postings.
- **`account-name.registry.ts:54`** — trae **todas** las cuentas del usuario para
  verificar una colisión de nombre.
- **`read-model-assertion-posting-reader.ts:60`** — trae todos los postings de la
  cuenta y filtra `status` y `date` en memoria, teniendo ambas columnas indexadas.

El primero además es un problema de **Artículo 5** (aislamiento por usuario): el
scope no está en el `WHERE`, está en un `.filter()`.

### 1.3 Fuga 3 — tipos de fila duplicados

`PostingRow` está declarado dos veces con formas distintas:
`transactions/application/read-models/transaction-list.read-model.ts:32` (6
campos) y `reconciliation/infrastructure/adapters/persistence/read-model-assertion-posting-reader.ts:16`
(7 campos, incluye `user_id`, `status`, `date`, `occurred_at`). La tabla real
tiene 10 columnas. Ningún tipo describe la tabla; cada uno describe lo que su
consumidor recuerda que hay.

Lo mismo con `AccountRow`: declarado en `account-tree.read-model.ts:15` y otra
vez, recortado, en `read-model-account-lookup.ts:6` y en `consistency-verifier.ts`.

---

## 2. Decisión

### 2.1 Lo que **no** se hace: entidades de dominio para los read models

Descartado. Razones:

1. **El dominio ya existe.** En event sourcing los agregados (`Account`,
   `LedgerTransaction`, `BalanceAssertion`, `LedgerSettings`, `CurrencyCatalog`)
   son el modelo de dominio y se rehidratan del event store. Una entidad
   `Account` de lectura sería una segunda representación del mismo concepto.
2. **Un read model no tiene invariantes.** Es derivado y desechable: se trunca y
   se reconstruye (`tooling/rebuild.command.ts`). Una entidad de dominio que se
   puede `TRUNCATE` sin consecuencias no es una entidad de dominio.
3. **Rompería el Artículo 10.** Un repositorio con `save()` sobre una entidad de
   proyección es una invitación abierta a que algo que no es un projector escriba
   el read model.
4. **Ciclo de vida opuesto.** Un read model *debe* cambiar de forma cuando cambia
   una query. Una entidad de dominio no. Modelarlos igual pelea contra eso.
5. **Riesgo concreto ya presente.** `account-validation.service.ts:69` aplica
   reglas de dominio (`ensureOpenOn`, `ensureAcceptsCurrency`) sobre una fila de
   proyección. Hoy está bien resuelto — *una* implementación de la regla, dos
   fuentes de estado. Con entidades de lectura, la tentación de darle a la
   entidad de lectura su propia copia de la regla es enorme, y eso sí violaría el
   Artículo 12.

### 2.2 Lo que **sí** se hace: un puerto de lectura tipado por consumidor

Cada caso de uso o servicio de aplicación depende de un `abstract class` que
habla en el lenguaje del caso de uso y devuelve `View`s. El adapter en
`infrastructure` es el único que conoce tabla, columnas y `snake_case`.

```
application/                          infrastructure/
  views/account.view.ts        ←──┐     projections/account-tree.projector.ts
  ports/account-tree-finder.port.ts │   projections/account-tree.schema.ts   ← PROJ_ACCOUNTS + AccountRow
  usecases/get-account-tree/…        └── adapters/persistence/read-model-account-tree-finder.ts
```

### 2.3 Sobre TypeORM

Decisión: **`DataSource` / `QueryBuilder` en los adapters que lo necesiten;
entidades TypeORM, no.**

- Las entidades no compran nada acá: las migraciones están escritas a mano,
  `synchronize` nunca va a estar en `true`, y los projectors escriben por
  `upsert` genérico. 10 tablas × una clase decorada para ganar un tipado que un
  `type XRow` ya da. El **Anti-Abstraction Gate** y el **Simplicity Gate** lo
  rechazarían.
- Si en algún momento se agregan, no deben cruzar hacia `application`: el puerto
  devuelve `View`s, siempre.

---

## 3. Reglas de diseño

Las que rigen la implementación y contra las que se revisa cada PR de esta
migración.

**R1 — El puerto vive con su consumidor, no con la proyección.**
Es dependency inversion: lo define quien lo necesita. Ya es lo que hacen
`AccountLookup` (en `transactions`, lee `proj_accounts`) y el
`LedgerSettingsReader` actual (en `reconciliation`, lee `proj_ledger_settings`).
Excepción única: un puerto con ≥2 consumidores en módulos distintos vive en el
módulo dueño de la proyección (ver los tres puertos de §4.4).

**R2 — El esquema de una proyección se declara una sola vez, junto a su projector.**
Archivo nuevo `infrastructure/projections/<x>.schema.ts` con la constante `PROJ_*`
y **el `XRow` completo de la tabla** (todas las columnas, no un recorte). Todos
los adapters — propios y de otros módulos — importan de ahí. Esto elimina la
fuga 3. Import `infrastructure → infrastructure` entre módulos: permitido, el
guard sólo policía `domain` y `application`.

**R3 — El `View` es el contrato del puerto y vive en `application/views/`.**
Es la forma que cruza hacia el handler y hacia el DTO HTTP. No tiene `user_id`
(el scope es contexto, no contenido), ni `snake_case`, ni tipos de columna.

**R4 — El mapeo `Row → View` es responsabilidad del adapter.**
Las funciones `toXView` se mudan a `infrastructure` junto al esquema. Un handler
nunca ve un `Row`.

**R5 — El puerto se nombra por la pregunta, no por la tabla.**
`AccountNameReader.isTaken(userId, name)`, no `AccountTreeStore.query(...)`.
Si un método necesita que el llamador filtre lo que le devuelven, el puerto está
mal cortado.

**R6 — `Repository` está reservado para agregados; el sufijo dice a quién sirve.**
En este código `Repository` significa "carga y persiste un agregado desde el
event store" (`AccountRepository`, `LedgerTransactionRepository`,
`EventSourcedRepository`). Reusar la palabra reintroduce exactamente la confusión
que esta propuesta busca eliminar. Los puertos de lectura se nombran según su
consumidor, y la distinción es normativa:

| Sufijo | Sirve a | Devuelve | Ejemplos |
|---|---|---|---|
| `Finder` | la API (query handlers) | un `View` | `AccountTreeFinder`, `TransactionFinder` |
| `Reader` | el write side (command handlers, servicios de aplicación) | un tipo propio del puerto | `AccountConstraintsReader`, `LedgerTimezoneReader` |
| `Lookup` | el write side, resolviendo **una** referencia | un id o un hecho puntual | `SystemAccountLookup`, `AccountLookup` |

El sufijo es una afirmación verificable: si un `Finder` es consumido por un
command handler, o un `Reader` devuelve un `View`, el corte está mal.

**R7 — Dos clases de adapter, y la barata es la default.**

| | Adapter *store-backed* | Adapter *SQL* |
|---|---|---|
| Base | `ReadModelStore` + `Criteria` | `DataSource` |
| Clase | `ReadModel<X>` | `Postgres<X>` |
| Corre con `InMemoryReadModelStore` | sí | no |
| Cuándo | default | sólo si hace falta join, subquery o agregación |
| Doble para tests | ninguno (el store in-memory alcanza) | requiere gemelo in-memory |

Con la fase 0 adentro (§5.1), **sólo 1 de los 10 puertos nuevos** justifica
adapter SQL: `TransactionFinder`. Los otros 9 quedan store-backed, lo que
mantiene intactas todas las composiciones in-memory (`fixed-ledger-doubles.ts`,
`ledger-application.spec.ts`, los e2e) sin escribir un solo gemelo.

**R8 — Nombres de archivo.**
Puerto: `application/ports/<kebab>.port.ts` → clase `PascalCase` (sigue
`account-lookup.port.ts` → `AccountLookup`).
Adapter: `infrastructure/adapters/persistence/read-model-<kebab>.ts` o
`postgres-<kebab>.ts`.
Sin barrels nuevos fuera de los cuatro casos del Artículo 13 —
`application/ports/index.ts` ya existe en `reconciliation` y `transactions` y es
uno de esos casos, así que los módulos que hoy no lo tienen pueden agregarlo.

---

## 4. Inventario de puertos

10 puertos nuevos, 2 puertos existentes que se reubican y se extienden, 3 que se
quedan como están.

| Módulo | Puertos nuevos | Adapter SQL |
|---|---|---|
| `accounts` | `AccountTreeFinder`, `AccountConstraintsReader`, `AccountNameReader`, `AccountBalanceFinder` | — |
| `transactions` | `TransactionFinder`, `PendingReviewFinder` | `TransactionFinder` |
| `ledger` | `LedgerSettingsFinder`, `LedgerTimezoneReader`, `SystemAccountLookup` | — |
| `reference` | `CurrencyCatalogFinder` | — |

### 4.1 `accounts` — 4 puertos nuevos

**`AccountTreeFinder`** (`accounts/application/ports/account-tree-finder.port.ts`)
Consumidores: `GetAccountTreeHandler`, `GetAccountByIdHandler`.
Adapter: store-backed.

```ts
export abstract class AccountTreeFinder {
  /** El árbol del usuario, ordenado por nombre (INV-9). */
  abstract tree(userId: string): Promise<readonly AccountView[]>;
  abstract byId(userId: string, accountId: string): Promise<Nullable<AccountView>>;
}
```

**`AccountConstraintsReader`** (`…/ports/account-constraints-reader.port.ts`)
Consumidor: `AccountValidationService`.
Adapter: store-backed (`oneOf` sobre los ids pedidos, en vez de traer todo).
Devuelve un `AccountConstraints` — no un `View`: esto lo consume el write side,
no la API.

```ts
export type AccountConstraints = {
  readonly accountId: string;
  readonly name: string;
  readonly type: string;
  /** Moneda única que acepta, o null si acepta cualquiera (INV-4). */
  readonly currency: Nullable<string>;
  readonly openedOn: string;
  readonly closedOn: Nullable<string>;
  readonly isSystem: boolean;
};

export abstract class AccountConstraintsReader {
  abstract byIds(
    userId: string,
    accountIds: readonly string[],
  ): Promise<ReadonlyMap<string, AccountConstraints>>;
}
```

**`AccountNameReader`** (`…/ports/account-name-reader.port.ts`)
Consumidor: `AccountNameRegistry` — que es write side, de ahí el sufijo (R6).
Adapter: store-backed. `isTaken` pasa de traer N filas a traer 0 o 1.
`namesOf` sigue necesitando el set completo para el rename — es inherente a la
regla, no un defecto del acceso.

```ts
export abstract class AccountNameReader {
  abstract isTaken(userId: string, name: string): Promise<boolean>;
  /** Todos los nombres del usuario; el rename los reparenta en memoria. */
  abstract namesOf(userId: string): Promise<readonly string[]>;
}
```

**`AccountBalanceFinder`** (`…/ports/account-balance-finder.port.ts`)
Consumidor: `GetAccountBalancesHandler`.
Adapter: store-backed — el join desaparece con el `user_id` de la fase 0 (§5.1).

```ts
export type BalanceFilter = {
  readonly accountId: Nullable<string>;
  readonly currency: Nullable<string>;
};

export abstract class AccountBalanceFinder {
  abstract byUser(userId: string, filter: BalanceFilter): Promise<readonly BalanceView[]>;
}
```

> Nota de ubicación: el caso de uso `GetAccountBalances` vive en `accounts` pero
> el read model `proj_balances` lo escribe `transactions`. Por **R1** el puerto va
> en `accounts`; por **R2** el esquema queda en
> `transactions/infrastructure/projections/account-balances.schema.ts`. Esta
> asimetría existe hoy también (el handler de `accounts` importa el read model de
> `transactions`), sólo que ahora queda confinada a infraestructura.

### 4.2 `transactions` — 2 puertos nuevos

**`TransactionFinder`** (`transactions/application/ports/transaction-finder.port.ts`)
Consumidores: `ListTransactionsHandler`, `GetTransactionByIdHandler`.
Adapter: **SQL**. El filtro por cuenta pasa a `EXISTS (SELECT 1 FROM proj_postings …)`
y el detalle a un solo `SELECT` con las legs, eliminando el round-trip doble.

```ts
export type TransactionFilter = {
  readonly status: Nullable<string>;
  readonly derivedKind: Nullable<string>;
  readonly payee: Nullable<string>;
  readonly clientId: Nullable<string>;
  readonly accountId: Nullable<string>;
  readonly fromDate: Nullable<string>;
  readonly toDate: Nullable<string>;
};

export abstract class TransactionFinder {
  abstract list(
    userId: string,
    filter: TransactionFilter,
    page: PageRequest,
  ): Promise<TransactionPage>;

  abstract byId(userId: string, transactionId: string): Promise<Nullable<TransactionView>>;
}
```

**`PendingReviewFinder`** (`…/ports/pending-review-finder.port.ts`)
Consumidor: `ListPendingReviewHandler`. Adapter: store-backed.

```ts
export abstract class PendingReviewFinder {
  abstract list(userId: string, page: PageRequest): Promise<readonly PendingReviewView[]>;
}
```

### 4.3 `reference` — 1 puerto nuevo

**`CurrencyCatalogFinder`** (`reference/application/ports/currency-catalog-finder.port.ts`)
Consumidor: `ListCurrenciesHandler`. Adapter: store-backed.
Absorbe el `type CurrencyRow` que hoy está declarado *dentro* del handler
(`list-currencies.handler.ts:9`).

```ts
export abstract class CurrencyCatalogFinder {
  /** El catálogo completo, ordenado por código. No particionado por usuario. */
  abstract all(): Promise<readonly CurrencyView[]>;
}
```

### 4.4 `ledger` — 3 puertos nuevos, que reubican y extienden 2 existentes

Los tres leen `proj_ledger_settings`. Se mantienen separados **por
responsabilidad**, no por tabla: que tres datos salgan de la misma fila es un
detalle del adapter, y dejar que ese detalle decida el corte del puerto sería
volver a modelar por storage — justo lo que esta propuesta corrige. Los tres
adapters son store-backed y comparten el mismo `<x>.schema.ts` (R2), así que la
separación no duplica conocimiento del esquema.

**`LedgerSettingsFinder`** (`ledger/application/ports/ledger-settings-finder.port.ts`)
Consumidor: `GetLedgerSettingsHandler`. Sirve a la API.

```ts
export abstract class LedgerSettingsFinder {
  abstract byUser(userId: string): Promise<Nullable<LedgerSettingsView>>;
}
```

**`LedgerTimezoneReader`** (`…/ports/ledger-timezone-reader.port.ts`)
Consumidor: `EvaluateAssertionHandler` (`reconciliation`), que necesita la zona
IANA para resolver fronteras de día.

```ts
export abstract class LedgerTimezoneReader {
  abstract timezoneOf(userId: string): Promise<string>;
}
```

**`SystemAccountLookup`** (`…/ports/system-account-lookup.port.ts`)
Consumidores: `ResolveDiscrepancyHandler` (`reconciliation`),
`RecordOpeningBalanceHandler` (`accounts`). Una sola responsabilidad: resolver el
id de una cuenta técnica por rol canónico (INV-13) — que es literalmente lo que
ya dice el JSDoc del puerto existente. El segundo método no la amplía, la
completa.

```ts
export abstract class SystemAccountLookup {
  /** `Equity:Adjustments` del usuario, creada en InitializeLedger. */
  abstract adjustmentsAccountId(userId: string): Promise<string>;
  /** `Equity:OpeningBalances` del usuario, creada en InitializeLedger. */
  abstract openingBalancesAccountId(userId: string): Promise<string>;
}
```

**Excepción de R1.** Los tres tienen consumidores fuera de `ledger`
(`reconciliation` y `accounts`), así que viven en el módulo dueño de la
proyección en vez de duplicarse en cada consumidor.

**Reubica, extiende y elimina:**
- `reconciliation/…/ports/ledger-settings-reader.port.ts` → se mueve a `ledger`
  como `LedgerTimezoneReader`. El nombre viejo prometía "los settings" y entregaba
  un `timezoneOf`; el nuevo dice lo que hace.
- `reconciliation/…/ports/system-account-lookup.port.ts` → se mueve a `ledger` y
  gana `openingBalancesAccountId`.
- el acceso directo a `proj_ledger_settings` desde `RecordOpeningBalanceHandler`
  (`record-opening-balance.handler.ts:87`), que hoy es la tercera lectura de la
  misma tabla con su propio criterio, pasa a `SystemAccountLookup`. Con eso el
  handler deja de depender de `ReadModelStore` — y es el **único command handler
  del ledger que hoy lo hace**.

Los adapters `ReadModelLedgerSettingsReader` y `ReadModelSystemAccountLookup` se
mueven de `reconciliation/infrastructure/` a `ledger/infrastructure/adapters/persistence/`,
más uno nuevo para el `Finder`. Tres adapters, tres puertos, una tabla.

### 4.5 Se quedan como están

- `AccountLookup` (`transactions`) — ya cumple el patrón y el nombre.
- `AssertionLookupPort` (`reconciliation`) — cumple. El sufijo `Port` es
  redundante bajo R6 (`AssertionLookup` bastaría), pero renombrar no paga.
- `AssertionStatusStore` y `AdjustmentAuditStore` (`reconciliation`) — cumplen el
  patrón, pero al adoptar R6 quedan mal nombrados: `Store` sugiere escritura, y
  el JSDoc de ambos aclara que deliberadamente **no** la tienen. Renombrar a
  `AssertionStatusReader` / `AdjustmentAuditReader`, y `AssertionStatusRow` →
  `AssertionStatusRecord` (no es un row de storage, es el contrato del puerto).
  Cambio mecánico, va en la fase 5.

  > No se les aplica R3/R4 (devolver un `View` y mapear en el adapter):
  > `AssertionStatusReader` tiene dos consumidores de naturaleza distinta —
  > los query handlers y el reactor del write side — así que devuelve su
  > `Record` y `toAssertionStatusView` se queda del lado del handler. Es la
  > excepción justificada, no un olvido.
- `AssertionPostingReader` (`reconciliation/domain/ports`) — es un puerto de
  dominio, correcto. Su adapter sí debería empujar `status` y `date` al `WHERE`
  (§1.2), pero eso es una optimización interna del adapter, no un cambio de
  contrato.
- `CurrencyCatalogCache` (`reference`) — no es un puerto de lectura, es un hook de
  invalidación. Queda.
- `ConsistencyVerifier` y `rebuild.command` (`tooling/`) — siguen usando
  `ReadModelStore` genérico. Es lo correcto: operan sobre tablas arbitrarias por
  definición y no están en `application`. Sólo cambian sus imports de esquema.

### 4.6 `ReadModelStore` — qué le queda

**No se toca.** Sigue siendo:
- el camino de escritura de los 8 projectors (`upsert` / `delete`);
- el `truncate` del `ProjectionRebuilder`;
- la base de los adapters store-backed.

Ahí el genérico paga: `ProjectionRebuilder` funciona sobre cualquier tabla sin
conocerla. Lo que se elimina es su uso **desde `application`**.

---

## 5. Cambios de esquema

Estamos en fase de desarrollo sin datos en producción (CLAUDE.md), así que las
migraciones se reescriben in situ sobre base limpia — sin backfill.

### 5.1 `proj_balances` gana `user_id` — aprobado

`CreateCoreProjections1790000000003`. Hoy la tabla no tiene dueño, y eso obliga a
`GetAccountBalancesHandler` y a `ConsistencyVerifier` a reconstruir la pertenencia
cruzando contra `proj_accounts` en memoria. Es la causa raíz de la fuga 1.2 más
grave y del roce con el Artículo 5.

```sql
"user_id" UUID NOT NULL,
PRIMARY KEY ("user_id", "account_id", "currency_code")
```

Requiere que `AccountBalancesProjector` propague el `userId` del evento — ya lo
tiene disponible en el `StoredEvent`. Con esto `AccountBalanceFinder` queda
store-backed y el adapter SQL se evita.

Beneficio colateral: `ConsistencyVerifier.storedBalances` (`consistency-verifier.ts`)
deja de necesitar el mapa `accountOwners()` para saber de quién es cada balance.
El caso de la fila huérfana que hoy conserva a propósito —"un balance sin cuenta
es drift por definición"— sigue funcionando, porque la fila trae su propio dueño.

### 5.2 Índices nuevos

```sql
CREATE INDEX "idx_proj_pending_review_user_date" ON "proj_pending_review" ("user_id", "date");
CREATE INDEX "idx_proj_postings_user_account_date" ON "proj_postings" ("user_id", "account_id", "date");
```

El segundo sirve al `AssertionPostingReader` una vez que empuje los filtros al
`WHERE`. El índice actual `(account_id, date)` no cubre el scope por usuario.

### 5.3 Nada más

Ninguna tabla cambia de forma más allá de eso. Los `Row` completos de **R2** se
derivan del DDL existente, no lo modifican.

---

## 6. Composición y wiring

### 6.1 El problema

`createQueryBus(readModel: ReadModelStore)` (`bootstrap/query-bus.factory.ts:29`)
pasa el store a los 8 handlers. Con los puertos, la firma cambia.

### 6.2 Propuesta

Una factory de puertos en infraestructura, y la del bus recibe el conjunto:

Los dos conjuntos se declaran por separado, siguiendo el mismo corte que R6: los
`Finder` alimentan el query bus, los `Reader`/`Lookup` alimentan la composición
del write side. Ningún archivo necesita los dos.

```ts
// bootstrap/read-side-ports.factory.ts   (infraestructura: conoce adapters)

/** Los que sirven a la API. */
export type QueryPorts = {
  readonly accountTree: AccountTreeFinder;
  readonly accountBalances: AccountBalanceFinder;
  readonly transactions: TransactionFinder;
  readonly pendingReview: PendingReviewFinder;
  readonly ledgerSettings: LedgerSettingsFinder;
  readonly currencies: CurrencyCatalogFinder;
};

/** Los que sirven al write side. */
export type WriteSideReadPorts = {
  readonly accountConstraints: AccountConstraintsReader;
  readonly accountNames: AccountNameReader;
  readonly systemAccounts: SystemAccountLookup;
};

/** Composición store-backed: sirve a Postgres y a las composiciones in-memory. */
export function createQueryPorts(readModel: ReadModelStore): QueryPorts;
export function createWriteSideReadPorts(readModel: ReadModelStore): WriteSideReadPorts;

/**
 * Sustituye `transactions` por su adapter SQL. Es el único puerto que lo
 * necesita, así que no hace falta un mecanismo general.
 */
export function withSqlTransactionFinder(base: QueryPorts, dataSource: DataSource): QueryPorts;

// bootstrap/query-bus.factory.ts
export function createQueryBus(ports: QueryPorts): RegistryQueryBus;
```

`LedgerApplicationDeps` gana `WriteSideReadPorts` en lugar de que el `readModel`
crudo llegue hasta `AccountValidationService`, `AccountNameRegistry` y
`RecordOpeningBalanceHandler`. El `readModel` sigue entrando — lo necesita el
`SynchronousProjectionDispatcher`.

`LedgerTimezoneReader` no entra en ninguno de los dos: su único consumidor es
`EvaluateAssertionHandler`, que `ReconciliationModule` compone por su cuenta.

`reconciliation` no cambia: ya registra sus queries en `onModuleInit` con sus
puertos bindeados en su propio módulo. Ese es el modelo a seguir; los demás
módulos podrían migrar a lo mismo en una fase posterior, pero **no es parte de
esta propuesta** (§9).

### 6.3 Impacto en los módulos Nest

- `AccountsModule` deja de estar vacío: bindea sus 4 puertos.
- `TransactionsModule` agrega 2 bindings.
- `LedgerCoreModule` agrega 3.
- `ReferenceModule` agrega 1.
- `ReconciliationModule` pierde 2 bindings (los reubicados en `ledger`) y los
  importa desde ahí.

---

## 7. Testing

Este es el costo real de la migración y merece explicitarse.

### 7.1 Qué se gana

Los handlers dejan de sembrar filas `snake_case` en un store simulado y pasan a
programar un doble del puerto:

```ts
// antes
await store.upsert(PROJ_ACCOUNTS, { account_id: 'a1' }, { account_id: 'a1', user_id: 'u1', … });
// después
const finder = new FakeAccountTreeFinder([anAccount({ id: 'a1' })]);
```

### 7.2 Qué se paga

| | Hoy | Después |
|---|---|---|
| Doble para tests de handler | 1 (`InMemoryReadModelStore`) | 0 nuevos para los 9 store-backed (§7.3); 1 gemelo in-memory para `TransactionFinder` |
| Contract tests | 1 (`read-model-store.contract.ts`) | +1 (`TransactionFinder`, contra Postgres y contra el gemelo) |
| Specs de adapter | — | +10 (uno por adapter, con `InMemoryReadModelStore`) |
| Specs de projector | sin cambio | sin cambio |
| e2e / composiciones in-memory | sin cambio | sin cambio **si** se respeta R7 |

Con la fase 0 adentro, el costo de testing bajó sustancialmente respecto del
borrador: de 3 gemelos in-memory y 3 contract tests a uno de cada uno.

Los adapters store-backed **no necesitan contract test propio**: su comportamiento
es `ReadModelStore` + un mapeo, y `read-model-store.contract.ts` ya cubre el
primero. Se testean con `InMemoryReadModelStore` como spec normal.

Los adapters SQL sí: un `*.contract.ts` por puerto corriendo contra Postgres,
siguiendo `read-model-readers.postgres.spec.ts` y `assertion-status-store.contract.ts`,
que son la plantilla exacta.

### 7.3 Riesgo a vigilar

Un fake de puerto puede divergir del adapter real (el clásico "el fake filtra
distinto que el `WHERE`"). Mitigación: los fakes de los 6 puertos store-backed se
implementan **sobre `InMemoryReadModelStore` reusando el mismo adapter**, no
reimplementando la lógica:

```ts
const finder = new ReadModelAccountTreeFinder(new InMemoryReadModelStore());
```

Es decir: para los store-backed **no hay fake**, hay el adapter real sobre el
store in-memory. Sólo `TransactionFinder` necesita gemelo, y lleva un contract
test compartido que corre contra ambos.

### 7.4 Artículo 4 (TDD estricto)

Cada puerto se introduce con su spec primero. Como los handlers ya tienen specs
verdes, el orden por puerto es: spec del adapter → adapter → reescribir el spec
del handler contra el puerto → cambiar el handler → borrar el acceso viejo.

---

## 8. Qué se elimina al terminar

- La carpeta `application/read-models/` de los 5 módulos → `application/views/`,
  con archivos `*.view.ts` que contienen **sólo el `View`**. El nombre viejo ya
  no describe lo que queda: el read model pasa a ser un asunto de infraestructura,
  y lo que sobrevive en `application` es el contrato de salida del puerto.
  Los `PROJ_*`, los `Row` y las funciones `toXView` se van a
  `infrastructure/projections/*.schema.ts` (R2, R4).
- Todo import de `@cqrs/application/projection/read-model-store` desde
  `application/` — 12 archivos.
- Todo import de `@shared` → `Criteria` desde `application/` de `ledger`.
- Los 3 tipos `Row` duplicados de §1.3.
- 2 puertos de `reconciliation`, reubicados en `ledger` (§4.4).
- El último `ReadModelStore` en un command handler
  (`RecordOpeningBalanceHandler`).

**Verificación mecánica sugerida:** agregar un tercer caso a
`hexagonal-isolation.spec.ts` que falle si algún archivo de `application/`
importa `read-model-store` o `Criteria`. Convierte esta propuesta en un
invariante verificado en CI en vez de una convención que se erosiona.

---

## 9. Plan de migración

Incremental, un módulo por PR, con los dos patrones conviviendo mientras dura
(ya conviven hoy). Ninguna fase deja el repo en rojo.

| # | Fase | Contenido | Riesgo |
|---|---|---|---|
| 0 | Esquema | `user_id` en `proj_balances` + 2 índices + `AccountBalancesProjector` | bajo |
| 1 | `accounts` | 4 puertos, 4 adapters, `read-models/` → `views/`, 2 query handlers, 2 servicios de aplicación | **alto** — toca el write side (validación y unicidad de nombres) |
| 2 | `ledger` | 3 puertos, reubica los 2 de `reconciliation`, migra `RecordOpeningBalance` | medio — toca 3 módulos |
| 3 | `transactions` | 2 puertos, adapter SQL del `TransactionFinder` + su gemelo y contract test | medio — es el único SQL no trivial |
| 4 | `reference` | 1 puerto | bajo |
| 5 | Cierre | guard en `hexagonal-isolation.spec.ts`, renombres de `reconciliation` (§4.5), filtros al `WHERE` en `AssertionPostingReader` | bajo |

La fase 0 es prerrequisito de la 1 (sin `user_id` en `proj_balances`,
`AccountBalanceFinder` no puede ser store-backed). El resto son independientes
entre sí y pueden reordenarse.

**Orden justificado:** `accounts` primero porque es el que más esquema filtra
(4 consumidores sobre `proj_accounts`) y el único donde el read model alimenta
decisiones del write side — si el patrón no aguanta ahí, no aguanta. `reference`
último porque es trivial y no aporta información de diseño.

**Fuera de alcance de esta propuesta** (candidatos a un seguimiento):
- Mover el registro de query handlers de `createQueryBus` a cada módulo
  (`onModuleInit`), como ya hace `reconciliation`.
- Paginación con cursor en lugar de offset.
- Cualquier cambio en `libs/cqrs`.

---

## 10. Decisiones de revisión

Las cuatro preguntas del borrador, resueltas (2026-08-07). Ya están aplicadas en
las secciones anteriores; quedan acá para que la propuesta explique por qué está
como está.

1. **Carpeta: `application/views/`.** Una vez que salen `PROJ_*`, el `Row` y el
   mapeo, lo que queda no es un read model sino el contrato de salida del puerto,
   y el nombre de la carpeta debe decirlo. → §8.
2. **`ledger` expone tres puertos, no uno.** Se parte por responsabilidad única:
   `LedgerSettingsFinder` (API), `LedgerTimezoneReader` (fronteras de día) y
   `SystemAccountLookup` (cuentas técnicas, INV-13). Que los tres datos vivan en
   la misma fila es un detalle del adapter; dejar que decida el corte del puerto
   sería seguir modelando por storage. → §4.4.
3. **La fase 0 entra.** `user_id` en `proj_balances`. Es lo que baja el diseño de
   3 adapters SQL a 1, y de 3 gemelos in-memory a 1. → §5.1.
4. **Se adopta la distinción `Finder` / `Reader` / `Lookup`,** y con carácter
   normativo: el sufijo es una afirmación verificable sobre quién consume el
   puerto y qué devuelve. → R6.

**Consecuencias de (4) sobre el resto del diseño**, que el borrador no tenía:
- `AccountNameFinder` → **`AccountNameReader`**: su consumidor es
  `AccountNameRegistry`, que es write side. → §4.1.
- `AssertionStatusStore` / `AdjustmentAuditStore` quedan mal nombrados y se
  renombran a `…Reader` en la fase 5. → §4.5.
- La composición se parte en `QueryPorts` y `WriteSideReadPorts` siguiendo el
  mismo corte. → §6.2.

---

## 11. Validación contra la constitución

| Artículo | Efecto |
|---|---|
| 1 — Núcleo aislado | **Mejora.** `application` deja de conocer tabla, columnas y `snake_case`. Los adapters SQL concentran `typeorm` donde ya está permitido. |
| 4 — TDD estricto | Respetado por el orden de §7.4. |
| 5 — Aislamiento por usuario | **Mejora.** El scope pasa del `.filter()` al `WHERE` en balances; `userId` es el primer parámetro obligatorio de todo método de puerto. |
| 8 — Enums en aplicación | Sin cambio. Los `View` siguen tipando con los enums de aplicación; el cast `as AccountType` se muda al adapter. |
| 10 — CQRS estricto | **Reforzado.** Los puertos no tienen `save`; el projector sigue siendo el único escritor. |
| 12 — Balanceo centralizado | Sin cambio. `AccountConstraintsReader` devuelve datos, no reglas: `ensureOpenOn` / `ensureAcceptsCurrency` siguen siendo la única implementación. |
| 13 — Imports por ruta completa | Respetado. Los únicos `index.ts` nuevos son `application/ports/`, que es uno de los cuatro casos permitidos. |

| Quality Gate | Cumplimiento |
|---|---|
| Simplicity | La abstracción tiene caso de uso presente: 12 archivos de `application` acoplados al esquema físico y 4 queries resueltas en memoria. No agrega capa nueva — usa la que la arquitectura ya define (puerto + adapter). |
| Anti-Abstraction | Es la razón por la que se descartan las entidades TypeORM y las entidades de dominio de lectura. Los adapters usan `DataSource` directo. |
| Integration-First | Los puertos SQL llevan contract test antes del adapter. |
| Test-First | §7.4. |
