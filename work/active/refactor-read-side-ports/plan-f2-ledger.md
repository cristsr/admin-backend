# refactor-read-side-ports · Fase 2: `ledger` — Plan de Implementación

**Historia:** `work/active/refactor-read-side-ports/`
**App:** `apps/ledger`
**Objetivo:** Servir `proj_ledger_settings` por tres puertos separados por responsabilidad,
reubicando en `ledger` los dos que hoy viven en `reconciliation` y eliminando la tercera
lectura suelta de la misma tabla desde `RecordOpeningBalanceHandler`.
**Arquitectura:** NestJS · hexagonal · CQRS + event sourcing. Tres puertos, tres adaptadores
store-backed, un solo `.schema.ts`. Es la fase que toca más módulos a la vez (`ledger`,
`reconciliation`, `accounts`) aunque el cambio por módulo es chico.
**Stack:** NestJS · TypeScript · Jest
**Depende de:** Fase 1 sólo para `read-side-ports.factory.ts` (si se ejecuta antes, crear
la factory acá).

### Trazabilidad AC → Tareas

| AC | Cubierto por |
|----|-------------|
| AC-1 | Tarea 8 (`ledger/application/` sin `ReadModelStore`) |
| AC-4 | Tarea 1 (`ledger-settings.schema.ts`) |
| AC-5 | Tarea 2, Tarea 8 |
| AC-6 | Tarea 3 (`Finder`), Tareas 4 y 5 (`Reader` / `Lookup`) |
| AC-7 | Tarea 6 (`RecordOpeningBalance` vía `SystemAccountLookup`) |
| AC-8 | Tareas 3–5 (tres puertos), Tarea 7 (los dos de `reconciliation` dejan de existir) |
| AC-9 | Tarea 9 |

---

### Tarea 0: Rama de trabajo

Se continúa en `feat/core`. Working tree limpio antes de empezar.

---

### Tarea 1: Esquema de `proj_ledger_settings`

**Archivos:**
- Crear: `apps/ledger/src/ledger/infrastructure/projections/ledger-settings.schema.ts`
- Modificar: `apps/ledger/src/ledger/infrastructure/projections/ledger-settings.projector.ts`

`PROJ_LEDGER_SETTINGS`, `LedgerSettingsRow` (las 6 columnas) y `toLedgerSettingsView`.

El JSDoc debe conservar la razón por la que los ids de cuentas de sistema **no** llegan al
`View`: son un detalle interno de cómo se contabilizan opening balances y ajustes, y nada
contra lo que un cliente pueda postear (INV-13). Esa asimetría es justamente lo que hace
que la tabla necesite un `Finder` *y* un `Lookup` distintos.

---

### Tarea 2: `LedgerSettingsView` a `application/views/`

**Archivos:**
- Crear: `apps/ledger/src/ledger/application/views/ledger-settings.view.ts`

Sólo el tipo `LedgerSettingsView` (3 campos).

---

### Tarea 3: `LedgerSettingsFinder` + adapter

**Archivos:**
- Crear: `apps/ledger/src/ledger/application/ports/ledger-settings-finder.port.ts`
- Crear: `apps/ledger/src/ledger/infrastructure/adapters/persistence/read-model-ledger-settings-finder.ts`
- Test: `…/read-model-ledger-settings-finder.spec.ts`

**Step 1: Escribir el test que falla**

```typescript
it('returns the settings of the requesting user', async () => { /* … */ });
it('returns null when the ledger was never initialized', async () => { /* … */ });
it('never exposes the system account ids', async () => {
  const view = await finder.byUser('user-1');
  expect(view).not.toHaveProperty('openingBalancesAccountId');   // INV-13
});
```

**Step 2: Ejecutar y confirmar que falla**

```bash
npx jest apps/ledger/src/ledger/infrastructure/adapters/persistence/read-model-ledger-settings-finder.spec.ts --no-coverage
```

Esperado: FAIL.

**Step 3: Implementar**

```typescript
export abstract class LedgerSettingsFinder {
  abstract byUser(userId: string): Promise<Nullable<LedgerSettingsView>>;
}
```

**Step 4: Confirmar verde.** Mismo comando. Esperado: PASS.

Migrar en el mismo ciclo `GetLedgerSettingsHandler`, que queda en una línea.

---

### Tarea 4: `LedgerTimezoneReader` + adapter (reubica)

**Archivos:**
- Crear: `apps/ledger/src/ledger/application/ports/ledger-timezone-reader.port.ts`
- Crear: `apps/ledger/src/ledger/infrastructure/adapters/persistence/read-model-ledger-timezone-reader.ts`
- Test: `…/read-model-ledger-timezone-reader.spec.ts`
- Borrar (en Tarea 7): `apps/ledger/src/reconciliation/application/ports/ledger-settings-reader.port.ts` y su adapter

**Step 1: Escribir el test que falla**

Portar los casos del adapter actual de `reconciliation`
(`read-model-ledger-settings-reader.ts`), incluido el comportamiento cuando el ledger no
está inicializado — verificar cuál es hoy (¿excepción o default?) y **conservarlo tal cual**:
cambiar eso acá sería un cambio de comportamiento encubierto en un refactor.

**Step 2–4: Implementar**

```typescript
/**
 * Reads the user's IANA timezone from `proj_ledger_settings`.
 *
 * Named after what it answers rather than after the row it reads: the previous
 * `LedgerSettingsReader` promised the settings and delivered one field.
 */
export abstract class LedgerTimezoneReader {
  abstract timezoneOf(userId: string): Promise<string>;
}
```

```bash
npx jest apps/ledger/src/ledger/infrastructure/adapters/persistence/read-model-ledger-timezone-reader.spec.ts --no-coverage
```

Esperado: PASS.

---

### Tarea 5: `SystemAccountLookup` + adapter (reubica y extiende)

**Archivos:**
- Crear: `apps/ledger/src/ledger/application/ports/system-account-lookup.port.ts`
- Crear: `apps/ledger/src/ledger/infrastructure/adapters/persistence/read-model-system-account-lookup.ts`
- Test: `…/read-model-system-account-lookup.spec.ts`
- Borrar (en Tarea 7): el puerto y el adapter homónimos de `reconciliation`

**Step 1: Escribir el test que falla**

```typescript
it('resolves the adjustments account', async () => { /* caso existente */ });
it('resolves the opening balances account', async () => { /* nuevo, AC-7 */ });
it('fails with LedgerNotInitializedException when the ledger has no system accounts', async () => {
  // el mismo error que hoy lanza RecordOpeningBalanceHandler, ahora en un solo lugar
});
```

**Step 2–4: Implementar**

```typescript
/** Resolves the id of a user's technical account by canonical role (INV-13). */
export abstract class SystemAccountLookup {
  abstract adjustmentsAccountId(userId: string): Promise<string>;
  abstract openingBalancesAccountId(userId: string): Promise<string>;
}
```

El segundo método no amplía la responsabilidad del puerto: la completa. El JSDoc original
ya decía "por rol canónico", en plural implícito.

`LedgerNotInitializedException` se mueve al adapter, que es quien descubre la ausencia.
Verificar que `ResolveDiscrepancyHandler` sigue viendo el mismo error que antes ante un
ledger sin inicializar.

```bash
npx jest apps/ledger/src/ledger/infrastructure/adapters/persistence/read-model-system-account-lookup.spec.ts --no-coverage
```

Esperado: PASS.

---

### Tarea 6: Migrar `RecordOpeningBalanceHandler` — AC-7

**Archivos:**
- Modificar: `apps/ledger/src/accounts/application/usecases/record-opening-balance/record-opening-balance.handler.ts`
- Test: `…/record-opening-balance.handler.spec.ts`

**Step 1: Reescribir el spec contra el puerto**

Conservar el caso de ledger sin inicializar: la excepción ahora viene del puerto, pero el
comando debe seguir fallando igual desde afuera.

**Step 2: Ejecutar y confirmar que falla**

```bash
npx jest apps/ledger/src/accounts/application/usecases/record-opening-balance --no-coverage
```

Esperado: FAIL.

**Step 3: Implementar**

El constructor cambia `ReadModelStore` por `SystemAccountLookup`. El método privado
`openingBalancesAccountId()` se elimina entero — su cuerpo (query + guard + excepción) ahora
vive en el adapter. Se van los imports de `ReadModelStore`, `Criteria`,
`LedgerSettingsRow`, `PROJ_LEDGER_SETTINGS` y `LedgerNotInitializedException`.

Con esto **ningún command handler del ledger depende de `ReadModelStore`**.

**Step 4: Confirmar verde.** Mismo comando. Esperado: PASS.

---

### Tarea 7: Retirar los puertos de `reconciliation` — AC-8

**Archivos:**
- Borrar: `apps/ledger/src/reconciliation/application/ports/ledger-settings-reader.port.ts`
- Borrar: `apps/ledger/src/reconciliation/application/ports/system-account-lookup.port.ts`
- Borrar: `apps/ledger/src/reconciliation/infrastructure/adapters/persistence/read-model-ledger-settings-reader.ts`
- Borrar: `apps/ledger/src/reconciliation/infrastructure/adapters/persistence/read-model-system-account-lookup.ts`
- Modificar: `apps/ledger/src/reconciliation/application/ports/index.ts` (barrel — quitar las dos entradas)
- Modificar: `apps/ledger/src/reconciliation/reconciliation.module.ts` (quita 2 bindings, importa los de `ledger`)
- Modificar: `evaluate-assertion.handler.ts` y `resolve-discrepancy.handler.ts` (importan el puerto nuevo)

**Step 1: Verificar que no queda ninguna referencia**

```bash
grep -rn "LedgerSettingsReader\|reconciliation/application/ports/system-account-lookup" apps/ledger/src
```

Esperado: sin resultados.

**Step 2: Confirmar `reconciliation` verde**

```bash
npx jest apps/ledger/src/reconciliation --no-coverage
```

Esperado: PASS — incluidos `reconciliation.discrepancy.e2e.spec.ts` y
`reconciliation.rebuild.spec.ts`.

---

### Tarea 8: Wiring y limpieza — AC-1, AC-5

**Archivos:**
- Modificar: `apps/ledger/src/ledger/ledger-core.module.ts` (3 bindings)
- Modificar: `apps/ledger/src/bootstrap/read-side-ports.factory.ts` (`ledgerSettings` en `QueryPorts`, `systemAccounts` en `WriteSideReadPorts`)
- Modificar: `apps/ledger/src/bootstrap/query-bus.factory.ts`, `ledger-application.factory.ts`
- Borrar: `apps/ledger/src/ledger/application/read-models/ledger-settings.read-model.ts`

`LedgerTimezoneReader` no entra en ninguno de los dos conjuntos: su único consumidor es
`EvaluateAssertionHandler`, que `ReconciliationModule` compone por su cuenta. Se bindea en
`LedgerCoreModule` y `ReconciliationModule` lo inyecta.

```bash
grep -rn "read-model-store\|Criteria" apps/ledger/src/ledger/application/
```

Esperado: sin resultados.

---

### Tarea 9: Suite completa — AC-9

```bash
npx jest apps/ledger --no-coverage
```

Esperado: PASS. Atención especial a `reconciliation.discrepancy.e2e.spec.ts`, que ejercita
`ResolveDiscrepancy` de punta a punta y por lo tanto el `SystemAccountLookup` nuevo.

---

### Cierre de fase

```bash
git add -A && git status --porcelain
```

Commit sugerido: `refactor(ledger): serve ledger settings through three typed ports`
