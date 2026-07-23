# EP-5 — Cierre: deprecación de `finances` y operabilidad

> Épica del [roadmap](../../ledger-roadmap.md). Fuente: [especificación](../../especificacion-tecnica-ledger.md).
> Este archivo debe contener el **plan detallado de implementación** de la épica.

## Alcance (subtareas)

- **EP-5.1** Retirar módulos de `finances` (`movement`, `transfer`, `category`, `summary`, `budget` viejo) una vez cubiertos por `ledger`.
- **EP-5.2** Backups automatizados del event store + prueba de restauración (pregunta abierta #8; obligatorio antes de datos reales).
- **EP-5.3** Runbook de rebuild de proyecciones y verificación de consistencia.
- **EP-5.4** Métricas OTel del diseño (RNF-12): lag de proyecciones, conflictos de concurrencia, errores de projectors/reactors.

---

## Plan detallado

### Contexto y encuadre

Esta épica **no** tiene un momento único de ejecución: se solapa con EP-2..EP-4
(la operabilidad — backups, rebuild, métricas — se construye en paralelo desde
que existe el `PostgresEventStore` de EP-1.5), mientras que la **deprecación de
módulos (EP-5.1) es un evento discreto que ocurre cuando `ledger` alcanza
paridad funcional** con cada capacidad de `finances`.

**Premisa de fase (CLAUDE.md + roadmap):** no hay datos de producción ni nada
desplegado. Por tanto **no hay migración de datos**: retirar un módulo es borrar
código y reescribir/eliminar sus migraciones contra una base fresca. La pregunta
abierta #1 de la spec (generación del stream inicial) queda **fuera de alcance**
de esta épica por esa misma premisa. Lo que sí es bloqueante es EP-5.2: los
backups deben existir y estar probados **antes** de que exista el primer dato
financiero real.

> Regla de oro operativa (§8.2 #8): **solo el event store requiere backup.** Toda
> proyección (`proj_*`) se reconstruye por replay (RNF-5). Esto simplifica tanto
> el backup (EP-5.2) como el DR: el objeto crítico a proteger es una sola tabla
> append-only.

---

### Inventario de `finances`: qué se retira, qué se conserva

Exploración de `apps/finances/src`. Cada módulo es un hexágono
(`domain`/`application`/`infrastructure`) registrado en
[`apps/finances/src/app.module.ts`](../../apps/finances/src/app.module.ts).

#### Módulos que se RETIRAN (dominio de `finances`, paradigma incompatible)

| Módulo | Carpeta | Controller(s) | Capacidad ledger que lo cubre (criterio de paridad) |
|---|---|---|---|
| `movement` | `apps/finances/src/movement/` | `.../movement/infrastructure/adapters/http/movement.controller.ts` | Agregado `LedgerTransaction` (EP-1.7) + endpoints `/transactions` (EP-2.5) + proyección `transaction_list`/`proj_postings` (EP-1.10) |
| `transfer` | `apps/finances/src/transfer/` | `.../transfer/infrastructure/adapters/http/transfer.controller.ts` | Proyección `transfer_candidates` + command `MergePendingTransfers` + `/transfers/*` (EP-3.7). La reversa la cubre `ReverseConfirmedTransaction` (EP-1.8/2.5) |
| `category` (+ `subcategory`) | `apps/finances/src/category/` (`domain/category`, `domain/subcategory`) | `.../category/infrastructure/adapters/http/category.controller.ts`, `.../http/subcategory.controller.ts` | Cuentas `INCOME`/`EXPENSES` del agregado `Account` con jerarquía por nombre (EP-1.1/1.6) + `/accounts` (EP-2.4); la categoría/subcategoría deja de ser entidad propia |
| `summary` | `apps/finances/src/summary/` | `.../summary/infrastructure/adapters/http/summary.controller.ts` | Proyecciones `account_balances`, `net_worth` y reportes `/reports/*` (EP-4.5/4.6) |
| `budget` (viejo) | `apps/finances/src/budget/` | `.../budget/infrastructure/adapters/http/budget.controller.ts` (+ `.../messaging/pgmq-budget-notification.publisher.ts`) | Agregado `Budget` event-sourced + proyección `budget_consumption` + `/budgets` (EP-4.3). La notificación por PGMQ se reemplaza por reactor/consumo desde proyección |
| `categorization-rule` | `apps/finances/src/categorization-rule/` | `.../categorization-rule/infrastructure/adapters/http/categorization-rule.controller.ts` | **Fuera de alcance v1 del ledger** (§4.2: la sugerencia de categorías es responsabilidad de un cliente externo). Se retira sin reemplazo interno; el ledger solo expone `payee` + historial que lo habilitan |
| `scheduled` | `apps/finances/src/scheduled/` | `.../scheduled/infrastructure/adapters/http/scheduled.controller.ts` | **Diferido** (§9.3: transacciones recurrentes como módulo de producto/cliente futuro). Se retira sin reemplazo en v1 |

Migraciones asociadas a retirar/reescribir contra base fresca (carpeta
[`apps/finances/src/database/migrations/`](../../apps/finances/src/database/migrations/)):

- `...001-CreateAccountsTable` (ver nota sobre `account` abajo)
- `...002-CreateCategoriesTable`, `...007-AddSubcategoriesBaseColumns`, `...023-AddCategorySystemAndSeedDefault` → `category`/`subcategory`
- `...003-CreateMovementsTable`, `...009-AddMovementExternalReference`, `...012-EnrichMovements`, `...015-MovementTransferGroup` → `movement`/`transfer`
- `...004-CreateBudgetsTable`, `...017-AddBudgetNotifiedThreshold` → `budget`
- `...005-CreateScheduledTable`, `...014-ScheduledFrequency` → `scheduled`
- `...024-CreateCategorizationRulesTable` → `categorization-rule`
- Transversales que tocan tablas retiradas: `...006-AddPerformanceIndices`, `...008-AddCurrencyColumns`, `...010-MakeCurrencyAndPeriodRequired`, `...011-MoneyAsNumeric`, `...013-PeriodAsVarchar`, `...016-DropActiveExceptBudgets`, `...020-AddAccountAllowNegativeBalance` → se depuran al reescribir el conjunto.

#### Módulos que se CONSERVAN

- **Plataforma reutilizable** (se mueve a `libs/shared` en EP-0.2, no se retira):
  `database` (`DatabaseModule`), `config/telemetry`, `config/environment`,
  `config/logger`, `outbox`, `idempotency`, `health`. Migraciones
  `...021-CreateOutboxEventsTable`, `...022-CreateIdempotencyKeysTable`.
- **`user`** (`apps/finances/src/user/`) y **`exchange`**
  (`apps/finances/src/exchange/`): servicios plegados con base propia.
  Migraciones `...018-CreateUsersTable`, `...019-CreateExchangesTable`. La spec
  ubica identidad/autz **fuera** del ledger (§4.2); `exchange` se solapa
  conceptualmente con `PriceRecorded`/`CurrencyRegistered` (EP-4.2) pero su
  retiro **no** es alcance de EP-5 (ver decisión abierta D-2).

#### Casos de frontera

- **`account`** (`apps/finances/src/account/`, migración `...001`): el roadmap lo
  lista como dominio **no reutilizado**, y lo cubre el agregado `Account` de
  ledger (EP-1.6). Pero es dependencia de casi todos los módulos retirados y de
  `webhook`. Se retira **al final** de EP-5.1, una vez que nada en `finances` lo
  referencie. Es una decisión abierta si se retira en esta épica o se congela con
  `finances` (ver D-1).
- **`webhook`** (`apps/finances/src/webhook/`, controller
  `.../webhook/infrastructure/adapters/http/webhook.controller.ts`): es un
  **adaptador driving de ingesta** que depende de `account`,
  `categorization-rule` y `movement`. No es dominio; es una integración que, en
  el mundo ledger, se convierte en un **cliente externo** que hace
  `POST /transactions` con su `client_id` (§2.10, flujo §7.1). Se retira junto con
  sus dependencias o se reimplementa como cliente del API — decisión D-3.

#### Grafo de dependencias entre módulos (dirige el orden de retiro)

Medido con `grep` de imports `from '../<módulo>`:

```
webhook            → account, categorization-rule, movement
summary            → account, category, exchange, movement
budget             → account, category, movement
scheduled          → account, category, movement
transfer           → account, exchange, idempotency, movement
movement           → account, categorization-rule, category, idempotency, outbox
categorization-rule→ category
category           → (hoja)
account            → (hoja)
```

Nadie fuera del conjunto retirado depende de estos módulos salvo `webhook`
(retirable) y el `app.module.ts` raíz. `user` y `exchange` **no** dependen de
ningún módulo retirado (verificado): su conservación es segura.

---

### EP-5.1 — Retiro de módulos de `finances`

**Objetivo.** Eliminar del árbol y del `AppModule` los módulos cuyo dominio está
cubierto por `ledger`, dejando `finances` reducido a plataforma + `user` +
`exchange`, sin imports colgantes, con build/lint/e2e en verde y las migraciones
reescritas contra base fresca. **No hay migración de datos** (no existen datos de
producción).

**Criterio de paridad (gate por módulo).** Un módulo `finances` solo se retira
cuando su capacidad está disponible **end-to-end en ledger sobre Postgres** y
verificada. Concretamente, por módulo:

- `category`/`subcategory` → `Account` (INCOME/EXPENSES) + `/accounts` en verde
  (EP-1.6, EP-2.4) y proyección `account_tree` verificada contra stream.
- `movement` → ciclo de vida completo de `LedgerTransaction` + `/transactions`
  (EP-2.5) + `transaction_list`/`account_balances` con read-your-writes (RNF-9).
- `transfer` → `transfer_candidates` + `MergePendingTransfers` + reversa
  (EP-3.7, EP-2.5).
- `summary` → `account_balances`/`net_worth`/reportes (EP-4.5/4.6).
- `budget` → agregado `Budget` + `budget_consumption` + `/budgets` (EP-4.3), y la
  vía de notificación reemplazada.
- `categorization-rule`, `scheduled` → **sin reemplazo interno** (fuera de
  alcance/diferido); su gate es únicamente que ningún cliente dependa ya de sus
  endpoints.

**Orden seguro de retiro** (retirar primero los consumidores, luego las hojas;
tras cada paso el árbol compila):

1. **`webhook`** (o su reimplementación como cliente API — D-3): nadie depende de
   él. Libera dependencias sobre `account`, `categorization-rule`, `movement`.
2. **`summary`, `scheduled`, `budget`, `transfer`** (consumidores de nivel
   superior; entre ellos no hay dependencias). Retirables en cualquier orden una
   vez cumplido su gate de paridad.
3. **`movement`** (ya sin consumidores: 1 y 2 lo liberaron).
4. **`categorization-rule`** (consumido solo por `movement` y `webhook`, ya
   retirados).
5. **`category` (+ `subcategory`)** (consumido por movement/summary/budget/
   scheduled/categorization-rule, todos retirados).
6. **`account`** (hoja; consumido por todo lo anterior). Último. Sujeto a D-1.

Por cada paso: (a) quitar el import y la entrada de `imports:[]` en
[`app.module.ts`](../../apps/finances/src/app.module.ts); (b) borrar la carpeta
del módulo; (c) eliminar/depurar sus migraciones; (d) `nx build finances` +
`nx lint finances` + suite e2e; (e) actualizar
`apps/finances/src/app.wiring.spec.ts` (assertion del grafo de módulos) y el
Swagger builder si enumera tags.

**Reescritura de migraciones (sin datos → libertad de esquema, CLAUDE.md).** No
se añaden migraciones `DROP TABLE`. Se **eliminan** las migraciones de las tablas
retiradas y se depuran las transversales que las tocan, de modo que una base
fresca levante solo con: plataforma (`outbox`, `idempotency`), `user`, `exchange`
(y `account` si D-1 lo conserva). Verificación: `migration:run` sobre BD vacía en
CI.

**Plan de validación/pruebas.**
- Build + lint del proyecto `finances` tras cada retiro (no imports colgantes).
- `app.wiring.spec.ts` refleja el `AppModule` reducido y pasa.
- Suite e2e de `finances` recortada: se eliminan specs de los módulos retirados;
  la e2e restante (health, user, exchange) queda verde.
- `grep` de residuos: sin referencias a `movement|transfer|category|summary|
  budget|categorization-rule|scheduled` en código conservado.
- `migration:run` + `migration:revert` idempotentes sobre BD limpia.
- Paridad demostrada por la e2e de `ledger` cubriendo el flujo equivalente antes
  de ejecutar el retiro.

**Criterios de aceptación.**
- `AppModule` de `finances` sin los módulos retirados; app arranca.
- BD fresca levanta sin las tablas retiradas; sin migración de datos.
- Build/lint/e2e verdes; `app.wiring.spec.ts` actualizado.
- La capacidad de cada módulo retirado está servida por `ledger` (gate cumplido).

**Dependencias.** EP-1..EP-4 según la tabla de paridad (p. ej. no se retira
`budget` hasta EP-4.3). El retiro global se completa cuando EP-4 está estable.

**Riesgos.**
- Retirar antes de paridad real → pérdida de capacidad. Mitigación: gate e2e por
  módulo, no por épica.
- `account`/`webhook` con consumidores ocultos (frontend, sistema de correos).
  Mitigación: D-1/D-3 explícitas antes de tocar `account`.
- Acoplamiento de `exchange` con futura valoración → no retirar en esta épica.

---

### EP-5.2 — Backups automatizados del event store + prueba de restauración

**Objetivo.** Garantizar que el **event store** (única fuente de verdad,
append-only, §6.1) es recuperable con RPO/RTO acotados y **probados**, antes de
operar con datos financieros reales. Resuelve la pregunta abierta #8. **Bloquea**
el paso a datos reales.

**Alcance del backup (minimalista, §8.2 #8).** El objeto crítico es la tabla
`event_store` (+ metadatos mínimos no derivables: `projection_checkpoints` es
reconstruible, así que es opcional). **Las proyecciones `proj_*` se EXCLUYEN del
backup**: se reconstruyen por replay (EP-5.3). Esto reduce el backup a datos
append-only, lo que lo hace trivial de verificar por conteo/hash creciente.

**Estrategia (dos capas complementarias sobre PostgreSQL).**

1. **PITR con WAL archiving (capa primaria, RPO ~0).**
   - `wal_level=replica`, `archive_mode=on`, `archive_command` que envía cada
     segmento WAL a almacenamiento de objetos versionado e inmutable
     (object-lock/WORM, alineado con la naturaleza append-only del stream).
   - **Base backup** semanal con `pg_basebackup` (o snapshot del volumen) como
     punto de anclaje del replay de WAL.
   - Permite recuperación a cualquier punto en el tiempo (PITR): dado que el
     stream es append-only, restaurar a `T` reconstruye exactamente el prefijo de
     eventos hasta `T` sin pérdida ni doble aplicación.
2. **Dump lógico diario (capa secundaria, defensa en profundidad).**
   - `pg_dump` de la tabla `event_store` (+ `projection_checkpoints`) — no de las
     proyecciones — comprimido, cifrado en reposo, con checksum.
   - Sirve para restauración parcial/selectiva y para verificación barata
     (`COUNT(*)` y hash de `event_id` ordenados por `global_position` deben ser
     monótonos crecientes entre dumps consecutivos, nunca decrecientes → detecta
     violación de append-only o corrupción).

**Cadencia y retención (propuesta, calibrar).**
- WAL: archivado continuo (streaming).
- Base backup: semanal.
- Dump lógico del event store: diario.
- Retención: WAL + base backups 30 días (PITR de 30 días); dumps diarios 30 días,
  semanales 90 días. Cifrado en reposo y en tránsito; acceso auditado.

**Procedimiento de prueba de restauración (drill).**
1. Aprovisionar instancia PostgreSQL **scratch** aislada.
2. Restaurar el último base backup + aplicar WAL hasta un `recovery_target_time`
   (probar también restore a "última posición disponible").
3. Verificar integridad del event store restaurado:
   - `COUNT(*)` y `MAX(global_position)` coinciden con lo esperado del origen.
   - Hash agregado de `(global_position, event_id, event_type, payload)` ordenado
     coincide con el hash del origen al mismo corte temporal.
   - El trigger append-only (`trg_event_store_immutable`) sigue activo:
     `UPDATE`/`DELETE` de prueba deben fallar.
4. **Rebuild de proyecciones** desde el store restaurado usando el runbook de
   EP-5.3 y verificación de consistencia stream vs proyección.
5. Medir y registrar **RTO** (tiempo total restore + rebuild) y **RPO**
   (ventana de pérdida efectiva).
6. Destruir la instancia scratch.

**Plan de validación/pruebas.**
- Drill **automatizado y agendado** (mensual como mínimo; y en CI de
  infraestructura con un event store sintético pequeño) — no un procedimiento
  solo documentado.
- Alerta si `archive_command` falla o si el último base backup supera su SLA.
- Test negativo: un WAL faltante debe hacer fallar el restore de forma visible
  (no un restore silenciosamente incompleto).

**Criterios de aceptación.**
- WAL archiving + base backups operativos; dump lógico diario del event store.
- Drill de restauración ejecutado con éxito end-to-end (restore + rebuild +
  verificación), con RTO/RPO medidos y dentro de objetivo.
- Runbook de restauración escrito y probado; alertas de fallo de backup activas.
- **Gate "listo para datos reales" firmado** (ver checklist final).

**Dependencias.** `PostgresEventStore` (EP-1.5) y esquema §6.1 con su trigger;
runbook de rebuild (EP-5.3) para el paso 4 del drill.

**Riesgos.**
- Backup que incluye proyecciones → volumen y falso sentido de completitud.
  Mitigación: excluir `proj_*` explícitamente; el contrato es "store + replay".
- WAL archiving mal configurado → PITR ilusorio. Mitigación: drill periódico
  real, no solo verificación de que los archivos existen.
- Cifrado/permisos del destino de backup. Mitigación: object-lock + acceso
  auditado + rotación de claves.

---

### EP-5.3 — Runbook de rebuild de proyecciones y verificación de consistencia

**Objetivo.** Procedimiento operativo, determinista y verificable para **truncar
y reconstruir** cualquier proyección desde el event stream por replay (RNF-5), y
para **verificar la consistencia** entre stream y proyección. Reutiliza el tooling
de rebuild de EP-1.12; esta subtarea lo empaqueta como runbook operable +
checker.

**Pasos de rebuild (por proyección o global).**
1. **Quiesce**: detener el poller asíncrono
   (`ProjectionDispatcher`/checkpoint, EP-1.9) para la(s) proyección(es) objetivo.
   Para las proyecciones **síncronas** (`transaction_list`, `proj_postings`,
   `account_balances`, `pending_review` — se escriben en la transacción del
   command, §8.1) el rebuild se hace en **ventana de mantenimiento** o contra una
   tabla sombra con swap atómico, para no competir con commands en vuelo.
2. **Truncate**: `truncate` de las tablas de la proyección (puerto
   `ReadModelStore.truncate`, §3.8) y reset de su fila en
   `projection_checkpoints` (`last_position = 0`).
3. **Replay**: `EventStore.readAll(fromPosition = 0)` en **orden estricto por
   `global_position`**, alimentando **el mismo código de projector** del núcleo
   (§3.8: idéntico en modo síncrono/asíncrono). Aplicar en lotes; avanzar el
   checkpoint al final de cada lote.
4. **Catch-up y reanudación**: al alcanzar la cabeza del stream, reanudar el
   poller; los eventos llegados durante el rebuild se aplican desde el checkpoint.
5. **Rebuild global**: iterar el procedimiento para todas las proyecciones (o
   ejecutar un único replay que despacha a todos los projectors registrados).

**Verificación de consistencia stream vs proyección** (independiente del código
de projector — es un *fold* alternativo del stream que debe coincidir):
- **Balances**: sumar postings por `(account_id, currency)` directamente desde los
  eventos `TransactionRecorded/Confirmed/Reversed/Voided` y comparar contra
  `proj_balances` (confirmed y pending por separado). Diferencia esperada: cero.
- **Transacciones**: contar transacciones vivas (neteando `Voided`/`Reversed`)
  desde el stream y comparar con filas de `proj_transactions`; validar que cada
  `proj_transactions` tiene su conjunto de `proj_postings` cuadrado a cero
  (INV-1) por moneda.
- **Cuentas**: `account_tree` reconstruido == `proj_accounts` (nombres y prefijos
  tras `AccountRenamed`).
- **Checkpoint**: `projection_checkpoints.last_position` de cada proyección no
  excede `MAX(event_store.global_position)`; tras rebuild al día, coincide.
- **Determinismo**: reconstruir **dos veces** el mismo stream y comparar un hash
  del contenido ordenado de cada tabla de proyección → **idénticos** (misma
  entrada de eventos ⇒ misma proyección, byte a byte).

**Plan de validación/pruebas.**
- **Test de rebuild determinista** (in-memory y PostgreSQL, mismos contract
  tests, RNF-11): fixture de stream → rebuild → snapshot; segundo rebuild →
  snapshot idéntico.
- **Checker de consistencia como comando ejecutable** (CLI/endpoint de
  operación, no del API público) con salida de discrepancias por proyección;
  test que inyecta una proyección corrupta y verifica que el checker la detecta.
- **Drill de rebuild** cronometrado sobre un volumen representativo (RTO parcial
  para EP-5.2 paso 4).
- Verificar que el rebuild es seguro con el poller detenido y correcto al
  reanudar (sin doble aplicación gracias al checkpoint).

**Criterios de aceptación.**
- Runbook escrito, paso a paso, para rebuild por-proyección y global, incluyendo
  el manejo de proyecciones síncronas (ventana/sombra+swap).
- Rebuild determinista demostrado por test (in-memory + PG).
- Checker de consistencia disponible y con test de detección de corrupción.
- Rebuild integrado como paso del drill de restauración (EP-5.2).

**Dependencias.** EP-1.9 (`ProjectionDispatcher` + checkpoints), EP-1.12 (tooling
de rebuild/replay), EP-1.10 (projectors núcleo). Se amplía a medida que EP-3/EP-4
añaden proyecciones.

**Riesgos.**
- Rebuild de proyección síncrona compitiendo con commands → inconsistencia
  transitoria. Mitigación: ventana de mantenimiento o tabla sombra + swap
  atómico.
- No-determinismo por dependencia de `now()`/orden no estable. Mitigación:
  `Clock`/`IdGenerator` deterministas (EP-0.4) y orden estricto por
  `global_position`.
- Olvidar reset de checkpoint → proyección parcial. Mitigación: el runbook trata
  truncate + reset como un solo paso atómico.

---

### EP-5.4 — Métricas OTel (RNF-12)

**Objetivo.** Exponer las tres señales imprescindibles del diseño como métricas
OpenTelemetry: **lag de proyecciones asíncronas**, **tasa de conflictos de
concurrencia optimista**, y **errores de projectors/reactors** (un reactor que
falla en silencio rompe la re-evaluación de aserciones sin síntoma visible). La
instrumentación vive **en adaptadores y decoradores de los buses, jamás en el
dominio** (RNF-11/RNF-12).

**Reutilización de la telemetría existente.** La plataforma OTel de `finances`
—[`apps/finances/src/config/telemetry/telemetry.config.ts`](../../apps/finances/src/config/telemetry/telemetry.config.ts)
(`buildNodeSDK`: `NodeSDK` + `PeriodicExportingMetricReader` +
`OTLPMetricExporter`),
[`instrumentation.ts`](../../apps/finances/src/config/telemetry/instrumentation.ts)
(arranque temprano),
[`correlation.ts`](../../apps/finances/src/config/telemetry/correlation.ts)— se
**mueve a `libs/shared` en EP-0.2** y `ledger` la reutiliza. El `MeterProvider`
ya queda configurado por ese SDK; EP-5.4 solo **añade instrumentos** vía
`@opentelemetry/api` (`metrics.getMeter('ledger')`), sin tocar el arranque del
SDK. Namespace de métricas: `ledger.*`.

**Instrumentos concretos.**

1. **Lag de proyecciones asíncronas** (checkpoint vs. posición global).
   - `ledger.projection.lag` — **ObservableGauge** (`{events}`). En cada
     colección: `MAX(event_store.global_position) − projection_checkpoints.last_position`.
     Labels: `projection_name`. (Solo proyecciones en modo asíncrono; las
     síncronas tienen lag 0 por construcción.)
   - Auxiliares para diagnóstico: `ledger.stream.global_position`
     (ObservableGauge, cabeza del stream) y `ledger.projection.checkpoint_position`
     (ObservableGauge, label `projection_name`).
   - **Dónde vive**: un observador registrado por el adaptador
     `ProjectionDispatcher`/poller (EP-1.9), que consulta `event_store` y
     `projection_checkpoints`. Nunca en el dominio.

2. **Tasa de conflictos de concurrencia optimista.**
   - `ledger.command.concurrency_conflicts` — **Counter** (`{conflict}`).
     Incrementa cuando `EventStore.append` lanza la excepción tipada de conflicto
     (`expectedVersion` no coincide). Labels: `aggregate_type`, `command_type`.
   - `ledger.command.executions` — **Counter** (`{command}`), total de commands
     despachados (labels `command_type`, `outcome`=`ok|conflict|error`), para
     derivar la **tasa** = conflicts / executions en el backend de métricas.
   - **Dónde vive**: decorador del **command bus** (EP-1.8) y/o el adaptador
     `PostgresEventStore` (EP-1.5). Nunca en el agregado.

3. **Errores de projectors y reactors.**
   - `ledger.projector.errors` — **Counter** (`{error}`). Incrementa cuando la
     aplicación de un evento a una proyección falla. Labels: `projection_name`,
     `event_type`.
   - `ledger.reactor.errors` — **Counter** (`{error}`). Incrementa cuando un
     reactor/process manager (re-evaluación de aserciones RF-18, detección de
     logro de metas RF-25) falla al procesar un evento o al despachar su command.
     Labels: `reactor_name`, `event_type`.
   - Auxiliar: `ledger.reactor.commands_dispatched` — **Counter**
     (`reactor_name`, `command_type`), para distinguir "reactor sano sin trabajo"
     de "reactor caído".
   - **Dónde vive**: el poller/dispatcher de proyecciones (EP-1.9) y el
     dispatcher de reactors (§3.2). Nunca en el dominio.

Además (ya cubierto por RNF-12 y el auto-instrumentation existente): **trazas por
command y query** con atributos de dominio (`command_type`, `aggregate_type`,
`client_id`) mediante decoradores de los buses — se añaden en el mismo lugar que
los counters, reutilizando el tracer del SDK.

**Plan de validación/pruebas.**
- **Unit** de los decoradores/adaptadores: forzar un `ConcurrencyConflict` y
  aseverar incremento de `concurrency_conflicts` + `executions{outcome=conflict}`;
  forzar fallo de projector/reactor y aseverar sus counters.
- **Integración**: exportador OTLP apuntando a un collector de prueba (o
  in-memory metric reader); aseverar presencia de los instrumentos y sus labels.
- **Lag**: inyectar un checkpoint atrasado y verificar que `projection.lag`
  refleja la diferencia esperada.
- **Aislamiento hexagonal (RNF-11)**: test/lint que verifica que
  `@opentelemetry/api` **no** se importa desde `domain/` ni `application` del
  núcleo (solo adaptadores/decoradores).

**Criterios de aceptación.**
- Los tres grupos de métricas se emiten con los nombres, tipos y labels de
  arriba, vía el SDK OTel reutilizado de `libs/shared`.
- Ninguna métrica se instrumenta dentro del dominio (verificado por test/lint).
- Documentado qué alerta operativa consume cada métrica (lag creciente,
  conflictos sostenidos, cualquier error de reactor > 0).

**Dependencias.** EP-0.2 (telemetría en `libs/shared`), EP-1.5
(`PostgresEventStore`), EP-1.8 (command bus), EP-1.9 (dispatcher/checkpoints),
EP-3.4/EP-4.4 (reactors reales que instrumentar).

**Riesgos.**
- Gauge de lag costoso si consulta el store en cada colección. Mitigación:
  intervalo de export de 60s (ya configurado) y consulta barata
  (`MAX(global_position)` indexado).
- Reactor que "falla en silencio" sin lanzar excepción capturable. Mitigación:
  `commands_dispatched` como señal de vida + alerta por ausencia.
- Cardinalidad de labels (`client_id` en métricas). Mitigación: `client_id` solo
  en **trazas**, no como label de métrica.

---

## Checklist "listo para datos reales"

Prerrequisitos operativos que deben estar **todos** en verde antes de introducir
el primer dato financiero real (reúne los gates de EP-5.2/5.3/5.4 y §8.2 #8):

- [ ] **Backups del event store operativos**: WAL archiving continuo + base
      backups periódicos + dump lógico diario de `event_store` (EP-5.2).
- [ ] **Drill de restauración ejecutado con éxito** end-to-end (restore + rebuild
      + verificación de consistencia), con **RTO/RPO medidos y dentro de
      objetivo**, y agendado de forma recurrente (EP-5.2/5.3).
- [ ] **Runbook de rebuild** escrito y probado; **rebuild determinista**
      demostrado por test; **checker de consistencia** stream↔proyección
      disponible y con test de detección de corrupción (EP-5.3).
- [ ] **Alertas de fallo de backup** (archive_command, base backup vencido)
      activas.
- [ ] **Trigger append-only** (`trg_event_store_immutable`) verificado activo en
      el store restaurado (EP-5.2 paso 3).
- [ ] **Métricas OTel** de lag, conflictos de concurrencia y errores de
      projectors/reactors emitiéndose, con alertas asociadas (EP-5.4).
- [ ] **Idempotencia** (`UNIQUE(user_id, external_ref)`) y **concurrencia
      optimista** (`UNIQUE(aggregate_id, sequence)`) verificadas en el adaptador
      real (contract tests, EP-1.5).
- [ ] **Deprecación de `finances` completada** para las capacidades ya cubiertas
      (EP-5.1) o `finances` congelado y aislado, sin doble-escritura sobre los
      mismos datos.
- [ ] **Contrato del servicio de identidad** definido (contexto autenticado
      `user_id`/`client_id`, RF-26) — cierra la decisión #5 de la spec.

---

## Decisiones abiertas para el usuario

- **D-1 — Destino del módulo `account` de `finances`.** ¿Se retira en EP-5.1
  (cubierto por el agregado `Account` de ledger) o se congela junto a `finances`
  mientras exista algún consumidor no migrado? Afecta al último paso del orden de
  retiro.
- **D-2 — Módulo `exchange`.** Se solapa con `PriceRecorded`/`CurrencyRegistered`
  (EP-4.2). ¿Se mantiene como servicio independiente (fuente de tasas) que
  alimenta `RecordPrice`, o se absorbe en ledger a futuro? Propuesta: mantener
  fuera de alcance de EP-5.
- **D-3 — Módulo `webhook`.** ¿Se retira o se reimplementa como **cliente externo**
  del API de ledger (`POST /transactions` con su `client_id`, §7.1)? Determina si
  la ingesta actual sobrevive al retiro de `movement`/`account`.
- **D-4 — Notificaciones de presupuesto (PGMQ).** El `pgmq-budget-notification.publisher`
  del budget viejo: ¿se reemplaza por un reactor de ledger que observa
  `budget_consumption`, o por un cliente externo? Afecta el gate de retiro de
  `budget`.
- **D-5 — Cadencia y retención de backups.** Confirmar los valores propuestos
  (WAL continuo, base semanal, dump diario, retención 30/90 días) y el destino de
  almacenamiento (object-lock/WORM) según coste y RPO objetivo.
- **D-6 — Frecuencia del drill de restauración.** Propuesta: mensual real + en CI
  con store sintético. Confirmar.
- **D-7 — Modo de despacho por proyección** (pregunta abierta #4 de la spec):
  qué proyecciones quedan asíncronas define exactamente el conjunto que reporta
  `ledger.projection.lag` (EP-5.4).

---

## Estimación S/M/L por subtarea

| Subtarea | Estimación | Notas |
|---|---|---|
| **EP-5.1** Retiro de módulos | **L** | Muchos módulos y migraciones; el trabajo es discreto y mecánico pero amplio, y el gate depende de EP-1..EP-4. Sin migración de datos (reduce riesgo, no volumen). |
| **EP-5.2** Backups + drill | **M** | Configuración de infra (WAL/base/dump) acotada; el peso está en automatizar y probar el drill, no en escribir código de app. |
| **EP-5.3** Runbook rebuild + checker | **M** | Reutiliza tooling de EP-1.12; añade el checker de consistencia, el manejo de proyecciones síncronas y el test de determinismo. |
| **EP-5.4** Métricas OTel | **S** | SDK ya existe y se reutiliza desde `libs/shared`; se añaden ~7 instrumentos en decoradores/adaptadores + tests. |

> Nota de secuenciación: EP-5.2, EP-5.3 y EP-5.4 se construyen en paralelo desde
> que EP-1.5/EP-1.9 están estables; EP-5.1 se **cierra** al final, módulo a
> módulo, conforme cada capacidad alcanza paridad en EP-2..EP-4.
