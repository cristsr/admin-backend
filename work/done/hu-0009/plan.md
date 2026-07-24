# hu-0009: Andamiaje del adaptador HTTP — OpenAPI/versionado + patrón controller→bus — Plan de Implementación

**Historia:** `work/active/hu-0009/`
**Microservicio(s):** `apps/ledger`
**Objetivo:** Ajustar ACs a la realidad del código ya construido y verificar que
todas las suites de tests pasan en verde. Sin código nuevo — los artefactos ya
existen (swagger builder, main.ts con versionado, CommandAcceptedDto, wiring test).
**Arquitectura:** NestJS · hexagonal (ledger) · CQRS + event sourcing. El patrón
controller→bus y el kernel HTTP (SharedHttpModule, CommandResultInterceptor,
LedgerContextGuard) ya están implementados en `shared/infrastructure/adapters/http/`.
**Stack:** NestJS · TypeScript · TypeORM · PostgreSQL · Jest

### Trazabilidad AC → Tareas

| AC | Cubierto por |
|----|-------------|
| AC-1 | Tarea 2 (verificación main.ts) |
| AC-2 | Tarea 1 (ajuste ruta), Tarea 4 (suite swagger) |
| AC-3 | Tarea 4 (suite swagger) |
| AC-4 | Tarea 2 (verificación controller), Tarea 5 (wiring) |
| AC-5 | Tarea 1 (ajuste campos) |
| AC-6 | Tarea 5 (wiring test) |
| AC-7 | Tarea 5 (wiring test), Tarea 6 (suite completa) |
| RNF-10 | Tarea 2 (verificación controller) |
| RNF-11 | Tarea 1 (ajuste ubicación) |

---

### Tarea 0: Preparar rama de trabajo [X]

> Al ejecutar este plan, solicitar al usuario el nombre de la rama antes de continuar.

**Preguntar:** "¿Cuál es el nombre de la rama? (ej: feat/HU-0009-http-scaffold o fix/HU-0009-http-docs)"

**Steps:**

**Step 1: Verificar que la base esté fresca (read-only)**

```bash
git branch --show-current   # esperado: feat/core o rama de trabajo
```

**Step 2: Crear rama de trabajo**

```bash
git checkout -b <nombre-de-rama-dado-por-usuario>
```

Esperado: rama nueva creada y activa.

---

### Tarea 1: Corregir gaps de documentación en hu.md [X]

**Archivos:**
- Modificar: `work/active/hu-0009/hu.md`

**Step 1: Actualizar AC-2 — ruta de Swagger**

`/api/v1/docs` → `/api/docs`. Swagger no respeta el prefijo de versión URI.

**Step 2: Actualizar AC-5 — campos de CommandAcceptedDto**

`{ id, sequence, streamPosition }` → `{ id, streamPosition }`. `CommandResult` no expone `sequence`.

**Step 3: Actualizar RNF-11 — ubicación del código HTTP**

`shared-kernel/infrastructure/adapters/http` → `shared/infrastructure/adapters/http`.

---

### Tarea 2: Verificar AC-1 y AC-4 — main.ts y patrón controller existente [X]

**Archivos existentes verificados:**
- `apps/ledger/src/main.ts` — ya tiene `setGlobalPrefix('api')`, `enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })`, `maybeMountSwagger`
- `apps/ledger/src/accounts/infrastructure/adapters/http/accounts.controller.ts` — controller canónico (CommandBus + QueryBus, @Context, @ExternalRef, CommandResultInterceptor)

**Step 1: Leer main.ts y confirmar versionado + Swagger**

```bash
node -e "const fs=require('fs');const c=fs.readFileSync('apps/ledger/src/main.ts','utf8');console.assert(c.includes(\"setGlobalPrefix('api')\"),'Falta api prefix');console.assert(c.includes('VersioningType.URI'),'Falta URI versioning');console.assert(c.includes('maybeMountSwagger'),'Falta Swagger mount');console.log('OK: main.ts')"
```

**Step 2: Leer accounts.controller.ts y confirmar patrón controller→bus**

```bash
node -e "const fs=require('fs');const c=fs.readFileSync('apps/ledger/src/accounts/infrastructure/adapters/http/accounts.controller.ts','utf8');console.assert(c.includes('CommandBus'),'Falta CommandBus');console.assert(c.includes('QueryBus'),'Falta QueryBus');console.assert(c.includes('@Context()'),'Falta @Context');console.assert(c.includes('@ExternalRef()'),'Falta @ExternalRef');console.assert(c.includes('CommandResultInterceptor'),'Falta CommandResultInterceptor');console.log('OK: accounts.controller.ts')"
```

---

### Tarea 3: Verificar CommandAcceptedDto — campos correctos [X]

**Archivos:**
- Leer: `apps/ledger/src/shared/infrastructure/adapters/http/dto/command-accepted.dto.ts`

**Step 1: Confirmar que CommandAcceptedDto tiene { id, streamPosition }**

```bash
node -e "const fs=require('fs');const c=fs.readFileSync('apps/ledger/src/shared/infrastructure/adapters/http/dto/command-accepted.dto.ts','utf8');console.assert(c.includes('id: string')||c.includes('readonly id'),'Falta id');console.assert(c.includes('streamPosition')&&c.includes('string'),'Falta streamPosition');console.assert(!c.includes('sequence'),'No debe tener sequence');console.log('OK: CommandAcceptedDto')"
```

---

### Tarea 4: Correr suite de tests del swagger builder [X]

**Archivos:**
- Test: `apps/ledger/src/config/swagger/ledger-swagger.builder.spec.ts`

**Step 1: Ejecutar tests del swagger builder**

```bash
npx jest apps/ledger/src/config/swagger/ledger-swagger.builder.spec.ts --no-coverage
```

Esperado: PASS — 3 tests verdes:
- "declares the gatewayContext and bearerAuth security schemes"
- "defaults every endpoint to the gateway context requirement"
- "titles the contract as the Ledger API"

---

### Tarea 5: Correr wiring test [X]

**Archivos:**
- Test: `apps/ledger/src/app.wiring.spec.ts`

**Step 1: Ejecutar wiring test**

```bash
npx jest apps/ledger/src/app.wiring.spec.ts --no-coverage
```

Esperado: PASS — 2 tests verdes:
- "compiles the root module without a database connection"
- "boots the Nest application and closes it"

---

### Tarea 6: Correr suite completa de tests del ledger [X]

**Archivos:** Todos los `*.spec.ts` bajo `apps/ledger/src/`

**Step 1: Ejecutar suite completa**

```bash
npx jest apps/ledger/src/ --no-coverage
```

Esperado: PASS — todos los tests del ledger pasando.
