# research: spec-0033

Decisiones técnicas no triviales de la migración LikeC4 → Mermaid. Todas se apoyan en
mediciones sobre el repo, no en estimaciones.

---

## Decisión 1: Cómo el validador resuelve un nombre a un símbolo del código

- **Contexto:** AC-5 exige que cada identificador de un bloque Mermaid corresponda a un
  símbolo real. Sin un modelo único que ate diagrama y código, este chequeo es lo único
  que impide la divergencia — pero tiene que ser barato, o el job `docs` se vuelve el
  cuello de botella del CI.

- **Opciones evaluadas:**

  1. **Regex sobre declaraciones exportadas en `.ts`.**
     *Pros:* cero dependencias nuevas, milisegundos, trivial de testear.
     *Contras:* no distingue homónimos en módulos distintos; no entiende re-exports.
  2. **TypeScript Compiler API (`ts.createProgram`).**
     *Pros:* resolución exacta, entiende re-exports y aliases.
     *Contras:* levanta el programa completo (~segundos), y ata un gate de documentación
     a la versión del compilador. Es la definición de martillo para un clavo.
  3. **Índice precomputado (`nx graph` + parseo).**
     *Pros:* reusa tooling existente.
     *Contras:* `nx graph` da dependencias entre proyectos, no símbolos exportados. No
     responde la pregunta que hay que hacer.

- **Medición previa (decisiva):** se extrajeron los 101 nombres de componente únicos
  declarados en los 6 `.c4` y se intentó resolverlos con un primer regex:

  ```
  (export )?(abstract )?(class|interface|type|enum|const|function) <Nombre>\b
  ```

  **Resultado: 90/101 (89%).** Al auditar los 11 fallos apareció un **falso negativo del
  patrón, no del método**: `canonicalJson` existe en
  `libs/shared/src/functions/canonical-hash.ts:24` pero se declara
  `export async function` — el regex no contemplaba `async`. Corregido:

  ```
  ^\s*export\s+(default\s+)?(declare\s+)?(abstract\s+)?(async\s+)?(class|interface|type|enum|const|let|function|function\*)\s+<Nombre>\b
  ```

  **Resultado corregido: 91/101 (90%).** Los 10 restantes no son fallos de resolución —
  son nodos que *no nombran un símbolo* (agrupaciones conceptuales, tablas, archivos de
  test) y que la Decisión 3 reclasifica. Con esa reclasificación, la tasa esperada es 100%.

- **Lección incorporada al diseño:** el patrón se ancla a `^\s*export` y enumera los
  modificadores explícitamente. Un modificador olvidado produce un fallo **silencioso y
  al revés** — el gate reporta rota una referencia que está sana, y la reacción natural
  es corregir el diagrama en lugar del script. Por eso el `spec.ts` de la Decisión 4
  cubre cada forma de declaración como caso propio: `export async function`,
  `export abstract class`, `export const`, `export type`, `export default class`.

- **Elegida:** **opción 1 — regex sobre declaraciones exportadas**, excluyendo `*.spec.ts`.
  El 89% medido en crudo, y 100% tras reclasificar, no justifica el costo de la opción 2.

- **Descartadas por:** la opción 2 viola el **Anti-Abstraction Gate** (envuelve un
  compilador entero para responder «¿existe este nombre?»); la opción 3 no responde la
  pregunta.

- **Riesgo aceptado:** un homónimo en dos módulos resuelve aunque el diagrama nombre al
  del módulo equivocado. Es un falso negativo tolerable: el gate existe para detectar
  nombres *muertos*, no para verificar la pertenencia al módulo correcto.

---

## Decisión 2: Qué raíces de código se consultan por unidad de documentación

> **Revisada tras `/refine`.** La primera versión de esta decisión inventaba un mapa
> `shared-kernel → libs/cqrs` para que el gate resolviera. Eso trataba el síntoma: la
> causa es que **`apps/ledger/docs/shared-kernel/` no debería existir**. Ver Decisión 5.

- **Contexto:** la correspondencia `apps/ledger/docs/<module>/` ↔ `apps/ledger/src/<module>/`
  parece 1:1 pero **no lo es**, y descubrirlo tarde rompería el gate.

- **Hallazgo del relevamiento:** `shared-kernel` **no tiene contraparte en
  `apps/ledger/src/`**. Sus componentes viven en `libs/cqrs`:

  | Componente del doc | Archivo real |
  |---|---|
  | `PolicyCommandBus` | `libs/cqrs/src/application/command-bus/command-bus.ts` |
  | `EventStore` | `libs/cqrs/src/domain/ports/event-store.ts` |
  | `AggregateRoot` | `libs/cqrs/src/domain/aggregate/aggregate-root.ts` |
  | `PostgresEventStore` | `libs/cqrs/src/infrastructure/adapters/event-store/postgres/…` |
  | `DryRunPolicy`, `RetryPolicy`, `IdempotencyPolicy` | `libs/cqrs/src/application/command-bus/policies/` |

  Peor: el módulo `shared` (que sí mapea a `apps/ledger/src/shared/`) **referencia
  componentes de `libs/cqrs`** en sus diagramas — `shared_http_dry_run` nombra a
  `DryRunPolicy`. La resolución estrictamente por módulo fallaría hoy mismo.

- **Opciones evaluadas:**
  1. **Índice global** — un nombre resuelve si existe en cualquier parte de `apps/` o `libs/`.
     *Pros:* imposible de romper. *Contras:* pierde toda noción de módulo.
  2. **Mapa explícito módulo → raíces, con raíces compartidas siempre incluidas.**
     *Pros:* refleja la topología real; el mapa documenta la correspondencia que hoy es
     tácita. *Contras:* hay que mantenerlo al agregar un módulo.
  3. **Derivación por convención de nombre** — `docs/<m>/` → `src/<m>/`.
     *Pros:* cero configuración. *Contras:* **rompe hoy** con `shared-kernel`.

- **Elegida:** **opción 2**, con este mapa — **ya con la mudanza de la Decisión 5
  aplicada**, que lo vuelve 1:1 en todas sus filas:

  ```
  apps/ledger/docs/accounts        → apps/ledger/src/accounts
  apps/ledger/docs/reconciliation  → apps/ledger/src/reconciliation
  apps/ledger/docs/reference       → apps/ledger/src/reference
  apps/ledger/docs/transactions    → apps/ledger/src/transactions
  apps/ledger/docs/shared          → apps/ledger/src/shared
  libs/cqrs/docs                   → libs/cqrs/src
  ```

  Más un conjunto de **raíces compartidas** añadido siempre a la búsqueda de cualquier
  unidad: `libs/cqrs`, `libs/shared`, `apps/ledger/src/shared`.

- **Las raíces compartidas siguen siendo necesarias aunque el mapa sea 1:1.** El módulo
  `shared` del ledger nombra a `DryRunPolicy` y `RetryPolicy` en `shared_http_dry_run` y
  `shared_http_retry_deadlock`, y esas clases viven en `libs/cqrs`. Un adaptador HTTP que
  documenta la política transversal que lo gobierna es legítimo, no un error de frontera:
  el gate debe permitirlo.

- **Descartadas por:** la 3 está medida como rota **antes** de la mudanza; después de
  ella funcionaría, pero seguiría sin cubrir el cruce `shared` → `libs/cqrs`. La 1
  desperdicia la única señal de localidad disponible sin ganar nada a cambio.

- **Por qué se mantiene el mapa explícito aun siendo 1:1:** hace visible qué unidades de
  documentación existen y contra qué se validan. La derivación implícita fue exactamente
  lo que permitió que `apps/ledger/docs/shared-kernel/` sobreviviera dos semanas
  documentando código que ya no estaba ahí.

---

## Decisión 3: Qué nodos se exigen resolver, y cómo se marcan los que no

- **Contexto:** de los 101 nombres declarados, 10 no resuelven ni con el patrón
  corregido. Si el gate los exige a todos, el job arranca en rojo y AC-5 («sobre el repo
  ya migrado, pasa en verde») es inalcanzable. Si no exige ninguno, el gate no sirve.

- **Los 10, clasificados:** no son un problema de método, son **tres cosas distintas
  metidas en el mismo tipo de nodo**.

  | Nodo actual | Qué es en realidad | Destino |
  |---|---|---|
  | `Account Events`, `Transaction Events` | agrupación conceptual (familia de eventos) | **subgraph**, no nodo |
  | `AccountException`, `TransactionException` | familia de excepciones (`AccountNotFoundException`, `UnbalancedTransactionException`, …) | **subgraph**, no nodo |
  | `ProjectionCheckpoints`, `AssertionStatusStore`, `AdjustmentAuditStore` | tablas / read models | **cilindro** `[( )]` |
  | `PostgresReadModelStoreSpec` | archivo de test | **se elimina** (AC-1 ya lo absorbía) |
  | `SwaggerBuilder` | la función es `buildSwaggerDocument` (`apps/ledger/src/config/swagger/ledger-swagger.builder.ts:32`) | **renombrar** |
  | `PostingFactory` | la función es `toPostingLines` (`apps/ledger/src/transactions/application/factories/posting.factory.ts:10`) | **renombrar** |
  | `canonicalJson + sha256Hex` | dos símbolos en un nodo; **ambos existen** (`libs/shared/src/functions/canonical-hash.ts:24` y `:36`) | **dividir en dos nodos** |

- **Opciones evaluadas:**
  1. **Lista blanca plana** — enumerar los nombres exentos en el script.
     *Pros:* trivial. *Contras:* la lista crece sin criterio y nadie sabe por qué está
     cada entrada; encubre errores reales.
  2. **La forma del nodo Mermaid declara su clase.** Rectángulo = símbolo (se exige
     resolver); cilindro `[( )]` = almacenamiento (exento); subgraph = agrupación (exento).
     *Pros:* la exención es visible **en el diagrama**, no escondida en el script; usa
     sintaxis nativa de Mermaid, sin convención inventada. *Contras:* exige disciplina al
     dibujar.
  3. **Exigir que absolutamente todo resuelva.**
     *Pros:* máxima presión. *Contras:* obliga a inventar clases que no existen para
     nombrar una tabla. Absurdo.

- **Elegida:** **opción 2**, con una lista blanca **acotada a actores externos** —
  `Client`, `User`, `Usuario`, `Postgres`, `Keycloak` — que en un `sequenceDiagram` no
  tienen forma que los distinga.

- **Descartadas por:** la 1 degenera en un basurero de excepciones; la 3 fuerza ficciones
  en el modelo.

- **Consecuencia para `/plan`:** los 10 nodos son **trabajo de migración explícito**, no
  hallazgos que resolver sobre la marcha. Cuatro se convierten en subgraph, tres en
  cilindro, uno se borra, dos se renombran al símbolo real y uno se parte en dos.

---

## Decisión 4: Lenguaje y ubicación del validador

- **Contexto:** el Artículo 4 de `rules.md` (TDD estricto, *alcance: todo el repo*) exige
  que todo archivo de producción se preceda por su `*.spec.ts`. El script del gate es
  código de producción.

- **Opciones evaluadas:**
  1. **`tools/validate-diagrams.mjs`** (lo que fijó `/clarify`).
     *Pros:* corre con `node` pelado. *Contras:* testearlo con Jest + `ts-jest` exige
     configuración aparte para ESM/JS — fricción para cumplir el Artículo 4.
  2. **`tools/validate-diagrams.ts` + `ts-node`.**
     *Pros:* `ts-node@10.9.2` **ya está** en `devDependencies` (lo usan los scripts de
     migración de TypeORM), y `jest` + `ts-jest` ya cubren `.ts` sin configuración nueva.
     Cero dependencias agregadas. *Contras:* arranque marginalmente más lento.
  3. **Un target de Nx.**
     *Pros:* integrado al grafo. *Contras:* un `project.json` entero para un script de
     validación de docs. Falla el Simplicity Gate.

- **Elegida:** **opción 2** — `tools/validate-diagrams.ts`, invocado como
  `ts-node tools/validate-diagrams.ts` desde el script npm `docs:validate`, con su
  `tools/validate-diagrams.spec.ts` escrito primero.

- **Descartadas por:** la 1 pone una barrera de configuración justo delante del artículo
  que más se invoca en este repo; la 3 es infraestructura desproporcionada.

- **⚠ Refina una decisión de `/clarify`:** el registro de ambigüedades fijó `.mjs`. El
  cambio a `.ts` es una consecuencia del Artículo 4 que no se evaluó en ese momento.
  AC-4 y AC-5 del `spec.md` quedan actualizados en consecuencia.

---

## Decisión 5: Dónde vive la documentación de `shared-kernel`

- **Contexto:** `apps/ledger/docs/shared-kernel/` documenta un módulo que **no existe en
  `apps/ledger/src/`**. `libs/cqrs/README.md` lo declara textualmente:

  > *"Extracted from `apps/ledger/src/shared-kernel` on 2026-07-27. See
  > `docs/decisions.md` for the reasoning."*

  El código se fue a `libs/cqrs`; la documentación se quedó. `libs/cqrs` **ya tiene su
  propio `README.md`** con una tabla completa de qué vive ahí — así que hoy hay dos
  documentos describiendo el mismo código en dos lugares distintos.

- **Por qué no se detectó antes:** ni `/clarify` ni la primera pasada de `/design` lo
  vieron. El modelo LikeC4 lo ocultaba activamente: `shared-kernel.c4` declara sus
  componentes bajo el FQN `admin.ledger.shared.*`, o sea que el modelo afirmaba que ese
  código pertenecía al app `ledger`. La primera versión de la Decisión 2 llegó a inventar
  un mapa `shared-kernel → libs/cqrs` para que el gate resolviera — resolviendo el
  síntoma y consolidando el error.

- **Opciones evaluadas:**
  1. **Mover `apps/ledger/docs/shared-kernel/` → `libs/cqrs/docs/`.**
     *Pros:* la documentación sigue al código; el mapeo queda 1:1; el ledger queda con sus
     5 módulos reales. *Contras:* mueve archivos en una historia de formato.
  2. **Absorber los 5 flows en `libs/cqrs/README.md` y borrar la carpeta.**
     *Pros:* menos archivos. *Contras:* `event-store-append.md` y `verify-chain.md`
     documentan invariantes (INV-7, INV-12, encadenamiento de hashes) que un README
     comprimiría o perdería.
  3. **Dejarla donde está.**
     *Pros:* no agranda la historia. *Contras:* perpetúa la duplicación y obliga al gate a
     cargar un mapa que existe solo para sostener el error.

- **Elegida:** **opción 1 — mover a `libs/cqrs/docs/`.** Los 5 flows pasan con
  `module: cqrs` en el frontmatter; el diagrama de componentes de `component.md` se
  incorpora al `README.md` que la lib ya tiene; `diagram.md` se absorbe en
  `apps/ledger/docs/shared/flows/command-dispatch.md`. Cumple la regla de biyección
  código ↔ documentación sin duplicar nada.

- **Descartadas por:** la 2 pierde contenido con valor real; la 3 deja el gate cargando un
  mapa cuya única función es tapar una frontera mal puesta.

- **Consecuencia sobre los ACs:** AC-2 decía «cubriendo los 6 módulos» y «`shared-kernel`
  no tiene `README.md` y se le crea». Ambas afirmaciones quedan corregidas: son **5
  módulos del ledger + `libs/cqrs`**, y el README de la lib **ya existe** — se le agrega
  el diagrama, no se crea de cero.

- **Fuera de alcance, anotado:** `libs/shared` también tiene `README.md` y contiene
  símbolos que los diagramas del ledger nombran (`canonicalJson`, `sha256Hex`, `Money`).
  No se le crea `docs/` en esta historia; entra al gate solo como raíz compartida.
