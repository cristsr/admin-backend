# sm-0003: Robustez del dominio y consistencia

## Historia de Usuario

**Como** responsable de la integridad de los datos financieros
**Quiero** que el dominio garantice consistencia ante fallos, duplicados y operaciones concurrentes
**Para** que ningún movimiento se pierda, se duplique o deje el saldo en un estado imposible

> Contexto: agrupa las ideas del **Grupo C** de `LLUVIA_DE_IDEAS.md` — robustez y consistencia
> de datos sobre lo que ya existe.

## Criterios de Aceptación

### AC-1: Validación de saldo en transferencias (configurable)

Hoy se puede transferir más de lo que hay en la cuenta origen. El sistema debe decidir y
aplicar una política sobre saldo insuficiente en transferencias.

- Al crear una transferencia, el sistema evalúa si la cuenta origen tiene saldo suficiente.
- La política de saldo insuficiente se define **por cuenta**: cada cuenta declara si admite
  saldo negativo (p. ej. una tarjeta de crédito lo admite; una cuenta de débito no).
- Si la cuenta origen no admite saldo negativo y la transferencia la dejaría en negativo, el
  sistema rechaza la operación. Si la cuenta admite saldo negativo, la transferencia procede.
- El saldo evaluado es el "saldo vivo" definido en `sm-0001` AC-3; esta historia **reutiliza**
  ese cálculo (dependencia explícita), no implementa uno propio.

### AC-2: Patrón Outbox transaccional para eventos de dominio

`movement.saved` se emite en memoria con `EventEmitter2`; si el proceso cae entre el commit
del movimiento y la ejecución del handler, el cruce de presupuesto se pierde. El sistema debe
persistir los eventos de dominio de forma transaccional con el cambio que los origina.

- **Todo evento de dominio** que hoy se emite con `EventEmitter2` se persiste en la tabla
  outbox dentro de la misma transacción que el cambio que lo origina (mecanismo genérico, no
  limitado a `movement.saved`/`BudgetThresholdExceeded`).
- El evento se persiste en la misma transacción que el movimiento que lo dispara.
- Un **cron interno** (scheduler dentro de la app `finances`, patrón de
  `infrastructure/adapters/schedulers/`) relee la tabla outbox y entrega los eventos
  pendientes de forma confiable, con reintentos.
- Un evento no entregado no se pierde ante una caída del proceso.

### AC-3: Idempotencia en escrituras de usuario

El webhook ya es idempotente, pero un doble-submit del front crea movimientos o transferencias
duplicados. El sistema debe aceptar una `Idempotency-Key` en las escrituras de usuario.

- `POST /movements` y `POST /transfers` aceptan un header `Idempotency-Key`.
- Dos requests con la misma clave y el mismo cuerpo producen un solo registro y devuelven el mismo resultado.
- Una `Idempotency-Key` se retiene **24 horas**; pasado ese plazo expira y puede reutilizarse.
  Un job de limpieza purga las claves vencidas.
- Si llega la misma clave (aún vigente) con un **cuerpo distinto** al del request original, el
  sistema responde **422** (conflicto de idempotencia); no crea un registro nuevo ni devuelve
  el original silenciosamente.

### AC-4: Reglas de auto-categorización

Al llegar un movimiento por webhook sin categoría, el sistema puede asignarle una categoría
automáticamente según reglas por `merchant` o patrón de descripción definidas por el usuario.

- El usuario puede definir reglas (patrón → categoría/subcategoría).
- Una regla matchea si su patrón aparece como **substring case-insensitive** en el `merchant`
  o en la descripción del movimiento. Si varias reglas matchean, gana la de mayor **prioridad
  explícita** (campo de orden/prioridad definido por el usuario).
- Las reglas se aplican a **cualquier movimiento sin categoría**, tanto los entrantes por
  webhook como los creados manualmente sin categoría (nunca pisan una categoría ya asignada).
- Un movimiento entrante sin categoría que matchea una regla queda categorizado automáticamente.
- Si ninguna regla matchea, el movimiento se asigna a una categoría por defecto **"Sin
  categorizar"** (categoría sistémica), no queda con el campo nulo.

### AC-5: Política de cierre/archivado de cuentas con movimientos

Hoy `DELETE` de cuenta es soft-delete, sin definir qué pasa con sus movimientos y las
transferencias enlazadas. El sistema debe aplicar una política explícita.

- Al eliminar/archivar una cuenta se hace **soft-delete en cascada**: la cuenta se archiva y
  sus movimientos quedan soft-deleted junto con ella.
- Un movimiento soft-deleted **no se tiene en cuenta en ningún cálculo** (saldo, reportes,
  totales de movimientos): se preserva el historial pero deja de contar.
- La operación no deja transferencias con una sola pata válida.
- Si una transferencia de la cuenta archivada tiene su contraparte en una cuenta que sigue
  activa, se **soft-deletea el par completo** (ambas patas del `transferGroup`), aunque la
  otra cuenta permanezca activa. Nunca queda una transferencia con una sola pata.

## Resolución de Ambigüedades

- **AC-1:** ¿A qué nivel se define la política de saldo insuficiente? → Configurable **por cuenta**: cada cuenta declara si admite saldo negativo (tarjeta de crédito sí, débito no).
- **AC-1:** ¿De dónde sale el saldo a validar? → **Reutiliza** el "saldo vivo" de `sm-0001` AC-3 (dependencia explícita), no implementa cálculo propio.
- **AC-2:** ¿Qué eventos entran al outbox? → **Todo evento de dominio** hoy emitido con `EventEmitter2` (mecanismo genérico).
- **AC-2:** ¿Cómo corre el relay? → **Cron interno** (scheduler en la app `finances`, patrón de `infrastructure/adapters/schedulers/`), no un worker separado.
- **AC-3:** ¿Cuánto se retiene una `Idempotency-Key`? → **24 horas**, luego expira; un job purga las vencidas.
- **AC-3:** ¿Misma clave con cuerpo distinto? → Responde **422** (conflicto de idempotencia), no crea registro ni devuelve el original en silencio.
- **AC-4:** ¿Cómo matchea una regla y quién gana? → **Substring case-insensitive** sobre `merchant`/descripción; ante empate gana la de mayor **prioridad explícita**.
- **AC-4:** ¿A qué movimientos aplica? → A **cualquier movimiento sin categoría** (webhook y manual); nunca pisa una categoría ya asignada.
- **AC-4:** ¿Sin match, cómo queda? → Categoría por defecto **"Sin categorizar"** (categoría sistémica), no campo nulo.
- **AC-5:** ¿Política al archivar una cuenta con movimientos? → **Soft-delete en cascada**; los movimientos soft-deleted **no cuentan en ningún cálculo** (saldo/reportes), se preserva el historial.
- **AC-5:** ¿Transferencia con contraparte en cuenta activa? → Se **soft-deletea el par completo** (ambas patas del `transferGroup`); nunca queda una sola pata.

## Reglas de Negocio

- Las transferencias son un par de movimientos enlazados por `transferGroup`; ninguna operación
  puede dejar una sola pata.
- Las columnas tipo-enum se guardan como varchar; los valores permitidos viven en la capa de aplicación.
- Toda escritura va scopeada al usuario autenticado.

## Fuera de Alcance

- El canal de entrega de notificaciones que consumirá el outbox — se define en `sm-0001` (AC-1).
  Esta historia garantiza la persistencia y el relay confiable, no el destino final.

## Technical Context

### Microservicio objetivo
- `apps/finances` — toda la historia (AC-1 a AC-5) cae en esta app; sus módulos
  (`account`, `movement`/`transfer`, `budget`, `category`) más lo nuevo para outbox
  e idempotencia.

### Patrones obligatorios
- Los patrones ya establecidos en el proyecto: arquitectura hexagonal por módulo
  (`domain`/`application`/`infrastructure/adapters`), puertos como `abstract class`
  para DI, DTOs `*-input`/`*-output`, columnas tipo-enum como varchar.
- Para idempotencia, aplicar validaciones sobre el body del request (el hash/comparación
  del cuerpo forma parte de la verificación de la `Idempotency-Key`).

### Restricciones técnicas
- No usar enums de PostgreSQL (valores permitidos solo en la capa de aplicación).
- No romper los contratos de API existentes (webhook y endpoints actuales).
- No tocar el flujo de cálculo de saldo de `sm-0001` más allá de consumirlo.
- El relay del outbox no debe bloquear el request HTTP que origina el evento.

### Integraciones conocidas
- Se reutiliza **PGMQ** (el componente de mensajería que ya vive en la base de datos,
  usado por el publisher de presupuestos); no se introducen componentes nuevos.
- El mecanismo de mensajería debe quedar **detrás de una abstracción** (puerto) para
  poder intercambiarlo fácilmente más adelante (p. ej. RabbitMQ) sin reescribir el dominio.
