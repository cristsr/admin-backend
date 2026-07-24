# Propuesta: documentación como código (LikeC4) + docs vivos por módulo

> Estado: **propuesta** · Reemplaza el enfoque «un set de diagramas por historia»
> por un modelo único LikeC4 + OpenAPI canónico por módulo, con `/design`
> produciendo un **delta** acotado a la HU y `/sync` **reconciliándolo** contra
> los docs vivos.

## 1. Problema

La documentación se genera con la **HU como unidad**. Pero la HU es un *changeset*,
no una unidad de conocimiento. Consecuencias observadas en el repo:

- `apps/ledger/docs/accounts/diagram.md` contiene flujos de `Account` **y** de
  `LedgerTransaction` (la HU-0003 tocó dos módulos), y `component.md` se titula
  «accounts + transactions». La frontera de módulo quedó rota.
- Los docs acumulados están tatuados con `hu-0003`, `hu-0005`… en vez de leerse
  como el estado actual del sistema.
- Una HU multi-módulo produce un diagrama gigante porque el diagrama hereda el
  alcance del changeset.

## 2. Principio

**La unidad de documentación pasa a ser el caso de uso (flujo); la HU pasa a ser
un conjunto de operaciones sobre flujos.** Los diagramas estructurales dejan de
dibujarse a mano y se **derivan de un modelo único** (LikeC4). Los contratos API
se acumulan en **un OpenAPI canónico por módulo**.

Dos tiers, físicamente separados:

| Tier | Qué es | Vive en | Lo produce |
|---|---|---|---|
| **Delta de historia** | Changeset: sólo lo que *esta* HU agrega/cambia | `work/active/hu-XXXX/design/` | `/design` |
| **Docs vivos** | Estado actual del sistema, acumulado | `docs/` + `apps/<app>/docs/<module>/` | `/sync` (reconcilia el delta) |

`/design` nunca escribe en los docs vivos. `/build` implementa. `/sync` mergea el
delta hacia los docs vivos y archiva la historia.

## 3. Herramientas core

- **LikeC4** — modelo C4 como código (`.c4`). Un modelo, vistas filtradas. TS-native,
  preview en VS Code, `likec4 export` para volcar SVG en CI.
- **OpenAPI 3.1** — un `api.yaml` canónico por módulo.
- **oasdiff** — clasifica cambios de contrato (breaking vs no-breaking) al reconciliar.

## 4. Topología de docs vivos

```
likec4.config.json                 # raíz del workspace LikeC4
docs/
  architecture/
    landscape.c4                   # C4 L1+L2: personas, sistemas externos, containers
    context.md                     # prosa (embebe vistas generadas)
    containers.md
  decisions.md                     # log acumulativo (lo mantiene /sync)
apps/ledger/docs/
  <module>/
    <module>.c4                    # C4 L3: componentes + dynamic views (flujos)
    README.md                      # arc42-lite: propósito, invariantes, lenguaje ubicuo
    api.yaml                       # OpenAPI CANÓNICO del módulo
    data-model.md
    flows/
      <use-case>.md                # prosa + metadata de un caso de uso
    assets/                        # SVGs exportados por LikeC4 en CI
```

`likec4.config.json` globbea `docs/architecture/**/*.c4` + `apps/**/docs/**/*.c4`
→ **un solo modelo**, con los `.c4` co-localizados por dueño. El split C4 se preserva:
L1/L2 en `landscape.c4`, L3 (componentes + flujos) en el `.c4` de cada módulo vía
`extend`.

## 5. Convención de flujo (caso de uso)

Cada caso de uso = **una `dynamic view` en el `.c4` del módulo** (el diagrama) +
**un `flows/<slug>.md`** (la semántica). El `.md` lleva frontmatter que lo hace
validable/reconciliable:

```yaml
---
use_case: open-account
module: accounts
trigger: rest              # rest | cron | queue | domain-event | cli
entrypoint: POST /accounts # ruta REST, nombre de cron/job/evento
command: OpenAccountCommand
view: openAccount          # id de la dynamic view en <module>.c4
invariants: [AC-2]
introduced_by: hu-0003
last_modified_by: hu-0005
status: active             # active | deprecated | removed
---
```

- `trigger` es la taxonomía de adaptadores primarios (hexagonal). Es la clave que
  organiza `flows/` y determina el elemento origen de la `dynamic view`
  (`controller` vs `scheduler` vs `consumer`).
- El diagrama **no** se duplica en el `.md`: el `.md` referencia `view:` y la prosa
  explica reglas, invariantes y errores.

## 6. Versionado

- **Diagramas y componentes:** archivo canónico único + **historia de git** = las
  versiones. **No** se crean `-v2.md`. Trazabilidad vía `last_modified_by` en el
  frontmatter y `git log/blame`. La «versión 2» del flujo se reconstruye desde git.
- **Contratos API:** se versiona el path (`/v1`, `/v2`) **sólo cuando ambas versiones
  coexisten en producción**. Quién decide: `oasdiff`. Si el delta es *breaking* frente
  al canónico → amerita nueva versión de path; si no, evolución in-place.

Regla: archivo/endpoint versionado ⇔ ambas versiones corren simultáneamente en prod.

## 7. Nueva spec de `/design` (produce el delta)

`/design` deja de generar diagramas finales. Produce un **delta** en
`work/active/hu-XXXX/design/`:

| Artefacto | Antes | Ahora |
|---|---|---|
| `design.md` | resumen + diagramas inline | resumen + **lista de flujos afectados** (crea/modifica/depreca) + `## Impacto en Arquitectura Global` |
| `docs/api.delta.yaml` | `api.yaml` completo | **sólo** los paths y schemas que la HU agrega/cambia, agrupados por módulo/tag |
| `docs/model.delta.c4` | `component.md` + `diagram.md` en Mermaid | fragmento LikeC4: elementos nuevos/cambiados (`extend <module> { ... }`) + `dynamic view` por caso de uso nuevo/modificado |
| `docs/flows/<slug>.md` | — | frontmatter + prosa de cada flujo tocado (borrador; `/sync` lo promueve) |

Algoritmo (reemplaza PHASE 4 «Produce ...»):

1. De `hu.md`, derivar los **casos de uso** afectados (cada AC → trigger + command/endpoint).
2. Para cada caso de uso, marcar la operación: `create` | `modify` | `deprecate`.
3. Emitir `model.delta.c4`: por cada componente nuevo, un bloque `extend <module> { component ... }`;
   por cada caso de uso nuevo/modificado, una `dynamic view`.
4. Emitir `api.delta.yaml`: sólo los paths/schemas nuevos o modificados.
5. Emitir un `flows/<slug>.md` borrador por cada caso de uso tocado (con `introduced_by`
   o `last_modified_by` = esta HU).
6. `design.md` **referencia** los flujos por id; nunca embebe un diagrama-monstruo.

`DIAGRAM_FORMAT` en `profile.md` pasa de `Mermaid` a `LikeC4`. Se agregan las claves
de la sección 10.

## 8. Nueva spec de `/sync` (reconcilia el delta)

`/sync` reemplaza el «copy/overwrite» del Step 3 por **reconciliación**:

1. **OpenAPI:** mergear `design/api.delta.yaml` en `apps/<app>/docs/<module>/api.yaml`
   (agregar/reemplazar paths, agregar/actualizar schemas). Correr
   `oasdiff <canónico-previo> <canónico-nuevo>` y registrar en el cuerpo del PR si el
   cambio es breaking (→ señal de versión de path).
2. **Modelo LikeC4:** aplicar `design/model.delta.c4` sobre `apps/<app>/docs/<module>/<module>.c4`:
   - Elementos nuevos → insertarlos en el bloque del módulo.
   - `dynamic view` nueva → agregarla.
   - `dynamic view` existente (mismo id) → reemplazarla (git guarda la versión previa).
3. **Flows:** por cada `design/flows/<slug>.md`:
   - No existe en el módulo → crear `apps/<app>/docs/<module>/flows/<slug>.md`.
   - Existe → actualizar prosa/metadata y **bumpear `last_modified_by`**; no crear `-v2`.
   - `status: removed`/`deprecated` → marcarlo, no borrar el archivo.
4. **Componentes/README:** el `README.md` del módulo se actualiza sólo si cambian
   invariantes o lenguaje ubicuo (no en cada HU).
5. **Export:** correr `likec4 export` (o dejarlo a CI) para regenerar `assets/*.svg`.
6. **Decisiones + arquitectura + archivar:** igual que hoy (Steps 4-6 actuales:
   `docs/decisions.md`, `/architecture` si `## Impacto en Arquitectura Global` = Sí,
   mover a `work/done/`).

`/sync` sigue sin tocar git (eso es `/commit`).

## 9. Validación (quality gate nuevo, opcional en CI)

- `likec4 validate` — el modelo compila (todo elemento referenciado existe).
- `oasdiff breaking` — no hay breaking no declarado.
- Lint de frontmatter de `flows/*.md` — claves obligatorias presentes, `view:` existe
  en el `.c4`, `entrypoint` coincide con un path del `api.yaml` (para trigger `rest`).

## 10. Cambios en `profile.md`

Bloque nuevo a agregar en la sección 8 (Documentación):

```
| `DIAGRAM_FORMAT`        | LikeC4 (antes Mermaid) |
| `DOCS_MODEL`            | modelo LikeC4 único; `.c4` co-localizados por módulo |
| `DOCS_MODULE_MODEL`     | `apps/<app>/docs/<module>/<module>.c4` |
| `DOCS_MODULE_FLOWS`     | `apps/<app>/docs/<module>/flows/<use-case>.md` |
| `DOCS_MODULE_API`       | `apps/<app>/docs/<module>/api.yaml` (canónico) |
| `DOCS_LANDSCAPE_MODEL`  | `docs/architecture/landscape.c4` |
| `DESIGN_OUTPUT_MODE`    | delta (api.delta.yaml + model.delta.c4 + flows/*.md) |
| `SYNC_MODE`             | reconcile (merge OpenAPI + merge .c4 + upsert flows) |
| `TRIGGER_TAXONOMY`      | rest, cron, queue, domain-event, cli |
| `API_DIFF_TOOL`         | oasdiff |
```

## 11. Plan de adopción

1. **Piloto (este cambio):** migrar `accounts` + `transactions` a la nueva estructura
   (`.c4` + `README.md` + `flows/*.md` + `api.yaml`). Validar la forma.
2. Actualizar `profile.md` (sección 10) y las skills `/design` y `/sync` (secciones 7-8).
3. Agregar `oasdiff` + `likec4 validate` al pipeline de CI (sección 9).
4. Migrar `shared-kernel` y el resto de módulos de forma incremental (cada HU que los
   toque los va reconciliando).
```
