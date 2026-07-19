# design: sm-0003

> Generado por /design. Input para /plan.
> Investigación técnica: `docs/research.md`.
> Diagrama completo: `docs/diagram.md`. Contrato completo: `docs/api.yaml`.
> Modelado de datos: `docs/data-model.md`.
> Revisá todo antes de ejecutar `/plan sm-0003`.

## Decisiones de Diseño

- **AC-1 · campo de política de saldo negativo:** `allowNegativeBalance: boolean`
  (default `false`) en `account` — resuelve el AC con mínima superficie; sin enum de
  tipo ni cupo hasta que un AC lo pida (YAGNI).
- **AC-1 · saldo a validar:** reutiliza el "saldo vivo" de sm-0001
  (`AccountRepository.movementBalance` + `initialBalance`), no reimplementa el cálculo.
- **AC-1 · código de rechazo:** `422` (`InsufficientBalanceException`) — request válido
  que viola una regla de negocio; consistente con el 422 de idempotencia.
- **AC-2 · entrega del relay:** el cron re-despacha in-process vía `EventEmitter2`
  (`emitAsync`), corriendo los handlers existentes; PGMQ queda como entrega externa sin
  cambios. Sin componentes nuevos (ver `docs/research.md`).
- **AC-2 · alcance de eventos:** todo evento de dominio pasa por el outbox mediante un
  publicador transaccional genérico; se cablea primero `movement.saved`.
- **AC-3 · almacenamiento:** tabla dedicada `idempotency_keys` + interceptor NestJS que
  reproduce la respuesta; clave única `(user_id, idempotency_key)`, hash del body para
  detectar conflicto, retención 24h con cron de purga.
- **AC-3 · conflicto de body:** misma clave + hash distinto → `422`; request en curso con
  la misma clave → `409`.
- **AC-4 · matching:** substring case-insensitive sobre `merchant`/`description`; a mayor
  `priority` gana; sin selector de campo (simplicidad, coherente con `/clarify`).
- **AC-4 · categoría por defecto:** categoría global sistémica "Sin categorizar"
  (flag `system` en `categories`, sembrada por migración); `movement.categoryId` sigue
  siendo no-nulo. En `MovementInput`, `categoryId` pasa a opcional.
- **AC-5 · política:** soft-delete en cascada (cuenta + movimientos + ambas patas de cada
  `transferGroup`); los cálculos por SQL crudo deben filtrar `deleted_at IS NULL`.

## Flujo entre microservicios

Toda la historia vive en la app `finances` (monolito); no hay saltos entre
microservicios. Los flujos relevantes: crear transferencia con validación de saldo +
idempotencia (AC-1/AC-3), persistir y relayar eventos de dominio vía outbox (AC-2),
auto-categorizar movimientos entrantes sin categoría (AC-4) y archivar cuentas en
cascada (AC-5). Detalle completo en `docs/diagram.md`.

## Contratos por microservicio

### finances

| Método | Ruta | Descripción de negocio |
|--------|------|-------------------------|
| POST | /accounts | Crear cuenta declarando `allowNegativeBalance` (AC-1) |
| PATCH | /accounts/{id} | Actualizar cuenta, incl. `allowNegativeBalance` (AC-1) |
| DELETE | /accounts/{id} | Archivar cuenta en cascada — reemplaza el bloqueo por movimientos (AC-5) |
| POST | /movements | Crear movimiento idempotente; `categoryId` opcional con auto-categorización (AC-3/AC-4) |
| POST | /transfers | Crear transferencia con validación de saldo e idempotencia (AC-1/AC-3) |
| POST | /categorization-rules | Crear regla de auto-categorización (AC-4) |
| GET | /categorization-rules | Listar reglas del usuario por prioridad (AC-4) |
| PATCH | /categorization-rules/{id} | Actualizar una regla (AC-4) |
| DELETE | /categorization-rules/{id} | Eliminar una regla (AC-4) |

> AC-2 (Outbox) no expone endpoints: es infraestructura interna (tabla + relay `@Cron`
> que re-despacha eventos de dominio). El webhook de ingreso también consume la
> auto-categorización (AC-4), pero su contrato de ingreso no cambia salvo que `category`
> deja de ser obligatoria (fallback a reglas / categoría por defecto).

> Schemas de request/response, validaciones y códigos completos: `docs/api.yaml` (tag `finances`).

## Modelado de datos

Tablas modificadas: `accounts` (+`allow_negative_balance`), `categories` (+`system` y seed
"Sin categorizar"). Tablas nuevas: `outbox_events`, `idempotency_keys`, `categorization_rules`.

> Entidades TypeORM y migraciones SQL completas: `docs/data-model.md`.

## Validación de Quality Gates

No hay `constitution.md` en el proyecto — se aplican los cuatro gates built-in por default.
Correr `/constitution` los haría exigibles a nivel proyecto.

| Gate | Resultado | Justificación |
|------|-----------|---------------|
| Simplicity | ✅ | Se reutiliza el saldo de sm-0001, el publisher PGMQ y el patrón `@Cron`; el outbox re-despacha in-process en vez de sumar cola+consumer; flag booleano en vez de enum de tipos. |
| Anti-Abstraction | ✅ | Interceptor/scheduler nativos de NestJS y transacciones de TypeORM directas; puertos `abstract class` solo donde ya es el patrón del repo (repositorios, publisher). Sin capas nuevas especulativas. |
| Integration-First | ✅ | `docs/api.yaml` (OpenAPI 3.1) definido antes del código; `/plan` genera DTOs y entidades conformes al contrato y al `data-model.md`. |
| Test-First | ✅ | `/plan` escribirá los tests antes del código (TDD); los flujos críticos (validación de saldo, replay idempotente, relay del outbox, cascada de archivado) son verificables por el contrato. |

## Notas de alcance para /plan

- Historia grande: 3 tablas nuevas + 2 alteradas + ~9 endpoints + infra de outbox e
  idempotencia. `/plan` debería secuenciar por AC (AC-1 → AC-5) y tratar el outbox y la
  idempotencia como sub-entregables con sus migraciones propias.
- Módulos nuevos sugeridos: `outbox`, `idempotency`, `categorization-rule` (hexagonales,
  registrados en `app.module.ts` y sus entidades en `data-source.ts`).
- Excepciones nuevas sobre la jerarquía de `@shared`: `InsufficientBalanceException` (422),
  `IdempotencyConflictException` (422), `IdempotencyInProgressException` (409). Nunca `Error` crudo.
- AC-5 elimina el uso de `AccountHasMovementsException` en `remove-account.usecase`; revisar
  si la clase queda huérfana.
