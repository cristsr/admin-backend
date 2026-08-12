---
tipo: debt
origen: manual
---

# spec-0033: Migrar los diagramas de LikeC4 a Mermaid

## Deuda Técnica

**Situación actual:** la documentación estructural del proyecto vive en 7 archivos
LikeC4 (`docs/architecture/landscape.c4` para C4 L1+L2, y `apps/ledger/docs/<module>/<module>.c4`
para C4 L3 en 6 carpetas: `accounts`, `reconciliation`, `reference`, `shared`,
`shared-kernel`, `transactions`), con 1553 líneas y 47 `dynamic view` — una por caso
de uso. Solo 5 de esas carpetas corresponden a módulos vivos del ledger: `shared-kernel`
documenta código extraído a `libs/cqrs` en julio, y AC-2 lo corrige. Ese modelo se sostiene con la dependencia `likec4@^1.59.2`, 3 scripts npm
(`docs:validate`, `docs:preview`, `docs:export`), un job `docs` en
`.github/workflows/ci.yml`, y ~120 líneas de instrucciones dedicadas al mecanismo de
delta repartidas entre las skills `/design` y `/sync`. Tres problemas concretos:

1. **Los diagramas son invisibles.** No existe `docs/.likec4-export` ni `assets/` por
   módulo: ningún SVG se exporta nunca. Para ver una `dynamic view` hay que levantar
   `likec4 start`. En GitHub, en un PR o en el preview de VS Code, un `.c4` es texto
   plano. Documentación que exige arrancar un dev server para consumirse, no se consume.
2. **El diagrama y su semántica viven separados.** Los 40 `flows/*.md` tienen toda la
   sustancia (prosa, reglas, tabla de errores) y cierran remitiendo a su `dynamic view`
   en el `.c4`; los 40 llevan una clave `view:` en el frontmatter apuntando al `viewId`.
   Dos archivos y dos ediciones por flujo, con salto de contexto para el lector.
3. **La maquinaria de delta es cara y solo se justifica por el modelo único.** `/design`
   pinta `#delta-new`/`#delta-changed` en naranja y prefija `[NEW]`/`[CHANGED]` en los
   títulos; `/sync` los limpia. La skill carga ~30 líneas de workarounds solo para el
   gotcha de resolución de FQN dentro de bloques `extend`.

A eso se suma que el nivel L1/L2 **ya está duplicado**: `docs/architecture/context.md`
y `containers.md` contienen cada uno un bloque Mermaid (`graph TB`) que describe lo
mismo que `landscape.c4`. El modelo LikeC4 se montó encima del enfoque anterior sin
retirarlo, y hoy conviven dos fuentes de verdad para los mismos actores y containers.

**Riesgo o costo:** cada caso de uso nuevo paga el peaje de un artefacto extra y de un
mecanismo de reconciliación que nadie consume visualmente, porque el resultado no se
puede ver sin herramienta. La duplicación de L1/L2 garantiza divergencia silenciosa —
nada valida que `landscape.c4` y `containers.md` digan lo mismo. Y el costo se paga en
cada historia, no una sola vez.

**Estado deseado:** los diagramas se escriben en Mermaid y se renderizan sin instalar
nada — en GitHub, en el preview de VS Code, en un PR. El diagrama de cada caso de uso
vive **inline** en su `flows/*.md`, colapsando los dos artefactos en uno. No queda
ningún `.c4` vivo, ninguna dependencia de LikeC4, y una única fuente de verdad por
nivel C4. La validación referencial que hoy da `likec4 validate` se reemplaza por un
chequeo propio enganchado al job `docs` que ya existe, de modo que el CI no pierda el
gate.

## Criterios de Aceptación

### AC-1: Cada caso de uso tiene su diagrama inline en su flow

Los 44 archivos `apps/ledger/docs/<module>/flows/<use-case>.md` —los 40 actuales más
los 4 que crea este AC— contienen un bloque ` ```mermaid ` con un `sequenceDiagram` que
reemplaza a la `dynamic view` homónima del `.c4`. Ningún flow remite a un archivo `.c4`
para ver su diagrama, y la clave `view:` del frontmatter — que apuntaba al `viewId` de
LikeC4 — se elimina de los 40 que la tienen, por quedar sin referente. El resto del
frontmatter (`use_case`, `module`, `trigger`, `entrypoint`, `command`, `invariants`,
`introduced_by`, `last_modified_by`, `status`) se conserva intacto.

Las 47 `dynamic view` se traducen sin pérdida de contenido: cada línea
`origen -> destino 'mensaje'` se convierte en un mensaje del `sequenceDiagram`
conservando orden, participantes y texto. Los `title` y `description` de la vista se
conservan como prosa del `.md`, no se descartan.

**Las 7 vistas sin flow propio aterrizan así:**

| `dynamic view` | Destino |
|---|---|
| `recordOpeningBalance` | **flow nuevo** `accounts/flows/record-opening-balance.md` |
| `mergeTransfers` | **flow nuevo** `transactions/flows/merge-transfers.md` |
| `shared_http_dry_run` | **flow nuevo** `shared/flows/dry-run-preview.md` |
| `shared_http_retry_deadlock` | **flow nuevo** `shared/flows/retry-transient-failure.md` |
| `shared_kernel_auth_context_policy` | se absorbe en `shared/flows/command-dispatch.md` |
| `shared_kernel_read_model_upsert` | se absorbe en el diagrama de componentes de `libs/cqrs` (AC-2) |
| `shared_kernel_contract_test` | se absorbe en el diagrama de componentes de `libs/cqrs` (AC-2) |

Los 4 flows nuevos se crean con el frontmatter completo y la prosa mínima que traduce
el `title`/`description` de su vista — no se redacta documentación de caso de uso más
allá de lo que la vista ya decía. `dry-run-preview.md` cierra además el link roto de
`transactions/flows/reverse-transaction.md:32`, que ya lo enlazaba sin que existiera.

**5 de los 40 flows además se mudan de lugar.** Los de
`apps/ledger/docs/shared-kernel/flows/` (`event-store-append`, `rebuild-all`,
`rebuild-projection`, `verify-balances`, `verify-chain`) pasan a `libs/cqrs/docs/flows/`
con `module: cqrs` en el frontmatter, por la corrección de frontera de AC-2.

### AC-2: Cada módulo tiene su diagrama de componentes (C4 L3) en Mermaid

Los componentes que hoy declara cada `<module>.c4` quedan documentados en un bloque
` ```mermaid ` con un `flowchart` **mantenido a mano** en el `README.md` de su unidad de
documentación. El diagrama agrupa los componentes en subgraphs por capa hexagonal
(`domain`, `application`, `infrastructure`) y nombra cada nodo con la clase real que
representa, según la convención de AC-5. No se cablea ningún generador (`nx graph`,
dependency-cruiser): lo que impide la divergencia es el gate de AC-5, no la generación
automática.

**Corrección de frontera: `shared-kernel` no es un módulo del ledger.** Su código se
extrajo a `libs/cqrs` el 2026-07-27 (así lo declara `libs/cqrs/README.md`) y la carpeta
`apps/ledger/docs/shared-kernel/` quedó documentando código que ya no vive ahí, en
paralelo al `README.md` que la lib tiene por su cuenta. Se corrige moviendo la
documentación junto a su código:

- Los 5 `flows/*.md` → `libs/cqrs/docs/flows/`, con `module: cqrs` en el frontmatter.
- `component.md` → su `graph TD` se normaliza a `flowchart` y se incorpora al
  **`libs/cqrs/README.md` existente** (no se crea uno nuevo), sumando `read_model_upsert`
  y `contract_test` (AC-1).
- `diagram.md` → su `sequenceDiagram` se absorbe en
  `apps/ledger/docs/shared/flows/command-dispatch.md`, junto con `auth_context_policy` (AC-1).
- `apps/ledger/docs/shared-kernel/` deja de existir.

El alcance queda entonces en **5 módulos del ledger** (`accounts`, `reconciliation`,
`reference`, `shared`, `transactions`) **+ `libs/cqrs`**, los tres con `README.md` ya
existente. La sección «Diagramas» de los 5 README del ledger se reescribe: deja de remitir
al `.c4` y deja de afirmar que hay SVG renderizados en `assets/` por CI — nunca los hubo.

> `libs/shared` también tiene `README.md` y aporta símbolos que los diagramas nombran
> (`canonicalJson`, `sha256Hex`). **No se le crea `docs/` en esta historia**: entra al gate
> solo como raíz compartida.

### AC-3: El nivel L1+L2 queda con una sola fuente de verdad

`docs/architecture/context.md` (C4 Nivel 1 — actores y sistemas externos) y
`docs/architecture/containers.md` (C4 Nivel 2 — apps, libs, integraciones) contienen
cada uno el diagrama Mermaid canónico de su nivel, y `docs/architecture/landscape.c4`
deja de existir. Antes de borrarlo hay que **reconciliar**: los bloques `graph TB` que
ya existen en ambos `.md` y el contenido de `landscape.c4` se comparan, y cualquier
nodo o relación que esté solo en el `.c4` se incorpora al `.md`. No se pierde
información por el hecho de que el destino ya tuviera un diagrama propio.

El reparto del contenido de `landscape.c4`, elemento por elemento:

| Qué | Destino |
|---|---|
| `user`, `admin`, `admin.ledger` y la relación `user -> admin.ledger` | reconciliar en `context.md` (L1) y `containers.md` (L2) |
| `view ledgerContainers` | reconciliar en `containers.md` |
| `view index` | se descarta — es `ledgerContainers` más el actor; el panorama navegable era una afordancia del explorador de LikeC4 |
| `commandBus`, `queryBus`, `eventStore` (declarados dentro de `shared`) | al diagrama de componentes de `shared-kernel` (AC-2) — son C4 L3 filtrados en el archivo L1+L2, y `containers.md` no debe absorberlos |
| Estilos de `specification{}` (`actor`, `system`, `app`, `module`, `component`, `store`) | se descartan — directivas de render de LikeC4 sin equivalente en Mermaid |
| Tags de trigger (`rest`, `cron`, `queue`, `domain-event`, `cli`) | ya viven en la clave `trigger:` del frontmatter de cada flow y en `TRIGGER_TAXONOMY` del profile; sobreviven sin cambios |
| Tags `delta-new` / `delta-changed` | se descartan junto con el mecanismo de delta (AC-7) |

### AC-4: No queda rastro de LikeC4 en el repositorio

- Los 7 archivos `.c4` vivos están eliminados (`docs/architecture/landscape.c4` + los
  6 `apps/ledger/docs/<module>/<module>.c4`).
- La dependencia `likec4` sale de `package.json` y del lockfile.
- `docs:validate` se **redefine** sobre el script de AC-5
  (`ts-node tools/validate-diagrams.ts`); `docs:preview` y `docs:export` se **eliminan** —
  Mermaid no necesita dev server y exportar imágenes ya está fuera de alcance.
- No queda `likec4.config.json` en la raíz.
- Una búsqueda de `likec4` y de `.c4` en el repo no devuelve referencias vivas,
  **excluyendo** `work/done/` y `.nx/workspace-data/`.

Los 10 `work/done/*/docs/model.delta.c4` de historias cerradas (hu-0006, hu-0007,
hu-0011, hu-0015, hu-0016, hu-0019, hu-0024, hu-0025, hu-0026,
refactor-module-boundaries) **se congelan tal cual**: no se migran ni se eliminan. Son
el registro de lo que se decidió en cada historia, y `likec4.config.json` ya los excluía
del modelo (`**/work/done/**`) — el tooling actual ya los trata como archivo muerto.
`.nx/workspace-data/` es cache generado por Nx, no fuente: se regenera solo.

### AC-5: El CI conserva un gate de validación de diagramas

El job `docs` de `.github/workflows/ci.yml` deja de correr `npx likec4 validate` y
corre en su lugar `ts-node tools/validate-diagrams.ts`, que extrae los identificadores de
los bloques ` ```mermaid ` y verifica que cada uno corresponda a un símbolo real del
código del módulo. El script se escribe en TypeScript y no en `.mjs` para que su
`tools/validate-diagrams.spec.ts` corra con el Jest + `ts-jest` ya configurados, como
exige el Artículo 4 de `rules.md`; `ts-node` ya está en `devDependencies`.

**Convención de identificadores** — la que el repo ya usa en
`shared-kernel/diagram.md` (`participant CB as PolicyCommandBus`):

- El **nombre visible** de un participante o nodo —lo que sigue a `as`, o el nombre solo
  cuando no hay `as`— DEBE ser el nombre exacto de una clase, puerto o excepción del
  módulo (`ReverseConfirmedTransactionHandler`, `EventStore`, `TransactionNotFoundException`).
- El **alias** queda libre: sirve a la legibilidad del diagrama y no se verifica.
- Los participantes que no son símbolos del código (`Client`, `User`, `Postgres`) se
  declaran en una **lista blanca explícita** dentro del script.

La verificación es **unidireccional**: diagrama → código. No se comprueba que todo
símbolo del código aparezca en algún diagrama.

- CUANDO el job `docs` corre sobre el repositorio, EL SISTEMA DEBE resolver cada
  identificador de cada bloque Mermaid contra los símbolos del módulo al que pertenece
  el archivo.
- SI algún identificador no resuelve a un símbolo existente ni figura en la lista
  blanca, ENTONCES EL SISTEMA DEBE reportar el archivo y el identificador, y terminar
  con exit code distinto de cero.
- MIENTRAS todos los identificadores resuelvan, EL SISTEMA DEBE terminar con exit
  code cero — sobre el estado del repo ya migrado, el job pasa en verde.

> Original: "El job falla ante una referencia rota, igual que hoy. Sobre el estado
> actual del repo, ya migrado, el job pasa en verde."

### AC-6: El profile del proyecto refleja el nuevo enfoque

`.agents/profile.md` queda actualizado y sin referencias a LikeC4:

| Clave | Sección | Queda |
|---|---|---|
| `DIAGRAM_FORMAT` | 7 | Mermaid (bloques ` ```mermaid ` inline en `.md`) |
| `DOCS_MODEL` | 8 | sin modelo único: un diagrama por artefacto, co-localizado |
| `DOCS_LANDSCAPE_MODEL` | 8 | se elimina — `context.md` y `containers.md` son los artefactos de L1/L2 |
| `DOCS_MODULE_MODEL` | 8 | se elimina — el diagrama de componentes vive en `DOCS_MODULE_README` |
| `DESIGN_OUTPUT_MODE` | 8 | `flows/*.md` completo + `api.delta.yaml` (ya no hay `model.delta.c4`) |
| `SYNC_MODE` | 8 | `replace` para los flows; el merge sigue aplicando solo al `api.yaml` |
| `MODEL_VALIDATE_CMD` | 10 | `node tools/validate-diagrams.mjs` |

`API_CONTRACT_MODE: delta` **no cambia**: el `api.yaml` canónico por módulo es un
artefacto acumulativo real y esa mitad del mecanismo nunca dependió de LikeC4.

La nota de la sección 8 que apunta a `docs/proposals/docs-as-code-likec4.md` como spec
vigente se redirige a la propuesta nueva de AC-8.

### AC-7: Las skills SDD generan y reconcilian Mermaid, no LikeC4

Los artefactos de `~/.agents/` quedan actualizados: `skills/design/SKILL.md`,
`skills/design/references/flow-template.md`, `skills/sync/SKILL.md` y
`sdd-profile.template.md`. Se elimina el mecanismo de resaltado de delta específico de
LikeC4 (tags `#delta-new`/`#delta-changed` en naranja, prefijos `[NEW]`/`[CHANGED]` en
los títulos de vista) y los workarounds de resolución de FQN dentro de bloques
`extend`, que dejan de aplicar.

**La maquinaria de delta/reconcile se retira para los diagramas, no solo se reformatea:**

- `/design` deja de emitir `model.delta.c4` y pasa a escribir el `flows/<use-case>.md`
  **completo**, con su `sequenceDiagram` inline.
- `/sync` **reemplaza** el flow entero en `apps/<app>/docs/<module>/flows/` en lugar de
  reconciliar un delta contra un modelo único.
- La reconciliación sigue viva **solo** para el `api.yaml` canónico del módulo, que es
  donde `API_CONTRACT_MODE: delta` sigue justificado.
- Las ~120 líneas de instrucciones de delta repartidas entre `/design` y `/sync` se
  retiran junto con el mecanismo.

Tras el cambio, `/healthcheck` pasa sin reportar inconsistencias entre las claves que
las skills referencian y las que declaran `.agents/profile.md` y
`~/.agents/sdd-profile.template.md`.

> Estos archivos viven **fuera del repositorio** (`~/.agents/`, expuestos por symlink en
> `~/.claude/skills/`). No entran en el commit de esta historia y hay que versionarlos
> por separado.

### AC-8: La propuesta vigente queda superada por escrito

`docs/proposals/docs-as-code-likec4.md` deja de presentarse como el enfoque vigente. Se
crea una propuesta nueva en `docs/proposals/` que documenta el enfoque Mermaid — el
reparto de artefactos por nivel C4, la convención de identificadores de AC-5 y el
mecanismo de delta resultante — y la anterior queda marcada como superada, con un
enlace a la nueva. La decisión y su fundamento se registran en `docs/decisions.md`.

## Reglas de Negocio

- **No usar `C4Context` ni `C4Component` de Mermaid.** Siguen siendo experimentales y
  layoutean mal. Los diagramas estructurales se hacen con `flowchart` y subgraphs.
- **Normalizar la sintaxis heredada.** Los bloques Mermaid que ya existen en
  `context.md` y `containers.md` usan `graph TB`, la forma legada. El enfoque nuevo
  usa `flowchart`, y esos dos bloques se migran también.
- **Se acepta la repetición de nombres entre diagramas.** Sin modelo único, un
  componente que participa en N flujos se nombra N veces. Es el costo explícito de la
  decisión, no un defecto a corregir: la convención de identificadores de AC-5 es lo
  que evita que la repetición derive en divergencia.
- **Ningún cambio en el código de `apps/ledger/src/`.** Esta historia toca
  documentación, configuración del pipeline y CI. Si la validación de AC-5 revela
  referencias rotas hacia símbolos inexistentes, se corrige el diagrama, no el código.
- **Los `api.yaml` canónicos por módulo no se tocan.** El contrato OpenAPI es
  independiente del formato de diagrama y sigue igual, incluido `API_CONTRACT_MODE: delta`.
- **Un módulo, un destino por artefacto.** Cada módulo tiene exactamente un `README.md`
  (con su diagrama de componentes) y un `flows/*.md` por caso de uso. No se admiten
  artefactos paralelos que documenten lo mismo: los `component.md`/`diagram.md` de
  `shared-kernel` se absorben y se borran, no se dejan conviviendo.
- **El nombre de clase es el contrato del diagrama.** Un nodo o participante nombra la
  clase real (AC-5) o está en la lista blanca. Un nombre inventado o aproximado rompe el
  gate, y esa es la intención: es lo único que sostiene la correspondencia entre el
  diagrama y el código sin un modelo único que los ate.

## Technical Context

> Restricciones y contexto declarados por el desarrollador, no derivados del código.

- **Regla que gobierna el reparto de artefactos:** cada módulo codificado debe tener su
  reflejo en la documentación, y a la inversa. Es la fuente de las decisiones de AC-1
  (los 2 casos de uso implementados sin flow lo obtienen) y de AC-2 (`shared-kernel`
  recibe el `README.md` que le falta).
- **`shared-kernel/component.md` y `shared-kernel/diagram.md` son residuo**, no destino
  a conservar. Se absorben en los artefactos vigentes y se eliminan (AC-2).
- **`shared-kernel` no es un módulo del ledger**: su código se refactorizó a `libs/cqrs`.
  La documentación se mueve con él — corolario directo de la regla de biyección, y la
  razón por la que AC-2 cambió de «crear un README» a «mover la carpeta».
- **Sin restricciones sobre `~/.agents/`.** AC-7 puede modificar libremente las skills y
  el template del profile.

## Fuera de Alcance

- **Exportar imágenes en CI.** Mermaid renderiza nativo en GitHub y VS Code; generar
  SVG/PNG deja de ser necesario y no se reemplaza.
- **Renombrar los `hu.md` legados** de las 6 historias activas (`hu-0027`..`hu-0032`) al
  nombre actual `spec.md`. Es otra deuda, no esta.
- **Rehacer o corregir el contenido de los 40 flujos existentes.** La migración es de
  formato: si un `flows/*.md` documenta mal su caso de uso, eso se arregla en su propia
  historia. Los 4 flows que crea AC-1 son la excepción acotada — nacen con la prosa
  mínima que traduce el `title`/`description` de su `dynamic view`, no con documentación
  redactada de cero.
- **Cerrar los demás gaps de biyección código ↔ documentación.** El gate de AC-5 es
  unidireccional a propósito: verifica que lo diagramado exista en el código, no que
  todo lo codificado esté diagramado. Detectar y documentar lo que falta del otro lado
  es otra historia.

## Notas de secuenciación

Las 6 historias activas (`hu-0027`..`hu-0032`) tienen solo `hu.md`: ninguna llegó a
`/design` ni tiene un `model.delta.c4` en vuelo. La ventana para migrar está limpia
**hoy**. En cuanto una de ellas pase por `/design` con las skills sin actualizar,
generará un delta `.c4` que habrá que migrar a mano. Conviene resolver AC-7 antes de
correr `/design` sobre cualquier otra historia.

## Resolución de Ambigüedades

### Consultadas

- **AC-1 · consultada:** ¿Qué pasa con las 7 `dynamic view` sin `flows/*.md`? →
  **Se crean los 4 flows faltantes; las otras 3 se absorben.** `recordOpeningBalance`
  y `mergeTransfers` (casos de uso REST implementados en el código) y
  `shared_http_dry_run` y `shared_http_retry_deadlock` (políticas transversales con
  código real) obtienen flow propio. `shared_kernel_read_model_upsert` y
  `shared_kernel_contract_test` se absorben en el diagrama de componentes de
  `shared-kernel`; `shared_kernel_auth_context_policy` en `shared/flows/command-dispatch.md`.
  *Por qué se consultó:* tensión real de **alcance** — la regla de biyección
  código ↔ documentación pedía los flows, pero «Fuera de Alcance» declara que rehacer
  contenido de flujos no entra. Crear 4 flows es contenido nuevo, no traducción de formato.
  *Efecto colateral:* `dry-run-preview.md` arregla el link roto de
  `transactions/flows/reverse-transaction.md:32`, que ya lo enlazaba sin que existiera.

- **AC-5 · consultada:** ¿El gate verifica una dirección o las dos? → **Una:
  diagrama → código.** Todo identificador de un bloque Mermaid debe existir como
  símbolo del módulo; no se verifica que todo símbolo del código aparezca en algún
  diagrama.
  *Por qué se consultó:* categoría **alcance** — la dirección inversa exigía definir
  qué símbolos son documentables y hoy dejaría el CI en rojo hasta cerrar todos los
  gaps preexistentes.

- **AC-6, AC-7 · consultada:** ¿Se simplifica `DESIGN_OUTPUT_MODE`/`SYNC_MODE`? →
  **Sí, en esta misma historia.** `SYNC_MODE` pasa de `reconcile` a `replace` y
  `/design` emite el `flows/*.md` completo en lugar de un delta de diagrama.
  `API_CONTRACT_MODE: delta` queda intacto: el `api.yaml` canónico por módulo es un
  artefacto acumulativo real y esa mitad del mecanismo nunca dependió de LikeC4.
  *Por qué se consultó:* categoría **alcance** — decide si AC-6 y AC-7 retiran la
  maquinaria o solo cambian el formato.

### Autónomas

- **AC-4 · autónoma (alta):** ¿Qué pasa con los 3 scripts npm? → **`docs:validate` se
  redefine** sobre el script de AC-5; **`docs:preview` y `docs:export` se eliminan**.
  *Fundamento:* «Fuera de Alcance» ya establece que exportar imágenes deja de ser
  necesario, y Mermaid no requiere dev server. *Fuente:* invariantes del propio ítem
  (nivel 5).

- **AC-3 · autónoma (alta):** ¿Qué destino tiene el bloque `specification{}` de
  `landscape.c4`? → **Los estilos de elemento (`actor`, `system`, `app`, `module`,
  `component`, `store`) se descartan** — son directivas de render de LikeC4 sin
  equivalente ni necesidad en Mermaid. **La taxonomía de triggers sobrevive** sin
  cambios: ya vive en la clave `trigger:` del frontmatter de cada flow y en
  `TRIGGER_TAXONOMY` del profile, no en el `.c4`. **Los tags `delta-new`/`delta-changed`
  desaparecen** junto con el mecanismo que los usaba (AC-7).
  *Fuente:* invariantes del ítem + decisión de AC-7 (nivel 5).

- **AC-4 · autónoma (media-alta):** ¿Qué se hace con los 10
  `work/done/*/docs/model.delta.c4`? → **Se congelan tal cual.** No se migran ni se
  eliminan: son el registro de lo que se decidió en cada historia cerrada.
  *Fundamento:* el propio tooling ya los trata como archivo muerto.
  *Fuente:* `likec4.config.json:exclude` incluye `**/work/done/**` (nivel 3).
  *Consecuencia:* el criterio de búsqueda de AC-4 excluye `work/done/` y
  `.nx/workspace-data/` (cache generado por Nx, no fuente).

- **AC-2 · autónoma (media-alta):** ¿Diagrama de componentes a mano o derivado del
  código? → **A mano**, como `flowchart` con subgraphs por capa hexagonal, en el
  `README.md` del módulo.
  *Fundamento:* el repo ya lo hace así y cablear un generador agrega una dependencia
  que el Simplicity Gate no justifica; el gate de AC-5 es lo que impide la divergencia,
  no la generación automática. *Fuente:* `apps/ledger/docs/shared-kernel/component.md`
  usa `graph TD` con subgraphs `domain`/`application`/`infrastructure` y nodos
  `("NombreDeClase<br/>abstract class")` (nivel 3) + `rules.md §Quality Gates`
  (Simplicity Gate, Anti-Abstraction Gate) (nivel 1).

- **AC-5 · autónoma (media):** ¿Qué cuenta como «identificador válido»? → **La etiqueta
  visible del participante** — lo que sigue a `as`, o el nombre solo si no hay `as` —
  **debe ser el nombre exacto de una clase, puerto o excepción del módulo**. El alias
  queda libre. Los participantes que no son símbolos del código (`Client`, `User`,
  `Postgres`) se declaran en una lista blanca explícita del script.
  *Fundamento:* es la convención que el repo ya usa, y deja el alias corto para la
  legibilidad del diagrama sin sacrificar la verificabilidad.
  *Fuente:* `apps/ledger/docs/shared-kernel/diagram.md` — `participant CB as PolicyCommandBus`,
  `participant ACP as AuthenticatedContextPolicy` (nivel 3).

- **AC-2 · ~~autónoma (media)~~ → CORREGIDA en `/refine`:** ¿Dónde vive el diagrama de
  `shared-kernel`? → **En `libs/cqrs/`, no en `apps/ledger/docs/`.**
  *Decisión original (errónea):* crearle un `README.md` bajo `apps/ledger/docs/shared-kernel/`.
  *Por qué era incorrecta:* `shared-kernel` **no es un módulo del ledger**. Su código se
  extrajo a `libs/cqrs` el 2026-07-27 y esa lib ya tiene su `README.md`; crear otro habría
  documentado el mismo código dos veces, en dos lugares. Ni `/clarify` ni la primera pasada
  de `/design` lo detectaron porque `shared-kernel.c4` declara sus componentes bajo el FQN
  `admin.ledger.shared.*` — el modelo LikeC4 afirmaba una pertenencia que el árbol de
  archivos ya había desmentido.
  *Decisión vigente:* la documentación se muda a `libs/cqrs/docs/` y el diagrama se
  incorpora al README existente de la lib. *Fuente:* `libs/cqrs/README.md` («Extracted from
  `apps/ledger/src/shared-kernel` on 2026-07-27») (nivel 3) + corrección del desarrollador.
  Ver `docs/research.md`, Decisión 5.

- **AC-5 · autónoma (media):** ¿Dónde vive el script de validación? →
  **`tools/validate-diagrams.ts`**, invocado por el script npm `docs:validate`.
  *Fundamento:* `tools/` ya existe como carpeta de tooling del workspace.
  *Fuente:* `tools/tsconfig.tools.json` (nivel 3).
  *Refinado en `/design`:* se fijó `.mjs` acá y `/design` lo corrigió a `.ts` — el
  Artículo 4 de `rules.md` exige `*.spec` previo, y `ts-node` + `ts-jest` ya están
  instalados. Ver `docs/research.md` (Decisión 4).

- **AC-3 · autónoma (baja):** ¿Qué destino tienen las 2 `view` de `landscape.c4`? →
  **`ledgerContainers` se reconcilia en `containers.md`; `index` se descarta.**
  *Fundamento:* `index` es el mismo contenido de `ledgerContainers` con el actor
  agregado — el panorama navegable era una afordancia del explorador de LikeC4 que
  Mermaid no reproduce. *Sin precedente:* el repo no tiene convención sobre vistas de
  navegación.

- **AC-3 · autónoma (media):** ¿Dónde aterrizan `commandBus`, `queryBus` y `eventStore`,
  que `landscape.c4` declara dentro de `shared`? → **En el diagrama de componentes de
  `shared-kernel`, no en `containers.md`.**
  *Fundamento:* son C4 Nivel 3 filtrados en el archivo de Nivel 1+2; `containers.md`
  es L2 por definición y no debe absorberlos. *Fuente:* invariante del propio ítem —
  AC-3 fija una sola fuente de verdad *por nivel* (nivel 5).

### Observaciones del relevamiento

- **Búsqueda sin resultado:** no existe `docs/.likec4-export` ni ninguna carpeta
  `assets/` por módulo. Ningún SVG se generó nunca, lo que confirma el diagnóstico del
  encuadre.
- **Inconsistencia hallada:** `apps/ledger/docs/transactions/README.md` afirma
  «Renderizados a SVG en `assets/` por CI». Es falso y no lo fue nunca; se corrige al
  reescribir la sección «Diagramas» del README (AC-2).
- **Link roto vivo:** `transactions/flows/reverse-transaction.md:32` enlaza
  `../../shared/flows/dry-run-preview.md`, que no existe. Lo cierra AC-1.
- **Alcance real:** 44 de los 45 `.md` bajo `apps/ledger/docs/` referencian un `.c4`.
  El único que no es `shared-kernel/component.md`, que es anterior a LikeC4.
