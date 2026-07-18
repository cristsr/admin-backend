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
- El comportamiento ante saldo insuficiente sigue una política definida (rechazar / permitir saldo negativo).

[NEEDS CLARIFICATION: ¿la política es global, por cuenta, o configurable por usuario? (algunas cuentas — tarjetas de crédito — deberían permitir saldo negativo)]
[NEEDS CLARIFICATION: el saldo a validar depende del "saldo vivo" definido en `sm-0001` AC-3; ¿esta historia asume ese cálculo disponible?]

### AC-2: Patrón Outbox transaccional para eventos de dominio

`movement.saved` se emite en memoria con `EventEmitter2`; si el proceso cae entre el commit
del movimiento y la ejecución del handler, el cruce de presupuesto se pierde. El sistema debe
persistir los eventos de dominio de forma transaccional con el cambio que los origina.

- El evento se persiste en la misma transacción que el movimiento que lo dispara.
- Un proceso relee la tabla outbox y entrega los eventos pendientes de forma confiable, con reintentos.
- Un evento no entregado no se pierde ante una caída del proceso.

[NEEDS CLARIFICATION: ¿qué eventos entran al outbox — solo `movement.saved`/`BudgetThresholdExceeded`, o todo evento de dominio?]
[NEEDS CLARIFICATION: ¿el relay del outbox es un cron interno, o un proceso/worker separado?]

### AC-3: Idempotencia en escrituras de usuario

El webhook ya es idempotente, pero un doble-submit del front crea movimientos o transferencias
duplicados. El sistema debe aceptar una `Idempotency-Key` en las escrituras de usuario.

- `POST /movements` y `POST /transfers` aceptan un header `Idempotency-Key`.
- Dos requests con la misma clave y el mismo cuerpo producen un solo registro y devuelven el mismo resultado.

[NEEDS CLARIFICATION: ¿cuánto tiempo se retiene una `Idempotency-Key` antes de expirar?]
[NEEDS CLARIFICATION: ¿qué pasa si llega la misma clave con un cuerpo distinto — error 422, o se ignora y devuelve el original?]

### AC-4: Reglas de auto-categorización

Al llegar un movimiento por webhook sin categoría, el sistema puede asignarle una categoría
automáticamente según reglas por `merchant` o patrón de descripción definidas por el usuario.

- El usuario puede definir reglas (patrón → categoría/subcategoría).
- Un movimiento entrante sin categoría que matchea una regla queda categorizado automáticamente.
- Si ninguna regla matchea, el movimiento queda sin categoría (o con una categoría por defecto).

[NEEDS CLARIFICATION: ¿las reglas se aplican solo a movimientos de webhook, o también a los manuales?]
[NEEDS CLARIFICATION: ¿el match es por igualdad de `merchant`, por substring, o por expresión más rica? ¿Qué gana si varias reglas matchean?]
[NEEDS CLARIFICATION: ¿existe una categoría "Sin categorizar" por defecto, o el campo queda nulo?]

### AC-5: Política de cierre/archivado de cuentas con movimientos

Hoy `DELETE` de cuenta es soft-delete, sin definir qué pasa con sus movimientos y las
transferencias enlazadas. El sistema debe aplicar una política explícita.

- Al eliminar/archivar una cuenta, el sistema aplica una regla definida sobre sus movimientos
  y sobre las transferencias donde participa.
- La operación no deja transferencias con una sola pata válida.

[NEEDS CLARIFICATION: ¿la política es bloquear el borrado si la cuenta tiene saldo o movimientos, archivar en cascada, o reasignar los movimientos a otra cuenta?]
[NEEDS CLARIFICATION: ¿qué pasa con una transferencia cuya contraparte sigue en una cuenta activa?]

## Reglas de Negocio

- Las transferencias son un par de movimientos enlazados por `transferGroup`; ninguna operación
  puede dejar una sola pata.
- Las columnas tipo-enum se guardan como varchar; los valores permitidos viven en la capa de aplicación.
- Toda escritura va scopeada al usuario autenticado.

## Fuera de Alcance

- El canal de entrega de notificaciones que consumirá el outbox — se define en `sm-0001` (AC-1).
  Esta historia garantiza la persistencia y el relay confiable, no el destino final.
