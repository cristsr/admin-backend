# design: hu-0026

## Decisiones de Diseño

No hubo preguntas nuevas en esta fase: `/clarify` dejó el ítem sin ambigüedades y las
elecciones de implementación se resolvieron contra precedentes del repo. Las cuatro
decisiones técnicas no triviales están documentadas con sus alternativas en
[`docs/research.md`](./docs/research.md):

- **Quién resuelve «hoy»:** el agregado, recibiendo el `Clock` — precedente `confirm(clock)`
  en el mismo agregado; es la única opción que respeta «la fecha se decide en un solo lugar».
- **Dónde vive la conversión instante → día:** `LedgerDate.today(clock)` en el value object —
  un solo punto donde cambiar la semántica de «hoy» si el proyecto unifica la timezone (gap 2
  de `context.md`).
- **Cómo se construye la reversa:** factory de dominio `LedgerTransaction.fromReversalPlan(plan, balance)`
  — hace que el `ReversalPlan` deje de ser código muerto, sin ensuciar `record()` con un id
  opcional.
- **`TransactionReversed` no cambia:** la elección es derivable del `date` de T2, así que no
  se dispara el Artículo 9 (versionado de evento + upcaster). **Ningún evento cambia de
  esquema en esta historia.**

## Flujo

`POST /transactions/{id}/reverse` acepta `atEffectiveDate` en el body; el controller resuelve
el default (`?? true`) y lo pasa al command. El handler carga la original, le pide el
`ReversalPlan` —donde el agregado resuelve la fecha según la elección— y construye T2 a partir
de ese plan; ambos appends siguen dentro de `EventStore.withTransaction` (INV-7). Si la
original ya estaba revertida, el agregado corta con el código nuevo antes de tocar nada.

Flujos afectados (ambos `modify`, ninguno `create`):

| Módulo | Caso de uso | Op. | Trigger | Entrypoint | View |
|---|---|---|---|---|---|
| `transactions` | `reverse-transaction` | modify | rest | `POST /transactions/{id}/reverse` | `reverseTransaction` |
| `shared` | `map-domain-error` | modify | rest | `ALL /api/v1/*` | `shared_http_map_domain_error` |

> Detalle por flujo: [`docs/flows/reverse-transaction.md`](./docs/flows/reverse-transaction.md)
> y [`docs/flows/map-domain-error.md`](./docs/flows/map-domain-error.md).

## Componentes del módulo

**Ningún componente nuevo.** La historia modifica cinco existentes: el agregado
`LedgerTransaction` (`reverse()` elige la fecha; nuevo factory `fromReversalPlan`), el
`ReverseConfirmedTransactionHandler` (consume el plan, recibe un `Clock`), el
`TransactionsController` (propaga `atEffectiveDate`), las excepciones del módulo
(`TransactionAlreadyReversedException`) y el catálogo `LEDGER_ERROR_CODE` del kernel
compartido. Delta del modelo: [`docs/model.delta.c4`](./docs/model.delta.c4).

**Nota para `/sync` — las dos dynamic views ya existen en los `.c4` vivos**, así que el delta
**no** las re-declara: hacerlo duplicaría el `viewId` y rompería `likec4 validate`
(`work/active/` no está excluido en `likec4.config.json`). Los cambios a aplicar están
escritos verbatim en la cabecera de `model.delta.c4`:

- `transactions.c4` → `reverseTransaction`: reescribir el paso
  `reverseHandler -> ledgerTransaction` con la firma nueva y agregar el paso
  `fromReversalPlan(plan)`. Prefijo `[CHANGED]` en el título.
- `shared.c4` → `shared_http_map_domain_error`: sin pasos nuevos, solo `[CHANGED]`.

**Wiring:** el handler gana un `Clock` en el constructor. Se cablea en
`apps/ledger/src/bootstrap/ledger-application.factory.ts:206-215` — no en
`transactions.module.ts`, que no compone este handler. `ledger-core.module.ts:38` ya provee
`{ provide: Clock, useClass: SystemClock }`.

## Impacto en Arquitectura Global

**¿Toca arquitectura global?** No.

- **Nivel:** N/A
- **Cambio:** ninguno
- **Nodo/arista concreto:** N/A

El alcance es interno a `apps/ledger`: no hay app, módulo, lib ni integración externa nueva,
y ninguna arista cruza el borde de un container. Los cinco componentes tocados ya existen en
los `.c4` de sus módulos.

## Contratos por componente

### apps/ledger — `transactions`

| Método | Ruta | Descripción de negocio |
|--------|------|-------------------------|
| POST | `/transactions/{id}/reverse` | Reversa una confirmada eligiendo si la corrección se asienta en la fecha original (corrige el histórico) o en la de hoy (lo deja intacto). Ya existía; hu-0026 le agrega la elección y le reparte un código de error. |

> Schemas completos, códigos de respuesta y el delta del enum de errores:
> [`docs/api.delta.yaml`](./docs/api.delta.yaml) (tags `transactions` y `shared`).

**Cambio sobre contrato publicado.** La operación `reverseTransaction` ya está en
`apps/ledger/docs/transactions/api.yaml` desde hu-0014. `/sync` debe correr `oasdiff`
(`API_DIFF_TOOL`) contra el canónico y clasificar. Lectura esperada:

- **Aditivo:** `atEffectiveDate` es opcional con default `true` = comportamiento previo.
  Ningún cliente existente cambia de resultado.
- **A revisar:** la condición «ya revertida» pasa de `INVALID_TRANSACTION_STATE` a
  `TRANSACTION_ALREADY_REVERSED`. El status sigue siendo 409 y el enum solo gana un valor, así
  que `oasdiff` no debería marcarlo breaking; **el cambio observable es el valor de `code`**,
  y un cliente que hoy hiciera branching sobre `INVALID_TRANSACTION_STATE` para detectar doble
  reversa dejaría de acertar. No requiere versionado: el proyecto está en fase de desarrollo,
  sin nada deployado (`CLAUDE.md`).

## Modelado de datos

No aplica: el ledger es event-sourced y esta historia no agrega ni cambia ninguna tabla,
proyección o esquema de evento. No se generó `docs/data-model.md`.

## Validación de Quality Gates

Constitución cargada: `docs/rules.md` v1.2.0 (13 artículos + 4 gates).

| Gate | Resultado | Justificación |
|------|-----------|---------------|
| Simplicity | ✅ | Cero componentes nuevos; se descartó un `TodayResolver` por especulativo y se rechazó inyectar `LedgerTimezoneReader` en `transactions` para un caso de uso que nadie pidió. |
| Anti-Abstraction | ✅ | Se usan los mecanismos que ya existen: `Clock` como puerto, `DomainConflictException` como base, `IdempotencyPolicy` sin tocar. El único método nuevo (`fromReversalPlan`) elimina duplicación en vez de envolver algo. |
| Integration-First | ✅ | `api.delta.yaml` está escrito y validado antes de que exista código; el contrato código → status se congela en `ledger-error-code-mapping.spec.ts`, que es contract test. |
| Test-First | ✅ | `/plan` ordenará el spec del agregado antes de la firma nueva, el del handler antes del wiring y la fila del mapping antes del código de error. Ver riesgo de cobertura abajo. |

**Artículos verificados uno por uno, los que esta historia podría rozar:**

- **Art. 1 (núcleo aislado):** el agregado recibe `Clock`, que es un puerto de
  `@cqrs/domain/ports`, no `@nestjs/*` ni un driver. Sin violación — y con precedente en
  `confirm(clock)`.
- **Art. 3 (event store append-only):** ningún evento se edita; la corrección sigue siendo una
  transacción nueva.
- **Art. 6 (idempotencia):** `atEffectiveDate` entra al hash por construcción, y el default se
  resuelve en el borde para que el hash sea estable (AC-5, ver `research.md`).
- **Art. 9 (versionado de eventos):** **no se activa** — ningún evento cambia de esquema.
- **Art. 10 (CQRS estricto):** el handler sigue devolviendo `CommandResult`, sin
  representaciones de lectura.
- **Art. 13 (imports por ruta completa):** no se agrega ningún barrel.

**Riesgo conocido — cobertura previa.** El grafo reporta `LedgerTransaction.confirm()` sin
tests que lo cubran (gap 5 de `context.md`). Tocar el agregado sin verificar esto arriesga un
cambio silencioso en el ciclo de vida; `/plan` debería incluir la verificación como paso
previo, no como parte del entregable.

**Seguimiento fuera de alcance** (anotado, no incluido): migrar
`resolve-discrepancy.handler.ts:70` al nuevo `LedgerDate.today(clock)`, y unificar las dos
nociones de «día» del ledger (UTC en transacciones vs. timezone del ledger en reconciliación).
