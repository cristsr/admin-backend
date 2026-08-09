# hu-0024: Integridad verificable del event store

> Origen: [`docs/proposals/formance-ledger-ideas.md`](../../../docs/proposals/formance-ledger-ideas.md)
> — hallazgos **F-5** (cadena de hashes), **F-6** (memento) y **F-10** (idempotency hash).
> Épica: [EP-6](../../ledger/EP-6-formance.md), Ola 1.

## Historia de Usuario

**Como** responsable de la integridad contable del ledger
**Quiero** que el event store sea criptográficamente verificable y que la idempotencia detecte
reusos de referencia con datos distintos
**Para** que ninguna alteración del stream pase inadvertida y ningún comando se pierda en
silencio cuando un cliente automatizado reutiliza una referencia externa por error

## Criterios de Aceptación

### AC-1: Serialización canónica determinista

Existe una función de serialización canónica del evento (envelope + payload) que produce
**siempre** el mismo string para el mismo evento, independientemente del orden de inserción de
las claves en el objeto. `JSON.stringify` sobre un objeto de forma libre no es aceptable.

La canonicalización sigue **JCS — JSON Canonicalization Scheme (RFC 8785)**: claves ordenadas
por code unit UTF-16, salida compacta sin espacios en blanco, escapes mínimos y serialización
de números al estilo ECMAScript. La implementación se valida contra los vectores de prueba
oficiales del RFC, de modo que la corrección sea verificable y no dependa de nuestro criterio.

Los montos se serializan como strings decimales (RNF-2), nunca como `number`.

### AC-2: Cada evento persiste el hash de la cadena

`event_store` gana una columna `hash`. Al hacer append, el hash del evento se calcula como
`sha256(hash_del_evento_anterior || serialización_canónica_del_evento)` y se persiste en la
misma operación atómica del append (INV-7).

La cadena es **por usuario** (INV-9): el "evento anterior" es el último evento de ese
`user_id`, no el último global.

El hash se persiste como texto hexadecimal en minúscula de 64 caracteres (`char(64)`), para
que sea legible tal cual en logs y en el reporte de `verify-chain` sin decodificar nada. El
primer evento de un usuario encadena contra la **cadena vacía** (`""`), es decir
`hash₁ = sha256("" || canónica₁)`; no se usa un centinela de ceros.

### AC-3: Al hash solo entran las decisiones, nunca los derivados

El input del hash se define por **exclusión, no por enumeración por tipo de evento**: entra el
`payload` completo del evento más los campos del envelope, salvo las exclusiones declaradas
abajo. Así la regla vale igual para `TransactionRecorded`, `AccountOpened` o `AssertionRaised`,
y un campo nuevo del payload queda cubierto automáticamente en vez de quedar fuera del hash sin
que nadie lo note.

Campos del envelope que entran: `event_id`, `user_id`, `aggregate_type`, `aggregate_id`,
`sequence`, `event_type`, `schema_version`, `client_id`, `external_ref` y `occurred_at`. Del
payload entra todo (postings, montos, monedas, fecha contable, y lo que cada evento agregue).

**No** entran valores derivados ni calculados por proyecciones, ni timestamps que la
infraestructura asigna después del hecho: `recorded_at` y `global_position` quedan excluidos
explícitamente. El motivo es que un cambio futuro en cómo se calcula un derivado invalidaría
retroactivamente toda la cadena histórica.

Agregar una columna nueva al `event_store` sin decidir de qué lado de la exclusión cae debe ser
imposible de hacer por accidente (p. ej. derivando el input del hash de un tipo que rompa la
compilación al aparecer un campo no clasificado).

### AC-4: Comando de verificación de la cadena

`apps/ledger/src/tooling/rebuild.command.ts` gana un subcomando `verify-chain`, al lado de
`verify-balances`, que recorre el stream en orden de `global_position`, recomputa cada hash y
compara contra el persistido.

**Alcance:** `--userId` es opcional. Con el flag verifica esa cadena; sin él recorre las de
todos los usuarios — el uso de CI no conoce los ids de antemano — y emite un resumen final con
el total de usuarios y de rupturas.

**Ante una discrepancia no se detiene:** termina el recorrido y reporta **todas** las rupturas,
cada una con su `global_position`, su `event_id`, el hash esperado y el obtenido. Conocer el
alcance completo del daño en una sola corrida vale más que ahorrar el recorrido.

**Exit code:** `0` si todas las cadenas verifican, `1` si hubo al menos una discrepancia, para
que el comando sea usable tal cual como paso de CI.

### AC-5: La idempotencia registra el hash de los inputs

`event_store` gana una columna `external_ref_hash`. Al ejecutar un command con `external_ref`,
se calcula el hash canónico de los inputs del command y se persiste junto al evento ancla.

Los "inputs" son el objeto `Command` completo más el `userId`, canonicalizados con la misma
función de AC-1. Se excluyen los metadatos de transporte, que no son intención de negocio: la
propia `external_ref`, el `clientId`, y cualquier id de correlación o timestamp generado por el
request. El mismo command reenviado desde otro cliente o con otro trace id debe resolverse como
acierto de idempotencia, no como conflicto.

### AC-6: Reuso de referencia con inputs distintos falla explícitamente

Cuando llega un command con una `external_ref` ya vista:

- si el hash de los inputs **coincide** con el registrado → se devuelve el resultado original
  (comportamiento actual, INV-10);
- si el hash **no coincide** → se rechaza con el código de error estable
  `IDEMPOTENCY_INPUT_MISMATCH` (HTTP 409), indicando la `external_ref` en conflicto.

Hoy este segundo caso devuelve silenciosamente el resultado de la operación anterior y la
transacción nueva se pierde sin error ni traza.

### AC-7: La respuesta señala los aciertos de idempotencia

Cuando la respuesta proviene de un acierto de idempotencia (AC-6, primer caso), la respuesta
HTTP incluye la cabecera `Idempotency-Hit: true`. Cuando la operación se ejecutó de verdad, la
cabecera no está presente.

### AC-8: El esquema no admite eventos sin hash

No hay tolerancia a eventos sin hash: la migración de creación del `event_store` se reescribe
sobre base limpia (CLAUDE.md — fase de desarrollo, sin datos en producción).

- `hash` es `char(64) NOT NULL`: todo evento persistido está encadenado.
- `external_ref_hash` es `char(64) NULL`, con un CHECK que lo exige exactamente cuando hay
  `external_ref`: `CHECK ((external_ref IS NULL) = (external_ref_hash IS NULL))`.

En consecuencia, ni `verify-chain` ni la comparación de idempotencia necesitan una rama de
"hash ausente" — un evento sin hash es un estado que la base no puede representar.

## Reglas de Negocio

- El cálculo del hash **no puede** convertirse en un invariante del dominio: vive en el
  adaptador `PostgresEventStore` como defensa en profundidad, igual que el trigger append-only
  (§3.7). El núcleo no sabe que existe.
- La misma función de canonicalización sirve a AC-1 y a AC-5. Implementarla dos veces es un
  error de diseño: las dos garantías dependen de que produzca exactamente el mismo string.
- El encadenamiento serializa los appends **por usuario**. En finanzas personales la
  contención resultante es irrelevante; el diseño no debe asumir un lock global.

## Resolución de Ambigüedades

- **AC-1:** ¿Qué algoritmo de canonicalización, más allá de "claves ordenadas"? → **JCS
  (RFC 8785)**: orden por code unit UTF-16, salida compacta, escapes mínimos, números
  ECMAScript. Se valida contra los vectores oficiales del RFC, así que la corrección es
  verificable y no queda librada a nuestro criterio en los casos de borde.
- **AC-2:** ¿Cómo se representa el hash y contra qué encadena el evento génesis? → Texto
  **hex en minúscula `char(64)`** (legible en logs y en el reporte sin decodificar) y génesis
  contra la **cadena vacía** `""`, no un centinela de ceros.
- **AC-3:** La enumeración de campos era específica de eventos de transacción y no decía nada
  para `AccountOpened` o `AssertionRaised`. → El input se define **por exclusión**: payload
  completo + envelope, excluyendo `recorded_at` y `global_position`. Un campo nuevo del payload
  queda cubierto automáticamente en vez de caer fuera del hash sin que nadie lo note.
- **AC-4:** ¿Se detiene en la primera ruptura o reporta todas? ¿Exit code para CI? → **Recorre
  todo y reporta todas**, con exit `1` si hubo al menos una y `0` si la cadena está limpia.
- **AC-4:** ¿Una corrida cubre un usuario o todos? → `--userId` **opcional**; sin el flag
  recorre todos los usuarios y agrega un resumen, porque el uso de CI no conoce los ids de
  antemano. Vive como subcomando de `rebuild.command.ts`, junto a `verify-balances`.
- **AC-5:** ¿Qué son "los inputs del command"? → El objeto `Command` completo más el `userId`,
  **excluyendo los metadatos de transporte** (`external_ref`, `client_id`, ids de correlación,
  timestamps del request). El mismo command reenviado desde otro cliente es un acierto de
  idempotencia, no un 409.
- **AC-8:** ¿Tolerar eventos sin hash o `NOT NULL` desde el día uno? → **`NOT NULL`** sobre base
  limpia (reescribiendo la migración de creación del `event_store`, habilitado por CLAUDE.md).
  `external_ref_hash` queda nullable con un CHECK que lo exige exactamente cuando hay
  `external_ref`. Desaparece la rama de tolerancia que nunca se ejercitaría.

## Fuera de Alcance

- Modo asíncrono de cálculo del hash (Formance ofrece `HASH_LOGS=ASYNC`). Se decide síncrono;
  si el costo apareciera, se revisa entonces.
- Export/import del log verificando la cadena (F-7): diferido, sin condición de disparo
  cumplida.
- Separar `reference` de negocio de la clave de idempotencia (F-11): diferido; esta historia
  mitiga el fallo peligroso sin cambiar el contrato.

## Technical Context

### Apps / libs objetivo

- `libs/cqrs` — event store (`PostgresEventStore`, `InMemoryEventStore`), `IdempotencyPolicy`,
  `CommandResult`, migración `CreateEventStore`
- `apps/ledger` — tooling (`verify-chain` en `rebuild.command.ts`), spec de integración del
  event store
- `libs/shared` — la función de canonicalización JCS, como utilidad genérica fuera de `cqrs`

### Artefactos a reutilizar

- `event-store.contract.ts` — suite compartida por el adaptador Postgres y el in-memory; el
  encadenamiento y `external_ref_hash` entran ahí para obligar a ambos al mismo comportamiento
- `IdempotencyPolicy` + `CommandResult` — el lookup por `external_ref` y el flag
  `idempotentReplay: true` ya existen; AC-6 se agrega a la política y AC-7 deriva la cabecera de
  ese flag vía `command-result.interceptor.ts`
- `rebuild.command.ts` + `ConsistencyVerifier` — `verify-chain` se suma como subcomando
  siguiendo el patrón de parseo de flags y salida de `verify-balances`

### Patrones obligatorios

- Hexagonal estricto: el cálculo del hash vive solo en infraestructura; el núcleo no lo conoce
  (verificado por `hexagonal-isolation.spec.ts`)
- TDD con contract test primero: el comportamiento nuevo se especifica en
  `event-store.contract.ts` antes de implementarlo en los adaptadores
- Canonicalización como función pura, sin I/O ni inyección, validada contra los vectores de
  prueba del RFC 8785
- `abstract class` como token DI si el cálculo de hash se expone como puerto inyectable en lugar
  de función importada

### Restricciones técnicas

- Se reescribe la migración `CreateEventStore` sobre base limpia en vez de agregar una
  incremental; la base se regenera (habilitado por CLAUDE.md, fase de desarrollo sin datos en
  producción)
- No tocar `apps/finances` (monolito congelado), ni directa ni indirectamente
- JCS: preferir una implementación npm robusta de RFC 8785 si existe una madura; hoy no hay
  ninguna candidata en el árbol de dependencias, así que la evaluación queda para `/scan`. Se
  implementa en el repo solo si no aparece una adecuada. En cualquier caso se valida contra los
  vectores oficiales del RFC

### Deuda técnica relevante

- `PostgresEventStore.insertAll` arma el INSERT con placeholders posicionales a mano
  (`Array.from({ length: 12 })` + contador `idx` acoplado al número de columnas). Agregar `hash`
  y `external_ref_hash` obliga a tocar ese conteo en varios lugares a la vez: es frágil y fácil
  de desincronizar
