# design: hu-0009

## Flujo entre microservicios

El kernel HTTP de `apps/ledger` canaliza toda interacción REST hacia los buses de
aplicación (command/query bus) mediante un pipeline global de guard → interceptor →
controllers sin lógica de dominio. El Swagger UI sirve el contrato OpenAPI generado
desde decoradores de código. No hay comunicación entre microservicios en esta HU.

> Diagramas de flujo y modelo LikeC4 en `docs/`: `model.delta.c4`, `flows/*.md`,
> `api.delta.yaml`.

## Componentes del módulo

Esta HU documenta el kernel HTTP del módulo `shared` (`apps/ledger/src/shared/infrastructure/adapters/http/`),
ya construido incrementalmente en historias previas. Se agregan al modelo LikeC4 siete
componentes de infraestructura: `SharedHttpModule`, `CommandAcceptedDto`, `CommandResultInterceptor`,
`LedgerContextGuard`, `LedgerContextResolver`, `GatewayHeaderContextResolver`, `SwaggerBuilder`.

> Diagrama C4 Nivel 3 completo: `docs/model.delta.c4` (extiende `admin.ledger.shared`).

## Impacto en Arquitectura Global

**¿Toca arquitectura global?** No.

La HU documenta componentes internos del módulo `shared` sin agregar módulos, microservicios,
integradores ni actores nuevos. El kernel HTTP ya existe en el código base; el diseño documenta
su estructura y relaciones dentro del contenedor `admin.ledger.shared`.

## Contratos por microservicio

### apps/ledger

| Método | Ruta | Descripción de negocio |
|--------|------|------------------------|
| GET | /api/docs | Swagger UI con contrato OpenAPI generado desde decoradores de código. Solo fuera de producción. |

> Schemas de request/response y códigos de respuesta: `docs/api.delta.yaml` (tag `shared`).

**Patrones transversales (todos los endpoints REST):**

| Patrón | AC | Descripción |
|--------|----|-------------|
| POST /api/v1/* | AC-4, AC-5, AC-6 | Controller → `CommandBus.dispatch` → `CommandResultInterceptor` → `CommandAcceptedDto { id, streamPosition }` |
| GET /api/v1/* | AC-4, AC-6 | Controller → `QueryBus.ask` → read model DTO |

## Decisiones de Diseño

- **AC-2 — Ruta de Swagger:** `/api/docs`, no `/api/v1/docs`. `SwaggerModule.setup` respeta `setGlobalPrefix('api')` pero no `enableVersioning` — Swagger no registra rutas por versión.
- **AC-5 — Campos de CommandAcceptedDto:** `{ id, streamPosition }` (2 campos), no `{ id, sequence, streamPosition }`. `CommandResult` expone `aggregateId`, `streamPosition` (bigint), `idempotentReplay` — no existe `sequence`.
- **RNF-11 — Ubicación del código HTTP:** `shared/infrastructure/adapters/http/`, no `shared-kernel/infrastructure/adapters/http/`. `shared-kernel/` aloja el núcleo hexagonal (domain + application ports + infra de event-store/proyecciones); `shared/` aloja código de dominio compartido y los adaptadores HTTP.
- **Estado general:** La HU documenta infraestructura ya construida. Los ACs son reformulados para reflejar el código existente (ver `hu.md` actualizado). El wiring test (`app.wiring.spec.ts`) y el Swagger builder (`ledger-swagger.builder.ts`) ya pasan en verde.

## Validación de Quality Gates

| Gate | Resultado | Justificación |
|------|-----------|---------------|
| Simplicity | ✅ | No se agregan capas ni abstracciones nuevas — se documentan componentes de infraestructura ya existentes. |
| Anti-Abstraction | ✅ | Se usa `@nestjs/swagger` directo (DocumentBuilder, SwaggerModule), `@nestjs/core` (APP_GUARD), `class-validator` sin wrappers propios. |
| Integration-First | ✅ | El contrato OpenAPI se genera desde decoradores de código (`@ApiProperty`, `@ApiTags`), no desde un YAML externo — la implementación es la fuente de verdad. |
| Test-First | ✅ | `ledger-swagger.builder.spec.ts` y `app.wiring.spec.ts` ya existen y pasan. `/plan` generará tareas de verificación, no de implementación nueva. |
