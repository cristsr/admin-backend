# hu-0010: Contexto autenticado externo (RF-26) — Plan de Implementación

**Historia:** `work/active/hu-0010/`
**Microservicio(s):** `apps/ledger`
**Objetivo:** Formalizar el contexto autenticado (RF-26): e2e test de 401, ajuste de paths en hu.md, y verificación de specs existentes.
**Arquitectura:** NestJS · hexagonal · CQRS + event sourcing. El guard global (`LedgerContextGuard`, APP_GUARD), el resolver (`GatewayHeaderContextResolver`), el decorador (`@Context()`), la policy (`AuthenticatedContextPolicy`) y el binding en `SharedHttpModule` ya están implementados. La HU agrega el test e2e pendiente (AC-8) y ajusta paths documentales.
**Stack:** NestJS · TypeScript · Jest

### Trazabilidad AC → Tareas

| AC | Cubierto por |
|----|-------------|
| AC-1 | Tarea 2 (e2e test: 401 sin x-user-id), Tarea 3 (guard spec existente) |
| AC-2 | Tarea 2 (e2e test: 401 sin x-client-id), Tarea 3 (guard spec existente) |
| AC-3 | Tarea 2 (e2e: contexto adjuntado), Tarea 3 (resolver spec) |
| AC-4 | Tarea 3 (controller specs existentes usan @Context) |
| AC-5 | Tarea 3 (guard spec testea @Public bypass) |
| AC-6 | Tarea 2 (e2e verifica clientId en AuthContext) |
| AC-7 | Tarea 3 (SharedHttpModule binding verificado por wiring test) |
| AC-8 | Tarea 2 (e2e test creado: POST /api/v1/accounts sin headers → 401) |

---

### Tarea 0: Preparar rama de trabajo

> Ya en `feat/core` — sin cambios de rama necesarios.

---

### Tarea 1: Ajustar paths en hu.md [X]

**Archivos:**
- Modificar: `work/active/hu-0010/hu.md`

**Step 1: Corregir paths de "artefactos a crear"**

Reemplazar `shared-kernel/infrastructure/adapters/http/` → `shared/infrastructure/adapters/http/` en todos los paths listados en la sección Technical Context, ya que el código real vive en `shared/`, no en `shared-kernel/`.

---

### Tarea 2: E2e test — AC-8 (401 sin contexto) [X]

**Archivos:**
- Crear: `apps/ledger/src/shared/infrastructure/adapters/http/ledger-context.e2e-spec.ts`

**Step 1: Escribir el test e2e**

El test levanta un módulo mínimo con `LedgerContextGuard` + `GatewayHeaderContextResolver` + un controller dummy y verifica:

- `POST /api/v1/accounts` sin header `x-user-id` → 401
- `POST /api/v1/accounts` sin header `x-client-id` → 401
- `POST /api/v1/accounts` con ambos headers → 201 (pasa el guard)
- Endpoint `@Public()` → 200 sin headers

Usar `@nestjs/testing` (`Test.createTestingModule`) con `supertest`, similar al patrón de `accounts-api.e2e-spec.ts` pero con buses mockeados y sin dependencia de `DataSource`/`PostgresReadModelStore`.

**Step 2: Ejecutar y confirmar que falla**

```bash
npx jest apps/ledger/src/shared/infrastructure/adapters/http/ledger-context.e2e-spec.ts --no-coverage
```

Esperado: FAIL hasta que se implemente (si falta código) o PASS si el setup ya funciona.

**Step 3: Ajustar hasta que pase**

Si el test requiere ajustes (ej. módulo de testing que necesita providers adicionales), iterar hasta verde.

**Step 4: Confirmar verde**

```bash
npx jest apps/ledger/src/shared/infrastructure/adapters/http/ledger-context.e2e-spec.ts --no-coverage
```

Esperado: PASS — 4 tests verdes.

---

### Tarea 3: Verificar specs existentes [X]

**Archivos:**
- `apps/ledger/src/shared/infrastructure/adapters/http/ledger-context.guard.spec.ts`
- `apps/ledger/src/shared/infrastructure/adapters/http/resolvers/gateway-header-context.resolver.spec.ts`
- `apps/ledger/src/shared/infrastructure/adapters/http/command-result.interceptor.spec.ts`
- `apps/ledger/src/shared/infrastructure/adapters/http/external-ref.decorator.spec.ts`
- `apps/ledger/src/shared-kernel/application/command-bus/policies/authenticated-context.policy.spec.ts`

**Step 1: Ejecutar todos los specs de auth**

```bash
npx jest apps/ledger/src/shared/infrastructure/adapters/http/ledger-context.guard.spec.ts apps/ledger/src/shared/infrastructure/adapters/http/resolvers/gateway-header-context.resolver.spec.ts apps/ledger/src/shared/infrastructure/adapters/http/command-result.interceptor.spec.ts apps/ledger/src/shared/infrastructure/adapters/http/external-ref.decorator.spec.ts apps/ledger/src/shared-kernel/application/command-bus/policies/authenticated-context.policy.spec.ts --no-coverage
```

Esperado: PASS — todos verdes (12 tests: 3 + 5 + 4 + 4 + 4 = 20 tests entre los 5 specs).

---

### Tarea 4: Correr wiring test + suite swagger [X]

**Step 1: Wiring test**

```bash
npx jest apps/ledger/src/app.wiring.spec.ts --no-coverage
```

Esperado: PASS — 2/2.

**Step 2: Swagger builder**

```bash
npx jest apps/ledger/src/config/swagger/ledger-swagger.builder.spec.ts --no-coverage
```

Esperado: PASS — 3/3.

---

### Tarea 5: Correr suite completa [X]

```bash
npx jest apps/ledger/src/ --no-coverage
```

Esperado: todos los tests del ledger pasando (salvo los 6 failures pre-existentes de hu-0009: settings sin portar + e2e sin DataSource).
