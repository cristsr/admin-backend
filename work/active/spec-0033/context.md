# context: spec-0033

## Ítem resumido

**Tipo:** `debt`
**Situación actual:** la documentación estructural vive en 7 archivos LikeC4 (1553
líneas, 47 `dynamic view`) que nadie puede ver sin levantar un dev server, con el nivel
L1/L2 duplicado entre `landscape.c4` y los `.md` de `docs/architecture/`.
**Estado deseado:** diagramas Mermaid inline, renderizables en GitHub y VS Code sin
instalar nada, una fuente de verdad por nivel C4, cero rastro de LikeC4, y el gate de CI
conservado sobre un script propio.

> Este ítem no toca `apps/ledger/src/`. El terreno relevante es el **corpus documental**
> y el **tooling del pipeline**, no entidades ni casos de uso. El inventario se organiza
> por eso.

## Componentes afectados

- `apps/ledger` — 45 archivos `.md` + 6 `.c4` bajo `apps/ledger/docs/`
- `docs/architecture/` — nivel C4 L1+L2
- **Raíz del repo** — `package.json`, `likec4.config.json`, `.github/workflows/ci.yml`, `tools/`
- `~/.agents/` — **fuera del repositorio**, versionado aparte (AC-7)

⚠ **Base no fresca:** el relevamiento se hizo sobre `feat/core`, no sobre `develop`
(`BASE_BRANCH`), con 24 archivos sin commitear (residuo de hu-0026). Si el estado cambió,
correr `/prepare` y refrescar con `/scan spec-0033`.

---

## apps/ledger — corpus documental

### Archivos LikeC4 a eliminar (6 de módulo + 1 de arquitectura)

| Archivo | Líneas | Componentes | `dynamic view` |
|---|---|---|---|
| `apps/ledger/docs/shared/shared.c4` | 323 | 19 | 7 |
| `apps/ledger/docs/reconciliation/reconciliation.c4` | 288 | 19 | 9 |
| `apps/ledger/docs/shared-kernel/shared-kernel.c4` | 288 | 22 | 8 |
| `apps/ledger/docs/transactions/transactions.c4` | 261 | 21 | 11 |
| `apps/ledger/docs/accounts/accounts.c4` | 209 | 14 | 10 |
| `apps/ledger/docs/reference/reference.c4` | 96 | 6 | 2 |
| `docs/architecture/landscape.c4` | 88 | 3 (L3 filtrados) | 0 |
| **Total** | **1553** | **104** | **47** |

Los 6 `.c4` de módulo abren con `extend admin.ledger.<module>` sobre los nodos que
declara `landscape.c4` — de ahí el gotcha de resolución de FQN que `/design` documenta.

### Estructura de `apps/ledger/docs/<module>/`

| Módulo | `README.md` | `flows/` | Otros artefactos |
|---|---|---|---|
| `accounts` | ✅ | 9 | — |
| `reconciliation` | ✅ | 9 | — |
| `reference` | ✅ | 2 | — |
| `shared` | ✅ | 5 | — |
| `transactions` | ✅ | 10 | — |
| `shared-kernel` | ❌ | 5 | `component.md`, `diagram.md` (residuo pre-LikeC4) |

**Total actual: 40 flows.** Tras AC-1 son 44.

> ⚠ **`shared-kernel` no es un módulo del ledger.** Su código se extrajo a `libs/cqrs` el
> 2026-07-27 (`libs/cqrs/README.md`: *«Extracted from `apps/ledger/src/shared-kernel`»*), y
> `apps/ledger/src/shared-kernel/` **no existe**. La carpeta de docs quedó huérfana, en
> paralelo al `README.md` que la lib ya tiene. AC-2 la mueve a `libs/cqrs/docs/`. El ledger
> tiene **5 módulos**, no 6.

### Unidades de documentación tras la corrección de AC-2

| Unidad | Documentación | Código | `README.md` |
|---|---|---|---|
| `accounts` | `apps/ledger/docs/accounts/` | `apps/ledger/src/accounts/` | ✅ existe |
| `reconciliation` | `apps/ledger/docs/reconciliation/` | `apps/ledger/src/reconciliation/` | ✅ existe |
| `reference` | `apps/ledger/docs/reference/` | `apps/ledger/src/reference/` | ✅ existe |
| `shared` | `apps/ledger/docs/shared/` | `apps/ledger/src/shared/` | ✅ existe |
| `transactions` | `apps/ledger/docs/transactions/` | `apps/ledger/src/transactions/` | ✅ existe |
| `cqrs` | `libs/cqrs/docs/` **(nueva)** | `libs/cqrs/src/` | ✅ existe |

Ningún `README.md` se crea de cero: los 6 ya existen. `libs/shared` también tiene el suyo,
pero no recibe `docs/` en esta historia — entra al gate solo como raíz compartida.

### Anatomía de un `flows/*.md`

Frontmatter (ejemplo de `transactions/flows/reverse-transaction.md`):

```yaml
use_case: reverse-transaction
module: transactions
trigger: rest
entrypoint: POST /transactions/{id}/reverse
command: ReverseConfirmedTransactionCommand
view: reverseTransaction        # ← única clave que AC-1 elimina
invariants: [AC-1, AC-2, ..., INV-6, INV-7]
introduced_by: hu-0014
last_modified_by: hu-0026
status: active
```

Cuerpo: prosa del caso de uso → `## Reglas` → `## Errores` (tabla
Condición · Excepción · code · HTTP) → `## Respuesta`. El diagrama **no** está: hay una
línea `**Diagrama:** dynamic view \`X\` en [\`../<module>.c4\`](...)` que AC-1 reemplaza
por el bloque Mermaid inline.

### Mapeo de las 47 `dynamic view` → 40 flows

40 vistas tienen flow homónimo vía la clave `view:`. Las **7 huérfanas**, ya clasificadas
y con destino asignado en AC-1:

| Vista | Módulo | Naturaleza | ¿Código existe? |
|---|---|---|---|
| `recordOpeningBalance` | accounts | caso de uso REST | ✅ `accounts/application/usecases/record-opening-balance/` |
| `mergeTransfers` | transactions | caso de uso REST | ✅ `transactions/application/usecases/merge-transfers/` |
| `shared_http_dry_run` | shared | política transversal | ✅ `DryRunPolicy` (hu-0025) |
| `shared_http_retry_deadlock` | shared | política transversal | ✅ `RetryPolicy` (hu-0025) |
| `shared_kernel_auth_context_policy` | shared-kernel | política transversal | ✅ `AuthenticatedContextPolicy` (hu-0005) |
| `shared_kernel_read_model_upsert` | shared-kernel | mecánica de adaptador | ✅ `PostgresReadModelStore.upsert` |
| `shared_kernel_contract_test` | shared-kernel | contract test | ✅ `postgres-read-model-store.spec.ts` |

### Precedentes de Mermaid ya en el repo

Cuatro archivos ya usan Mermaid. Son la base de las convenciones de AC-2 y AC-5:

| Archivo | Tipo | Sintaxis | Rol para este ítem |
|---|---|---|---|
| `apps/ledger/docs/shared-kernel/component.md` | componentes | `graph TD` + subgraphs `domain`/`application`/`infrastructure` | **precedente de AC-2** — nodos `ES_PORT("EventStore<br/>abstract class")` |
| `apps/ledger/docs/shared-kernel/diagram.md` | secuencia | `sequenceDiagram` | **precedente de AC-5** — `participant CB as PolicyCommandBus` |
| `docs/architecture/context.md` | C4 L1 | `graph TB` (legado) | destino de AC-3; se normaliza a `flowchart` |
| `docs/architecture/containers.md` | C4 L2 | `graph TB` (legado) | destino de AC-3; se normaliza a `flowchart` |

**Convención de AC-5 tal como el repo ya la practica:** el alias es corto y arbitrario
(`CB`, `ACP`, `IP`), el nombre visible tras `as` es la clase exacta. Participantes no-código
observados: `actor Client`.

---

## Tooling del pipeline

### `package.json`

```json
"docs:validate": "likec4 validate --no-layout",
"docs:preview":  "likec4 start",
"docs:export":   "likec4 export png -o docs/.likec4-export"
```

Dependencia: `"likec4": "^1.59.2"` (línea 100, en `devDependencies`).

### `likec4.config.json` (raíz)

```json
{
  "name": "admin-back",
  "title": "admin-back — modelo C4",
  "exclude": ["**/node_modules/**", "**/dist/**", "**/coverage/**", "**/work/done/**"]
}
```

> `**/work/done/**` ya está excluido — es la fuente de nivel 3 que determina congelar los
> 10 `model.delta.c4` archivados (AC-4).

### `.github/workflows/ci.yml` — job `docs`

```yaml
docs:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
      with: { fetch-depth: 0 }      # oasdiff compara contra la rama base
    - uses: actions/setup-node@v4
      with: { node-version: 22, cache: npm }
    - name: Install dependencies
      run: npm ci
    - name: Validate LikeC4 model
      run: npm run docs:validate     # ← el paso que AC-5 reemplaza
    # … oasdiff sobre cada api.yaml, con continue-on-error (informativo)
```

El job se conserva entero: solo cambia el comando del paso de validación.

### `tools/`

Contiene únicamente `tsconfig.tools.json`. Es la carpeta de tooling del workspace Nx y
el destino elegido para `tools/validate-diagrams.mjs` (AC-5).

### `.agents/profile.md` — claves que AC-6 toca

`DIAGRAM_FORMAT` (§7), `DOCS_MODEL`, `DOCS_LANDSCAPE_MODEL`, `DOCS_MODULE_MODEL`,
`DESIGN_OUTPUT_MODE`, `SYNC_MODE` (§8), `MODEL_VALIDATE_CMD` (§10).
`API_CONTRACT_MODE: delta` y `TRIGGER_TAXONOMY` **no cambian**.

---

## Superficie de cambio medida

| Qué | Cantidad |
|---|---|
| `.md` bajo `apps/ledger/docs/` que referencian un `.c4` | 44 de 45 |
| Archivos `.c4` a eliminar | 7 |
| `dynamic view` a traducir | 47 |
| Flows a modificar | 40 |
| Flows a crear | 4 |
| Flows a **mover** a `libs/cqrs/docs/flows/` | 5 |
| `README.md` a modificar | 6 (5 del ledger + `libs/cqrs`) |
| `README.md` a crear | **0** — los 6 ya existen |
| Archivos residuales a absorber y eliminar | 2 (`component.md`, `diagram.md`) |
| Carpetas a eliminar | 1 (`apps/ledger/docs/shared-kernel/`) |
| `.md` de `docs/architecture/` a reconciliar | 2 |
| `.c4` archivados a congelar | 10 (`work/done/`) |
| Artefactos fuera del repo (`~/.agents/`) | 4 |

---

## Gaps detectados

**Inconsistencias del repo — se corrigen como efecto de la migración:**

1. **Link roto vivo.** `apps/ledger/docs/transactions/flows/reverse-transaction.md:32`
   enlaza `../../shared/flows/dry-run-preview.md`, que **no existe**. Lo cierra AC-1 al
   crear ese flow.
2. **Afirmación falsa en los README.** `transactions/README.md` declara «Renderizados a
   SVG en `assets/` por CI». No existe ninguna carpeta `assets/` ni
   `docs/.likec4-export`, y `docs:export` nunca corrió en CI. Revisar la misma frase en
   los otros 4 README al reescribir la sección «Diagramas» (AC-2).
3. **Documentación huérfana en `shared-kernel`.** `component.md` + `diagram.md` + `.c4`
   documentan parcialmente lo mismo, **y describen código que ya no vive en el ledger**:
   se extrajo a `libs/cqrs` el 2026-07-27, que tiene su propio `README.md` describiendo lo
   mismo. Es duplicación entre dos árboles, no solo artefactos superpuestos. AC-2 la colapsa
   moviendo la carpeta a `libs/cqrs/docs/`.
   **Causa de que pasara inadvertido:** `shared-kernel.c4` declara sus componentes bajo el
   FQN `admin.ledger.shared.*` — el modelo LikeC4 afirmaba una pertenencia al app `ledger`
   que el árbol de archivos ya había desmentido. Es el argumento más fuerte a favor de esta
   migración: un modelo que puede contradecir al repo sin que nada lo detecte.
4. **C4 L3 filtrado en el archivo L1+L2.** `landscape.c4` declara `commandBus`,
   `queryBus` y `eventStore` dentro de `shared` — nivel 3 en un archivo de nivel 1+2.
   AC-3 los manda al diagrama de componentes de `shared-kernel`, no a `containers.md`.

**Deuda de biyección código ↔ documentación — fuera del alcance de este ítem:**

5. Dos casos de uso implementados no tenían flow doc (`record-opening-balance`,
   `merge-transfers`). AC-1 los cubre, pero **nada garantiza que sean los únicos**: el
   gate de AC-5 es unidireccional (diagrama → código) por decisión explícita, así que no
   detecta código sin documentar. Un barrido de esa dirección es otra historia.

**Búsquedas sin resultado:**

6. No existe `docs/.likec4-export`, ni ninguna carpeta `assets/` por módulo. Ningún SVG
   se generó jamás — confirma el diagnóstico del encuadre.
7. `docs/decisions.md` no tiene ninguna entrada que fundamente la adopción de LikeC4; la
   única mención (línea 456) es incidental. La decisión original vive solo en
   `docs/proposals/docs-as-code-likec4.md`, que AC-8 marca como superada.

**Ruido a ignorar:**

8. `.nx/workspace-data/*.json` referencia `likec4`. Es cache generado por Nx, no fuente:
   se regenera solo y queda excluido del criterio de búsqueda de AC-4.
