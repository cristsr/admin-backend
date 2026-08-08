# refactor-read-side-ports · Fase 5: Cierre — Plan de Implementación

**Historia:** `work/active/refactor-read-side-ports/`
**App:** `apps/ledger`
**Objetivo:** Convertir la separación en un invariante verificado en CI, alinear los
nombres de `reconciliation` con la convención adoptada, y empujar al `WHERE` los filtros
que `AssertionPostingReader` todavía resuelve en memoria.
**Arquitectura:** NestJS · hexagonal · CQRS + event sourcing. Sin puertos nuevos: esta fase
cierra la refactorización y la deja defendida.
**Stack:** NestJS · TypeScript · Jest
**Depende de:** Fases 1–4 (el guard de la Tarea 1 sólo puede quedar verde con todas hechas).

### Trazabilidad AC → Tareas

| AC | Cubierto por |
|----|-------------|
| AC-1 | Tarea 1 (verificado por el guard, no por inspección) |
| AC-2 | Tarea 1 |
| AC-4 | Tarea 4 (verificación final: un `.schema.ts` por proyección) |
| AC-5 | Tarea 4 (no queda ninguna carpeta `read-models/`) |
| AC-6 | Tarea 2 (`Store` → `Reader` en `reconciliation`) |
| AC-10 | Tarea 5 (rebuild, consistency y contract del store verdes) |
| AC-11 | Tarea 5 |

---

### Tarea 0: Rama de trabajo [X]

Se continúa en `feat/core`. Working tree limpio.

---

### Tarea 1: El guard de fronteras — AC-1, AC-2 [X]

**Archivos:**
- Modificar: `apps/ledger/src/hexagonal-isolation.spec.ts`

**Step 1: Escribir el tercer caso**

El archivo ya tiene dos casos —imports de framework/driver, y dirección entre capas— y su
JSDoc cuenta cómo se erosionó cada frontera. Este tercer caso cierra la que motivó toda la
refactorización: el guard estaba verde mientras `application` conocía nombres de tabla,
`snake_case` y nulabilidad de columna, porque sólo miraba **direcciones** de import.

```typescript
/** What `application` must not reach for, now that every read goes through a port. */
const FORBIDDEN_READ_ACCESS = ['read-model-store', 'Criteria'];

/**
 * Application states what it needs; infrastructure knows where it lives.
 *
 * The two cases above policed direction, and the read side slipped past them: the table
 * names were declared *inside* `application` precisely so no import would point outward.
 * Nothing failed, and the physical schema — `proj_accounts`, `snake_case`, nullable
 * columns — reached the use cases anyway. Direction was never the whole invariant.
 */
it('keeps the read model schema out of application', () => {
  expect(readModelViolations()).toEqual([]);
});
```

`readModelViolations()` reutiliza `coreFiles()` y `importsOf()`, filtrando los archivos de
capa `application` cuyos imports mencionen `read-model-store`, o que importen `Criteria`
desde `@shared`. Excluir specs, como ya hace `isSpec`.

**Step 2: Verificar que el caso es real (falla antes de las fases)**

```bash
git stash && npx jest apps/ledger/src/hexagonal-isolation.spec.ts --no-coverage; git stash pop
```

Esperado: FAIL con la lista de los 12 archivos originales. Un guard que nunca falló no
prueba nada — si pasa contra el código viejo, la regla está mal escrita.

**Step 3: Confirmar verde contra el código nuevo**

```bash
npx jest apps/ledger/src/hexagonal-isolation.spec.ts --no-coverage
```

Esperado: PASS — 3 casos.

---

### Tarea 2: Renombres en `reconciliation` — AC-6 [X]

**Archivos:**
- Renombrar: `assertion-status-store.port.ts` → `assertion-status-reader.port.ts` (`AssertionStatusStore` → `AssertionStatusReader`, `AssertionStatusRow` → `AssertionStatusRecord`)
- Renombrar: `adjustment-audit-store.port.ts` → `adjustment-audit-reader.port.ts` (`AdjustmentAuditStore` → `AdjustmentAuditReader`)
- Modificar: los dos adapters, los contract tests, `reconciliation.module.ts`, `assertion-status.view.ts`, `get-assertion-status.handler.ts`, `list-assertions.handler.ts`, `ports/index.ts`

**Step 1: Renombrar**

Cambio mecánico, sin cambio de comportamiento. La razón está en el JSDoc de ambos puertos:
declaran explícitamente que **no** tienen escrituras porque el projector es el único
escritor (Art. 10) — y se llaman `Store`. El nombre contradice al comentario que lo explica.

`AssertionStatusRow` no es una fila de storage: es el contrato del puerto, con `camelCase` y
`Date` en vez de string. `Record` lo dice.

**Step 2: Confirmar verde**

```bash
npx jest apps/ledger/src/reconciliation --no-coverage
```

Esperado: PASS, sin cambios en ningún assert.

> No se les aplica R3/R4 (devolver `View`, mapear en el adapter): `AssertionStatusReader`
> tiene dos consumidores de naturaleza distinta —los query handlers y el reactor del write
> side— así que sigue devolviendo su `Record` y `toAssertionStatusView` se queda del lado
> del handler. Es la excepción registrada en §4.5 del diseño, no un olvido.

---

### Tarea 3: `AssertionPostingReader` filtra en la base [X]

**Archivos:**
- Modificar: `apps/ledger/src/reconciliation/infrastructure/adapters/persistence/read-model-assertion-posting-reader.ts`
- Test: `…/read-model-assertion-posting-reader.spec.ts`

**Step 1: Escribir el test que falla**

```typescript
it('excludes voided postings in the query, not after it', async () => {
  const spy = jest.spyOn(store, 'query');
  await reader.byAccountUpToDate('user-1', 'acc-1', LedgerDate.of('2026-03-01'));
  expect(spy.mock.calls[0][1].filters).toContainEqual(
    expect.objectContaining({ field: 'status', operator: FilterOperator.NOT_EQUAL }),
  );
});
```

**Step 2: Ejecutar y confirmar que falla**

```bash
npx jest apps/ledger/src/reconciliation/infrastructure/adapters/persistence/read-model-assertion-posting-reader.spec.ts --no-coverage
```

Esperado: FAIL.

**Step 3: Implementar**

`byAccountUpToDate` mueve al `Criteria` el `notEquals('status', VOIDED)` y el
`lessOrEqual('date', date.value)`, que hoy se aplican con `.filter()` sobre el resultado
(líneas 60-66). El índice `(user_id, account_id, date)` de la Fase 0 es exactamente el que
esto necesita.

**Cuidado:** el filtro por fecha usa `LedgerDate.isSameOrBefore`. Verificar que comparar
`date` como string en el `WHERE` da el mismo resultado — la columna es `DATE` y el formato
es ISO, así que el orden lexicográfico y el cronológico coinciden. Si no coincidieran, dejar
el filtro en memoria y anotar por qué; un veredicto de conciliación equivocado es peor que
una query de más.

**Step 4: Confirmar verde**

```bash
npx jest apps/ledger/src/reconciliation --no-coverage
```

Esperado: PASS — incluidos los tests del evaluador, que dependen de qué postings entran.

---

### Tarea 4: Verificación final de estructura — AC-4, AC-5 [X]

**Step 1: No queda ninguna carpeta `read-models/`**

```bash
find apps/ledger/src -type d -name read-models
```

Esperado: sin resultados.

**Step 2: Un `.schema.ts` por proyección**

```bash
grep -rn "PROJ_[A-Z_]* = '" apps/ledger/src --include=*.ts
```

Esperado: exactamente una declaración por tabla, todas en `infrastructure/`. Las de
`reconciliation` ya estaban en sus projectors; evaluar si conviene moverlas a un
`.schema.ts` propio por simetría — es cosmético y puede quedar como está.

**Step 3: Los `View` están donde deben**

```bash
ls apps/ledger/src/*/application/views/
```

Esperado: un archivo `*.view.ts` por vista, en los cinco módulos.

---

### Tarea 5: Suite completa del app — AC-10, AC-11 [X]

**Step 1: Todo**

```bash
npx jest apps/ledger --no-coverage
```

Esperado: PASS.

**Step 2: `libs/cqrs` intacto**

```bash
npx jest libs/cqrs --no-coverage
```

Esperado: PASS — `ReadModelStore` conserva su contrato; ningún archivo de la librería se
tocó en las 6 fases.

**Step 3: Verificar que ningún `api.yaml` cambió — AC-11**

```bash
git diff --stat feat/core -- 'apps/ledger/docs/**/api.yaml'
```

Esperado: sin cambios. Si alguno aparece, se rompió la premisa de la refactorización y hay
que revisarlo antes de cerrar.

---

### Cierre de la refactorización

```bash
git add -A && git status --porcelain
```

Commit sugerido: `refactor(ledger): guard the read side boundary in CI`

Después de esta fase: `/sync refactor-read-side-ports` — reconcilia los `.c4` de los cinco
módulos (componentes nuevos de C4 Nivel 3), appendea la sección "Decisiones de Diseño" de
`design.md` a `docs/decisions.md` y archiva el workspace en `work/done/`. **No** invoca
`/architecture`: `design.md` declara "Impacto en Arquitectura Global: No".
