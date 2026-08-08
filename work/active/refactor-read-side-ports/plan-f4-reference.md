# refactor-read-side-ports · Fase 4: `reference` — Plan de Implementación

**Historia:** `work/active/refactor-read-side-ports/`
**App:** `apps/ledger`
**Objetivo:** Servir el catálogo de monedas por un puerto tipado y cerrar la firma de
`createQueryBus`, que hasta acá seguía recibiendo el `ReadModelStore` de forma transitoria.
**Arquitectura:** NestJS · hexagonal · CQRS + event sourcing. Un solo puerto store-backed.
Es la fase más chica y deliberadamente la última: no aporta información de diseño, sólo
cierra.
**Stack:** NestJS · TypeScript · Jest
**Depende de:** Fases 1–3 (la Tarea 4 elimina el parámetro transitorio que ellas dejaron).

### Trazabilidad AC → Tareas

| AC | Cubierto por |
|----|-------------|
| AC-1 | Tarea 4 (`reference/application/` sin `ReadModelStore`) |
| AC-4 | Tarea 1 (`currencies.schema.ts`) |
| AC-5 | Tarea 1, Tarea 4 |
| AC-6 | Tarea 2 (`Finder`) |
| AC-9 | Tarea 5 |

---

### Tarea 0: Rama de trabajo

Se continúa en `feat/core`. Working tree limpio.

---

### Tarea 1: Esquema y `View`

**Archivos:**
- Crear: `apps/ledger/src/reference/infrastructure/projections/currencies.schema.ts`
- Crear: `apps/ledger/src/reference/application/views/currency.view.ts`
- Modificar: `apps/ledger/src/reference/infrastructure/projections/currencies.projector.ts`
- Modificar: `apps/ledger/src/reference/infrastructure/adapters/read-model-currency-catalog.ts`

**Step 1: Recoger los tres pedazos dispersos**

Este módulo tiene el caso más disperso de todos, y por eso el esquema lo ordena de golpe:

- `PROJ_CURRENCIES` vive en `application/read-models/currencies.read-model.ts` (que **sólo**
  contiene esa constante);
- `CurrencyRow` está declarado **dentro del handler** (`list-currencies.handler.ts:9`);
- `CurrencyView` está en `list-currencies.query.ts`, no en un read-model.

Destino: `PROJ_CURRENCIES` + `CurrencyRow` + `toCurrencyView` en el esquema;
`CurrencyView` en `application/views/currency.view.ts`.

Ojo con `minor_units`: el handler hace `Number(row.minor_units)` porque Postgres lo
devuelve como string. Esa conversión se muda a `toCurrencyView`, en el borde.

---

### Tarea 2: `CurrencyCatalogFinder` + adapter

**Archivos:**
- Crear: `apps/ledger/src/reference/application/ports/currency-catalog-finder.port.ts`
- Crear: `apps/ledger/src/reference/infrastructure/adapters/persistence/read-model-currency-catalog-finder.ts`
- Test: `…/read-model-currency-catalog-finder.spec.ts`

**Step 1: Escribir el test que falla**

```typescript
it('returns the catalog ordered by code', async () => { /* … */ });
it('returns every currency regardless of user', async () => {
  // INV-9 no aplica: la precisión de una moneda es universal, no de un usuario
});
it('coerces minor units to a number', async () => { /* el driver los da como string */ });
```

**Step 2: Ejecutar y confirmar que falla**

```bash
npx jest apps/ledger/src/reference/infrastructure/adapters/persistence/read-model-currency-catalog-finder.spec.ts --no-coverage
```

Esperado: FAIL.

**Step 3: Implementar**

```typescript
/**
 * Read port over the reference currency catalog.
 *
 * The one read that is not partitioned by user: a currency's precision is universal,
 * so INV-9 does not apply and no `userId` parameter belongs in this signature.
 */
export abstract class CurrencyCatalogFinder {
  abstract all(): Promise<readonly CurrencyView[]>;
}
```

Es el único puerto de la refactorización sin `userId` como primer parámetro, y el JSDoc debe
decir por qué — para que no se lea como un descuido en review.

**Step 4: Confirmar verde.** Mismo comando. Esperado: PASS.

---

### Tarea 3: Migrar `ListCurrenciesHandler`

**Archivos:**
- Modificar: `apps/ledger/src/reference/application/usecases/list-currencies/list-currencies.handler.ts`
- Modificar: `apps/ledger/src/reference/application/usecases/list-currencies/list-currencies.query.ts` (saca `CurrencyView`, que ahora vive en `views/`)

El handler queda en `return this.currencies.all()`. Se conserva el JSDoc que explica por qué
el `QueryContext` se acepta y no se usa.

```bash
npx jest apps/ledger/src/reference --no-coverage
```

Esperado: PASS.

---

### Tarea 4: Cerrar el wiring — AC-1

**Archivos:**
- Modificar: `apps/ledger/src/reference/reference.module.ts` (1 binding)
- Modificar: `apps/ledger/src/bootstrap/read-side-ports.factory.ts` (`currencies` completa `QueryPorts`)
- Modificar: `apps/ledger/src/bootstrap/query-bus.factory.ts`
- Borrar: `apps/ledger/src/reference/application/read-models/currencies.read-model.ts`

**Step 1: Eliminar el parámetro transitorio**

`createQueryBus(ports: QueryPorts, readModel: ReadModelStore)` pasa a
`createQueryBus(ports: QueryPorts)`. El TODO que dejó la Fase 1 se resuelve acá: ya no queda
ningún query handler que reciba el store.

`ReadModelCurrencyCatalog` (el cache sincrónico para rehidratación) **no se toca**: no es un
puerto de lectura de casos de uso sino un cache de dominio, y sigue leyendo por
`ReadModelStore` desde infraestructura, que es su lugar.

**Step 2: Verificar el AC-1 completo, ya sobre los cinco módulos**

```bash
grep -rn "read-model-store" apps/ledger/src --include=*.ts | grep "/application/"
```

Esperado: sin resultados.

```bash
grep -rln "from '@shared'" apps/ledger/src --include=*.ts | xargs grep -l "Criteria" | grep "/application/"
```

Esperado: sin resultados.

**Step 3: Confirmar el wiring**

```bash
npx jest apps/ledger/src/app.wiring.spec.ts apps/ledger/src/bootstrap --no-coverage
```

Esperado: PASS.

---

### Tarea 5: Suite completa — AC-9

```bash
npx jest apps/ledger --no-coverage
```

Esperado: PASS.

---

### Cierre de fase

Commit sugerido: `refactor(ledger): read the currency catalog through a typed finder`
