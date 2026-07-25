# hu-0010: Contexto autenticado externo (`user_id`, `client_id`) — RF-26

## Historia de Usuario

**Como** operador del ledger (`apps/ledger`)
**Quiero** que toda petición exija y resuelva un contexto autenticado `(user_id, client_id)`
provisto por infraestructura externa, inyectado de forma declarativa en los controllers
**Para** garantizar que ninguna operación de negocio se ejecute sin un dueño de ledger y una
procedencia identificados (RF-26), particionando todo por `user_id` (INV-9) sin que el ledger
administre identidad

> Corresponde a **EP-2.3** del [roadmap del ledger](../../../ledger-roadmap.md).
> Detalle técnico: `work/ledger/EP-2-api.md` (sección EP-2.3). Depende del andamiaje HTTP
> (`hu-0009`).

## Criterios de Aceptación

### AC-1: Rechazo (401) sin `x-user-id`

Una petición sin el header `x-user-id` es rechazada con `401 Unauthorized` por el
`LedgerContextGuard`, antes de alcanzar cualquier handler de negocio.

### AC-2: Rechazo (401) sin `x-client-id`

Una petición sin el header `x-client-id` es rechazada con `401 Unauthorized`.

### AC-3: Contexto adjuntado cuando ambos están presentes

Cuando ambos headers están presentes, el guard resuelve un `LedgerContext`
`{ userId, clientId }` y lo adjunta a la request para que el decorador lo lea.

### AC-4: `@Context()` inyecta el contexto en el handler

El param decorator `@Context()` devuelve el `LedgerContext` resuelto dentro del método del
controller, sin que el controller conozca cómo se resolvió.

### AC-5: Guard global con excepción `@Public()`

El `LedgerContextGuard` se registra global (`APP_GUARD`), de modo que todo endpoint exige
contexto por defecto. Un endpoint de infraestructura marcado `@Public()` (health) omite el
guard.

### AC-6: `client_id` viaja opaco hasta el command

El `client_id` llega hasta el command sin interpretación ni validación de identidad: el ledger
solo exige su presencia y lo registra como metadata (RF-12). La propagación al envelope del
evento la realiza el command handler (fuera de esta HU).

### AC-7: Resolver intercambiable sin tocar controllers

El mecanismo concreto vive tras el puerto `LedgerContextResolver`. Cambiar de
`GatewayHeaderContextResolver` (default de desarrollo) a un resolver JWT es reemplazar el
binding del provider, con cero cambios en los controllers (RNF-11).

### AC-8: e2e de contexto ausente

`POST /api/v1/accounts` sin headers de contexto responde `401`.

## Reglas de Negocio

- **RF-26**: ninguna petición de negocio se procesa sin `(user_id, client_id)` válidos.
- `user_id` particiona todo el ledger (INV-9); `client_id` es procedencia opaca (frontend,
  correos, automatizador) — el ledger no valida ni administra identidad de clientes.
- La autenticación/autorización reales viven en un servicio externo; el ledger confía en el
  contexto ya resuelto.
- El puerto es una `abstract class` (no interface) para servir como token de inyección
  (convención TS del proyecto).
- Guard clause: resolver devuelve `null` ante ausencia de cualquiera de los dos headers.
- TDD estricto.

## Fuera de Alcance

- La elección definitiva del mecanismo de autenticación (headers firmados / JWT / mTLS) —
  decisión diferida (pregunta abierta #5 de la spec); esta HU la abstrae tras el puerto.
- La copia del contexto al envelope del evento (responsabilidad del command handler, EP-1).
- El resolver JWT como default productivo — se deja el adaptador alternativo esbozado, no
  cableado como default.

## Technical Context

### Microservicio objetivo
- `apps/ledger`

### Artefactos a reutilizar
- Patrón de `libs/shared/src/auth/guards/jwt-auth.guard.ts`,
  `libs/shared/src/decorators/current-user.decorator.ts`,
  `libs/shared/src/functions/extract-user-from-context.ts`.
- `libs/shared/src/decorators/public.decorator.ts` + `IS_PUBLIC` para `@Public()`.

### Artefactos a crear
- `apps/ledger/src/shared-kernel/domain/context/ledger-context.type.ts`
- `apps/ledger/src/shared-kernel/application/ports/ledger-context-resolver.ts` (puerto)
- `apps/ledger/src/shared/infrastructure/adapters/http/ledger-context.guard.ts`
- `apps/ledger/src/shared/infrastructure/adapters/http/context.decorator.ts`
- `apps/ledger/src/shared/infrastructure/adapters/http/resolvers/gateway-header-context.resolver.ts`

### Patrones obligatorios
- Puerto (`abstract class`) + guard global + param decorator, desacoplado del mecanismo concreto.
- Binding intercambiable: `{ provide: LedgerContextResolver, useClass: GatewayHeaderContextResolver }`.
- TDD estricto.

### Restricciones técnicas
- El núcleo no conoce NestJS; el guard y los resolvers viven en `infrastructure/adapters/http`.
- Sin contexto válido → 401, siempre.

### Riesgo conocido
- Pregunta abierta #5 sin cerrar puede cambiar el resolver; mitigado por el puerto (cambio de
  un provider, no de controllers).
