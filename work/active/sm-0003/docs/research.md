# Investigación técnica: sm-0003

> Generado por /design. Decisiones no triviales evaluadas y su rationale.
> Input para la validación de los quality gates Simplicity / Anti-Abstraction.

## Decisión: Modelado de la política de saldo negativo por cuenta (AC-1)

- **Contexto:** `account` no tiene hoy ningún flag; hay que declarar por cuenta si
  admite saldo negativo (tarjeta de crédito sí, débito no).
- **Opciones evaluadas:**
  1. `allowNegativeBalance: boolean` — simple, un flag por cuenta. Contra: no
     modela un cupo de crédito.
  2. `accountType` enum (DEBIT/CREDIT) — más rico, el tipo determina la política.
     Contra: agrega un enum y lógica de mapeo tipo→política que nadie pide todavía.
  3. Flag + `creditLimit` — cubre cupo, pero el AC no menciona límite.
- **Elegida:** opción 1, `allowNegativeBalance: boolean` (default `false`) — resuelve
  exactamente el AC con el mínimo de superficie. YAGNI: sin cupo ni tipos hasta que
  un AC lo pida.
- **Descartadas por:** 2 y 3 agregan modelo/lógica sin caso de uso actual.

## Decisión: Mecanismo de entrega del relay del Outbox (AC-2)

- **Contexto:** `movement.saved` se emite hoy en memoria con `EventEmitter2` fuera de
  la transacción del movimiento; si el proceso cae, el cruce de presupuesto se pierde.
  El evento debe persistirse transaccionalmente y entregarse de forma confiable.
- **Opciones evaluadas:**
  1. Outbox + relay que **re-despacha in-process** vía `EventEmitter2` — el relay
     relee las filas pendientes y vuelve a emitir el evento; corren los handlers ya
     existentes (`MovementSavedEventHandler` → budget → `PgmqBudgetNotificationPublisher`).
     Pro: cambio mínimo, PGMQ queda como entrega externa tal cual, sin componentes nuevos.
     Contra: la latencia queda atada al intervalo del cron.
  2. Outbox + relay que **publica a PGMQ** y un consumer aparte corre los handlers.
     Pro: máximo desacople. Contra: cada evento de dominio se vuelve un round-trip a la
     cola, hay que reescribir los handlers como consumers y sumar un poller: re-arquitectura mayor.
- **Elegida:** opción 1 — coherente con Q5 del contexto técnico (reutilizar PGMQ, no
  introducir componentes nuevos, la intercambiabilidad ya la da el puerto
  `BudgetNotificationPublisher`). El outbox aporta la durabilidad; PGMQ sigue siendo la
  entrega externa sin tocarse.
- **Descartadas por:** la opción 2 viola Simplicity/Anti-Abstraction para un beneficio
  que ningún AC exige hoy.
- **Nota de consistencia eventual:** al mover la emisión al relay, las notificaciones de
  presupuesto pasan a ser eventualmente consistentes (latencia ≈ intervalo del cron).
  Aceptable: el AC prioriza no-pérdida sobre latencia.

## Decisión: Almacenamiento de idempotencia (AC-3)

- **Contexto:** el webhook ya es idempotente por `externalReference`, pero
  `POST /movements` y `POST /transfers` no tienen protección ante doble-submit del front.
- **Opciones evaluadas:**
  1. Tabla dedicada `idempotency_keys` + interceptor NestJS que captura y reproduce la
     respuesta. Pro: genérico, reusable por cualquier endpoint de escritura, guarda el
     resultado exacto para reproducirlo. Contra: una tabla y un job de purga nuevos.
  2. Reusar claves de negocio (como el webhook) — Contra: `movements`/`transfers` no
     tienen una clave natural equivalente; forzaría inventar una y no cubre "misma clave,
     mismo resultado".
- **Elegida:** opción 1 — tabla `idempotency_keys` con `(user_id, idempotency_key)` único,
  hash del body para detectar conflicto (422), respuesta persistida para replay, retención
  24h y cron de purga.
- **Descartadas por:** la opción 2 no generaliza ni reproduce la respuesta original.

## Decisión: Categoría por defecto "Sin categorizar" (AC-4)

- **Contexto:** al no matchear ninguna regla, el movimiento necesita una categoría; hoy
  `movement.categoryId` es obligatorio y el webhook lanza 404 si no resuelve la categoría.
- **Opciones evaluadas:**
  1. Categoría sistémica "Sin categorizar" (flag `system: boolean` en `categories`,
     sembrada por migración) — el movimiento sin match apunta a esa categoría global.
     Pro: `categoryId` sigue siendo no-nulo, los reportes ya la manejan como una categoría más.
  2. `movement.categoryId` nullable — Contra: obliga a que todo cálculo/reporte maneje el
     caso nulo y contradice el modelo actual (categoría siempre presente).
- **Elegida:** opción 1 — categoría global sistémica marcada con `system=true`, sembrada
  en la migración; no se puede borrar desde la API de categorías.
- **Descartadas por:** volver `categoryId` nullable propaga el caso nulo por todo el dominio.
