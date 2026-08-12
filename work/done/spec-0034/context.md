# context: spec-0034

## Historia resumida

**Deuda técnica:** Cerrar las validaciones pendientes de la documentación dejadas por
`spec-0033`. El gate actual (`tools/validate-diagrams.ts`) verifica diagrama → código
pero es unidireccional, no verifica fidelidad semántica de las 47 traducciones LikeC4→Mermaid,
no detecta código sin documentar, y tiene tres carpetas mapeadas N:1 a unidades por conveniencia.

## Componentes afectados

- `apps/ledger` — documentación (`docs/`) y código (`src/`) de 6 unidades
- `libs/shared` — recibe unidad de documentación propia (AC-4)
- `tools/` — validador y nuevo script de verificación de traducciones

---

## tools/ — Validador de diagramas

### Archivo principal
`tools/validate-diagrams.ts`

### Estructura actual
- `UNITS` (línea 18): mapa de 6 unidades de documentación → raíces de código
- `SHARED_ROOTS` (línea 37): `libs/cqrs/src`, `libs/shared/src`, `apps/ledger/src/shared`
- `collectSymbols` (línea 73): recolecta todos los `export` de cada raíz con regex `DECLARATION`
- `validateFile` (línea 122): extrae identificadores de bloques Mermaid y verifica contra `symbols`
- `main` (línea 147): itera unidades, valida, y sale con `process.exit(1)` si hay fallos
- Dirección actual: **diagrama → código** solamente

### Tests
`tools/validate-diagrams.spec.ts` — tests existentes del gate forward; el plan debe extenderlos
con tests negativos para las 3 clases de error de AC-5.

### Mapa UNITS actual
```
apps/ledger/docs/accounts       → apps/ledger/src/accounts, apps/ledger/src/ledger
apps/ledger/docs/reconciliation → apps/ledger/src/reconciliation
apps/ledger/docs/reference      → apps/ledger/src/reference
apps/ledger/docs/shared         → apps/ledger/src/shared, apps/ledger/src/config, apps/ledger/src/tooling
apps/ledger/docs/transactions   → apps/ledger/src/transactions
libs/cqrs/docs                  → libs/cqrs/src
```

### Mapa UNITS deseado (tras spec-0034)
```
apps/ledger/docs/accounts       → apps/ledger/src/accounts
apps/ledger/docs/ledger         → apps/ledger/src/ledger          ← nuevo
apps/ledger/docs/reconciliation → apps/ledger/src/reconciliation
apps/ledger/docs/reference      → apps/ledger/src/reference
apps/ledger/docs/shared         → apps/ledger/src/shared, apps/ledger/src/config, apps/ledger/src/tooling
apps/ledger/docs/transactions   → apps/ledger/src/transactions
libs/cqrs/docs                  → libs/cqrs/src
libs/shared/docs                → libs/shared/src                  ← nuevo
```

---

## apps/ledger/src/ledger/ — Módulo que recibe unidad propia

### Estructura
```
apps/ledger/src/ledger/
├── application/
│   ├── ports/
│   │   └── ledger-settings-finder.port.ts     — LedgerSettingsFinder (abstract class)
│   ├── usecases/
│   │   ├── get-ledger-settings/
│   │   │   ├── get-ledger-settings.handler.ts  — GetLedgerSettingsHandler (query)
│   │   │   └── get-ledger-settings.query.ts
│   │   ├── initialize-ledger/
│   │   │   ├── initialize-ledger.handler.ts    — InitializeLedgerHandler (command)
│   │   │   └── initialize-ledger.command.ts
│   │   └── replace-ledger-settings/
│   │       ├── replace-ledger-settings.handler.ts — ReplaceLedgerSettingsHandler (command)
│   │       └── replace-ledger-settings.command.ts
│   └── views/
│       └── ledger-settings.view.ts             — LedgerSettingsView (interface)
├── domain/
│   └── settings/
│       ├── ledger-settings.aggregate.ts        — LedgerSettings (aggregate)
│       └── events/                              — LedgerInitialized, PresentationCurrencyChanged, TimezoneChanged
└── infrastructure/
    ├── adapters/
    │   ├── http/
    │   │   ├── ledger.controller.ts            — LedgerController (GET/POST/PUT /ledger/*)
    │   │   ├── ledger-http.module.ts           — LedgerHttpModule
    │   │   └── dto/
    │   └── persistence/
    │       └── read-model-ledger-settings-finder.ts
    └── projections/
        ├── ledger-settings.projector.ts         — LedgerSettingsProjector
        └── ledger-settings.schema.ts
```

### Símbolos "documentables" (handlers, controllers, projectors)
| Archivo | Símbolo | Tipo |
|---|---|---|
| `get-ledger-settings.handler.ts` | `GetLedgerSettingsHandler` | handler |
| `initialize-ledger.handler.ts` | `InitializeLedgerHandler` | handler |
| `replace-ledger-settings.handler.ts` | `ReplaceLedgerSettingsHandler` | handler |
| `ledger.controller.ts` | `LedgerController` | controller |
| `ledger-settings.projector.ts` | `LedgerSettingsProjector` | projector |

### Flujos actuales (hoy en `docs/accounts/flows/`)
| Archivo | Handler documentado |
|---|---|
| `get-ledger-settings.md` | `GetLedgerSettingsHandler` |
| `initialize-ledger.md` | `InitializeLedgerHandler` |
| `replace-ledger-settings.md` | `ReplaceLedgerSettingsHandler` |

Estos 3 flujos se migran a `apps/ledger/docs/ledger/flows/`.

---

## libs/shared/src/ — Librería que recibe unidad de documentación

### Estructura de exportaciones
```
libs/shared/src/
├── index.ts                                    — barrel principal
├── auth/                                       — JwtStrategy, guards, resolvers
├── config/                                     — configuración
├── constants/                                  — constantes compartidas
├── criteria/                                   — Criteria, filtros, excepciones
├── database/                                   — utilidades de BD
├── decorators/                                 — MoneyColumn, etc.
├── entities/                                   — entidades base
├── exceptions/                                 — DomainException, BaseException, jerarquía
├── filters/                                    — ExceptionFilter (global)
├── functions/                                  — canonicalJson, sha256Hex
├── interceptors/                               — interceptores HTTP
├── modules/                                    — módulos NestJS compartidos
├── persistence/                                — utilidades de persistencia
├── telemetry/                                  — logging/tracing
└── types/                                      — Nullable<T>, ObjectLiteral, etc.
```

### Símbolos más referenciados desde diagramas de otras unidades
| Símbolo | Archivo | Tipo |
|---|---|---|
| `canonicalJson` | `functions/canonical-hash.ts` | function |
| `sha256Hex` | `functions/canonical-hash.ts` | function |
| `DomainException` | `exceptions/domain.exception.ts` | abstract class |
| `ExceptionFilter` | `filters/exception.filter.ts` | class |
| `Money` | (dos versiones: `apps/finances` y `apps/ledger`) | class |

### Sin handlers, controllers ni projectors
`libs/shared` no contiene `*.handler.ts`, `*.controller.ts` ni `*.projector.ts`. Es una
librería de utilidades transversales. Su diagrama de componentes (`README.md` con `flowchart`)
documentará su estructura y los símbolos que otras unidades nombran, pero el gate inverso
(AC-2) no le exigirá símbolos documentables ya que no tiene handlers/controllers/projectors.

### Documentación actual
- `libs/shared/README.md` — existe, describe la librería en prosa, sin diagrama Mermaid
- `libs/shared/docs/` — no existe

---

## apps/ledger/docs/ — Unidades de documentación existentes

### accounts
- `README.md`: diagrama de componentes (C4 L3)
- `api.yaml`: contrato OpenAPI del módulo
- `flows/`: 10 flujos (7 de accounts + 3 de ledger que se migran a la nueva unidad)

### reconciliation
- `README.md`: diagrama de componentes
- `api.yaml`: contrato OpenAPI
- `flows/`: 8 flujos

### reference
- `README.md`: diagrama de componentes
- `api.yaml`: contrato OpenAPI
- `flows/`: 2 flujos

### shared
- `README.md`: diagrama de componentes de la superficie transversal del ledger
- `api.yaml`: contrato OpenAPI
- `flows/`: 9 flujos — cubren el kernel HTTP (`apps/ledger/src/shared`), bootstrap Swagger
  (`apps/ledger/src/config`) y verificadores CLI (`apps/ledger/src/tooling`). El README debe
  documentar por qué `src/config` y `src/tooling` se documentan acá.

### transactions
- `README.md`: diagrama de componentes
- `api.yaml`: contrato OpenAPI
- `flows/`: 11 flujos

---

## libs/cqrs/docs/ — Unidad de documentación de referencia

- `flows/`: 3 flujos (`event-store-append.md`, `rebuild-all.md`, `rebuild-projection.md`)
- **Sin `README.md`** — no tiene diagrama de componentes (C4 L3). El README a nivel de lib
  (`libs/cqrs/README.md`) existe pero no cumple la convención de `<unidad>/README.md`.

---

## Gaps detectados

1. **`libs/cqrs/docs/README.md` no existe.** La convención (`docs-as-code-mermaid.md`) exige
   un `flowchart` de componentes en el README de cada unidad. `libs/cqrs/docs/` tiene flows
   pero no tiene diagrama de componentes. Esto es un gap preexistente que no bloquea este ítem
   pero que el gate forward actual no detecta porque no verifica la existencia del README.

2. **`libs/shared/docs/` no existe.** AC-4 la crea dentro de este ítem. El `README.md`
   inicial debe incluir el diagrama de componentes (`flowchart`) con los símbolos que otras
   unidades nombran (`canonicalJson`, `sha256Hex`, `DomainException`, `ExceptionFilter`).

3. **3 flujos de ledger viven en `docs/accounts/flows/`.** `get-ledger-settings.md`,
   `initialize-ledger.md` y `replace-ledger-settings.md` documentan handlers de
   `src/ledger/` pero están en la unidad de accounts. AC-3 los migra a
   `apps/ledger/docs/ledger/flows/`.

4. **`docs/shared/README.md` no justifica el mapeo N:1.** El comentario en el `UNITS` del
   validador dice que `shared` documenta `src/shared`, `src/config` y `src/tooling`, pero
   esa justificación no está en la documentación misma — solo en el código del validador.
   AC-3 pide que se documente en el README de la unidad.

5. **`tools/` no tiene `tsconfig.json` propio para el nuevo script.** El script de
   verificación de traducciones (`tools/verify-c4-translations.ts`) necesitará compilación.
   `tools/tsconfig.tools.json` ya existe y cubre `validate-diagrams.ts`; el nuevo script se
   agrega a la misma configuración.

6. **Los `.c4` originales están en 4 commits de una rama ya mergeada.** Recuperarlos requiere
   `git show <commit>:<path>` o `git checkout <commit> -- <path>`. El script de AC-1 debe
   documentar los commits exactos: `8c550bc`, `ebb2b1e`, `9e7fd3a`, `7172c28` de la rama
   `docs/SPEC-0033-mermaid-diagrams`.

7. **Sin precedente de verificación semántica de traducciones.** El repo no tiene otro script
   que compare dos formatos de documentación. El diseño de `verify-c4-translations.ts` es
   greenfield dentro del pattern de `tools/` como scripts Node CLI que salen con exit code.
