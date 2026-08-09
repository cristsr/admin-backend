# research: hu-0024 — Integridad verificable del event store

Seis decisiones no triviales. Las cinco primeras se resolvieron con el desarrollador durante
`/design`; la sexta la resolvió el diseño y queda registrada para revisión.

---

## Decisión 1: Implementación de la canonicalización JCS

- **Contexto:** AC-1 fija RFC 8785 como el estándar, pero no quién lo implementa. La corrección
  de la cadena entera (AC-2) y de la idempotencia (AC-5) dependen de que produzca *exactamente*
  el mismo string siempre. El desarrollador pidió preferir una librería npm robusta si existe una
  madura.
- **Opciones evaluadas:**
  1. **`canonicalize@3.0.0`** — Apache-2.0, 16 KB desempaquetado, tipos propios
     (`lib/canonicalize.d.ts`, sin `@types` de terceros), repo `github.com/erdtman/canonicalize`,
     maintainer `samuelerdtman <samuel@erdtman.se>` — **Samuel Erdtman es co-autor del RFC 8785**.
     Pro: procedencia inmejorable, superficie mínima. Contra: una dependencia más.
  2. `json-canonicalize@2.0.0` — implementa el mismo RFC, sin la procedencia del autor del
     estándar.
  3. Implementación propia siguiendo el RFC — sin dependencia, pero los casos de borde (escapes
     Unicode, serialización de números ECMAScript) quedan librados a nuestro criterio y a nuestra
     suite.
- **Elegida:** `canonicalize@3.0.0` — el Anti-Abstraction Gate manda usar la librería directa
  antes de envolverla, y la autoría del co-autor del RFC es la mejor garantía disponible de que
  los casos de borde están bien. Se importa directo, sin wrapper propio más allá de la función
  de dos líneas que agrega el SHA-256.
- **Descartadas por:** `json-canonicalize` no aporta nada sobre la elegida; la implementación
  propia viola el Anti-Abstraction Gate sin beneficio.
- **Trampa registrada:** `@tufjs/canonical-json` **no sirve** — implementa el canonical JSON de
  TUF, que no es RFC 8785. No confundir al instalar.
- **Validación:** los vectores de prueba oficiales del RFC 8785 se ejecutan igual, contra la
  librería. Si un día se cambia de implementación, la suite lo detecta.

---

## Decisión 2: Serialización de los appends por usuario (G-3)

- **Contexto:** la cadena es por usuario (AC-2), pero el único constraint del esquema es
  `UNIQUE (aggregate_id, sequence)`, que serializa por **agregado**. Dos appends concurrentes a
  agregados distintos del mismo usuario leerían el mismo `prev_hash` y producirían dos eventos
  que se declaran sucesores del mismo predecesor: la cadena queda rota y ningún constraint lo
  nota.
- **Opciones evaluadas:**
  1. **`pg_advisory_xact_lock(hashtext(user_id))`** al inicio del append. Pro: una línea, sin
     tabla ni columna nueva; Postgres lo libera solo en el commit o el rollback; es re-entrante
     dentro de la misma transacción, así que `withTransaction` con varios streams del mismo
     usuario funciona sin código extra. Contra: colisiones de `hashtext` sobre-serializan a dos
     usuarios distintos (inofensivo, solo contención).
  2. Tabla `event_chain_head (user_id PK, head_hash)` con `SELECT … FOR UPDATE`. Pro: la cabeza
     queda consultable de un vistazo y no hay que releer el último evento. Contra: tabla nueva,
     migración propia, y un camino especial para el primer append de cada usuario (no hay fila
     que bloquear todavía).
  3. `UNIQUE (user_id, prev_hash)` — no serializa, hace fallar ruidosamente al segundo. Contra:
     convierte concurrencia legítima en un error visible para el cliente.
- **Elegida:** opción 1 — el Simplicity Gate descarta la tabla nueva mientras el `SELECT` de la
  cabeza esté cubierto por un índice, y `idx_event_user (user_id, global_position)` ya existe.
  La opción 3 traslada al cliente un problema que el servidor puede resolver.
- **Descartadas por:** costo de esquema (2) sin caso de uso presente; degradación de la
  experiencia (3).
- **Riesgo aceptado:** dos transacciones que appendearan para los usuarios A y B en orden
  opuesto podrían deadlockear. No es alcanzable hoy: INV-9 garantiza que un command pertenece a
  un único usuario, así que ninguna transacción toma dos locks de usuario.

---

## Decisión 3: Cómo llega `external_ref_hash` desde el command hasta la fila (G-2)

- **Contexto:** AC-5 deriva el hash de los inputs del `Command`, pero el `EventStore` solo recibe
  `EventEnvelope[]` — nunca ve un `Command`. Solo `IdempotencyPolicy` lo tiene.
- **Opciones evaluadas:**
  1. **`AuthContext` y `EventEnvelope` ganan `externalRefHash`**, simétrico a cómo viaja hoy
     `externalRef`: la política lo calcula, `EnvelopeFactory` lo estampa en el ancla con la misma
     línea `index === 0`, el store lo persiste verbatim. Pro: cero cambios en la firma del
     puerto, una sola escritura atómica. Contra: el envelope gana un campo derivado.
  2. Parámetro nuevo en `EventStore.append()`. Contra: rompe la firma para todos los callers y
     los dos adaptadores por un valor que solo aplica al ancla.
  3. Método aparte (`stampIdempotencyHash`) después del append. Contra: dos escrituras — si la
     segunda falla queda un ancla sin hash — y el `UPDATE` que requeriría está prohibido por el
     trigger append-only (Artículo 3).
- **Elegida:** opción 1.
- **Descartadas por:** costo de contrato (2); no atomicidad y choque con el Artículo 3 (3).

### Corolario: cómo se propaga el contexto enriquecido por el chain

La opción elegida abre un problema propio: `CommandNext = () => Promise<CommandResult>` no
admite que una política reemplace el `AuthContext` que ven las capas de abajo — el bus captura
el `ctx` original en su `reduceRight`.

- **Opciones evaluadas:**
  1. **`CommandNext = (ctx: AuthContext) => Promise<CommandResult>`** — el chain pasa a ser
     contextual: cada política recibe un contexto y decide con cuál sigue. Pro: la idempotencia
     queda íntegra dentro de su política; es el patrón estándar de middleware. Contra: toca las
     tres políticas existentes (`next()` → `next(ctx)`) y el `reduceRight` del bus.
  2. `PolicyCommandBus.dispatch` calcula el hash antes de armar el chain. Pro: no cambia el
     protocolo de políticas. Contra: mete conocimiento de idempotencia en el bus, que hoy no
     sabe nada de `external_ref` — la semántica está deliberadamente en la política.
- **Elegida:** opción 1 — son seis líneas mecánicas repartidas en cinco archivos, y dejan la
  responsabilidad donde ya vive. La opción 2 ahorra el refactor a costa de acoplar el bus.
- **Descartada por:** filtración de responsabilidad (2).

---

## Decisión 4: Por dónde lee el hash el verificador (G-5)

- **Contexto:** `verify-chain` necesita el `hash` persistido, pero la Regla de Negocio de la HU
  dice que el núcleo no sabe que el hash existe, y `StoredEvent` es un tipo de **dominio**.
- **Opciones evaluadas:**
  1. **Puerto propio `EventChainReader`** (`abstract class` en `libs/cqrs`) con adaptador
     Postgres. Pro: `StoredEvent` queda intacto; el `ChainVerifier` recibe el puerto por
     constructor igual que `ConsistencyVerifier` recibe `EventStore` y `ReadModelStore`;
     testeable con un doble sin base. Contra: una abstracción más.
  2. `StoredEvent` gana `hash`. Contra: contradice la Regla de Negocio de frente y expone el
     hash a todo consumidor del puerto, incluidos projectors que no lo necesitan.
  3. SQL directo desde `apps/ledger/src/tooling/` (no vigilado por `hexagonal-isolation.spec.ts`).
     Contra: ata el verificador a PostgreSQL y lo deja sin test sin una base viva.
- **Elegida:** opción 1. La abstracción se justifica ante el Anti-Abstraction Gate porque el
  puerto **es** lo que hace verificable el requisito: sin él, AC-4 no tiene test sin base.
- **Descartadas por:** violación de la regla de negocio (2); no testeabilidad (3).

### Asimetría deliberada entre los dos hashes

`externalRefHash` **sí** vive en `EventEnvelope`; el `hash` de cadena **no**. No es una
inconsistencia:

| | `externalRefHash` | `hash` |
|---|---|---|
| Quién lo produce | la aplicación (`IdempotencyPolicy`, desde el command) | la infraestructura (el adaptador, desde el envelope) |
| Quién lo consume | la aplicación (comparación de AC-6) | solo el verificador |
| Dónde vive | `EventEnvelope` (es un input) | fuera del dominio (es un derivado del almacenamiento) |

---

## Decisión 5: Qué campos entran al hash de cadena (AC-3)

- **Contexto:** AC-3 pide que agregar una columna al `event_store` sin clasificarla sea imposible
  por accidente. Una lista de exclusión en runtime no da esa garantía: se olvida en silencio.
- **Elegida:** una **función de proyección explícita** `chainHashInput(envelope)` que devuelve un
  tipo `ChainHashInput` derivado con `Omit<EventEnvelope, …>`. Agregar un campo a
  `EventEnvelope` lo agrega a `ChainHashInput`, y el literal de la función deja de compilar hasta
  que alguien decida si entra o se excluye. La garantía la da el compilador, no la disciplina.
- **Exclusiones:** `recordedAt` (timestamp que asigna la infraestructura), `globalPosition` (no
  está en `EventEnvelope`, solo en `StoredEvent`) y **`externalRefHash`**.
- **Por qué se excluye `externalRefHash`:** es un valor derivado. Si algún día cambiara la forma
  de canonicalizar los inputs del command, todos los `external_ref_hash` cambiarían y la cadena
  histórica entera quedaría inválida — exactamente el modo de falla que AC-3 existe para evitar.
- **`occurredAt` se serializa como ISO 8601** (`toISOString()`) antes de canonicalizar: `Date` no
  es JSON-safe y su representación depende del runtime.

---

## Decisión 6: Convivencia de `DUPLICATE_EXTERNAL_REF` con el código nuevo (G-7)

- **Contexto:** `map-domain-error.md` reserva hoy `DUPLICATE_EXTERNAL_REF` (409) para *"mismo
  `external_ref` con un command distinto/conflictivo"* — literalmente el caso que AC-6 bautiza
  `IDEMPOTENCY_INPUT_MISMATCH`. Quedarían dos códigos para un caso.
- **Opciones evaluadas:**
  1. **Repartir por capa:** `DUPLICATE_EXTERNAL_REF` se queda como contrato del **puerto**
     `EventStore` (lo lanza el índice único ante una carrera, alcanzable por cualquier caller que
     use el store sin la política); `IDEMPOTENCY_INPUT_MISMATCH` es el contrato de la **política**
     y el único de los dos que el API HTTP emite.
  2. Deprecar `DUPLICATE_EXTERNAL_REF` y usar solo el nuevo. Contra: el puerto seguiría
     necesitando una excepción tipada para la violación del índice único, que no es lo mismo que
     un mismatch de inputs — se perdería precisión diagnóstica.
  3. Reusar `DUPLICATE_EXTERNAL_REF` para el caso de AC-6 y no agregar código nuevo. Contra: la
     HU pide un código estable y específico, y cambiar el significado de un código publicado es
     un cambio breaking del contrato.
- **Elegida:** opción 1 — los dos códigos describen fallas distintas en capas distintas. Se
  actualiza la nota de `map-domain-error.md` y del `api.yaml`, que hoy dicen que
  `DUPLICATE_EXTERNAL_REF` cubre el caso de "command distinto".
- **Descartadas por:** pérdida de precisión (2); ruptura de contrato (3).
