# sm-0001: Cerrar huecos de features a medias

## Historia de Usuario

**Como** usuario del backend de finanzas (y los sistemas que lo consumen: front y la ingesta Rust)
**Quiero** que las funcionalidades que el código ya dejó insinuadas queden completas y usables end-to-end
**Para** no depender de que cada cliente recalcule, simule o parchee lo que el backend dejó sin cerrar

> Contexto: agrupa las ideas del **Grupo A** de `LLUVIA_DE_IDEAS.md` — huecos que el
> diseño actual anticipa pero no terminó. Ver estado del código en `RESUMEN_EJECUTIVO.md`.

## Criterios de Aceptación

### AC-1: Canal de entrega para el evento `BudgetThresholdExceeded`

Hoy el evento se calcula al cruzar 80%/100% del presupuesto y solo se escribe en log.
Debe existir un sink real que entregue la notificación fuera del proceso, de modo que
el consumidor (front o servicio de notificaciones) se entere del cruce de umbral.

- Cuando un movimiento hace que un presupuesto cruce un umbral, el evento se publica en una
  cola/broker de mensajería, de la que un consumidor externo (front o servicio de
  notificaciones) lo toma. No se entrega solo por log.
- Cada umbral (80% y 100%) se notifica **una sola vez por período** del presupuesto: un nuevo
  movimiento que mantenga el presupuesto por encima de un umbral ya notificado no vuelve a emitir.
- La entrega es idempotente: el mismo cruce de umbral no debe notificarse dos veces.

### AC-2: Conversión de moneda con tasas históricas por fecha

Existe el campo `currency` en cuentas y movimientos, pero no hay lógica de conversión.
Debe existir un puerto `ExchangeRateProvider` que devuelva la tasa entre dos monedas a
una fecha dada, para habilitar balance consolidado y transferencias cross-currency.

- El sistema puede convertir un monto de una moneda a otra usando la tasa vigente en la
  fecha del movimiento (no la tasa de hoy).
- Con conversión disponible, `summary/balance` puede consolidar cuentas en monedas distintas
  a la **moneda de presentación del usuario**: cada usuario define su moneda de presentación
  (una preferencia persistida en su perfil) y el total consolidado se convierte a ella.
- Con conversión disponible, una transferencia entre cuentas de distinta moneda deja de
  rechazarse (hoy `CreateTransferUsecase` lanza `TransferCurrencyMismatchException`).
- Las tasas provienen del microservicio `exchanges` (hoy huérfano y roto), que se reactiva/rehace
  para exponer la tasa entre dos monedas a una fecha dada; `finances` lo consume a través del
  puerto `ExchangeRateProvider`.
- Si no hay tasa para la fecha pedida, se usa la **más cercana anterior** disponible
  (carry-forward): fines de semana y feriados toman la cotización del último día hábil previo.

### AC-3: Saldo vivo calculado por cuenta

`Account` solo guarda `initialBalance`; el saldo real hay que derivarlo de los movimientos.
Debe existir un endpoint que devuelva el saldo actual de una cuenta = `initialBalance` +
suma de sus movimientos, respetando el signo de cada tipo.

- El saldo suma `INCOME` y `TRANSFER_IN`, resta `EXPENSE` y `TRANSFER_OUT`.
- El cálculo excluye movimientos soft-deleted.
- El endpoint está scopeado al usuario autenticado (una cuenta ajena no es accesible).
- Se expone `GET /accounts/:id/balance` para el saldo de una cuenta puntual, y además el saldo
  se incluye en el output de `GET /accounts` para no obligar al front a N llamadas al listar.
- El saldo se calcula **on-the-fly** en cada request con una agregación SQL (`SUM` sobre los
  movimientos, apoyada en el índice por `account_id` ya existente); no se materializa.

### AC-4: Edición de movimientos (`PATCH /movements/:id`)

Hoy `movements` solo tiene create/find/delete. El modelo ya separó `merchant` (dato de
ingesta) de `notes` (dato del usuario) para permitir editar sin destruir lo extraído, pero
no existe el endpoint que lo aproveche.

- Un movimiento existente puede editarse (al menos: `description`, `notes`, `categoryId`,
  `subcategoryId`, `paymentMethod`, `date`, `amount`).
- El PATCH **no permite cambiar `type`** ni editar movimientos de tipo `TRANSFER_IN`/
  `TRANSFER_OUT`: cambiar el tipo o tocar una sola pata rompería la consistencia del par
  `transferGroup` y de los reportes. Para modificar una transferencia se usa anular+recrear (AC-5).
- La edición respeta la regla de negocio existente: la subcategoría debe pertenecer a la categoría.
- La edición está scopeada al usuario; un movimiento ajeno no puede editarse.
- Editar la nota del usuario nunca sobrescribe el `merchant` extraído por la ingesta.
- En movimientos con `source = WEBHOOK`, el PATCH solo edita **campos del usuario** (`notes`,
  `categoryId`, `subcategoryId`, `paymentMethod`); los datos extraídos por la ingesta
  (`merchant`, `amount`, `date` y los de factura) quedan protegidos de edición para no
  desincronizar el movimiento de la transacción origen reconciliada.

### AC-5: CRUD completo de scheduled y transfer

`scheduled` no tiene edición (cambiar monto o frecuencia obliga a borrar y recrear) y
`transfer` solo tiene `POST` (no hay forma de anular una transferencia).

- Un movimiento programado (`scheduled`) puede editarse (monto, frecuencia, próxima fecha,
  categoría, cuenta) sin borrarlo y recrearlo.
- Una transferencia puede anularse mediante **reversa compensatoria**: al anular, se crean
  dos movimientos que compensan las patas originales (mismo `transferGroup`), en una sola
  transacción. Nada se borra — el historial de la transferencia y de su anulación queda intacto
  y auditable.
- Al editar un `scheduled`, los movimientos ya materializados en el pasado **no se modifican**
  (son hechos ocurridos); el cambio del template solo aplica a las próximas ocurrencias.
- Ambas operaciones están scopeadas al usuario autenticado.

### AC-6: Reversa/anulación de un movimiento originado por webhook

La ingesta es idempotente al crear, pero si una transacción se reconcilió mal no hay
contrapartida. Debe existir una operación para revertir un movimiento identificado por su
`externalReference`.

- Dado un `externalReference` existente, el sistema revierte el movimiento asociado creando un
  **movimiento compensatorio** que anula su efecto, preservando el rastro de la corrección
  (coherente con la reversa de transferencias en AC-5). No se hace soft-delete del original.
- La operación es idempotente: revertir dos veces el mismo `externalReference` no duplica el efecto.
- La operación se autentica como sistema (API key del webhook), no con JWT de usuario.
- La reversa se expone como un **recurso REST dedicado**: `POST /webhooks/transactions/{externalReference}/reversal`
  (sustantivo-recurso, no un verbo en la URL: crear la reversa es su propio recurso, separado del
  alta de la transacción), protegido con la misma API key del webhook.

## Reglas de Negocio

- Las columnas tipo-enum se guardan como varchar/text; los valores permitidos viven en la
  capa de aplicación (`MovementType`, `PaymentMethod`, `MovementSource`, `Frequency`). No se
  crean enums de Postgres.
- Solo `INCOME` y `EXPENSE` son movimientos reportables; `TRANSFER_IN`/`TRANSFER_OUT` mueven
  saldo pero no cuentan como ingreso ni gasto en reportes.
- Toda lectura y escritura de datos personales va scopeada al usuario autenticado. Las
  categorías/subcategorías son la única taxonomía global compartida.
- Las transferencias se registran como par de movimientos enlazados por `transferGroup`, y
  cualquier operación sobre una debe mantener la consistencia de ambas patas.

## Fuera de Alcance

- La reconstrucción interna del microservicio `apps/exchanges` (su implementación y su fuente de
  datos de mercado) es trabajo aparte. Esta historia define el puerto `ExchangeRateProvider` que
  lo consume y el comportamiento esperado; la fuente ya está decidida (reactivar `exchanges`).
- Reportes y analítica avanzada (Grupo B, historia `sm-0002`).

## Resolución de Ambigüedades

- **AC-1:** ¿Por qué canal se entrega la notificación de umbral de presupuesto? → Cola/broker de mensajería: el evento se publica y un consumidor externo lo toma.
- **AC-2:** ¿En qué moneda se presenta el balance consolidado? → Moneda de presentación por usuario (preferencia persistida en su perfil).
- **AC-4:** ¿El PATCH puede cambiar `type` o editar transferencias? → No: `type` es inmutable y las patas `TRANSFER_IN`/`TRANSFER_OUT` no se editan; se usa anular+recrear (AC-5).
- **AC-5:** ¿Anular una transferencia es borrado o reversa? → Reversa compensatoria (dos movimientos que compensan las patas originales, mismo `transferGroup`), sin borrar nada.
- **AC-6:** ¿Revertir un movimiento de webhook es soft-delete o compensación? → Movimiento compensatorio que anula el efecto, coherente con AC-5.
- **AC-1:** ¿Con qué frecuencia se notifica un umbral? → Una sola vez por umbral (80%/100%) y período; movimientos posteriores por encima no reemiten.
- **AC-2:** ¿Fuente de las tasas de cambio? → Reactivar el microservicio `apps/exchanges`, consumido por `finances` vía el puerto `ExchangeRateProvider`.
- **AC-2:** ¿Qué pasa si no hay tasa para la fecha? → Usar la más cercana anterior (carry-forward), como en finanzas para fines de semana/feriados.
- **AC-4:** ¿Se editan movimientos `source = WEBHOOK`? → Sí, pero solo campos del usuario (`notes`, categoría, subcategoría, `paymentMethod`); los datos de ingesta quedan protegidos.
- **AC-5:** Al editar un `scheduled`, ¿qué pasa con las ocurrencias pasadas? → Quedan intactas; el cambio solo aplica a ocurrencias futuras.
- **AC-3:** ¿Cómo se expone el saldo vivo? → `GET /accounts/:id/balance` para el saldo puntual + saldo embebido en `GET /accounts` para el listado.
- **AC-3:** ¿On-the-fly o materializado? → On-the-fly con agregación SQL (`SUM` sobre movimientos, índice por `account_id`); sin materializar.
- **AC-6:** ¿Forma del endpoint de reversa? → Recurso REST dedicado `POST /webhooks/transactions/{externalReference}/reversal` (sustantivo-recurso, no verbo).

## Technical Context

### Microservicio objetivo
- finances (`apps/finances`)

### Artefactos a reutilizar
- `MovementRepository` / `Movement` (domain) — reversas de AC-5/AC-6 y cálculo de saldo (AC-3)
- `MovementSource`, `MovementType`, `reportableMovementTypes` — clasificación de movimientos
- `AccountRepository` — saldo vivo por cuenta (AC-3)
- `CreateTransferUsecase` / `transferGroup` — base para anular una transferencia (AC-5)
- `BudgetThresholdExceededEventHandler` + `EventEmitter2` — punto donde hoy el evento muere en log (AC-1)
- `WebhookApiKeyGuard` — auth de sistema para revertir un movimiento de webhook (AC-6)
- `ReceiveWebhookTransactionUsecase` — idempotencia por `externalReference` (AC-6)

### Patrones obligatorios
- Arquitectura hexagonal por módulo (`domain`/`application`/`infrastructure`); un usecase por acción de negocio
- Puertos como `abstract class` (sin `Symbol`/`InjectionToken`); mappers dominio↔TypeORM separados
- Columnas tipo-enum como varchar; valores permitidos en la capa de aplicación (memoria no-db-enums)
- Migraciones TypeORM (no `synchronize`); toda lectura/escritura de datos personales scopeada por `user.id`

### Restricciones técnicas
- **Mensajería sobre PostgreSQL** (postgresmq/PGMQ): AC-1 publica el evento en una cola implementada
  sobre la DB existente; no se suma un broker externo (Redis/RabbitMQ/Kafka)
- No dejar nunca una transferencia con una sola pata del `transferGroup`
- No romper el contrato del webhook ni de `GET /categories/taxonomy` (consumidos por la ingesta Rust)
- Reversa/compensación en vez de borrado (AC-5, AC-6): nada se elimina, se compensa preservando el rastro

### Deuda técnica relevante
- `apps/exchanges` huérfano y roto — es la fuente de tasas decidida para AC-2, hay que reactivarlo/rehacerlo antes de consumirlo
- `BudgetThresholdExceeded` hoy solo hace `log`; la cola sobre Postgres es infraestructura nueva a introducir
