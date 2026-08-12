# design: spec-0033 — Migrar los diagramas de LikeC4 a Mermaid

## Resumen

Historia de **documentación y tooling**: no toca `apps/ledger/src/` (regla de negocio
explícita), no agrega ni modifica endpoints, y no introduce ninguna tabla. Lo que produce
es un **cambio de formato con un gate que lo sostiene**: 47 `dynamic view` y 104
componentes pasan de 7 archivos `.c4` a bloques Mermaid inline, y `likec4 validate` se
reemplaza por un validador propio de ~150 líneas.

El artefacto central del diseño es
[`docs/docs-as-code-mermaid.md`](./docs/docs-as-code-mermaid.md) — el contrato de formato
que los ~50 archivos de la migración van a seguir. Es el borrador de lo que AC-8 promueve
a `docs/proposals/`.

## Decisiones de Diseño

- **Resolución de símbolos por regex, no por TypeScript Compiler API** — medido: 91 de
  101 nombres declarados resuelven, y los 10 restantes no nombran símbolos. El compilador
  entero para responder «¿existe este nombre?» falla el Anti-Abstraction Gate.
- **La documentación de `shared-kernel` se muda a `libs/cqrs/docs/`** — no es un módulo
  del ledger: su código se extrajo a `libs/cqrs` el 2026-07-27 y la carpeta de docs quedó
  huérfana bajo `apps/ledger/docs/`. Se mueven sus 5 flows (con `module: cqrs` en el
  frontmatter) y su diagrama de componentes, junto al `libs/cqrs/README.md` que ya existe.
  El ledger queda con **5 módulos**.
- **Mapa explícito unidad-de-doc → raíces de código, con raíces compartidas siempre
  incluidas** — tras la mudanza, cada unidad mapea 1:1 (`docs/<m>/` ↔ `src/<m>/`,
  `libs/cqrs/docs/` ↔ `libs/cqrs/src/`). Las **raíces compartidas** siguen siendo
  necesarias: el módulo `shared` del ledger nombra a `DryRunPolicy` y `RetryPolicy`, que
  viven en `libs/cqrs`. Sin ellas el gate rompería aunque el mapeo sea 1:1.
- **La forma del nodo Mermaid declara si debe resolver** — cilindro `[( )]` para
  almacenamiento y subgraph para agrupaciones quedan exentos por su forma, visible en el
  diagrama, en vez de por una lista blanca escondida en el script. La lista blanca queda
  acotada a 5 actores externos.
- **El gate solo cubre `apps/<app>/docs/<module>/**`** — los diagramas L1/L2 de
  `docs/architecture/` nombran actores y containers, no clases; exigirles resolución no
  tendría sentido.
- **Traducción 1:1 sin enriquecer** — cada `origen -> destino 'msg'` se convierte en
  `origen->>destino: msg` conservando orden y texto. Sin `alt`/`opt` agregados: los
  errores siguen en la tabla `## Errores`, que es donde ya se leían mejor.
- **⚠ Refinamiento de una decisión de `/clarify`: el script es `.ts`, no `.mjs`** — el
  Artículo 4 de `rules.md` (TDD estricto, alcance *todo el repo*) exige `*.spec` previo, y
  `ts-node@10.9.2` + `ts-jest` ya están en `devDependencies`. Con `.mjs` habría que
  configurar Jest para ESM solo por este archivo. `spec.md` (AC-4, AC-5) queda
  actualizado.

Detalle completo con opciones evaluadas y descartadas en
[`docs/research.md`](./docs/research.md) — 4 decisiones.

## Artefactos NO producidos (y por qué)

Excepción deliberada al modo `delta` que declara el profile:

| Artefacto | Por qué se omite |
|---|---|
| `docs/model.delta.c4` | **Es exactamente el artefacto que esta historia elimina.** Emitirlo generaría un `.c4` nuevo que habría que migrar a mano — el escenario que las «Notas de secuenciación» del `spec.md` advierten evitar. |
| `docs/api.delta.yaml` | Ningún endpoint cambia. `api.yaml` está declarado intocable en Reglas de Negocio, y `API_CONTRACT_MODE: delta` sobrevive sin modificación. |
| `docs/data-model.md` | Ninguna tabla ni tipo de dato nuevo. |
| `docs/diagram.md` / `docs/component.md` | Son los artefactos del modo `full`, que este proyecto no usa. |

En su lugar, el rol de contrato aprobable-antes-de-implementar lo cumple
`docs/docs-as-code-mermaid.md`, que es además un entregable real de la historia (AC-8).

## Flujos afectados

Ninguno en el sentido del pipeline: esta historia no crea, modifica ni deprecia ningún
caso de uso del ledger. **Sí crea 4 `flows/*.md` que documentan casos de uso ya
implementados y no documentados** (AC-1), sin cambiar su comportamiento:

| Flow nuevo | Módulo | Trigger | Documenta |
|---|---|---|---|
| `record-opening-balance.md` | accounts | rest | `RecordOpeningBalanceCommand` (hu-0025) |
| `merge-transfers.md` | transactions | rest | `MergePendingTransfersCommand` (hu-0025) |
| `dry-run-preview.md` | shared | rest | `DryRunPolicy` (hu-0025) — cierra el link roto de `reverse-transaction.md:32` |
| `retry-transient-failure.md` | shared | rest | `RetryPolicy` (hu-0025) |

Los otros 40 flows se modifican **solo en formato**: se les inserta el `sequenceDiagram`,
se les quita la clave `view:` del frontmatter y la línea `**Diagrama:** dynamic view …`.

**5 de esos 40 además se mudan:** los de `apps/ledger/docs/shared-kernel/flows/`
(`event-store-append`, `rebuild-all`, `rebuild-projection`, `verify-balances`,
`verify-chain`) pasan a `libs/cqrs/docs/flows/` con `module: cqrs` en el frontmatter.

## Componentes del módulo

Ningún componente de runtime se agrega ni se modifica: `apps/ledger/src/` no se toca.

El único artefacto de código nuevo es **`tools/validate-diagrams.ts`** (más su
`tools/validate-diagrams.spec.ts`), que no pertenece a ningún módulo del ledger — es
tooling del workspace.

**Trabajo de migración explícito** sobre los 10 nodos que no resuelven (detalle y
ubicación exacta en `docs/research.md`, Decisión 3):

| Acción | Nodos |
|---|---|
| Pasan a subgraph | `Account Events`, `Transaction Events`, `AccountException`, `TransactionException` |
| Pasan a cilindro | `ProjectionCheckpoints`, `AssertionStatusStore`, `AdjustmentAuditStore` |
| Se eliminan | `PostgresReadModelStoreSpec` |
| Se renombran al símbolo real | `SwaggerBuilder` → `buildSwaggerDocument`, `PostingFactory` → `toPostingLines` |
| Se parte en dos nodos | `canonicalJson + sha256Hex` |

**Movimiento de archivos** (AC-2, corregido): `apps/ledger/docs/shared-kernel/` deja de
existir. Sus 5 flows van a `libs/cqrs/docs/flows/`; el diagrama de componentes de
`component.md` —más `read_model_upsert` y `contract_test` (AC-1)— se incorpora al
`libs/cqrs/README.md` que ya existe; `diagram.md` se absorbe en
`apps/ledger/docs/shared/flows/command-dispatch.md` junto con `auth_context_policy`.

## Impacto en Arquitectura Global

**¿Toca arquitectura global? Sí — pero de forma atípica: cambia el formato de los
artefactos de Nivel 1 y 2, no la arquitectura que describen.**

No hay ningún nodo ni arista que agregar o quitar. Ningún app, módulo, lib, actor o
integración nace, muere ni cambia de relación. Lo que cambia es **dónde y cómo** vive la
descripción de L1/L2:

- `docs/architecture/landscape.c4` **se elimina**.
- `docs/architecture/context.md` (L1) y `containers.md` (L2) pasan a ser la única fuente
  de verdad de su nivel, con su `graph TB` legado normalizado a `flowchart`.
- Los nodos que hoy están **solo** en `landscape.c4` se incorporan a esos dos `.md` antes
  de borrarlo (AC-3, con el reparto elemento por elemento ya tabulado en el `spec.md`).
- Los 3 componentes L3 que `landscape.c4` declaraba dentro de `shared` (`commandBus`,
  `queryBus`, `eventStore`) van al diagrama de componentes de `shared-kernel`, **no** a
  `containers.md` — eran nivel 3 filtrado en un archivo de nivel 1+2.

> **Instrucción explícita para `/sync`:** esta historia **ya deja reescritos**
> `context.md` y `containers.md` como parte de AC-3. **No invocar `/architecture`** para
> re-derivar nada — no hay cambio estructural que promover, y una segunda pasada
> reintroduciría el formato o el contenido que AC-3 acaba de reconciliar.

## Validación de Quality Gates

Constitución encontrada: `docs/rules.md` v1.2.0.

| Gate | Resultado | Justificación |
|---|---|---|
| **Simplicity** | ✅ | La historia **retira** una capa (LikeC4 + ~120 líneas de maquinaria delta) y agrega un script de ~150 líneas. Saldo neto negativo en complejidad. |
| **Anti-Abstraction** | ✅ | Regex + `fs` de Node en vez de TypeScript Compiler API o una librería de parsing de Mermaid. Se usa la sintaxis nativa de Mermaid (formas de nodo) en lugar de inventar una convención de marcado propia. |
| **Integration-First** | ✅ | `docs/docs-as-code-mermaid.md` fija el contrato de formato y el comportamiento del gate **antes** de tocar los ~50 archivos. No hay contrato OpenAPI porque no hay endpoints — se documenta acá para que la ausencia no se lea como omisión. |
| **Test-First** | ✅ | `tools/validate-diagrams.spec.ts` se escribe antes que el script (Artículo 4, alcance *todo el repo*). El `spec` debe cubrir cada forma de declaración como caso propio — `export async function`, `export abstract class`, `export const`, `export type`, `export default class` — porque un modificador olvidado produce un fallo silencioso **al revés**: el gate marca rota una referencia sana y la reacción natural es corregir el diagrama en lugar del script. Es el bug que ya apareció al medir. |

**Artículos revisados sin conflicto:** los Artículos 1-3, 5-7 y 9-13 tienen alcance
`apps/ledger` o `libs/cqrs` sobre código de dominio, que esta historia no toca. El
Artículo 8 (comentarios en inglés) aplica a `tools/validate-diagrams.ts`.

Sin excepciones a la constitución.

## Riesgos conocidos

1. **Traducción manual de 47 vistas.** No hay conversor automático; cada `sequenceDiagram`
   se escribe a mano desde su `dynamic view`. La regla de traducción 1:1 acota el riesgo
   pero no lo elimina. Mitigación: el gate detecta nombres muertos, no traducciones
   incompletas — conviene revisar por módulo, no de a un archivo.
2. **Homónimos.** Una clase con el mismo nombre en dos módulos resuelve aunque el diagrama
   nombre al del módulo equivocado. Falso negativo aceptado: el gate existe para detectar
   nombres muertos, no pertenencia al módulo correcto.
3. **AC-7 vive fuera del repositorio.** Los 4 artefactos de `~/.agents/` no entran en el
   commit y se versionan por separado. Riesgo de que el repo quede migrado y las skills
   no: hacer AC-7 en el mismo tramo que AC-6 para que el profile y las skills se muevan
   juntos.
4. **La base no está fresca.** El relevamiento se hizo sobre `feat/core` con 24 archivos
   sin commitear, no sobre `develop`. Si el árbol cambió, refrescar con `/scan spec-0033`
   antes de `/plan`.
