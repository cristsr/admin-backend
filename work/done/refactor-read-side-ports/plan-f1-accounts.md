# refactor-read-side-ports · Fase 1: `accounts` — Plan de Implementación

**Historia:** `work/active/refactor-read-side-ports/`
**App:** `apps/ledger`
**Objetivo:** Sacar el esquema físico de `proj_accounts` y `proj_balances` de la capa de
aplicación de `accounts`, detrás de cuatro puertos tipados, y resolver el scope por usuario
en la base.
**Arquitectura:** NestJS · hexagonal · CQRS + event sourcing. Cuatro puertos nuevos
(`abstract class` en `application/ports/`), cuatro adaptadores store-backed sobre
`ReadModelStore`, el esquema físico concentrado en `infrastructure/projections/*.schema.ts`
y los `View` en `application/views/`. Es la fase de mayor riesgo: dos de los cuatro puertos
alimentan el **write side** (validación cross-agregado y unicidad de nombres).
**Stack:** NestJS · TypeScript · Jest
**Depende de:** Fase 0 (`user_id` en `proj_balances`).

### Trazabilidad AC → Tareas

| AC | Cubierto por |
|----|-------------|
| AC-1 | Tarea 13 (no queda import de `ReadModelStore`/`Criteria` en `accounts/application/`) |
| AC-3 | Tarea 6 (test de dos usuarios sobre el adapter), Tarea 7 (handler migrado) |
| AC-4 | Tarea 1 (`account-tree.schema.ts` con el `AccountRow` completo), Tarea 5, Tarea 13 |
| AC-5 | Tarea 2, Tarea 5, Tarea 13 (`accounts/application/read-models/` deja de existir) |
| AC-6 | Tarea 3, 6, 8, 10 (`Finder` para API, `Reader` para write side) |
| AC-9 | Tarea 14 (e2e y composiciones in-memory verdes sin gemelos) |
| AC-11 | Tarea 14 (`accounts-api.e2e.spec.ts` sin tocar expectativas) |

---

### Tarea 0: Rama de trabajo  [X]

Se continúa en `feat/core` (ver Fase 0, Tarea 0). Verificar working tree limpio antes de
empezar:

```bash
git status --porcelain    # esperado: vacío
```

---

### Tarea 1: Esquema de `proj_accounts` en infraestructura [X]

**Archivos:**
- Crear: `apps/ledger/src/accounts/infrastructure/projections/account-tree.schema.ts`
- Modificar: `apps/ledger/src/accounts/infrastructure/projections/account-tree.projector.ts` (importa de ahí)

**Step 1: Crear el esquema con la tabla completa**

Sin test propio: es una declaración de tipos y una constante, y queda cubierta por los
specs de los adapters que la usan (Tareas 3, 6, 8, 10).

```typescript
import { Nullable } from '@shared';
import { AccountType } from '@ledger/shared/domain/value-objects';
import { AccountView } from '@ledger/accounts/application/views/account.view';

/**
 * Physical shape of `proj_accounts`, declared next to the projector that writes it.
 *
 * Every column of the DDL is here, not just the ones a given caller remembers: three
 * partial `AccountRow` declarations had drifted across the codebase and none of them
 * described the table. `AccountTreeProjector` remains its only writer (rules Art. 10).
 */
export const PROJ_ACCOUNTS = 'proj_accounts';

/** One row of `proj_accounts`, exactly as stored. */
export type AccountRow = {
  readonly account_id: string;
  readonly user_id: string;
  readonly type: string;
  readonly name: string;
  readonly parent_id: Nullable<string>;
  readonly currency_code: Nullable<string>;
  readonly opened_on: string;
  readonly closed_on: Nullable<string>;
  readonly is_bank_mirror: boolean;
  readonly is_system: boolean;
};

/** Maps a stored row to what goes over the wire. */
export function toAccountView(row: AccountRow): AccountView { /* el cuerpo actual */ }
```

El cuerpo de `toAccountView` se mueve tal cual desde
`accounts/application/read-models/account-tree.read-model.ts:52`, incluido el cast
`row.type as AccountType` — que ahora vive donde corresponde, en el borde.

**Step 2: Verificar que el projector sigue verde**

```bash
npx jest apps/ledger/src/accounts/infrastructure/projections --no-coverage
```

Esperado: PASS.

---

### Tarea 2: `AccountView` a `application/views/` [X]

**Archivos:**
- Crear: `apps/ledger/src/accounts/application/views/account.view.ts`

**Step 1: Mover sólo el `View`**

Se copia `AccountView` con su JSDoc desde el read-model actual. El comentario que explica
por qué el `View` está separado del `Row` se conserva y se actualiza: ahora la separación
además es física (capas distintas), no sólo de tipos.

El archivo **no** debe contener `PROJ_*`, `AccountRow` ni `toAccountView`.

---

### Tarea 3: `AccountTreeFinder` + adapter [X]

**Archivos:**
- Crear: `apps/ledger/src/accounts/application/ports/account-tree-finder.port.ts`
- Crear: `apps/ledger/src/accounts/infrastructure/adapters/persistence/read-model-account-tree-finder.ts`
- Test: `apps/ledger/src/accounts/infrastructure/adapters/persistence/read-model-account-tree-finder.spec.ts`

**Step 1: Escribir el test que falla**

Sobre `InMemoryReadModelStore` — el adapter real, no un fake (§7.3 del diseño).

```typescript
describe('ReadModelAccountTreeFinder', () => {
  it('returns only the requesting user tree, ordered by name', async () => { /* … */ });
  it('returns null when the account belongs to another user', async () => { /* INV-9 */ });
  it('maps a stored row to the view shape', async () => { /* closedOn → isClosed */ });
});
```

**Step 2: Ejecutar y confirmar que falla**

```bash
npx jest apps/ledger/src/accounts/infrastructure/adapters/persistence/read-model-account-tree-finder.spec.ts --no-coverage
```

Esperado: FAIL — `Cannot find module '.../read-model-account-tree-finder'`.

**Step 3: Implementar el puerto**

```typescript
import { Nullable } from '@shared';
import { AccountView } from '@ledger/accounts/application/views/account.view';

/**
 * Read port over the account tree projection, serving the account queries.
 *
 * Writes are deliberately absent: `AccountTreeProjector` is the only writer and it goes
 * through the shared `ReadModelStore` (rules Art. 10).
 */
export abstract class AccountTreeFinder {
  /** The user's accounts, ordered by name (INV-9). */
  abstract tree(userId: string): Promise<readonly AccountView[]>;

  abstract byId(userId: string, accountId: string): Promise<Nullable<AccountView>>;
}
```

**Step 4: Implementar el adapter**

`@Injectable()`, extiende `AccountTreeFinder`, recibe `ReadModelStore`. Traslada los
`Criteria` que hoy están en los dos handlers (`get-account-tree.handler.ts:26` y
`get-account-by-id.handler.ts:24`) y mapea con `toAccountView`.

**Step 5: Confirmar verde**

```bash
npx jest apps/ledger/src/accounts/infrastructure/adapters/persistence/read-model-account-tree-finder.spec.ts --no-coverage
```

Esperado: PASS.

---

### Tarea 4: Migrar `GetAccountTree` y `GetAccountById` [X]

**Archivos:**
- Modificar: `apps/ledger/src/accounts/application/usecases/get-account-tree/get-account-tree.handler.ts`
- Modificar: `apps/ledger/src/accounts/application/usecases/get-account-by-id/get-account-by-id.handler.ts`
- Test: los specs existentes de ambos handlers

**Step 1: Reescribir los tests contra el puerto**

Los handlers pasan a recibir `AccountTreeFinder`. En los tests se instancia el adapter real
sobre `InMemoryReadModelStore` (§7.3), así que la siembra de datos no cambia de forma —
sólo deja de estar acoplada a nombres de columna en el handler.

**Step 2: Ejecutar y confirmar que falla**

```bash
npx jest apps/ledger/src/accounts/application/usecases/get-account-tree apps/ledger/src/accounts/application/usecases/get-account-by-id --no-coverage
```

Esperado: FAIL.

**Step 3: Implementar**

Cada handler queda en una línea de cuerpo: `return this.accounts.tree(ctx.userId)` /
`return this.accounts.byId(ctx.userId, query.accountId)`. Se van los imports de
`ReadModelStore`, `Criteria`, `OrderType`, `AccountRow`, `PROJ_ACCOUNTS` y `toAccountView`.

**Step 4: Confirmar verde**

Mismo comando. Esperado: PASS.

---

### Tarea 5: Esquema y `View` de `proj_balances` [X]

**Archivos:**
- Crear: `apps/ledger/src/transactions/infrastructure/projections/account-balances.schema.ts`
- Crear: `apps/ledger/src/accounts/application/views/balance.view.ts`
- Modificar: `apps/ledger/src/transactions/infrastructure/projections/account-balances.projector.ts`

**Step 1: Crear ambos**

`PROJ_BALANCES`, `BalanceRow` (ahora **con `user_id`**, ver Fase 0) y `toBalanceView` van al
esquema, junto al projector que la escribe. `BalanceView` va a `accounts/application/views/`
porque el caso de uso que la expone vive en `accounts`.

Dejar constancia en el JSDoc del esquema de esa asimetría: `transactions` escribe la tabla,
`accounts` la consulta. Ya era así; ahora queda confinada a infraestructura.

---

### Tarea 6: `AccountBalanceFinder` + adapter — AC-3 [X]

**Archivos:**
- Crear: `apps/ledger/src/accounts/application/ports/account-balance-finder.port.ts`
- Crear: `apps/ledger/src/accounts/infrastructure/adapters/persistence/read-model-account-balance-finder.ts`
- Test: `…/read-model-account-balance-finder.spec.ts`

**Step 1: Escribir el test que falla — éste es el AC-3**

```typescript
it('never reads another user rows', async () => {
  // arrange — balances de dos usuarios en la misma tabla
  await seedBalance(store, { userId: 'user-1', accountId: 'acc-1', currency: 'COP' });
  await seedBalance(store, { userId: 'user-2', accountId: 'acc-2', currency: 'COP' });
  const spy = jest.spyOn(store, 'query');

  // act
  const balances = await finder.byUser('user-1', { accountId: null, currency: null });

  // assert — ni en el resultado…
  expect(balances.map((b) => b.accountId)).toEqual(['acc-1']);
  // …ni en lo que se le pidió a la base: el scope va en el criterio, no en un filter()
  expect(spy.mock.calls[0][1].filters).toContainEqual(
    expect.objectContaining({ field: 'user_id', value: 'user-1' }),
  );
});
```

La segunda aserción es la que importa: es la diferencia entre el comportamiento viejo
(traer todo y descartar) y el nuevo, y sin ella el test pasaría igual con el código actual.

**Step 2: Ejecutar y confirmar que falla**

```bash
npx jest apps/ledger/src/accounts/infrastructure/adapters/persistence/read-model-account-balance-finder.spec.ts --no-coverage
```

Esperado: FAIL.

**Step 3: Implementar puerto y adapter**

```typescript
export type BalanceFilter = {
  readonly accountId: Nullable<string>;
  readonly currency: Nullable<string>;
};

export abstract class AccountBalanceFinder {
  abstract byUser(userId: string, filter: BalanceFilter): Promise<readonly BalanceView[]>;
}
```

El adapter arma un solo `Criteria` con `user_id` + los filtros opcionales (`.equals` ignora
los `null`, como ya hace `ListTransactionsHandler`). **Sin `.filter()` en memoria y sin
consultar `proj_accounts`.**

**Step 4: Confirmar verde**

Mismo comando. Esperado: PASS — 3 tests.

---

### Tarea 7: Migrar `GetAccountBalances` [X]

**Archivos:**
- Modificar: `apps/ledger/src/accounts/application/usecases/get-account-balances/get-account-balances.handler.ts`

**Step 1–4:** mismo ciclo que la Tarea 4. Desaparecen `ownedAccountIds()` y el import de
`PROJ_ACCOUNTS` — el handler ya no necesita saber que existe un árbol de cuentas para
responder por balances. Actualizar el JSDoc de la clase, que hoy describe el cruce.

---

### Tarea 8: `AccountConstraintsReader` + adapter [X]

**Archivos:**
- Crear: `apps/ledger/src/accounts/application/ports/account-constraints-reader.port.ts`
- Crear: `apps/ledger/src/accounts/infrastructure/adapters/persistence/read-model-account-constraints-reader.ts`
- Test: `…/read-model-account-constraints-reader.spec.ts`

**Step 1: Escribir el test que falla**

```typescript
it('asks only for the accounts the postings reference', async () => { /* oneOf, no barrido */ });
it('omits accounts of another user', async () => { /* INV-9 */ });
it('returns an empty map when no id matches', async () => { /* el caller decide el error */ });
```

**Step 2–4: Implementar**

```typescript
/** Facts a posting is validated against. Data, never verdicts (rules Art. 12). */
export type AccountConstraints = {
  readonly accountId: string;
  readonly name: string;
  readonly type: string;
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

**Crítico:** el puerto devuelve **hechos**, no veredictos. `ensureOpenOn` y
`ensureAcceptsCurrency` siguen siendo la única implementación de esas reglas y siguen
viviendo en `accounts/domain/account/account-availability.ts` (Art. 12). Si en algún momento
este puerto empieza a devolver `isValid`, el corte está mal.

```bash
npx jest apps/ledger/src/accounts/infrastructure/adapters/persistence/read-model-account-constraints-reader.spec.ts --no-coverage
```

Esperado: PASS.

---

### Tarea 9: Migrar `AccountValidationService` — write side [X]

**Archivos:**
- Modificar: `apps/ledger/src/accounts/application/services/account-validation.service.ts`
- Test: `apps/ledger/src/accounts/application/services/account-validation.service.spec.ts`

**Step 1: Reescribir el spec contra el puerto**

Los casos existentes se conservan enteros (cuenta inexistente, cerrada, moneda no aceptada,
cuenta de sistema desde origen `CLIENT`). Sólo cambia cómo se siembra el estado.

**Step 2: Ejecutar y confirmar que falla**

```bash
npx jest apps/ledger/src/accounts/application/services/account-validation.service.spec.ts --no-coverage
```

Esperado: FAIL.

**Step 3: Implementar**

`validate()` pide sólo los ids que los postings referencian:

```typescript
const byId = await this.accounts.byIds(userId, postings.map((p) => p.accountId));
```

El resto del método no cambia: sigue mapeando posting → tipo y sigue lanzando
`AccountNotFoundException` / `SystemAccountProtectedException`. El comentario de
`validatePosting` sobre "una implementación, dos fuentes de estado" se conserva —
sigue siendo cierto y ahora es más visible.

**Step 4: Confirmar verde**

Mismo comando, más los handlers que dependen de la validación:

```bash
npx jest apps/ledger/src/transactions/application/usecases/record-transaction apps/ledger/src/transactions/application/usecases/amend-transaction --no-coverage
```

Esperado: PASS.

---

### Tarea 10: `AccountNameReader` + adapter [X]

**Archivos:**
- Crear: `apps/ledger/src/accounts/application/ports/account-name-reader.port.ts`
- Crear: `apps/ledger/src/accounts/infrastructure/adapters/persistence/read-model-account-name-reader.ts`
- Test: `…/read-model-account-name-reader.spec.ts`

**Step 1: Escribir el test que falla**

```typescript
it('answers isTaken without fetching every account', async () => { /* criterio con name */ });
it('scopes the name check to the user', async () => { /* mismo nombre, otro dueño → false */ });
it('lists every name of the user for the rename check', async () => { /* … */ });
```

**Step 2–4: Implementar**

`Reader`, no `Finder`: su consumidor (`AccountNameRegistry`) es write side (R6).

```typescript
export abstract class AccountNameReader {
  abstract isTaken(userId: string, name: string): Promise<boolean>;
  /** Every name the user holds; the rename reparents them in memory. */
  abstract namesOf(userId: string): Promise<readonly string[]>;
}
```

`namesOf` sigue trayendo el set completo: el rename re-prefija todo el subárbol y lo compara
contra las cuentas que se quedan. Es inherente a la regla, no una deuda del acceso.

---

### Tarea 11: Migrar `AccountNameRegistry` — write side [X]

**Archivos:**
- Modificar: `apps/ledger/src/accounts/application/services/account-name.registry.ts`
- Test: `apps/ledger/src/accounts/application/services/account-name.registry.spec.ts`

**Step 1–4:** mismo ciclo. `ensureAvailable` pasa a `if (await this.names.isTaken(...))`;
`ensureRenameable` consume `namesOf` y conserva intacta su lógica de subárbol
(`AccountName.reparentFrom`, el guard de re-rooting por `rootType`). Desaparece el tipo
local `NamedAccountRow`.

Verificar los dos comandos que dependen de él:

```bash
npx jest apps/ledger/src/accounts/application/usecases/open-account apps/ledger/src/accounts/application/usecases/rename-account --no-coverage
```

Esperado: PASS.

---

### Tarea 12: Wiring [X]

**Archivos:**
- Modificar: `apps/ledger/src/accounts/accounts.module.ts` (4 bindings)
- Modificar: `apps/ledger/src/bootstrap/query-bus.factory.ts`
- Modificar: `apps/ledger/src/bootstrap/ledger-application.factory.ts`
- Crear: `apps/ledger/src/bootstrap/read-side-ports.factory.ts`
- Test: `apps/ledger/src/app.wiring.spec.ts`, `apps/ledger/src/bootstrap/query-bus.spec.ts`

**Step 1: Crear la factory de puertos**

Sólo la parte que la fase necesita; las fases siguientes la completan.

```typescript
export type QueryPorts = {
  readonly accountTree: AccountTreeFinder;
  readonly accountBalances: AccountBalanceFinder;
  // …se completa en F3 y F4
};

export type WriteSideReadPorts = {
  readonly accountConstraints: AccountConstraintsReader;
  readonly accountNames: AccountNameReader;
  // …SystemAccountLookup entra en F2
};

export function createQueryPorts(readModel: ReadModelStore): QueryPorts;
export function createWriteSideReadPorts(readModel: ReadModelStore): WriteSideReadPorts;
```

**Step 2: Cambiar las firmas**

- `createQueryBus(ports: QueryPorts)` — los handlers de `accounts` reciben su puerto; los
  demás siguen recibiendo `readModel` hasta su fase. Firma transitoria explícita:
  `createQueryBus(ports: QueryPorts, readModel: ReadModelStore)`, con un TODO que apunta a
  la Fase 4, donde el segundo parámetro desaparece.
- `LedgerApplicationDeps` gana `writeSideReadPorts`. **`readModel` sigue entrando** — lo
  necesita `SynchronousProjectionDispatcher`.
- `AccountsModule` bindea los cuatro puertos con `useClass`, como
  `reconciliation.module.ts:88-92`.

**Step 3: Confirmar el wiring**

```bash
npx jest apps/ledger/src/app.wiring.spec.ts apps/ledger/src/bootstrap --no-coverage
```

Esperado: PASS.

---

### Tarea 13: Borrar lo viejo — AC-1, AC-4, AC-5 [X]

**Archivos:**
- Borrar: `apps/ledger/src/accounts/application/read-models/account-tree.read-model.ts`
- Borrar: `apps/ledger/src/accounts/application/read-models/account-tree.read-model.spec.ts` (su contenido útil vive ahora en los specs de adapter)
- Borrar: `apps/ledger/src/transactions/application/read-models/account-balances.read-model.ts`
- Modificar: `read-model-account-lookup.ts`, `read-model-assertion-posting-reader.ts`, `read-model-system-account-lookup.ts`, `consistency-verifier.ts` (importan el esquema nuevo y borran su `AccountRow` local)

**Step 1: Verificar que no queda nada colgado**

```bash
grep -rn "read-models/account-tree\|read-models/account-balances" apps/ledger/src
```

Esperado: sin resultados.

```bash
grep -rn "read-model-store\|Criteria" apps/ledger/src/accounts/application/
```

Esperado: sin resultados — **éste es el AC-1 para este módulo**.

**Step 2: Verificar que el `AccountRow` quedó uno solo**

```bash
grep -rn "account_id: string" apps/ledger/src --include=*.ts | grep -v schema.ts | grep -v spec.ts
```

Esperado: sólo declaraciones que no son un `AccountRow` (p. ej. `AssertionStatusRecord`).

---

### Tarea 14: Suite completa — AC-9, AC-11 [X]

**Step 1: Módulo**

```bash
npx jest apps/ledger/src/accounts --no-coverage
```

Esperado: PASS.

**Step 2: App entero, incluidos e2e y composiciones in-memory**

```bash
npx jest apps/ledger --no-coverage
```

Esperado: PASS. En particular `accounts-api.e2e.spec.ts` pasa **sin tocar ninguna
expectativa de request ni de response** (AC-11), y `ledger-application.spec.ts` y
`fixed-ledger-doubles.ts` funcionan sin gemelos nuevos (AC-9) porque los cuatro adapters
son store-backed (R7).

---

### Cierre de fase

```bash
git add -A && git status --porcelain
```

Commit sugerido: `refactor(ledger): read accounts through typed ports`
