# hu-0011: Códigos de error de dominio estables (RF-14) — Plan de Implementación

**Historia:** `work/active/hu-0011/`
**Componente(s):** `ledger` (app — módulos `shared`, `settings`, `reconciliation`)
**Objetivo:** Extender el contrato RF-14 con 6 códigos nuevos (settings + Money) y la fila faltante de `LEDGER_NOT_INITIALIZED`, congelándolos en el contract test tabular.
**Arquitectura:** Reuso total de la plataforma existente (`ExceptionFilter` de `@shared`, jerarquía `DomainException`, const `LEDGER_ERROR_CODE`). Cero componentes nuevos: se reclasifican 2 excepciones de settings dentro de `DomainException`, se agregan 4 `code` propios a las excepciones de Money y 6 entradas al const. TDD estricto (Art. 4): el mapping-spec crece primero (rojo) y la implementación lo pone en verde.
**Stack:** NestJS · TypeScript · Jest (sin TypeORM ni migraciones — no hay modelo de datos)

### Trazabilidad AC → Tareas

| AC | Cubierto por |
|----|-------------|
| AC-1 (filter global registrado) | Pre-satisfecho (`main.ts:40`); guardado por Tarea 1 (el contract test ejercita el `ExceptionFilter` real de `@shared`) |
| AC-2 (mapeo estable código → HTTP) | Tarea 1 (filas rojas) + Tareas 2, 3, 4 (verde) |
| AC-3 (excepciones de puerto en la jerarquía) | Pre-satisfecho; las filas `CONCURRENCY_CONFLICT`/`DUPLICATE_EXTERNAL_REF` ya existen y Tarea 1/Tarea 5 las mantienen verdes |
| AC-4 (fuente única `LEDGER_ERROR_CODE`) | Tarea 2 (extiende el const) + Tarea 1 (el spec lo referencia — drift rompe compilación/test) |
| AC-5 (contract test tabular) | Tarea 1 (7 filas nuevas) + Tarea 5 (suite completa) |
| AC-6 (error desconocido → 500 sin `code`) | Pre-satisfecho (caso existente en el spec); Tarea 5 lo corre en la suite completa |
| AC-7 (idempotencia vs colisión real) | Sin código en esta HU — la fila `DUPLICATE_EXTERNAL_REF` (existente) congela el 409 del caso patológico; Tarea 1 la mantiene verde |

---

### Tarea 0: Verificar rama de trabajo [X]

> Este plan corre dentro de `/forge` (autónomo): **no se crea rama nueva** — el
> esfuerzo del ledger se construye sobre la rama de trabajo `feat/core`, y el
> preflight de forge ya verificó que no estamos en la rama base.

**Step 1: Verificar rama activa (read-only)**

```bash
git branch --show-current
```
Esperado: `feat/core` (rama de trabajo, no `develop`/`main`/`master`).

---

### Tarea 1: Filas nuevas del contract test tabular (ROJO) [X]

**Archivos:**
- Modificar: `apps/ledger/src/shared/domain/errors/ledger-error-code-mapping.spec.ts`
- Test: el mismo archivo (es un spec)

**Step 1: Agregar los imports de las excepciones nuevas**

En `apps/ledger/src/shared/domain/errors/ledger-error-code-mapping.spec.ts`, agregar
junto a los imports existentes:

```typescript
import { LedgerNotInitializedException } from '@ledger/reconciliation/domain/balance-assertion/exceptions/balance-assertion.exception';
import {
  InvalidCurrencyCodeException as SettingsInvalidCurrencyCodeException,
  InvalidTimeZoneException,
} from '@ledger/settings/domain/ledger-settings/exceptions/settings.exception';
import {
  CurrencyMismatchException,
  InvalidCurrencyException,
  InvalidMoneyException,
  MoneyScaleException,
} from '@ledger/shared/domain/money/money.exception';
```

> El alias `SettingsInvalidCurrencyCodeException` evita la colisión de nombre con la
> `InvalidCurrencyCodeException` del shared-kernel (riesgo anotado en `design.md`).

**Step 2: Agregar las 7 filas a la tabla `cases`**

Al final del array `cases` (después de la fila `TransactionNotFoundException`):

```typescript
    [new LedgerNotInitializedException('not initialized'), HttpStatus.UNPROCESSABLE_ENTITY, LEDGER_ERROR_CODE.LEDGER_NOT_INITIALIZED],
    [new SettingsInvalidCurrencyCodeException('XX'), HttpStatus.UNPROCESSABLE_ENTITY, LEDGER_ERROR_CODE.INVALID_CURRENCY_CODE],
    [new InvalidTimeZoneException('Bogota'), HttpStatus.UNPROCESSABLE_ENTITY, LEDGER_ERROR_CODE.INVALID_TIME_ZONE],
    [new InvalidMoneyException('not a decimal'), HttpStatus.UNPROCESSABLE_ENTITY, LEDGER_ERROR_CODE.INVALID_MONEY],
    [new CurrencyMismatchException('USD vs COP'), HttpStatus.UNPROCESSABLE_ENTITY, LEDGER_ERROR_CODE.CURRENCY_MISMATCH],
    [new MoneyScaleException('too many decimals'), HttpStatus.UNPROCESSABLE_ENTITY, LEDGER_ERROR_CODE.MONEY_SCALE],
    [new InvalidCurrencyException('blank code'), HttpStatus.UNPROCESSABLE_ENTITY, LEDGER_ERROR_CODE.INVALID_CURRENCY],
```

**Step 3: Ejecutar y confirmar que falla**

```bash
npx nx test ledger --testPathPattern=ledger-error-code-mapping
```
Esperado: FAIL — error de compilación TypeScript: `LEDGER_ERROR_CODE` no tiene las
propiedades `INVALID_CURRENCY_CODE`, `INVALID_TIME_ZONE`, `INVALID_MONEY`,
`CURRENCY_MISMATCH`, `MONEY_SCALE`, `INVALID_CURRENCY` (el const se extiende en la
Tarea 2).

---

### Tarea 2: Extender `LEDGER_ERROR_CODE` con los 6 códigos nuevos (VERDE parcial) [X]

**Archivos:**
- Modificar: `apps/ledger/src/shared/domain/errors/ledger-error-code.ts`
- Test: `apps/ledger/src/shared/domain/errors/ledger-error-code-mapping.spec.ts` (Tarea 1)

**Step 1: Agregar las 6 entradas al const**

En `apps/ledger/src/shared/domain/errors/ledger-error-code.ts`, al final del objeto
(después de `LEDGER_NOT_INITIALIZED`):

```typescript
  INVALID_CURRENCY_CODE: 'INVALID_CURRENCY_CODE',
  INVALID_TIME_ZONE: 'INVALID_TIME_ZONE',
  INVALID_MONEY: 'INVALID_MONEY',
  CURRENCY_MISMATCH: 'CURRENCY_MISMATCH',
  MONEY_SCALE: 'MONEY_SCALE',
  INVALID_CURRENCY: 'INVALID_CURRENCY',
```

**Step 2: Ejecutar y confirmar el estado intermedio**

```bash
npx nx test ledger --testPathPattern=ledger-error-code-mapping
```
Esperado: FAIL — ahora compila y la fila `LEDGER_NOT_INITIALIZED` pasa, pero:
- Las 4 filas de Money fallan: las excepciones heredan `code = 'UNPROCESSABLE_ENTITY'`
  (genérico) en vez de su code propio (Tarea 3).
- Las 2 filas de settings fallan: sus excepciones extienden `Error` crudo → el filter
  responde 500 sin `code` (Tarea 4).

---

### Tarea 3: Códigos estables en las excepciones de Money (VERDE parcial) [X]

**Archivos:**
- Modificar: `apps/ledger/src/shared/domain/money/money.exception.ts`
- Test: `apps/ledger/src/shared/domain/errors/ledger-error-code-mapping.spec.ts` (Tarea 1)

**Step 1: Agregar `readonly code` a las 4 excepciones**

Reescribir `apps/ledger/src/shared/domain/money/money.exception.ts` completo:

```typescript
import { DomainUnprocessableException } from '@shared';

/** The amount literal is not a valid decimal string — or a `number` slipped in (INV-8). */
export class InvalidMoneyException extends DomainUnprocessableException {
  readonly code: string = 'INVALID_MONEY';
}

/** Two monies were combined without sharing a currency. */
export class CurrencyMismatchException extends DomainUnprocessableException {
  readonly code: string = 'CURRENCY_MISMATCH';
}

/** The amount's scale exceeds the currency's minor units (spec §2.7.1). */
export class MoneyScaleException extends DomainUnprocessableException {
  readonly code: string = 'MONEY_SCALE';
}

/** The currency code is blank or its minor units are not a non-negative integer. */
export class InvalidCurrencyException extends DomainUnprocessableException {
  readonly code: string = 'INVALID_CURRENCY';
}
```

**Step 2: Ejecutar y confirmar el estado intermedio**

```bash
npx nx test ledger --testPathPattern=ledger-error-code-mapping
```
Esperado: FAIL — las 4 filas de Money pasan; solo fallan las 2 filas de settings
(Tarea 4).

**Step 3: Verificar que los specs existentes de Money siguen verdes**

```bash
npx nx test ledger --testPathPattern=shared/domain/money
```
Esperado: PASS — `money.spec.ts` y `currency.spec.ts` no se tocan: las clases y los
mensajes no cambian, solo ganan `code`.

---

### Tarea 4: Reclasificar las excepciones de settings dentro de `DomainException` (VERDE total) [X]

**Archivos:**
- Modificar: `apps/ledger/src/settings/domain/ledger-settings/exceptions/settings.exception.ts`
- Test: `apps/ledger/src/shared/domain/errors/ledger-error-code-mapping.spec.ts` (Tarea 1)

**Step 1: Reescribir las 2 excepciones**

Reescribir `apps/ledger/src/settings/domain/ledger-settings/exceptions/settings.exception.ts`
completo:

```typescript
import { DomainUnprocessableException } from '@shared';

/** Exception raised when an invalid currency code is provided. */
export class InvalidCurrencyCodeException extends DomainUnprocessableException {
  readonly code: string = 'INVALID_CURRENCY_CODE';

  constructor(code: string) {
    super(`Invalid currency code: ${code}`);
  }
}

/** Exception raised when an invalid IANA timezone is provided. */
export class InvalidTimeZoneException extends DomainUnprocessableException {
  readonly code: string = 'INVALID_TIME_ZONE';

  constructor(timezone: string) {
    super(`Invalid IANA timezone: ${timezone}`);
  }
}
```

> `BaseException` auto-asigna `this.name = this.constructor.name` — el `this.name = ...`
> manual de la versión vieja se elimina. Los constructores conservan la firma actual
> `(code: string)` / `(timezone: string)` → los VOs que los lanzan no se tocan.

**Step 2: Ejecutar y confirmar que el contract test pasa completo**

```bash
npx nx test ledger --testPathPattern=ledger-error-code-mapping
```
Esperado: PASS — las 17 filas del mapeo + el caso de error desconocido (500 sin `code`).

**Step 3: Verificar que los specs de settings siguen verdes**

```bash
npx nx test ledger --testPathPattern=settings
```
Esperado: PASS — `currency-code.vo.spec.ts` e `iana-timezone.vo.spec.ts` usan
`toThrow(<clase>)` con las mismas clases y mismos mensajes.

---

### Tarea 5: Suite completa del ledger [X]

> Resultado: los tests de esta HU están en verde (mapping-spec 18/18, Money 15/15,
> VOs settings 18/18). La suite completa tiene **6 suites fallando de forma
> PRE-EXISTENTE** (verificado con `git stash` de los 4 archivos de la HU — fallan
> igual sin mis cambios): 4 suites de `settings` (errores TS en
> `get-ledger-settings.handler.ts`, API de `Criteria`) y 2 e2e
> (`accounts-api`/`transactions-api`: DI de `DataSource` en `PostgresReadModelStore`).
> Proviene del trabajo en vuelo de otras historias activas en esta rama, no de hu-0011.

```bash
npx nx test ledger
```
Esperado: PASS — todos los tests del ledger pasando (incluye mapping-spec, specs de
Money/settings/VOs, wiring y e2e que montan el filter global).

