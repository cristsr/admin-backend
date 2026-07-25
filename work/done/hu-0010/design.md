# design: hu-0010

## Flujo entre microservicios

El contexto autenticado (`x-user-id`, `x-client-id`) es resuelto por el
`LedgerContextGuard` (APP_GUARD global) vía el puerto `LedgerContextResolver`,
implementado por `GatewayHeaderContextResolver` (headers HTTP). El guard adjunta
el `LedgerContext { userId, clientId }` al request; el controller lo consume vía
`@Context()` y ensambla `AuthContext`/`QueryContext` para los buses de aplicación.
El `AuthenticatedContextPolicy` en el command bus valida la presencia de ambos
campos antes de ejecutar cualquier handler. No hay comunicación entre
microservicios en esta HU.

> Diagrama de flujo y modelo LikeC4 en `docs/`: `model.delta.c4`, `flows/*.md`.

## Componentes del módulo

Dos componentes nuevos en `shared-kernel`: `AuthenticatedContextPolicy` (policy del
command bus que valida `userId`/`clientId` antes de delegar, lanza
`MissingAuthContextException`) y `MissingAuthContextException` (extiende
`DomainUnprocessableException`, código `MISSING_AUTH_CONTEXT`).

Los componentes HTTP (`LedgerContextGuard`, `LedgerContextResolver`,
`GatewayHeaderContextResolver`, `SharedHttpModule`) ya existen desde hu-0009;
hu-0010 los formaliza con los AC documentados en esta historia. Los flujos
`command-dispatch` y `query-dispatch` se actualizan con las reglas de error de
autenticación.

> Diagrama C4 Nivel 3 completo: `docs/model.delta.c4` (extiende `admin.ledger.shared`).

## Flujos afectados

| Operación | Slug | Trigger | Entrypoint |
|---|---|---|---|
| modify | `command-dispatch` | rest | POST /api/v1/* |
| modify | `query-dispatch` | rest | GET /api/v1/* |
| create | `authenticated-context-policy` | sync-call | PolicyCommandBus pipeline |

## Impacto en Arquitectura Global

**¿Toca arquitectura global?** No.

La HU formaliza componentes internos del módulo `shared` y del `shared-kernel` sin
agregar módulos, microservicios, integraciones ni actores nuevos. El guard, resolver y
decoradores ya existen en el código base; el diseño documenta el comportamiento de
autenticación (RF-26) dentro del contenedor `admin.ledger.shared`.

## Contratos por microservicio

### apps/ledger

Sin endpoints nuevos. El comportamiento de autenticación (401 por headers ausentes,
contexto adjuntado por el guard) aplica transversalmente a todos los endpoints REST
existentes.

> El contrato de error 401 está implícito en el `LedgerContextGuard` y documentado en
> `flows/command-dispatch.md` y `flows/query-dispatch.md`. No se genera `api.delta.yaml`
> porque la HU no introduce paths ni schemas nuevos.

## Validación de Quality Gates

| Gate | Resultado | Justificación |
|------|-----------|---------------|
| Simplicity | ✅ | El guard usa `Reflector` nativo de NestJS + `APP_GUARD`. El resolver es una abstract class sin dependencias externas. La policy del command bus sigue el patrón existente de `CommandPolicy`. Sin capas ni abstracciones nuevas. |
| Anti-Abstraction | ✅ | `LedgerContextGuard` implementa `CanActivate` directamente (sin wrapper). `GatewayHeaderContextResolver` extiende el puerto abstracto sin frameworks intermedios. `@Context()` usa `createParamDecorator` nativo de NestJS. |
| Integration-First | ✅ | Sin endpoints nuevos — no aplica contrato OpenAPI. Los tests unitarios del guard, resolver y policy ya existen y pasan (5 specs). |
| Test-First | ✅ | 5 specs unitarias existen y pasan en verde. AC-8 requiere un test e2e de contexto ausente → 401 que `/plan` generará como tarea TDD (test primero, luego implementación si faltara). |
