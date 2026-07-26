# design: hu-0012

> **Historia de sincronización documental — diseño *as-built*.** El código de esta HU ya
> existía (construido como efecto colateral de `hu-0005` y `hu-0009`) y **manda sobre la
> especificación**: `hu.md` fue corregido para describir el runtime real, siguiendo el
> precedente de HU-0011. Este documento describe el diseño tal como está construido y
> verificado contra el código, no un diseño por construir.

## Decisiones de Diseño

> ⚠️ **Estas decisiones YA fueron appendeadas a [`docs/decisions.md`](../../../docs/decisions.md)
> en esta misma sesión**, bajo la sección `## HU-0012 — Read-your-writes + idempotencia por
> `external_ref` (2026-07-25)`. **`/sync` NO debe volver a appendearlas** — hacerlo produciría
> una entrada duplicada en el log acumulativo. Lo que sigue es el resumen de esa entrada, no
> el original.

- **AC-3 — `external_ref` es clave de reintento, no detector de colisiones:** se mantiene el
  comportamiento implementado; `IdempotencyPolicy` nunca compara el command. Consecuencia:
  `DUPLICATE_EXTERNAL_REF` queda inalcanzable vía HTTP y se documenta como tal.
- **AC-5 — Read-your-writes inline pero no atómico:** `save(...)` + `dispatch(...)` son
  secuenciales sin transacción compartida. Se corrige el AC (afirmaba ACID conjunto), no el
  código. La atomicidad (`UnitOfWork`) se difiere a EP-3.
- **AC-6 — El gancho `min_position` no se construye:** cero ocurrencias en `apps/ledger/src`.
  Se decide **no** agregarlo como no-op — un parámetro aceptado-e-ignorado es una promesa de
  contrato incumplida. Se difiere entero a EP-3.
- **AC-4 — `CommandResultInterceptor` es opt-in, no global:** se mantiene `@UseInterceptors`
  por controller. Mover a `APP_INTERCEPTOR` queda registrado como opción para EP-3.
- **Ubicación de los artefactos:** `shared/infrastructure/adapters/http/`, no `shared-kernel/`,
  según la decisión de RNF-11 de HU-0009. La HU no crea artefactos nuevos.

## Flujo entre componentes

Una escritura idempotente recorre cuatro piezas, todas en el módulo `shared` de `apps/ledger`:

1. **`@ExternalRef()`** (`external-ref.decorator.ts`) extrae el idempotency key en el borde
   HTTP: header `X-External-Ref` preferido (`EXTERNAL_REF_HEADER = 'x-external-ref'`), fallback
   a `external_ref` del body, `null` si ninguno es un string no vacío. Ambas fuentes se recortan
   con `trim()`; un header repetido llega como array y no se acepta. El controller solo lo
   transporta dentro del `AuthContext` — no decide nada.
2. **`IdempotencyPolicy`** (`shared-kernel/application/command-bus/policies/idempotency.policy.ts`),
   segunda del chain del `PolicyCommandBus` tras `AuthenticatedContextPolicy` y antes de
   `OptimisticConcurrencyPolicy` (cableado en `ledger-application.factory.ts:75-79`). Sin
   `externalRef` sigue de largo. Con `externalRef`, busca el evento ancla con
   `EventStore.findByExternalRef(userId, externalRef)`: si existe, devuelve
   `{ aggregateId, streamPosition: anchor.globalPosition, idempotentReplay: true }` **sin
   ejecutar el handler ni emitir eventos**. Su firma es `handle(_command, ctx, next)` — el
   command nunca se compara. Si el índice único `(user_id, external_ref)` rechaza la escritura
   en una carrera, atrapa `DuplicateExternalRefException`, relee el ancla y replaya igual.
3. **El handler** (camino no-replay) hace `repository.save(aggregate, ctx)` y acto seguido
   `dispatcher.dispatch(result.events)` sobre el `SynchronousProjectionDispatcher`, dentro del
   mismo request y **antes de responder** — de ahí el read-your-writes. Las dos operaciones son
   secuenciales, no transaccionales.
4. **`CommandResultInterceptor`** (`command-result.interceptor.ts`) reconoce estructuralmente un
   `CommandResult` (`streamPosition: bigint` + `idempotentReplay: boolean`), estampa
   `STREAM_POSITION_HEADER = 'X-Ledger-Stream-Position'` y, cuando `idempotentReplay === true`,
   degrada el status a `200`. Devuelve `CommandAcceptedDto.from(result)` → `{ id, streamPosition }`
   (el `bigint` serializado como string decimal). Las lecturas devuelven proyecciones, no
   `CommandResult`, y pasan intactas.

**Diagrama:** dynamic view `shared_http_idempotent_write` en
[`apps/ledger/docs/shared/shared.c4`](../../../apps/ledger/docs/shared/shared.c4).
**Prosa completa del flujo:**
[`apps/ledger/docs/shared/flows/idempotent-write.md`](../../../apps/ledger/docs/shared/flows/idempotent-write.md).

## Flujos afectados

| Operación | Slug | Módulo | Trigger | Entrypoint | View |
|---|---|---|---|---|---|
| `create` | `idempotent-write` | shared | rest | `POST /api/v1/*` (con `X-External-Ref`) | `shared_http_idempotent_write` |
| `modify` | `map-domain-error` | shared | rest | `ALL /api/v1/*` | `shared_http_map_domain_error` |

`map-domain-error` (nacido en `hu-0011`) se modifica solo para anotar que
`DUPLICATE_EXTERNAL_REF` es **inalcanzable** por la ruta del command bus: el código permanece en
`LEDGER_ERROR_CODE` porque sigue siendo contrato del puerto `EventStore`.

## Componentes del módulo

Dos componentes en `admin.ledger.shared`, ambos con `metadata { introducedIn 'hu-0012' }` en el
`.c4` vivo: **`ExternalRef`** (`Infrastructure · Nest param decorator`) e
**`IdempotencyPolicy`** (`Application · CommandPolicy (chain)`). Se apoyan en piezas ya
documentadas por `hu-0009`: `commandBus`, `commandResultInterceptor` y `commandAcceptedDto`.

Cobertura de tests existente (verificada): `external-ref.decorator.spec.ts`,
`command-result.interceptor.spec.ts`, `idempotency.policy.spec.ts`, más los e2e
`accounts-api.e2e.spec.ts` y `transactions-api.e2e.spec.ts`.

## Impacto en Arquitectura Global

**¿Toca arquitectura global?** **No.**

El alcance es enteramente interno al módulo `shared` de `apps/ledger`: la HU no agrega ni quita
ningún app, módulo, integración externa ni actor del landscape. `ExternalRef` e
`IdempotencyPolicy` son componentes C4 Nivel 3 dentro de un módulo que ya existe en
`docs/architecture/landscape.c4`; el `EventStore` y el `ReadModelStore` (PostgreSQL) que
respaldan la idempotencia y el read-your-writes ya estaban modelados desde EP-1. Ningún borde
nuevo cruza el boundary del módulo.

- **Nivel:** N/A
- **Cambio:** ninguno
- **Nodo/arista concreto:** N/A

> **Para `/sync`:** este veredicto es **No** — **no invoques `/architecture`**.

## Contratos por componente

### ledger (app)

Sin endpoints nuevos ni modificados. El aporte de la HU al contrato es transversal a **toda
escritura** de los controllers de EP-2:

| Elemento OpenAPI | Tipo | Descripción de negocio |
|---|---|---|
| `ExternalRefHeader` | `parameters` | Header `X-External-Ref` opcional: idempotency key del cliente (RF-11). Reenviar el mismo valor replaya el resultado original |
| `LedgerStreamPosition` | `headers` | `X-Ledger-Stream-Position` en toda respuesta de escritura: posición global de stream para read-your-writes (RNF-9) |
| `CommandAcceptedDto` | `schemas` | Body estándar de escritura `{ id, streamPosition }` (ya publicado por `hu-0009`) |
| `LedgerErrorCode` | `schemas` | Enum de 39 códigos; `DUPLICATE_EXTERNAL_REF` anotado como inalcanzable vía HTTP |

Cobertura del header de posición **por controller** (opt-in vía `@UseInterceptors`):

| Controller | Módulo | `CommandResultInterceptor` |
|---|---|---|
| `AccountsController` | accounts | ✅ |
| `LedgerController` | accounts | ✅ |
| `TransactionsController` | transactions | ✅ |
| `TransferController` | transactions | ❌ (EP-3) |
| `BalanceAssertionController` | reconciliation | ❌ (EP-3) |

> Contrato completo ya reconciliado en
> [`apps/ledger/docs/shared/api.yaml`](../../../apps/ledger/docs/shared/api.yaml) (tag `shared`).

## Estado de reconciliación documental

**El delta de `/design` NO aplica en esta HU** — no se generó `docs/model.delta.c4`,
`docs/api.delta.yaml` ni `docs/flows/*.md` bajo `work/active/hu-0012/`, porque la reconciliación
ya se hizo a mano contra los docs vivos en esta misma sesión. Emitir un delta ahora duplicaría
componentes, vistas y schemas ya presentes.

| Archivo vivo | Estado | Contenido reconciliado |
|---|---|---|
| `apps/ledger/docs/shared/shared.c4` | ✅ Ya reconciliado | Componentes `ExternalRef` e `IdempotencyPolicy` (`introducedIn 'hu-0012'`) + relaciones + dynamic view `shared_http_idempotent_write` |
| `apps/ledger/docs/shared/flows/idempotent-write.md` | ✅ Ya reconciliado | Flujo completo (frontmatter `introduced_by: hu-0012`, recorrido, reglas AC-1…AC-5, tabla de errores, respuesta) |
| `apps/ledger/docs/shared/flows/map-domain-error.md` | ✅ Ya reconciliado | Nota de `DUPLICATE_EXTERNAL_REF` inalcanzable + 22 códigos faltantes |
| `apps/ledger/docs/shared/api.yaml` | ✅ Ya reconciliado | Parámetro `ExternalRefHeader`, header `LedgerStreamPosition`, enum `LedgerErrorCode` completo (39 códigos) |
| `docs/decisions.md` | ✅ Ya appendeado | Sección `## HU-0012` con las 5 decisiones — **`/sync` no debe re-appendear** |
| `docs/architecture/landscape.c4` | — Sin cambios | Veredicto de impacto global: **No** |

**Trabajo restante para `/sync`:** únicamente archivar el workspace
(`work/active/hu-0012/` → `work/done/hu-0012/`). Nada que reconciliar, nada que appendear, nada
que promover a `/architecture`.

## Validación de Quality Gates

| Gate | Resultado | Justificación |
|------|-----------|---------------|
| Simplicity | ✅ | Cero capas nuevas: la idempotencia es una política más del chain existente y el borde HTTP es un param decorator puro; el ledger **no** replica el `IdempotencyInterceptor` de `finances` ni su tabla propia (Art. 6) |
| Anti-Abstraction | ✅ | Se usan los mecanismos directos de NestJS (`createParamDecorator`, `NestInterceptor`) y el índice único de PostgreSQL como fuente de verdad — sin wrapper de idempotencia propio |
| Integration-First | ✅ | El contrato (`ExternalRefHeader`, `LedgerStreamPosition`, `CommandAcceptedDto`) está publicado en el `api.yaml` del módulo y cubierto por los e2e de accounts y transactions |
| Test-First | ✅ | Los tres artefactos tienen spec dedicada (`external-ref.decorator.spec.ts`, `command-result.interceptor.spec.ts`, `idempotency.policy.spec.ts`) más e2e; Art. 6 se verifica además por handler |

## Riesgos conocidos / observaciones

- **Read-your-writes no atómico (AC-5):** si `dispatcher.dispatch(...)` falla tras un append
  exitoso, el evento queda persistido y la vista desactualizada hasta el próximo rebuild
  (`hu-0008`). Es el trade-off aceptado; la atomicidad exige un `UnitOfWork` compartido (EP-3).
- **Cobertura parcial del header de posición (AC-4):** `TransferController` y
  `BalanceAssertionController` no declaran el interceptor, así que sus escrituras responden el
  DTO del handler sin `X-Ledger-Stream-Position`. Alinearlos (o mover a `APP_INTERCEPTOR`)
  pertenece a EP-3.
- **`DUPLICATE_EXTERNAL_REF` inalcanzable vía HTTP:** el código permanece en el catálogo porque
  es contrato del puerto `EventStore`; un cliente no debería programar branching sobre él para
  las rutas que pasan por el command bus.
- **`external_ref` opcional hoy:** sin registro de clientes (§2.10) no se exige por `client_id`.
  Un `@ExternalRef({ required: true })` por endpoint queda como opción abierta.
- **`npx likec4 validate` preexistente:** el workspace reporta 1 error de *layout drift* en la
  view `accountsComponents` (`apps/ledger/docs/accounts/accounts.c4`), ya anotado en el
  `design.md` de `hu-0011`. Esta HU no introduce errores nuevos (5 archivos, 1 error, el mismo).
- **Único caso en que `DuplicateExternalRefException` sí propaga (409):** el índice reporta
  duplicado pero la relectura del ancla devuelve `null` — es un bug de consistencia, no un
  camino de negocio.
