# design: sm-0001

> Generado por /design. Input para /plan.
> Investigación técnica: `docs/research.md`.
> Diagrama completo: `docs/diagram.md`. Contrato completo: `docs/api.yaml`.
> Modelado de datos: `docs/data-model.md`.
> Revisá todo antes de ejecutar `/plan sm-0001`.

## Decisiones de Diseño

- **Moneda de presentación (AC-2):** claim `presentationCurrency` en el JWT — `finances` la lee de `AuthenticatedUser` sin llamada extra. Requiere agregar el campo a `AuthenticatedUser` (`@shared`) y que `users` lo emita.
- **Montos de transferencia cross-currency (AC-2):** un solo monto (origen) + tasa del sistema; el destino se calcula. `TransferInput` no cambia; `TransferOutput` gana `toAmount`, `toCurrency`, `exchangeRate`.
- **Idempotencia de notificación de umbral (AC-1):** columna `notified_threshold` en `budgets` (no tabla nueva); el budget ya es el "período vigente" y nace limpio al renovarse.
- **Canal de entrega (AC-1):** cola sobre PostgreSQL (PGMQ); flujo async sin endpoint HTTP.
- **Reversas (AC-5, AC-6):** movimientos compensatorios, nunca borrado.

## Flujo entre microservicios

Historia transversal en **finances**, con dos dependencias externas: lee la tasa de cambio de **exchanges** (AC-2, transferencia cross-currency y balance consolidado) y la moneda de presentación llega como claim del JWT emitido por **users** (AC-2). AC-1 no es HTTP: publica en una cola PGMQ que consume un sistema externo. Diagramas por flujo en `docs/diagram.md`.

## Contratos por microservicio

### finances

| Método | Ruta                                                | Descripción de negocio                                                                          |
| ------ | --------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| GET    | /accounts/{id}/balance                              | Saldo vivo de una cuenta (initialBalance + movimientos con signo por tipo) — AC-3               |
| GET    | /accounts                                           | Lista de cuentas con el saldo vivo embebido — AC-3                                              |
| PATCH  | /movements/{id}                                     | Edita un movimiento sin tocar tipo ni transferencias; en WEBHOOK solo campos del usuario — AC-4 |
| PATCH  | /scheduled/{id}                                     | Edita un programado; solo afecta ocurrencias futuras — AC-5                                     |
| POST   | /transfers                                          | Transferencia entre cuentas propias, ahora permite distinta moneda con conversión — AC-2        |
| POST   | /transfers/{transferGroup}/reversal                 | Anula una transferencia con par compensatorio — AC-5                                            |
| POST   | /webhooks/transactions/{externalReference}/reversal | Revierte un movimiento de webhook (compensatorio, idempotente, API key) — AC-6                  |
| GET    | /summary/balance                                    | Balance consolidado en la moneda de presentación del usuario — AC-2                             |

> AC-1 (notificación de umbral) no expone HTTP: es mensajería async sobre PGMQ. Ver `docs/diagram.md`.
> Schemas de request/response, validaciones y códigos completos: `docs/api.yaml` (tag `finances`).

### Dependencias externas (no exponen endpoints nuevos en esta historia)

- **exchanges** — se consume `tasa(from, to, fecha)` vía el puerto nuevo `ExchangeRateProvider`. Reactivar el microservicio es trabajo aparte (fuera de alcance declarado en `hu.md`).
- **users** — emite el claim `presentationCurrency` en el JWT. Cambio en `users` + en `AuthenticatedUser` de `@shared`.

## Modelado de datos

Cambio de esquema en `finances`: columna `notified_threshold` sobre la tabla existente `budgets` (AC-1).

> Entidad TypeORM y migración SQL completas: `docs/data-model.md`.

## Artefactos de código nuevos previstos (guía para /plan)

- Puerto `ExchangeRateProvider` (abstract class) + adaptador HTTP a `exchanges` (AC-2).
- Adaptador de cola PGMQ como sink de `BudgetThresholdExceeded`, reemplazando el `Logger` placeholder (AC-1).
- `MovementRepository`: métodos `update`/reuso de `save`, `findByTransferGroup`, y suma de saldo por cuenta (AC-3, AC-4, AC-5).
- Usecases: `UpdateMovementUsecase` (AC-4), `UpdateScheduledUsecase` (AC-5), `ReverseTransferUsecase` (AC-5), `ReverseWebhookTransactionUsecase` (AC-6), `GetAccountBalanceUsecase` (AC-3).
- Campo `presentationCurrency` en `AuthenticatedUser` (`@shared`).

## Validación de Quality Gates

Sin constitución en el proyecto — se aplican los 4 gates built-in por defecto. Ejecutar `/constitution` los haría exigibles a nivel proyecto.

| Gate              | Resultado | Justificación                                                                                                                                                                                                       |
| ----------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Simplicity        | ⚠️        | El contrato es grande (8 endpoints + mensajería + 2 dependencias externas) porque la historia agrupa 6 features. No agrega capas innecesarias, pero conviene fragmentar en `/plan` (ver excepción).                 |
| Anti-Abstraction  | ✅        | Reutiliza el patrón hexagonal existente, `MovementRepository`/`saveAll`, `transfer_group` y `EventEmitter2` ya presentes; el único puerto nuevo (`ExchangeRateProvider`) está justificado por una integración real. |
| Integration-First | ✅        | `api.yaml` define el contrato antes del código; `/plan` generará DTOs y contract tests a partir de él.                                                                                                              |
| Test-First        | ✅        | Se garantiza en `/plan`: los tests (saldo con signos, idempotencia de reversa y de umbral, rechazo de edición en WEBHOOK, conversión cross-currency) se escriben antes del código.                                  |

## Excepciones a la constitución

- **Simplicity (⚠️):** el diseño cubre las 6 funcionalidades del Grupo A en una sola historia, lo que produce un contrato amplio. Se acepta como excepción **con la condición de que `/plan` fragmente la implementación por AC** en lotes independientes (AC-3 y AC-4 primero por ser autocontenidos; AC-1 y AC-2 después por requerir infraestructura/dependencias externas). Pendiente de aprobación del usuario en la revisión.
