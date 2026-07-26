# hu-0012: Read-your-writes (RNF-9) + idempotencia por `external_ref` (RF-11)

## Historia de Usuario

**Como** cliente del API del ledger (frontend o automatizador)
**Quiero** poder leer mis propias escrituras inmediatamente después de un `2xx`, y que
reintentar una escritura con el mismo `external_ref` sea idempotente
**Para** construir flujos confiables sin ver datos obsoletos ni duplicar operaciones ante
reintentos de red (RNF-9 / RF-11 / INV-10), sin que el ledger replique la maquinaria de
idempotencia de `finances`

> Corresponde a **EP-2.7** del [roadmap del ledger](../../../ledger-roadmap.md).
> Detalle técnico: `work/ledger/EP-2-api.md` (sección EP-2.7). Depende de la idempotencia en
> el `EventStore` (`hu-0002`/`hu-0007`), la proyección síncrona (`hu-0004`/`hu-0006`), el
> andamiaje HTTP (`hu-0009`) y los códigos de error (`hu-0011`).

## Criterios de Aceptación

### AC-1: `external_ref` extraído de header con fallback a body

El param decorator `@ExternalRef()` lee el header `X-External-Ref` (preferido) y, en su
ausencia, hace fallback a `external_ref` del body; devuelve `null` cuando ninguno está
presente. El controller solo transporta ese valor al command; la idempotencia la garantiza el
`EventStore`.

### AC-2: Idempotencia observable en reintentos idénticos

`POST /transactions` dos veces con el mismo `external_ref` (mismo command) emite eventos **una
sola vez** y la segunda respuesta es el **mismo** `CommandAcceptedDto` (misma `streamPosition`),
con status `2xx`. No se emiten eventos nuevos (INV-10 / RNF-4).

### AC-3: Reutilizar un `external_ref` siempre replaya, sea cual sea el command

`IdempotencyPolicy` no compara el command: si existe un evento ancla para
`(user_id, external_ref)`, devuelve el `CommandResult` original con
`idempotentReplay: true` — aunque el segundo command sea distinto del primero. El
`external_ref` se comporta como una **clave de reintento del cliente**, no como un
detector de colisiones.

`DuplicateExternalRefException` (que el `EventStore` lanza cuando el índice único
`(user_id, external_ref)` rechaza la escritura en una carrera) también se atrapa y se
replaya, así que **el `409 DUPLICATE_EXTERNAL_REF` del catálogo RF-14 no es alcanzable
por esta ruta**. El código permanece en `LEDGER_ERROR_CODE` para las rutas que aún no
pasan por el command bus.

### AC-4: `streamPosition` expuesto en body y header, por controller que opte

Toda escritura **de los controllers de EP-2** devuelve `streamPosition` en el
`CommandAcceptedDto` (body) y en el header `X-Ledger-Stream-Position`, vía
`CommandResultInterceptor`.

El interceptor se aplica **por controller** con `@UseInterceptors(CommandResultInterceptor)`,
no globalmente con `APP_INTERCEPTOR`. Hoy lo declaran `AccountsController`,
`LedgerController` y `TransactionsController`. Los controllers de EP-3 ya montados
—`BalanceAssertionController` (`ReconciliationModule`) y `TransferController`
(`TransactionsModule`)— **no** lo declaran, así que sus escrituras devuelven el DTO del
handler sin header de posición. Alinearlos pertenece a EP-3; moverlo a `APP_INTERCEPTOR`
lo resolvería de raíz y queda como opción registrada en `docs/decisions.md`.

### AC-5: Read-your-writes vía proyección síncrona (inline, no atómica)

Tras un `2xx`, un `GET` inmediato del recurso recién escrito ya lo ve, porque las vistas
críticas (`transaction_list`, `proj_postings`, `account_balances`, `account_tree`) se
actualizan **inline dentro del mismo request**: cada handler hace `repository.save(...)` y
acto seguido `dispatcher.dispatch(result.events)` antes de responder.

Las dos operaciones son **secuenciales, no transaccionales**: no existe frontera
transaccional compartida entre el `EventStore` y el `ReadModelStore` (no hay
`UnitOfWork` ni `queryRunner` fuera de las migraciones). El read-your-writes se cumple
en el camino feliz; si la proyección falla después de un append exitoso, el evento queda
persistido y la vista desactualizada hasta el próximo rebuild (`hu-0008`). Hacerlo
atómico exige un `UnitOfWork` compartido y queda fuera de esta HU.

### AC-6: El gancho de posición mínima no existe todavía

`min_position` / `X-Ledger-Min-Position` **no están implementados** — no hay ninguna
ocurrencia en `apps/ledger/src`. Con todas las proyecciones críticas en modo inline el
gancho no aporta nada observable, así que no se construyó ni siquiera como no-op: un
parámetro aceptado-e-ignorado sería una promesa de contrato que el servidor no cumple.

Lo que sí queda listo es la **otra mitad** del mecanismo: toda escritura publica su
`streamPosition` (AC-4), que es el valor que un futuro `min_position` compararía contra
el checkpoint de la proyección. Construir la espera activa pertenece a EP-3, cuando
exista la primera proyección eventualmente consistente.

## Reglas de Negocio

- **INV-10 / RF-11**: la idempotencia vive en el puerto `EventStore.append`, respaldada por el
  índice único `(user_id, external_ref)`; el borde HTTP solo transporta el `external_ref`.
- El ledger **no** replica el `IdempotencyInterceptor` de `finances` ni su tabla propia.
- Fuente del `external_ref`: header `X-External-Ref` preferido, fallback a `body.external_ref`.
- Obligatoriedad: opcional para el frontend en desarrollo; obligatorio para clientes
  automatizados (RF-11). Sin registro de clientes (§2.10), la exigencia por `client_id` se
  difiere; un `@ExternalRef({ required: true })` puede fijarse por endpoint si se decide.
- Read-your-writes por defecto vía proyección inline (decisión de proyección híbrida sesgada
  a síncrono, §8.1); la posición de stream explícita es el mecanismo para las proyecciones
  asíncronas futuras.
- El `external_ref` es una **clave de reintento**, no un detector de colisiones: reenviar el
  mismo ref con otro command replaya el resultado original en vez de rechazarlo.
- TDD estricto.

## Fuera de Alcance

- La implementación de la **espera activa** por checkpoint (`min_position`) para proyecciones
  asíncronas — se difiere a EP-3 junto con el parámetro y el header, que tampoco se exponen
  hoy (ver AC-6).
- La **atomicidad** entre el append al `EventStore` y la actualización del `ReadModelStore`
  (`UnitOfWork` compartido) — ver AC-5.
- La exigencia de `external_ref` por allowlist de `client_id` — diferida hasta integrar el
  sistema de correos.
- La maquinaria de idempotencia en el `EventStore` (INV-10) — pertenece a EP-1; esta HU la
  **expone** en el borde HTTP.

## Technical Context

### Microservicio objetivo
- `apps/ledger`

### Artefactos a reutilizar
- Idempotencia por `external_ref` del `EventStore.append` + índice único `(user_id,
  external_ref)` — de `hu-0002`/`hu-0007`.
- Proyecciones síncronas críticas — de `hu-0004`/`hu-0006`.
- `CommandAcceptedDto` — de `hu-0009`.
- Referencia (no reuso): `apps/finances/.../idempotency/idempotency.interceptor.ts` como
  contraejemplo — el ledger **no** lo replica.

### Artefactos a crear

Ambos ya existen, construidos por `hu-0009` bajo `shared/` (no `shared-kernel/`, según la
decisión de RNF-11 registrada en esa HU):

- `apps/ledger/src/shared/infrastructure/adapters/http/external-ref.decorator.ts` — el
  `@ExternalRef()` de AC-1.
- `apps/ledger/src/shared/infrastructure/adapters/http/command-result.interceptor.ts` — en
  vez de un `stream-position.interceptor.ts` propio, el `CommandResultInterceptor` de
  `hu-0009` ya mapea `CommandResult → CommandAcceptedDto`, setea
  `STREAM_POSITION_HEADER` (`X-Ledger-Stream-Position`) y degrada los replays idempotentes
  a `200`. Esta HU no crea artefactos nuevos: **documenta y verifica** los existentes.

### Patrones obligatorios
- Idempotencia delegada al puerto, no al borde HTTP.
- Toda escritura expone `streamPosition` (body + header).
- TDD estricto.

### Restricciones técnicas
- Read-your-writes depende de que las proyecciones críticas estén en modo síncrono; si alguna
  cae a asíncrona, hay que activar antes la espera por `min_position`.
